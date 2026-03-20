---
phase: 05
slug: e2e-ui-automated-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend unit/component), Playwright (E2E browser), tauri-driver (native E2E), cargo test (Rust) |
| **Config file** | vitest.config.ts, playwright.config.ts (Wave 0 creates both) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npx playwright test && cargo test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npx playwright test && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

*Status: pending - green - red - flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — Playwright configuration with Tauri IPC mock setup
- [ ] `src/test/setup.ts` — Vitest setup with MSW and testing-library
- [ ] `tests/e2e/fixtures/` — Shared Playwright fixtures with IPC mock helpers
- [ ] `@playwright/test` + `msw` + `@testing-library/react` — npm dev dependencies

*Wave 0 establishes the test infrastructure all subsequent plans depend on.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| macOS system tray | UPLD-09 | No WKWebView WebDriver for tauri-driver on macOS | Launch app on macOS, verify tray icon appears |
| macOS desktop notifications | NOTF-01 | Same macOS WebDriver limitation | Trigger upload completion, verify notification |
| OAuth browser redirect | AUTH-03 | Requires real browser redirect flow | Click OAuth login, complete HF browser flow |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
