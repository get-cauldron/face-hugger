---
phase: 2
slug: upload-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (Rust backend) + vitest (frontend commands) |
| **Config file** | src-tauri/Cargo.toml + vitest.config.ts |
| **Quick run command** | `cd src-tauri && cargo test --lib` |
| **Full suite command** | `cd src-tauri && cargo test && cd .. && npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd src-tauri && cargo test --lib`
- **After every plan wave:** Run `cd src-tauri && cargo test && cd .. && npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | UPLD-04 | unit | `cargo test queue` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | UPLD-01 | unit | `cargo test upload` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | UPLD-10 | unit | `cargo test protocol` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | UPLD-02 | integration | `cargo test resume` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | UPLD-03 | unit | `cargo test progress` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | UPLD-05 | unit | `cargo test cancel` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/upload/tests.rs` — test module stubs for queue, upload, protocol detection
- [ ] `src-tauri/src/db/tests.rs` — test stubs for SQLite queue persistence
- [ ] `sqlx` + `sqlx-sqlite` — install database dependency
- [ ] SQLite test database setup (in-memory for tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upload 1GB+ file without OOM | UPLD-01 | Requires real HF API + large file | 1. Add 1GB+ file, 2. Start upload, 3. Monitor memory in Activity Monitor |
| Resume after network drop | UPLD-02 | Requires real network interruption | 1. Start upload, 2. Disable Wi-Fi, 3. Re-enable, 4. Verify auto-resume |
| Xet vs LFS detection on real repos | UPLD-10 | Requires real HF repos of both types | 1. Upload to new repo (Xet), 2. Upload to legacy repo (LFS), 3. Verify both succeed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
