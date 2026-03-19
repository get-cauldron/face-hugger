---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 04-01-PLAN.md
last_updated: "2026-03-19T20:48:34.561Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 17
  completed_plans: 15
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Uploading multi-GB files to Hugging Face should work reliably on flaky connections without babysitting — resumable, visible, and recoverable.
**Current focus:** Phase 04 — secondary-features-distribution

## Current Position

Phase: 04 (secondary-features-distribution) — EXECUTING
Plan: 2 of 4

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: 16min
- Total execution time: 16min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P01 | 16min | 3 tasks | 22 files |
| Phase 01-foundation P02 | 7min | 3 tasks | 16 files |
| Phase 01-foundation P03 | 45min | 3 tasks | 13 files |
| Phase 02-upload-engine P01 | 3 | 2 tasks | 7 files |
| Phase 02-upload-engine P03 | 3min | 2 tasks | 4 files |
| Phase 02-upload-engine P02 | 3min | 2 tasks | 4 files |
| Phase 02-upload-engine P04 | 3min | 1 tasks | 3 files |
| Phase 02-upload-engine P05 | 3min | 2 tasks | 8 files |
| Phase 03-upload-ui P01 | 5min | 3 tasks | 20 files |
| Phase 03-upload-ui-repo-management P02 | 6min | 2 tasks | 9 files |
| Phase 03-upload-ui-repo-management P05 | 8min | 2 tasks | 6 files |
| Phase 03-upload-ui-repo-management P03 | 5min | 2 tasks | 8 files |
| Phase 03-upload-ui-repo-management P04 | 3min | 2 tasks | 8 files |
| Phase 04-secondary-features-distribution P02 | 5min | 3 tasks | 8 files |
| Phase 04-secondary-features-distribution P01 | 5min | 2 tasks | 11 files |

## Accumulated Context

### Roadmap Evolution

- Phase 5 added: E2E/UI Automated Testing

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Tauri v2 + React — Rust backend owns all upload I/O; React WebView owns UI state and HF reads
- [Init]: tauri-specta required from Phase 1 — type-safe IPC boundary prevents entire class of JS/Rust bugs
- [Init]: Auth-03 (OAuth) deferred to Phase 4 — token auth unblocks everything; OAuth is onboarding polish
- [Phase 01-foundation]: keyring async-secret-service+tokio features (NOT sync) — sync/async conflict in same build
- [Phase 01-foundation]: Remove explicit specta version pin — tauri-specta rc.21 requires specta rc.22 internally
- [Phase 01-foundation]: Use /api/whoami-v2 exclusively — v1 returns 401 for modern HF fine-grained tokens
- [Phase 01-foundation]: Hand-authored src/bindings.ts so Plan 02 can import typed commands without running the app
- [Phase 01-foundation]: types.ts UserInfo uses 'type' not 'user_type' — matches bindings.ts which serializes Rust field as 'type'
- [Phase 01-foundation]: Tailwind v4 requires @tailwindcss/vite Vite plugin; CSS @import alone insufficient — added plugin to vite.config.ts
- [Phase 01-foundation]: Section-based routing in AppShell via local state — no React Router needed for 3-4 view desktop app
- [Phase 01-foundation]: additionalFields: ['tags'] only in listModels/listDatasets — private/downloads/likes/lastModified are already in base ModelEntry
- [Phase 01-foundation]: Use openUrl() from @tauri-apps/plugin-opener (not open())
- [Phase 01-foundation]: tauri-controls replaced with custom titlebar — package incompatible with React 19
- [Phase 01-foundation]: model.name used directly from @huggingface/hub (not parsed from id) — avoids hash display bug
- [Phase 01-foundation]: tauri-specta Result<T,E> must be unwrapped (.data) before returning to JS callers
- [Phase 01-foundation]: Tailwind v4 var() arbitrary values do not resolve — use semantic utility classes instead
- [Phase 02-upload-engine]: AppState::new(db) constructor replaces Default — SqlitePool has no Default impl
- [Phase 02-upload-engine]: In-memory test pools require max_connections(1) to share single SQLite DB
- [Phase 02-upload-engine]: DB initialization runs in tauri::async_runtime::spawn in setup hook; tauri::Manager trait must be explicitly imported
- [Phase 02-upload-engine]: Pause reuses CancellationToken cancel() signal; worker reads DB state post-cancellation to distinguish pause vs cancel
- [Phase 02-upload-engine]: set_max_concurrent decrease replaces semaphore entirely; active uploads hold permits from old semaphore and finish naturally
- [Phase 02-upload-engine]: bytes crate added for bytes::Bytes parameter type in xorb/shard upload functions
- [Phase 02-upload-engine]: Helper functions (parse_protocol, format_commit_body, lfs_batch_url) kept pub for offline testability without mocking HTTP
- [Phase 02-upload-engine]: Fixed 64MB xorb size for simplicity; Gearhash CDC deferred
- [Phase 02-upload-engine]: Shard serialized as JSON placeholder; spec-compliant binary format deferred
- [Phase 02-upload-engine]: compute_xorb_ranges extracted as public helper for unit testability
- [Phase 02-upload-engine]: ProgressMap uses std::sync::Mutex (not tokio) — short critical sections shared between sync worker and async timer are correct use case
- [Phase 02-upload-engine]: start_progress_emitter stores JoinHandle in AppState to prevent duplicate emitter tasks on re-call
- [Phase 02-upload-engine]: Frontend invoke uses snake_case field names matching Rust serde serialization
- [Phase 03-upload-ui P01]: shadcn init requires --legacy-peer-deps workaround — @vitejs/plugin-react v4 peer conflict with vite v8
- [Phase 03-upload-ui P01]: shadcn base-nova style requires @base-ui/react — must be installed manually when shadcn init partially fails
- [Phase 03-upload-ui P01]: src/lib/utils.ts with cn() (clsx + tailwind-merge) required by all shadcn components importing from "@/lib/utils"
- [Phase 03-upload-ui-repo-management]: CreateRepoSheet owned by StepRepoPicker (not UploadWizard) — step encapsulates its own sheet state
- [Phase 03-upload-ui-repo-management]: handleRepoCreated constructs synthetic RepoItem for immediate auto-selection without waiting for React Query refetch
- [Phase 03-upload-ui-repo-management]: Server-side URL resolution for revert operations: pass HF CDN URL as content to hub commit() — no large file downloads client-side
- [Phase 03-upload-ui-repo-management]: Restore uses same squash-forward commit logic as Revert; destructive appearance via red button + typed-name confirmation gate
- [Phase 03-upload-ui-repo-management]: onDragDropEvent from @tauri-apps/api/webview used for OS drag-and-drop — HTML5 ondrop does not fire for OS file drops in Tauri on macOS/Linux
- [Phase 03-upload-ui-repo-management]: FolderSync uses file size as change detection heuristic — no hash comparison needed for initial sync UX
- [Phase 03-upload-ui-repo-management]: FileActions default export is DeleteFileDialog; DeleteRepoDialog is named export — mirrors usage pattern at import sites
- [Phase 03-upload-ui-repo-management]: onRepoSelect callback threaded AppShell → ContentArea → ModelsPage/DatasetsPage; handleRepoClick calls onRepoSelect after writing recent preference
- [Phase 04-secondary-features-distribution]: Dataset query priority: search > filter > plain rows when multiple modes active
- [Phase 04-secondary-features-distribution]: ColumnStatPanel toggle: clicking same column header closes the stat panel
- [Phase 04-secondary-features-distribution]: bindings.ts hand-authored for OAuth commands — cargo not available in env; stubs match tauri-specta snake_case→camelCase convention
- [Phase 04-secondary-features-distribution]: OAuth token stored in same face-hugger/hf-token keyring entry as paste tokens — unified storage so check_existing_token works for both auth paths
- [Phase 04-secondary-features-distribution]: Frontend calls getStoredToken() after oauthExchangeCode returns UserInfo — token not in return value; fetched from Rust keyring state for zustand store
- [Phase 04-secondary-features-distribution]: tauri-plugin-oauth uses localhost HTTP redirect — no deep-link scheme registration needed; resolves Phase 4 blocker noted in STATE.md

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Xet CAS upload protocol (chunk format, xorb assembly, CAS endpoints) is not fully documented publicly — will require reading `hf-xet` Rust source during Phase 2 planning
- [Phase 4]: Linux system tray distro compatibility matrix unknown — needs research before committing to tray scope in Phase 4
- [Phase 4]: OAuth deep-link scheme registration in Tauri v2 has sparse community examples — needs research before Phase 4 planning

## Session Continuity

Last session: 2026-03-19T20:48:34.559Z
Stopped at: Completed 04-01-PLAN.md
Resume file: None
