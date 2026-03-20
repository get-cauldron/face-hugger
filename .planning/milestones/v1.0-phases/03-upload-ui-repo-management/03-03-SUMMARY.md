---
phase: 03-upload-ui-repo-management
plan: "03"
subsystem: ui
tags: [react, tauri, zustand, drag-and-drop, upload-queue, folder-sync]

requires:
  - phase: 03-01-upload-ui
    provides: uploadStore with jobs/progressMap/wizardOpen state
  - phase: 03-02-upload-ui-repo-management
    provides: UploadPage shell and UploadWizard 3-step flow
  - phase: 02-upload-engine
    provides: upload commands (enqueueUpload, pauseUpload, cancelUpload, setUploadPriority, listUploads)

provides:
  - Split-section upload queue view (active/queued/completed) with per-file progress metrics
  - App-wide OS drag-and-drop via Tauri onDragDropEvent with MiniRepoPicker dialog
  - FolderSync UI that compares local folder to remote repo via readDir + listFiles diff
  - ActiveJobRow with progress bar, speed (MB/s), ETA, bytes transferred, pause/cancel controls
  - QueuedJobRow with star priority toggling (setUploadPriority) and resume/cancel controls
  - CompletedJobRow with state badge, error tooltip, and remove-from-list action
  - UploadPage tabbed interface: Queue / New Upload / Folder Sync

affects: [04-repo-browser, 05-e2e-testing]

tech-stack:
  added:
    - "@tauri-apps/api/webview (getCurrentWebview().onDragDropEvent)"
    - "@tauri-apps/plugin-fs (readDir, stat)"
    - "@tauri-apps/plugin-dialog (open({ directory: true }))"
    - "@huggingface/hub (listFiles for remote diff)"
  patterns:
    - Section collapsible component for queue grouping (defaultOpen per section)
    - Tauri webview drag-drop event (not HTML5 — critical for macOS/Linux)
    - Inline confirm state pattern for destructive actions (cancel upload)
    - walkDir recursive helper using Tauri readDir for local folder traversal

key-files:
  created:
    - src/routes/upload/queue/UploadQueueView.tsx
    - src/routes/upload/queue/ActiveJobRow.tsx
    - src/routes/upload/queue/QueuedJobRow.tsx
    - src/routes/upload/queue/CompletedJobRow.tsx
    - src/routes/upload/MiniRepoPicker.tsx
    - src/routes/upload/FolderSync.tsx
  modified:
    - src/routes/upload/UploadPage.tsx
    - src/components/shell/AppShell.tsx

key-decisions:
  - "onDragDropEvent from @tauri-apps/api/webview used for OS drag-and-drop — HTML5 ondrop does not fire for OS file drops in Tauri on macOS/Linux"
  - "Inline confirm state (confirming boolean) for cancel buttons — avoids modal overhead for destructive row actions"
  - "FolderSync uses file size as change detection heuristic — no hash comparison needed for initial sync UX"
  - "walkDir recursion implemented as local async helper — avoids adding a dependency for a simple traversal"
  - "MiniRepoPicker enqueues all dropped files before closing — no partial enqueue on error midway"

patterns-established:
  - "Section collapsible: defaultOpen prop with ChevronDown/ChevronRight toggle and count badge"
  - "Row action loading state: useState<'pause'|'resume'|'cancel'|null> with spinner on active action"
  - "Drag overlay: absolute inset-0 z-50 with pointer-events-none — does not block underlying UI"

requirements-completed: [UPLD-07, UPLD-08]

duration: 5min
completed: 2026-03-19
---

# Phase 03 Plan 03: Upload Queue View, Drag-and-Drop, and Folder Sync Summary

**Split-section upload queue with progress metrics, app-wide Tauri OS drag-and-drop via onDragDropEvent, and folder diff sync using readDir + listFiles**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-19T12:13:37Z
- **Completed:** 2026-03-19T12:17:57Z
- **Tasks:** 2
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- UploadQueueView splits jobs into active/queued/completed collapsible sections with job counts
- ActiveJobRow renders Progress component with live speed (formatSpeed), ETA (formatEta), and bytes (formatBytes) from progressMap
- AppShell wires `getCurrentWebview().onDragDropEvent` for Tauri OS file drop events — shows drag overlay with cloud icon; opens MiniRepoPicker on drop
- MiniRepoPicker dialog combines useModels + useDatasets into a searchable list, enqueues all dropped files, navigates to Upload section
- FolderSync compares local folder (readDir + stat) to remote (listFiles) and shows new/changed/unchanged/remote-only diff table with selective upload
- UploadPage reorganized into Queue / New Upload / Folder Sync tabs

## Task Commits

Each task was committed atomically:

1. **Task 1: Upload queue view with split sections and job controls** - `ec22cb7` (feat)
2. **Task 2: App-wide drag-and-drop, mini repo picker, and folder sync** - `591b681` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/routes/upload/queue/UploadQueueView.tsx` — three-section collapsible queue view
- `src/routes/upload/queue/ActiveJobRow.tsx` — expanded row: progress bar, speed, ETA, pause/cancel
- `src/routes/upload/queue/QueuedJobRow.tsx` — compact row: star priority, resume/cancel
- `src/routes/upload/queue/CompletedJobRow.tsx` — compact row: state badge, error, remove
- `src/routes/upload/MiniRepoPicker.tsx` — drag-drop dialog with searchable repo list + enqueue
- `src/routes/upload/FolderSync.tsx` — folder comparison and selective sync UI
- `src/routes/upload/UploadPage.tsx` — updated with tabs and FolderSync import
- `src/components/shell/AppShell.tsx` — updated with onDragDropEvent, drag overlay, MiniRepoPicker

## Decisions Made

- `onDragDropEvent` from `@tauri-apps/api/webview` used instead of HTML5 drag events — HTML5 drop does not fire for OS file drags on macOS/Linux in Tauri desktop apps
- FolderSync uses file size for change detection — sufficient for typical upload scenarios without hash overhead
- Inline confirm state pattern for cancel buttons — single boolean `confirming` avoids modal overhead

## Deviations from Plan

None — plan executed exactly as written. AppShell had evolved since plan was written (RepoBrowserPage added by 03-02), adapted by editing without overwriting the new structure.

## Issues Encountered

- AppShell.tsx was modified by 03-02 to add RepoBrowserPage after the plan was written — resolved by using Edit tool to extend the file rather than overwrite.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Upload queue, drag-and-drop, and folder sync are complete — ready for Phase 04 (repo browser, settings polish)
- UploadPage tab structure is extensible for future additions

## Self-Check: PASSED

- All 6 new files confirmed on disk
- Both task commits (ec22cb7, 591b681) confirmed in git log

---
*Phase: 03-upload-ui-repo-management*
*Completed: 2026-03-19*
