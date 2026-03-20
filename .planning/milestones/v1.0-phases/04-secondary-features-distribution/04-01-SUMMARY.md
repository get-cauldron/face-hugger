---
phase: 04-secondary-features-distribution
plan: 01
subsystem: auth
tags: [oauth, pkce, tauri, rust, keyring, zustand, react, tauri-plugin-oauth, notification, updater]

requires:
  - phase: 01-foundation
    provides: "validate_token/keyring storage pattern, hand-authored bindings.ts, AppState/AuthState Rust structs"
  - phase: 02-upload-engine
    provides: "AppState.cancel_tokens/upload_queue structure used as context for AuthState extension"
provides:
  - "OAuth browser login flow (PKCE + CSRF) via tauri-plugin-oauth localhost redirect"
  - "oauth_start Rust command returns HF authorize URL, starts localhost callback server"
  - "oauth_exchange_code Rust command validates CSRF, exchanges code, stores token in keyring"
  - "oauth_cancel Rust command clears PKCE state"
  - "AuthState extended with oauth_verifier and oauth_state fields"
  - "LoginScreen OAuth-first with four states: idle, waiting, error, token-fallback"
  - "authStore extended with oauthStatus and oauthError, setOauthStatus action"
  - "Phase 4 plugins installed: tauri-plugin-oauth, notification, updater, tray-icon feature"
affects: [04-02, 04-03, 04-04, 05-e2e]

tech-stack:
  added:
    - "tauri-plugin-oauth = 2 (Rust + @fabianlars/tauri-plugin-oauth npm)"
    - "tauri-plugin-notification = 2 (Rust + @tauri-apps/plugin-notification npm)"
    - "tauri-plugin-updater = 2 (Rust + @tauri-apps/plugin-updater npm)"
    - "base64 = 0.22 (Rust, for PKCE base64url encoding)"
    - "tauri tray-icon feature enabled"
  patterns:
    - "PKCE: generate_pkce_verifier (32 random bytes base64url) + pkce_challenge (SHA256 + base64url)"
    - "OAuth CSRF: generate random state stored in AuthState.oauth_state, validated on callback"
    - "Unified keyring: OAuth token stored under same face-hugger/hf-token entry as paste tokens"
    - "OAuth callback: Rust emits oauth-callback event via tauri::Emitter, frontend listen() handles it"
    - "Post-exchange token retrieval: frontend calls getStoredToken() after oauthExchangeCode returns UserInfo"

key-files:
  created: []
  modified:
    - "src-tauri/Cargo.toml - added 4 new deps + tray-icon feature"
    - "src-tauri/src/state.rs - AuthState extended with oauth_verifier, oauth_state"
    - "src-tauri/src/commands/auth.rs - added oauth_start, oauth_exchange_code, oauth_cancel plus PKCE helpers"
    - "src-tauri/src/lib.rs - registered 3 new plugins + 3 new commands in collect_commands"
    - "src-tauri/capabilities/default.json - added notification:default, updater:default"
    - "src-tauri/tauri.conf.json - CSP connect-src updated with datasets-server.huggingface.co"
    - "src/bindings.ts - added oauthStart, oauthExchangeCode, oauthCancel command stubs"
    - "src/commands/auth.ts - added oauthStart, oauthExchangeCode, oauthCancel wrappers"
    - "src/stores/authStore.ts - added oauthStatus, oauthError, setOauthStatus"
    - "src/components/auth/LoginScreen.tsx - OAuth-first redesign with four states"
    - "src/stores/authStore.test.ts - added 4 OAuth state tests"

key-decisions:
  - "bindings.ts hand-authored for OAuth commands (same pattern as Phase 1) — cargo not available in env, specta cannot run without app; hand-authored stubs match Rust snake_case→camelCase convention"
  - "OAuth token stored in same keyring entry (face-hugger/hf-token) as paste tokens — unified storage means check_existing_token works for both auth paths"
  - "Frontend calls getStoredToken() after oauthExchangeCode returns UserInfo — oauth_exchange_code returns UserInfo not token, so frontend retrieves token separately from Rust state for zustand store"
  - "tauri-plugin-oauth uses localhost HTTP redirect (no scheme registration needed) — simpler than deep-link approach, resolves Phase 4 blocker noted in STATE.md"
  - "HF_OAUTH_CLIENT_ID set as TODO placeholder — app must be registered at huggingface.co/settings/applications/new before OAuth can be tested end-to-end"

patterns-established:
  - "OAuth state machine in authStore: oauthStatus drives UI rendering (idle/waiting/error) decoupled from loginMode (oauth/token)"
  - "Four-state LoginScreen pattern: OAuth idle → waiting → error all share 'oauth' loginMode; token fallback is separate mode"

requirements-completed: [AUTH-03]

duration: 5min
completed: 2026-03-19
---

# Phase 04 Plan 01: OAuth Browser Login Flow Summary

**OAuth browser login with PKCE + CSRF via tauri-plugin-oauth localhost redirect, OAuth-first LoginScreen with four states, unified keyring storage alongside existing token-paste flow**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-19T20:42:20Z
- **Completed:** 2026-03-19T20:46:56Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Rust: oauth_start (PKCE + CSRF + localhost callback server), oauth_exchange_code (CSRF validation + token exchange + keyring), oauth_cancel — all registered in lib.rs
- Frontend: LoginScreen rewritten OAuth-first with idle/waiting/error/token-fallback states driven by authStore.oauthStatus
- All Phase 4 Tauri plugins installed: oauth, notification, updater, tray-icon feature
- 24 tests pass including 4 new OAuth state tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Phase 4 plugins and implement Rust OAuth commands** - `9485e34` (feat)
2. **Task 2: OAuth-first LoginScreen, authStore extension, and frontend command wrappers** - `64f33ab` (feat)

**Plan metadata:** (to be added in final commit)

## Files Created/Modified

- `src-tauri/Cargo.toml` - Added tauri-plugin-oauth/notification/updater, base64, tray-icon feature
- `src-tauri/src/state.rs` - AuthState extended with oauth_verifier, oauth_state fields
- `src-tauri/src/commands/auth.rs` - Added oauth_start, oauth_exchange_code, oauth_cancel, PKCE helpers
- `src-tauri/src/lib.rs` - Registered 3 new plugins, 3 new OAuth commands
- `src-tauri/capabilities/default.json` - Added notification:default, updater:default
- `src-tauri/tauri.conf.json` - Added datasets-server.huggingface.co to CSP connect-src
- `src/bindings.ts` - Added oauthStart, oauthExchangeCode, oauthCancel stubs
- `src/commands/auth.ts` - Added oauthStart, oauthExchangeCode, oauthCancel wrappers
- `src/stores/authStore.ts` - Added oauthStatus, oauthError, setOauthStatus
- `src/components/auth/LoginScreen.tsx` - OAuth-first redesign with four states
- `src/stores/authStore.test.ts` - Added 4 OAuth state tests (7 total auth tests)

## Decisions Made

- **Hand-authored bindings.ts for OAuth:** cargo/Rust not available in this environment so specta cannot regenerate bindings.ts automatically. Added command stubs manually matching tauri-specta's snake_case→camelCase convention.
- **Unified keyring storage:** OAuth tokens stored under same `face-hugger/hf-token` entry as paste tokens — `check_existing_token` works for both auth paths without changes.
- **Frontend token retrieval post-exchange:** `oauth_exchange_code` returns UserInfo not token value; frontend calls `getStoredToken()` to get token for zustand store after Rust stores it in keyring.
- **HF_OAUTH_CLIENT_ID is a placeholder:** App must be registered at huggingface.co/settings/applications/new before OAuth works end-to-end. This is expected for initial implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added OAuth command stubs to bindings.ts**
- **Found during:** Task 2 (frontend command wrappers)
- **Issue:** Plan specified updating commands/auth.ts to export OAuth commands from bindings, but bindings.ts is hand-authored and needed new command entries — without them TypeScript would fail to compile
- **Fix:** Added oauthStart, oauthExchangeCode, oauthCancel command stubs to bindings.ts matching tauri-specta's generated format
- **Files modified:** src/bindings.ts
- **Verification:** `npm run build` exits 0
- **Committed in:** 9485e34 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing critical — required for TypeScript compilation)
**Impact on plan:** Necessary for correctness. No scope creep.

## Issues Encountered

- `cargo` binary not available in execution environment — `cargo check` could not be run. Rust code was verified by visual review against the plan spec and known compilation patterns. The `tauri info` command confirmed all plugin versions matched. Frontend build (`npm run build`) confirmed TypeScript layer compiles correctly. Cargo check will run when the developer next builds the Tauri app.

## User Setup Required

**OAuth requires HF app registration before end-to-end testing:**
1. Visit https://huggingface.co/settings/applications/new
2. Create OAuth app with redirect URI `http://localhost` (tauri-plugin-oauth allocates a random port)
3. Copy the client ID and replace `TODO_REGISTER_HF_OAUTH_APP` in `src-tauri/src/commands/auth.rs`
4. Rebuild the app

## Next Phase Readiness

- Phase 4 Plan 02 can proceed: all Phase 4 plugins are installed (oauth, notification, updater, tray-icon)
- OAuth infrastructure complete; remaining plans can build on notification/updater/tray-icon
- Existing token-paste users unaffected: check_existing_token unchanged

---
*Phase: 04-secondary-features-distribution*
*Completed: 2026-03-19*
