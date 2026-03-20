---
phase: 01-foundation
plan: "03"
subsystem: repo-listing
tags: [tanstack-query, huggingface-hub, tauri-plugin-store, react, preferences, ui-components]
dependency_graph:
  requires: ["01-02"]
  provides: ["REPO-01", "repo-display-components", "preference-persistence", "models-page", "datasets-page", "settings-page"]
  affects: ["AppShell", "Sidebar", "ModelsPage", "DatasetsPage", "SettingsPage"]
tech_stack:
  added: ["@testing-library/dom (peer dep for @testing-library/react)"]
  patterns:
    - "TanStack Query v5 hooks wrapping @huggingface/hub async iterators"
    - "tauri-plugin-store for preference persistence via getPreference/setPreference"
    - "Client-side filter+sort applied on query result (useMemo)"
    - "Preference load on mount (useEffect), persist on change (useEffect with guard flag)"
    - "Recent repo tracking via setPreference recentModels/recentDatasets arrays (last 5)"
key_files:
  created:
    - src/queries/useRepos.ts
    - src/lib/preferences.ts
    - src/components/repos/RepoCard.tsx
    - src/components/repos/RepoGrid.tsx
    - src/components/repos/RepoTable.tsx
    - src/components/repos/RepoEmptyState.tsx
    - src/components/repos/RepoListToolbar.tsx
    - src/routes/models/ModelsPage.tsx
    - src/routes/datasets/DatasetsPage.tsx
    - src/routes/settings/SettingsPage.tsx
  modified:
    - src/queries/useRepos.test.ts
    - src/components/shell/AppShell.tsx
    - src/components/shell/Sidebar.tsx
decisions:
  - "Use additionalFields: ['tags'] only — private/downloads/likes/lastModified already in base ModelEntry/DatasetEntry"
  - "Use updatedAt (Date) from ModelEntry rather than lastModified string — convert to ISO on collection"
  - "openUrl() from @tauri-apps/plugin-opener, not open() — per actual plugin export"
  - "Install @testing-library/dom as dev dependency — required peer for @testing-library/react waitFor"
key-decisions:
  - "Use additionalFields: ['tags'] only — private/downloads/likes/lastModified already in base ModelEntry/DatasetEntry"
  - "openUrl() from @tauri-apps/plugin-opener, not open() — per actual plugin export"
  - "tauri-controls replaced with custom titlebar — incompatible with React 19"
  - "model.name used directly from @huggingface/hub instead of splitting id — avoids hash display bug"
  - "Result<T,E> objects from tauri-specta unwrapped before returning to JS — validated at auth command layer"
  - "Tailwind v4 var() arbitrary values replaced with semantic utility classes throughout"

requirements-completed: [REPO-01]

metrics:
  duration: "~45min"
  completed_date: "2026-03-19"
  tasks_completed: 3
  files_created: 10
  files_modified: 3
---

# Phase 01 Plan 03: Repo Listing Feature Summary

**TanStack Query hooks for HF models/datasets with card/table views, client-side search/filter/sort, tauri-plugin-store preference persistence, recent repos in sidebar, and four bugs fixed during human verification**

## What Was Built

**Data layer (`src/queries/useRepos.ts`):** `useModels` and `useDatasets` hooks wrap `@huggingface/hub` `listModels`/`listDatasets` async iterators. Each hook reads `user.name` and `token` from `useAuthStore`, requests `additionalFields: ['tags']` (other fields like private/downloads/likes are in the base entry), and collects results into `RepoItem[]` arrays. `staleTime: 5min`, `enabled` guard on auth state.

**Preference persistence (`src/lib/preferences.ts`):** `getPreference<T>(key, default)` and `setPreference<T>(key, value)` wrap `@tauri-apps/plugin-store`. Silently falls back to defaults on error — preference persistence is not critical to app function.

**Display components:**
- `RepoCard.tsx` — card with repo name, model/dataset type badge, public/private visibility badge, downloads + likes stats, relative time, up to 4 tags with "+N more"
- `RepoGrid.tsx` — responsive CSS grid (1/2/3 cols) of RepoCards
- `RepoTable.tsx` — dense 5-column list (Name, Type, Visibility, Downloads, Last Modified)
- `RepoEmptyState.tsx` — centered Package icon, friendly copy, "Create" CTA via `openUrl('https://huggingface.co/new')`
- `RepoListToolbar.tsx` — search input with Search icon, Sort dropdown, Visibility filter dropdown, Grid/Table toggle buttons

**Page routes:**
- `ModelsPage.tsx` + `DatasetsPage.tsx` — load saved prefs on mount, persist on change (with `prefsLoaded` guard to avoid writing defaults before reading), client-side filter+sort via `useMemo`, skeleton loading (6 placeholder cards), error message, empty state, grid/table conditional render, recent repo tracking on card click
- `SettingsPage.tsx` — user avatar (with initial fallback), username/fullname/email, token keychain notice, theme placeholder, logout button

**Shell updates:**
- `AppShell.tsx` — replaces placeholder divs with real page components, passes `activeSection` to Sidebar
- `Sidebar.tsx` — now accepts `activeSection` + `onSectionChange` props, loads recent models/datasets from preferences on mount, renders up to 5 recent items per section as `text-xs` clickable rows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `additionalFields` type error in `@huggingface/hub` calls**
- **Found during:** Task 1a
- **Issue:** Plan specified `additionalFields: ['private', 'downloads', 'lastModified', 'tags', 'likes']` but the `@huggingface/hub` v2.11.0 type definition excludes fields that are already in the base `ModelEntry`/`DatasetEntry` (private, downloads, likes, lastModified are in `MODEL_EXPAND_KEYS` and always returned). The `additionalFields` type only accepts `Exclude<expandable, already_expanded>`.
- **Fix:** Changed to `additionalFields: ['tags']`. Access base fields directly from the entry; use `model.updatedAt.toISOString()` instead of `model.lastModified`.
- **Files modified:** `src/queries/useRepos.ts`
- **Commit:** b435664

**2. [Rule 1 - Bug] Fixed `open()` import from `@tauri-apps/plugin-opener`**
- **Found during:** Task 1a
- **Issue:** Plan used `import { open } from '@tauri-apps/plugin-opener'` but the actual plugin exports `openUrl` not `open`.
- **Fix:** Changed to `import { openUrl } from '@tauri-apps/plugin-opener'` and updated call site.
- **Files modified:** `src/components/repos/RepoEmptyState.tsx`
- **Commit:** b435664

**3. [Rule 1 - Bug] Fixed `user_type` field name in test mock**
- **Found during:** Task 1a
- **Issue:** Plan's test code used `user_type: null` in UserInfo mock but `src/lib/types.ts` defines the field as `type` (not `user_type`) per the STATE.md decision recorded in Plan 02.
- **Fix:** Changed test mock to use `type: null`.
- **Files modified:** `src/queries/useRepos.test.ts`
- **Commit:** b435664

**4. [Rule 3 - Blocking] Installed `@testing-library/dom` peer dependency**
- **Found during:** Task 1a verification
- **Issue:** `@testing-library/react` re-exports `waitFor` from `@testing-library/dom` but the dom package was not installed, causing TypeScript error: `Module '@testing-library/react' has no exported member 'waitFor'`.
- **Fix:** `npm install -D @testing-library/dom --legacy-peer-deps`
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** b435664

## Test Results

3/3 tests passing in `src/queries/useRepos.test.ts`:
- `useModels > should not fetch when user is not authenticated`
- `useModels > should fetch models for the authenticated user`
- `useDatasets > should fetch datasets for the authenticated user`

## Build Status

`npm run build` passes — 1818 modules transformed, no errors.

## Verification Outcome (Task 2 — Checkpoint Approved)

User ran the full end-to-end verification with a real HF token. Four bugs were found and fixed in commit `dbc191e`:

### Bugs Fixed During Verification

**5. [Rule 1 - Bug] Replaced tauri-controls with custom titlebar (React 19 incompatibility)**
- **Found during:** Task 2 (human verification — app crashed on launch)
- **Issue:** `tauri-controls` npm package incompatible with React 19 — caused crash on startup
- **Fix:** Removed `tauri-controls`; implemented custom titlebar component using Tauri v2 window APIs directly
- **Files modified:** `src/components/shell/AppShell.tsx`
- **Committed in:** dbc191e

**6. [Rule 1 - Bug] Fixed tauri-specta Result<T,E> unwrapping in auth commands**
- **Found during:** Task 2 (human verification — login failed silently)
- **Issue:** tauri-specta wraps return values in `{ status: "ok", data: T }` objects; calling code was treating the wrapper as the value, so token validation never surfaced user info
- **Fix:** Added `.data` unwrapping at the command wrapper layer for `validate_token` and `get_stored_token`
- **Files modified:** Command binding/wrapper layer
- **Committed in:** dbc191e

**7. [Rule 1 - Bug] Fixed Tailwind v4 var() arbitrary values not resolving**
- **Found during:** Task 2 (human verification — theme colors not applying)
- **Issue:** Tailwind v4 changed CSS custom property arbitrary value resolution; `bg-[var(--color-primary)]` classes were not applying
- **Fix:** Replaced `var()` arbitrary values with semantic utility classes (`bg-primary`, `text-foreground`, etc.) throughout affected components
- **Files modified:** Multiple component files
- **Committed in:** dbc191e

**8. [Rule 1 - Bug] Fixed repo names displaying as hashes**
- **Found during:** Task 2 (human verification — model names showed as hash strings)
- **Issue:** Splitting `model.id` on `/` produced incorrect results for some repo ID formats; @huggingface/hub exposes `model.name` directly
- **Fix:** Switched to `model.name` directly from API response
- **Files modified:** `src/queries/useRepos.ts`
- **Committed in:** dbc191e

**Checkpoint approved** — User confirmed the full Phase 1 experience works. Design feedback will come later but the plan is approved.

## Task Commits

1. **Task 1a: TanStack Query hooks, preference persistence, base display components** — `b435664`
2. **Task 1b: Page routes, toolbar, AppShell wiring, recent repos** — `be7f8f0`
3. **Task 2: Human verification + bug fixes** — `dbc191e`

**Plan metadata (pre-checkpoint):** `0e876ef`

## Self-Check: PASSED

Key files verified present:
- src/queries/useRepos.ts: EXISTS
- src/lib/preferences.ts: EXISTS
- src/components/repos/RepoCard.tsx: EXISTS
- src/components/repos/RepoGrid.tsx: EXISTS
- src/components/repos/RepoTable.tsx: EXISTS
- src/components/repos/RepoEmptyState.tsx: EXISTS
- src/components/repos/RepoListToolbar.tsx: EXISTS
- src/routes/models/ModelsPage.tsx: EXISTS
- src/routes/datasets/DatasetsPage.tsx: EXISTS
- src/routes/settings/SettingsPage.tsx: EXISTS
- src/components/shell/AppShell.tsx: UPDATED
- src/components/shell/Sidebar.tsx: UPDATED

Commits verified:
- b435664: feat(01-03): TanStack Query hooks, preference persistence, repo display components
- be7f8f0: feat(01-03): page routes, toolbar, AppShell wiring, recent repos in sidebar
- dbc191e: fix(01-03): fix tauri-controls React 19 crash, Result unwrapping, Tailwind v4 theme classes, and repo name display

## Next Phase Readiness

- Full Phase 1 foundation complete: auth, AppShell, repo listing, preferences, navigation
- Phase 2 (upload) can begin; auth store and HF token are available for upload commands
- Xet CAS upload protocol documentation gap remains a known blocker for Phase 2 planning (noted in STATE.md)

---
*Phase: 01-foundation*
*Completed: 2026-03-19*
