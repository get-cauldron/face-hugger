---
phase: 05-e2e-ui-automated-testing
plan: 01
subsystem: test-infrastructure
tags: [playwright, msw, vitest, e2e, fixtures, ipc-mock]
dependency_graph:
  requires: []
  provides: [playwright-config, msw-vitest, ipc-mock-map, test-fixture-data, e2e-smoke-test]
  affects: [all-subsequent-05-plans]
tech_stack:
  added: ["@playwright/test@1.58.2", "msw@2.12.13", "chromium-headless-shell@145"]
  patterns: [msw-v2-node-server, playwright-addInitScript-tauri-mock, vitest-exclude-e2e]
key_files:
  created:
    - playwright.config.ts
    - tests/fixtures/mocks/handlers.ts
    - tests/fixtures/mocks/node.ts
    - tests/fixtures/mocks/setup.ts
    - tests/fixtures/mocks/ipc.ts
    - tests/fixtures/data/users.ts
    - tests/fixtures/data/repos.ts
    - tests/fixtures/data/datasets.ts
    - tests/e2e/smoke.spec.ts
  modified:
    - vitest.config.ts
    - package.json
decisions:
  - "MSW v2 http.* syntax (not rest.*) — v2 breaking API; must use http.get() and HttpResponse.json()"
  - "setupTauriMocks serializes handler return values at call-site rather than passing functions — addInitScript runs in isolated browser context where closures cannot capture Node.js scope"
  - "vitest.config.ts exclude: ['tests/e2e/**'] — Vitest globbed Playwright spec and failed on test.beforeEach(); must explicitly exclude E2E dir"
metrics:
  duration: 3min
  tasks_completed: 3
  files_created: 9
  files_modified: 2
  completed_date: "2026-03-20"
---

# Phase 05 Plan 01: Test Infrastructure Setup Summary

**One-liner:** Playwright 1.58.2 + MSW v2 + Tauri IPC mock via addInitScript with shared fixture data and a passing smoke E2E test.

## What Was Built

Full automated test infrastructure for the Face Hugger Tauri desktop app:

1. **Playwright** installed with Chromium, configured to target the Vite dev server at `localhost:1420` with `reuseExistingServer: !process.env.CI` for local iteration speed.

2. **MSW v2** configured for Vitest via `msw/node` `setupServer`. Handlers cover the three primary HF API endpoints: `/api/whoami-v2`, `/api/models`, `/api/datasets`.

3. **Tauri IPC mock** (`tests/fixtures/mocks/ipc.ts`) provides `setupTauriMocks(page)` that injects `window.__TAURI_INTERNALS__` via `page.addInitScript()` before page load. All 15 app commands are stubbed.

4. **Typed fixture data** matching app TypeScript types: `mockUserInfo` (UserInfo), `mockModelRepo`/`mockDatasetRepo`/`mockRepos` (RepoItem[]), `mockDatasetRows`/`mockColumnStats`.

5. **Smoke E2E test** (`tests/e2e/smoke.spec.ts`) proves Playwright connects to the Vite dev server, Tauri IPC is mocked correctly, and the login screen renders — all 2 Playwright tests pass in 3.3s.

## Verification Results

- `npm test` (Vitest): 7 test files, 30 tests — all PASS
- `npx playwright test tests/e2e/smoke.spec.ts`: 2 tests — all PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest picked up Playwright spec file**
- **Found during:** Final verification after Task 3
- **Issue:** Vitest globbed `tests/e2e/smoke.spec.ts` and failed because `test.beforeEach()` is Playwright's API. Output: "Playwright Test did not expect test.beforeEach() to be called here."
- **Fix:** Added `exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**']` to `vitest.config.ts` test options
- **Files modified:** `vitest.config.ts`
- **Commit:** 7223e40

## Self-Check: PASSED

All 9 created files verified on disk. All 4 task commits verified in git log.
