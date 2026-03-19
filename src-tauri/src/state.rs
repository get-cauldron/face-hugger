use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct UserInfo {
    pub name: String,
    pub fullname: Option<String>,
    /// HF API returns "avatarUrl" — rename to snake_case for consistency across Rust and TypeScript.
    #[serde(alias = "avatarUrl")]
    pub avatar_url: Option<String>,
    pub email: Option<String>,
    /// HF API returns "type" — rename to avoid Rust keyword conflict.
    /// When serializing, use "type" (what HF API expects).
    /// When deserializing, accept both "type" and "user_type".
    #[serde(rename = "type")]
    pub user_type: Option<String>,
}

#[derive(Debug, Default)]
pub struct AuthState {
    pub token: Option<String>,
    pub user: Option<UserInfo>,
}

pub struct AppState {
    pub auth: Mutex<AuthState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            auth: Mutex::new(AuthState::default()),
        }
    }
}
