# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-20
**Phases:** 6 | **Plans:** 24 | **Commits:** 145

### What Was Built
- Full Tauri v2 desktop app with HF authentication (token + OAuth PKCE)
- Rust upload engine with Xet/LFS protocol detection, resumable chunked uploads, SQLite queue
- Upload wizard, drag-and-queue, folder sync for power users
- Repository browser with file tree, CRUD, commit history, revert/restore
- Dataset preview with paginated rows, search, filter, column statistics
- System tray with close-to-tray, upload notifications, animated status
- Cross-platform CI/CD release pipeline with auto-update
- Comprehensive test suite: 51 unit tests, 17 E2E tests, 4 Rust tests, native tests

### What Worked
- Wave-based parallel execution let independent plans run simultaneously (Waves 2 in Phase 3, 5)
- Plan checker caught real issues: missing tauri-driver tests, broken CI YAML verification, dependency conflicts between parallel plans
- Verification loop after each phase caught gaps early (Phase 1 test mock, Phase 2 queue wiring, Phase 5 vitest exclusion)
- Gap closure cycle (audit → plan-milestone-gaps → Phase 6) cleanly resolved tech debt without scope creep
- Section-based routing decision avoided React Router complexity for a desktop app

### What Was Inefficient
- Phase 1 and 2 verifications marked gaps_found but the VERIFICATION.md files were never updated to reflect fixes made in later phases — status stayed stale
- Xet shard format shipped as JSON placeholder knowing it won't work with production CAS — should have been scoped out of v1.0 requirements entirely
- Some executor agents needed multiple auto-fixes per task (bindings.ts conflicts, vitest config exclusions) — plan actions could have been more precise

### Patterns Established
- `model.name` (not `model.id`) for HF Hub SDK repo identifiers
- Hand-authored `bindings.ts` when cargo isn't available in CI/executor environment
- `try_start_next(Option<AppHandle>)` pattern for testability — pass `None` in tests, `Some(app)` in production
- Vitest exclude patterns for non-Vitest test files (`tests/e2e/**`, `tests/native/**`)
- Milestone audit → gap closure → re-audit cycle before completion

### Key Lessons
1. Plan checkers save significant rework — the Phase 5 checker caught 3 blockers that would have caused CI failures
2. Verification should be a living document — update status when gaps are fixed in later phases, not just at initial verification time
3. Tech debt items should be explicitly scoped in or out at roadmap creation, not discovered during audit
4. Desktop apps need layered test strategies — browser E2E covers 90% but native features need separate tooling (tauri-driver limitations on macOS)

### Cost Observations
- Model mix: ~30% opus (planning), ~70% sonnet (execution, research, verification)
- Entire v1.0 built in a single session
- Notable: Parallel wave execution in phases with 2+ independent plans saved significant wall-clock time

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 145 | 6 | Initial process — established GSD workflow patterns |

### Cumulative Quality

| Milestone | Tests | Test Files | LOC |
|-----------|-------|------------|-----|
| v1.0 | 72+ | 21 | 12,811 |

### Top Lessons (Verified Across Milestones)

1. Plan checker verification loops catch structural issues that executors would otherwise hit at runtime
2. Gap closure cycles (audit → fix → re-audit) produce clean milestone completions
