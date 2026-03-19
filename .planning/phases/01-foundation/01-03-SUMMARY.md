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
metrics:
  duration: "~20min"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_created: 10
  files_modified: 3
---

# Phase 01 Plan 03: Repo Listing Feature Summary

**One-liner:** TanStack Query hooks for HF models/datasets with card/table views, client-side search/filter/sort, tauri-plugin-store preference persistence, and recent repos in sidebar.

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

## Checkpoint Pending

**Task 2** (human-verify) requires manual end-to-end verification with a real HF token. The app builds successfully and is ready to run with `npm run tauri dev`.

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
