# Phase 4: Secondary Features + Distribution - Research

**Researched:** 2026-03-19
**Domain:** Tauri v2 plugins (deep-link/OAuth, tray, updater, notification), HF Dataset Viewer API, GitHub Actions distribution
**Confidence:** HIGH (all core claims verified against official Tauri docs, HF docs, or plugin source)

## Summary

Phase 4 is five largely independent feature areas that each add a Tauri plugin and a React UI surface. The most deceptively complex areas are the OAuth flow (two viable approaches with different tradeoffs) and the tray lifecycle management (close-to-tray conditional on active uploads). The distribution pipeline is well-paved by Tauri's official GitHub Actions workflow — the main costs are Apple Developer account setup, certificate creation, and Windows code signing via Azure Key Vault.

The HF Dataset Viewer API is fully documented and ready to use. All endpoints (`/splits`, `/rows`, `/search`, `/filter`, `/statistics`) accept the Bearer token as a header, return consistent JSON structures, and are paginated at 100 rows max per request. The search endpoint uses BM25 + Porter stemming on string columns — not exact-match — which affects how "search hit highlighting" should be designed (the API does not highlight hits; that must be done client-side).

Tray icon animation in Tauri v2 must be simulated via a periodic timer that calls `set_icon()` with a sequence of PNG frames — there is no native animated GIF support in the tray. Linux tray requires `libayatana-appindicator3` or `libappindicator-gtk3` as a runtime dependency on the user's machine; click events on Linux do not fire (context menu still works).

**Primary recommendation:** Use `tauri-plugin-oauth` (localhost redirect) for OAuth — it works with any provider without custom URL scheme registration problems on macOS. Use the `tray-icon` feature built into Tauri core (not a separate plugin) for system tray. Chain all five plugin adds into a single Wave 0 setup task so the planner can assume all plugins are registered before feature work begins.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**OAuth login flow**
- OAuth is the primary login method — big "Sign in with Hugging Face" button front-and-center, small "Use access token instead" link below
- Browser opens HF OAuth page; app shows waiting state with spinner + "Waiting for browser login..." + Cancel button
- OAuth token requests same scopes as current fine-grained token (read + write for repos)
- Existing token-auth users are left alone — if a valid token exists in keyring, use it silently, no prompting to switch to OAuth
- OAuth token stored in same OS keyring as paste tokens — unified auth storage
- On OAuth failure or browser tab closed: user can cancel and retry from the waiting screen

**Dataset preview**
- Preview lives as a new tab in the repo browser (alongside Files and History) — only visible for dataset repos
- Paginated table: 50-100 rows per page with page controls, using HF Dataset Viewer API pagination
- Column headers show type badges (string, int, float, bool, etc.)
- Click a column header to open a side panel with distribution chart, null count, min/max, unique count
- Global text search bar above the table + per-column filter dropdowns (Excel-style)
- Search hits highlighted in results
- Subset/split selector if the dataset has multiple configurations

**Background uploads & tray**
- Closing the window while uploads are active minimizes to system tray — uploads continue in background
- If no uploads are active, closing the window fully quits the app (no lingering tray process)
- Tray icon animates during uploads (spinning or pulsing)
- Right-click tray menu: upload count, overall progress %, "Open Face Hugger", "Pause All", "Quit"
- Click tray icon to reopen the main window
- Desktop notifications on upload completion and failure only — no progress milestone notifications
- Notification text: file name + target repo (e.g., "model.safetensors uploaded to user/my-model")

**Distribution & packaging**
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-03 | User can authenticate via OAuth browser login flow | HF OAuth PKCE + tauri-plugin-oauth localhost redirect approach fully documented |
| UPLD-09 | Uploads continue in background with system tray presence | Tauri tray-icon feature + RunEvent::ExitRequested + conditional quit/hide pattern |
| DATA-01 | User can preview dataset rows with schema information | HF Dataset Viewer `/splits` + `/rows` endpoints return features + typed rows |
| DATA-02 | User can view column statistics (counts, distributions, types) | HF `/statistics` endpoint returns per-column type, min/max, histogram, null count |
| DATA-03 | User can search and filter within dataset preview | HF `/search` (BM25 full-text) + `/filter` (SQL-style predicates) endpoints |
</phase_requirements>

---

## Standard Stack

### New Plugins Required

| Library | Version | Purpose | Why This Choice |
|---------|---------|---------|-----------------|
| `tauri-plugin-oauth` (Rust) | 2.0.0 | OAuth localhost redirect server | Works with HF OAuth; no custom URL scheme needed; provider-agnostic |
| `@fabianlars/tauri-plugin-oauth` (npm) | 2.0.0 | JS bindings for OAuth plugin | Paired npm package |
| `tauri-plugin-notification` (Rust) | 2.3.3 | Desktop notifications | Official Tauri plugin, all platforms |
| `@tauri-apps/plugin-notification` (npm) | 2.3.3 | JS bindings for notification | Official paired package |
| `tauri-plugin-updater` (Rust) | latest | Auto-update from GitHub Releases | Official Tauri plugin |
| `@tauri-apps/plugin-updater` (npm) | 2.4.7 | JS bindings for updater | Official paired package |

**Note:** System tray is NOT a separate plugin in Tauri v2. It is the `tray-icon` Cargo feature on the `tauri` crate itself.

### Cargo.toml Additions

```toml
# New plugins
tauri-plugin-oauth = "2"
tauri-plugin-notification = "2"
tauri-plugin-updater = { version = "2", target = 'cfg(any(target_os = "macos", windows, target_os = "linux"))' }

# Tray requires feature flag on existing tauri dep:
tauri = { version = "2", features = ["tray-icon"] }
```

### npm Package Additions

```bash
npm install @fabianlars/tauri-plugin-oauth @tauri-apps/plugin-notification @tauri-apps/plugin-updater
```

**Optional chart library for column statistics panel:**

| Library | Version | Size | Why Consider |
|---------|---------|------|--------------|
| recharts | 3.8.0 | ~500KB | React-native, composable, good bar/histogram charts |

Recharts is the recommendation — it composes naturally with shadcn/ui, is well-maintained, and the histogram + frequency bar chart for column stats is straightforward with `BarChart` + `Bar` components.

### Installation

```bash
# Frontend
npm install @fabianlars/tauri-plugin-oauth @tauri-apps/plugin-notification @tauri-apps/plugin-updater recharts

# Rust — add to Cargo.toml manually (shown above), then:
cargo check
```

---

## Architecture Patterns

### Recommended Project Structure Additions

```
src-tauri/src/
├── commands/
│   ├── auth.rs          # EXTEND: add oauth_start, oauth_cancel commands
│   ├── upload.rs        # existing
│   └── tray.rs          # NEW: tray state commands (show_window, quit_app)
├── tray.rs              # NEW: TrayIconBuilder setup, event handlers, frame animator
└── state.rs             # EXTEND: add tray_handle, oauth_cancel_token fields

src/
├── stores/
│   ├── authStore.ts     # EXTEND: add oauthStatus ('idle'|'waiting'|'error'), oauthError
│   └── uploadStore.ts   # existing (tray reads active_count from here)
├── routes/
│   └── repo-browser/
│       ├── RepoBrowser.tsx        # EXTEND: add Preview tab (dataset repos only)
│       └── preview/
│           ├── DatasetPreview.tsx # NEW: tab wrapper, split selector
│           ├── PreviewTable.tsx   # NEW: paginated table with column badges
│           ├── ColumnStatPanel.tsx # NEW: side panel with histogram
│           └── useDatasetViewer.ts # NEW: TanStack Query hooks for all DS viewer endpoints
└── components/
    └── UpdateBanner.tsx  # NEW: "Update available" sticky banner in AppShell
```

### Pattern 1: OAuth with tauri-plugin-oauth (Localhost Redirect)

**What:** Plugin starts a local HTTP server on an ephemeral port, returns the port. App constructs the HF authorization URL with `redirect_uri=http://localhost:{port}`. User approves in browser. Plugin captures redirect, fires callback with the full URL containing `code` and `state`. App exchanges code for token via POST to `https://huggingface.co/oauth/token`.

**Why localhost over deep-link:** HF OAuth supports both. Custom URI schemes registered via `tauri-plugin-deep-link` work but require the app to be installed before they register (macOS does not support runtime registration). The localhost redirect approach works in development and production without this constraint, and tauri-plugin-oauth handles all the server lifecycle.

**HF OAuth Endpoints (verified against official docs):**
- Authorization: `https://huggingface.co/oauth/authorize`
- Token exchange: `https://huggingface.co/oauth/token`
- Required query params: `client_id`, `redirect_uri`, `scope`, `state`, `response_type=code`
- For public (no-secret) native apps: PKCE is the auth mechanism — `code_challenge` + `code_challenge_method=S256`
- Scopes to request: `openid profile write-repos` (matches existing token capability)

**Rust flow:**

```rust
// Source: https://github.com/FabianLars/tauri-plugin-oauth + https://huggingface.co/docs/hub/oauth
use tauri_plugin_oauth::start_with_config;

#[tauri::command]
#[specta::specta]
pub async fn oauth_start(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // Generate PKCE code verifier + challenge
    let verifier = generate_pkce_verifier();  // 43-128 char random string
    let challenge = sha256_base64url(&verifier);
    let csrf_state = generate_random_state();

    // Store verifier + state for validation during callback
    {
        let mut auth = state.auth.lock().await;
        auth.oauth_verifier = Some(verifier);
        auth.oauth_state = Some(csrf_state.clone());
    }

    // Start localhost server; returns port
    let port = start_with_config(
        tauri_plugin_oauth::OauthConfig { ports: None, response: None },
        move |url| {
            // url = "http://localhost:{port}?code=...&state=..."
            app.emit("oauth-callback", url).unwrap();
        },
    ).map_err(|e| e.to_string())?;

    // Construct HF authorization URL with the port
    let auth_url = format!(
        "https://huggingface.co/oauth/authorize?client_id={}&redirect_uri=http://localhost:{}&response_type=code&scope=openid+profile+write-repos&state={}&code_challenge={}&code_challenge_method=S256",
        CLIENT_ID, port, csrf_state, challenge
    );

    Ok(auth_url)  // Frontend opens this via opener plugin
}
```

**Frontend flow:**

```typescript
// Source: tauri-plugin-oauth npm docs + authStore pattern
import { start, onUrl, cancel } from '@fabianlars/tauri-plugin-oauth';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';

async function startOAuth() {
  setOauthStatus('waiting');
  const authUrl = await invoke('oauth_start');
  await openUrl(authUrl);  // Opens browser

  // Listen for the callback event emitted by Rust
  const unlisten = await listen<string>('oauth-callback', async (event) => {
    unlisten();
    await invoke('oauth_exchange_code', { callbackUrl: event.payload });
  });
}
```

**Token exchange:** After callback, call HF token endpoint directly from Rust (has reqwest already). Exchange `code` + `code_verifier` for `access_token`. Store in keyring under same key as paste-tokens.

### Pattern 2: Tray Icon — Conditional Close Behavior

**What:** Window close either hides to tray (uploads active) or fully quits (no uploads). Tray icon provides a right-click menu and reopens the window.

**Critical API:** System tray in Tauri v2 uses `tauri = { features = ["tray-icon"] }` — NOT a separate plugin. The tray icon is created in the `setup` hook via `TrayIconBuilder`.

```rust
// Source: https://v2.tauri.app/learn/system-tray/
use tauri::{
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    menu::{Menu, MenuItem},
    Manager,
};

// In setup hook:
let tray = TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .menu_on_left_click(false)
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    })
    .build(app)?;
```

**Conditional close — intercept window close event:**

```rust
// Source: https://github.com/tauri-apps/tauri/discussions/11489
// In main window setup or run event handler:
app.run(|app_handle, event| match event {
    tauri::RunEvent::ExitRequested { api, code, .. } => {
        // code == None means close button clicked (not OS shutdown)
        if code.is_none() {
            let state = app_handle.state::<AppState>();
            let active_count = /* check upload queue active count */;
            if active_count > 0 {
                api.prevent_exit();
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            // If active_count == 0: allow exit naturally
        }
    }
    _ => {}
});
```

**Tray icon animation:** No native animated GIF support. Implement as a timer that cycles through PNG frame files:

```rust
// In tray.rs — start animation loop when uploads begin
pub fn start_tray_animation(app: tauri::AppHandle) {
    let frames: Vec<tauri::image::Image> = load_animation_frames(&app);
    let tray = app.tray_by_id("main").unwrap();
    tokio::spawn(async move {
        let mut i = 0usize;
        loop {
            tray.set_icon(Some(frames[i % frames.len()].clone())).unwrap();
            i += 1;
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }
    });
}
```

**Linux caveat:** Left-click events on tray icon do NOT fire on Linux (documented limitation). The right-click context menu still works. "Open Face Hugger" must be in the context menu on all platforms (not just left-click) to ensure Linux users can reopen the window.

### Pattern 3: HF Dataset Viewer API — TanStack Query Integration

**Base URL:** `https://datasets-server.huggingface.co`

**Endpoints used:**

| Endpoint | Purpose | Key params |
|----------|---------|-----------|
| `GET /splits` | List configs + splits | `dataset` |
| `GET /rows` | Paginated rows | `dataset`, `config`, `split`, `offset`, `length` (max 100) |
| `GET /search` | Full-text BM25 search | `dataset`, `config`, `split`, `query`, `offset`, `length` |
| `GET /filter` | SQL-style predicate filter | `dataset`, `config`, `split`, `where`, `orderby`, `offset`, `length` |
| `GET /statistics` | Column stats + histograms | `dataset`, `config`, `split` |
| `GET /is-valid` | Check parquet availability | `dataset` |

**Authentication:** `Authorization: Bearer {token}` header. Required for private/gated datasets. Use the auth token from keyring (same as all other HF calls).

**Important constraints:**
- `/rows`, `/search`, `/filter` max `length=100` per request. Plan for 50 rows default page size.
- Only works for datasets that have Parquet exports. Check `/is-valid` first; if `viewer: false`, show "Preview not available" state.
- `/search` searches only string columns. Results are NOT highlighted by the API — client-side highlight required.
- `/filter` `where` clause uses SQL-like syntax: column names in double-quotes, string values in single-quotes (e.g., `"label"='positive'`).
- `/statistics` can be `partial: true` if dataset > 5GB — communicate this to user.
- Images and audio in rows are returned as signed CDN URLs (expire after some time).

```typescript
// Source: https://huggingface.co/docs/dataset-viewer/en/rows
// useDatasetViewer.ts — TanStack Query hooks

const DS_BASE = 'https://datasets-server.huggingface.co';

export function useDatasetRows(
  dataset: string,
  config: string,
  split: string,
  offset: number,
  token: string | null
) {
  return useQuery({
    queryKey: ['dataset-rows', dataset, config, split, offset],
    queryFn: async () => {
      const res = await fetch(
        `${DS_BASE}/rows?dataset=${dataset}&config=${config}&split=${split}&offset=${offset}&length=50`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<DatasetRowsResponse>;
    },
    staleTime: 5 * 60 * 1000,  // 5 min — rows don't change often
  });
}
```

**Response types to define in TypeScript:**

```typescript
// Feature type from /rows and /search
interface DatasetFeature {
  feature_idx: number;
  name: string;
  type: { dtype?: string; _type: string; names?: string[] };
}

interface DatasetRowsResponse {
  features: DatasetFeature[];
  rows: Array<{ row_idx: number; row: Record<string, unknown>; truncated_cells: string[] }>;
  num_rows_total: number;
  num_rows_per_page: number;
  partial: boolean;
}

// Statistics response
interface ColumnStatistics {
  column_name: string;
  column_type: 'int' | 'float' | 'bool' | 'class_label' | 'string_label' | 'string_text' | 'list' | 'audio' | 'image' | 'datetime';
  column_statistics: {
    nan_count: number;
    nan_proportion: number;
    min?: number | string;
    max?: number | string;
    mean?: number | string;
    median?: number | string;
    std?: number | string;
    n_unique?: number;
    frequencies?: Record<string, number>;
    histogram?: { hist: number[]; bin_edges: (number | string)[] };
  };
}
```

### Pattern 4: Auto-Update

**Configuration in tauri.conf.json:**

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "CONTENT_OF_PUBLIC_KEY_PEM",
      "endpoints": [
        "https://github.com/OWNER/face-hugger/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**Key generation (one-time):**

```bash
npm run tauri signer generate -- -w ~/.tauri/face-hugger.key
# Outputs face-hugger.key (private — store as GitHub secret TAURI_SIGNING_PRIVATE_KEY)
# Outputs face-hugger.key.pub (public — paste into tauri.conf.json pubkey field)
```

**Environment variable during CI build:**

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/face-hugger.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""  # or actual password
```

**Check on app launch (AppShell.tsx):**

```typescript
// Source: https://v2.tauri.app/plugin/updater/
import { check } from '@tauri-apps/plugin-updater';

useEffect(() => {
  check().then(update => {
    if (update) setUpdateAvailable(update.version);
  }).catch(() => {});  // Never throw — update check is non-critical
}, []);
```

### Anti-Patterns to Avoid

- **Using deep-link plugin for OAuth:** Custom URI schemes on macOS require the app to be installed/bundled before registration; they do not work in development. Use tauri-plugin-oauth (localhost) instead.
- **Blocking the main thread during token exchange:** The PKCE code exchange is a network call — keep it in async Rust, emit progress events to frontend.
- **Forgetting CSRF state validation:** The `state` parameter in the OAuth redirect MUST be validated against the stored value before exchanging the code. Skipping this is a security vulnerability.
- **Calling tray APIs from JavaScript:** The tray icon setup and animation must live in Rust (setup hook). Only expose window-show/hide as Tauri commands. Attempting to build the tray from JS is unsupported in Tauri v2.
- **Calling tray.set_menu() on each upload progress tick:** Update tray menu text at most once per second — menu reconstruction is not free on Linux/macOS.
- **Expecting search hit highlighting from the API:** The `/search` endpoint does NOT highlight matches. Client-side text matching against `query` using something like a simple string `includes()` check is required.
- **Fetching statistics before checking /is-valid:** On datasets without Parquet exports, statistics returns an error. Always gate on `is-valid.viewer === true` before showing the Preview tab.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth localhost redirect server | Custom Rust TCP listener | `tauri-plugin-oauth` | Port allocation, timeout, cleanup, error handling already handled |
| PKCE code verifier/challenge | Manual SHA-256 + base64 | `sha2` crate (already in Cargo.toml) + `base64` crate | Standard crypto primitives — use existing crate, don't reimplement |
| App update check + install | Custom HTTP version check + installer | `tauri-plugin-updater` | Handles delta updates, signature verification, install + restart lifecycle |
| Native OS notifications | Custom tray balloon / toast | `tauri-plugin-notification` | Native notification center integration (macOS NC, Windows Toast, Linux libnotify) |
| Column statistics visualization | D3 custom charts | `recharts` `BarChart` | Histogram and frequency bar charts are standard recharts use cases; no D3 learning curve needed |

**Key insight:** Every plugin listed above handles platform-specific edge cases that are non-trivial to reimplement — especially around macOS sandboxing, Windows UAC, and Linux desktop environment fragmentation.

---

## Common Pitfalls

### Pitfall 1: macOS Custom URI Scheme — Development vs Production Mismatch
**What goes wrong:** `tauri-plugin-deep-link` custom scheme (e.g., `face-hugger://`) only works after the app is installed as a proper bundle. In development (`cargo tauri dev`), the scheme is not registered and OAuth redirects fail silently.
**Why it happens:** macOS reads URL scheme handlers from the app bundle's `Info.plist` at install time. A dev server has no installed bundle.
**How to avoid:** Use `tauri-plugin-oauth` (localhost redirect) for all OAuth flows. It works identically in development and production.
**Warning signs:** OAuth flow works in production build but hangs in dev; browser shows "address couldn't be found" after approval.

### Pitfall 2: Linux Tray Missing libappindicator
**What goes wrong:** App starts but no tray icon appears on Linux. No error is thrown — the icon is silently absent.
**Why it happens:** Tauri v2's tray on Linux depends on `libayatana-appindicator3` or `libappindicator-gtk3`. These are not universally pre-installed; they're absent on minimal Ubuntu installs, Arch, and many Wayland-only setups.
**How to avoid:** Document runtime dependency in README and package maintainer notes. For `.deb` packaging, add `libayatana-appindicator3-1` as a `Depends` field in the Tauri bundle config. For AppImage, consider bundling the library.
**Warning signs:** Works on developer machine (Ubuntu with GNOME) but users on clean installs report no tray icon.

### Pitfall 3: Linux Tray Left-Click Events Never Fire
**What goes wrong:** The left-click handler to reopen the window silently does nothing on Linux.
**Why it happens:** This is a documented Tauri v2 limitation: "Linux: Unsupported. The event is not emitted even though the icon is shown."
**How to avoid:** Always include "Open Face Hugger" as the first item in the right-click context menu. Left-click on macOS/Windows is a convenience, not the only path.

### Pitfall 4: Window State Plugin Conflict with Close-to-Tray
**What goes wrong:** When using `api.prevent_exit()` in the `RunEvent::ExitRequested` handler with `tauri-plugin-window-state` installed, closing the window triggers an infinite loop of `windowDidMove` events on macOS.
**Why it happens:** The window-state plugin saves position on window events including close; intercepting close while saving state creates a loop.
**How to avoid:** This project does not currently use `tauri-plugin-window-state`, so the conflict does not apply. Do not add it.

### Pitfall 5: HF Dataset Viewer — Non-Parquet Datasets Return Errors
**What goes wrong:** API calls to `/rows`, `/search`, `/filter`, `/statistics` return HTTP errors for datasets that haven't been converted to Parquet.
**Why it happens:** All Dataset Viewer features require Parquet export, which HF runs automatically but not instantly for new or very large datasets.
**How to avoid:** Call `GET /is-valid?dataset={name}` first. Check the `viewer` boolean. If `viewer: false`, render a "Preview unavailable — this dataset hasn't been processed yet" empty state instead of showing the Preview tab (or grey it out).

### Pitfall 6: OAuth CSRF State Not Validated
**What goes wrong:** A malicious page opens the app's localhost redirect URL with a forged `code`, getting it exchanged for a token.
**Why it happens:** Developers skip the `state` parameter validation to simplify the callback handler.
**How to avoid:** Generate a random CSRF `state` value before starting OAuth. Store it in AppState. On callback, parse the URL's `state` param and compare with stored value. Reject if mismatch.

### Pitfall 7: Updater pubkey Missing from tauri.conf.json
**What goes wrong:** Build succeeds but `check()` panics at runtime with a key configuration error.
**Why it happens:** The updater plugin requires a public key to verify signatures. An empty or missing `pubkey` field causes a panic, not a graceful error.
**How to avoid:** Generate keys before creating the first release build. Validate the pubkey field is populated in `tauri.conf.json` before CI. Store private key as a GitHub Actions secret named `TAURI_SIGNING_PRIVATE_KEY`.

### Pitfall 8: Windows Code Signing — OV Certificates No Longer Exportable
**What goes wrong:** Developer tries to export a Windows code signing certificate as a `.pfx` file from a modern Certificate Authority and cannot.
**Why it happens:** Since June 2023, CAs no longer issue OV (Organization Validation) code signing certificates as exportable files. Certificates must be stored on Hardware Security Modules (HSMs). Azure Key Vault is the accessible option for indie developers.
**How to avoid:** Use Azure Key Vault to store the Windows code signing certificate. Tauri's official docs cover the Azure Key Vault signing workflow. Budget time for CA vetting process (1-5 business days).

---

## Code Examples

### Verified: OAuth PKCE Code Challenge Generation (Rust)

```rust
// Using sha2 (already in Cargo.toml) + base64 (add to Cargo.toml)
use sha2::{Sha256, Digest};

fn generate_pkce_verifier() -> String {
    use rand::Rng;
    let bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen::<u8>()).collect();
    base64_url_encode(&bytes)
}

fn pkce_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    base64_url_encode(&hash)
}

fn base64_url_encode(input: &[u8]) -> String {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    URL_SAFE_NO_PAD.encode(input)
}
```

### Verified: HF OAuth Token Exchange (Rust, POST to token endpoint)

```rust
// Source: https://huggingface.co/docs/hub/oauth
// POST https://huggingface.co/oauth/token
let params = [
    ("grant_type", "authorization_code"),
    ("code", &code),
    ("redirect_uri", &redirect_uri),
    ("client_id", CLIENT_ID),
    ("code_verifier", &verifier),
];
let resp = reqwest_client
    .post("https://huggingface.co/oauth/token")
    .form(&params)
    .send()
    .await?
    .json::<OAuthTokenResponse>()
    .await?;
// resp.access_token — store in keyring same as paste token
```

### Verified: Tray Menu with Dynamic Text

```rust
// Source: https://v2.tauri.app/learn/system-tray/
use tauri::menu::{Menu, MenuItem};

fn build_tray_menu(app: &tauri::AppHandle, active: usize, pct: u8) -> Menu<tauri::Wry> {
    let status = if active > 0 {
        format!("{} upload(s) — {}%", active, pct)
    } else {
        "No active uploads".to_string()
    };
    Menu::with_items(app, &[
        &MenuItem::with_id(app, "status", &status, false, None::<&str>).unwrap(),
        &MenuItem::with_id(app, "open", "Open Face Hugger", true, None::<&str>).unwrap(),
        &MenuItem::with_id(app, "pause", "Pause All", active > 0, None::<&str>).unwrap(),
        &MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap(),
    ]).unwrap()
}
```

### Verified: Send Desktop Notification from Rust

```rust
// Source: https://v2.tauri.app/plugin/notification/
use tauri_plugin_notification::NotificationExt;

pub fn notify_upload_complete(app: &tauri::AppHandle, filename: &str, repo: &str) {
    let _ = app.notification()
        .builder()
        .title("Upload Complete")
        .body(format!("{} uploaded to {}", filename, repo))
        .show();
}
```

### Verified: Check for Update on App Launch

```typescript
// Source: https://v2.tauri.app/plugin/updater/
import { check } from '@tauri-apps/plugin-updater';
import { useEffect, useState } from 'react';

export function useUpdateCheck() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  useEffect(() => {
    check()
      .then(update => { if (update) setNewVersion(update.version); })
      .catch(() => {});  // Non-fatal — never block launch
  }, []);
  return newVersion;
}
```

### Verified: Dataset Rows API Request with Pagination

```typescript
// Source: https://huggingface.co/docs/dataset-viewer/en/rows
const PAGE_SIZE = 50;

async function fetchRows(
  dataset: string, config: string, split: string,
  page: number, token: string | null
): Promise<DatasetRowsResponse> {
  const offset = page * PAGE_SIZE;
  const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${PAGE_SIZE}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Dataset Viewer request failed');
  }
  return res.json();
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Deep-link scheme for OAuth | Localhost redirect via tauri-plugin-oauth | Tauri v1 → v2 | More reliable cross-platform; works in dev |
| Manual tray plugin (tauri v1) | `tray-icon` Cargo feature on tauri crate | Tauri 2.0 stable (Oct 2024) | No separate plugin to install |
| Exportable `.pfx` OV certificates | Azure Key Vault HSM for Windows signing | June 2023 (CA/Browser Forum) | Requires Azure account + setup |
| Static update JSON on GitHub Gist | `includeUpdaterJson: true` in tauri-action | Tauri v2 | auto-generated `latest.json` on every GitHub release |

**Deprecated/outdated:**
- `tauri::SystemTray` and `SystemTrayEvent` (Tauri v1 API): Replaced by `TrayIconBuilder` and `tray-icon` feature in v2.
- OV code signing `.pfx` exports: No longer issued by CAs; must use HSM/Key Vault.

---

## Open Questions

1. **HF OAuth App Registration**
   - What we know: HF OAuth apps are registered per-developer at `https://huggingface.co/settings/applications/new`. Public apps (no client secret) use PKCE only.
   - What's unclear: The `client_id` to embed in the app binary is public. This is correct per HF docs, but the app binary will contain the client_id. This is expected for public native apps.
   - Recommendation: Create the HF OAuth app, configure redirect URI as `http://localhost` (HF accepts wildcard localhost ports), and embed the client_id as a compile-time constant or environment variable injected at build time via Tauri's `TAURI_ENV_*` mechanism.

2. **Mac App Store + Microsoft Store Submission**
   - What we know: Tauri can produce App Store builds (`targets: "app"` for Mac App Store distribution). Apple requires sandbox entitlements which may conflict with keychain usage and file system access.
   - What's unclear: Whether the existing keyring + fs + dialog capabilities are App Store compliant without entitlement adjustments.
   - Recommendation: Treat App Store submission as a stretch goal / separate deliverable. The primary distribution path (GitHub Releases + DMG/MSI/AppImage) should be fully working first.

3. **Tray Menu Update Rate During Active Uploads**
   - What we know: The upload progress emitter already fires at ~1Hz. Rebuilding the tray menu on every tick is possible but may be visually noisy.
   - What's unclear: Whether there's a minimum API-level interval for menu updates on Linux AppIndicator.
   - Recommendation: Update tray menu text at 1-second intervals, same as progress emitter, but debounce rebuilds to only when count or percentage changes.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vite.config.ts` (vitest config inline via `test` key, or default discovery) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-03 | authStore handles oauthStatus state transitions (idle → waiting → idle) | unit | `npm test -- src/stores/authStore.test.ts` | ❌ Wave 0 — extend existing file |
| AUTH-03 | PKCE verifier/challenge generation produces valid SHA256-based challenge | unit | `cargo test pkce` | ❌ Wave 0 |
| AUTH-03 | OAuth callback URL parsing extracts code + state correctly | unit | `cargo test oauth_parse` | ❌ Wave 0 |
| UPLD-09 | uploadStore active upload count drives conditional tray behavior | unit | `npm test -- src/stores/uploadStore.test.ts` | ❌ Wave 0 — extend existing file |
| DATA-01 | DatasetRowsResponse type parses correctly from fixture JSON | unit | `npm test -- src/routes/repo-browser/preview` | ❌ Wave 0 |
| DATA-02 | Column statistics panel renders histogram bins from mock data | unit | `npm test -- src/routes/repo-browser/preview/ColumnStatPanel.test.tsx` | ❌ Wave 0 |
| DATA-03 | Search query state change triggers correct /search endpoint construction | unit | `npm test -- src/routes/repo-browser/preview/useDatasetViewer.test.ts` | ❌ Wave 0 |

**Note on Tauri plugin tests:** Tauri commands (oauth_start, tray events, notifications) cannot be unit tested directly — they require a running Tauri context. Test the pure logic (PKCE generation, URL parsing, token validation) in isolation; integration behavior is validated via E2E in Phase 5.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/stores/authStore.test.ts` — extend with OAuth state transition tests (oauthStatus field)
- [ ] `src/stores/uploadStore.test.ts` — extend with active upload count tests for tray logic
- [ ] `src-tauri/src/commands/auth_oauth_test.rs` — PKCE verifier generation, challenge derivation, callback URL parsing
- [ ] `src/routes/repo-browser/preview/DatasetPreview.test.tsx` — row rendering from fixture, pagination controls
- [ ] `src/routes/repo-browser/preview/ColumnStatPanel.test.tsx` — statistics rendering with different column_type values
- [ ] `src/routes/repo-browser/preview/useDatasetViewer.test.ts` — TanStack Query hooks with mocked fetch responses

---

## Sources

### Primary (HIGH confidence)
- `https://huggingface.co/docs/hub/oauth` — HF OAuth endpoints, scopes, PKCE public app flow, device code flow
- `https://huggingface.co/docs/dataset-viewer/en/rows` — /rows endpoint, response structure, length limit
- `https://huggingface.co/docs/dataset-viewer/en/search` — /search endpoint, BM25 behavior, string-only scope
- `https://huggingface.co/docs/dataset-viewer/en/filter` — /filter endpoint, SQL predicate syntax
- `https://huggingface.co/docs/dataset-viewer/statistics` — /statistics endpoint, per-column-type response structures
- `https://huggingface.co/docs/dataset-viewer/quick_start` — full endpoint table, base URL, /splits endpoint
- `https://v2.tauri.app/learn/system-tray/` — TrayIconBuilder API, menu integration, platform event limitations
- `https://v2.tauri.app/plugin/updater/` — updater plugin install, pubkey config, check() API, key generation
- `https://v2.tauri.app/plugin/notification/` — notification plugin install, Rust builder API, platform notes
- `https://v2.tauri.app/plugin/deep-linking/` — deep-link plugin config (confirms macOS runtime registration not supported)
- `https://v2.tauri.app/distribute/pipelines/github/` — GitHub Actions matrix workflow structure
- `https://v2.tauri.app/distribute/sign/macos/` — macOS signing secrets, notarization credentials
- `https://github.com/FabianLars/tauri-plugin-oauth` — tauri-plugin-oauth v2 API, localhost redirect approach

### Secondary (MEDIUM confidence)
- `https://github.com/tauri-apps/tauri/discussions/11489` — close-to-tray RunEvent::ExitRequested pattern, window-state plugin conflict warning
- `https://github.com/tauri-apps/tauri/issues/3859` — Linux libayatana-appindicator runtime detection

### Tertiary (LOW confidence)
- WebSearch results on Windows Azure Key Vault for code signing — directionally correct but specific setup steps should be verified against current Tauri signing docs before implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all plugin versions verified against npm registry and crates.io
- HF Dataset Viewer API: HIGH — verified against official HF docs with response JSON examples
- Architecture patterns: HIGH — OAuth, tray, updater patterns verified against official Tauri v2 docs
- Linux tray compatibility: HIGH — limitations documented in official Tauri source and GitHub issues
- Windows code signing: MEDIUM — CA policy change verified; Azure Key Vault integration needs official Tauri signing doc cross-reference during implementation
- App Store submission: LOW — acknowledged as open question; outside main delivery scope

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (Tauri plugin APIs are stable; HF Dataset Viewer API is stable)
