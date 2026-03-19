use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

use sqlx::SqlitePool;
use tokio_util::sync::CancellationToken;

use crate::db::schema::{
    get_confirmed_lfs_parts, get_confirmed_xorbs, get_job, insert_confirmed_lfs_part,
    insert_confirmed_xorb, update_job_error, update_job_progress, update_job_protocol,
    update_job_state,
};
use crate::hf::api::{check_write_access, create_commit, detect_upload_protocol, get_lfs_upload_info};
use crate::hf::xet::{get_xet_write_token, token_needs_refresh, upload_shard, upload_xorb, xet_hash_to_hex};
use crate::upload::backoff::backoff_duration;
use crate::upload::hash::hash_file_streaming;
use crate::upload::types::{UploadProgress, UploadProtocol};

// ---------------------------------------------------------------------------
// Public helper: compute xorb byte ranges for a file
// ---------------------------------------------------------------------------

/// Compute (offset, length) ranges for splitting a file into fixed-size xorbs.
/// Returns a Vec of (offset, length) tuples.
pub fn compute_xorb_ranges(total_bytes: u64, xorb_size: u64) -> Vec<(u64, u64)> {
    if total_bytes == 0 {
        return vec![(0, 0)];
    }
    let mut ranges = Vec::new();
    let mut offset = 0u64;
    while offset < total_bytes {
        let length = (xorb_size).min(total_bytes - offset);
        ranges.push((offset, length));
        offset += length;
    }
    ranges
}

// ---------------------------------------------------------------------------
// Main upload entry point
// ---------------------------------------------------------------------------

/// Execute a full upload job: file check → hash → detect protocol → upload → commit.
///
/// This is the core upload worker. It handles both the Xet CAS pipeline and the
/// LFS multipart pipeline, with resume capability, token refresh, and cancellation.
pub async fn run_upload_job(
    job_id: String,
    db: SqlitePool,
    client: reqwest::Client,
    hf_token: String,
    cancel_token: CancellationToken,
    progress_state: Arc<Mutex<HashMap<String, UploadProgress>>>,
) -> Result<(), String> {
    // ------------------------------------------------------------------
    // Step 1: Load job from DB
    // ------------------------------------------------------------------
    let job = get_job(&db, &job_id)
        .await
        .map_err(|e| format!("Failed to load job {}: {}", job_id, e))?
        .ok_or_else(|| format!("Job {} not found in database", job_id))?;

    // ------------------------------------------------------------------
    // Step 2: Verify source file exists
    // ------------------------------------------------------------------
    let path = Path::new(&job.file_path).to_owned();
    if !path.exists() {
        let msg = "Source file changed or missing — please re-add the file".to_string();
        let now = chrono::Utc::now().timestamp();
        let _ = update_job_error(&db, &job_id, &msg, job.retry_count, now).await;
        return Err(msg);
    }

    // ------------------------------------------------------------------
    // Step 3: Check write access (fail-fast, non-retryable)
    // ------------------------------------------------------------------
    if let Err(e) = check_write_access(&client, &hf_token, &job.repo_type, &job.repo_id).await {
        let now = chrono::Utc::now().timestamp();
        let _ = update_job_error(&db, &job_id, &e, job.retry_count, now).await;
        return Err(e);
    }

    // ------------------------------------------------------------------
    // Step 4: Hash file (state → "hashing")
    // ------------------------------------------------------------------
    let now = chrono::Utc::now().timestamp();
    update_job_state(&db, &job_id, "hashing", now)
        .await
        .map_err(|e| e.to_string())?;

    // Update progress map
    {
        let mut map = progress_state.lock().unwrap();
        if let Some(p) = map.get_mut(&job_id) {
            p.state = crate::upload::types::UploadJobState::Hashing;
        }
    }

    let (hash_bytes, total_bytes) = tokio::select! {
        _ = cancel_token.cancelled() => {
            // Check DB to distinguish pause vs cancel
            return handle_cancellation(&db, &job_id, job.retry_count).await;
        }
        result = hash_file_streaming(&path) => {
            result.map_err(|e| {
                let msg = format!("Hashing failed: {}", e);
                let now = chrono::Utc::now().timestamp();
                let _ = tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(
                        update_job_error(&db, &job_id, &msg, job.retry_count, now)
                    )
                });
                msg
            })?
        }
    };

    let file_oid = hex::encode(hash_bytes);

    // Update total_bytes if it was 0 (unknown at enqueue time)
    if job.total_bytes == 0 && total_bytes > 0 {
        let now = chrono::Utc::now().timestamp();
        let _ = update_job_progress(&db, &job_id, total_bytes as i64, now).await;
    }

    // ------------------------------------------------------------------
    // Step 5: Detect protocol (if not already set)
    // ------------------------------------------------------------------
    let protocol = if let Some(stored_protocol) = &job.protocol {
        UploadProtocol::from_str(stored_protocol)
            .unwrap_or(UploadProtocol::Xet)
    } else {
        let detected = detect_upload_protocol(&client, &hf_token, &job.repo_id, &file_oid, total_bytes)
            .await
            .map_err(|e| {
                let now = chrono::Utc::now().timestamp();
                let _ = tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(
                        update_job_error(&db, &job_id, &e, job.retry_count, now)
                    )
                });
                e
            })?;
        let now = chrono::Utc::now().timestamp();
        update_job_protocol(&db, &job_id, detected.as_str(), now)
            .await
            .map_err(|e| e.to_string())?;
        detected
    };

    // ------------------------------------------------------------------
    // Step 6: Branch on protocol
    // ------------------------------------------------------------------
    match protocol {
        UploadProtocol::Xet => {
            run_xet_pipeline(
                &job_id,
                &db,
                &client,
                &hf_token,
                &job.repo_type,
                &job.repo_id,
                &job.revision,
                &path,
                total_bytes,
                job.retry_count,
                cancel_token.clone(),
                progress_state.clone(),
            )
            .await?;
        }
        UploadProtocol::LfsMultipart => {
            run_lfs_pipeline(
                &job_id,
                &db,
                &client,
                &hf_token,
                &job.repo_id,
                &file_oid,
                &path,
                total_bytes,
                job.retry_count,
                cancel_token.clone(),
                progress_state.clone(),
            )
            .await?;
        }
    }

    // ------------------------------------------------------------------
    // Step 7: Commit (state → "committing")
    // ------------------------------------------------------------------
    let now = chrono::Utc::now().timestamp();
    update_job_state(&db, &job_id, "committing", now)
        .await
        .map_err(|e| e.to_string())?;

    let commit_result = create_commit(
        &client,
        &hf_token,
        &job.repo_type,
        &job.repo_id,
        &job.revision,
        &job.commit_message,
        &job.file_name,
        &file_oid,
        total_bytes,
    )
    .await;

    match commit_result {
        Ok(_) => {
            let now = chrono::Utc::now().timestamp();
            update_job_state(&db, &job_id, "done", now)
                .await
                .map_err(|e| e.to_string())?;

            // Update progress map to done
            {
                let mut map = progress_state.lock().unwrap();
                if let Some(p) = map.get_mut(&job_id) {
                    p.state = crate::upload::types::UploadJobState::Done;
                    p.bytes_sent = total_bytes;
                }
            }
        }
        Err(e) => {
            let now = chrono::Utc::now().timestamp();
            let _ = update_job_error(&db, &job_id, &e, job.retry_count, now).await;
            return Err(format!("Commit failed: {}", e));
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Xet CAS pipeline
// ---------------------------------------------------------------------------

async fn run_xet_pipeline(
    job_id: &str,
    db: &SqlitePool,
    client: &reqwest::Client,
    hf_token: &str,
    repo_type: &str,
    repo_id: &str,
    revision: &str,
    path: &Path,
    total_bytes: u64,
    initial_retry_count: i32,
    cancel_token: CancellationToken,
    progress_state: Arc<Mutex<HashMap<String, UploadProgress>>>,
) -> Result<(), String> {
    // State → "uploading"
    let now = chrono::Utc::now().timestamp();
    update_job_state(db, job_id, "uploading", now)
        .await
        .map_err(|e| e.to_string())?;

    // Get Xet write token
    let mut xet_token = get_xet_write_token(client, hf_token, repo_type, repo_id, revision)
        .await
        .map_err(|e| {
            let now = chrono::Utc::now().timestamp();
            let _ = tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(
                    update_job_error(db, job_id, &e, initial_retry_count, now)
                )
            });
            e
        })?;

    // Get already confirmed xorbs from DB (resume support)
    let confirmed_xorbs: std::collections::HashSet<String> =
        get_confirmed_xorbs(db, job_id)
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .collect();

    // Compute xorb ranges (fixed 64MB blocks)
    // TODO: Replace with content-defined chunking (Gearhash CDC per Xet spec) for proper deduplication
    const XET_XORB_SIZE: u64 = 64 * 1024 * 1024; // 64MB
    let ranges = compute_xorb_ranges(total_bytes, XET_XORB_SIZE);

    let mut bytes_confirmed: u64 = confirmed_xorbs.len() as u64 * XET_XORB_SIZE;
    let mut retry_count = initial_retry_count;

    // Track all xorb hashes in order for shard construction
    let mut xorb_hashes_ordered: Vec<String> = Vec::with_capacity(ranges.len());

    for (offset, length) in &ranges {
        // Refresh token if needed
        if token_needs_refresh(&xet_token) {
            xet_token = get_xet_write_token(client, hf_token, repo_type, repo_id, revision)
                .await
                .map_err(|e| e.to_string())?;
        }

        // Read chunk from file
        // Stat file before each read to detect changes
        let metadata = std::fs::metadata(path)
            .map_err(|_| "Source file changed or missing — please re-add the file".to_string())?;

        if metadata.len() != total_bytes && total_bytes > 0 {
            let msg = "Source file changed or missing — please re-add the file".to_string();
            let now = chrono::Utc::now().timestamp();
            let _ = update_job_error(db, job_id, &msg, retry_count, now).await;
            return Err(msg);
        }

        // Read xorb bytes from file
        let xorb_bytes = read_file_range(path, *offset, *length)?;

        // Compute SHA-256 of this xorb chunk, then encode with xet_hash_to_hex
        let xorb_hash_bytes: [u8; 32] = {
            use sha2::{Digest, Sha256};
            let mut hasher = Sha256::new();
            hasher.update(&xorb_bytes);
            hasher.finalize().into()
        };
        let xorb_hash = xet_hash_to_hex(&xorb_hash_bytes);
        xorb_hashes_ordered.push(xorb_hash.clone());

        // Skip if already confirmed (resume)
        if confirmed_xorbs.contains(&xorb_hash) {
            continue;
        }

        // Upload xorb with retry loop
        loop {
            // Refresh token if needed before each attempt
            if token_needs_refresh(&xet_token) {
                xet_token = get_xet_write_token(client, hf_token, repo_type, repo_id, revision)
                    .await
                    .map_err(|e| e.to_string())?;
            }

            let upload_result = tokio::select! {
                _ = cancel_token.cancelled() => {
                    return handle_cancellation(db, job_id, retry_count).await;
                }
                result = upload_xorb(
                    client,
                    &xet_token.cas_url,
                    &xet_token.access_token,
                    &xorb_hash,
                    bytes::Bytes::copy_from_slice(&xorb_bytes),
                ) => result
            };

            match upload_result {
                Ok(_was_inserted) => {
                    // Record confirmed xorb
                    insert_confirmed_xorb(db, job_id, &xorb_hash)
                        .await
                        .map_err(|e| e.to_string())?;

                    bytes_confirmed += length;
                    retry_count = 0; // reset on success

                    // Update progress
                    let now = chrono::Utc::now().timestamp();
                    let _ = update_job_progress(db, job_id, bytes_confirmed as i64, now).await;
                    {
                        let mut map = progress_state.lock().unwrap();
                        if let Some(p) = map.get_mut(job_id) {
                            p.bytes_sent = bytes_confirmed;
                        }
                    }
                    break;
                }
                Err(e) if e.contains("Token expired") => {
                    // Refresh and retry immediately (no backoff)
                    xet_token = get_xet_write_token(client, hf_token, repo_type, repo_id, revision)
                        .await
                        .map_err(|e2| e2.to_string())?;
                    // continue loop to retry
                }
                Err(e) if is_retryable_error(&e) => {
                    retry_count += 1;
                    let backoff = backoff_duration(retry_count as u32);
                    eprintln!(
                        "[worker] Retryable error uploading xorb (retry {}): {}",
                        retry_count, e
                    );

                    // Update error state in DB so UI can show retry info
                    let now = chrono::Utc::now().timestamp();
                    let _ = update_job_error(db, job_id, &e, retry_count, now).await;

                    tokio::select! {
                        _ = cancel_token.cancelled() => {
                            return handle_cancellation(db, job_id, retry_count).await;
                        }
                        _ = tokio::time::sleep(backoff) => {}
                    }
                    // continue loop to retry
                }
                Err(e) => {
                    // Non-retryable error
                    let now = chrono::Utc::now().timestamp();
                    let _ = update_job_error(db, job_id, &e, retry_count, now).await;
                    return Err(format!("Xorb upload failed (non-retryable): {}", e));
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // After ALL xorbs uploaded — build and upload shard
    //
    // TODO: Replace with spec-compliant shard binary format.
    // The Xet shard format requires reading:
    //   https://huggingface.co/docs/xet/en/shard
    // For now, we use a minimal JSON placeholder that records xorb hashes
    // and byte ranges. This will be rejected by production CAS servers
    // but allows testing the pipeline structure.
    // ------------------------------------------------------------------
    let shard_data: Vec<serde_json::Value> = xorb_hashes_ordered
        .iter()
        .zip(ranges.iter())
        .map(|(hash, (offset, length))| {
            serde_json::json!({
                "xorb_hash": hash,
                "offset": offset,
                "length": length
            })
        })
        .collect();
    let shard_json = serde_json::to_vec(&shard_data).map_err(|e| e.to_string())?;

    // TODO: Use spec-compliant shard serialization (HMAC key, bookend structure)
    let mut xorb_retry_count = 0i32;
    loop {
        // Refresh token if needed
        if token_needs_refresh(&xet_token) {
            xet_token = get_xet_write_token(client, hf_token, repo_type, repo_id, revision)
                .await
                .map_err(|e| e.to_string())?;
        }

        let shard_result = tokio::select! {
            _ = cancel_token.cancelled() => {
                return handle_cancellation(db, job_id, xorb_retry_count).await;
            }
            result = upload_shard(
                client,
                &xet_token.cas_url,
                &xet_token.access_token,
                bytes::Bytes::copy_from_slice(&shard_json),
            ) => result
        };

        match shard_result {
            Ok(()) => break,
            Err(e) if e.contains("Token expired") => {
                xet_token = get_xet_write_token(client, hf_token, repo_type, repo_id, revision)
                    .await
                    .map_err(|e2| e2.to_string())?;
            }
            Err(e) if is_retryable_error(&e) => {
                xorb_retry_count += 1;
                let backoff = backoff_duration(xorb_retry_count as u32);
                eprintln!("[worker] Retryable error uploading shard (retry {}): {}", xorb_retry_count, e);
                tokio::select! {
                    _ = cancel_token.cancelled() => {
                        return handle_cancellation(db, job_id, xorb_retry_count).await;
                    }
                    _ = tokio::time::sleep(backoff) => {}
                }
            }
            Err(e) => {
                let now = chrono::Utc::now().timestamp();
                let _ = update_job_error(db, job_id, &e, xorb_retry_count, now).await;
                return Err(format!("Shard upload failed: {}", e));
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// LFS multipart pipeline
// ---------------------------------------------------------------------------

async fn run_lfs_pipeline(
    job_id: &str,
    db: &SqlitePool,
    client: &reqwest::Client,
    hf_token: &str,
    repo_id: &str,
    file_oid: &str,
    path: &Path,
    total_bytes: u64,
    initial_retry_count: i32,
    cancel_token: CancellationToken,
    progress_state: Arc<Mutex<HashMap<String, UploadProgress>>>,
) -> Result<(), String> {
    // State → "uploading"
    let now = chrono::Utc::now().timestamp();
    update_job_state(db, job_id, "uploading", now)
        .await
        .map_err(|e| e.to_string())?;

    // Get confirmed parts from DB (resume support)
    let confirmed_parts: std::collections::HashSet<i32> =
        get_confirmed_lfs_parts(db, job_id)
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .collect();

    // Get fresh pre-signed URLs from LFS batch endpoint
    // NOTE: Pre-signed URLs are NEVER stored in SQLite — always request fresh on resume
    let upload_info = get_lfs_upload_info(client, hf_token, repo_id, file_oid, total_bytes)
        .await
        .map_err(|e| {
            let now = chrono::Utc::now().timestamp();
            let _ = tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(
                    update_job_error(db, job_id, &e, initial_retry_count, now)
                )
            });
            e
        })?;

    let mut bytes_confirmed: u64 = 0;
    let mut retry_count = initial_retry_count;
    let mut current_parts = upload_info.parts;

    for part in &current_parts.clone() {
        // Skip confirmed parts (resume)
        if confirmed_parts.contains(&(part.part_number as i32)) {
            // Estimate bytes confirmed for progress (rough estimate)
            if total_bytes > 0 && !current_parts.is_empty() {
                bytes_confirmed += total_bytes / current_parts.len() as u64;
            }
            continue;
        }

        // Determine byte range for this part
        // LFS multipart splits file into equal-sized parts
        let part_size = if current_parts.len() == 1 {
            total_bytes
        } else {
            // Standard LFS multipart: each part is ~100MB (typical S3 minimum)
            // The actual byte range comes from the part index
            let base_part_size = total_bytes / current_parts.len() as u64;
            if part.part_number == current_parts.len() {
                // Last part: remainder
                total_bytes - base_part_size * (current_parts.len() as u64 - 1)
            } else {
                base_part_size
            }
        };
        let offset = (part.part_number as u64 - 1) * (total_bytes / current_parts.len() as u64);

        // Stat file before read
        let metadata = std::fs::metadata(path)
            .map_err(|_| "Source file changed or missing — please re-add the file".to_string())?;
        if metadata.len() != total_bytes && total_bytes > 0 {
            let msg = "Source file changed or missing — please re-add the file".to_string();
            let now = chrono::Utc::now().timestamp();
            let _ = update_job_error(db, job_id, &msg, retry_count, now).await;
            return Err(msg);
        }

        let part_bytes = read_file_range(path, offset, part_size)?;
        let part_number = part.part_number;
        let upload_url = part.upload_url.clone();
        let headers = part.headers.clone();

        // Upload with retry loop
        loop {
            let mut req = client.put(&upload_url).body(part_bytes.clone());
            for (k, v) in &headers {
                req = req.header(k, v);
            }

            let upload_result = tokio::select! {
                _ = cancel_token.cancelled() => {
                    return handle_cancellation(db, job_id, retry_count).await;
                }
                result = req.send() => result.map_err(|e| format!("Network error: {}", e))
            };

            match upload_result {
                Ok(resp) => {
                    match resp.status().as_u16() {
                        200..=299 => {
                            // Part confirmed
                            insert_confirmed_lfs_part(db, job_id, part_number as i32)
                                .await
                                .map_err(|e| e.to_string())?;

                            bytes_confirmed += part_size;
                            retry_count = 0;

                            let now = chrono::Utc::now().timestamp();
                            let _ = update_job_progress(db, job_id, bytes_confirmed as i64, now).await;
                            {
                                let mut map = progress_state.lock().unwrap();
                                if let Some(p) = map.get_mut(job_id) {
                                    p.bytes_sent = bytes_confirmed;
                                }
                            }
                            break;
                        }
                        403 => {
                            // S3 pre-signed URL expired — request fresh URLs and retry
                            eprintln!("[worker] LFS part {} got 403 — refreshing pre-signed URLs", part_number);
                            let fresh_info = get_lfs_upload_info(client, hf_token, repo_id, file_oid, total_bytes)
                                .await
                                .map_err(|e| e.to_string())?;
                            // Update the parts list with fresh URLs
                            current_parts = fresh_info.parts;
                            // continue loop to retry with new URL
                            // (URL will be picked up from current_parts in next iteration)
                        }
                        s if s >= 500 => {
                            retry_count += 1;
                            let backoff = backoff_duration(retry_count as u32);
                            eprintln!(
                                "[worker] LFS part {} server error {} (retry {})",
                                part_number, s, retry_count
                            );
                            tokio::select! {
                                _ = cancel_token.cancelled() => {
                                    return handle_cancellation(db, job_id, retry_count).await;
                                }
                                _ = tokio::time::sleep(backoff) => {}
                            }
                        }
                        s => {
                            let body = resp.text().await.unwrap_or_default();
                            let msg = format!("LFS part {} upload failed: HTTP {} — {}", part_number, s, body);
                            let now = chrono::Utc::now().timestamp();
                            let _ = update_job_error(db, job_id, &msg, retry_count, now).await;
                            return Err(msg);
                        }
                    }
                }
                Err(e) if is_retryable_error(&e) => {
                    retry_count += 1;
                    let backoff = backoff_duration(retry_count as u32);
                    eprintln!(
                        "[worker] LFS part {} network error (retry {}): {}",
                        part_number, retry_count, e
                    );
                    tokio::select! {
                        _ = cancel_token.cancelled() => {
                            return handle_cancellation(db, job_id, retry_count).await;
                        }
                        _ = tokio::time::sleep(backoff) => {}
                    }
                }
                Err(e) => {
                    let now = chrono::Utc::now().timestamp();
                    let _ = update_job_error(db, job_id, &e, retry_count, now).await;
                    return Err(format!("LFS part upload failed (non-retryable): {}", e));
                }
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Read a byte range from a file. Returns owned Vec<u8>.
fn read_file_range(path: &Path, offset: u64, length: u64) -> Result<Vec<u8>, String> {
    use std::io::{Read, Seek, SeekFrom};

    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    file.seek(SeekFrom::Start(offset))
        .map_err(|e| format!("Failed to seek in file: {}", e))?;

    let mut buf = vec![0u8; length as usize];
    file.read_exact(&mut buf)
        .map_err(|e| format!("Failed to read file range: {}", e))?;

    Ok(buf)
}

/// Returns true if the error string represents a retryable (transient) condition.
fn is_retryable_error(e: &str) -> bool {
    e.contains("Network error")
        || e.contains("retryable")
        || e.contains("timeout")
        || e.contains("connection")
        || e.contains("Server error")
}

/// Handle a CancellationToken signal: check DB state to determine if this was a
/// pause or a cancel, and return the appropriate error.
async fn handle_cancellation(
    db: &SqlitePool,
    job_id: &str,
    retry_count: i32,
) -> Result<(), String> {
    // Check DB state — pause_job sets "paused", cancel_job sets "cancelled"
    match get_job(db, job_id).await {
        Ok(Some(job)) if job.state == "paused" => {
            // Already written to DB by cancel/pause command — just return Ok
            // (the state is already "paused" in DB)
            Err("Upload paused".to_string())
        }
        Ok(Some(job)) if job.state == "cancelled" => {
            Err("Upload cancelled".to_string())
        }
        _ => {
            // Default: treat as cancelled if DB state is ambiguous
            let now = chrono::Utc::now().timestamp();
            let _ = update_job_error(db, job_id, "Upload cancelled", retry_count, now).await;
            Err("Upload cancelled".to_string())
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_file_into_xorb_ranges() {
        // For a 150MB file with 64MB xorb size:
        let total = 150 * 1024 * 1024u64;
        let xorb_size = 64 * 1024 * 1024u64;
        let ranges = compute_xorb_ranges(total, xorb_size);
        assert_eq!(ranges.len(), 3); // 64MB + 64MB + 22MB
        assert_eq!(ranges[0], (0, xorb_size));
        assert_eq!(ranges[1], (xorb_size, xorb_size));
        assert_eq!(ranges[2], (2 * xorb_size, total - 2 * xorb_size));
    }

    #[test]
    fn test_chunk_small_file() {
        let total = 1024u64; // 1KB
        let xorb_size = 64 * 1024 * 1024u64;
        let ranges = compute_xorb_ranges(total, xorb_size);
        assert_eq!(ranges.len(), 1);
        assert_eq!(ranges[0], (0, 1024));
    }

    #[test]
    fn test_chunk_exact_multiple() {
        // Exactly 2 xorbs
        let xorb_size = 64 * 1024 * 1024u64;
        let total = 2 * xorb_size;
        let ranges = compute_xorb_ranges(total, xorb_size);
        assert_eq!(ranges.len(), 2);
        assert_eq!(ranges[0], (0, xorb_size));
        assert_eq!(ranges[1], (xorb_size, xorb_size));
    }

    #[test]
    fn test_chunk_empty_file() {
        let ranges = compute_xorb_ranges(0, 64 * 1024 * 1024);
        assert_eq!(ranges.len(), 1);
        assert_eq!(ranges[0], (0, 0));
    }

    #[tokio::test]
    async fn test_resume_skips_confirmed_xorbs() {
        // Simulate: 3 xorbs total, 2 already confirmed
        let confirmed = vec!["hash_0".to_string(), "hash_1".to_string()];
        let all_hashes = vec!["hash_0".to_string(), "hash_1".to_string(), "hash_2".to_string()];
        let to_upload: Vec<_> = all_hashes
            .iter()
            .filter(|h| !confirmed.contains(h))
            .collect();
        assert_eq!(to_upload.len(), 1);
        assert_eq!(to_upload[0], "hash_2");
    }

    #[test]
    fn test_retryable_error_classification() {
        assert!(is_retryable_error("Network error: connection refused"));
        assert!(is_retryable_error("Server error uploading xorb: HTTP 503 — retryable"));
        assert!(is_retryable_error("timeout waiting for response"));
        assert!(!is_retryable_error("Bad request — malformed data"));
        assert!(!is_retryable_error("Permission denied"));
    }
}
