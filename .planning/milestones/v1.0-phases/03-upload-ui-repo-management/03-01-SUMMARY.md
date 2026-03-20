---
phase: 03-upload-ui-repo-management
plan: 01
subsystem: ui
tags: [tauri-plugin-dialog, shadcn, zustand, tanstack-query, huggingface-hub, react]

requires:
  - phase: 02-upload-engine
    provides: "UploadJob, UploadProgress types, startUploadMonitoring, listUploads, enqueueUpload from src/commands/upload.ts"
  - phase: 01-foundation
    provides: "authStore, AppShell section routing, Tailwind v4 CSS theme, @huggingface/hub integration pattern"

provides:
  - "uploadStore.ts: Zustand store with jobs, progressMap, wizardOpen, wizardRepoId state"
  - "useRepoFiles.ts: TanStack Query hook wrapping @huggingface/hub listFiles"
  - "useCommitHistory.ts: TanStack Query hook wrapping @huggingface/hub listCommits"
  - "repos.ts: createRepoAction, deleteFileAction, deleteRepoAction command wrappers"
  - "repoUtils.ts: formatBytes, formatSpeed, formatEta utility functions"
  - "shadcn/ui components: dialog, sheet, progress, alert-dialog, tooltip, button"
  - "AppShell routing extended to 'upload' and 'repo-browser' sections"
  - "Sidebar Upload button activated (no longer disabled placeholder)"
  - "tauri-plugin-dialog registered in Cargo + capabilities"

affects:
  - "03-02-upload-queue-ui (uses uploadStore, shadcn components, AppShell upload section)"
  - "03-03-upload-wizard (uses uploadStore wizardOpen/wizardRepoId, dialog/sheet components)"
  - "03-04-repo-browser (uses useRepoFiles, useCommitHistory, FileTree.test.ts stubs)"
  - "03-05-repo-management (uses createRepoAction, deleteFileAction, deleteRepoAction, alert-dialog)"

tech-stack:
  added:
    - "@tauri-apps/plugin-dialog (npm + Cargo + capability)"
    - "tauri-plugin-dialog = 2 (Rust)"
    - "shadcn/ui base-nova style (components.json)"
    - "@base-ui/react (shadcn base-nova dependency)"
    - "class-variance-authority (shadcn dependency)"
  patterns:
    - "shadcn/ui components in src/components/ui/ using @/lib/utils cn() helper"
    - "TanStack Query hooks wrapping @huggingface/hub async generators"
    - "Zustand store with typed state + action methods (follows authStore pattern)"
    - "Repo command wrappers use useAuthStore.getState().token (non-reactive context)"

key-files:
  created:
    - src/stores/uploadStore.ts
    - src/queries/useRepoFiles.ts
    - src/queries/useCommitHistory.ts
    - src/commands/repos.ts
    - src/lib/repoUtils.ts
    - src/lib/utils.ts
    - src/components/ui/dialog.tsx
    - src/components/ui/sheet.tsx
    - src/components/ui/progress.tsx
    - src/components/ui/alert-dialog.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/button.tsx
    - src/lib/repoUtils.test.ts
    - src/stores/uploadStore.test.ts
    - src/routes/repo-browser/FileTree.test.ts
    - components.json
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json
    - package.json
    - package-lock.json
    - src/components/shell/AppShell.tsx
    - src/components/shell/Sidebar.tsx

key-decisions:
  - "shadcn init used --legacy-peer-deps for @vitejs/plugin-react v4 vs vite v8 peer dep conflict"
  - "shadcn base-nova style selected (Tailwind v4 CSS vars approach, no separate config file needed)"
  - "src/lib/utils.ts created with clsx + tailwind-merge cn() utility (required by all shadcn components)"
  - "@base-ui/react installed manually after shadcn init partially failed due to peer dep issues"
  - "Repo Browser nav item added to Sidebar for navigating to repo-browser section"

patterns-established:
  - "Pattern 1: TanStack Query hooks collect async generators into arrays (same as useModels/useDatasets)"
  - "Pattern 2: Command wrappers use useAuthStore.getState() for non-reactive token access outside React"
  - "Pattern 3: Zustand store initialized with setState for test isolation (beforeEach reset pattern)"

requirements-completed: [REPO-02, REPO-03, REPO-04, REPO-05]

duration: 5min
completed: 2026-03-19
---

# Phase 3 Plan 01: Foundation Layer Summary

**shadcn/ui components, Zustand upload store, TanStack Query repo hooks, and @huggingface/hub command wrappers with AppShell routing extended to upload and repo-browser sections**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-19T17:57:07Z
- **Completed:** 2026-03-19T18:01:53Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments
- Installed tauri-plugin-dialog (npm, Cargo, capabilities) for file picker support in Phase 3 features
- Initialized shadcn/ui with dialog, sheet, progress, alert-dialog, tooltip, button components using Tailwind v4 CSS vars (existing custom theme preserved)
- Created uploadStore with Zustand (jobs queue, progress map, wizard state) following Phase 1 authStore pattern
- Created useRepoFiles and useCommitHistory TanStack Query hooks using @huggingface/hub async generators
- Created repo command wrappers (createRepoAction, deleteFileAction, deleteRepoAction) with auth guard
- Created repoUtils.ts with formatBytes, formatSpeed, formatEta formatting utilities
- Extended AppShell routing to include 'upload' and 'repo-browser' sections with selectedRepoId state
- Activated Sidebar Upload button and added Repo Browser nav item (removed disabled placeholder)
- Added passing tests for repoUtils (7 tests) and uploadStore (2 tests), plus FileTree todo stubs (4 todos)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and initialize shadcn/ui** - `c1b030e` (chore)
2. **Task 2: Create uploadStore, query hooks, repo commands, and extend AppShell routing** - `d7b2ad3` (feat)
3. **Task 3: Create test stub files for Phase 3 units** - `59268ed` (test)

## Files Created/Modified
- `src/stores/uploadStore.ts` - Zustand store for upload queue UI state (jobs, progressMap, wizardOpen, wizardRepoId)
- `src/queries/useRepoFiles.ts` - TanStack Query hook wrapping @huggingface/hub listFiles async generator
- `src/queries/useCommitHistory.ts` - TanStack Query hook wrapping @huggingface/hub listCommits async generator
- `src/commands/repos.ts` - createRepoAction, deleteFileAction, deleteRepoAction using @huggingface/hub
- `src/lib/repoUtils.ts` - formatBytes, formatSpeed, formatEta utility functions
- `src/lib/utils.ts` - cn() utility (clsx + tailwind-merge) required by all shadcn components
- `src/components/ui/{dialog,sheet,progress,alert-dialog,tooltip,button}.tsx` - shadcn/ui components
- `components.json` - shadcn/ui configuration (base-nova style, Tailwind v4 CSS vars)
- `src-tauri/Cargo.toml` - Added tauri-plugin-dialog = "2"
- `src-tauri/src/lib.rs` - Added .plugin(tauri_plugin_dialog::init())
- `src-tauri/capabilities/default.json` - Added "dialog:default" permission
- `src/components/shell/AppShell.tsx` - Extended Section type, added selectedRepoId state, navigateToRepo callback
- `src/components/shell/Sidebar.tsx` - Activated Upload button, added Repo Browser nav item
- `src/lib/repoUtils.test.ts` - 7 passing tests for formatting utilities
- `src/stores/uploadStore.test.ts` - 2 passing tests for store mutations
- `src/routes/repo-browser/FileTree.test.ts` - 4 todo stubs for future buildTree implementation

## Decisions Made
- shadcn init required `--legacy-peer-deps` workaround due to @vitejs/plugin-react v4 vs vite v8 peer dep conflict — applied automatically (Rule 3: blocking issue)
- shadcn base-nova style uses @base-ui/react which was not auto-installed during partial init failure; installed manually
- Created `src/lib/utils.ts` with cn() utility (not in original plan files list) — required by all shadcn components importing from "@/lib/utils"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created src/lib/utils.ts for shadcn cn() utility**
- **Found during:** Task 1 (shadcn component installation)
- **Issue:** All shadcn components import `cn` from "@/lib/utils" but file didn't exist — build would fail
- **Fix:** Created src/lib/utils.ts with clsx + tailwind-merge cn() function
- **Files modified:** src/lib/utils.ts
- **Verification:** npm run build passes
- **Committed in:** c1b030e (Task 1 commit)

**2. [Rule 3 - Blocking] Installed @base-ui/react manually after partial shadcn init failure**
- **Found during:** Task 1 (post-shadcn-add build verification)
- **Issue:** shadcn base-nova style depends on @base-ui/react but init script failed before installing it
- **Fix:** npm install @base-ui/react --legacy-peer-deps
- **Files modified:** package.json, package-lock.json
- **Verification:** npm run build passes
- **Committed in:** c1b030e (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added navigateToRepo callback and Repo Browser nav to Sidebar**
- **Found during:** Task 2 (AppShell/Sidebar extension)
- **Issue:** Plan specified adding Upload button but Repo Browser nav item was implied by Section type extension — without it users can't navigate to repo-browser section
- **Fix:** Added FolderOpen icon and Repo Browser nav button to Sidebar; added onNavigateToRepo prop for recent repo deep-linking
- **Files modified:** src/components/shell/Sidebar.tsx
- **Verification:** Build passes, Sidebar no longer has "Coming soon" text
- **Committed in:** d7b2ad3 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking - missing utils.ts, 1 blocking - missing @base-ui/react, 1 missing critical - Repo Browser nav)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- shadcn init script failed mid-execution due to @vitejs/plugin-react peer dep conflicts with vite v8. Worked around by using `--legacy-peer-deps` for npm installs and running shadcn add separately. All components installed successfully.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation layer complete — Plans 02-05 can build upon uploadStore, query hooks, and repo commands
- shadcn/ui components available for dialogs, sheets, and progress bars
- AppShell routing supports 'upload' and 'repo-browser' sections with placeholder content
- Test scaffolding in place for units with business logic

---
*Phase: 03-upload-ui-repo-management*
*Completed: 2026-03-19*
