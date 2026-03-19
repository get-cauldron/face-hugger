use crate::hf;
use crate::state::{AppState, UserInfo};

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
