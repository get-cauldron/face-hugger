---
phase: 06-polish-tech-debt
plan: "02"
subsystem: upload-ui, auth, repo-browser, store
tags: [bug-fix, tech-debt, UPLD-07, type-cleanup, dead-code]
dependency_graph:
  requires: []
  provides: [UPLD-07-fix, clean-auth-flow, clean-upload-store]
  affects: [src/routes/upload/MiniRepoPicker.tsx, src/stores/uploadStore.ts, src/App.tsx, src/components/auth/LoginScreen.tsx]
tech_stack:
  added: []
  patterns: [immediate-store-update-after-enqueue, zustand-setJobs, rust-side-event-listener]
key_files:
  created: []
  modified:
    - src/routes/upload/MiniRepoPicker.tsx
    - src/stores/uploadStore.ts
    - src/stores/uploadStore.test.ts
    - src/App.tsx
    - src/components/auth/LoginScreen.tsx
    - src/routes/repo-browser/FileActions.tsx
    - src-tauri/src/tray.rs
decisions:
  - "UPLD-07: listUploads() called immediately after enqueue loop; setJobs() pushes result into store — no polling delay"
  - "wizardRepoId removed: dead code from abandoned drag-drop pre-selection feature; never read or written by any component"
  - "['models']/['datasets'] invalidation removed: ['repos'] prefix already matches all repo queries via React Query prefix matching"
metrics:
  duration: "2min"
  completed: "2026-03-19"
  tasks: 2
  files: 7
---

# Phase 06 Plan 02: Tech Debt Cleanup + UPLD-07 Queue Refresh Fix Summary

**One-liner:** Immediate queue refresh after drag-drop enqueue via listUploads()/setJobs(), plus 6 targeted tech debt removals (type casts, dead wizardRepoId, wrong invalidation keys, misleading tray comment).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix drag-drop queue refresh delay (UPLD-07) | 09bbcdd | src/routes/upload/MiniRepoPicker.tsx |
| 2 | Clean up tech debt (type casts, dead code, wrong keys, comment) | a930c79 | App.tsx, LoginScreen.tsx, FileActions.tsx, uploadStore.ts, uploadStore.test.ts, tray.rs |

## What Was Built

### Task 1: UPLD-07 Queue Refresh Fix

After a user drag-drops files onto the app and confirms in MiniRepoPicker, the queue view previously did not show the newly enqueued jobs until the next 500ms progress monitor fire. The fix adds an immediate `listUploads()` call after the enqueue loop and pushes the result into the Zustand store via `setJobs()`, so the queue view updates instantly.

### Task 2: Six Tech Debt Items

1. **src/App.tsx** — Removed `as any` cast on `setAuth(token, userInfo as any)`. `validateToken` already returns `Promise<UserInfo>`; the cast was unnecessary and suppressed type checking.

2. **src/components/auth/LoginScreen.tsx** — Removed `as unknown as UserInfo` double casts in both the OAuth callback path and the token paste path. Both `oauthExchangeCode` and `validateToken` return `Promise<UserInfo>`, matching the expected types.

3. **src/routes/repo-browser/FileActions.tsx** — Removed two dead `invalidateQueries` calls for `['models']` and `['datasets']`. React Query's prefix matching means `['repos']` already invalidates `['repos', 'models', user]` and `['repos', 'datasets', user]`. The standalone `['models']` and `['datasets']` keys matched nothing.

4. **src/stores/uploadStore.ts** — Removed `wizardRepoId: string | null` and `setWizardRepoId` from interface and store implementation. These were never read or written by any component — dead code from an abandoned drag-drop pre-selection approach.

5. **src/stores/uploadStore.test.ts** — Removed `wizardRepoId: null` from the `beforeEach` reset state to match the updated store interface.

6. **src-tauri/src/tray.rs** — Fixed misleading comment on the "pause" tray menu handler. The old comment said "The frontend's upload monitoring hook listens for this and calls pause_all_uploads" which was wrong — `lib.rs` handles `tray-pause-all` in Rust via `app.listen`. The new comment accurately says "Handled by Rust listener in lib.rs setup (not frontend) so pausing works even when the window is hidden."

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript compiles without errors: `npx tsc --noEmit` — PASS
- Rust compiles without errors: `cargo check` — PASS (Finished dev profile in 1.64s)
- No `as any` in App.tsx — PASS
- No `as unknown as UserInfo` in LoginScreen.tsx — PASS
- No `['models']` or `['datasets']` query keys in FileActions.tsx — PASS
- No `wizardRepoId` in uploadStore.ts — PASS
- MiniRepoPicker imports and calls listUploads + setJobs after enqueue — PASS
- tray.rs comment says "Rust listener" not "frontend" — PASS

## Self-Check: PASSED

Files exist:
- src/routes/upload/MiniRepoPicker.tsx: FOUND (modified)
- src/stores/uploadStore.ts: FOUND (modified)
- src/App.tsx: FOUND (modified)
- src/components/auth/LoginScreen.tsx: FOUND (modified)
- src/routes/repo-browser/FileActions.tsx: FOUND (modified)
- src-tauri/src/tray.rs: FOUND (modified)

Commits exist:
- 09bbcdd: feat(06-02): fix drag-drop queue refresh delay (UPLD-07)
- a930c79: fix(06-02): clean up tech debt (type casts, dead code, wrong keys, comment)
