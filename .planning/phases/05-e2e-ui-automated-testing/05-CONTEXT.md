# Phase 5: E2E/UI Automated Testing - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add comprehensive automated test coverage across the finished Face Hugger app. All v1 features are complete (Phases 1-4). This phase adds E2E tests, fills unit test gaps in both frontend and Rust, and integrates testing into the CI pipeline. No new features are added.

</domain>

<decisions>
## Implementation Decisions

### Test strategy & scope
- Comprehensive coverage across all layers — every feature gets at least one E2E test
- Fill unit test gaps in both frontend (React components, hooks, stores) AND Rust backend (commands, auth, tray)
- Most tests mock the HF API for speed and determinism
- 1-2 critical smoke tests hit the real HF API (login, list repos) using a dedicated test account
- Existing 7 frontend unit tests and Rust inline tests are kept as-is; new tests fill gaps alongside them

### E2E framework choice
- **Layered approach:** Playwright for UI flows (fast, reliable) + tauri-driver for native-specific tests
- Playwright tests run against Vite dev server with Tauri IPC mocked
- IPC mocking: Mock `window.__TAURI__` for Tauri invoke() commands AND use MSW for any direct HTTP calls (both layers)
- tauri-driver (WebDriver) tests run against the compiled Tauri binary for native feature coverage

### Critical user flows (Playwright E2E)
- Auth: token paste login, OAuth redirect handling, logout, session persistence
- Upload wizard end-to-end: repo selection -> file pick -> commit message -> upload progress -> completion
- Repo management: create repo, browse files, delete files, view commit history, revert
- Dataset preview: open dataset, view rows, search, filter, column stats panel
- Drag-and-drop: OS file drop onto queue
- Folder sync: local folder sync to HF repo

### Native feature tests (tauri-driver)
- System tray: icon appears, menu items work, close-to-tray during uploads
- Auto-update: UpdateBanner behavior (appears when update available, absent on current version)
- Desktop notifications: upload complete/failure notifications fire
- Window management: app launches, titlebar controls, window state persistence

### CI integration
- Hard gate: all tests must pass before release artifacts are built — red tests = no release
- Test matrix: all three platforms (macOS, Windows, Linux) — matches release matrix
- HF API smoke tests use a dedicated test HF account with fine-grained token stored as GitHub secret
- Test workflow separate from release workflow but release workflow depends on test passing

### Claude's Discretion
- Test file organization and naming conventions
- Specific mock data fixtures design
- Playwright page object pattern vs inline selectors
- tauri-driver test setup and teardown approach
- Which specific Rust modules need additional unit test coverage (based on gap analysis)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing test infrastructure
- `src/stores/authStore.test.ts` — Auth store unit test pattern
- `src/stores/uploadStore.test.ts` — Upload store unit test pattern
- `src/queries/useRepoFiles.test.ts` — React Query hook test pattern
- `src/queries/useRepos.test.ts` — Repo query test pattern
- `src/components/shell/AppShell.test.tsx` — Component test pattern
- `src/lib/repoUtils.test.ts` — Utility test pattern
- `src/routes/repo-browser/FileTree.test.ts` — Route component test pattern
- `src-tauri/tests/auth_test.rs` — Rust integration test pattern

### CI workflow
- `.github/workflows/release.yml` — Existing release workflow (tests must gate this)

### App entry points
- `src/components/shell/AppShell.tsx` — Main app shell with section-based routing
- `src/components/auth/LoginScreen.tsx` — Auth flow entry point
- `src-tauri/src/lib.rs` — Rust app setup, tray, commands registration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Vitest already configured — frontend tests use it with likely jsdom/happy-dom environment
- 7 frontend test files establish patterns for store tests, query hook tests, and component tests
- Rust has `#[cfg(test)]` modules in 10+ files (client, xet, api, db, upload subsystems)
- `src-tauri/tests/auth_test.rs` provides integration test pattern for Rust

### Established Patterns
- Frontend: Vitest for unit tests, no E2E framework yet
- Rust: inline `#[test]` with `#[cfg(test)]` modules, one integration test file
- No Playwright, Cypress, or WebDriver currently installed
- Section-based routing (no React Router) — E2E navigation will use store state or click events, not URL navigation

### Integration Points
- `package.json` needs Playwright + MSW dev dependencies
- `src-tauri/Cargo.toml` may need dev-dependencies for tauri-driver
- `.github/workflows/` needs a new test workflow or additions to release.yml
- `window.__TAURI__` is the IPC bridge to mock in browser-based E2E tests

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for test organization and tooling setup.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-e2e-ui-automated-testing*
*Context gathered: 2026-03-19*
