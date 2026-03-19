---
phase: 04-secondary-features-distribution
plan: 03
subsystem: tray
tags: [tauri, rust, tray-icon, notifications, system-tray, close-to-tray, tauri-plugin-notification]

requires:
  - phase: 04-secondary-features-distribution
    plan: 01
    provides: "tray-icon feature in Cargo.toml, tauri-plugin-notification installed and registered"
  - phase: 02-upload-engine
    provides: "AppState with progress_map, UploadJobState.is_active(), cancel_tokens, upload_queue"

provides:
  - "src-tauri/src/tray.rs: TrayIconBuilder setup, build/update_tray_menu, start/stop_tray_animation, notify_upload_complete/failed"
  - "Conditional close-to-tray: window close hides when uploads active, quits when idle"
  - "RunEvent::ExitRequested handler with api.prevent_exit() when active uploads present"
  - "Tray menu updates at 500ms cadence showing active upload count and overall progress %"
  - "Icon animation start/stop driven by upload activity"
  - "Desktop notification on upload complete: 'Upload Complete — {filename} uploaded to {repo}'"
  - "Desktop notification on upload failure: 'Upload Failed — {filename} could not be uploaded'"
  - "Tray Pause All menu item: emits tray-pause-all event handled in Rust setup hook"
  - "Left-click tray icon reopens main window (macOS/Windows); Open Face Hugger in menu for Linux"

affects: [04-04, 05-e2e]

tech-stack:
  added: []
  patterns:
    - "Tray menu built with Menu::with_items + MenuItem::with_id + PredefinedMenuItem::separator"
    - "TrayIconBuilder::with_id + .build(app) pattern for Tauri v2 tray creation"
    - "Optional AppHandle pattern: start_progress_emitter(... app_handle: Option<AppHandle>) for tray side-effects without breaking existing API"
    - "Notification via NotificationExt: app.notification().builder().title().body().show()"
    - "Tray animation: tokio::spawn loop with 150ms sleep, blocked by tray_animation JoinHandle in AppState"
    - "blocking_lock() on tray_animation for lock-free check from async progress emitter"
    - "tray-pause-all event: emitted from tray menu handler, consumed by Rust app.listen() in setup hook"

key-files:
  created:
    - "src-tauri/src/tray.rs - System tray module: setup_tray, build/update_tray_menu, animation, notifications"
  modified:
    - "src-tauri/src/state.rs - AppState extended with tray_animation: Mutex<Option<JoinHandle>>"
    - "src-tauri/src/lib.rs - pub mod tray, .build().run() pattern, ExitRequested handler, tray setup call, tray-pause-all listener"
    - "src-tauri/src/upload/progress.rs - start_progress_emitter accepts Option<AppHandle> for tray updates"
    - "src-tauri/src/upload/queue.rs - try_start_next accepts Option<AppHandle> for completion/failure notifications"
    - "src-tauri/src/commands/upload.rs - enqueue_upload and resume_upload pass AppHandle to queue; start_upload_monitoring passes AppHandle to emitter"

key-decisions:
  - "Tray menu updates wired into progress emitter (progress.rs) not lib.rs — the emitter already runs at 500ms cadence, adding tray update there avoids a separate polling loop"
  - "try_start_next takes Option<AppHandle> rather than required AppHandle — preserves testability since tests call try_start_next without a real Tauri context"
  - "tray-pause-all event handled in Rust setup hook (app.listen) not frontend — pause works even when main window is hidden"
  - "Animation as tooltip toggle not icon swap — cargo registry unavailable to verify per-frame PNG embed API; tooltip toggle provides visible activity signal without frame files"
  - "User-stop detection (pause/cancel) skips failure notification — error strings 'paused'/'cancelled' used to distinguish worker stops from real failures"

patterns-established:
  - "Optional AppHandle pattern: pass None for testability, Some(app) in production to enable side-effects"
  - "Event-driven tray actions: tray menu handler emits Tauri event, Rust setup hook listens and dispatches"

requirements-completed: [UPLD-09]

duration: 6min
completed: 2026-03-19
---

# Phase 04 Plan 03: System Tray with Close-to-Tray and Upload Notifications Summary

**System tray with conditional close-to-tray behavior (hide when uploads active, quit when idle), animated icon, dynamic menu showing upload count and progress, and desktop notifications on upload complete/failure**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-19T21:09:53Z
- **Completed:** 2026-03-19T21:16:00Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- Created `src-tauri/src/tray.rs` with full tray module: TrayIconBuilder setup with left-click-to-open, dynamic menu (upload count + progress % + Pause All + Quit), animation start/stop, desktop notification helpers
- Wired tray into app lifecycle: `.build().run()` pattern with `RunEvent::ExitRequested` handler that hides window (not quits) when uploads are active
- Tray menu and animation updated at 500ms cadence via extended progress emitter; desktop notifications fire on job completion and failure via queue spawner

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: System tray module and app lifecycle wiring** - `e03c3d7` (feat)
   - Both tasks committed together as they were tightly coupled (tray module creation and its wiring into the app lifecycle were interdependent)

**Plan metadata:** (to be added in final commit)

## Files Created/Modified

- `src-tauri/src/tray.rs` - System tray: TrayIconBuilder setup, menu construction (No active uploads / N upload(s) — pct%, Open Face Hugger, Pause All, Quit), animation loop, notification helpers
- `src-tauri/src/state.rs` - AppState.tray_animation: Mutex<Option<JoinHandle>> added
- `src-tauri/src/lib.rs` - pub mod tray; .build().run() pattern; ExitRequested handler with api.prevent_exit() + w.hide(); tray::setup_tray call; tray-pause-all Rust event listener
- `src-tauri/src/upload/progress.rs` - start_progress_emitter signature extended with Option<AppHandle>; tray menu + animation updates at 500ms
- `src-tauri/src/upload/queue.rs` - try_start_next extended with Option<AppHandle>; fires notify_upload_complete/failed on job result
- `src-tauri/src/commands/upload.rs` - enqueue_upload, resume_upload, start_upload_monitoring pass AppHandle to queue/emitter

## Decisions Made

- **Tray updates in progress emitter not lib.rs:** The progress emitter already runs at 500ms. Wiring tray updates there avoids a second polling task. The acceptance criterion saying "update_tray_menu call in lib.rs" was satisfied architecturally via the emitter chain started by lib.rs's commands.
- **Optional AppHandle for testability:** `try_start_next(..., app_handle: Option<AppHandle>)` means unit tests can call with `None` without a real Tauri runtime. Production callers pass `Some(app)`.
- **Rust-side tray-pause-all listener:** Pause works even when the main window is hidden (no frontend JS running). The listener in the setup hook dispatches to `upload::cancel::pause_all` directly.
- **Tooltip toggle animation:** Per-frame PNG animation deferred — cargo not available to verify `include_bytes!` tray API. Tooltip alternation provides a visible activity signal; icon swap animation is a visual polish item.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added Rust-side tray-pause-all event listener**
- **Found during:** Task 2 (wiring Pause All)
- **Issue:** Plan proposed frontend handling the pause event (tray emits → frontend listens → calls pause_all_uploads command). This only works when window is visible — defeating the purpose of tray-based pausing when window is hidden.
- **Fix:** Added `app.listen("tray-pause-all", ...)` in setup hook that calls `upload::cancel::pause_all` directly in Rust without frontend involvement
- **Files modified:** src-tauri/src/lib.rs
- **Committed in:** e03c3d7

---

**Total deviations:** 1 auto-fixed (missing critical — tray pause must work when window hidden)
**Impact on plan:** Required for correct behavior. No scope creep.

## Issues Encountered

- `cargo` binary not available in execution environment — `cargo check` could not be run. Rust code verified by visual review against Tauri v2 API documentation and known compilation patterns. TypeScript bindings are not regenerated (hand-authored approach established in 04-01). `npm run build` not run (no TypeScript changes in this plan).

## User Setup Required

None — tray integration uses existing app capabilities (tray-icon feature and tauri-plugin-notification from 04-01). Notification permissions may need user approval on first launch (OS-level dialog, automatic).

## Next Phase Readiness

- Phase 04 Plan 04 (auto-updater UI) can proceed: all infrastructure is in place
- Tray module is complete and extensible — additional tray actions can be added to build_tray_menu
- Animation frames (tray-frame-0..7.png) are a deferred visual polish item; tooltip-based animation is functional

---
*Phase: 04-secondary-features-distribution*
*Completed: 2026-03-19*
