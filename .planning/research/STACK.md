# Stack Research

**Domain:** Tauri v2 + React desktop app — HF Hub client for large file uploads and dataset management
**Researched:** 2026-03-19
**Confidence:** HIGH (core stack verified against official docs and active templates)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri v2 | 2.x (latest ~2.10) | Desktop shell, native IPC, system tray, file I/O | Rust backend handles chunked streaming and concurrent uploads without memory bloat that kills Electron at 100GB files; 2x smaller bundle than Electron (~5MB vs ~120MB) |
| React | 19.x | UI rendering | JSX + hooks are the established standard in Tauri community templates; React 19 removes need for manual memoization via React Compiler |
| TypeScript | 5.x | Type safety across frontend and IPC boundary | Required for tauri-specta to generate type-safe Rust bindings; catches HF API shape mismatches at compile time |
| Vite | 7.x | Frontend build / dev server | Official Tauri-recommended bundler; HMR in < 50ms during dev, eliminates webpack config pain |
| Rust (tokio + reqwest) | tokio 1.x, reqwest 0.12.x | Backend: upload engine, file I/O, HTTP | Native async I/O with tokio means thousands of concurrent chunk uploads without thread-per-chunk overhead; reqwest 0.12 is the Tauri HTTP plugin's direct dependency |

### HF API Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @huggingface/hub | ^2.11 | HF Hub REST API client (TypeScript) | Official HF JS library; provides `uploadFilesWithProgress` (async iterator for per-chunk progress), `createRepo`, `deleteRepo`, `listFiles`, `listModels`, `commit`, `deleteFile`, OAuth login helpers. Verified: v2.11.0 current as of 2026-03-19 |
| HF Hub REST API (raw) | — | Fallback for Xet / LFS operations beyond JS library | Xet storage (default for all new HF repos since May 2025) uses chunk-level deduplication via Rust xet-core. For 100GB+ files the Rust backend should own the upload path directly against the HF API, not the JS layer, to avoid V8 memory limits |

### UI and Styling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| shadcn/ui | latest (Tailwind v4 era) | Component library | Copies components into your repo — no black-box version lock. Ships with Radix UI primitives; accessible by default. Progress bars, dialogs, tables all needed here exist ready-made |
| Tailwind CSS | v4.x | Utility styling | v4 drops the config file in favor of CSS-native `@theme`, ships as a Vite plugin, has no PostCSS overhead. shadcn/ui v4 components target it directly |
| Lucide React | latest | Icons | Default icon set in shadcn/ui; consistent, tree-shakeable |

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Zustand | v5.x | Global UI state (upload queue, auth token, selected repo) | Zero boilerplate, React context-free, works cleanly in Tauri without SSR complications. v5 dropped deprecated patterns. Standard in 2025 Tauri templates |
| TanStack Query | v5.x | Server state for HF API reads (repo list, file list, dataset preview) | Caching, background refetch, optimistic updates — eliminates manual loading/error state everywhere you browse HF repos. Tauri IPC commands map cleanly to `queryFn` |

### Type-Safe IPC Bridge

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tauri-specta | 2.0.0-rc.21 | Generate TypeScript types from Rust command and event signatures | Without this, every IPC call is `invoke("upload_chunk", { ... } as any)`. With it, Rust function signatures become TypeScript types with autocomplete. Essential for upload progress events emitted from Rust |

### Local Persistence

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tauri-plugin-sql + SQLite | 2.3.x | Store upload queue state, resume tokens, commit history cache, HF token | Resumable uploads require persisting which chunks completed across crashes. SQLite via the official plugin is the standard approach for Tauri local-first storage. Migration system built-in |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint 9 (flat config) | Linting | Flat config is now default; avoid legacy `.eslintrc` format |
| Prettier | Formatting | Pair with `prettier-plugin-tailwindcss` for class sorting |
| Vitest | Unit + component testing | Native Vite integration; mocking Tauri `invoke` commands is supported via `@tauri-apps/api/mocks` |
| Clippy | Rust linting | Run in CI; catches async/await misuse in upload code |
| cargo-watch | Rust dev reload | Hot-reload Rust backend during development |

## Installation

```bash
# Scaffold a new Tauri v2 project with React + TypeScript
npm create tauri-app@latest face-hugger -- --template react-ts

# Frontend dependencies
npm install @huggingface/hub @tanstack/react-query zustand
npm install @tauri-apps/plugin-sql @tauri-apps/plugin-upload

# shadcn/ui (Tailwind v4 path)
npx shadcn@latest init

# Dev dependencies
npm install -D vitest @testing-library/react prettier prettier-plugin-tailwindcss
```

```toml
# Cargo.toml additions
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-specta = { version = "2.0.0-rc.21", features = ["derive", "typescript"] }
specta-typescript = "0.0.9"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["stream", "multipart"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio-native-tls"] }
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @huggingface/hub (JS) for browse/manage | Raw REST calls against HF API | When the JS library's upload path bottlenecks on V8 memory for 100GB files — Rust backend with reqwest is the fallback for the actual upload bytes |
| Rust backend upload via reqwest | tauri-plugin-upload (high-level) | tauri-plugin-upload is fine for small/medium files but wraps reqwest without exposing per-chunk Xet protocol hooks; for 100GB+ files you need to own the streaming logic in Rust directly |
| Zustand v5 | Redux Toolkit | Only use Redux if the team has existing Redux expertise; Zustand is ~1/10th the boilerplate and has no performance difference at this app's scale |
| TanStack Query v5 | SWR | TanStack Query has better devtools, more granular cache control, and first-class Tauri IPC integration patterns in the community |
| shadcn/ui | Mantine, Ant Design, Radix bare | shadcn/ui components are owned and customizable; Mantine and Ant Design are opaque runtime libraries that are harder to style for native desktop feel |
| SQLite via tauri-plugin-sql | Tauri Store plugin (JSON) | Tauri Store is fine for simple key-value config (auth token, preferences). Use SQLite when you need to query upload queue state, retry logic, or commit history — relational queries matter |
| tauri-specta | Manual invoke types | Never use manual types; the IPC boundary is the most common source of bugs in Tauri apps |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Electron | 120MB+ base bundle, Node.js file I/O is not suitable for streaming 100GB uploads without memory spikes, no native system tray quality | Tauri v2 (already decided) |
| Python subprocess via Tauri sidecar (calling huggingface-cli) | Process spawning adds latency, progress reporting is brittle, cross-platform packaging is complex | @huggingface/hub JS library + Rust reqwest for upload bytes |
| React Router (file-based routing) | Overkill for a desktop app with 3-4 views; adds bundle weight and routing complexity | Simple conditional rendering or Wouter for lightweight client-side routing |
| next.js inside Tauri | SSR is meaningless in a desktop app; Next.js adds server-side concepts that fight Tauri's frontend model | Vite + React SPA (no router framework needed) |
| @tauri-apps/api v1 patterns | Tauri v2 completely rewrote the plugin API; v1 patterns (e.g., `tauri::command` attribute usage) break silently | Use Tauri v2 API only: `@tauri-apps/api` v2 npm package |
| Blob-in-memory upload for large files | Loading a 10GB file as a `Blob` in the JS layer will OOM the webview | Pass file paths to Rust via IPC; Rust streams the file in chunks using tokio's `BufReader` |
| Axios (JS HTTP) for uploads | In Tauri's webview, outbound fetch is subject to the CSP and Tauri's HTTP allowlist; large Axios uploads bypass Rust where retry/resume logic should live | Let Rust own all upload HTTP calls; use `@huggingface/hub` JS API only for metadata reads |

## Stack Patterns by Variant

**For browsing repos and datasets (read-only HF API calls):**
- Use `@huggingface/hub` JS functions (`listModels`, `listFiles`, `modelInfo`) wrapped in TanStack Query `queryFn`
- Because these are small, fast API calls that benefit from caching and automatic background refetch

**For upload engine (large files, resumable):**
- Implement as a Tauri Rust command: read file path, stream with tokio, chunk via reqwest to HF LFS/Xet endpoint, emit progress events via Tauri Channel to frontend
- Because V8 heap cannot hold 100GB file; streaming must happen in Rust to avoid OOM

**For auth token storage:**
- Store in Tauri Store plugin (simple JSON KV) for token + user info
- Use SQLite only for upload queue state and commit history

**For OAuth login flow:**
- Use `oauthLoginUrl()` + `oauthHandleRedirectIfPresent()` from `@huggingface/hub`
- Open the OAuth URL via `tauri-plugin-opener` (shell.open equivalent in v2)
- Handle the redirect in the app's registered deep link scheme

**For system tray / background uploads:**
- Use `tray-icon` Tauri feature flag
- Upload state lives in Zustand; Rust emits progress events via Tauri Channels; tray icon badge updates via tray menu rebuild
- Because Tauri Channels are the recommended mechanism for streaming ordered data from Rust to JS (faster and more reliable than app.emit_all for high-frequency progress events)

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| tauri 2.x | tauri-specta 2.0.0-rc.21 | specta v2 requires Tauri v2; does not support Tauri v1 |
| @tauri-apps/api 2.x | tauri 2.x only | Breaking API from v1; cannot mix |
| @huggingface/hub ^2.11 | Node >= 18, modern browsers, Bun, Deno | Works in Tauri webview (Chromium-based); no polyfills needed |
| tailwindcss v4 | shadcn/ui (Tailwind v4 era) | shadcn/ui v3-era components use Tailwind v3; use the current shadcn CLI which targets v4 |
| TanStack Query v5 | React 18+ / React 19 | v5 dropped `isLoading` in favour of `isPending`; breaking from v4 |
| tauri-plugin-sql 2.3.x | Tauri 2.x | Requires Rust >= 1.77.2 |
| reqwest 0.12 | tokio 1.x | reqwest 0.11 used tokio 0.x; always use 0.12+ with Tauri v2's tokio runtime |

## Key Architecture Decision: Where Uploads Live

The most important stack decision is **who owns the upload bytes**:

- **JS layer (`@huggingface/hub`)**: Fine for files < 1GB. `uploadFilesWithProgress` gives an async iterator of progress events. Use this for metadata commits, small file uploads.
- **Rust layer (reqwest + tokio streaming)**: Required for files >= several GB. File is never loaded into V8 heap. Rust streams in 8MB chunks, calculates SHA256 on the fly, retries individual chunks on network failure, emits progress back via Tauri Channel. This is the architecture for Face Hugger's core value prop.

The recommended split: `@huggingface/hub` for **all reads** (list, browse, metadata) and **small writes** (repo CRUD, README edits); Rust reqwest streaming for **all large file uploads**.

## Sources

- [huggingface.js README — @huggingface/hub](https://huggingface.co/docs/huggingface.js/hub/README) — confirmed `uploadFilesWithProgress`, `createRepo`, `listFiles` API; v2.11.0 current
- [HF Hub Upload Guide](https://huggingface.co/docs/huggingface_hub/guides/upload) — Xet storage default since May 2025; `upload_large_folder` resumability pattern; MEDIUM confidence (Python docs, JS behavior inferred)
- [Tauri v2 official docs](https://v2.tauri.app/) — Channels, system tray, HTTP plugin, SQL plugin; HIGH confidence
- [tauri-plugin-sql docs.rs](https://docs.rs/crate/tauri-plugin-sql/latest) — version 2.3.2, verified current
- [tauri-specta GitHub](https://github.com/specta-rs/tauri-specta) — v2.0.0-rc.21 current; Tauri v2 only; HIGH confidence
- [dannysmith/tauri-template](https://github.com/dannysmith/tauri-template) — production template confirming Zustand v5 + TanStack Query v5 + tauri-specta + shadcn/ui pattern; MEDIUM confidence (community template, not official)
- [Tauri Upload Plugin](https://v2.tauri.app/plugin/upload/) — progress callback confirmed; MEDIUM confidence (lacks large file streaming details)
- shadcn/ui Tailwind v4 support — confirmed via `ui.shadcn.com/docs/tailwind-v4`; HIGH confidence

---
*Stack research for: Face Hugger — Tauri v2 + React HF Hub Desktop Client*
*Researched: 2026-03-19*
