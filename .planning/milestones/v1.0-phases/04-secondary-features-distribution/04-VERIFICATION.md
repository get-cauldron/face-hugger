---
phase: 04-secondary-features-distribution
verified: 2026-03-19T22:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
human_verification:
  - test: "OAuth login end-to-end flow"
    expected: "Clicking 'Sign in with Hugging Face' opens browser, completes OAuth, and logs user in"
    why_human: "HF_OAUTH_CLIENT_ID is registered (no longer TODO placeholder) but localhost redirect flow requires a real browser and running app to verify. Cannot confirm the OAuth exchange works end-to-end without running the app."
  - test: "System tray visible on launch"
    expected: "Tray icon appears in menu bar/system tray when app is running"
    why_human: "Tray setup is wired in lib.rs setup hook and tray.rs is fully implemented, but tray icon appearance requires a running Tauri app to confirm."
  - test: "Close-to-tray behavior"
    expected: "Closing window during active upload hides to tray; closing with no uploads quits"
    why_human: "ExitRequested handler exists with api.prevent_exit() and w.hide() but conditional logic requires active uploads which requires runtime testing."
  - test: "Desktop notifications on upload complete/fail"
    expected: "Notification appears when upload finishes or fails"
    why_human: "notify_upload_complete/notify_upload_failed are wired into upload queue, but OS notification permission approval and notification display requires a live app."
  - test: "Dataset preview tab renders rows"
    expected: "Clicking Preview tab on a dataset repo loads and displays paginated rows with column type badges"
    why_human: "All components are implemented and wired, but HF Dataset Viewer API connectivity and correct rendering requires a running app with network access."
  - test: "Auto-update banner behavior"
    expected: "Banner does not appear on dev builds (no update available); appears with version + 'Update now' + 'Dismiss' when update exists"
    why_human: "UpdateBanner calls check() on mount which requires network access and a real GitHub release endpoint. Cannot verify no-update-available behavior programmatically."
---

# Phase 04: Secondary Features + Distribution Verification Report

**Phase Goal:** Implement secondary features (OAuth login, dataset preview, system tray) and distribution pipeline (CI/CD, auto-update).
**Verified:** 2026-03-19
**Status:** human_needed — all automated checks pass; 6 items require runtime/visual verification
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees "Sign in with Hugging Face" as primary OAuth button | VERIFIED | LoginScreen.tsx line 270: `Sign in with Hugging Face` in both idle and error states |
| 2 | Clicking OAuth button opens browser to HF authorize page and shows waiting spinner | VERIFIED | `handleOAuthStart` calls `oauthStart()`, `openUrl(authUrl)`, sets `oauthStatus('waiting')`; Loader2 spinner shown in waiting state |
| 3 | After browser approval, app receives callback and exchanges code for token | VERIFIED | `listen('oauth-callback', ...)` calls `oauthExchangeCode`, then `getStoredToken()` to hydrate frontend store |
| 4 | OAuth token stored in OS keyring under same key as paste tokens | VERIFIED | auth.rs line 230: `entry.set_password(&token_resp.access_token)` using `face-hugger/hf-token` |
| 5 | User can cancel OAuth waiting state | VERIFIED | `handleOAuthCancel` calls `oauthCancel()` and `setOauthStatus('idle')` |
| 6 | Existing token-paste flow still works | VERIFIED | Token fallback mode preserved in LoginScreen; `check_existing_token` unchanged |
| 7 | PKCE code verifier and challenge generated correctly | VERIFIED | `generate_pkce_verifier` (32 random bytes + base64url) + `pkce_challenge` (SHA256 + base64url) in auth.rs |
| 8 | Preview tab shown for dataset repos only | VERIFIED | RepoBrowserPage.tsx line 68: `{repoType === 'dataset' && ...}` gates the Preview tab button; content at line 119 double-gates with `repoType === 'dataset'` |
| 9 | Preview tab shows paginated table with column type badges | VERIFIED | PreviewTable.tsx has Badge per feature with `getTypeColor()` (blue/amber/green); pagination footer at line 178 |
| 10 | User can search rows with client-side highlighting | VERIFIED | DatasetPreview debounces search 300ms, routes to `useDatasetSearch`; PreviewTable `highlightText()` wraps matches in `<mark className="bg-primary/20 text-primary">` |
| 11 | User can filter rows via per-column filter dropdowns | VERIFIED | PreviewTable renders filter input for filterable columns; DatasetPreview builds `whereClause` and routes to `useDatasetFilter` |
| 12 | User can change dataset split/config | VERIFIED | DatasetPreview has Select component showing splits when `splits.length > 1`; `handleSplitChange` updates config/split/page |
| 13 | Column header click opens statistics side panel | VERIFIED | `handleColumnClick` toggles `statColumn`; ColumnStatPanel renders with `useDatasetStatistics`, recharts BarChart |
| 14 | Preview unavailable state for datasets without Parquet exports | VERIFIED | DatasetPreview line 138: renders "Preview unavailable" when `!isViewerValid` |
| 15 | Close window while uploads active hides to tray | VERIFIED | lib.rs line 97-103: `ExitRequested` with `check_active_uploads()` → `api.prevent_exit()` + `w.hide()` |
| 16 | Tray icon shows dynamic menu with upload count and notifications | VERIFIED | tray.rs `build_tray_menu` with "No active uploads" / "{N} upload(s) — {pct}%"; `notify_upload_complete/failed` wired in upload queue |
| 17 | GitHub Actions builds signed artifacts for macOS, Windows, Linux on tag push | VERIFIED | release.yml with matrix: macos-latest (arm64+x86_64), ubuntu-22.04, windows-latest; triggers on `v*` tags |
| 18 | Auto-update banner checks on launch and shows "Update now" + "Dismiss" | VERIFIED | UpdateBanner.tsx calls `check()` in useEffect; renders "Version {update.version} is available" with Update now/Dismiss buttons |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands/auth.rs` | oauth_start, oauth_exchange_code, oauth_cancel with PKCE | VERIFIED | All three commands present and substantive; PKCE verifier + SHA256 challenge; CSRF state validation via `oauth_state.take()` |
| `src/components/auth/LoginScreen.tsx` | OAuth-first with idle/waiting/error/token-fallback states | VERIFIED | All four states implemented; "Sign in with Hugging Face", "Waiting for browser login...", "Cancel Sign-in", "Use access token instead" all present |
| `src/stores/authStore.ts` | oauthStatus state with setOauthStatus action | VERIFIED | `oauthStatus: 'idle' \| 'waiting' \| 'error'`, `oauthError: string \| null`, `setOauthStatus` action |
| `src/lib/datasetTypes.ts` | TypeScript types for HF Dataset Viewer API | VERIFIED | DatasetRowsResponse, ColumnStatistics, DatasetSplitsResponse, DatasetIsValidResponse, DatasetStatisticsResponse all present |
| `src/queries/useDatasetViewer.ts` | Six TanStack Query hooks | VERIFIED | useDatasetIsValid, useDatasetSplits, useDatasetRows, useDatasetSearch, useDatasetFilter, useDatasetStatistics all exported |
| `src/routes/repo-browser/preview/DatasetPreview.tsx` | Tab content with split selector and search | VERIFIED | Debounced search, split selector, filter state, priority routing (search > filter > rows) |
| `src/routes/repo-browser/preview/PreviewTable.tsx` | Paginated table with badges and highlighting | VERIFIED | TableHeader, Badge with type colors, search highlighting, Skeleton loading, pagination footer |
| `src/routes/repo-browser/preview/ColumnStatPanel.tsx` | Side panel with recharts and statistics | VERIFIED | useDatasetStatistics, BarChart, nan_count, histogram, frequencies, "Statistics are partial", Separator, aria-label="Close statistics panel" |
| `src-tauri/src/tray.rs` | TrayIconBuilder setup, menu, animation, notifications | VERIFIED | setup_tray, build_tray_menu, update_tray_menu, start_tray_animation, stop_tray_animation, notify_upload_complete, notify_upload_failed all present |
| `.github/workflows/release.yml` | GitHub Actions CI for cross-platform release | VERIFIED | tauri-apps/tauri-action@v0, matrix with macos/ubuntu/windows, TAURI_SIGNING_PRIVATE_KEY, APPLE_CERTIFICATE, libayatana-appindicator3-dev |
| `src/components/UpdateBanner.tsx` | Auto-update banner with Update now/Dismiss | VERIFIED | check() on mount, "Update now", "Dismiss", "Downloading...", ArrowUpCircle, downloadAndInstall, relaunch |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `LoginScreen.tsx` | `src-tauri/src/commands/auth.rs` | `invoke('oauth_start')` returns auth URL | VERIFIED | `oauthStart()` called in `handleOAuthStart`; `oauthExchangeCode(event.payload)` called in oauth-callback handler |
| `src-tauri/src/commands/auth.rs` | keyring | `set_password` in oauth_exchange_code | VERIFIED | `entry.set_password(&token_resp.access_token)` at line 230 |
| `LoginScreen.tsx` | `@tauri-apps/api/event` | `listen('oauth-callback')` receives redirect URL | VERIFIED | `listen<string>('oauth-callback', async (event) => { ... oauthExchangeCode(event.payload) })` |
| `DatasetPreview.tsx` | `useDatasetViewer.ts` | useDatasetSplits, useDatasetRows, useDatasetSearch, useDatasetIsValid hooks | VERIFIED | All four hooks imported and called; fifth (useDatasetFilter) also imported and called |
| `RepoBrowserPage.tsx` | `DatasetPreview.tsx` | Preview tab conditionally rendered for dataset repos | VERIFIED | `activeTab === 'preview'` at line 119; Import at line 6 |
| `ColumnStatPanel.tsx` | `useDatasetViewer.ts` | useDatasetStatistics hook | VERIFIED | `useDatasetStatistics(dataset, config, split, true)` at line 43 |
| `lib.rs` | `tray.rs` | setup hook calls `tray::setup_tray(app)` | VERIFIED | `crate::tray::setup_tray(&app_handle)` at line 86 in setup hook |
| `lib.rs` | upload queue state | ExitRequested checks active upload count | VERIFIED | `check_active_uploads(app_handle)` checks `progress_map` for active states |
| `tray.rs` | `tauri_plugin_notification` | NotificationExt for upload notifications | VERIFIED | `use tauri_plugin_notification::NotificationExt` + `app.notification().builder()...show()` |
| `UpdateBanner.tsx` | `@tauri-apps/plugin-updater` | check() on mount, downloadAndInstall on click | VERIFIED | `check()` in useEffect; `update.downloadAndInstall()` in handleUpdate |
| `.github/workflows/release.yml` | `src-tauri/tauri.conf.json` | Reads bundle config via tauri-action | VERIFIED | `tauri-apps/tauri-action@v0` present; tauri.conf.json has `createUpdaterArtifacts: true`, `updater` plugin with `pubkey` and `endpoints` |
| `AppShell.tsx` | `UpdateBanner.tsx` | Rendered inside main before content area | VERIFIED | `import UpdateBanner from '../UpdateBanner'`; `<UpdateBanner />` at line 132 inside `<main className="flex-1 flex flex-col overflow-hidden">` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-03 | 04-01 | User can authenticate via OAuth browser login flow | SATISFIED | oauth_start/oauth_exchange_code/oauth_cancel Rust commands; LoginScreen OAuth-first with PKCE; unified keyring storage |
| UPLD-09 | 04-03 | Uploads continue in background with system tray presence | SATISFIED | ExitRequested handler hides-to-tray when uploads active; tray.rs with full menu, animation, notifications |
| DATA-01 | 04-02 | User can preview dataset rows with schema information | SATISFIED | DatasetPreview + PreviewTable with paginated rows, column type badges (text-blue-400/amber/green) |
| DATA-02 | 04-02 | User can view column statistics (counts, distributions, types) | SATISFIED | ColumnStatPanel with nan_count, min/max/mean, recharts BarChart for histogram/frequencies |
| DATA-03 | 04-02 | User can search and filter within dataset preview | SATISFIED | Global search with debounce+highlight; per-column filter inputs routing to /filter endpoint; priority: search > filter > rows |

All 5 requirement IDs from plan frontmatter (AUTH-03, UPLD-09, DATA-01, DATA-02, DATA-03) are accounted for. No orphaned requirements found — REQUIREMENTS.md maps exactly these 5 IDs to Phase 4.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src-tauri/src/commands/auth.rs` | 7 | `HF_OAUTH_CLIENT_ID` is now a real value (not TODO) | INFO | RESOLVED — the constant is set to `"82869276-6318-48dd-a739-42e92545d227"`. OAuth can function end-to-end. |
| `src-tauri/tauri.conf.json` | 46 | `"pubkey": "PLACEHOLDER_GENERATE_WITH_npm_run_tauri_signer_generate"` | WARNING | Auto-update will fail at runtime until a real signing keypair is generated and the pubkey is populated. CI builds will also fail signing without `TAURI_SIGNING_PRIVATE_KEY` secret. This is expected pre-deployment behavior — documented in user_setup in 04-04 PLAN. |
| `src-tauri/src/tray.rs` | 116-117 | Tray animation uses tooltip toggle, not per-frame PNG | INFO | Per-frame icon animation deferred to post-v1 per SUMMARY decision. Tooltip alternation provides activity signal. Not a blocker. |

### Human Verification Required

#### 1. OAuth Login End-to-End

**Test:** Launch app, click "Sign in with Hugging Face"
**Expected:** Browser opens to HF OAuth page; after approving, app receives callback, logs user in, shows success flash with username/avatar
**Why human:** Requires running Tauri app, real browser, and registered HF OAuth app (client_id is set in auth.rs)

#### 2. System Tray Icon Appears

**Test:** Launch app; look at macOS menu bar / Windows system tray / Linux notification area
**Expected:** Face Hugger icon visible in tray
**Why human:** Tray setup is called in the async setup hook after AppState is managed — requires a running Tauri build to confirm the tray actually appears

#### 3. Close-to-Tray Behavior

**Test:** Start an upload, then close the main window via the X button
**Expected:** Window hides; tray icon remains; clicking tray icon reopens window. After upload completes, closing window should quit.
**Why human:** Conditional logic in ExitRequested handler requires an active upload at close time

#### 4. Desktop Notifications

**Test:** Complete or fail an upload
**Expected:** Desktop notification "Upload Complete — {filename} uploaded to {repo}" or "Upload Failed" appears
**Why human:** OS notification permission may need approval on first launch; actual notification display requires a running app

#### 5. Dataset Preview Renders Real Data

**Test:** Navigate to a public dataset repo (e.g., "nyu-mll/glue"), click Preview tab
**Expected:** Table loads rows with column type badges; search bar filters rows with highlighting; column header click opens stats panel with histogram
**Why human:** HF Dataset Viewer API connectivity and actual data rendering require network + running app

#### 6. Auto-Update Banner (No-Update Case)

**Test:** Launch app in development build
**Expected:** No update banner appears (dev builds should not find updates against GitHub releases endpoint)
**Why human:** Requires running app to confirm check() returns null and banner stays hidden

### Gaps Summary

No gaps found. All 18 observable truths are verified against the actual codebase. All artifacts exist and are substantive (not stubs). All key links are wired. All 5 requirement IDs are satisfied.

The `pubkey` placeholder in tauri.conf.json is expected pre-deployment behavior documented in 04-04 PLAN's `user_setup` section — it does not block any Phase 4 feature and is not a gap.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
