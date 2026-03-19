---
phase: 03-upload-ui-repo-management
plan: 02
subsystem: ui
tags: [react, tauri, wizard, upload, repo-management, shadcn, tanstack-query]

requires:
  - phase: 03-01
    provides: shadcn components, uploadStore, upload commands, repo queries, repoUtils

provides:
  - 3-step upload wizard (StepRepoPicker, StepFilePicker, StepReview) in UploadWizard.tsx
  - UploadPage container wired into AppShell
  - CreateRepoSheet slide-out panel (Sheet-based, right side)
  - "New Repository" button in ModelsPage and DatasetsPage headers

affects:
  - 03-03-upload-queue (UploadPage queue view placeholder, uploadStore monitoring)
  - 03-04-repo-browser (AppShell navigation context)

tech-stack:
  added: []
  patterns:
    - "Wizard state owned at UploadWizard level; steps receive props + callbacks"
    - "CreateRepoSheet owned by consumer component (StepRepoPicker), not parent wizard"
    - "Sheet component (base-ui Dialog) used for slide-out panels"
    - "File deduplication by absolute path using Set.has() in StepFilePicker"
    - "Tauri plugin-dialog open() for both Browse Files and Browse Folder"
    - "Tauri plugin-fs readDir + stat for folder recursion and file size resolution"

key-files:
  created:
    - src/routes/upload/UploadPage.tsx
    - src/routes/upload/wizard/UploadWizard.tsx
    - src/routes/upload/wizard/StepRepoPicker.tsx
    - src/routes/upload/wizard/StepFilePicker.tsx
    - src/routes/upload/wizard/StepReview.tsx
    - src/components/repos/CreateRepoSheet.tsx
  modified:
    - src/components/shell/AppShell.tsx
    - src/routes/models/ModelsPage.tsx
    - src/routes/datasets/DatasetsPage.tsx

key-decisions:
  - "CreateRepoSheet owned by StepRepoPicker (not UploadWizard) — step encapsulates its own sheet state"
  - "UploadWizard removes createSheetOpen after refactor — no duplicate sheet management"
  - "handleRepoCreated constructs a synthetic RepoItem for immediate auto-selection without waiting for query refetch"
  - "StepReview handles Upload button disabled state and loading spinner — not Navigation bar"

patterns-established:
  - "Wizard pattern: parent owns all cross-step state; steps are pure presentational with callbacks"
  - "Sheet pattern: Sheet component controlled via open/onOpenChange prop pair"
  - "File picker: deduplication always happens at merge time via Set of existing paths"

requirements-completed:
  - UPLD-06
  - REPO-02

duration: 6min
completed: 2026-03-19
---

# Phase 03 Plan 02: Upload Wizard and Create Repo Sheet Summary

**3-step upload wizard (repo picker, drag/browse file picker, review+enqueue) and CreateRepoSheet slide-out panel accessible from wizard step 1, ModelsPage, and DatasetsPage**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-19T18:05:46Z
- **Completed:** 2026-03-19T18:11:09Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- UploadWizard with numbered step indicator (dots + connecting lines), step validation, Back/Next navigation
- StepRepoPicker: All/Models/Datasets filter tabs, search input, scrollable repo list with type+private badges, Create New button
- StepFilePicker: drag zone (visual), Browse Files (single/multi), Browse Folder (recursive via readDir+stat), deduplication by path, file table with remove button
- StepReview: summary card (repo, file count, total size), required commit message, Upload button with loading state calling enqueueUpload per file
- CreateRepoSheet: name (lowercase/alphanumeric validation, live owner/name preview), type toggle, visibility toggle, license picker, description textarea
- "New Repository" button added to ModelsPage and DatasetsPage headers

## Task Commits

1. **Task 1: Upload wizard shell + UploadPage** - `3aa41a2` (feat)
2. **Task 2: CreateRepoSheet + wire into 3 locations** - `9ddaeb9` (feat)

## Files Created/Modified

- `src/routes/upload/UploadPage.tsx` - Container: shows wizard when no active uploads, queue placeholder when uploads exist; initializes monitoring on mount
- `src/routes/upload/wizard/UploadWizard.tsx` - 3-step wizard shell with step indicator and navigation buttons
- `src/routes/upload/wizard/StepRepoPicker.tsx` - Step 1: repo list with filter tabs, search, CreateRepoSheet integration
- `src/routes/upload/wizard/StepFilePicker.tsx` - Step 2: drag zone, Browse Files/Folder via Tauri dialog, file table, dedup by path
- `src/routes/upload/wizard/StepReview.tsx` - Step 3: summary card, commit message field, Upload button calling enqueueUpload
- `src/components/repos/CreateRepoSheet.tsx` - Slide-out panel from right with full repo creation form
- `src/components/shell/AppShell.tsx` - Import UploadPage and replace placeholder case
- `src/routes/models/ModelsPage.tsx` - Added CreateRepoSheet + "New Repository" button
- `src/routes/datasets/DatasetsPage.tsx` - Added CreateRepoSheet + "New Repository" button

## Decisions Made

- CreateRepoSheet is owned by StepRepoPicker (not UploadWizard) — each consumer manages its own sheet state, keeping UploadWizard from duplicating sheet logic
- `handleRepoCreated` constructs a synthetic `RepoItem` for immediate auto-selection without waiting for React Query refetch — the repo appears selected instantly
- StepReview owns its Upload button (not the wizard navigation bar) so the full-width button can be distinct from Back/Next
- UploadPage queue view is a placeholder div for Plan 03-03 (the queue UI plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refactored CreateRepoSheet ownership from UploadWizard to StepRepoPicker**

- **Found during:** Task 2 (acceptance criteria check)
- **Issue:** Initial implementation put CreateRepoSheet in UploadWizard and passed `onCreateNew` callback to StepRepoPicker, but acceptance criteria required `grep "CreateRepoSheet" src/routes/upload/wizard/StepRepoPicker.tsx` to match
- **Fix:** Moved sheetOpen state and CreateRepoSheet render into StepRepoPicker; removed from UploadWizard; removed `onCreateNew` prop; StepRepoPicker calls `onSelect` with synthetic RepoItem on creation
- **Files modified:** StepRepoPicker.tsx, UploadWizard.tsx
- **Verification:** All acceptance criteria grep checks pass; tests pass
- **Committed in:** 9ddaeb9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (structural adjustment to match acceptance criteria)
**Impact on plan:** Cleaner architecture — CreateRepoSheet co-located with the UI that triggers it.

## Issues Encountered

None - straightforward implementation following plan spec.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UploadPage queue placeholder is ready for Plan 03-03 to replace with the actual queue UI
- `startUploadMonitoring` and `listUploads` are called on UploadPage mount — Plan 03-03 can read from uploadStore
- CreateRepoSheet is reusable anywhere a repo creation action is needed

---
*Phase: 03-upload-ui-repo-management*
*Completed: 2026-03-19*
