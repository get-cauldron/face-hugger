use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::{Mutex, Semaphore};
use tokio_util::sync::CancellationToken;

use crate::db::schema::{get_job, update_job_state};
use crate::upload::progress::ProgressMap;
use crate::upload::worker::run_upload_job;

pub struct UploadQueue {
    /// Concurrency limiter — default 2 permits, user-configurable 1-5
    pub semaphore: Arc<Semaphore>,
    /// Current max concurrent uploads setting
    pub max_concurrent: usize,
}

impl UploadQueue {
    /// Create a new upload queue. `max_concurrent` is clamped to 1..=5.
    pub fn new(max_concurrent: usize) -> Self {
        let clamped = max_concurrent.clamp(1, 5);
        Self {
            semaphore: Arc::new(Semaphore::new(clamped)),
            max_concurrent: clamped,
        }
    }

    /// Adjust concurrency limit. Clamped to 1..=5.
    /// If increasing: add permits. If decreasing: close old semaphore and create new one.
    pub fn set_max_concurrent(&mut self, new_max: usize) {
        let clamped = new_max.clamp(1, 5);
        if clamped > self.max_concurrent {
            // Add permits to existing semaphore
            let diff = clamped - self.max_concurrent;
            self.semaphore.add_permits(diff);
        } else if clamped < self.max_concurrent {
            // Close old semaphore and create new one with fewer permits
            // Active uploads will finish naturally (they already hold permits from the old semaphore)
            self.semaphore.close();
            self.semaphore = Arc::new(Semaphore::new(clamped));
        }
        self.max_concurrent = clamped;
    }
}

/// Get the highest-priority pending job from the database.
/// Returns the job_id if one exists.
pub async fn next_pending_job(db: &SqlitePool) -> Option<String> {
    let result = sqlx::query_scalar::<_, String>(
        "SELECT id FROM upload_jobs WHERE state = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
    )
    .fetch_optional(db)
    .await;

    match result {
        Ok(id) => id,
        Err(e) => {
            eprintln!("[queue] Error fetching next pending job: {}", e);
            None
        }
    }
}

/// Try to start the next pending job. Called after enqueue, after a job completes, or after resume.
/// Returns the job_id if a job was started.
///
/// `app_handle` is optional — when present, desktop notifications are sent on
/// job completion and failure.
pub async fn try_start_next(
    queue: &UploadQueue,
    db: &SqlitePool,
    hf_token: &str,
    cancel_tokens: &Mutex<HashMap<String, CancellationToken>>,
    progress_map: &ProgressMap,
    app_handle: Option<AppHandle>,
) -> Option<String> {
    // Check if there is a permit available (non-blocking)
    let permit = queue.semaphore.clone().try_acquire_owned().ok()?;

    // Get highest-priority pending job
    let job_id = next_pending_job(db).await?;

    // Register a CancellationToken for this job
    let cancel_token = CancellationToken::new();
    {
        let mut tokens = cancel_tokens.lock().await;
        tokens.insert(job_id.clone(), cancel_token.clone());
    }

    // Clone everything the worker needs (must be 'static for tokio::spawn)
    let id_clone = job_id.clone();
    let db_clone = db.clone();
    let client = reqwest::Client::new();
    let token_clone = hf_token.to_string();
    let progress_clone = Arc::clone(progress_map);
    let db_for_cleanup = db.clone();
    let db_for_notify = db.clone();

    tokio::spawn(async move {
        // Permit is held for the duration of the task
        let _permit = permit;

        let result = run_upload_job(
            id_clone.clone(),
            db_clone,
            client,
            token_clone,
            cancel_token,
            progress_clone,
        )
        .await;

        // Fetch job metadata for notifications (file name and repo id)
        let (file_name, repo_id) = match get_job(&db_for_notify, &id_clone).await {
            Ok(Some(job)) => (job.file_name, job.repo_id),
            _ => (id_clone.clone(), String::new()),
        };

        match result {
            Ok(()) => {
                // Notify on successful upload
                if let Some(ref app) = app_handle {
                    crate::tray::notify_upload_complete(app, &file_name, &repo_id);
                }
            }
            Err(ref e) => {
                // Distinguish pause/cancel from real failures — don't notify for user-initiated stops
                let is_user_stop = e.contains("paused") || e.contains("cancelled");
                if !is_user_stop {
                    eprintln!("[worker] job {} failed: {}", id_clone, e);
                    let now = chrono::Utc::now().timestamp();
                    let _ = update_job_state(&db_for_cleanup, &id_clone, "failed", now).await;
                    if let Some(ref app) = app_handle {
                        crate::tray::notify_upload_failed(app, &file_name, &repo_id);
                    }
                }
            }
        }
    });

    Some(job_id)
}

/// Validate whether a state transition is allowed.
pub fn can_transition(from: &str, to: &str) -> bool {
    matches!(
        (from, to),
        ("pending", "hashing")
            | ("hashing", "uploading")
            | ("uploading", "committing")
            | ("committing", "done")
            // Pause from any active state
            | ("hashing", "paused")
            | ("uploading", "paused")
            | ("committing", "paused")
            // Resume from paused goes back to pending (re-enters queue)
            | ("paused", "pending")
            // Fail from any active state
            | ("hashing", "failed")
            | ("uploading", "failed")
            | ("committing", "failed")
            // Retry from failed goes back to pending
            | ("failed", "pending")
            // Cancel from any non-terminal state
            | ("pending", "cancelled")
            | ("hashing", "cancelled")
            | ("uploading", "cancelled")
            | ("committing", "cancelled")
            | ("paused", "cancelled")
            | ("failed", "cancelled")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_queue_clamps_concurrency() {
        let q = UploadQueue::new(0);
        assert_eq!(q.max_concurrent, 1); // clamped to minimum 1
        let q = UploadQueue::new(10);
        assert_eq!(q.max_concurrent, 5); // clamped to maximum 5
        let q = UploadQueue::new(3);
        assert_eq!(q.max_concurrent, 3); // within range
    }

    #[test]
    fn test_semaphore_permit_count() {
        let q = UploadQueue::new(2);
        assert_eq!(q.semaphore.available_permits(), 2);
    }

    #[tokio::test]
    async fn test_concurrency_limit_enforced() {
        let q = UploadQueue::new(2);
        let p1 = q.semaphore.clone().try_acquire_owned();
        assert!(p1.is_ok());
        let p2 = q.semaphore.clone().try_acquire_owned();
        assert!(p2.is_ok());
        let p3 = q.semaphore.clone().try_acquire_owned();
        assert!(p3.is_err(), "Third permit should fail — only 2 allowed");
        // Drop one permit
        drop(p1);
        let p4 = q.semaphore.clone().try_acquire_owned();
        assert!(p4.is_ok(), "After dropping one, should acquire again");
    }

    #[test]
    fn test_valid_state_transitions() {
        assert!(can_transition("pending", "hashing"));
        assert!(can_transition("hashing", "uploading"));
        assert!(can_transition("uploading", "committing"));
        assert!(can_transition("committing", "done"));
        assert!(can_transition("uploading", "paused"));
        assert!(can_transition("paused", "pending"));
        assert!(can_transition("failed", "pending"));
        assert!(can_transition("pending", "cancelled"));
    }

    #[test]
    fn test_invalid_state_transitions() {
        assert!(!can_transition("done", "pending"), "Done is terminal");
        assert!(!can_transition("cancelled", "pending"), "Cancelled is terminal");
        assert!(!can_transition("pending", "done"), "Cannot skip to done");
        assert!(!can_transition("pending", "uploading"), "Must hash first");
    }
}
