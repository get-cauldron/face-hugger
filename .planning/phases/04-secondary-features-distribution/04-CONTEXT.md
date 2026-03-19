# Phase 4: Secondary Features + Distribution - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

OAuth browser login, dataset preview with search/filter/stats, background uploads with system tray presence, and signed distribution artifacts for macOS/Windows/Linux with auto-update and app store submissions. This phase adds the differentiating polish and ships the app. No new upload engine features, no new repo management features — those are complete.

</domain>

<decisions>
## Implementation Decisions

### OAuth login flow
- OAuth is the primary login method — big "Sign in with Hugging Face" button front-and-center, small "Use access token instead" link below
- Browser opens HF OAuth page; app shows waiting state with spinner + "Waiting for browser login..." + Cancel button
- OAuth token requests same scopes as current fine-grained token (read + write for repos)
- Existing token-auth users are left alone — if a valid token exists in keyring, use it silently, no prompting to switch to OAuth
- OAuth token stored in same OS keyring as paste tokens — unified auth storage
- On OAuth failure or browser tab closed: user can cancel and retry from the waiting screen

### Dataset preview
- Preview lives as a new tab in the repo browser (alongside Files and History) — only visible for dataset repos
- Paginated table: 50-100 rows per page with page controls, using HF Dataset Viewer API pagination
- Column headers show type badges (string, int, float, bool, etc.)
- Click a column header to open a side panel with distribution chart, null count, min/max, unique count
- Global text search bar above the table + per-column filter dropdowns (Excel-style)
- Search hits highlighted in results
- Subset/split selector if the dataset has multiple configurations

### Background uploads & tray
- Closing the window while uploads are active minimizes to system tray — uploads continue in background
- If no uploads are active, closing the window fully quits the app (no lingering tray process)
- Tray icon animates during uploads (spinning or pulsing)
- Right-click tray menu: upload count, overall progress %, "Open Face Hugger", "Pause All", "Quit"
- Click tray icon to reopen the main window
- Desktop notifications on upload completion and failure only — no progress milestone notifications
- Notification text: file name + target repo (e.g., "model.safetensors uploaded to user/my-model")

### Distribution & packaging
- Ship all three platforms: macOS (.dmg), Windows (.msi/.exe installer), Linux (.AppImage + .deb)
- GitHub Actions CI with matrix builds (macOS, Windows, Linux runners)
- Signed and notarized artifacts — macOS notarization, Windows code signing
- Artifacts hosted on GitHub Releases + submitted to Mac App Store and Microsoft Store
- Built-in auto-update via Tauri updater plugin — checks on launch, shows "Update available" banner, user clicks to update
- Auto-update reads from GitHub Releases

### Claude's Discretion
- OAuth deep-link scheme registration approach (custom protocol vs localhost redirect — research needed for Tauri v2)
- HF Dataset Viewer API integration details (endpoint selection, pagination params, error handling)
- Tray icon animation implementation (platform-specific constraints)
- Linux tray compatibility approach (libappindicator vs alternatives — research needed)
- GitHub Actions workflow structure and Tauri build configuration
- App store submission requirements and compliance details
- Auto-update check frequency and update banner design
- Column statistics chart library choice

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — AUTH-03, UPLD-09, DATA-01, DATA-02, DATA-03 are this phase's requirements

### Prior phase patterns (must follow)
- `src-tauri/src/commands/auth.rs` — Existing token auth command pattern (extend for OAuth)
- `src-tauri/src/state.rs` — AppState pattern (extend for tray state)
- `src/stores/authStore.ts` — Auth state management (extend for OAuth flow state)
- `src/routes/repo-browser/` — Repo browser with tabs (add Preview tab for datasets)
- `src/routes/datasets/DatasetsPage.tsx` — Dataset repo listing (preview navigates from here)
- `src/routes/settings/SettingsPage.tsx` — Settings page (OAuth account info integrates here)
- `src/components/shell/AppShell.tsx` — App shell layout and routing

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Visual identity (dark theme, orange, spacious, shadcn/ui), login screen decisions
- `.planning/phases/02-upload-engine/02-CONTEXT.md` — Upload engine behavior, progress reporting, queue management decisions
- `.planning/phases/03-upload-ui-repo-management/03-CONTEXT.md` — Upload UI, repo browser, queue UX decisions

### Known blockers (from STATE.md)
- OAuth deep-link scheme registration in Tauri v2 has sparse community examples — needs research
- Linux system tray distro compatibility matrix unknown — needs research

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/commands/auth.rs`: Token auth commands — extend with OAuth flow commands
- `src-tauri/src/hf/client.rs`: HF API client with reqwest — extend for Dataset Viewer API calls
- `src/stores/authStore.ts`: Zustand auth store — extend with OAuth state (waiting, callback, error)
- `src/routes/repo-browser/`: Tab-based repo browser — add Preview tab component
- `src/components/ui/`: Full shadcn/ui component library — table, dialog, badge, dropdown for dataset preview
- `src/commands/upload.ts`: Upload command wrappers — tray needs to read upload state for menu
- `src-tauri/src/upload/`: Upload engine — tray lifecycle hooks into upload queue state
- Tauri plugins installed: store, opener, fs, dialog — need to add tray, deep-link, updater, notification plugins

### Established Patterns
- Zustand for client UI state, TanStack Query for HF API data (dataset preview uses TanStack Query)
- Commands: `#[tauri::command]` + `#[specta::specta]` with tauri-specta TypeScript generation
- Tailwind v4 semantic classes, shadcn/ui components
- Section-based routing via local state in AppShell

### Integration Points
- OAuth: New Rust commands for OAuth flow + deep-link handler → auth store → login screen
- Dataset preview: New React route/tab in repo browser → HF Dataset Viewer API via TanStack Query
- Tray: Tauri tray plugin → hooks into upload queue state → window lifecycle management
- Distribution: GitHub Actions workflow → Tauri build → signing → GitHub Releases + app stores
- Auto-update: Tauri updater plugin → update check on app launch → banner component in AppShell

</code_context>

<specifics>
## Specific Ideas

- OAuth should feel instant — click button, browser opens, approve, back in app. No multi-step config.
- Dataset preview should feel like browsing a spreadsheet — familiar table UX, not a developer tool
- Tray behavior follows the "only when needed" pattern — no always-on background process like Dropbox
- The app closing behavior (tray vs quit) should be obvious and unsurprising to users

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-secondary-features-distribution*
*Context gathered: 2026-03-19*
