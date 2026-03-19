use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use sha2::{Sha256, Digest};
use tauri::Emitter;
use crate::hf;
use crate::state::{AppState, UserInfo};

/// HF OAuth App client_id — public value for native PKCE apps (no secret).
/// Register at https://huggingface.co/settings/applications/new
const HF_OAUTH_CLIENT_ID: &str = "TODO_REGISTER_HF_OAUTH_APP";

fn generate_pkce_verifier() -> String {
    use rand::Rng;
    let bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen::<u8>()).collect();
    URL_SAFE_NO_PAD.encode(&bytes)
}

fn pkce_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    URL_SAFE_NO_PAD.encode(&hash)
}

/// Validate an HF token by calling /api/whoami-v2.
/// On success, stores the token in the OS keychain and updates in-memory state.
#[tauri::command]
#[specta::specta]
pub async fn validate_token(
    token: String,
    state: tauri::State<'_, AppState>,
) -> Result<UserInfo, String> {
    // Call HF whoami-v2 API to validate token
    let user_info = hf::client::whoami(&token).await?;

    // Store token in OS keychain
    let entry = keyring::Entry::new("face-hugger", "hf-token").map_err(|e| e.to_string())?;
    entry.set_password(&token).map_err(|e| e.to_string())?;

    // Update in-memory state
    let mut auth = state.auth.lock().await;
    auth.token = Some(token);
    auth.user = Some(user_info.clone());

    Ok(user_info)
}

/// Get the stored token from in-memory state or OS keychain.
#[tauri::command]
#[specta::specta]
pub async fn get_stored_token(
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    // Check in-memory state first
    {
        let auth = state.auth.lock().await;
        if let Some(token) = &auth.token {
            return Ok(Some(token.clone()));
        }
    }

    // Fall back to keychain
    match keyring::Entry::new("face-hugger", "hf-token") {
        Ok(entry) => match entry.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(keyring::Error::NoStorageAccess(_)) => Ok(None),
            Err(e) => {
                // Log the error but don't fail — no keychain entry is a valid state
                eprintln!("Keychain read error (non-fatal): {}", e);
                Ok(None)
            }
        },
        Err(e) => {
            eprintln!("Keychain entry creation error (non-fatal): {}", e);
            Ok(None)
        }
    }
}

/// Check for an existing HF token from keychain or filesystem.
/// Checks in order: OS keychain, ~/.cache/huggingface/token, ~/.huggingface/token (legacy).
/// Returns None if no token is found anywhere.
#[tauri::command]
#[specta::specta]
pub async fn check_existing_token() -> Result<Option<String>, String> {
    // First check OS keychain (for returning users)
    if let Ok(entry) = keyring::Entry::new("face-hugger", "hf-token") {
        match entry.get_password() {
            Ok(token) if !token.is_empty() => return Ok(Some(token)),
            _ => {}
        }
    }

    // Then check HF CLI token files (for first-time Face Hugger users who already have HF CLI)
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Ok(None),
    };

    let token_paths = [
        home.join(".cache/huggingface/token"), // Current default (HF_HOME/token)
        home.join(".huggingface/token"),        // Legacy fallback
    ];

    for path in &token_paths {
        if let Ok(token) = tokio::fs::read_to_string(path).await {
            let token = token.trim().to_string();
            if !token.is_empty() {
                return Ok(Some(token));
            }
        }
    }

    Ok(None)
}

/// Logout: clears in-memory auth state and removes token from OS keychain.
#[tauri::command]
#[specta::specta]
pub async fn logout(state: tauri::State<'_, AppState>) -> Result<(), String> {
    // Clear in-memory state
    let mut auth = state.auth.lock().await;
    auth.token = None;
    auth.user = None;

    // Delete keychain entry (ignore errors — credential may not exist)
    if let Ok(entry) = keyring::Entry::new("face-hugger", "hf-token") {
        let _ = entry.delete_credential();
    }

    Ok(())
}

/// Start an OAuth browser login flow using PKCE.
/// Returns the HF authorize URL to open in the browser.
/// A localhost server is started to receive the callback.
#[tauri::command]
#[specta::specta]
pub async fn oauth_start(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let verifier = generate_pkce_verifier();
    let challenge = pkce_challenge(&verifier);
    let csrf_state = generate_pkce_verifier(); // reuse PKCE generator for random CSRF token

    {
        let mut auth = state.auth.lock().await;
        auth.oauth_verifier = Some(verifier);
        auth.oauth_state = Some(csrf_state.clone());
    }

    let port = tauri_plugin_oauth::start_with_config(
        tauri_plugin_oauth::OauthConfig { ports: None, response: None },
        move |url| {
            let _ = app.emit("oauth-callback", url);
        },
    ).map_err(|e| e.to_string())?;

    let auth_url = format!(
        "https://huggingface.co/oauth/authorize?client_id={}&redirect_uri=http://localhost:{}&response_type=code&scope=openid+profile+write-repos&state={}&code_challenge={}&code_challenge_method=S256",
        HF_OAUTH_CLIENT_ID, port, csrf_state, challenge
    );

    Ok(auth_url)
}

#[derive(serde::Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
}

/// Exchange an OAuth authorization code for an access token.
/// Validates CSRF state, exchanges code via PKCE, stores token in keyring.
#[tauri::command]
#[specta::specta]
pub async fn oauth_exchange_code(
    callback_url: String,
    state: tauri::State<'_, AppState>,
) -> Result<UserInfo, String> {
    // Parse code and state from callback URL
    let url = reqwest::Url::parse(&callback_url).map_err(|e| format!("Invalid callback URL: {}", e))?;
    let params: std::collections::HashMap<String, String> = url.query_pairs()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();

    let code = params.get("code").ok_or("Missing 'code' in callback")?;
    let returned_state = params.get("state").ok_or("Missing 'state' in callback")?;

    // Validate CSRF state and retrieve verifier
    let (verifier, redirect_uri) = {
        let mut auth = state.auth.lock().await;
        let expected_state = auth.oauth_state.take().ok_or("No OAuth state stored")?;
        if returned_state != &expected_state {
            return Err("OAuth state mismatch — possible CSRF attack".to_string());
        }
        let verifier = auth.oauth_verifier.take().ok_or("No PKCE verifier stored")?;
        // Reconstruct redirect_uri from the callback URL's origin
        let redirect_uri = format!("http://localhost:{}", url.port().unwrap_or(80));
        (verifier, redirect_uri)
    };

    // Exchange code for token
    let client = reqwest::Client::new();
    let resp = client
        .post("https://huggingface.co/oauth/token")
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("client_id", HF_OAUTH_CLIENT_ID),
            ("code_verifier", verifier.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed ({}): {}", status, body));
    }

    let token_resp: OAuthTokenResponse = resp.json().await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    // Validate token via whoami (same as paste-token flow)
    let user_info = crate::hf::client::whoami(&token_resp.access_token).await?;

    // Store in keyring (same entry as paste tokens — unified storage)
    let entry = keyring::Entry::new("face-hugger", "hf-token").map_err(|e| e.to_string())?;
    entry.set_password(&token_resp.access_token).map_err(|e| e.to_string())?;

    // Update in-memory state
    {
        let mut auth = state.auth.lock().await;
        auth.token = Some(token_resp.access_token);
        auth.user = Some(user_info.clone());
    }

    Ok(user_info)
}

/// Cancel an in-progress OAuth flow, clearing stored PKCE state.
#[tauri::command]
#[specta::specta]
pub async fn oauth_cancel(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut auth = state.auth.lock().await;
    auth.oauth_verifier = None;
    auth.oauth_state = None;
    Ok(())
}
