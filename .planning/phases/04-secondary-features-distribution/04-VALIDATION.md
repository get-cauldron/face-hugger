---
phase: 4
slug: secondary-features-distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + cargo test (Rust backend) |
| **Config file** | `vitest.config.ts` / `src-tauri/Cargo.toml` |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && cd src-tauri && cargo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | AUTH-03 | integration | `cd src-tauri && cargo test oauth` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | DATA-01 | unit | `npm run test -- --run -t "dataset"` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | DATA-02 | unit | `npm run test -- --run -t "statistics"` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | DATA-03 | unit | `npm run test -- --run -t "filter"` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | UPLD-09 | integration | `cd src-tauri && cargo test tray` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/tests/oauth_test.rs` — stubs for AUTH-03 OAuth flow
- [ ] `src/routes/repo-browser/__tests__/DatasetPreview.test.tsx` — stubs for DATA-01, DATA-02, DATA-03
- [ ] `src-tauri/src/tests/tray_test.rs` — stubs for UPLD-09 tray lifecycle

*Existing vitest and cargo test infrastructure from prior phases covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth browser redirect completes | AUTH-03 | Requires real browser + HF OAuth server | 1. Click "Sign in with HF" 2. Approve in browser 3. Verify app receives token |
| Tray icon animates during upload | UPLD-09 | Visual verification of icon animation | 1. Start upload 2. Close window 3. Verify tray icon animates |
| macOS .dmg installs and launches | Distribution | Platform-specific install flow | 1. Download .dmg 2. Drag to Applications 3. Launch and verify |
| Windows installer completes | Distribution | Platform-specific install flow | 1. Run .msi installer 2. Launch from Start menu |
| Linux .AppImage runs | Distribution | Platform-specific binary | 1. chmod +x .AppImage 2. Run and verify |
| Auto-update banner appears | Distribution | Requires staged release | 1. Install old version 2. Publish new release 3. Verify update banner |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
