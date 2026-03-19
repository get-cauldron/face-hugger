# Phase 2: Upload Engine - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Rust upload engine with Xet/LFS protocol detection, resumable chunked uploads, SQLite-backed queue state, and progress reporting via Tauri Channels. This phase builds the engine only — no upload wizard UI or drag-and-drop (that's Phase 3). The engine exposes Tauri commands that Phase 3's React UI will call.

</domain>

<decisions>
## Implementation Decisions

### Resume behavior
- Silent auto-retry on network drop — no user action needed, just keep going
- Unlimited retries with exponential backoff (5s, 15s, 30s, 60s cap) until user cancels
- On resume: re-verify with server which chunks it has, then skip confirmed — most reliable approach
- On app restart: show incomplete uploads in queue as "paused" but don't auto-start — user clicks resume
- SQLite persists upload state (file path, target repo, confirmed chunks, total size) — survives crashes and restarts

### Queue management
- Concurrent upload limit: user-configurable, default 2, range 1-5 (stored in tauri-plugin-store preferences)
- Queue order: FIFO with priority flag — user can mark an upload as "priority" to jump to front
- "Pause all" means immediately stop all active transfers — they stay in queue as paused (no "finish current chunk" grace)
- Cancel leaves partial/uncommitted chunks on HF — they'll be garbage collected by HF, no cleanup needed
- CancellationToken per upload task — `tokio::select!` on chunk future + cancellation signal in the chunk loop

### Progress reporting
- Per-file metrics: progress bar + percentage, current speed (MB/s), ETA, bytes transferred / total (e.g., "2.1 GB / 7.4 GB")
- Global progress summary: always visible — total bytes across all active uploads, overall percentage, aggregate speed
- Update frequency: 500ms batched timer reading shared `Arc<Mutex<UploadState>>` — never emit per-chunk from the upload task directly
- Progress flows from Rust to React via `tauri::ipc::Channel<T>` (not `emit_all` events) for throughput and ordering guarantees
- On completion: brief success toast notification, file moves to "completed" section in queue list (stays until user clears)

### Error experience
- Both layers: plain language summary ("Upload failed — the server rejected the file") with expandable technical details underneath (HTTP status, error body)
- Rate limits: auto-throttle silently — respect HF rate limits, auto-resume when quota resets, no user notification unless throttled for more than 60s
- Source file changed/deleted mid-upload: stop upload, show "Source file changed or missing — please re-add the file"
- Permission check: pre-check write access to target repo before starting upload — fail fast with "You don't have write access to this repo"
- File hashing: stream-hash in chunks via dedicated rayon threadpool (separate from Tokio blocking pool), cap at 2 concurrent hash jobs

### Claude's Discretion
- SQLite schema design for upload queue (tables, columns, indexes)
- Exact Xet CAS vs LFS detection logic (read repo metadata, route accordingly)
- Chunk size selection (balance between resume granularity and overhead)
- Exact exponential backoff curve and jitter
- reqwest Client connection pooling strategy
- Exact Tauri Channel event payload shape for progress updates

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — UPLD-01 through UPLD-05 and UPLD-10 are this phase's requirements
- `.planning/research/SUMMARY.md` — Full research summary with critical pitfalls

### Phase 1 patterns (must follow)
- `src-tauri/src/lib.rs` — Command registration pattern (collect_commands!, tauri-specta, plugin setup)
- `src-tauri/src/state.rs` — AppState pattern (tokio::sync::Mutex, managed state)
- `src-tauri/src/commands/auth.rs` — Command signature pattern (#[tauri::command] + #[specta::specta])
- `src-tauri/src/hf/client.rs` — HF API client pattern (reqwest, error handling)
- `src/commands/auth.ts` — Frontend command wrapper pattern (unwrap Result<T,E>)

### Research (critical pitfalls)
- `.planning/research/PITFALLS.md` — Six critical pitfalls that ALL target the upload engine
- `.planning/research/ARCHITECTURE.md` — Component boundaries, upload engine architecture
- `.planning/research/STACK.md` — Technology versions and recommendations

### Phase 1 learnings (deviations to account for)
- `.planning/phases/01-foundation/01-01-SUMMARY.md` — specta version was rc.22 not rc.21, keyring features changed
- `.planning/phases/01-foundation/01-03-SUMMARY.md` — tauri-specta Result<T,E> must be unwrapped in frontend wrappers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/hf/client.rs`: HF API client with reqwest — extend with upload endpoints, repo metadata queries
- `src-tauri/src/state.rs`: AppState struct — extend with `upload_queue: Mutex<UploadQueue>` or similar
- `src-tauri/src/lib.rs`: Command registration — add upload commands to `collect_commands![]`
- `src/commands/auth.ts`: `unwrap()` helper for tauri-specta Result — reuse pattern for upload command wrappers
- `tauri-plugin-store`: Already installed — use for user preferences (concurrent upload limit)
- `tauri-plugin-fs`: Already installed — use for file access

### Established Patterns
- Commands: `async fn name(state: tauri::State<'_, AppState>) -> Result<T, String>` with `#[tauri::command]` + `#[specta::specta]`
- State: `tokio::sync::Mutex` wrapping state structs, accessed via `tauri::State`
- HTTP: `reqwest::Client` for HF API calls, Bearer token auth
- IPC: tauri-specta generates TypeScript bindings from Rust types

### Integration Points
- New upload commands register in `lib.rs` `collect_commands![]`
- Upload state extends `AppState` in `state.rs`
- HF upload API functions added to `hf/` module (or new `upload/` module)
- SQLite database needs new module (`db/` or `upload/db.rs`)
- Frontend will need new `src/commands/upload.ts` wrapper (Phase 3 concern, but command signatures matter now)
- Progress Channel type must be defined in Rust and will appear in generated `bindings.ts`

</code_context>

<specifics>
## Specific Ideas

- The user has an unreliable connection — this is the core pain point driving the entire product. Resume must be bulletproof.
- "Show pending" on app restart (not auto-resume) respects the user — they might have switched networks or be on metered data
- Priority flag on queue items is a lightweight power-user feature — simple boolean, bumps to front of FIFO
- Expandable technical error details are for the HF community audience — they're technical and want to see HTTP status codes when debugging

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-upload-engine*
*Context gathered: 2026-03-19*
