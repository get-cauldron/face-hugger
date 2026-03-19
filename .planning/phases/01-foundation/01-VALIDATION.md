---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (frontend) + cargo test (Rust backend) |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && cd src-tauri && cargo test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01 | integration | `cargo test test_token_validation` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-02 | integration | `cargo test test_keyring_store` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | AUTH-04 | unit | `npm run test -- whoami` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | REPO-01 | unit | `npm run test -- repo-list` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/tests/auth_test.rs` — stubs for AUTH-01, AUTH-02
- [ ] `src/tests/whoami.test.ts` — stubs for AUTH-04
- [ ] `src/tests/repo-list.test.ts` — stubs for REPO-01
- [ ] `vitest` + `@tauri-apps/api/mocks` — install test framework
- [ ] `vitest.config.ts` — test configuration

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OS keyring persistence across app restarts | AUTH-02 | Requires actual OS keyring access | 1. Paste token, 2. Quit app, 3. Reopen, 4. Verify auto-login |
| Custom titlebar drag and window controls | N/A | Platform-specific window behavior | 1. Drag titlebar, 2. Minimize/maximize/close, 3. Test on macOS + Windows |
| Auto-detect ~/.huggingface/token | AUTH-01 | Requires filesystem state setup | 1. Place token at ~/.huggingface/token, 2. Launch app, 3. Verify auto-login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
