---
phase: 02-upload-engine
plan: "05"
subsystem: upload-engine
tags: [tauri-commands, progress-reporting, typescript-wrappers, ipc, channel]
dependency_graph:
  requires: ["02-04"]
  provides: ["upload-command-layer", "progress-emitter", "frontend-wrappers"]
  affects: ["src-tauri/src/upload/progress.rs", "src-tauri/src/commands/upload.rs", "src-tauri/src/lib.rs", "src/commands/upload.ts", "src/bindings.ts"]
tech_stack:
  added: []
  patterns: ["tauri::ipc::Channel for streaming progress", "500ms batched progress emission", "StoreExt for tauri-plugin-store", "std::sync::Mutex for ProgressMap (short critical sections)"]
key_files:
  created:
    - src-tauri/src/upload/progress.rs
    - src-tauri/src/commands/upload.rs
    - src/commands/upload.ts
  modified:
    - src-tauri/src/state.rs
    - src-tauri/src/upload/mod.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/bindings.ts
decisions:
  - "ProgressMap uses std::sync::Mutex (not tokio) — short critical sections shared between sync worker and async timer are correct use case for std mutex"
  - "start_progress_emitter stores JoinHandle in AppState::progress_emitter so it can be aborted on re-call (prevents duplicate emitter tasks)"
  - "AppState::new takes max_concurrent parameter — lib.rs reads from tauri-plugin-store on startup with default 2"
  - "Frontend invoke uses snake_case field names matching Rust serde serialization (file_path, repo_id, job_id etc)"
metrics:
  duration: "3min"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 8
---

# Phase 02 Plan 05: Upload Command Layer Summary

Wire the upload engine to the frontend — progress reporting via Channel, all Tauri command handlers, command registration, and TypeScript wrappers.

**One-liner:** Upload command layer with 500ms Channel progress batching, 9 Tauri commands, persistent concurrent limit via tauri-plugin-store, and TypeScript wrappers.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Progress emitter and Tauri upload commands | aff1fc4 | progress.rs, commands/upload.rs, state.rs, mod files |
| 2 | Register commands in lib.rs + frontend TypeScript wrappers | b1344f2 | lib.rs, src/commands/upload.ts, src/bindings.ts |

## What Was Built

### Task 1: Progress Emitter + Upload Commands

**`src-tauri/src/upload/progress.rs`**
- `ProgressMap` type alias: `Arc<StdMutex<HashMap<String, UploadProgress>>>` — uses `std::sync::Mutex` for short critical sections
- `new_progress_map()` constructor
- `update_progress()` helper for upload workers to call when bytes change
- `remove_progress()` helper to clean up completed jobs
- `SpeedTracker` with 5-second sliding window — calculates `speed_bps()` and `eta_seconds()`
- `start_progress_emitter()` — spawns tokio task that ticks every 500ms, reads all active jobs from ProgressMap, sends `Vec<UploadProgress>` via `Channel<Vec<UploadProgress>>`
- 5 unit tests: speed calculation, ETA, empty tracker, map update, rate-not-per-chunk structural test

**`src-tauri/src/commands/upload.rs`** — 9 commands with `#[tauri::command]` + `#[specta::specta]`:
- `enqueue_upload` — validates file exists, gets size, inserts DB row, kicks queue
- `cancel_upload` — delegates to `upload::cancel::cancel_job`
- `pause_upload` — delegates to `upload::cancel::pause_job`
- `resume_upload` — sets state to pending, kicks queue via `try_start_next`
- `pause_all_uploads` — delegates to `upload::cancel::pause_all`, returns count
- `list_uploads` — queries all jobs from DB, converts `JobRow` → `UploadJob`
- `set_upload_priority` — raw SQL UPDATE on priority field
- `start_upload_monitoring` — aborts existing emitter handle, starts new one, stores JoinHandle
- `set_concurrent_limit` — clamps 1..=5, persists to tauri-plugin-store, applies immediately via `queue.set_max_concurrent()`

**`src-tauri/src/state.rs`** — Added `upload_queue: Mutex<UploadQueue>`, `progress_map: ProgressMap`, `progress_emitter: Mutex<Option<JoinHandle<()>>>` to AppState; `AppState::new` now takes `max_concurrent: usize`.

### Task 2: lib.rs Registration + Frontend Wrappers

**`src-tauri/src/lib.rs`**
- All 9 upload commands registered in `collect_commands![]`
- On startup: reads `concurrent_upload_limit` from tauri-plugin-store (default 2), passes to `AppState::new`

**`src/commands/upload.ts`**
- TypeScript interfaces: `UploadJobState`, `UploadProtocol`, `UploadJob`, `UploadProgress`
- `unwrap<T>()` helper following Phase 1 pattern from `commands/auth.ts`
- Wrappers for all 9 commands: `enqueueUpload`, `cancelUpload`, `pauseUpload`, `resumeUpload`, `pauseAllUploads`, `listUploads`, `setUploadPriority`, `startUploadMonitoring`, `setConcurrentLimit`
- `startUploadMonitoring` uses `Channel<UploadProgress[]>` API for streaming progress

**`src/bindings.ts`** — Added `UploadJobState`, `UploadProtocol` type exports and re-exports `UploadJob`/`UploadProgress` from `commands/upload.ts`.

## Verification

- `cargo test --lib`: 57 passed, 2 ignored (network), 0 failed
- `cargo check`: clean (no warnings or errors)
- `npx tsc --noEmit`: clean (no type errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added StoreExt import to upload.rs**
- **Found during:** Task 1 — cargo check failure
- **Issue:** `app.store()` requires `tauri_plugin_store::StoreExt` trait in scope
- **Fix:** Added `use tauri_plugin_store::StoreExt;` at top of upload.rs
- **Files modified:** src-tauri/src/commands/upload.rs

**2. [Rule 1 - Bug] Fixed type annotation in store error closures**
- **Found during:** Task 1 — cargo check E0282
- **Issue:** Rust needed explicit type on closure parameter for store error mapping
- **Fix:** Added `|e: tauri_plugin_store::Error|` explicit type annotations
- **Files modified:** src-tauri/src/commands/upload.rs

**3. [Rule 2 - Missing Critical Functionality] AppState extended with upload_queue and progress_map**
- **Found during:** Task 1 — set_concurrent_limit requires `state.upload_queue`
- **Issue:** AppState from Phase 1 had no upload_queue or progress_map fields; AppState::new signature needed max_concurrent parameter
- **Fix:** Added both fields to AppState, updated constructor signature
- **Files modified:** src-tauri/src/state.rs, src-tauri/src/lib.rs

**4. [Rule 3 - Blocking] lib.rs AppState::new called with wrong arity**
- **Found during:** Task 2 — cargo check E0061
- **Issue:** lib.rs still called `AppState::new(pool)` but new signature requires `max_concurrent`
- **Fix:** Updated lib.rs to read `concurrent_upload_limit` from tauri-plugin-store then pass to `AppState::new(pool, concurrent_limit)`
- **Files modified:** src-tauri/src/lib.rs

**5. [Rule 2 - Design] start_upload_monitoring aborts previous emitter handle**
- **Found during:** Task 1 — reasoning about duplicate emitter tasks
- **Issue:** If frontend calls start_upload_monitoring twice, duplicate tasks would spam the channel
- **Fix:** Store JoinHandle in `AppState::progress_emitter`; abort existing handle on each call
- **Files modified:** src-tauri/src/state.rs, src-tauri/src/commands/upload.rs

**6. [Rule 1 - Bug] Frontend invoke uses snake_case field names**
- **Found during:** Task 2 — plan showed camelCase but Tauri invoke uses Rust serde field names
- **Issue:** Plan's TypeScript example used camelCase keys (filePath, repoId) but Rust serde serializes as snake_case
- **Fix:** Used snake_case keys in invoke calls (file_path, repo_id, job_id, etc.) matching Rust struct field names
- **Files modified:** src/commands/upload.ts

## Self-Check: PASSED

- progress.rs: FOUND
- commands/upload.rs: FOUND
- src/commands/upload.ts: FOUND
- commit aff1fc4: FOUND
- commit b1344f2: FOUND
