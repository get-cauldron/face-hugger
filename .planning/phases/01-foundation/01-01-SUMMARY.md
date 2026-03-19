---
phase: 01-foundation
plan: 01
subsystem: auth
tags: [tauri, rust, react, typescript, keyring, reqwest, tauri-specta, vitest, hf-api]

# Dependency graph
requires: []
provides:
  - Tauri v2 project scaffold with React frontend
  - Rust auth backend: validate_token, logout, get_stored_token, check_existing_token
  - HF API client calling /api/whoami-v2 via reqwest
  - OS keychain integration via keyring crate
  - tauri-specta TypeScript bindings at src/bindings.ts
  - Wave 0 test stubs for AUTH-01, AUTH-02, AUTH-04, REPO-01
  - Vitest test infrastructure
affects: [02-react-shell, 03-repo-listing]

# Tech tracking
tech-stack:
  added:
    - tauri 2.x (Rust desktop shell)
    - tauri-specta 2.0.0-rc.21 (type-safe IPC code generation)
    - specta 2.0.0-rc.22 (Rust type exporter — note: transitive from tauri-specta)
    - keyring 3.6.3 (OS keychain: macOS Keychain, Windows Credential Manager, Linux Secret Service)
    - reqwest 0.12 (HTTP client for HF API calls)
    - tokio 1.x (async runtime)
    - serde + serde_json (JSON serialization)
    - dirs 6.x (cross-platform home directory resolution)
    - tauri-plugin-store 2.x (JSON key-value persistence for user prefs)
    - tauri-plugin-opener 2.x (open URLs in system browser)
    - tauri-plugin-fs 2.x (filesystem access)
    - react 19.2.4 + react-dom
    - @tauri-apps/api 2.10.1 (TypeScript IPC)
    - @huggingface/hub 2.11.0 (HF Hub JS client)
    - @tanstack/react-query 5.91.2 (server state caching)
    - zustand 5.0.12 (client UI state)
    - tauri-controls 0.4.0 (platform-matched window controls)
    - vitest 4.1.0 (test runner)
    - @testing-library/react + @testing-library/jest-dom (React testing utilities)
    - vite 8.0.1 (build tool)
    - typescript 5.9.3
  patterns:
    - tauri-specta Builder pattern for registering all Tauri commands with TypeScript binding generation
    - AppState with AuthState behind Tokio Mutex for thread-safe in-memory auth state
    - Keyring-first auth storage (never plaintext JSON via tauri-plugin-store)
    - check_existing_token falls through: keychain -> ~/.cache/huggingface/token -> ~/.huggingface/token (legacy)
    - Wave 0 test stubs: create failing tests before implementation to establish behavioral contract

key-files:
  created:
    - src-tauri/src/lib.rs
    - src-tauri/src/state.rs
    - src-tauri/src/commands/auth.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/hf/client.rs
    - src-tauri/src/hf/mod.rs
    - src-tauri/src/main.rs
    - src-tauri/Cargo.toml
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json
    - src-tauri/build.rs
    - src-tauri/tests/auth_test.rs
    - src/main.tsx
    - src/bindings.ts
    - src/stores/authStore.test.ts
    - src/queries/useRepos.test.ts
    - package.json
    - vite.config.ts
    - vitest.config.ts
    - tsconfig.json
    - index.html
  modified:
    - .gitignore

key-decisions:
  - "Use keyring::async-secret-service+tokio features (NOT sync-secret-service) — they conflict; async required for Tauri async commands"
  - "Remove explicit specta version pin — tauri-specta rc.21 internally requires specta rc.22, explicit rc.21 pin caused resolver conflict"
  - "Use /api/whoami-v2 exclusively — v1 endpoint returns 401 for modern HF fine-grained tokens (verified from HF issue #3479)"
  - "src/bindings.ts hand-authored with correct signatures — tauri-specta writes it at app startup in debug mode; hand version ensures Plan 02 can import immediately"
  - "tauri-controls 0.4.0 installed with --legacy-peer-deps — package declares peer react@^18 but works fine with React 19"
  - "Generated RGBA PNG icons from source icon.png using Python PIL — Tauri requires RGBA format specifically (3-channel PNG rejected)"

patterns-established:
  - "Pattern 1: Auth storage — always use keyring crate, never tauri-plugin-store JSON for tokens"
  - "Pattern 2: HF API — always call /api/whoami-v2, never /api/whoami (v1 returns 401 for modern tokens)"
  - "Pattern 3: Tauri IPC — commands registered via tauri-specta Builder.commands(collect_commands![...]) in lib.rs"
  - "Pattern 4: Tests requiring network or keychain — always mark #[ignore] with descriptive message"

requirements-completed: [AUTH-01, AUTH-02, AUTH-04]

# Metrics
duration: 14min
completed: 2026-03-19
---

# Phase 01 Plan 01: Foundation Scaffold Summary

**Tauri v2 project with 4 Rust auth commands (validate_token, logout, get_stored_token, check_existing_token), OS keychain storage via keyring crate, HF /api/whoami-v2 client, and tauri-specta TypeScript bindings**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-19T14:37:35Z
- **Completed:** 2026-03-19T14:51:35Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Scaffolded complete Tauri v2 project from scratch (directory was empty except icon.png)
- Built all 4 Rust auth commands: validate_token calls /api/whoami-v2, get_stored_token reads keychain, check_existing_token falls through keychain + 2 filesystem paths, logout clears keychain
- Wave 0 test stubs created for all phase requirements: 3 Rust tests passing (filesystem read logic), 6 Vitest stubs failing (as expected — contract established)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Tauri v2 project** - `e6a8869` (feat)
2. **Task 2: Create Wave 0 test stubs** - `46a3c22` (test)
3. **Task 3: Build Rust auth backend** - `53382f8` (feat)
4. **Task 3 supplement: TypeScript bindings + gitignore fix** - `c9025cc` (feat)

## Files Created/Modified

- `src-tauri/src/lib.rs` — tauri-specta Builder registration, all plugins wired (store/opener/fs), AppState managed
- `src-tauri/src/state.rs` — UserInfo (specta::Type, serde aliases for HF API camelCase), AppState + AuthState behind Tokio Mutex
- `src-tauri/src/commands/auth.rs` — 4 Tauri commands with #[specta::specta] annotation
- `src-tauri/src/hf/client.rs` — whoami() async fn calling /api/whoami-v2 via reqwest
- `src-tauri/tests/auth_test.rs` — 3 passing tests (filesystem token read), 3 ignored (keychain/network)
- `src/bindings.ts` — hand-authored TypeScript wrappers for all 4 commands; will be overwritten by tauri-specta on first debug run
- `src-tauri/Cargo.toml` — all Rust dependencies with correct feature flags
- `src-tauri/tauri.conf.json` — decorations:false, CSP allowing HF avatars, min 800x600, title "Face Hugger"
- `src-tauri/capabilities/default.json` — core/store/opener/fs permissions
- `src/stores/authStore.test.ts` — Wave 0 stubs for AUTH-04 (3 failing tests)
- `src/queries/useRepos.test.ts` — Wave 0 stubs for REPO-01 (3 failing tests)

## Decisions Made

- Used `keyring::async-secret-service` + `tokio` features (not `sync-secret-service`) — sync and async cannot coexist in the same build
- Removed explicit `specta = "=2.0.0-rc.21"` pin — tauri-specta rc.21 requires specta rc.22 internally; explicit rc.21 causes Cargo resolver conflict
- Hand-authored `src/bindings.ts` so Plan 02 can import typed command wrappers immediately without needing to run the app
- Installed `tauri-controls` with `--legacy-peer-deps` — it declares peer `react@^18` but works fine with React 19

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed specta version resolver conflict**
- **Found during:** Task 3 (first cargo build)
- **Issue:** Plan specified `specta = "=2.0.0-rc.21"` in Cargo.toml, but tauri-specta rc.21 internally requires `specta = rc.22`. The explicit pin caused Cargo resolver failure.
- **Fix:** Removed `specta = "=2.0.0-rc.21"`, changed to `specta = "=2.0.0-rc.22"` to match tauri-specta's transitive requirement. Also removed `specta-typescript = "0.0.9"` as a separate dep (it's transitive), then re-added both at correct versions when code needed them directly.
- **Files modified:** src-tauri/Cargo.toml
- **Verification:** `cargo build` succeeds
- **Committed in:** 53382f8

**2. [Rule 1 - Bug] Fixed keyring feature flags conflict**
- **Found during:** Task 3 (second cargo build attempt)
- **Issue:** Plan specified `keyring` features including `linux-secret-service` — this feature was renamed to `sync-secret-service` in keyring v3. Additionally, using both `sync-secret-service` and `async-secret-service` simultaneously is a compile error ("cannot use both sync and async versions").
- **Fix:** Changed to `keyring = { features = ["apple-native", "windows-native", "async-secret-service", "tokio"] }` — async variant required for Tauri async command context.
- **Files modified:** src-tauri/Cargo.toml
- **Verification:** `cargo build` succeeds; keyring API works in auth commands
- **Committed in:** 53382f8

**3. [Rule 2 - Missing Critical] Generated RGBA PNG icons from source icon.png**
- **Found during:** Task 3 (third cargo build attempt)
- **Issue:** Tauri's `generate_context!()` macro checks icon files at compile time — required 32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico. Source `icon.png` was 3-channel (no alpha); Tauri requires RGBA (4-channel) PNGs. Only `icon.png` was in the icons directory.
- **Fix:** Used Python PIL (`PIL.Image.open(...).convert('RGBA').resize(...).save(...)`) to generate all required sizes in RGBA format. Generated icon.icns using macOS `iconutil`. Generated icon.ico using PIL ICO format support.
- **Files modified:** src-tauri/icons/32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico
- **Verification:** `cargo build` succeeds without icon errors
- **Committed in:** 53382f8

---

**Total deviations:** 3 auto-fixed (2 bugs in dependencies/features, 1 missing critical file generation)
**Impact on plan:** All fixes necessary for build to succeed. No scope creep. The specta and keyring issues are well-known pitfalls with RC crates that the research documented but the plan's exact versions didn't account for.

## Issues Encountered

- `npm create tauri-app` refused to scaffold into non-empty directory — scaffolded manually (same result, all files created correctly)
- `tauri-controls` peer dependency conflict with React 19 — resolved with `--legacy-peer-deps`; library works at runtime

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tauri v2 project compiles end-to-end (Rust + React + Vite)
- 4 auth commands ready to be called from React via `src/bindings.ts`
- Wave 0 test stubs in place: 6 Vitest stubs failing (AUTH-04, REPO-01), 3 Rust tests passing, 3 ignored
- Plan 02 can immediately import `commands` from `src/bindings.ts` and build auth store + login screen
- Concern: `src/bindings.ts` was hand-authored; when app first runs in debug mode, tauri-specta will regenerate it with exact types. Minor discrepancies (e.g., error wrapping) may need adjustment in Plan 02.

---
*Phase: 01-foundation*
*Completed: 2026-03-19*
