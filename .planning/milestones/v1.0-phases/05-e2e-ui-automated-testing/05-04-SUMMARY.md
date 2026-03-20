---
phase: 05-e2e-ui-automated-testing
plan: "04"
subsystem: testing
tags: [rust, tauri, playwright, github-actions, ci-cd, smoke-tests]

requires:
  - phase: 05-02
    provides: Playwright E2E test infrastructure and MSW mocks
  - phase: 05-03
    provides: Vitest unit tests for upload commands and auth

provides:
  - CI test workflow running all 3 test layers on all 3 platforms
  - Release workflow gated on test passage (no artifact builds without green tests)
  - Rust command integration tests using tauri::test feature
  - HF API smoke tests gated on HF_TEST_TOKEN secret availability

affects:
  - release (release.yml now requires test.yml to pass)
  - future feature phases (CI enforces test coverage automatically)

tech-stack:
  added:
    - "tauri test feature in [dev-dependencies] (Cargo.toml)"
  patterns:
    - "Cargo integration tests in tests/ directory test pure helper functions, not AppHandle-bound commands"
    - "Playwright APIRequestContext for direct HTTP smoke tests without browser/IPC"
    - "GitHub Actions workflow_call to reuse test workflow in release workflow"
    - "CI smoke tests gated on secret availability via if: env.HF_TEST_TOKEN != ''"

key-files:
  created:
    - .github/workflows/test.yml
    - src-tauri/tests/commands_test.rs
    - tests/e2e/smoke/hf-api.spec.ts
  modified:
    - src-tauri/Cargo.toml
    - .github/workflows/release.yml

key-decisions:
  - "Rust command tests test pure helper functions (compute_xorb_ranges, parse_protocol, format_commit_body) rather than AppHandle-bound commands — tauri-specta trait bound issues with MockRuntime documented in RESEARCH.md"
  - "HF smoke tests use Playwright APIRequestContext (no browser, no Tauri IPC) — direct HTTP calls sufficient for API connectivity validation"
  - "test.yml uses workflow_call trigger so release.yml can reuse it without duplication"
  - "HF smoke test CI step uses if: env.HF_TEST_TOKEN != '' guard — suite skips gracefully when secret unavailable"

patterns-established:
  - "Pure helper functions extracted as pub for offline unit testability (no mocking needed)"
  - "Smoke tests skip via test.skip(!TOKEN, ...) — no test failures, just skipped"

requirements-completed: []

duration: 3min
completed: "2026-03-20"
---

# Phase 05 Plan 04: CI Infrastructure and Backend Tests Summary

**tauri::test feature enabled with 4 command helper tests, HF API smoke spec, and GitHub Actions CI matrix gating releases across macOS/Ubuntu/Windows**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T01:15:56Z
- **Completed:** 2026-03-20T01:19:01Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Rust command integration tests validate tauri::test feature, xorb range computation, protocol detection, and commit body formatting — all 4 pass alongside 57 existing Rust tests
- HF API smoke spec makes 2 real API calls (whoami-v2, list models) via Playwright APIRequestContext, skipping gracefully without HF_TEST_TOKEN
- GitHub Actions test workflow runs Vitest + Playwright + cargo test on macOS/Ubuntu/Windows; release workflow now blocks artifact builds until tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Rust tauri test feature and command tests** - `1f27734` (feat)
2. **Task 2: Create HF API smoke test spec** - `2f810bf` (feat)
3. **Task 3: Create CI test workflow and gate release on test passage** - `58acbf2` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src-tauri/Cargo.toml` - Added `tauri = { version = "2", features = ["test"] }` to [dev-dependencies]
- `src-tauri/tests/commands_test.rs` - 4 integration tests: mock_app, compute_xorb_ranges, parse_protocol, format_commit_body
- `tests/e2e/smoke/hf-api.spec.ts` - 2 real HF API smoke tests gated on HF_TEST_TOKEN
- `.github/workflows/test.yml` - Cross-platform CI matrix with all test layers and workflow_call support
- `.github/workflows/release.yml` - Added `test` job and updated `build-tauri` needs to include it

## Decisions Made

- Rust command tests target pure helper functions (`compute_xorb_ranges`, `parse_protocol`, `format_commit_body`) rather than AppHandle-bound commands — tauri-specta MockRuntime has trait bound issues (per RESEARCH.md Pitfall 6)
- HF smoke tests use `Playwright APIRequestContext` directly — no browser page or Tauri IPC needed for HTTP API validation, simpler and faster
- `test.yml` uses `workflow_call` trigger so it's callable from `release.yml` without duplicating steps
- CI smoke test step guarded with `if: env.HF_TEST_TOKEN != ''` so it becomes a no-op when secret is absent

## Deviations from Plan

None — plan executed exactly as written.

## User Setup Required

**HF API smoke tests need a dedicated test account token.** To enable them in CI:

1. Create a fine-grained read-only token at: Hugging Face -> Settings -> Access Tokens
2. Add `HF_TEST_TOKEN` as a GitHub repository secret: repo -> Settings -> Secrets and variables -> Actions -> New repository secret

Without the secret, the smoke test suite skips automatically (no CI failures).

## Next Phase Readiness

- All 5 plans in Phase 05 are complete — the full testing infrastructure is in place
- CI enforces green tests before every release — no babysitting required
- Frontend unit tests (51), Playwright E2E tests, and Rust tests (61) all pass locally

---
*Phase: 05-e2e-ui-automated-testing*
*Completed: 2026-03-20*

## Self-Check: PASSED

- FOUND: .github/workflows/test.yml
- FOUND: src-tauri/tests/commands_test.rs
- FOUND: tests/e2e/smoke/hf-api.spec.ts
- FOUND: .planning/phases/05-e2e-ui-automated-testing/05-04-SUMMARY.md
- FOUND commit 1f27734: feat(05-04): add tauri test feature and command helper tests
- FOUND commit 2f810bf: feat(05-04): create HF API smoke test spec gated on HF_TEST_TOKEN
- FOUND commit 58acbf2: feat(05-04): create CI test workflow and gate release on test passage
