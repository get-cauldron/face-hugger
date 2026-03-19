# Architecture Research

**Domain:** Tauri v2 + React desktop app for large file uploads and HF repository management
**Researched:** 2026-03-19
**Confidence:** HIGH (Tauri v2 official docs + HF official docs + verified patterns)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Frontend (WebView)                     │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  UI Layer    │  State Layer │  Bridge Layer│                        │
│  ┌────────┐  │  ┌────────┐  │  ┌────────┐  │                        │
│  │ Pages/ │  │  │Zustand │  │  │ Tauri  │  │                        │
│  │ Views  │  │  │ Store  │  │  │ invoke │  │                        │
│  └────────┘  │  └────────┘  │  └────┬───┘  │                        │
│  ┌────────┐  │  ┌────────┐  │       │      │                        │
│  │ shared │  │  │TanStack│  │  ┌────┴───┐  │                        │
│  │  UI    │  │  │ Query  │  │  │ events │  │                        │
│  └────────┘  │  └────────┘  │  └────────┘  │                        │
└──────────────┴──────────────┴──────┬────────┴────────────────────────┘
                                     │ IPC (invoke / emit)
┌────────────────────────────────────┴────────────────────────────────┐
│                         Rust Backend (src-tauri)                     │
├───────────────┬──────────────┬─────────────┬────────────────────────┤
│  Commands     │  Upload      │  HF Client  │  App State             │
│  ┌─────────┐  │  ┌────────┐  │  ┌────────┐  │  ┌──────────────────┐ │
│  │auth_*   │  │  │ Queue  │  │  │  HTTP  │  │  │ AuthState        │ │
│  │upload_* │  │  │Manager │  │  │ Client │  │  │ UploadQueue      │ │
│  │repo_*   │  │  └────┬───┘  │  │(reqwest│  │  │ AppPrefs         │ │
│  │file_*   │  │       │      │  │  + xet)│  │  └──────────────────┘ │
│  └─────────┘  │  ┌────┴───┐  │  └────────┘  │                        │
│               │  │Chunk   │  │              │                        │
│               │  │Worker  │  │  ┌────────┐  │                        │
│               │  │(tokio) │  │  │ SQLite │  │                        │
│               │  └────────┘  │  │(state) │  │                        │
│               │              │  └────────┘  │                        │
└───────────────┴──────────────┴─────────────┴────────────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────┐
│                         External Services                            │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐│
│  │  HF Hub REST API     │  │  HF Xet CAS (content-addressed store) ││
│  │  (auth, repo CRUD,  │  │  (chunk dedup upload, 100GB+ files)    ││
│  │   commit, metadata) │  │                                        ││
│  └─────────────────────┘  └────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Pages/Views | Route-level UI: upload wizard, repo browser, dataset preview | React + React Router |
| Shared UI | Reusable components: progress bars, file list, modals | shadcn/ui + Tailwind |
| Zustand Store | Client-side app state: auth session, upload queue status, UI prefs | Zustand |
| TanStack Query | Server-state caching: repo listings, file trees, dataset rows | TanStack Query v5 |
| Tauri invoke | Type-safe bridge: call Rust commands, get typed responses | `@tauri-apps/api/core` |
| Tauri events | Push notifications: upload progress, background task status | `@tauri-apps/api/event` |
| Commands layer | Rust handlers: validate, dispatch to services, return results | `#[tauri::command]` fns |
| Upload Queue Manager | Queue, prioritize, pause, resume, retry upload tasks | tokio + Mutex state |
| Chunk Worker | Stream file in chunks, hash, call HF Xet CAS API | tokio tasks + reqwest |
| HF HTTP Client | Authenticated REST calls: repo CRUD, commits, file listing | reqwest with auth header |
| App State | Shared mutable state in Rust: auth token, queue, prefs | `tauri::State<Mutex<T>>` |
| SQLite (via Rusqlite) | Persist upload state, queue recovery after restart, settings | rusqlite or sqlx |

## Recommended Project Structure

```
face-hugger/
├── package.json
├── index.html
├── vite.config.ts
├── src/                          # React frontend
│   ├── main.tsx                  # App entry, providers, router
│   ├── routes/                   # Page-level components
│   │   ├── upload/               # Upload wizard + advanced queue view
│   │   ├── repos/                # Repository browser
│   │   ├── datasets/             # Dataset preview
│   │   └── settings/             # Auth, preferences
│   ├── components/               # Shared UI components
│   │   ├── upload/               # UploadQueue, FileCard, ProgressBar
│   │   ├── repos/                # RepoCard, FileTree, CommitList
│   │   └── common/               # Button, Modal, Toast, etc.
│   ├── stores/                   # Zustand slices
│   │   ├── authStore.ts          # Token, user info, OAuth state
│   │   └── uploadStore.ts        # Queue display state, active transfers
│   ├── queries/                  # TanStack Query hooks
│   │   ├── useRepos.ts           # List/search repos
│   │   ├── useRepoFiles.ts       # File tree for a repo
│   │   ├── useDatasetRows.ts     # Paginated dataset preview
│   │   └── useCommitHistory.ts   # Commit log
│   ├── commands/                 # Tauri invoke wrappers (typed)
│   │   ├── auth.ts               # login, logout, whoami
│   │   ├── uploads.ts            # enqueue, pause, resume, cancel
│   │   └── repos.ts              # create, delete, rename, list files
│   └── lib/                      # Utilities, constants, types
│       ├── types.ts              # Shared TypeScript types
│       └── queryClient.ts        # TanStack Query client config
│
└── src-tauri/                    # Rust backend
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/             # Security capability definitions
    ├── src/
    │   ├── main.rs               # Desktop entry (calls lib::run)
    │   ├── lib.rs                # App setup, state init, command registration
    │   ├── commands/             # #[tauri::command] handlers
    │   │   ├── mod.rs
    │   │   ├── auth.rs           # login, logout, validate_token
    │   │   ├── upload.rs         # enqueue_upload, pause, resume, cancel
    │   │   └── repo.rs           # list_repos, create_repo, delete_file, etc.
    │   ├── upload/               # Upload engine
    │   │   ├── mod.rs
    │   │   ├── queue.rs          # UploadQueue, task state machine
    │   │   ├── worker.rs         # tokio task: chunk, hash, upload via Xet
    │   │   └── progress.rs       # Progress emission to frontend
    │   ├── hf/                   # HF API client
    │   │   ├── mod.rs
    │   │   ├── client.rs         # reqwest client, auth header injection
    │   │   ├── api.rs            # REST calls: repos, files, commits
    │   │   └── xet.rs            # Xet CAS chunked upload protocol
    │   ├── db/                   # Persistence
    │   │   ├── mod.rs
    │   │   └── schema.rs         # Upload queue, settings tables
    │   └── state.rs              # AppState definition, initialization
    └── icons/
```

### Structure Rationale

- **commands/**: Thin handlers only — validate input, call service, return result. No business logic lives here.
- **upload/**: Self-contained upload engine. Queue persistence means uploads survive app restarts.
- **hf/**: All HF API knowledge isolated here. If HF changes the Xet protocol, only this module changes.
- **queries/ vs stores/**: TanStack Query owns remote data (repos, files); Zustand owns local UI state (queue display, user prefs). They don't overlap.
- **commands/ (frontend)**: Typed wrappers around `invoke()` — the rest of the UI never calls invoke directly.

## Architectural Patterns

### Pattern 1: Async Command with Channel-Based Progress Streaming

**What:** Long-running Rust commands stream progress updates back to the frontend via `tauri::ipc::Channel` rather than polling.

**When to use:** Any operation that takes >1 second — uploads, hashing, folder scans.

**Trade-offs:** Clean separation, no polling overhead. Channels have serialization cost but are faster than events for binary-adjacent data.

**Example:**
```rust
#[tauri::command]
async fn start_upload(
    job_id: String,
    state: tauri::State<'_, AppState>,
    progress: tauri::ipc::Channel<UploadProgress>,
) -> Result<(), String> {
    let queue = state.upload_queue.lock().await;
    queue.enqueue(job_id, progress).await.map_err(|e| e.to_string())
}
```
```typescript
// Frontend
const channel = new Channel<UploadProgress>();
channel.onmessage = (msg) => updateProgressBar(msg.percent);
await invoke('start_upload', { jobId, __TAURI_CHANNEL__: channel });
```

### Pattern 2: Upload Queue as Persistent State Machine

**What:** Each upload is a state machine: `Pending → Hashing → Uploading → Committing → Done | Failed | Paused`. State is persisted to SQLite so the queue survives crashes and restarts.

**When to use:** Any upload that could take minutes or hours on a flaky connection.

**Trade-offs:** More implementation complexity upfront, but eliminates the #1 user complaint (lost progress on disconnect). Required for the core value proposition.

**Example state transitions:**
```
Pending
  → Hashing (SHA256 + Xet chunk analysis)
  → WaitingForXetAuth (get upload token from CAS)
  → UploadingChunks (stream file chunks to Xet CAS)
  → CommittingToHub (POST commit to HF REST API)
  → Done

Any state → Failed (with retry_count, last_error)
Any state → Paused (user action)
Paused → Pending (user resumes)
Failed → Pending (auto-retry or user retry)
```

### Pattern 3: Command Registry Pattern (Thin Commands, Fat Services)

**What:** `#[tauri::command]` functions are thin — they extract arguments, call a service method, and return a serialized result. Business logic lives in service structs, not in command handlers.

**When to use:** Always. Keeps commands testable in isolation from Tauri.

**Trade-offs:** Slightly more boilerplate, significantly better testability and maintainability.

**Example:**
```rust
// Thin command
#[tauri::command]
async fn create_repo(name: String, repo_type: String, state: tauri::State<'_, AppState>) -> Result<RepoInfo, String> {
    let client = state.hf_client.lock().await;
    client.create_repo(&name, &repo_type).await.map_err(|e| e.to_string())
}

// Fat service (testable without Tauri)
impl HfClient {
    pub async fn create_repo(&self, name: &str, repo_type: &str) -> Result<RepoInfo, HfError> {
        // actual logic here
    }
}
```

### Pattern 4: TanStack Query + Tauri Invoke

**What:** Treat Tauri invoke calls as async data sources that TanStack Query manages (caching, refetching, invalidation). Remote HF data goes through Query; local app state goes through Zustand.

**When to use:** Any data that comes from HF API (repos, files, commits, dataset rows).

**Trade-offs:** Desktop apps don't need aggressive cache invalidation like web apps — configure staleTime to be generous (5+ minutes for repo lists).

**Example:**
```typescript
// queries/useRepos.ts
export function useRepos(userId: string) {
  return useQuery({
    queryKey: ['repos', userId],
    queryFn: () => invoke<RepoInfo[]>('list_repos', { userId }),
    staleTime: 5 * 60 * 1000, // 5 min — desktop, not web
  });
}
```

## Data Flow

### Upload Flow (Core)

```
User selects files (drag & drop / file picker)
    ↓
React calls invoke('enqueue_upload', { files, repoId, ... })
    ↓
Rust: UploadQueue.enqueue() → persists job to SQLite
    ↓
Rust: tokio::spawn(worker) → runs in background
    ↓
Worker: Hash file (SHA256) → query Xet CAS for known chunks
    ↓
Worker: Upload only new chunks → stream to Xet CAS endpoint
    ↓
Worker: POST commit to HF Hub REST API (LFS pointer or Xet ref)
    ↓
Worker: emit progress events to frontend via Channel
    ↓
React: Channel.onmessage → update Zustand uploadStore → re-render progress UI
    ↓
Worker: job state → Done/Failed → persist to SQLite
    ↓
React: TanStack Query invalidates repo file list → refetches
```

### Authentication Flow

```
User enters token OR clicks "Login with HF"
    ↓
React: invoke('login', { token }) or invoke('start_oauth_flow')
    ↓
Rust: validate token against HF /api/whoami
    ↓
Rust: store token in OS keychain (via keyring crate)
    ↓
Rust: update AuthState in app state
    ↓
Rust: emit 'auth_changed' event
    ↓
React: Zustand authStore.setUser() → UI re-renders as authenticated
```

### Repository Browse Flow

```
User navigates to Repo Browser
    ↓
React: useRepos() query fires invoke('list_repos', { search, type })
    ↓
Rust: HfClient.list_repos() → GET https://huggingface.co/api/models (or /datasets)
    ↓
Rust: returns Vec<RepoInfo> serialized as JSON
    ↓
React: TanStack Query caches result (5 min stale), renders RepoCard list
    ↓
User clicks repo → useRepoFiles() fires → Rust fetches file tree → renders
    ↓
User clicks dataset file → useDatasetRows() fires → Rust streams parquet preview
```

### State Management Division

```
Zustand (client state — ephemeral, in-memory)
├── authStore: { token, user, isAuthenticated }
└── uploadStore: { activeJobs: map of jobId→displayState }
    (mirrors queue from Rust, updated via events/channels)

TanStack Query (server state — cached, invalidatable)
├── ['repos', userId] → list of repos
├── ['repo-files', repoId] → file tree
├── ['commits', repoId] → commit history
└── ['dataset-rows', repoId, file, page] → paginated rows

SQLite (persistent state — survives restarts)
├── upload_jobs: { id, status, file_path, repo_id, progress, error, created_at }
└── settings: { token_hint, theme, default_repo_type, ... }
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| HF Hub REST API | reqwest HTTP client, Bearer token auth | Rate limits apply; back off on 429 |
| HF Xet CAS | reqwest + chunked multipart upload | New default as of 2025; replaces S3 LFS for most files |
| HF OAuth | Tauri opens system browser, captures redirect via custom protocol | `hf://callback` scheme registered in tauri.conf.json |
| OS Keychain | `keyring` crate (cross-platform) | Avoids storing token in plaintext |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React → Rust commands | `invoke()` → `#[tauri::command]` | Typed wrappers in `src/commands/`; never call invoke directly from components |
| Rust → React (push) | `Channel<T>` for streaming; `app_handle.emit()` for discrete events | Channels for upload progress; events for auth changes, job completions |
| Upload Worker → Queue | `tokio::sync::mpsc` channel | Worker sends state updates to queue manager |
| Commands → Services | Direct function calls (same process) | Services are plain Rust structs, no Tauri coupling |
| Services → SQLite | `sqlx` async pool | Queue persistence and settings |

## Scaling Considerations

This is a single-user desktop app — "scaling" means handling larger files and more concurrent uploads, not user volume.

| Concern | At 1-5 concurrent uploads | At 10+ concurrent uploads |
|---------|--------------------------|--------------------------|
| Memory (file I/O) | Stream chunks, never load full file | Same — streaming is mandatory from day 1 |
| CPU (hashing) | Single tokio task per file | Use rayon for parallel SHA256 computation |
| Network | Per-connection rate limiting in reqwest | Semaphore to cap concurrent chunk uploads |
| UI responsiveness | Channels keep UI thread free | Same pattern holds |

### Scaling Priorities

1. **First constraint: Memory** — Never buffer more than one chunk (default: 4MB) per active upload in memory. `tokio::fs::File` with chunked reads is mandatory. If you read entire files into memory, 100GB files will crash the app.
2. **Second constraint: SQLite write contention** — Progress updates are high-frequency. Batch SQLite writes (write every N% progress, not every chunk). Use WAL mode.

## Anti-Patterns

### Anti-Pattern 1: Reading Large Files into Memory

**What people do:** `std::fs::read(path)` to get bytes, then POST the whole thing.
**Why it's wrong:** A 100GB file requires 100GB of RAM. The app will OOM and crash.
**Do this instead:** Stream using `tokio::fs::File` + `read_buf` in a loop, sending chunks directly to the HTTP body via `reqwest::Body::wrap_stream`.

### Anti-Pattern 2: Calling invoke() Directly from Components

**What people do:** `invoke('list_repos', ...)` scattered throughout React components.
**Why it's wrong:** No type safety, no caching, duplicate calls, hard to mock in tests.
**Do this instead:** Wrap every invoke call in a typed function in `src/commands/`, then use TanStack Query hooks that call those wrappers.

### Anti-Pattern 3: Storing Upload State Only in React

**What people do:** Track upload queue in Zustand or useState only.
**Why it's wrong:** If the app crashes or is closed mid-upload, all progress is lost.
**Do this instead:** Source of truth for upload state is SQLite in the Rust backend. React mirrors it via events for display purposes only.

### Anti-Pattern 4: Blocking the Main Thread with Sync I/O

**What people do:** Synchronous file reads or HTTP calls in Tauri commands.
**Why it's wrong:** Blocks the Tauri core thread, making the entire app unresponsive.
**Do this instead:** All commands that do file I/O or network calls must be `async`. Use `tauri::async_runtime::spawn` for fire-and-forget background work.

### Anti-Pattern 5: Polling for Upload Progress

**What people do:** Frontend polls `invoke('get_upload_status', jobId)` every second.
**Why it's wrong:** Wasteful IPC overhead; UI updates are choppy and delayed.
**Do this instead:** Use `tauri::ipc::Channel` for streaming progress from the upload worker to the frontend. Updates arrive as they happen.

## Build Order Implications

Components have clear dependencies. The suggested build sequence follows the dependency graph:

1. **HF HTTP Client + Auth** (`src-tauri/hf/client.rs`, auth commands) — everything depends on authenticated API access.
2. **App State + SQLite schema** (`state.rs`, `db/`) — upload queue and settings persistence needed before any stateful features.
3. **Upload Engine** (`upload/queue.rs`, `upload/worker.rs`) — core value proposition; build early to validate the Xet chunked upload flow.
4. **Repo CRUD Commands** (`commands/repo.rs`) — needed for upload destination selection and post-upload management.
5. **React Bridge Layer** (`src/commands/*.ts`, Zustand stores, TanStack Query hooks) — once Rust API is stable, wire up the frontend.
6. **Upload UI** (wizard + queue view) — built on top of the bridge layer.
7. **Repository Browser + Dataset Preview** — secondary features, built once upload loop is solid.
8. **Background/system tray** — enhancement layer once core flows work.

## Sources

- [Tauri v2 Architecture](https://v2.tauri.app/concept/architecture/) — official docs, HIGH confidence
- [Tauri v2 IPC / Calling Rust](https://v2.tauri.app/develop/calling-rust/) — official docs, HIGH confidence
- [Tauri v2 State Management](https://v2.tauri.app/develop/state-management/) — official docs, HIGH confidence
- [Tauri v2 Project Structure](https://v2.tauri.app/start/project-structure/) — official docs, HIGH confidence
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) — official docs, HIGH confidence
- [HF Hub Upload Guide](https://huggingface.co/docs/huggingface_hub/en/guides/upload) — official docs, HIGH confidence
- [HF Hub API Endpoints](https://huggingface.co/docs/hub/api) — official docs, HIGH confidence
- [HF Storage Limits](https://huggingface.co/docs/hub/storage-limits) — official docs, HIGH confidence
- [HF Rearchitecting Uploads (Xet)](https://huggingface.co/blog/rearchitecting-uploads-and-downloads) — official HF engineering blog, HIGH confidence
- [Long-running async tasks in Tauri v2](https://sneakycrow.dev/blog/2024-05-12-running-async-tasks-in-tauri-v2) — community guide, MEDIUM confidence
- [TanStack Query + Tauri template](https://github.com/dannysmith/tauri-template) — community production template, MEDIUM confidence

---
*Architecture research for: Tauri v2 + React desktop app for HF large file uploads*
*Researched: 2026-03-19*
