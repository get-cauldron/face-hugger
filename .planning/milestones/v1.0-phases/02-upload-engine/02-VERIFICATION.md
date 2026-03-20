---
phase: 02-upload-engine
verified: 2026-03-19T00:00:00Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "User can upload a file larger than 1 GB to an HF repo without the app running out of memory"
    status: failed
    reason: "run_upload_job is never called. try_start_next (queue.rs:60) spawns a placeholder tokio task that only logs 'would start job {id}' and immediately drops the semaphore permit. The upload worker pipeline (worker.rs) is fully implemented but completely disconnected from the queue. No upload ever actually executes."
    artifacts:
      - path: "src-tauri/src/upload/queue.rs"
        issue: "try_start_next (line 67-73) spawns a stub task that logs and exits. run_upload_job is never called from any execution path."
    missing:
      - "Wire try_start_next to call run_upload_job: spawn a task that calls run_upload_job with the job_id, db pool, reqwest client, hf_token from AppState, a registered CancellationToken, and the ProgressMap"
      - "The spawned task must acquire the HF token from AppState.auth before spawning the worker"
      - "try_start_next signature needs access to AppState (or its relevant fields) to pass to run_upload_job"

  - truth: "An upload interrupted by a network drop automatically resumes from the last confirmed chunk after reconnection — no manual intervention"
    status: failed
    reason: "Resume depends on try_start_next calling run_upload_job. Since try_start_next spawns a stub, resume_upload (commands/upload.rs:128) correctly sets state to 'pending' and calls try_start_next, but that stub immediately exits without executing the worker. The resume data structures (confirmed_xorbs, confirmed_lfs_parts in SQLite) are correct and worker.rs correctly skips confirmed chunks — but no worker is ever spawned to use them."
    artifacts:
      - path: "src-tauri/src/upload/queue.rs"
        issue: "Same root cause as gap 1: placeholder stub prevents any worker from running."
    missing:
      - "Same fix as gap 1: wire try_start_next to spawn run_upload_job"

  - truth: "The upload engine correctly detects whether a repo uses Xet CAS or legacy LFS and routes accordingly"
    status: partial
    reason: "Protocol detection logic exists and is correct: detect_upload_protocol in hf/api.rs posts to the LFS batch endpoint and parses the 'transfer' field. The worker correctly routes to run_xet_pipeline or run_lfs_pipeline. However, since no worker is ever spawned, protocol detection never runs in production. As a logic unit it is verified; as an end-to-end capability it is blocked by the queue stub."
    artifacts:
      - path: "src-tauri/src/upload/queue.rs"
        issue: "Worker is never spawned, so protocol detection never executes in practice."
    missing:
      - "Fix queue wiring (same as gap 1) to unblock protocol detection"

  - truth: "The Xet upload pipeline uses a non-spec-compliant shard format (JSON placeholder)"
    status: partial
    reason: "The Xet shard upload in worker.rs uses a JSON serialization of xorb hashes and byte ranges (lines 421-432). This is explicitly marked TODO and will be rejected by production HF CAS servers. Fixed-size 64MB chunking is used instead of content-defined chunking (Gearhash CDC). These are acknowledged limitations with TODO comments, not silent stubs."
    artifacts:
      - path: "src-tauri/src/upload/worker.rs"
        issue: "Shard format is JSON placeholder (lines 414-434, TODO comments). Content-defined chunking not implemented (line 283)."
    missing:
      - "Spec-compliant shard binary format (HMAC key, bookend structure per HF Xet docs)"
      - "Content-defined chunking (Gearhash CDC) for proper Xet deduplication"
      - "These are known limitations; classify as warnings not hard blockers if Xet support is considered optional for initial testing"
---

# Phase 2: Upload Engine Verification Report

**Phase Goal:** Files can be reliably uploaded to HF repos through a fault-tolerant Rust engine that handles both Xet and LFS protocols
**Verified:** 2026-03-19
**Status:** gaps_found — critical wiring gap prevents any upload from executing
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can upload a file larger than 1 GB to an HF repo without running out of memory | FAILED | `try_start_next` spawns a stub that logs "would start job" and exits — `run_upload_job` is never called |
| 2 | An upload interrupted by a network drop automatically resumes from the last confirmed chunk after reconnection | FAILED | Same root cause: resume path calls `try_start_next`, which spawns the stub. No worker executes. |
| 3 | The upload engine correctly detects whether a repo uses Xet CAS or legacy LFS and routes accordingly | PARTIAL | Detection logic and routing in `worker.rs` are correct. Blocked because worker is never spawned. |
| 4 | Multiple uploads can be queued simultaneously; each can be paused, resumed, or cancelled individually | PARTIAL | Queue infrastructure, semaphore, and cancel/pause commands are wired correctly. Actual upload execution is blocked. |
| 5 | Upload progress (bytes transferred, speed, ETA) is visible in the UI and updates smoothly | VERIFIED | Progress emitter sends `Vec<UploadProgress>` via Channel at 500ms intervals. SpeedTracker with 5s sliding window implemented. All commands registered in `lib.rs` and accessible from frontend. |

**Score:** 1/5 truths fully verified (2/5 partial, 2/5 failed)

---

## Required Artifacts

### Plan 02-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/migrations/001_upload_queue.sql` | Upload queue schema with 3 tables | VERIFIED | Contains `upload_jobs`, `confirmed_xorbs`, `confirmed_lfs_parts` with correct schema and indexes |
| `src-tauri/src/db/mod.rs` | Database init with WAL mode and migration runner | VERIFIED | `init_db` creates pool with WAL mode, runs `sqlx::migrate!` |
| `src-tauri/src/db/schema.rs` | CRUD for upload_jobs | VERIFIED | `insert_job`, `get_job`, `list_jobs`, `update_job_state`, `update_job_progress`, `update_job_protocol`, `update_job_error`, xorb/part confirmed helpers |
| `src-tauri/src/upload/types.rs` | All shared upload types | VERIFIED | `UploadJob`, `UploadJobState`, `UploadProtocol`, `UploadProgress`, `EnqueueRequest`, `UploadError` — all with `specta::Type` |
| `src-tauri/src/upload/mod.rs` | Module declaration | VERIFIED | Declares all 7 submodules |

### Plan 02-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/hf/api.rs` | LFS batch, commit API, write-access check | VERIFIED | `detect_upload_protocol`, `check_write_access`, `create_commit`, `get_lfs_upload_info` all implemented with correct HTTP semantics |
| `src-tauri/src/hf/xet.rs` | Xet CAS client | VERIFIED | `XetWriteToken`, `get_xet_write_token`, `upload_xorb`, `upload_shard`, `xet_hash_to_hex`, `token_needs_refresh` — including LE u64 block encoding and 30s refresh buffer |

### Plan 02-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/upload/queue.rs` | Upload queue with concurrency control | STUB | `UploadQueue` with `Semaphore` exists and is correct. `try_start_next` is a stub that never calls `run_upload_job`. |
| `src-tauri/src/upload/cancel.rs` | CancellationToken registry | VERIFIED | `register_token`, `cancel_job`, `pause_job`, `pause_all`, `remove_token` all implemented correctly |
| `src-tauri/src/upload/hash.rs` | Streaming SHA-256 via rayon pool | VERIFIED | `hash_file_streaming` uses `spawn_blocking` + rayon 2-thread pool, 8MB chunks |

### Plan 02-04 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/upload/worker.rs` | Xet + LFS pipelines with resume | PARTIAL | `run_upload_job` fully implemented: hash → detect → xet/lfs branch → commit. Contains `tokio::select!` cancellation at every loop. Resume via confirmed xorb/part skipping. HOWEVER: shard format is non-spec-compliant JSON placeholder (acknowledged TODO). Worker is never called from production code path. |
| `src-tauri/src/upload/backoff.rs` | Exponential backoff with jitter | VERIFIED | 5s/15s/30s/60s schedule with ±20% jitter |

### Plan 02-05 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/upload/progress.rs` | Progress emitter via Channel at 500ms | VERIFIED | `ProgressMap`, `SpeedTracker`, `start_progress_emitter` at 500ms, `update_progress`, `new_progress_map` |
| `src-tauri/src/commands/upload.rs` | All Tauri command handlers | VERIFIED | `enqueue_upload`, `cancel_upload`, `pause_upload`, `resume_upload`, `pause_all_uploads`, `list_uploads`, `set_upload_priority`, `start_upload_monitoring`, `set_concurrent_limit` — all with `#[tauri::command]` + `#[specta::specta]` |
| `src/commands/upload.ts` | Frontend TypeScript wrappers | VERIFIED | All 9 commands wrapped: `enqueueUpload`, `cancelUpload`, `pauseUpload`, `resumeUpload`, `pauseAllUploads`, `listUploads`, `setUploadPriority`, `startUploadMonitoring`, `setConcurrentLimit` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/state.rs` | `sqlx::SqlitePool` | `AppState.db` field | WIRED | `pub db: SqlitePool` present |
| `src/lib.rs` | `db::init_db` | Tauri setup hook | WIRED | `db::init_db(&app_data_dir).await` in setup closure |
| `src/hf/api.rs` | HF LFS batch endpoint | POST to `info/lfs/objects/batch` | WIRED | Pattern `info/lfs/objects/batch` present in `lfs_batch_url()` |
| `src/hf/xet.rs` | CAS xorb endpoint | POST to `/v1/xorbs/default/{hash}` | WIRED | Pattern `/v1/xorbs/default/` present |
| `src/hf/api.rs` | HF commit API | POST to `/commit/` | WIRED | `commit_url()` builds `/commit/` path |
| `src/upload/queue.rs` | `tokio::sync::Semaphore` | Concurrency limiter | WIRED | Semaphore used in `UploadQueue::new` and `try_start_next` |
| `src/upload/cancel.rs` | `tokio_util::sync::CancellationToken` | Per-job cancellation | WIRED | CancellationToken used throughout |
| `src/upload/hash.rs` | `rayon::ThreadPool` | CPU-bound hashing | WIRED | `HASH_POOL` static with 2 threads |
| **`src/upload/queue.rs`** | **`src/upload/worker.rs`** | **`try_start_next` spawns `run_upload_job`** | **NOT WIRED** | **`try_start_next` spawns a placeholder closure that logs "would start job {id}" and exits. `run_upload_job` is defined but has zero callers in production code.** |
| `src/upload/worker.rs` | `src/hf/xet.rs` | `upload_xorb`, `upload_shard` | WIRED | Both functions imported and called in `run_xet_pipeline` |
| `src/upload/worker.rs` | `src/hf/api.rs` | `detect_upload_protocol`, `create_commit` | WIRED | Both imported and called |
| `src/upload/worker.rs` | `src/db/schema.rs` | `insert_confirmed_xorb`, `get_confirmed_xorbs` | WIRED | Resume logic uses confirmed xorb/part queries |
| `src/commands/upload.rs` | `src/upload/worker.rs` | `enqueue_upload` spawns worker | NOT WIRED | `enqueue_upload` calls `try_start_next` which is the stub. `run_upload_job` is never spawned. |
| `src/lib.rs` | `commands::upload` | `collect_commands!` macro | WIRED | All 9 upload commands registered |
| `src/lib.rs` | `tauri-plugin-store` | Reads `concurrent_upload_limit` on startup | WIRED | `unwrap_or(2)` default, passes to `AppState::new(pool, concurrent_limit)` |
| `src/commands/upload.ts` | Rust upload commands | `invoke()` calls | WIRED | All 9 commands use `invoke()` with correct snake_case command names |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UPLD-01 | 02-01, 02-04 | User can upload files using chunked streaming (1-100GB+) | BLOCKED | Pipeline implemented in worker.rs but never executed — queue stub prevents all uploads |
| UPLD-02 | 02-04 | Uploads resume automatically after network interruption | BLOCKED | SQLite confirmed xorb/part tracking is correct, worker skips confirmed chunks — but worker never runs |
| UPLD-03 | 02-05 | User sees per-file progress bar with speed and ETA | PARTIAL | Progress emitter, SpeedTracker, and Channel wiring are complete and correct. No actual progress flows because no upload worker ever runs. |
| UPLD-04 | 02-01, 02-03 | User can queue multiple uploads | PARTIAL | Queue infrastructure, Semaphore, DB queue all correct. Blocked by stub in try_start_next. |
| UPLD-05 | 02-03, 02-05 | User can cancel, pause, and resume individual uploads | PARTIAL | Cancel/pause/resume commands are correctly implemented and wired. Cancellation token registry works. However, since no worker runs, cancel/pause affect DB state only — there is no running task to actually stop. Resume calls try_start_next which hits the stub. |
| UPLD-10 | 02-01, 02-02 | App handles both Xet CAS and legacy LFS protocols automatically | PARTIAL | Protocol detection logic in hf/api.rs is correct. Worker routing is correct. Blocked by queue stub — detection never executes. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src-tauri/src/upload/queue.rs` | 67-73 | Placeholder stub: `eprintln!("[queue] would start job {}"); // Spawn a placeholder task — the real worker will be wired in Plan 04` | BLOCKER | Every enqueue and resume call hits this stub. No upload ever executes. The upload engine is entirely non-functional for its primary purpose. |
| `src-tauri/src/upload/worker.rs` | 414-434 | Non-spec Xet shard format: JSON placeholder, acknowledged with TODO comments | WARNING | Xet uploads will fail at CAS server when the shard is submitted. LFS path is unaffected. |
| `src-tauri/src/upload/worker.rs` | 283 | Fixed-size 64MB chunking instead of content-defined chunking (Gearhash CDC) | WARNING | Reduces Xet deduplication efficiency. Not a correctness bug for upload functionality. |
| `src/bindings.ts` | 7-55 | Upload commands absent from `bindings.ts` `commands` object | WARNING | The auto-generated `bindings.ts` only exports auth commands (4 commands). Upload commands are NOT in the specta-generated binding object — only in the hand-authored `src/commands/upload.ts`. This creates two parallel calling patterns. The upload.ts wrappers work correctly via raw `invoke()` but are not exposed through the typed `commands` object. |

---

## Human Verification Required

None currently — all failures are structural and verifiable programmatically. Once the queue wiring gap is fixed, the following items will require human verification:

### 1. Large File Memory Usage

**Test:** Upload a 2GB+ file to a real HF repo
**Expected:** Memory stays bounded (streaming, not loaded entirely into memory)
**Why human:** Can't verify memory behavior with static analysis

### 2. Network Interruption Resume

**Test:** Start a large upload, kill the network during upload, restore network, observe automatic resume
**Expected:** Upload resumes from last confirmed chunk without user intervention
**Why human:** Requires real network conditions

### 3. Xet Protocol End-to-End

**Test:** Upload to an Xet-enabled repo (once shard format is fixed)
**Expected:** Upload completes successfully with correct file content in the repo
**Why human:** Requires real HF API interaction and spec-compliant shard format

---

## Gaps Summary

**Root cause: One missing wiring step blocks all upload execution.**

`try_start_next` in `src-tauri/src/upload/queue.rs` contains a placeholder stub (left from Plan 03's "the real worker will be wired in Plan 04" comment). Plan 04 implemented `run_upload_job` completely — but never wired it back into `try_start_next`. This is a single file, single function fix.

The fix requires:
1. `try_start_next` needs access to the HF token and reqwest client (currently not passed)
2. The spawned task must call `run_upload_job(job_id, db, client, hf_token, cancel_token, progress_map)`
3. The cancel token must be registered before spawning the worker

The worker pipeline itself (`run_upload_job`, `run_xet_pipeline`, `run_lfs_pipeline`) is substantively implemented and correct. The LFS path should work end-to-end once wired. The Xet path has a known shard format issue (non-spec JSON placeholder) that will cause failures at the CAS server's shard acceptance step.

**Secondary gap: Xet shard format is non-spec-compliant.** The shard upload sends JSON instead of the binary format required by the CAS server. This is acknowledged with TODO comments and will cause Xet uploads to fail at shard submission. LFS multipart uploads are unaffected.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
