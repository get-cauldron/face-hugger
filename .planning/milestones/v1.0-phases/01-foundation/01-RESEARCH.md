# Phase 1: Foundation - Research

**Researched:** 2026-03-19
**Domain:** Tauri v2 desktop app scaffold — HF token auth, OS keychain, app shell, custom titlebar, repo listing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Login experience:**
- Full-screen login on first launch — centered card with Face Hugger icon, token field, welcome message, nothing else until authenticated
- Auto-detect existing `~/.huggingface/token` (or `~/.cache/huggingface/token`) before showing paste field — skip login if valid token found
- If no existing token: single paste field with clear instructions and a link to HF token page
- On valid token: instant transition — validate against HF API, flash green check with username/avatar, slide into main app
- On invalid token: inline red error text under the field — "Invalid token — check your HF settings" with a link to HF token settings page
- Token stored in OS keyring immediately after validation (macOS Keychain, Windows Credential Manager, Linux Secret Service)

**App shell & navigation:**
- Custom titlebar — no native titlebar, custom drag region with app title and window controls (like Spotify, Discord)
- Left sidebar — full panel style with section headers, not just icons
- Sidebar sections for Phase 1: Upload (placeholder/disabled until Phase 2), Models, Datasets, Settings
- Recent repos (last 3-5 accessed) shown under each section for quick access
- User info (avatar + username) at sidebar bottom — click for settings/logout (like Discord, Slack)
- Minimum window size: 800x600
- Sidebar is not collapsible in Phase 1 — full panel always visible

**Repo list display:**
- Hybrid view: card grid default, toggleable to table/list view — user chooses density
- Card info: repo name, type badge (model/dataset), visibility (public/private), total size, file count, HF tags as small badges
- Search bar + filter by type (model/dataset) and visibility (public/private) available from Phase 1
- Sort order: user-selectable dropdown (last updated, alphabetical, size), app remembers preference
- Empty state: friendly illustration + "Create your first repo" CTA button
- Models and Datasets are separate sections in sidebar, each with their own repo list view

**Visual identity:**
- Dark theme by default, light mode available in settings
- Warm orange/amber accent color palette — matches the Face Hugger icon, orange accents on dark background
- Playful touches — icon in sidebar, fun empty states, personality in microcopy (like Raycast or Arc)
- Mixed shape language — rounded containers (generous border-radius on cards, panels), sharper inner elements (like macOS)
- Spacious information density — generous whitespace, breathing room (like Apple apps)
- Subtle polish motion — smooth page transitions, hover effects, loading shimmers, not distracting
- shadcn/ui components as base, customized to match the warm orange/dark theme

### Claude's Discretion
- Font choice (system fonts vs Inter vs Geist — pick what fits the warm/spacious design)
- Repo list pagination strategy (pick based on HF API pagination behavior)
- Loading skeleton design for repo list
- Exact animation easing curves and durations
- Error state handling beyond token validation
- Exact spacing scale and typography sizes

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can authenticate by pasting an HF access token | `whoAmI()` from `@huggingface/hub` validates token; `/api/whoami-v2` REST endpoint for Rust-side validation; file read of `~/.cache/huggingface/token` for auto-detect |
| AUTH-02 | Token is stored securely in the OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service) | `keyring` Rust crate (via `tauri-plugin-keyring` wrapper) provides cross-platform OS keychain storage; do NOT use `tauri-plugin-store` JSON for token |
| AUTH-04 | App displays authenticated user info (username, avatar, token scopes) | `whoAmI()` returns `{ name, avatarUrl, type, orgs }` — avatar is a URL pointing to `https://huggingface.co/avatars/{hash}.svg`; display with `<img src={avatarUrl}>`  |
| REPO-01 | User can browse their HF repos (models and datasets) | `listModels({ search: { owner: username } })` and `listDatasets(...)` from `@huggingface/hub`; both are async iterators; wrap in TanStack Query via Tauri invoke |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire app skeleton that all subsequent phases extend. The work divides cleanly into three streams: (1) the Rust backend — auth command, keychain storage, HF API client, tauri-specta IPC setup; (2) the React frontend shell — custom titlebar, sidebar layout, routing scaffold, Zustand and TanStack Query providers; (3) the first user-facing features — login screen, user info display, and repo listing with search/filter.

The technical surface is well-understood. Tauri v2 with `decorations: false` plus the `data-tauri-drag-region` attribute is the canonical custom-titlebar pattern. The `keyring` Rust crate (or its Tauri plugin wrapper `tauri-plugin-keyring`) provides OS keychain access on macOS, Windows, and Linux without custom implementations. Token validation uses `@huggingface/hub`'s `whoAmI()` on the JS side, but the Rust auth command should call `/api/whoami-v2` directly via reqwest since modern HF fine-grained tokens require the v2 endpoint (the older `/api/whoami` returns 401 for modern tokens). Repo listing uses `listModels()` and `listDatasets()` async iterators from `@huggingface/hub`, collected into arrays and cached by TanStack Query.

The existing token auto-detect path reads `~/.cache/huggingface/token` (the canonical path set by `huggingface-cli login`). The older `~/.huggingface/token` path is legacy and should also be checked as a fallback. Tauri's `path` plugin provides access to the home directory cross-platform.

**Primary recommendation:** Build the Rust auth command first (token validation + keychain read/write), wire tauri-specta IPC, then build the React shell and login screen on top. This ordering matches the build dependency graph and lets React be coded against typed Rust signatures from day one.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri | 2.10.1 | Desktop shell, IPC, native OS access | Greenfield decision; v2 API only |
| @tauri-apps/api | 2.10.1 | TypeScript IPC (`invoke`, `Channel`, `event`) | Official Tauri TS API |
| React | 19.2.4 | UI rendering | Official Tauri template; React 19 Compiler reduces memoization boilerplate |
| TypeScript | 5.9.3 | Type safety | Required for tauri-specta code generation |
| Vite | 8.0.1 | Build tool + dev server | Official Tauri bundler; HMR < 50ms |
| @huggingface/hub | 2.11.0 | HF Hub API — listModels, listDatasets, whoAmI | Official HF JS library; verified current |
| Zustand | 5.0.12 | Client UI state — auth session, user prefs | Zero boilerplate; standard in Tauri community templates |
| TanStack Query | 5.91.2 | Server state caching — repo lists | Caching, background refetch; v5 uses `isPending` not `isLoading` |
| shadcn/ui | latest (CLI) | Component library — cards, badges, inputs | Owned components, Radix UI primitives, accessible by default |
| Tailwind CSS | 4.2.2 | Utility styling | v4 is `latest` on npm; CSS-native `@theme` config, no tailwind.config.js |
| tauri-specta | 2.0.0-rc.21 | Type-safe IPC — generate TS types from Rust | Still rc but stable for locked versions; Tauri v2 only |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-controls / @tauri-controls/react | 0.4.0 | Native-looking window controls (macOS/Windows/Linux) | Custom titlebar — renders OS-appropriate min/max/close buttons |
| @tauri-apps/plugin-store | 2.4.2 | JSON key-value persistence | User preferences (theme, sort order, view mode) — NOT for tokens |
| @tauri-apps/plugin-opener | 2.5.3 | Open URLs in system browser | Link to HF token settings page from login screen |
| @tauri-apps/plugin-fs | 2.x | File system access | Read `~/.cache/huggingface/token` for auto-detect |
| keyring (Rust crate) | 3.x | OS keychain — macOS Keychain, Windows Credential Manager, Linux Secret Service | Token storage only; never use for user prefs |
| Lucide React | latest | Icons | Default shadcn/ui icon set |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `keyring` Rust crate | `tauri-plugin-store` (JSON) | Store writes plaintext to disk — violates AUTH-02 |
| `tauri-controls` | Hand-rolled window controls | tauri-controls renders platform-matched controls (macOS traffic lights, Windows caption buttons) correctly |
| `@tauri-apps/plugin-store` for prefs | SQLite | SQLite is overkill for simple key-value preferences; use Store, use SQLite only in Phase 2 for upload queue |
| TanStack Query wrapping `@huggingface/hub` JS calls directly | Routing calls through Rust | For Phase 1 browse-only reads, JS-side calls are fine; no need for Rust relay; Rust owns upload bytes in Phase 2 |

**Installation:**

```bash
# Frontend
npm install @huggingface/hub @tanstack/react-query zustand
npm install @tauri-apps/plugin-store @tauri-apps/plugin-opener @tauri-apps/plugin-fs
npm install tauri-controls
npx shadcn@latest init

# Dev
npm install -D vitest @testing-library/react
```

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-specta = { version = "2.0.0-rc.21", features = ["derive", "typescript"] }
specta-typescript = "0.0.9"
keyring = { version = "3", features = ["apple-native", "windows-native", "linux-secret-service", "async-secret-service"] }
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

**Version verification (confirmed 2026-03-19):**
- `@tauri-apps/api` → 2.10.1
- `@huggingface/hub` → 2.11.0
- `tailwindcss` → 4.2.2 (v4 is `latest`)
- `@tanstack/react-query` → 5.91.2
- `zustand` → 5.0.12
- `vitest` → 4.1.0
- `vite` → 8.0.1
- `react` → 19.2.4
- `typescript` → 5.9.3
- `@tauri-apps/plugin-store` → 2.4.2
- `@tauri-apps/plugin-opener` → 2.5.3
- `tauri-controls` → 0.4.0

---

## Architecture Patterns

### Recommended Project Structure

```
face-hugger/
├── package.json
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx                    # App entry — QueryClientProvider, Router, Providers
│   ├── App.tsx                     # Auth gate — LoginScreen | AppShell conditional render
│   ├── routes/
│   │   ├── models/
│   │   │   └── ModelsPage.tsx      # Repo list for models type
│   │   ├── datasets/
│   │   │   └── DatasetsPage.tsx    # Repo list for datasets type
│   │   └── settings/
│   │       └── SettingsPage.tsx    # Theme toggle, logout, token info
│   ├── components/
│   │   ├── shell/
│   │   │   ├── TitleBar.tsx        # Custom drag region + tauri-controls window buttons
│   │   │   ├── Sidebar.tsx         # Nav sections: Upload(disabled), Models, Datasets, Settings
│   │   │   └── UserBadge.tsx       # Avatar + username at sidebar bottom
│   │   ├── auth/
│   │   │   └── LoginScreen.tsx     # Full-screen login card
│   │   ├── repos/
│   │   │   ├── RepoGrid.tsx        # Card grid view
│   │   │   ├── RepoTable.tsx       # Table/list view
│   │   │   ├── RepoCard.tsx        # Single card: name, type badge, visibility, size, tags
│   │   │   ├── RepoListToolbar.tsx # Search, filter dropdowns, view toggle, sort
│   │   │   └── RepoEmptyState.tsx  # Friendly illustration + CTA
│   │   └── ui/                     # shadcn/ui components (Button, Input, Badge, Skeleton, etc.)
│   ├── stores/
│   │   └── authStore.ts            # { token, user, isAuthenticated, setAuth, clearAuth }
│   ├── queries/
│   │   └── useRepos.ts             # TanStack Query hooks for listModels + listDatasets
│   ├── commands/
│   │   └── auth.ts                 # Typed invoke wrappers: validateToken, logout, getStoredToken
│   └── lib/
│       ├── queryClient.ts          # TanStack Query client — staleTime: 5min, gcTime: 10min
│       └── types.ts                # Shared TS types
│
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json            # Window + store + opener + fs permissions
    ├── src/
    │   ├── main.rs                 # Desktop entry (calls lib::run)
    │   ├── lib.rs                  # App setup, state init, tauri-specta registration, plugin init
    │   ├── commands/
    │   │   ├── mod.rs
    │   │   └── auth.rs             # validate_token, logout, get_stored_token, check_existing_token
    │   ├── hf/
    │   │   ├── mod.rs
    │   │   └── client.rs           # reqwest client, whoami-v2 call, token validation
    │   └── state.rs                # AppState: AuthState { token, user_info }
    └── icons/
```

### Pattern 1: Auth Gate Component

**What:** `App.tsx` renders `<LoginScreen>` or `<AppShell>` based on `authStore.isAuthenticated`. On mount, calls the `getStoredToken` Rust command to check keychain — if found, validates against HF and hydrates the store without user action.

**When to use:** Every render cycle after initial mount.

```tsx
// Source: project architecture decision
function App() {
  const { isAuthenticated, setAuth } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getStoredToken()
      .then(token => token ? validateToken(token).then(setAuth) : null)
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <SplashScreen />;
  return isAuthenticated ? <AppShell /> : <LoginScreen />;
}
```

### Pattern 2: Custom Titlebar with tauri-controls

**What:** Set `decorations: false` in `tauri.conf.json`, add `data-tauri-drag-region` to the title bar div, use `@tauri-controls/react` for platform-matched window buttons.

**When to use:** Phase 1 establishes this — every window in the app uses it.

```json
// tauri.conf.json
{
  "app": {
    "windows": [{
      "decorations": false,
      "minWidth": 800,
      "minHeight": 600
    }]
  }
}
```

```tsx
// Source: tauri-controls README + Tauri v2 window customization docs
import { WindowTitlebar } from "tauri-controls";

function TitleBar() {
  return (
    <WindowTitlebar
      className="h-10 bg-sidebar flex items-center px-3"
      data-tauri-drag-region
    >
      <span className="text-sm font-medium text-sidebar-foreground">
        Face Hugger
      </span>
    </WindowTitlebar>
  );
}
```

**Known issue:** Resize when `decorations: false` has a reported bug in Tauri v2 on Windows (issue #8519). The workaround is to leave resizing enabled and handle border resize separately, or accept that resize requires dragging the window edge precisely. Test on Windows during implementation.

### Pattern 3: Token Validation via Rust Command

**What:** Rust `validate_token` command calls `/api/whoami-v2` (NOT `/api/whoami` — modern fine-grained tokens return 401 on the v1 endpoint). On success, stores token in OS keychain, returns UserInfo to frontend.

**When to use:** Login form submission and on-startup keychain token check.

```rust
// Source: HF Hub API docs + keyring crate docs
#[tauri::command]
async fn validate_token(
    token: String,
    state: tauri::State<'_, AppState>,
) -> Result<UserInfo, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://huggingface.co/api/whoami-v2")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err("Invalid token — check your HF settings".to_string());
    }

    let user_info: UserInfo = resp.json().await.map_err(|e| e.to_string())?;

    // Store in OS keychain
    let entry = keyring::Entry::new("face-hugger", "hf-token")
        .map_err(|e| e.to_string())?;
    entry.set_password(&token).map_err(|e| e.to_string())?;

    // Update in-memory state
    let mut auth = state.auth.lock().await;
    auth.token = Some(token);
    auth.user = Some(user_info.clone());

    Ok(user_info)
}
```

### Pattern 4: Repo Listing with TanStack Query

**What:** `useRepos` hooks wrap `@huggingface/hub` `listModels` / `listDatasets` async iterators, collecting results into arrays. TanStack Query caches results for 5 minutes (desktop — no aggressive refetch needed).

**When to use:** Models and Datasets pages.

```typescript
// Source: @huggingface/hub README + TanStack Query v5 docs
export function useModels(username: string, accessToken: string) {
  return useQuery({
    queryKey: ['repos', 'models', username],
    queryFn: async () => {
      const models: ModelEntry[] = [];
      for await (const model of listModels({
        search: { owner: username },
        accessToken,
        additionalFields: ['tags', 'private', 'downloads', 'lastModified'],
      })) {
        models.push(model);
      }
      return models;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!username && !!accessToken,
  });
}
```

**Note on pagination:** `listModels` is an async iterator that pages automatically. For Phase 1, collect the full list into an array and apply client-side filtering/sort. The HF API returns repos newest-first by default. For users with many repos (100+), consider adding a `limit` parameter to the iterator. The `@huggingface/hub` library handles cursor-based pagination internally.

### Pattern 5: tauri-specta IPC Registration

**What:** Register all commands with tauri-specta in `lib.rs` to generate TypeScript bindings. Call specta's `export_types()` during development to write `bindings.ts`. Lock with `PluginPermissions` in capabilities.

**When to use:** Set up once in Phase 1 — all future commands added to this registry.

```rust
// Source: tauri-specta README (v2.0.0-rc.21)
use tauri_specta::{collect_commands, ts};

pub fn run() {
    let (invoke_handler, register_events) =
        ts::builder()
            .commands(collect_commands![
                commands::auth::validate_token,
                commands::auth::logout,
                commands::auth::get_stored_token,
                commands::auth::check_existing_token,
            ])
            // In dev, export types to src/bindings.ts
            .build_plugin(tauri_specta::ExportConfig::new()
                .output_path("../src/bindings.ts"));

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(invoke_handler)
        .setup(|app| {
            register_events(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Pattern 6: Existing Token Auto-Detection

**What:** On startup, check for an existing token at `~/.cache/huggingface/token` before showing the login screen. If found, validate it against the HF API. If valid, skip login entirely.

**When to use:** Only on first startup before keychain is populated.

```rust
// Source: HF CLI docs + Tauri v2 path plugin
#[tauri::command]
async fn check_existing_token() -> Option<String> {
    // First check OS keychain (for returning users)
    if let Ok(entry) = keyring::Entry::new("face-hugger", "hf-token") {
        if let Ok(token) = entry.get_password() {
            return Some(token);
        }
    }

    // Then check HF CLI token file (for first-time Face Hugger users who already have HF CLI)
    let home = dirs::home_dir()?;
    let token_paths = [
        home.join(".cache/huggingface/token"),  // Current default (HF_HOME/token)
        home.join(".huggingface/token"),         // Legacy fallback
    ];

    for path in &token_paths {
        if let Ok(token) = std::fs::read_to_string(path) {
            let token = token.trim().to_string();
            if !token.is_empty() {
                return Some(token);
            }
        }
    }

    None
}
```

### Anti-Patterns to Avoid

- **Storing token in `tauri-plugin-store`:** Writes plaintext JSON to disk. Violates AUTH-02. Always use `keyring` crate.
- **Using `/api/whoami` (v1):** Modern HF fine-grained tokens return 401. Use `/api/whoami-v2` exclusively.
- **Calling `invoke()` directly from components:** Use typed wrappers in `src/commands/auth.ts`. Components call the wrapper, not invoke directly.
- **Rendering avatar URL as-is in `<img>`:** Tauri's CSP may block external image loads. Configure `img-src` in the CSP to allow `https://huggingface.co` and `https://cdn-avatars.huggingface.co`.
- **Blocking Tauri's main thread with sync file reads:** `check_existing_token` should use `tokio::fs::read_to_string` not `std::fs::read_to_string` if called from an async context.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS keychain access | Custom per-OS keychain code | `keyring` Rust crate | Handles macOS Keychain, Windows Credential Manager, Linux Secret Service, libsecret, kwallet — tested and maintained |
| Window controls (min/max/close) | Custom SVG buttons with Tauri window API calls | `tauri-controls` npm package | Renders platform-matched controls (macOS traffic lights, Windows caption buttons); handles double-click-to-maximize, right-click on macOS |
| HF API client | Custom reqwest wrapper for all HF endpoints | `@huggingface/hub` for reads | Official library handles pagination, auth headers, error types; only hand-roll the upload path in Phase 2 |
| Custom theme system | Hand-coded CSS variables | shadcn/ui + Tailwind v4 `@theme` | shadcn/ui defines all semantic tokens (background, foreground, primary, accent); override the accent to orange in CSS — one change propagates everywhere |
| Avatar image proxy | Rust route to proxy HF avatar images | Configure CSP `img-src` | Allow `https://cdn-avatars.huggingface.co` in CSP; no proxy needed |
| Skeleton loaders | Custom animation CSS | shadcn/ui `<Skeleton>` component | Ships with the library, matches theme tokens, accessible |

**Key insight:** The keychain and window controls are the two areas where existing solutions dramatically outperform hand-rolled alternatives — the cross-platform edge cases (Linux keyring backends, macOS traffic light positioning, Windows DPI scaling) would consume significant Phase 1 time to handle correctly.

---

## Common Pitfalls

### Pitfall 1: Using `/api/whoami` Instead of `/api/whoami-v2`

**What goes wrong:** Token validation succeeds in testing with old-format tokens but fails for any user who created a token on the modern HF token settings page (fine-grained tokens, post-2024).
**Why it happens:** HF introduced a v2 whoami endpoint. Old endpoint returns 401 for modern tokens even when the token is valid.
**How to avoid:** Always use `https://huggingface.co/api/whoami-v2`. The `@huggingface/hub` JS library's `whoAmI()` function calls the correct endpoint — if calling directly from Rust, use `-v2`.
**Warning signs:** 401 errors during auth that don't correlate with actual invalid tokens.

### Pitfall 2: CSP Blocking External Images (Avatar URLs)

**What goes wrong:** User authenticates successfully but their avatar doesn't display — silent failure with no error in the UI.
**Why it happens:** Tauri enforces a Content Security Policy in the webview. The default CSP does not allow loading images from external domains.
**How to avoid:** Add `img-src 'self' data: blob: https://huggingface.co https://cdn-avatars.huggingface.co` to the CSP in `tauri.conf.json` under `app.security.csp`.
**Warning signs:** Broken image icon where avatar should be; no JS error thrown; network request succeeds but image is blocked.

### Pitfall 3: Custom Titlebar Resize Bug on Windows

**What goes wrong:** Window is not resizable when `decorations: false` on Windows (Tauri v2 issue #8519).
**Why it happens:** Disabling native decorations also removes the native resize hitbox on Windows.
**How to avoid:** Use `resizable: true` in window config and test resize behavior on Windows early. The community workaround adds a thin `data-tauri-drag-region` border. Alternative: use `tauri-plugin-decorum` which patches this behavior.
**Warning signs:** Window appears stuck at initial size on Windows; dragging window edges does nothing.

### Pitfall 4: `keyring` Crate Linux Backend Failures

**What goes wrong:** Token storage works on macOS and Windows but silently fails on some Linux distros (particularly headless servers or minimal desktop environments without a running Secret Service daemon).
**Why it happens:** The `keyring` crate falls back through multiple Linux backends (libsecret, kwallet, fallback file). Without a running Secret Service, storage may fail.
**How to avoid:** Handle `keyring::Error` explicitly on Linux — fall back to `tauri-plugin-store` encrypted storage if keyring fails, and warn the user. Do not `unwrap()` keyring operations.
**Warning signs:** `Error::NoEntry` or `Error::PlatformFailure` from keyring on CI (which runs headless).

### Pitfall 5: TanStack Query v5 Breaking Change — `isLoading` vs `isPending`

**What goes wrong:** Code copied from TanStack Query v4 examples uses `isLoading` which always returns `false` in v5 for queries without enabled data.
**Why it happens:** TanStack Query v5 renamed `isLoading` to `isPending` for the "loading" state; `isLoading` now means something different.
**How to avoid:** Use `isPending` for showing loading skeletons. Use `isFetching` for background refetch indicators.
**Warning signs:** Skeleton loaders never show; loading states seem instant even on slow connections.

### Pitfall 6: Vite v8 Default ESM-only Behavior

**What goes wrong:** Some Tauri plugins or community packages that ship CommonJS modules fail to import in Vite v8.
**Why it happens:** Vite v8 defaults to strict ESM; CJS interop is more limited.
**How to avoid:** If a package import fails with a module resolution error, add it to `vite.config.ts` `optimizeDeps.include` or check if a newer ESM-compatible version exists.
**Warning signs:** "cannot use import statement in a module" or "does not provide an export named" errors during dev.

---

## Code Examples

Verified patterns from official sources:

### HF whoAmI — user info shape

```typescript
// Source: @huggingface/hub README (v2.11.0)
import { whoAmI } from "@huggingface/hub";

const user = await whoAmI({ accessToken: "hf_..." });
// Returns: { name: string, fullname: string, email: string,
//            avatarUrl: string, type: "user" | "org",
//            orgs: Array<{ name: string, ... }> }
console.log(user.name);       // "myusername"
console.log(user.avatarUrl);  // "https://cdn-avatars.huggingface.co/v1/production/uploads/..."
```

### listModels — async iterator pattern

```typescript
// Source: @huggingface/hub README (v2.11.0)
import { listModels } from "@huggingface/hub";

const models = [];
for await (const model of listModels({
  search: { owner: "myusername" },
  accessToken: "hf_...",
  additionalFields: ["private", "downloads", "lastModified", "tags"],
})) {
  models.push(model);
}
// model shape: { id: "user/repo-name", private: boolean, downloads: number,
//                lastModified: string, tags: string[], ... }
```

### shadcn/ui orange theme in Tailwind v4

```css
/* Source: shadcn/ui Tailwind v4 docs — override accent to orange/amber */
@import "tailwindcss";
@import "@shadcn/ui/styles.css";

@theme {
  /* Dark mode default */
  --color-background: oklch(0.13 0.01 240);
  --color-foreground: oklch(0.96 0.01 240);
  --color-primary: oklch(0.72 0.19 45);          /* warm orange */
  --color-primary-foreground: oklch(0.13 0.01 240);
  --color-accent: oklch(0.72 0.19 45);            /* orange accent */
  --color-accent-foreground: oklch(0.13 0.01 240);
  --radius: 0.75rem;                              /* generous border-radius */
}
```

### Tauri capabilities — image + opener + fs permissions

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:default",
    "opener:default",
    "fs:default"
  ]
}
```

```json
// tauri.conf.json — CSP allowing HF avatar images
{
  "app": {
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: blob: https://cdn-avatars.huggingface.co https://huggingface.co; connect-src 'self' https://huggingface.co ipc: http://ipc.localhost"
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwindcss v3` with `tailwind.config.js` | Tailwind v4 — CSS-native `@theme`, Vite plugin, no config file | Jan 2025 | shadcn/ui CLI now targets v4 by default; v3 components need migration |
| `isLoading` in TanStack Query | `isPending` in TanStack Query v5 | TQ v5 (late 2023) | All v4 code examples are wrong for v5 |
| `/api/whoami` | `/api/whoami-v2` | HF fine-grained tokens (2024) | Old endpoint returns 401 for modern tokens |
| React Router for desktop apps | Wouter (lightweight) or conditional rendering | Ongoing community preference | React Router is overkill for 3-4 view desktop apps; adds bundle weight |
| `decorations: true` with custom CSS over native titlebar | `decorations: false` + `data-tauri-drag-region` + `tauri-controls` | Tauri v2 pattern | Enables fully custom titlebar while `tauri-controls` handles platform-matched buttons |

**Deprecated/outdated:**
- `/api/whoami` (v1): Returns 401 for modern HF tokens. Use `/api/whoami-v2`.
- `@tauri-apps/api` v1 patterns: Completely replaced in v2; `tauri::command` attribute behavior differs.
- Tailwind v3 `tailwind.config.js`: Still works but shadcn/ui CLI generates v4 config now.

---

## Open Questions

1. **`tauri-specta` RC stability**
   - What we know: v2.0.0-rc.21 is the latest as of 2026-03-19; has been in RC for over a year; widely used in community templates
   - What's unclear: Whether a stable 2.0.0 will drop before Phase 1 implementation completes; whether any RC-to-stable breaking changes are pending
   - Recommendation: Pin to `= "2.0.0-rc.21"` in Cargo.toml (exact version, not semver range) to prevent accidental upgrades mid-phase

2. **Avatar URL domain for CSP**
   - What we know: `whoAmI()` returns `avatarUrl` pointing to HF CDN; the domain may be `cdn-avatars.huggingface.co` or another subdomain
   - What's unclear: Whether all avatar URLs share a single CDN origin or whether org avatars use a different subdomain
   - Recommendation: Allow both `https://huggingface.co` and `https://*.huggingface.co` in `img-src` CSP to cover all cases

3. **keyring crate Linux async feature**
   - What we know: `keyring` v3 has an `async-secret-service` feature for non-blocking keychain access; required if called from async Tauri commands
   - What's unclear: Whether the feature requires an additional Tokio runtime configuration on Linux
   - Recommendation: Enable `async-secret-service` feature flag and test on a Linux CI runner (Ubuntu 22.04) during Phase 1

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (Wave 0 — create alongside `vite.config.ts`) |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Token validation returns user info on valid token | unit (mock invoke) | `npx vitest run src/commands/auth.test.ts -t "validateToken"` | Wave 0 |
| AUTH-01 | Invalid token returns error string | unit (mock invoke) | `npx vitest run src/commands/auth.test.ts -t "invalid"` | Wave 0 |
| AUTH-02 | Keychain read/write via keyring crate | manual | `cargo test -p face-hugger auth::tests` (requires real OS keychain) | Wave 0 |
| AUTH-04 | whoAmI response maps to UserInfo struct | unit (Rust) | `cargo test -p face-hugger hf::tests::whoami_response_shape` | Wave 0 |
| AUTH-04 | Avatar URL present in user info | unit (mock invoke) | `npx vitest run src/queries/useAuth.test.ts -t "avatar"` | Wave 0 |
| REPO-01 | listModels async iterator collects to array | unit (mock @huggingface/hub) | `npx vitest run src/queries/useRepos.test.ts -t "models"` | Wave 0 |
| REPO-01 | listDatasets async iterator collects to array | unit (mock @huggingface/hub) | `npx vitest run src/queries/useRepos.test.ts -t "datasets"` | Wave 0 |
| REPO-01 | Search/filter applied client-side | unit | `npx vitest run src/queries/useRepos.test.ts -t "filter"` | Wave 0 |

**Note on AUTH-02:** OS keychain interaction is inherently integration/manual-only. The Rust unit test verifies the `keyring::Entry` API contract but requires a real keychain daemon. On CI, mock the keyring layer or run with the `mock-keyring` feature flag if available.

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run && cargo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — Vitest config with Tauri `invoke` mocking via `@tauri-apps/api/mocks`
- [ ] `src/commands/auth.test.ts` — typed invoke wrapper tests (AUTH-01)
- [ ] `src/queries/useRepos.test.ts` — TanStack Query hook tests with mocked `@huggingface/hub` (REPO-01)
- [ ] `src/queries/useAuth.test.ts` — user info mapping tests (AUTH-04)
- [ ] `src-tauri/src/hf/tests.rs` — Rust unit tests for whoami response parsing and keyring integration (AUTH-02, AUTH-04)
- [ ] Framework install: `npm install -D vitest @testing-library/react @tauri-apps/api` — if no package.json yet

---

## Sources

### Primary (HIGH confidence)

- [Tauri v2 official docs — Window Customization](https://v2.tauri.app/learn/window-customization/) — `decorations: false`, `data-tauri-drag-region`, custom titlebar patterns
- [Tauri v2 official docs — State Management](https://v2.tauri.app/develop/state-management/) — `tauri::State<Mutex<T>>` pattern
- [Tauri v2 official docs — Calling Rust](https://v2.tauri.app/develop/calling-rust/) — `#[tauri::command]`, `invoke()`, Channel pattern
- [@huggingface/hub README v2.11.0](https://huggingface.co/docs/huggingface.js/hub/README) — `whoAmI`, `listModels`, `listDatasets`, API shapes confirmed
- [HF Hub API Endpoints](https://huggingface.co/docs/hub/api) — `/api/whoami-v2` confirmed as current endpoint
- [HF User Access Tokens](https://huggingface.co/docs/hub/en/security-tokens) — Token types, scopes
- [HF CLI Guide](https://huggingface.co/docs/huggingface_hub/en/guides/cli) — `~/.cache/huggingface/token` as default token path (via `HF_HOME`)
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — CSS-native `@theme` setup confirmed
- [tauri-specta GitHub — v2.0.0-rc.21](https://github.com/specta-rs/tauri-specta) — latest RC confirmed, usage patterns
- [keyring-rs GitHub](https://github.com/open-source-cooperative/keyring-rs) — cross-platform credential storage, feature flags

### Secondary (MEDIUM confidence)

- [tauri-controls GitHub](https://github.com/agmmnn/tauri-controls) — v0.4.0, React package `@tauri-controls/react`, platform-matched window controls
- [HF Hub API — modern tokens require whoami-v2 (issue #3479)](https://github.com/huggingface/huggingface_hub/issues/3479) — verified that `/api/whoami` v1 returns 401 for fine-grained tokens
- [Tauri v2 custom titlebar resize bug (issue #8519)](https://github.com/tauri-apps/tauri/issues/8519) — Windows-specific resize issue with `decorations: false`
- [shadcn/ui theming guide](https://ui.shadcn.com/docs/theming) — CSS variable override approach for custom palettes

### Tertiary (LOW confidence / needs validation)

- Avatar CDN domain (`cdn-avatars.huggingface.co` vs `huggingface.co/avatars`) — inferred from HF URLs; validate empirically by calling `whoAmI()` and logging `avatarUrl`
- `keyring` async-secret-service Linux behavior — Tokio runtime requirement unconfirmed for Tauri v2 context; test on CI

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified against npm registry 2026-03-19
- Architecture: HIGH — based on Tauri v2 official docs + existing ARCHITECTURE.md research
- Auth patterns: HIGH — HF whoami-v2 endpoint verified from official HF GitHub issues
- Custom titlebar: MEDIUM-HIGH — tauri-controls v0.4.0 verified on npm; Windows resize bug is real (confirmed issue)
- Pitfalls: HIGH — all pitfalls sourced from official issue trackers or confirmed breaking changes

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable stack; Tailwind v4 and TQ v5 are stable; tauri-specta RC may update)
