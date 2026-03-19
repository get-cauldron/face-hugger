use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum UploadJobState {
    Pending,
    Hashing,
    Uploading,
    Committing,
    Done,
    Failed,
    Paused,
    Cancelled,
}

impl UploadJobState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Hashing => "hashing",
            Self::Uploading => "uploading",
            Self::Committing => "committing",
            Self::Done => "done",
            Self::Failed => "failed",
            Self::Paused => "paused",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(Self::Pending),
            "hashing" => Some(Self::Hashing),
            "uploading" => Some(Self::Uploading),
            "committing" => Some(Self::Committing),
            "done" => Some(Self::Done),
            "failed" => Some(Self::Failed),
            "paused" => Some(Self::Paused),
            "cancelled" => Some(Self::Cancelled),
            _ => None,
        }
    }

    /// Whether this state represents an active (in-progress) upload
    pub fn is_active(&self) -> bool {
        matches!(self, Self::Hashing | Self::Uploading | Self::Committing)
    }

    /// Whether this state is terminal (no further transitions expected)
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Done | Self::Cancelled)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum UploadProtocol {
    Xet,
    LfsMultipart,
}

impl UploadProtocol {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Xet => "xet",
            Self::LfsMultipart => "lfs_multipart",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "xet" => Some(Self::Xet),
            "lfs_multipart" => Some(Self::LfsMultipart),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UploadJob {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub repo_id: String,
    pub repo_type: String,
    pub revision: String,
    pub commit_message: String,
    #[specta(type = f64)]
    pub total_bytes: u64,
    #[specta(type = f64)]
    pub bytes_confirmed: u64,
    pub protocol: Option<UploadProtocol>,
    pub state: UploadJobState,
    pub priority: bool,
    pub retry_count: u32,
    pub last_error: Option<String>,
    #[specta(type = f64)]
    pub created_at: i64,
    #[specta(type = f64)]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UploadProgress {
    pub job_id: String,
    #[specta(type = f64)]
    pub bytes_sent: u64,
    #[specta(type = f64)]
    pub total_bytes: u64,
    pub speed_bps: f64,
    pub eta_seconds: f64,
    pub state: UploadJobState,
}

/// Request to enqueue a new upload
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct EnqueueRequest {
    pub file_path: String,
    pub repo_id: String,
    pub repo_type: String,
    pub revision: String,
    pub commit_message: String,
    pub priority: bool,
}

/// Errors that can occur during upload operations
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", content = "message")]
pub enum UploadError {
    NotFound(String),
    PermissionDenied(String),
    TokenExpired(String),
    NetworkError(String),
    FileChanged(String),
    Cancelled(String),
    ServerError(String),
    BadRequest(String),
}

impl std::fmt::Display for UploadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(m) => write!(f, "Not found: {}", m),
            Self::PermissionDenied(m) => write!(f, "Permission denied: {}", m),
            Self::TokenExpired(m) => write!(f, "Token expired: {}", m),
            Self::NetworkError(m) => write!(f, "Network error: {}", m),
            Self::FileChanged(m) => write!(f, "File changed: {}", m),
            Self::Cancelled(m) => write!(f, "Cancelled: {}", m),
            Self::ServerError(m) => write!(f, "Server error: {}", m),
            Self::BadRequest(m) => write!(f, "Bad request: {}", m),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_transitions_active() {
        assert!(UploadJobState::Hashing.is_active());
        assert!(UploadJobState::Uploading.is_active());
        assert!(UploadJobState::Committing.is_active());
        assert!(!UploadJobState::Pending.is_active());
        assert!(!UploadJobState::Done.is_active());
        assert!(!UploadJobState::Paused.is_active());
    }

    #[test]
    fn test_state_transitions_terminal() {
        assert!(UploadJobState::Done.is_terminal());
        assert!(UploadJobState::Cancelled.is_terminal());
        assert!(!UploadJobState::Failed.is_terminal());
        assert!(!UploadJobState::Paused.is_terminal());
    }

    #[test]
    fn test_state_roundtrip() {
        for state_str in &["pending", "hashing", "uploading", "committing", "done", "failed", "paused", "cancelled"] {
            let state = UploadJobState::from_str(state_str).unwrap();
            assert_eq!(state.as_str(), *state_str);
        }
    }

    #[test]
    fn test_protocol_roundtrip() {
        assert_eq!(UploadProtocol::from_str("xet").unwrap().as_str(), "xet");
        assert_eq!(UploadProtocol::from_str("lfs_multipart").unwrap().as_str(), "lfs_multipart");
        assert!(UploadProtocol::from_str("unknown").is_none());
    }

    #[test]
    fn test_upload_progress_serializable() {
        let progress = UploadProgress {
            job_id: "test-id".to_string(),
            bytes_sent: 1024,
            total_bytes: 4096,
            speed_bps: 512.0,
            eta_seconds: 6.0,
            state: UploadJobState::Uploading,
        };
        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("test-id"));
        assert!(json.contains("uploading"));
    }
}
