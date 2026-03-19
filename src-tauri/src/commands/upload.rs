use tauri::ipc::Channel;
use tauri_plugin_store::StoreExt;

use crate::db::schema::{self, JobRow};
use crate::state::AppState;
use crate::upload::cancel;
use crate::upload::progress::start_progress_emitter;
use crate::upload::queue::try_start_next;
use crate::upload::types::{UploadJob, UploadJobState, UploadProgress, UploadProtocol};

// ---------------------------------------------------------------------------
// JobRow -> UploadJob conversion
// ---------------------------------------------------------------------------

fn job_row_to_upload_job(row: JobRow) -> UploadJob {
    let state = UploadJobState::from_str(&row.state).unwrap_or(UploadJobState::Pending);
    let protocol = row.protocol.as_deref().and_then(UploadProtocol::from_str);

    UploadJob {
        id: row.id,
        file_path: row.file_path,
        file_name: row.file_name,
        repo_id: row.repo_id,
        repo_type: row.repo_type,
        revision: row.revision,
        commit_message: row.commit_message,
        total_bytes: row.total_bytes as u64,
        bytes_confirmed: row.bytes_confirmed as u64,
        protocol,
        state,
        priority: row.priority != 0,
        retry_count: row.retry_count as u32,
        last_error: row.last_error,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Enqueue a file for upload. Validates the file exists, inserts a DB row,
/// and kicks the queue so a worker starts if capacity is available.
#[tauri::command]
#[specta::specta]
pub async fn enqueue_upload(
    file_path: String,
    repo_id: String,
    repo_type: String,
    revision: String,
    commit_message: String,
    priority: bool,
    state: tauri::State<'_, AppState>,
) -> Result<UploadJob, String> {
    // Validate file exists and get size
    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|e| format!("Cannot access file '{}': {}", file_path, e))?;

    let total_bytes = metadata.len() as i64;

    // Extract file name from path
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Generate unique ID
    let job_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // Insert into DB
    schema::insert_job(
        &state.db,
        &job_id,
        &file_path,
        &file_name,
        &repo_id,
        &repo_type,
        &revision,
        &commit_message,
        total_bytes,
        priority,
        now,
    )
    .await
    .map_err(|e| format!("Failed to enqueue upload: {}", e))?;

    // Kick the queue — start a worker if capacity allows
    let queue = state.upload_queue.lock().await;
    let _ = try_start_next(&queue, &state.db).await;
    drop(queue);

    // Return the new job
    let row = schema::get_job(&state.db, &job_id)
        .await
        .map_err(|e| format!("Failed to retrieve job after enqueue: {}", e))?
        .ok_or_else(|| format!("Job {} not found after insert", job_id))?;

    Ok(job_row_to_upload_job(row))
}

/// Cancel a specific upload by job ID.
#[tauri::command]
#[specta::specta]
pub async fn cancel_upload(
    job_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    cancel::cancel_job(&state.cancel_tokens, &state.db, &job_id).await
}

/// Pause a specific upload by job ID.
#[tauri::command]
#[specta::specta]
pub async fn pause_upload(
    job_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    cancel::pause_job(&state.cancel_tokens, &state.db, &job_id).await
}

/// Resume a paused upload by setting its state back to "pending" and kicking the queue.
#[tauri::command]
#[specta::specta]
pub async fn resume_upload(
    job_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();

    // Set state back to pending so the queue can pick it up
    schema::update_job_state(&state.db, &job_id, "pending", now)
        .await
        .map_err(|e| format!("Failed to resume job {}: {}", job_id, e))?;

    // Kick the queue
    let queue = state.upload_queue.lock().await;
    let _ = try_start_next(&queue, &state.db).await;
    drop(queue);

    Ok(())
}

/// Pause all active uploads. Returns the number of uploads paused.
#[tauri::command]
#[specta::specta]
pub async fn pause_all_uploads(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    cancel::pause_all(&state.cancel_tokens, &state.db).await
}

/// List all upload jobs (all states) ordered by priority then creation time.
#[tauri::command]
#[specta::specta]
pub async fn list_uploads(state: tauri::State<'_, AppState>) -> Result<Vec<UploadJob>, String> {
    let rows = schema::list_jobs(&state.db)
        .await
        .map_err(|e| format!("Failed to list uploads: {}", e))?;

    Ok(rows.into_iter().map(job_row_to_upload_job).collect())
}

/// Toggle priority on an upload job.
#[tauri::command]
#[specta::specta]
pub async fn set_upload_priority(
    job_id: String,
    priority: bool,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();
    let priority_val: i32 = if priority { 1 } else { 0 };

    sqlx::query("UPDATE upload_jobs SET priority = ?, updated_at = ? WHERE id = ?")
        .bind(priority_val)
        .bind(now)
        .bind(&job_id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to update priority for job {}: {}", job_id, e))?;

    Ok(())
}

/// Start the progress monitoring channel. The channel emits Vec<UploadProgress>
/// every 500ms containing all currently active upload jobs.
///
/// The frontend receives batched updates — never per-chunk.
#[tauri::command]
#[specta::specta]
pub async fn start_upload_monitoring(
    channel: Channel<Vec<UploadProgress>>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // Abort any existing emitter task before starting a new one
    let mut handle = state.progress_emitter.lock().await;
    if let Some(existing) = handle.take() {
        existing.abort();
    }

    let join_handle = start_progress_emitter(state.progress_map.clone(), channel);
    *handle = Some(join_handle);

    Ok(())
}

/// Update the concurrent upload limit (1-5). Persisted to tauri-plugin-store
/// so the value survives app restarts.
#[tauri::command]
#[specta::specta]
pub async fn set_concurrent_limit(
    limit: usize,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // Clamp to 1..=5 (mirrors UploadQueue::set_max_concurrent clamping — defense-in-depth)
    let clamped = limit.clamp(1, 5);

    // Persist to tauri-plugin-store so value survives restart
    let store = app
        .store("preferences.json")
        .map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("concurrent_upload_limit", serde_json::json!(clamped));
    store
        .save()
        .map_err(|e: tauri_plugin_store::Error| e.to_string())?;

    // Apply immediately to the running queue
    let mut queue = state.upload_queue.lock().await;
    queue.set_max_concurrent(clamped);

    Ok(())
}
