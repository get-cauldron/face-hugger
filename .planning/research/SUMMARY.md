# Project Research Summary

**Project:** Face Hugger — HF Hub Desktop Client
**Domain:** Tauri v2 + React desktop app for large file upload and HF repository management
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

Face Hugger is a native desktop app targeting a real gap: uploading large (1GB–100GB+) files and datasets to Hugging Face Hub reliably, with better UX than the `hf` CLI and without the bloat of a Python/Qt desktop app. The recommended approach is Tauri v2 with a strict architectural split — the React frontend owns UI state and HF API reads (via `@huggingface/hub` + TanStack Query), while the Rust backend owns all upload bytes (via reqwest + tokio streaming). This split is non-negotiable: loading a 100GB file into V8 will OOM the webview. The core value proposition is resumable, fault-tolerant uploads with a GUI — something neither the CLI nor any existing community tool provides.

The recommended stack is well-validated. Tauri v2 + React 19 + TypeScript 5 + Vite 7 is the established community template pattern. The `@huggingface/hub` v2.11 JS library covers all browse/read/metadata operations. The upload engine must be Rust-native using tokio async I/O and reqwest streaming, with SQLite (via tauri-plugin-sql) persisting upload queue state so uploads survive crashes. tauri-specta generates type-safe IPC bindings, eliminating the most common category of Tauri bugs at the JS/Rust boundary.

The critical risk is upload engine complexity. HF now defaults to Xet storage (content-addressed, chunk-deduplicated) for all new repos, while legacy repos use Git LFS — the upload engine must handle both protocols with explicit detection. Six phase-1 pitfalls all converge on the upload engine: naive commit batching, stale pre-signed URLs on resume, IPC progress flooding, missing cancellation paths, Xet/LFS conflation, and blocking hashing. All six must be designed in from the start, not retrofitted. Auth, error handling, and distribution (macOS notarization, Linux tray dependencies) add complexity but are well-documented.

## Key Findings

### Recommended Stack

The stack centers on Tauri v2 as the desktop shell, React 19 for the frontend, and a Rust backend that owns all upload I/O. The most important decision is the upload ownership split: `@huggingface/hub` (TypeScript) handles all HF API reads and small writes; a custom Rust reqwest+tokio streaming implementation handles all large file uploads. TanStack Query v5 manages server-state caching for HF API data; Zustand v5 manages local UI state. SQLite via tauri-plugin-sql persists the upload queue. tauri-specta generates TypeScript types from Rust command signatures, making the IPC boundary type-safe.

**Core technologies:**
- **Tauri v2** (2.x): Desktop shell, native IPC, system tray — Rust backend streams 100GB files without OOM risk that kills Electron
- **React 19 + TypeScript 5 + Vite 7**: UI layer — official Tauri template stack; React 19 Compiler reduces boilerplate
- **Rust (tokio 1.x + reqwest 0.12)**: Upload engine — async I/O handles thousands of chunk uploads without thread-per-chunk overhead; streaming mandatory for 100GB+ files
- **@huggingface/hub ^2.11**: HF API client — provides `uploadFilesWithProgress`, `listModels`, `listFiles`, OAuth helpers; covers all reads and small writes
- **TanStack Query v5 + Zustand v5**: State management — Query owns remote HF data (repos, files, commits); Zustand owns local UI state (upload queue display, auth)
- **tauri-specta 2.0.0-rc.21**: Type-safe IPC — generates TypeScript types from Rust command signatures; essential for upload progress events
- **tauri-plugin-sql + SQLite**: Upload queue persistence — resumable uploads require SQLite-backed state that survives crashes
- **shadcn/ui + Tailwind v4**: UI components — owned and customizable, ships Radix UI primitives, progress bars/tables/dialogs ready-made

### Expected Features

The feature set has clear priority tiers driven by dependency ordering. Auth is the hard prerequisite for everything. Resumable upload is the product's reason to exist. The upload wizard addresses the onboarding gap that will determine community adoption.

**Must have (table stakes — v1 launch):**
- Token-based authentication with OS keychain storage — nothing works without this
- Resumable, fault-tolerant large file/folder upload — the entire product differentiator
- Per-file upload progress with speed, ETA, and individual status rows — users need visibility into long operations
- Upload queue with cancel — basic control over in-flight uploads
- Repo browser (list owned models + datasets) — needed to pick upload destination
- Create new repo (name, type, visibility) — users need a destination before upload
- Upload wizard for first-time users — guided onboarding critical for non-CLI users
- Error messages with recovery suggestions — map HF API errors to plain-language actions
- Commit message on upload — minimum git hygiene for HF's git-backed repos

**Should have (competitive — v1.x):**
- Background uploads with system tray — trigger: users want to close the window; no other HF tool supports this
- OAuth browser login — smoother onboarding than token paste for newcomers
- Drag-and-drop upload queue with reorder — power users uploading multiple large folders
- Delete files from repo — in-app cleanup for upload mistakes
- Dataset row preview — validate uploads without opening a browser
- Commit history view — researchers tracking experiment versions

**Defer (v2+):**
- Folder sync (two-way diff: local vs remote) — high complexity, niche until validated
- Branch and tag management — power feature, defer until core is solid
- Xet deduplication visibility — needs HF API to expose chunk-level stats; unclear availability
- Public/private visibility toggle — trivial to add but not blocking v1

**Hard anti-features (do not build):**
- Model inference in-app — different product domain, massive scope creep
- HF Spaces management — radically different concerns; out of scope per PROJECT.md
- Git clone / local git operations — HTTP API is superior for large files; git-lfs creates huge local footprint

### Architecture Approach

The architecture is a strict two-layer design: React WebView (UI + state + IPC bridge) over Rust backend (commands + upload engine + HF HTTP client + SQLite). The Rust layer is further split into thin command handlers (no business logic), a self-contained upload engine (queue state machine + tokio chunk workers), and an isolated HF API client (all HF knowledge in one module). The React layer splits state between TanStack Query (remote HF data, cached) and Zustand (local UI state, ephemeral). Upload progress flows from Rust to React via `tauri::ipc::Channel` — not `emit_all` events — for throughput and ordering guarantees.

**Major components:**
1. **Upload Engine (Rust)** — `upload/queue.rs` + `upload/worker.rs`: persistent state machine (Pending→Hashing→UploadingChunks→Committing→Done|Failed|Paused), SQLite-backed, CancellationToken per job
2. **HF HTTP Client (Rust)** — `hf/client.rs` + `hf/api.rs` + `hf/xet.rs`: isolated module owning all HF API knowledge including Xet protocol; detects Xet vs LFS per repo
3. **React Bridge Layer** — `src/commands/*.ts` typed invoke wrappers + `src/queries/*.ts` TanStack Query hooks + `src/stores/*.ts` Zustand slices: components never call invoke directly
4. **App State + SQLite** — `state.rs` + `db/`: AuthState, UploadQueue, AppPrefs in `tauri::State<Mutex<T>>`; SQLite in WAL mode for concurrent read/write
5. **Upload UI** — `src/routes/upload/`: wizard + queue view built on top of the bridge layer; mirrors Rust queue state via Channel events

### Critical Pitfalls

Six pitfalls all target the upload engine in Phase 1. They must be designed in from day one — recovery cost after shipping is HIGH for four of them.

1. **Naive commit batching (`upload_folder()` for large datasets)** — Use task-level resumable uploads (hash → pre-upload → commit per batch of N files). Never build a single commit with thousands of files: the HF backend consistency check times out and the commit silently completes with fewer files than sent. Recovery cost: HIGH (requires redesign of state machine).
2. **Stale pre-signed S3 URLs on resume** — Never store pre-signed URLs in resumption state. Track only "chunk N confirmed by CAS." On resume, always re-request fresh URLs from HF API. Pre-signed URLs expire in 1-2 hours; multi-hour uploads will get 403s from S3 (not HF) on resumed chunks. Recovery cost: LOW (schema change only).
3. **IPC progress flooding choking upload pipeline** — Emit progress events at most every 500ms or every 1% progress via a separate timer task reading shared `Arc<Mutex<UploadState>>`. Never emit per-chunk events from the upload task directly. At 100GB / 8MB chunks = 12,500 events; IPC serialization backlog can stall the Tokio runtime. Recovery cost: LOW-MEDIUM (refactor only).
4. **Missing cancellation path creating zombie Tokio tasks** — Pass `CancellationToken` into every upload task; `select!` on chunk future + cancellation signal in the chunk loop. Store sender in managed state keyed by upload ID. Tauri does not cancel Tokio tasks on app exit. Recovery cost: MEDIUM (task refactor).
5. **Xet vs LFS protocol conflation** — Check `xet_enabled` in repo metadata on first upload. Route to Xet CAS pipeline for new repos, LFS pre-signed URL path for legacy repos. Xet is default for all new repos since May 2025; LFS-only implementation breaks all new repos. Recovery cost: HIGH (requires implementing full Xet pipeline as parallel code path).
6. **CPU-bound file hashing blocking the Tokio runtime** — Stream-hash files (read in chunks, feed hasher); never load full file into memory. Use a dedicated rayon threadpool for CPU-bound hashing, separate from Tokio's blocking pool. Cap at 2 concurrent hash jobs. 100GB hash takes 30-90s; saturating `spawn_blocking` pool starves network I/O. Recovery cost: MEDIUM (streaming hasher swap, no API change).

## Implications for Roadmap

The dependency graph is unambiguous. Auth is a hard prerequisite for everything. The upload engine is the product — build it first and build it correctly, accepting the upfront complexity cost. The UI is built on top of a stable Rust API. Secondary features (background uploads, dataset preview, OAuth) layer on after the core upload loop is proven.

### Phase 1: Foundation — Auth + Project Scaffold

**Rationale:** Auth is required by every subsequent feature. Project scaffold must establish the IPC patterns (tauri-specta, typed invoke wrappers, TanStack Query setup) that all other code depends on. Getting this wrong creates rework in every phase.
**Delivers:** Working Tauri v2 app with token auth, OS keychain storage, HF whoami validation, basic repo list view, and the type-safe IPC bridge layer.
**Addresses:** Token-based authentication, repo browser (minimal), persistent login state, error display
**Avoids:** Token stored in plaintext (use OS keychain from day 1); IPC boundary bugs (tauri-specta from day 1)
**Research flag:** Standard patterns — well-documented in Tauri v2 official docs; skip research-phase

### Phase 2: Upload Engine — Core (Rust)

**Rationale:** The upload engine is the product's reason to exist and contains 6 critical pitfalls that must be designed in, not retrofitted. Build the Rust upload engine in isolation from UI to validate correctness. This is the highest-risk phase — all six critical pitfalls live here.
**Delivers:** Working Rust upload engine: persistent state machine, Xet/LFS protocol detection and handling, streaming chunk uploads, CancellationToken per job, SQLite-backed resumption state, batched progress emission.
**Addresses:** Resumable/fault-tolerant upload, cancel upload, commit message on upload
**Avoids:** All 6 critical pitfalls — naive commit batching, stale pre-signed URLs, IPC flooding, zombie tasks, Xet/LFS conflation, blocking hashing
**Research flag:** Needs `/gsd:research-phase` — Xet CAS upload protocol details (chunk format, xorb assembly, CAS API endpoints) are not fully documented in public HF docs; Rust implementation will require reading `hf-xet` source and HF engineering blog posts

### Phase 3: Upload UI — Wizard + Queue View

**Rationale:** UI is built on top of the stable Rust upload API established in Phase 2. The upload wizard drives first-time user onboarding; the queue view surfaces per-file status. This phase wires the React bridge layer to the upload engine.
**Delivers:** Upload wizard (guided flow: auth → pick/create repo → select files → commit message → upload), upload queue view (per-file status rows with speed/ETA), drag-and-drop file selection.
**Addresses:** Upload wizard, per-file upload progress, upload queue UI, create new repo inline, error recovery messages
**Uses:** tauri-specta typed channels, Zustand uploadStore, shadcn/ui progress bars and tables
**Research flag:** Standard patterns — wizard UX and progress UI are well-documented React patterns; skip research-phase

### Phase 4: Repository Browser + Management

**Rationale:** Once upload works end-to-end, flesh out the repo management features that users need for destination selection and post-upload cleanup. These are HF read API calls (TanStack Query), which are simpler than the upload engine.
**Delivers:** Full repo browser (search, filter by type, file tree view), create/delete repo, delete individual files, public/private visibility toggle, commit history view.
**Addresses:** HF repo browser, create new repository, delete files, commit history view, visibility toggle
**Uses:** `@huggingface/hub` JS library (`listModels`, `listFiles`, `list_repo_commits`), TanStack Query caching
**Research flag:** Standard patterns — HF Hub REST API is well-documented; skip research-phase

### Phase 5: Background Uploads + System Tray

**Rationale:** Background uploads are a major differentiator (no other HF tool supports them) but require the upload engine from Phase 2 and queue UI from Phase 3 to already exist. System tray integration layers on after core flows are stable.
**Delivers:** System tray with upload status indicator, background upload continuation when window is closed, tray notification on upload complete/failure, graceful degradation on Linux (no `libayatana-appindicator`).
**Addresses:** Background uploads with system tray, per-file status with retry
**Avoids:** Linux tray dependency (gate at runtime, degrade gracefully on unsupported distros)
**Research flag:** Needs `/gsd:research-phase` — Linux system tray behavior across distros (Ubuntu 20.04/22.04, Fedora, Debian) needs verification; known platform differences in tray implementation

### Phase 6: Secondary Features + OAuth

**Rationale:** OAuth login, dataset row preview, and drag-and-drop queue reordering are differentiators that improve UX but are not blockers for v1 launch. Add after core upload loop is validated with real users.
**Delivers:** OAuth browser login flow (tauri-plugin-opener + deep link scheme), dataset row preview (HF Dataset Viewer API, first 100 rows), drag-and-drop upload queue with reorder.
**Addresses:** OAuth login, dataset preview, drag-and-drop queue
**Uses:** `oauthLoginUrl()` + `oauthHandleRedirectIfPresent()` from `@huggingface/hub`; HF Dataset Viewer `/parquet` endpoint
**Research flag:** Needs `/gsd:research-phase` — OAuth deep link handling in Tauri v2 (custom protocol registration, redirect capture) has sparse community examples; dataset Viewer API parquet streaming behavior needs verification

### Phase 7: Distribution + Cross-Platform Polish

**Rationale:** Distribution requirements (macOS notarization, Windows code signing, Linux packaging) must be addressed before any release. Build into CI early — validating on a fresh macOS VM without dev tools reveals notarization issues that are invisible in development.
**Delivers:** CI pipeline producing signed + notarized macOS `.dmg`, signed Windows installer, Linux `.AppImage`/`.deb`; cross-platform QA checklist verified (paths with spaces, Unicode filenames, Windows IPC latency).
**Addresses:** macOS notarization, Windows code signing, cross-platform path handling
**Research flag:** Standard patterns — Tauri v2 distribution docs are HIGH confidence; skip research-phase for macOS/Windows; Linux snap/flatpak packaging may need research

### Phase Ordering Rationale

- **Auth before everything:** Every HF API call requires a token; the auth command establishes the IPC pattern all other commands follow.
- **Upload engine before upload UI:** The Rust upload engine can be tested independently (integration tests with real HF API) before any React is written. Catching Xet protocol issues in isolation is far cheaper than debugging them through the UI.
- **Upload UI before repo browser:** Upload is the primary flow; repo browser is the destination-selection helper. Users arrive at repo browser via the upload wizard, so the wizard should drive the repo browser requirements.
- **Background uploads after queue UI:** System tray is an enhancement of the queue view. Building it before the queue would require rework.
- **Secondary features late:** OAuth, dataset preview, and drag-and-drop reordering are additive. Adding them after the core loop is validated avoids building features for a flow that might need redesign.
- **Distribution last but CI early:** Distribution artifacts must be set up in CI from day 1 (notarization requires Apple Developer account, can't be added at the end). The phase delivers the verified distribution pipeline, not just the setup.

### Research Flags

Phases needing `/gsd:research-phase` during planning:
- **Phase 2 (Upload Engine):** Xet CAS upload protocol — chunk format, xorb assembly, CAS API endpoint details not fully in public HF docs. Read `hf-xet` Rust source + HF engineering blog posts.
- **Phase 5 (System Tray):** Linux system tray behavior across distros. `libayatana-appindicator` vs `libappindicator3` dependency matrix by distro version.
- **Phase 6 (OAuth + Dataset Preview):** Tauri v2 OAuth deep link scheme registration (sparse examples); HF Dataset Viewer parquet streaming API behavior for large datasets.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Tauri v2 auth + keychain is HIGH confidence; official docs cover keyring plugin and IPC setup.
- **Phase 3 (Upload UI):** Wizard UX and progress components are standard React patterns with shadcn/ui.
- **Phase 4 (Repo Browser):** HF Hub REST API is HIGH confidence; TanStack Query + Tauri invoke patterns are established.
- **Phase 7 (Distribution):** Tauri v2 distribution docs are HIGH confidence for macOS + Windows.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack verified against Tauri v2 official docs, `@huggingface/hub` v2.11 confirmed, tauri-specta rc.21 confirmed, community templates corroborate choices |
| Features | HIGH | HF official docs (upload guide, CLI guide, repo management) directly describe the feature API surface; competitor analysis grounded in real projects |
| Architecture | HIGH | Tauri v2 official docs cover IPC, state management, project structure, system tray; HF engineering blog covers Xet protocol; patterns are official, not inferred |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls sourced from official HF maintainer GitHub responses and Tauri community discussions; Xet protocol specifics are HIGH confidence; IPC performance numbers are MEDIUM (community benchmarks) |

**Overall confidence:** HIGH

### Gaps to Address

- **Xet CAS API endpoint details:** The Xet upload protocol (xorb assembly, CAS endpoint format, chunk size constants) is described in HF blog posts but not formally documented as an API spec. The Rust implementation will need to reference `hf-xet` source code. Address in Phase 2 research.
- **Pre-signed URL TTL exact value:** Research identifies that pre-signed S3 URLs expire in "1-2 hours" but the exact TTL is not documented. Implement conservative 30-minute expiry cutoff for resumption state. Validate empirically during Phase 2 implementation.
- **Linux tray distro matrix:** Which distros ship `libayatana-appindicator` by default vs require manual install vs use neither is not fully mapped. Address in Phase 5 research before committing to tray implementation scope.
- **HF Dataset Viewer parquet API rate limits:** The Dataset Viewer `/parquet` endpoint is documented for first 100 rows but rate limits and behavior for large datasets are not specified. Address in Phase 6 research.
- **Windows IPC latency impact:** Tauri IPC is documented as ~200ms/10MB on Windows (community benchmark). At 8MB chunk size this is acceptable, but the exact impact on upload throughput needs measurement during Phase 2 implementation.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 official docs](https://v2.tauri.app/) — architecture, IPC, state management, project structure, system tray, distribution
- [huggingface.js README — @huggingface/hub](https://huggingface.co/docs/huggingface.js/hub/README) — JS API surface, `uploadFilesWithProgress`, v2.11.0 confirmed
- [HF Hub Upload Guide](https://huggingface.co/docs/huggingface_hub/guides/upload) — upload_file, upload_folder, upload_large_folder, resumability
- [HF CLI Guide](https://huggingface.co/docs/huggingface_hub/guides/cli) — full command reference
- [HF Repository Management Guide](https://huggingface.co/docs/huggingface_hub/en/guides/repository) — create/delete/visibility/branches/tags
- [Xet on the Hub blog](https://huggingface.co/blog/xet-on-the-hub) — chunk deduplication, default for all new repos May 2025
- [HF Hub Rate Limits](https://huggingface.co/docs/hub/rate-limits) — 1,000 calls / 5 min free tier
- [HF Hub Upload Issues #2612](https://github.com/huggingface/huggingface_hub/issues/2612) — maintainer confirmation of large folder upload behavior
- [tauri-specta GitHub](https://github.com/specta-rs/tauri-specta) — v2.0.0-rc.21 current, Tauri v2 only
- [tauri-plugin-sql docs.rs](https://docs.rs/crate/tauri-plugin-sql/latest) — version 2.3.2 confirmed
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — Tailwind v4 compatibility confirmed

### Secondary (MEDIUM confidence)
- [dannysmith/tauri-template](https://github.com/dannysmith/tauri-template) — production community template confirming Zustand v5 + TanStack Query v5 + tauri-specta + shadcn/ui pattern
- [Tauri IPC performance discussion #7146](https://github.com/tauri-apps/tauri/discussions/7146) — IPC throughput benchmarks (~200ms/10MB on Windows)
- [Cancel async commands in Tauri #5894](https://github.com/tauri-apps/tauri/discussions/5894) — CancellationToken patterns
- [Huggingface-Desktop GitHub](https://github.com/Ktiseos-Nyx/Huggingface-Desktop) — community PyQt6 alternative, feature gap analysis

### Tertiary (LOW confidence / needs validation)
- Pre-signed S3 URL TTL: "1-2 hours" — inferred from HF upload flow behavior, not officially documented; validate empirically in Phase 2

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
