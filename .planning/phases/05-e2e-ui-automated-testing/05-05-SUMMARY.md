---
phase: 05-e2e-ui-automated-testing
plan: "05"
subsystem: native-testing
tags: [tauri-driver, webdriverio, native-tests, ci, tray, window-management]
dependency_graph:
  requires: ["05-01", "05-04"]
  provides: [native-test-infrastructure, tauri-driver-ci-integration]
  affects: [.github/workflows/test.yml, tests/native/]
tech_stack:
  added: [webdriverio@9, "@wdio/cli@9", "@wdio/mocha-framework@9"]
  patterns: [tauri-driver-webdriver, xvfb-headless, platform-conditional-ci]
key_files:
  created:
    - tests/native/package.json
    - tests/native/wdio.conf.js
    - tests/native/specs/tray.spec.js
    - tests/native/specs/window.spec.js
  modified:
    - .github/workflows/test.yml
key_decisions:
  - "tauri:options.application uses path.resolve for cross-platform binary path"
  - "wdio.conf.js uses onPrepare/onComplete hooks (not services array) to spawn tauri-driver"
  - "Tray tests validate DOM reachability not OS tray icon -- WebDriver cannot query OS tray state directly"
  - "webkit2gtk-driver installed as separate apt step on Ubuntu (not bundled with libwebkit2gtk)"
metrics:
  duration: 2min
  completed: "2026-03-19"
  tasks_completed: 2
  files_changed: 5
---

# Phase 05 Plan 05: Native Test Infrastructure (tauri-driver) Summary

**One-liner:** tauri-driver WebdriverIO test suite with tray and window specs, integrated into CI for Linux/Windows (macOS excluded per RESEARCH.md Pitfall 2).

## What Was Built

WebdriverIO-based native test infrastructure targeting the compiled Tauri binary via `tauri-driver`. The setup provides two spec files covering system tray launch validation and window management, with full CI integration that conditionally skips native tests on macOS.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create WebdriverIO config and native test specs | 2c584ce | tests/native/package.json, wdio.conf.js, tray.spec.js, window.spec.js |
| 2 | Add native test steps to CI workflow | b18a9fc | .github/workflows/test.yml |

## Key Files

- `/Users/zakkeown/Code/face-hugger/tests/native/package.json` — Separate Node project for WebdriverIO with @wdio/cli, mocha framework, spec reporter
- `/Users/zakkeown/Code/face-hugger/tests/native/wdio.conf.js` — WebdriverIO config with tauri:options pointing to `src-tauri/target/release/face-hugger[.exe]`; spawns tauri-driver in onPrepare/onComplete lifecycle hooks
- `/Users/zakkeown/Code/face-hugger/tests/native/specs/tray.spec.js` — Validates app launches with tray support (DOM root present, WebView responds)
- `/Users/zakkeown/Code/face-hugger/tests/native/specs/window.spec.js` — Validates window dimensions (>400x300), login screen rendered on fresh launch
- `/Users/zakkeown/Code/face-hugger/.github/workflows/test.yml` — Added tauri-driver install, debug binary build, webkit2gtk-driver install, and platform-conditional test steps

## Architecture Notes

The `wdio.conf.js` uses `path.resolve(__dirname, '../../src-tauri/target/release', binaryName)` with a `process.platform === 'win32'` check to construct the correct binary path on each platform. `tauri-driver` is spawned in the `onPrepare` hook and killed in `onComplete`, following the WebdriverIO lifecycle pattern.

Tray integration tests cannot directly query OS-level tray icon state via WebDriver. Instead they verify the app launched successfully (WebView renders, DOM root exists), which confirms `setup_tray()` in `lib.rs` ran without error. More granular tray menu interaction tests would require platform-specific automation outside WebDriver scope.

## CI Integration

Native tests run only on `ubuntu-22.04` and `windows-latest`. macOS is excluded via `if: matrix.platform != 'macos-latest'` conditions throughout. Ubuntu requires:
1. `webkit2gtk-driver` (separate apt package from `libwebkit2gtk-4.1-dev`)
2. `xvfb-run` prefix for headless execution

The debug binary build uses `npx tauri build --debug` which is faster than release while producing a functional binary for integration testing. The `TAURI_SIGNING_PRIVATE_KEY` secret is passed because the build bundle config requires it even in debug mode.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] tests/native/package.json exists
- [x] tests/native/wdio.conf.js exists (contains "tauri:options")
- [x] tests/native/specs/tray.spec.js exists (contains "tray")
- [x] tests/native/specs/window.spec.js exists (contains "window")
- [x] .github/workflows/test.yml contains "tauri-driver" (3 occurrences)
- [x] .github/workflows/test.yml contains "xvfb-run" (1 occurrence)
- [x] .github/workflows/test.yml contains "test:native" (2 occurrences)
- [x] Commit 2c584ce exists (native test files)
- [x] Commit b18a9fc exists (CI workflow update)
