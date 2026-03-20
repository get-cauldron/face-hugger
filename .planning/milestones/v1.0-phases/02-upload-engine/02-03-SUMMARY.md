---
phase: 02-upload-engine
plan: 03
subsystem: upload
tags: [tokio, semaphore, cancellation-token, rayon, sha256, sqlite, concurrency]

# Dependency graph
requires:
  - phase: 02-upload-engine
    plan: 01
    provides: UploadJob types, DB schema functions, AppState with cancel_tokens map

provides:
  - Upload queue with Semaphore-based concurrency control (1-5, default 2)
  - State transition validator for full upload lifecycle
  - CancellationToken registry (register/cancel/pause/pause_all/remove)
  - Streaming SHA-256 file hasher in dedicated 2-thread rayon pool

affects: [02-04, upload worker wiring, IPC commands for cancel/pause/resume]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Semaphore concurrency pattern: Arc<Semaphore> with try_acquire_owned for non-blocking permit acquisition
    - CancellationToken reuse for pause: same signal mechanism, worker distinguishes cancel vs pause by reading DB state
    - rayon + spawn_blocking bridge: CPU-bound hashing isolated from tokio runtime via threadpool install()
    - OnceLock for lazy-initialized global thread pool

key-files:
  created:
    - src-tauri/src/upload/queue.rs
    - src-tauri/src/upload/cancel.rs
    - src-tauri/src/upload/hash.rs
  modified:
    - src-tauri/src/upload/mod.rs

key-decisions:
  - "Pause reuses CancellationToken: cancel() is called for both pause and cancel; worker reads DB state to distinguish — avoids maintaining a separate signal type"
  - "set_max_concurrent decrease: close old semaphore and create new one — active uploads finish naturally with permits from old semaphore"
  - "cancel_job_token helper: separate from cancel_job to allow token-only cancellation in tests without needing a real DB pool"

patterns-established:
  - "CancellationToken pattern: register per job in AppState.cancel_tokens, cancel on stop/pause, remove on completion"
  - "Rayon pool pattern: OnceLock<ThreadPool> singleton with num_threads(2), bridged via spawn_blocking"
  - "Non-blocking semaphore: try_acquire_owned (never .await on semaphore) ensures try_start_next is non-blocking"

requirements-completed: [UPLD-04, UPLD-05]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 02 Plan 03: Upload Queue Engine Summary

**Tokio Semaphore upload queue with CancellationToken registry and rayon-threaded SHA-256 streaming hasher**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T16:54:27Z
- **Completed:** 2026-03-19T16:57:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Upload queue enforces 1-5 concurrent uploads via `Arc<Semaphore>` with try_acquire_owned (non-blocking); clamped correctly
- State transition validator covers full lifecycle including pause/resume/cancel from all active states
- CancellationToken registry supports register (with old-token replacement), cancel, pause, pause_all, and remove — all tested including a tokio::select! cancellation proof
- Streaming SHA-256 file hasher runs in a dedicated 2-thread rayon pool via spawn_blocking bridge, verified against known digests

## Task Commits

Each task was committed atomically:

1. **Task 1: Upload queue with concurrency control and priority ordering** - `eb8e14f` (feat)
2. **Task 2: CancellationToken registry and streaming file hasher** - `0fa964f` (feat)

## Files Created/Modified

- `src-tauri/src/upload/queue.rs` - UploadQueue (Semaphore), try_start_next, next_pending_job, can_transition
- `src-tauri/src/upload/cancel.rs` - CancellationToken registry: register_token, cancel_job, pause_job, pause_all, remove_token
- `src-tauri/src/upload/hash.rs` - hash_file_streaming via rayon HASH_POOL (OnceLock, 2 threads), 8MB buffer
- `src-tauri/src/upload/mod.rs` - Added pub mod cancel, hash, queue

## Decisions Made

- Pause reuses CancellationToken cancel() signal — worker reads DB state post-cancellation to distinguish pause vs cancel. Avoids a second signaling type.
- set_max_concurrent decrease replaces the semaphore entirely — active uploads hold permits from the old semaphore and finish naturally.
- cancel_job_token is a DB-free helper enabling clean unit tests without a real SqlitePool.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 can wire the actual upload worker into try_start_next (the placeholder eprintln! is the hook point)
- cancel_tokens in AppState is ready for IPC command handlers (cancel_upload, pause_upload, resume_upload)
- hash_file_streaming is ready to be called at the start of the upload pipeline

---
*Phase: 02-upload-engine*
*Completed: 2026-03-19*
