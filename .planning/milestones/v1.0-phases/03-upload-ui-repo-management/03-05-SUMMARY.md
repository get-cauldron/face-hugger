---
phase: 03-upload-ui-repo-management
plan: 05
subsystem: ui
tags: [react, huggingface-hub, tanstack-query, tailwind, commit-history, revert]

# Dependency graph
requires:
  - phase: 03-01
    provides: useCommitHistory hook, CommitData type, useRepoFiles hook, authStore
  - phase: 03-04
    provides: RepoBrowserPage container with Files/History tabs (created here as blocking auto-fix)
provides:
  - Commit history timeline with vertical layout, expand/collapse, author, date, OID copy
  - Revert (safe) — creates new commit matching target revision via computeRevertDiff + executeRevert
  - Restore (destructive-looking) — same logic but requires typed repo name confirmation
  - RepoBrowserPage with Files/History tabs wired into AppShell
affects: [03-04, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Revert-as-forward-commit: use listFiles at two revisions to diff, then commit() with add/delete operations"
    - "Server-side URL resolution: pass HF CDN URL as content to hub commit() — no client-side download of large files"
    - "Dialog co-location: RevertCommitDialog and RestoreVersionDialog in one file, CommitRow imports both"

key-files:
  created:
    - src/routes/repo-browser/CommitTimeline.tsx
    - src/routes/repo-browser/CommitRow.tsx
    - src/routes/repo-browser/RevertDialog.tsx
    - src/routes/repo-browser/revertUtils.ts
    - src/routes/repo-browser/RepoBrowserPage.tsx
  modified:
    - src/components/shell/AppShell.tsx

key-decisions:
  - "RepoBrowserPage created in 03-05 as blocking auto-fix — 03-04 not executed, but 03-05 requires it"
  - "Server-side URL resolution for file content in revert operations — avoids downloading large model files client-side"
  - "Restore uses same logic as Revert (squash-forward via new commit) — per research recommendation"
  - "Typed repo name match uses short name (after last slash) to handle org/repo format"

patterns-established:
  - "relativeTime() helper inline in CommitRow — no date library dependency for simple relative timestamps"
  - "onBack() passed through AppShell ContentArea as prop to allow section navigation from child pages"

requirements-completed: [REPO-05, REPO-06]

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 03 Plan 05: Commit History Timeline and Rollback Summary

**Vertical commit timeline with expand/collapse showing message, date, author, OID — plus Revert (safe) and Restore (typed-name confirmation) that create new commits via huggingface/hub operations**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-19T18:14:11Z
- **Completed:** 2026-03-19T18:22:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Commit history timeline renders all commits from useCommitHistory with loading skeletons and empty state
- Expanding a commit reveals full message, "Revert to this" and "Restore to this version" action buttons
- computeRevertDiff() diffs file trees at two revisions; executeRevert() creates a forward commit using HF CDN URLs as content sources (no large file downloads)
- RestoreVersionDialog requires typing the repo's short name before enabling the confirm button
- RepoBrowserPage (Files/History tabs) and AppShell wired with proper back navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Build commit history timeline with expandable commit details** - `b87ea5f` (feat)
2. **Task 2: Implement revert and restore with confirmation dialogs** - `ef95aa6` (feat)

## Files Created/Modified

- `src/routes/repo-browser/CommitTimeline.tsx` - Vertical timeline using useCommitHistory, loading/empty states
- `src/routes/repo-browser/CommitRow.tsx` - Single commit row with expand/collapse, date formatting, OID copy, action buttons
- `src/routes/repo-browser/RevertDialog.tsx` - RevertCommitDialog and RestoreVersionDialog with invalidateQueries
- `src/routes/repo-browser/revertUtils.ts` - computeRevertDiff (listFiles at two revisions) and executeRevert (commit with operations)
- `src/routes/repo-browser/RepoBrowserPage.tsx` - Files/History tab container
- `src/components/shell/AppShell.tsx` - Import RepoBrowserPage, wire repo-browser section with onBack handler

## Decisions Made

- RepoBrowserPage created here as a blocking prerequisite since 03-04 was not yet executed — minimal implementation with Files tab placeholder and History tab wired to CommitTimeline
- Server-side URL resolution pattern: `new URL('https://huggingface.co/.../resolve/{oid}/{path}')` passed as content to hub's commit() — the hub library fetches file content server-side during commit, so no large file data transfers on the client
- Restore uses identical revert logic (squash-forward new commit) per research recommendation; destructive appearance communicated through red button and typed-name confirmation gate
- Short repo name for typed confirmation: extracts `name.split('/').pop()` to handle `org/repo` format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created RepoBrowserPage.tsx — prerequisite not yet built**
- **Found during:** Task 1 (wiring CommitTimeline into RepoBrowserPage)
- **Issue:** 03-04-PLAN.md was not executed; RepoBrowserPage.tsx did not exist, blocking integration
- **Fix:** Created minimal RepoBrowserPage.tsx with Files (placeholder) and History (CommitTimeline) tabs; updated AppShell to import and render it
- **Files modified:** src/routes/repo-browser/RepoBrowserPage.tsx, src/components/shell/AppShell.tsx
- **Verification:** grep "CommitTimeline" returns match; tests pass
- **Committed in:** b87ea5f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking prerequisite)
**Impact on plan:** Minimal scope addition — RepoBrowserPage is the container required by the plan; Files tab left as placeholder for 03-04 to complete.

## Issues Encountered

None — all planned work executed without unexpected errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Commit history timeline and rollback functionality complete (REPO-05, REPO-06)
- RepoBrowserPage exists and is wired into AppShell — 03-04 can now complete the Files tab and file deletion dialogs
- revertUtils.ts pure functions are ready for unit testing if needed

---
*Phase: 03-upload-ui-repo-management*
*Completed: 2026-03-19*
