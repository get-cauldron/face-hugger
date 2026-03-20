---
phase: 04-secondary-features-distribution
plan: "04"
subsystem: distribution
tags: [ci, github-actions, auto-update, tauri-updater, release]
dependency_graph:
  requires: [04-02, 04-03]
  provides: [release-pipeline, auto-update-banner]
  affects: [tauri.conf.json, AppShell]
tech_stack:
  added: [tauri-apps/tauri-action@v0, @tauri-apps/plugin-process]
  patterns: [matrix-build, updater-plugin, conditional-banner]
key_files:
  created:
    - .github/workflows/release.yml
    - src/components/UpdateBanner.tsx
  modified:
    - src-tauri/tauri.conf.json
    - src/components/shell/AppShell.tsx
    - src/bindings.ts
decisions:
  - "createUpdaterArtifacts uses boolean true (not string 'v2Compatible') in Tauri v2 final release"
  - "UpdateBanner uses downloadAndInstall() + relaunch() from separate @tauri-apps/plugin-process"
  - "TAURI_CHANNEL stub type removed from bindings.ts — conflicts with import alias from @tauri-apps/api/core"
metrics:
  duration: "~5min"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 5
---

# Phase 04 Plan 04: Distribution + Auto-Update Summary

GitHub Actions cross-platform release workflow with code signing config and conditional auto-update banner using `@tauri-apps/plugin-updater`.

## Tasks Completed

### Task 1: GitHub Actions release workflow and tauri.conf.json updater config

- Created `.github/workflows/release.yml` with matrix builds: macOS arm64, macOS x86_64, Ubuntu 22.04, Windows
- Workflow creates draft release, builds signed artifacts via `tauri-apps/tauri-action@v0`, publishes on all-builds-success
- Configured `TAURI_SIGNING_PRIVATE_KEY`, `APPLE_CERTIFICATE`, and all macOS notarization secrets
- Updated `tauri.conf.json` with `createUpdaterArtifacts: true`, updater plugin config with placeholder pubkey and endpoint pointing to GitHub releases, and Linux deb dependency for libayatana-appindicator3-1

Commit: `3359ddd feat(04-04): GitHub Actions release workflow and tauri.conf.json updater config`

### Task 2: UpdateBanner component and integration into AppShell

- Created `src/components/UpdateBanner.tsx` that calls `check()` on mount, shows "Version X.Y.Z is available" with "Update now" and "Dismiss" buttons
- "Update now" triggers `downloadAndInstall()` + `relaunch()`, shows "Downloading..." state while in progress
- Dismiss hides banner for session (state-only, no persistence)
- Integrated UpdateBanner into AppShell `<main>` before content area with `flex flex-col` layout

Commit: `0e2b6ab feat(04-04): UpdateBanner component and AppShell integration`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] createUpdaterArtifacts string value rejected by Tauri v2**
- **Found during:** Task 1 post-commit
- **Issue:** Plan specified `"v2Compatible"` string; Tauri v2 final release requires `true` boolean
- **Fix:** Changed to `"createUpdaterArtifacts": true`
- **Commits:** `554cdaa`, `1a6cff3`

**2. [Rule 1 - Bug] TAURI_CHANNEL duplicate declaration in bindings.ts**
- **Found during:** Build verification
- **Issue:** `export type TAURI_CHANNEL<TSend> = null` stub at line 208 conflicted with `Channel as TAURI_CHANNEL` import at line 229 — TS2440 error prevented build
- **Fix:** Removed stub; real `Channel` type from `@tauri-apps/api/core` is the correct implementation
- **Commit:** `0b5ab3a`

## Self-Check

- [x] `.github/workflows/release.yml` exists
- [x] `src/components/UpdateBanner.tsx` exists with all required content
- [x] `src-tauri/tauri.conf.json` contains `createUpdaterArtifacts`, `updater`, `pubkey`, `endpoints`, `libayatana-appindicator3-1`
- [x] `src/components/shell/AppShell.tsx` imports and renders `UpdateBanner`
- [x] `npm run build` exits 0

## Self-Check: PASSED
