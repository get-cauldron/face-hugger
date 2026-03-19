---
phase: 3
slug: upload-ui-repo-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (frontend components + hooks) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && cd src-tauri && cargo test` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | UPLD-06 | unit | `npm run test -- wizard` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | UPLD-07 | unit | `npm run test -- queue` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | UPLD-08 | unit | `npm run test -- sync` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | REPO-02 | unit | `npm run test -- create-repo` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 3 | REPO-03 | unit | `npm run test -- file-browser` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 3 | REPO-04 | unit | `npm run test -- file-actions` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 3 | REPO-05 | unit | `npm run test -- commit-history` | ❌ W0 | ⬜ pending |
| 03-05-02 | 05 | 3 | REPO-06 | unit | `npm run test -- rollback` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx shadcn@latest init` — if not already initialized
- [ ] `npm install @tauri-apps/plugin-dialog` — dialog plugin for file/folder pickers
- [ ] Test stubs for wizard, queue, sync, create-repo, file-browser, commit-history

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop files anywhere opens repo picker | UPLD-07 | Requires Tauri runtime drag events | 1. Drag file from Finder onto app, 2. Verify repo picker appears |
| Upload wizard 3-step flow end-to-end | UPLD-06 | Full visual flow verification | 1. Click Upload in sidebar, 2. Complete all 3 steps, 3. Verify file appears in queue |
| Folder sync diffs correctly | UPLD-08 | Requires real HF repo with files | 1. Pick folder with known files, 2. Verify only changed files shown |
| File tree navigation | REPO-03 | Visual tree interaction | 1. Open a repo with nested folders, 2. Verify expand/collapse works |
| Rollback to previous commit | REPO-06 | Requires real HF repo with history | 1. View commit history, 2. Click Revert on a commit, 3. Verify new commit created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
