---
phase: 02-upload-engine
plan: 01
subsystem: database
tags: [sqlx, sqlite, wal, rust, upload-queue, tokio, cancellation-token]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Tauri v2 app skeleton, AppState pattern, Cargo.toml baseline

provides:
  - SQLite upload queue schema (upload_jobs, confirmed_xorbs, confirmed_lfs_parts)
  - upload::types module (UploadJobState, UploadProtocol, UploadJob, UploadProgress, EnqueueRequest, UploadError)
  - db::init_db function with WAL mode and sqlx migrate runner
  - db::schema CRUD operations (insert_job, get_job, list_jobs, update_job_state, update_job_progress, update_job_protocol, update_job_error, confirmed xorbs/parts operations)
  - AppState extended with SqlitePool and cancel_tokens HashMap
  - All new dependencies: sqlx 0.8, tokio-util, rayon, sha2, hex, uuid, chrono, rand, futures

affects:
  - 02-02: upload worker (uses db::schema, upload::types, AppState.db, AppState.cancel_tokens)
  - 02-03: queue commands (uses UploadJob, EnqueueRequest, AppState.db)
  - 02-04: progress (uses UploadProgress, UploadJobState)
  - 02-05: protocol detection (uses UploadProtocol, db::schema)

# Tech tracking
tech-stack:
  added:
    - sqlx 0.8 (sqlite, runtime-tokio, macros, migrate features)
    - tokio-util 0.7 (CancellationToken)
    - rayon 1 (CPU threadpool for hashing)
    - sha2 0.10 (SHA-256 streaming hasher)
    - hex 0.4 (hash encoding)
    - uuid 1 (v4 upload job IDs)
    - chrono 0.4 with serde (timestamps)
    - rand 0.8 (jitter for backoff)
    - futures 0.3 (join_all for xorb uploads)
    - reqwest extended with stream + multipart features
  patterns:
    - SQLite WAL mode via SqliteConnectOptions::journal_mode(SqliteJournalMode::Wal)
    - sqlx::migrate!("./migrations") for embedded migrations at compile time
    - AppState::new(db) constructor pattern (replaces Default - SqlitePool has no Default)
    - DB initialized in Tauri setup hook via tauri::async_runtime::spawn
    - tauri::Manager trait import required for app_handle.path() and app_handle.manage()
    - In-memory test pools use max_connections(1) to share single SQLite in-memory DB
    - State stored as string in DB, converted via UploadJobState::from_str/as_str at boundaries

key-files:
  created:
    - src-tauri/migrations/001_upload_queue.sql
    - src-tauri/src/db/mod.rs
    - src-tauri/src/db/schema.rs
    - src-tauri/src/upload/mod.rs
    - src-tauri/src/upload/types.rs
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/state.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "AppState::new(db) constructor replaces Default — SqlitePool has no Default impl"
  - "In-memory test pools require max_connections(1) so all connections share the same SQLite DB"
  - "tauri::Manager trait must be explicitly imported for app_handle.path() and app_handle.manage() in setup hook"
  - "sqlx::Row trait must be explicitly imported for SqliteRow.get() in test module"
  - "DB initialization runs in tauri::async_runtime::spawn inside setup hook — non-blocking, manages AppState after pool is ready"
  - "Upload state stored as TEXT in SQLite, converted to/from UploadJobState enum at Rust boundaries"

patterns-established:
  - "Pattern: Async DB init in Tauri setup hook via async_runtime::spawn with app_handle.manage() after await"
  - "Pattern: max_connections(1) SQLite pool for in-memory test isolation"
  - "Pattern: String-based DB state column with enum conversion helpers (as_str/from_str)"

requirements-completed: [UPLD-01, UPLD-04, UPLD-10]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 2 Plan 1: Upload Engine Foundation Summary

**SQLite upload queue with WAL mode, all upload types (UploadJobState, UploadProtocol, UploadJob, UploadProgress), and AppState extended with SqlitePool and CancellationToken registry**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T16:48:11Z
- **Completed:** 2026-03-19T16:51:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Upload queue schema established: upload_jobs, confirmed_xorbs, confirmed_lfs_parts tables with WAL mode, priority ordering, and indexes
- All shared upload types defined and specta-serializable: UploadJobState (8 states with is_active/is_terminal helpers), UploadProtocol, UploadJob, UploadProgress, EnqueueRequest, UploadError
- DB CRUD layer: insert_job, get_job, list_jobs, update_job_state, update_job_progress, update_job_error, confirmed xorbs/parts operations
- AppState extended with SqlitePool and cancel_tokens HashMap; initialized asynchronously in Tauri setup hook
- 14 unit tests green: state roundtrips, DB CRUD, schema invariants (no URL columns), priority ordering, pause persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Cargo dependencies and create SQLite migration** - `56c4057` (chore)
2. **Task 2: Create upload types, DB module, and wire into AppState** - `7c248a6` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src-tauri/Cargo.toml` - Added sqlx, tokio-util, rayon, sha2, hex, uuid, chrono, rand, futures; extended reqwest
- `src-tauri/migrations/001_upload_queue.sql` - Upload queue schema with 3 tables and 2 indexes
- `src-tauri/src/db/mod.rs` - init_db function: SQLite WAL mode + migration runner
- `src-tauri/src/db/schema.rs` - CRUD operations, JobRow FromRow type, 7 unit tests
- `src-tauri/src/upload/mod.rs` - Upload module declaration
- `src-tauri/src/upload/types.rs` - All upload types + 5 unit tests
- `src-tauri/src/state.rs` - AppState extended with db and cancel_tokens; new() constructor
- `src-tauri/src/lib.rs` - pub mod db/upload; DB init in async setup hook

## Decisions Made
- AppState::new(db) constructor replaces Default — SqlitePool has no Default impl
- DB initialization runs in tauri::async_runtime::spawn inside setup hook so app startup is not blocked
- Upload state stored as TEXT in SQLite, converted to/from UploadJobState enum at Rust call boundaries (not stored as integer enum — easier debugging)
- test_pool() uses max_connections(1) so all connections share the same in-memory SQLite database

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing tauri::Manager trait import**
- **Found during:** Task 2 (wiring AppState into setup hook)
- **Issue:** app_handle.path() and app_handle.manage() are methods from the Manager trait, which must be explicitly imported in Tauri v2; plan snippet omitted the import
- **Fix:** Added `use tauri::Manager;` to lib.rs
- **Files modified:** src-tauri/src/lib.rs
- **Verification:** Compiler error resolved; cargo test passes
- **Committed in:** 7c248a6

**2. [Rule 1 - Bug] Added missing sqlx::Row trait import in tests**
- **Found during:** Task 2 (schema test for no URL columns)
- **Issue:** SqliteRow.get() requires sqlx::Row trait in scope; plan snippet in test module omitted the import
- **Fix:** Added `use sqlx::Row;` inside the test module
- **Files modified:** src-tauri/src/db/schema.rs
- **Verification:** Compiler error resolved; test passes
- **Committed in:** 7c248a6

**3. [Rule 1 - Bug] Fixed in-memory SQLite pool isolation in tests**
- **Found during:** Task 2 (DB schema tests)
- **Issue:** Default SqlitePool creates multiple connections; each `:memory:` connection is a separate SQLite database, so migration ran on connection 1 but query executed on connection 2 — "no such table: upload_jobs"
- **Fix:** Changed test_pool() to use PoolOptions::new().max_connections(1) so all connections share the same in-memory database
- **Files modified:** src-tauri/src/db/schema.rs
- **Verification:** All 7 DB tests pass
- **Committed in:** 7c248a6

---

**Total deviations:** 3 auto-fixed (all Rule 1 - missing imports/incorrect behavior in plan snippets)
**Impact on plan:** All fixes necessary for correctness. No scope creep. The patterns established (max_connections(1) for test pools, explicit Manager import) are important for future plans.

## Issues Encountered
- sqlx::migrate! in test modules requires the migrations directory to exist at `src-tauri/migrations/` relative to crate root — this was already satisfied by Task 1

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All upload types and DB primitives ready for Plan 02 (upload worker)
- AppState.db accessible in all Tauri commands via tauri::State<'_, AppState>
- AppState.cancel_tokens ready for CancellationToken registration in worker
- All new Cargo dependencies (rayon, sha2, hex, uuid, chrono, rand, futures) available for Plans 02-05

---
*Phase: 02-upload-engine*
*Completed: 2026-03-19*

## Self-Check: PASSED

- FOUND: src-tauri/migrations/001_upload_queue.sql
- FOUND: src-tauri/src/db/mod.rs
- FOUND: src-tauri/src/db/schema.rs
- FOUND: src-tauri/src/upload/mod.rs
- FOUND: src-tauri/src/upload/types.rs
- FOUND: .planning/phases/02-upload-engine/02-01-SUMMARY.md
- FOUND commit: 56c4057 (Task 1)
- FOUND commit: 7c248a6 (Task 2)
