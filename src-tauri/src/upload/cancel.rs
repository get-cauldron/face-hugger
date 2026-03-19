use sqlx::SqlitePool;
use std::collections::HashMap;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

/// Create and store a CancellationToken for a job.
/// If a token already exists for this job_id, the old one is cancelled first.
/// Returns the original token (caller holds this to check cancellation).
pub async fn register_token(
    tokens: &Mutex<HashMap<String, CancellationToken>>,
    job_id: &str,
) -> CancellationToken {
    let mut map = tokens.lock().await;
    // Cancel the old token if one exists
    if let Some(old) = map.remove(job_id) {
        old.cancel();
    }
    let token = CancellationToken::new();
    map.insert(job_id.to_string(), token.clone());
    token
}

/// Cancel a specific upload token (no DB update — for testing and internal use).
pub async fn cancel_job_token(
    tokens: &Mutex<HashMap<String, CancellationToken>>,
    job_id: &str,
) {
    let mut map = tokens.lock().await;
    if let Some(token) = map.remove(job_id) {
        token.cancel();
    }
}

/// Cancel a specific upload: signal the token, update DB state to "cancelled", remove token.
pub async fn cancel_job(
    tokens: &Mutex<HashMap<String, CancellationToken>>,
    db: &SqlitePool,
    job_id: &str,
) -> Result<(), String> {
    // Signal cancellation
    cancel_job_token(tokens, job_id).await;

    // Update state in DB
    let now = chrono::Utc::now().timestamp();
    crate::db::schema::update_job_state(db, job_id, "cancelled", now)
        .await
        .map_err(|e| format!("Failed to update job state to cancelled: {}", e))?;

    Ok(())
}

/// Pause a specific upload: signal the token (worker checks DB state to distinguish cancel vs pause),
/// update DB state to "paused", remove token.
pub async fn pause_job(
    tokens: &Mutex<HashMap<String, CancellationToken>>,
    db: &SqlitePool,
    job_id: &str,
) -> Result<(), String> {
    // Signal the token — worker will stop and check DB state to know if it was paused or cancelled
    cancel_job_token(tokens, job_id).await;

    // Update state in DB
    let now = chrono::Utc::now().timestamp();
    crate::db::schema::update_job_state(db, job_id, "paused", now)
        .await
        .map_err(|e| format!("Failed to update job state to paused: {}", e))?;

    Ok(())
}

/// Pause all active uploads. Cancels all tokens, updates all active jobs to "paused", clears map.
/// Returns the count of jobs paused.
pub async fn pause_all(
    tokens: &Mutex<HashMap<String, CancellationToken>>,
    db: &SqlitePool,
) -> Result<usize, String> {
    let mut map = tokens.lock().await;
    let count = map.len();

    // Cancel all tokens
    for (_, token) in map.iter() {
        token.cancel();
    }
    map.clear();

    // Update all active jobs in DB to "paused"
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE upload_jobs SET state = 'paused', updated_at = ? WHERE state IN ('hashing', 'uploading', 'committing')"
    )
    .bind(now)
    .execute(db)
    .await
    .map_err(|e| format!("Failed to pause all jobs in DB: {}", e))?;

    Ok(count)
}

/// Remove a token after a job completes naturally (no cancellation).
pub async fn remove_token(
    tokens: &Mutex<HashMap<String, CancellationToken>>,
    job_id: &str,
) {
    let mut map = tokens.lock().await;
    map.remove(job_id);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tokio::sync::Mutex;

    #[tokio::test]
    async fn test_register_and_cancel() {
        let tokens = Mutex::new(HashMap::new());
        let token = register_token(&tokens, "job-1").await;
        assert!(!token.is_cancelled());

        // Cancel should mark the token
        cancel_job_token(&tokens, "job-1").await;
        assert!(token.is_cancelled());
    }

    #[tokio::test]
    async fn test_cancel_nonexistent_job() {
        let tokens = Mutex::new(HashMap::new());
        // Should not panic
        cancel_job_token(&tokens, "nonexistent").await;
    }

    #[tokio::test]
    async fn test_register_replaces_old_token() {
        let tokens = Mutex::new(HashMap::new());
        let token1 = register_token(&tokens, "job-1").await;
        let token2 = register_token(&tokens, "job-1").await;
        // Old token should be cancelled
        assert!(token1.is_cancelled());
        assert!(!token2.is_cancelled());
    }

    #[tokio::test]
    async fn test_cancel_stops_select_loop() {
        let tokens = Mutex::new(HashMap::new());
        let token = register_token(&tokens, "job-1").await;

        let token_clone = token.clone();
        let handle = tokio::spawn(async move {
            tokio::select! {
                _ = token_clone.cancelled() => {
                    return "cancelled";
                }
                _ = tokio::time::sleep(std::time::Duration::from_secs(60)) => {
                    return "timeout";
                }
            }
        });

        // Cancel the token
        cancel_job_token(&tokens, "job-1").await;

        let result = handle.await.unwrap();
        assert_eq!(result, "cancelled");
    }
}
