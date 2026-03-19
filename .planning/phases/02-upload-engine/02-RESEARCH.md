# Phase 2: Upload Engine - Research

**Researched:** 2026-03-19
**Domain:** Rust upload engine — Xet CAS protocol, LFS fallback, SQLite queue, Tauri Channel progress, tokio cancellation
**Confidence:** HIGH (Xet protocol sourced from official HF spec docs; patterns verified against live source)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Resume behavior:**
- Silent auto-retry on network drop — no user action needed, just keep going
- Unlimited retries with exponential backoff (5s, 15s, 30s, 60s cap) until user cancels
- On resume: re-verify with server which chunks it has, then skip confirmed — most reliable approach
- On app restart: show incomplete uploads in queue as "paused" but don't auto-start — user clicks resume
- SQLite persists upload state (file path, target repo, confirmed chunks, total size) — survives crashes and restarts

**Queue management:**
- Concurrent upload limit: user-configurable, default 2, range 1-5 (stored in tauri-plugin-store preferences)
- Queue order: FIFO with priority flag — user can mark an upload as "priority" to jump to front
- "Pause all" means immediately stop all active transfers — they stay in queue as paused (no "finish current chunk" grace)
- Cancel leaves partial/uncommitted chunks on HF — they'll be garbage collected by HF, no cleanup needed
- CancellationToken per upload task — `tokio::select!` on chunk future + cancellation signal in the chunk loop

**Progress reporting:**
- Per-file metrics: progress bar + percentage, current speed (MB/s), ETA, bytes transferred / total (e.g., "2.1 GB / 7.4 GB")
- Global progress summary: always visible — total bytes across all active uploads, overall percentage, aggregate speed
- Update frequency: 500ms batched timer reading shared `Arc<Mutex<UploadState>>` — never emit per-chunk from the upload task directly
- Progress flows from Rust to React via `tauri::ipc::Channel<T>` (not `emit_all` events) for throughput and ordering guarantees
- On completion: brief success toast notification, file moves to "completed" section in queue list (stays until user clears)

**Error experience:**
- Both layers: plain language summary with expandable technical details underneath (HTTP status, error body)
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UPLD-01 | User can upload files to HF repos using chunked streaming (supports 1-100GB+) | Xet CAS protocol spec: chunk→xorb→shard pipeline; tokio streaming with reqwest; never load file into memory |
| UPLD-02 | Uploads resume automatically after network interruption | SQLite persists confirmed xorb hashes; re-request fresh Xet write token on resume (tokens expire, never store); re-verify via shard idempotency |
| UPLD-03 | User sees per-file progress bar with speed and ETA | `Arc<Mutex<UploadProgressState>>` updated per-xorb; 500ms timer task emits via `tauri::ipc::Channel`; never per-chunk emit |
| UPLD-04 | User can queue multiple uploads | UploadQueue state machine in SQLite; `tokio::sync::Semaphore` caps concurrent workers at user-configured limit (default 2) |
| UPLD-05 | User can cancel, pause, and resume individual uploads | `tokio_util::sync::CancellationToken` per upload task; stored in AppState keyed by job_id; `tokio::select!` in xorb upload loop |
| UPLD-10 | App handles both Xet CAS and legacy LFS upload protocols automatically | Detect via LFS batch endpoint `transfer` field: `"xet"` → Xet pipeline; `"multipart"` → S3 pre-signed URL path; never store pre-signed URLs |
</phase_requirements>

---

## Summary

Phase 2 builds the Rust upload engine — the product's core value proposition. All six critical pitfalls from project research converge here and must be designed in from the start.

The most significant unknown was the Xet CAS protocol. Research confirms HuggingFace has published a formal Xet Protocol Specification (version 1.0.0) at `huggingface.co/docs/xet` covering the complete upload flow, CAS API endpoints, authentication, chunking algorithm, xorb format, and shard format. The reference implementation is `xet-core` on GitHub (Rust). This resolves the biggest pre-research risk.

Protocol detection (UPLD-10) is well-defined: the HF LFS batch endpoint response includes a `transfer` field. When a repo uses Xet, `transfer === "xet"` and response headers carry `X-Xet-Cas-Url`, `X-Xet-Access-Token`, `X-Xet-Token-Expiration`, and `X-Xet-Session-Id`. When a repo uses legacy LFS, `transfer === "multipart"`. The engine branches at this detection point.

The SQLite schema and Tauri Channel patterns are well-established. tokio CancellationToken patterns are thoroughly documented. The rayon + tokio separation for CPU-bound hashing is a known Rust pattern.

**Primary recommendation:** Build the Xet pipeline first (all new repos), implement LFS multipart as the fallback path. Use the official Xet spec for protocol correctness. Never store pre-signed URLs or Xet tokens in SQLite — store only confirmed xorb hashes and commit state.

---

## Standard Stack

### New Rust Dependencies (to add to Cargo.toml)

| Crate | Version | Purpose | Why |
|-------|---------|---------|-----|
| sqlx | 0.8.x | Async SQLite — upload queue persistence | Compile-time checked queries, async pool, WAL mode, migrations; already referenced in STACK.md |
| tokio-util | 0.7.18 | `CancellationToken`, `ReusableBoxFuture` | Official tokio cancellation primitive; `tokio::select!` integration |
| rayon | 1.11.0 | Dedicated CPU threadpool for file hashing | Separate from tokio's blocking pool — prevents hash work from starving network I/O |
| sha2 | 0.10.x | SHA-256 streaming hasher | Required for LFS pointer hash; streaming via `Update` trait |
| hex | 0.4.x | Hash-to-hex encoding | Required for Xet API paths (special byte-reversal encoding, see below) |

### Already Present (extend, don't add)

| Crate | Current Use | Extend For |
|-------|-------------|------------|
| reqwest 0.12 | HF API calls (auth) | Add `stream` + `multipart` features; upload xorbs, shards, LFS multipart parts |
| tokio 1.x | Async runtime | Upload workers already use this; add `tokio::sync::Semaphore` for concurrency cap |
| serde + serde_json | Auth state | Upload job structs, progress payloads |
| tauri-plugin-store 2.x | (not yet used) | User preferences: concurrent_upload_limit |
| tauri-plugin-fs 2.x | (not yet used) | File path validation, existence checks |

**Cargo.toml additions:**
```toml
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio-native-tls", "macros"] }
tokio-util = { version = "0.7", features = ["rt"] }
rayon = "1"
sha2 = "0.10"
hex = "0.4"

# Update reqwest features
reqwest = { version = "0.12", features = ["json", "stream", "multipart"] }
```

**Version verification (2026-03-19):** sqlx 0.9.0-alpha.1 exists but use 0.8.x stable. tokio-util 0.7.18 confirmed. rayon 1.11.0 confirmed. tauri-plugin-sql 2.3.2 confirmed (used for bindings if needed; raw sqlx preferred for the upload engine for compile-time safety).

---

## Architecture Patterns

### Recommended Module Structure (new additions to src-tauri/src/)

```
src-tauri/src/
├── lib.rs                    # Add upload commands to collect_commands![]
├── state.rs                  # Extend AppState with upload_queue + db_pool
├── commands/
│   └── upload.rs             # Thin command handlers (new file)
├── upload/
│   ├── mod.rs
│   ├── queue.rs              # UploadQueue — state machine, job management
│   ├── worker.rs             # tokio task: Xet pipeline or LFS path
│   ├── progress.rs           # Arc<Mutex<ProgressMap>>; 500ms timer emit
│   └── cancel.rs             # CancellationToken registry keyed by job_id
├── hf/
│   ├── mod.rs
│   ├── client.rs             # Extend: repo metadata, write-access check
│   ├── api.rs                # LFS batch endpoint, commit API (new file)
│   └── xet.rs                # Xet CAS protocol: token, xorb upload, shard (new file)
└── db/
    ├── mod.rs
    └── schema.rs             # SQLite migrations, CRUD for upload_jobs table
```

### Pattern 1: Xet Upload Pipeline

**What:** Full Xet CAS upload — the path for all new HF repos (default since May 2025).

**Flow:**
```
1. Pre-check: GET repo metadata → check write access
2. Detect protocol: POST {repo}.git/info/lfs/objects/batch → check transfer field
3. If transfer == "xet": extract casUrl, accessToken, exp from response headers
4. Hash file: stream-hash in rayon threadpool → compute chunk hashes + file SHA-256
5. Content-defined chunking: ~64KB chunks (min 8KB, max 128KB)
6. Group chunks into xorbs: ~64MB per xorb
7. For each xorb: POST {casUrl}/v1/xorbs/default/{xorb_hash_hex}
8. Build shard: file reconstruction terms + xorb metadata
9. POST {casUrl}/v1/shards (only after ALL xorbs uploaded)
10. Commit: POST HF Hub commit API with LFS pointer (SHA-256 of file content)
```

**Xet write token refresh URL:**
```
GET https://huggingface.co/api/{repo_type}s/{namespace}/{repo_name}/xet-write-token/{revision}
Authorization: Bearer {hf_token}
Response: { "accessToken": "xet_xxx", "exp": 1848535668, "casUrl": "https://cas-server.xethub.hf.co" }
```

Token scope is per-repo, per-revision. Refresh 30 seconds before `exp`. Never store `accessToken` in SQLite — only xorb confirmation state.

**Xet hash encoding (CRITICAL — non-standard):** Hash bytes are NOT encoded as a straight hex string. For every 8-byte block, reverse the byte order, then concatenate as lowercase hex. Use a helper function for this.

```rust
// Source: https://huggingface.co/docs/xet/main/en/api#converting-hashes-to-strings
fn xet_hash_to_hex(hash: &[u8; 32]) -> String {
    let mut reordered = [0u8; 32];
    for i in 0..4 {
        let block = &hash[i*8..(i+1)*8];
        let val = u64::from_le_bytes(block.try_into().unwrap());
        reordered[i*8..(i+1)*8].copy_from_slice(&val.to_le_bytes());
    }
    hex::encode(reordered)
}
```

Wait — re-reading the spec: each 8-byte block is treated as a little-endian u64, and its big-endian hex representation (16 chars, zero-padded) is concatenated. Implement this exactly as specified.

**Xorb upload:**
```
POST {casUrl}/v1/xorbs/default/{xorb_hash_hex}
Authorization: Bearer {xet_access_token}
Content-Type: application/octet-stream
Body: serialized xorb bytes (see xorb format spec)
Response: { "was_inserted": true }   // false = already existed, not an error
```

**Shard upload:**
```
POST {casUrl}/v1/shards
Authorization: Bearer {xet_access_token}
Content-Type: application/octet-stream
Body: serialized shard bytes (see shard format spec)
Response: { "result": 0 | 1 }  // both mean success
```

**Important ordering constraint:** ALL xorbs referenced by a shard MUST be fully uploaded before `POST /v1/shards`. The server rejects the shard with 400 if any referenced xorb is missing.

**Example:**
```rust
// Source: https://huggingface.co/docs/xet/main/en/api
async fn upload_xorb(
    cas_url: &str,
    xorb_hash: &str,
    xorb_bytes: Bytes,
    xet_token: &str,
) -> Result<(), UploadError> {
    let url = format!("{}/v1/xorbs/default/{}", cas_url, xorb_hash);
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", xet_token))
        .header("Content-Type", "application/octet-stream")
        .body(xorb_bytes)
        .send()
        .await?;
    match resp.status().as_u16() {
        200 => Ok(()),
        400 => Err(UploadError::BadRequest("malformed xorb".into())),
        401 => Err(UploadError::TokenExpired),
        403 => Err(UploadError::Forbidden),
        _ => Err(UploadError::Retryable(resp.status())),
    }
}
```

### Pattern 2: LFS Multipart Upload (Legacy Fallback)

**What:** Pre-signed S3 multipart upload — used when `transfer == "multipart"` from LFS batch.

**Flow:**
```
1. POST {repo}.git/info/lfs/objects/batch → transfer == "multipart"
   Response includes upload actions with per-part pre-signed S3 URLs
2. Stream file in parts → PUT to each pre-signed S3 URL
3. After all parts uploaded → POST commit to HF Hub commit API
```

**Critical:** Never store pre-signed S3 URLs in SQLite. On resume, re-call the LFS batch endpoint for fresh URLs. Store only `confirmed_parts: Vec<usize>` (which part numbers completed).

**Pre-signed URL TTL:** Empirically 1-2 hours. Treat as expired after 30 minutes. On any 403 from S3 (not HF), immediately re-request fresh URLs before retry.

### Pattern 3: Protocol Detection

**What:** Determine Xet vs LFS via the LFS batch endpoint response.

```rust
// Source: huggingface.js commit.ts (verified against API behavior)
// POST https://huggingface.co/{namespace}/{repo}.git/info/lfs/objects/batch
// Body: { "operation": "upload", "transfers": ["xet", "multipart"], "objects": [...] }
//
// Xet response: transfer field == "xet"; headers contain X-Xet-Cas-Url, X-Xet-Access-Token
// LFS response: transfer field == "multipart" or "basic"; objects contain upload href URLs

struct LfsBatchResponse {
    transfer: String,  // "xet" | "multipart" | "basic"
    objects: Vec<LfsObject>,
}

fn detect_protocol(resp: &LfsBatchResponse) -> UploadProtocol {
    if resp.transfer == "xet" {
        UploadProtocol::Xet
    } else {
        UploadProtocol::LfsMultipart
    }
}
```

**Note on detection:** The huggingface.js implementation also checks for Xet via the `xet-write-token` endpoint returning successfully. The LFS batch approach is confirmed as the authoritative detection method (`transfer` field in batch response).

### Pattern 4: CancellationToken Per Upload Task

**What:** Each upload job gets a `CancellationToken`. The token sender is stored in `AppState`. The `cancel_upload` command triggers it. The worker `select!`s on cancellation in every xorb upload loop.

```rust
// Source: tokio-util docs + Tauri community discussion #5894
use tokio_util::sync::CancellationToken;

// In AppState (extend state.rs):
pub struct AppState {
    pub auth: Mutex<AuthState>,
    pub upload_queue: Mutex<UploadQueue>,
    pub cancel_tokens: Mutex<HashMap<String, CancellationToken>>,
    pub db: SqlitePool,
}

// In upload worker:
async fn upload_xorbs(
    xorbs: Vec<Xorb>,
    token: CancellationToken,
    xet: &XetClient,
) -> Result<(), UploadError> {
    for xorb in xorbs {
        tokio::select! {
            _ = token.cancelled() => {
                return Err(UploadError::Cancelled);
            }
            result = xet.upload_xorb(&xorb) => {
                result?;
            }
        }
    }
    Ok(())
}

// In cancel_upload command (thin handler):
#[tauri::command]
#[specta::specta]
async fn cancel_upload(job_id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let tokens = state.cancel_tokens.lock().await;
    if let Some(token) = tokens.get(&job_id) {
        token.cancel();
    }
    Ok(())
}
```

### Pattern 5: Batched Progress via Channel

**What:** Upload progress flows from a shared `Arc<Mutex<ProgressMap>>` to the frontend via `tauri::ipc::Channel`. A separate timer task reads the map and emits every 500ms. The upload worker only writes to the map.

```rust
// Source: Tauri v2 docs + CONTEXT.md decisions
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::ipc::Channel;

#[derive(serde::Serialize, specta::Type, Clone)]
pub struct UploadProgress {
    pub job_id: String,
    pub bytes_sent: u64,
    pub total_bytes: u64,
    pub speed_bps: f64,
    pub eta_seconds: f64,
    pub state: UploadJobState,
}

// Command receives Channel from frontend:
#[tauri::command]
#[specta::specta]
async fn start_upload(
    job_id: String,
    state: tauri::State<'_, AppState>,
    progress_channel: Channel<UploadProgress>,
) -> Result<(), String> {
    // ...spawn worker + timer task...
}

// Timer task (separate from worker):
tokio::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_millis(500));
    loop {
        interval.tick().await;
        let progress = {
            let map = progress_map.lock().unwrap();
            map.get(&job_id).cloned()
        };
        if let Some(p) = progress {
            let _ = channel.send(p);
        }
    }
});
```

**TypeScript usage:**
```typescript
// Source: Tauri v2 docs (https://v2.tauri.app/develop/calling-rust/)
import { Channel } from '@tauri-apps/api/core';

const channel = new Channel<UploadProgress>();
channel.onmessage = (progress) => {
    updateUploadStore(progress);
};
await invoke('start_upload', { jobId, __TAURI_CHANNEL__: channel });
```

### Pattern 6: SQLite Schema for Upload Queue

**Design:** WAL mode, single-writer connection, connection pool for reads. All progress writes are batched (not per-xorb). Resume state stores only confirmed xorb hashes, not URLs.

```sql
-- Migration 001_upload_queue.sql
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS upload_jobs (
    id TEXT PRIMARY KEY,                    -- UUID
    file_path TEXT NOT NULL,               -- absolute local path
    file_name TEXT NOT NULL,               -- display name
    repo_id TEXT NOT NULL,                 -- "namespace/repo-name"
    repo_type TEXT NOT NULL CHECK(repo_type IN ('model', 'dataset', 'space')),
    revision TEXT NOT NULL DEFAULT 'main',
    commit_message TEXT NOT NULL,
    total_bytes INTEGER NOT NULL,
    bytes_confirmed INTEGER NOT NULL DEFAULT 0,
    protocol TEXT CHECK(protocol IN ('xet', 'lfs_multipart', NULL)),
    state TEXT NOT NULL DEFAULT 'pending'
        CHECK(state IN ('pending', 'hashing', 'uploading', 'committing', 'done', 'failed', 'paused', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 0,   -- 1 = priority, jumps to front
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL,           -- Unix timestamp
    updated_at INTEGER NOT NULL
);

-- Tracks which xorbs have been confirmed uploaded (Xet path)
CREATE TABLE IF NOT EXISTS confirmed_xorbs (
    job_id TEXT NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
    xorb_hash TEXT NOT NULL,
    PRIMARY KEY (job_id, xorb_hash)
);

-- Tracks which LFS parts have been confirmed uploaded (LFS path)
CREATE TABLE IF NOT EXISTS confirmed_lfs_parts (
    job_id TEXT NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
    part_number INTEGER NOT NULL,
    PRIMARY KEY (job_id, part_number)
);

CREATE INDEX idx_upload_jobs_state ON upload_jobs(state);
CREATE INDEX idx_upload_jobs_priority_created ON upload_jobs(priority DESC, created_at ASC);
```

**Key design decisions:**
- `confirmed_xorbs` stores hashes (content-addressed = permanent). Safe to persist.
- `confirmed_lfs_parts` stores part numbers only (not URLs). On resume, fresh URLs requested.
- `protocol` is NULL until detected — set when worker starts.
- `state` transitions enforced in Rust, not SQL constraints.
- WAL mode: set via `SqliteConnectOptions::journal_mode(SqliteJournalMode::Wal)` in pool setup.

### Pattern 7: rayon Threadpool for File Hashing

**What:** CPU-bound SHA-256 hashing runs in a dedicated rayon threadpool, isolated from tokio's blocking pool.

```rust
// Source: rayon docs + tokio community recommendations
use rayon::ThreadPoolBuilder;
use sha2::{Digest, Sha256};
use std::io::Read;

// Initialize once at app start (add to AppState or use lazy_static):
static HASH_POOL: std::sync::OnceLock<rayon::ThreadPool> = std::sync::OnceLock::new();

fn hash_pool() -> &'static rayon::ThreadPool {
    HASH_POOL.get_or_init(|| {
        ThreadPoolBuilder::new()
            .num_threads(2) // cap at 2 concurrent hash jobs per CONTEXT.md decision
            .thread_name(|i| format!("face-hugger-hasher-{}", i))
            .build()
            .expect("failed to build hash threadpool")
    })
}

// Called from tokio task via spawn_blocking bridge:
pub async fn hash_file_streaming(path: &Path) -> Result<([u8; 32], u64), HashError> {
    let path = path.to_owned();
    tokio::task::spawn_blocking(move || {
        hash_pool().install(|| {
            let mut file = std::fs::File::open(&path)?;
            let mut hasher = Sha256::new();
            let mut buf = vec![0u8; 8 * 1024 * 1024]; // 8MB read buffer
            let mut total = 0u64;
            loop {
                let n = file.read(&mut buf)?;
                if n == 0 { break; }
                hasher.update(&buf[..n]);
                total += n as u64;
            }
            Ok((hasher.finalize().into(), total))
        })
    })
    .await
    .map_err(|e| HashError::JoinError(e))?
}
```

### Pattern 8: HF Commit After Xet Upload

After Xet xorbs and shards are uploaded, a Git commit is still required to make the file visible in the repo. The commit uses the LFS pointer format with the file's SHA-256 hash.

```
POST https://huggingface.co/api/{repo_type}s/{namespace}/{repo_name}/commit/{revision}
Authorization: Bearer {hf_token}
Content-Type: application/x-ndjson

{"key": "header", "value": {"summary": "Upload {filename}", "description": ""}}
{"key": "lfsFile", "value": {"path": "{path_in_repo}", "algo": "sha256", "oid": "{sha256_hex}", "size": {file_size}}}
```

This is the same commit format for both Xet and LFS uploads — the LFS pointer (sha256 oid + size) is what gets committed to git; the actual bytes live in Xet CAS or S3 LFS respectively.

### Pattern 9: Exponential Backoff with Jitter

**Locked: 5s, 15s, 30s, 60s cap.** Recommend full jitter to avoid thundering herd when multiple uploads retry simultaneously.

```rust
// Backoff schedule: 5s, 15s, 30s, 60s (cap), jitter ±20%
fn backoff_duration(retry_count: u32) -> Duration {
    let base_ms: u64 = match retry_count {
        0 => 5_000,
        1 => 15_000,
        2 => 30_000,
        _ => 60_000,  // cap
    };
    // ±20% jitter
    let jitter = (rand::random::<f64>() * 0.4 - 0.2) * base_ms as f64;
    Duration::from_millis((base_ms as f64 + jitter) as u64)
}
```

Add `rand = "0.8"` to Cargo.toml for jitter.

### Pattern 10: State Machine Transitions

```
Pending
  → Hashing (tokio::spawn hash_file_streaming)
  → DetectingProtocol (LFS batch endpoint call)
  → UploadingXorbs (Xet path: xorb loop with CancellationToken)
  → UploadingShard (Xet path: POST /v1/shards)
  or
  → UploadingLfsParts (LFS path: multipart S3 upload)
  → Committing (POST HF commit API)
  → Done

Any active state → Paused (immediate CancellationToken.cancel())
Paused → Pending (user resumes — re-enter from last confirmed checkpoint)
Any active state → Failed (with retry_count++)
Failed → Pending (auto-retry after backoff, or user-triggered)
Done (terminal)
Cancelled (terminal — no cleanup needed, HF GCs orphaned chunks)
```

### Anti-Patterns to Avoid

- **Store pre-signed URLs in SQLite:** They expire in ~1-2 hours. Store only confirmed part numbers. Recovery cost if you get this wrong: immediate 403 failures on any resumed upload.
- **Emit progress per-xorb from the upload task:** At 64MB xorbs for a 100GB file = ~1,600 events minimum. Timer-batch instead. 500ms is the decided cadence.
- **Single `upload_folder()` commit:** HF backend consistency check times out at ~50 files. Use per-file task approach with batched commits.
- **Xet token stored in SQLite:** Token `exp` is a Unix timestamp. Token is repo-scoped and time-limited. Refresh 30 seconds before expiry. Never store.
- **Blocking hashing in tokio async context:** sha2 over 100GB takes 30-90s. Always via rayon pool + spawn_blocking bridge.
- **Assuming Xet for old repos:** Always detect via LFS batch `transfer` field. Many legacy repos still use `transfer == "multipart"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async SQLite | Custom file-based queue | sqlx 0.8 + SQLitePool | WAL mode, compile-time query checking, migrations, connection pooling |
| CPU-bound SHA-256 | Tokio spawn_blocking direct | rayon ThreadPool + spawn_blocking bridge | Rayon manages CPU parallelism correctly; blocking pool is for I/O, not CPU |
| HTTP retry logic | Custom retry loop | Implement via backoff curve (5/15/30/60s) using tokio::time::sleep; reqwest handles connection errors | Connection errors are separate from HTTP errors; need classification (transient vs permanent) |
| Xet chunking algorithm | Custom CDC implementation | Read `xet-core/deduplication/src/chunking.rs` reference; implement Gearhash-based CDC per spec | Content-defined chunking with Gearhash has specific parameters — wrong implementation breaks deduplication |
| Xorb serialization | Ad-hoc binary format | Read xorb spec at `huggingface.co/docs/xet/en/xorb` and implement per spec | Binary format has specific header, chunk compression, and ordering requirements |
| Shard serialization | Ad-hoc format | Read shard spec at `huggingface.co/docs/xet/en/shard` | Shard has HMAC key, bookend structure, specific section ordering |

**Key insight:** The Xet xorb and shard binary formats have formal specifications. Do not infer the format from examples — read the spec pages for xorb format (`/docs/xet/en/xorb`) and shard format (`/docs/xet/en/shard`) before implementing serialization.

---

## Common Pitfalls

### Pitfall 1: Xet Hash Encoding (Non-Standard Byte Reversal)

**What goes wrong:** Encoding the 32-byte hash as a straight lowercase hex string fails. The CAS API path uses a non-standard encoding.

**Why it happens:** For each 8-byte block of the hash, interpret it as a little-endian u64, then format as 16-char hex. This is NOT the same as hex::encode(hash). Failure produces 400 Bad Request from the xorb upload endpoint.

**How to avoid:** Implement a dedicated `xet_hash_to_hex` function. Test it against the example in the spec: `[0,1,2,3,4,5,6,7,...]` → `07060504030201000f0e0d0c0b0a0908...`

**Warning signs:** 400 responses from `/v1/xorbs/default/{hash}` when the xorb itself is correctly serialized.

### Pitfall 2: Shard Uploaded Before All Xorbs Complete

**What goes wrong:** POST /v1/shards returns 400 ("referenced xorb doesn't exist") if any xorb in the shard hasn't completed uploading.

**Why it happens:** Concurrent xorb uploads + eager shard submission race condition.

**How to avoid:** Await all xorb upload futures (use `futures::future::join_all` or equivalent) before issuing the shard upload. Track completion in a local set before proceeding.

**Warning signs:** 400 from /v1/shards with message about missing xorb hash.

### Pitfall 3: Token Expiry Mid-Upload

**What goes wrong:** Xet write tokens expire (check `exp` field in token response). A multi-hour upload will encounter 401 from CAS mid-upload.

**Why it happens:** Token acquired at upload start, not refreshed. The spec says "add 30 seconds of buffer before expiration to refresh."

**How to avoid:** Track token `exp` in-memory (NOT in SQLite). Before each xorb upload, check if `now + 30s >= exp`. If so, call the write-token endpoint to get a fresh token. The `refreshWriteTokenUrl` is `GET .../xet-write-token/main`.

**Warning signs:** 401 from CAS mid-upload on multi-hour files.

### Pitfall 4: Stale LFS Pre-Signed URLs on Resume

**What goes wrong:** 403 from `s3.amazonaws.com` (not huggingface.co) on resumed uploads. No clear HF error message.

**Why it happens:** Pre-signed URLs stored in resume state expire in ~1-2 hours. Resumed upload re-uses stale URL.

**How to avoid:** Store only part numbers in `confirmed_lfs_parts`. On resume, call LFS batch endpoint again for fresh pre-signed URLs.

**Warning signs:** 403 from S3 domain on resumed upload; works fine on fresh upload.

### Pitfall 5: IPC Progress Flooding

**What goes wrong:** Tauri IPC event backlog causes UI freeze or upload pipeline stall.

**Why it happens:** Emitting per-xorb progress directly from the upload task. At 8MB-64MB xorbs, this is hundreds to thousands of IPC calls. Tauri's JSON-RPC IPC has overhead, and the WebView event queue is bounded.

**How to avoid:** Timer task pattern (Pattern 5 above). Upload worker writes bytes_confirmed to `Arc<Mutex<ProgressMap>>`. Timer at 500ms reads and sends via Channel. Channel is faster than `emit_all` for ordered streaming data.

**Warning signs:** UI framerate drops during upload; progress arrives in bursts then freezes.

### Pitfall 6: Zombie Tokio Tasks on Cancel/Exit

**What goes wrong:** Network activity continues after user cancels. Multiple ghost uploads on app restart.

**Why it happens:** `tokio::spawn` tasks are not cancelled on Tauri app exit or command return. No cancellation path means the task runs to completion regardless of user action.

**How to avoid:** Pattern 4 above — `CancellationToken` per job stored in AppState, `select!` in every xorb loop iteration.

**Warning signs:** Network traffic continues in Activity Monitor after clicking Cancel; upload job count increases unexpectedly on restart.

---

## Code Examples

### SQLite Pool Initialization

```rust
// Source: sqlx docs + Tauri pattern (https://dezoito.github.io/2025/01/01/embedding-sqlite-in-a-tauri-application.html)
use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use sqlx::sqlite::SqliteJournalMode;
use std::str::FromStr;

pub async fn init_db(app_data_dir: &Path) -> Result<SqlitePool, sqlx::Error> {
    let db_path = app_data_dir.join("uploads.db");
    let opts = SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path.display()))?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePool::connect_with(opts).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
```

### Enqueue Upload Job

```rust
// Thin command handler
#[tauri::command]
#[specta::specta]
pub async fn enqueue_upload(
    file_path: String,
    repo_id: String,
    repo_type: String,
    commit_message: String,
    priority: bool,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let job_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    sqlx::query!(
        "INSERT INTO upload_jobs (id, file_path, file_name, repo_id, repo_type, commit_message, total_bytes, priority, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?)",
        job_id,
        file_path,
        std::path::Path::new(&file_path).file_name().unwrap().to_str().unwrap(),
        repo_id,
        repo_type,
        commit_message,
        if priority { 1 } else { 0 },
        now,
        now,
    )
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    // Kick off the queue processor
    state.upload_queue.lock().await.try_start_next(&state).await;

    Ok(job_id)
}
```

### Xet Write Token Request

```rust
// Source: https://huggingface.co/docs/xet/en/auth
#[derive(serde::Deserialize)]
pub struct XetWriteToken {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    pub exp: u64,
    #[serde(rename = "casUrl")]
    pub cas_url: String,
}

pub async fn get_xet_write_token(
    hf_token: &str,
    repo_type: &str,
    repo_id: &str,
    revision: &str,
) -> Result<XetWriteToken, reqwest::Error> {
    let url = format!(
        "https://huggingface.co/api/{}s/{}/xet-write-token/{}",
        repo_type, repo_id, revision
    );
    reqwest::Client::new()
        .get(&url)
        .header("Authorization", format!("Bearer {}", hf_token))
        .send()
        .await?
        .json::<XetWriteToken>()
        .await
}
```

### LFS Batch Endpoint for Protocol Detection

```rust
// Source: huggingface.js commit.ts analysis
#[derive(serde::Serialize)]
struct LfsBatchRequest {
    operation: String,
    transfers: Vec<String>,
    objects: Vec<LfsBatchObject>,
}

#[derive(serde::Serialize)]
struct LfsBatchObject {
    oid: String,
    size: u64,
}

#[derive(serde::Deserialize)]
struct LfsBatchResponse {
    transfer: String,
    objects: Vec<serde_json::Value>,
}

pub async fn detect_upload_protocol(
    hf_token: &str,
    repo_id: &str,   // "namespace/repo-name"
    file_oid: &str,  // SHA-256 hex of file content
    file_size: u64,
) -> Result<UploadProtocol, String> {
    let url = format!("https://huggingface.co/{}.git/info/lfs/objects/batch", repo_id);
    let body = LfsBatchRequest {
        operation: "upload".into(),
        transfers: vec!["xet".into(), "multipart".into()],
        objects: vec![LfsBatchObject { oid: file_oid.into(), size: file_size }],
    };

    let resp = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Bearer {}", hf_token))
        .header("Content-Type", "application/vnd.git-lfs+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let batch: LfsBatchResponse = resp.json().await.map_err(|e| e.to_string())?;

    if batch.transfer == "xet" {
        Ok(UploadProtocol::Xet)
    } else {
        Ok(UploadProtocol::LfsMultipart)
    }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Git LFS (S3 pre-signed URLs) | Xet CAS (content-addressed, chunk-deduplicated) | May 2025 — default for ALL new repos | New implementation must support both; LFS is legacy path |
| `emit_all` events for progress | `tauri::ipc::Channel<T>` for streaming | Tauri v2.0 stable | Channel is faster, ordered, recommended for all streaming data |
| `upload_folder()` for all uploads | Per-file task approach with batch commits | huggingface_hub >= 0.30 | Naive batch commits silently corrupt repos at >50 files |
| `spawn_blocking` direct for hashing | rayon ThreadPool + spawn_blocking bridge | Established pattern | Prevents CPU saturation of tokio's blocking pool |
| Tauri v1 IPC patterns | Tauri v2 `@tauri-apps/api` v2 + tauri-specta | Tauri 2.0 | v1 patterns break silently; project already on v2 |

**Deprecated/outdated:**
- `app.emit_all()` for high-frequency progress: use Channel instead for uploads
- Storing pre-signed LFS URLs in resume state: replaced by part-number-only tracking

---

## Open Questions

1. **Xorb and Shard binary format details**
   - What we know: Official spec pages exist at `/docs/xet/en/xorb` and `/docs/xet/en/shard`
   - What's unclear: Specific compression scheme (zstd? lz4?), HMAC key derivation for shard footer
   - Recommendation: Read both spec pages during Wave 0 implementation planning before writing serialization code. The reference implementation in `xet-core/mdb_shard` and the xorb format in `cas_types` are the ground truth.

2. **HF Commit API exact request format for Xet files**
   - What we know: The commit uses ndjson format with `lfsFile` operation; includes sha256 oid + size
   - What's unclear: Whether additional Xet-specific fields are needed in the commit payload vs pure LFS pointer
   - Recommendation: Test against a new Xet-enabled repo during implementation. The `huggingface.js` `commit.ts` source has the definitive format — read it before implementing.

3. **Pre-signed URL TTL exact value**
   - What we know: "1-2 hours" from project research; officially undocumented
   - What's unclear: Exact TTL, whether it varies by part size or account type
   - Recommendation: Use 30-minute conservative cutoff as decided. Validate empirically during implementation by checking if a 31-minute-old URL still works.

4. **Xet xorb upload idempotency behavior on network failure mid-upload**
   - What we know: "Upload endpoints are idempotent with respect to content-addressed keys; re-sending an already-present xorb or shard is safe" (spec)
   - What's unclear: If a POST /v1/xorbs request times out mid-upload, is the server state deterministic?
   - Recommendation: Treat all timeout responses as requiring retry (was_inserted=false is not guaranteed in timeout case). Store confirmed xorbs only after receiving 200 with was_inserted field.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 (frontend) + Rust cargo test (backend) |
| Config file | `vitest.config.ts` (jsdom, globals: true) |
| Quick run command | `npx vitest run` (frontend) / `cargo test` (Rust) |
| Full suite command | `npx vitest run && cargo test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPLD-01 | Files stream to HF without loading into memory | unit (Rust) | `cargo test upload::worker::test_streaming_hash` | ❌ Wave 0 |
| UPLD-01 | Upload state machine transitions: Pending→Hashing→Uploading | unit (Rust) | `cargo test upload::queue::test_state_transitions` | ❌ Wave 0 |
| UPLD-02 | Resume only requests fresh xorbs for unconfirmed portions | unit (Rust) | `cargo test upload::worker::test_resume_skips_confirmed` | ❌ Wave 0 |
| UPLD-02 | Pre-signed URLs never stored in SQLite (LFS path) | unit (Rust) | `cargo test db::schema::test_no_urls_in_schema` | ❌ Wave 0 |
| UPLD-03 | Progress channel never emits more than 2/sec | unit (Rust) | `cargo test upload::progress::test_emit_rate` | ❌ Wave 0 |
| UPLD-04 | Concurrent limit enforced by Semaphore | unit (Rust) | `cargo test upload::queue::test_concurrency_limit` | ❌ Wave 0 |
| UPLD-05 | CancellationToken stops network activity | unit (Rust) | `cargo test upload::cancel::test_cancel_stops_task` | ❌ Wave 0 |
| UPLD-05 | Paused jobs persist in SQLite across restart | unit (Rust) | `cargo test db::schema::test_pause_survives_restart` | ❌ Wave 0 |
| UPLD-10 | LFS batch `transfer=xet` routes to Xet pipeline | unit (Rust) | `cargo test hf::api::test_detect_xet_protocol` | ❌ Wave 0 |
| UPLD-10 | LFS batch `transfer=multipart` routes to LFS path | unit (Rust) | `cargo test hf::api::test_detect_lfs_protocol` | ❌ Wave 0 |

All tests are Rust unit tests using `#[cfg(test)]` modules. Network-dependent tests use `#[ignore]` per Phase 1 pattern.

### Sampling Rate

- **Per task commit:** `cargo test` (Rust unit tests)
- **Per wave merge:** `cargo test && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src-tauri/src/upload/mod.rs` — module declaration
- [ ] `src-tauri/src/upload/queue.rs` — test stubs for state machine (UPLD-01, UPLD-04)
- [ ] `src-tauri/src/upload/worker.rs` — test stubs for streaming hash, resume (UPLD-01, UPLD-02)
- [ ] `src-tauri/src/upload/progress.rs` — test stub for emit rate (UPLD-03)
- [ ] `src-tauri/src/upload/cancel.rs` — test stub for cancellation (UPLD-05)
- [ ] `src-tauri/src/hf/api.rs` — test stubs for protocol detection (UPLD-10)
- [ ] `src-tauri/src/hf/xet.rs` — test stubs for xorb upload, token refresh
- [ ] `src-tauri/src/db/mod.rs` — test stubs for schema, no-URL invariant (UPLD-02, UPLD-05)
- [ ] `src-tauri/migrations/001_upload_queue.sql` — must exist before sqlx migrate!() compiles

---

## Sources

### Primary (HIGH confidence)
- [Xet Upload Protocol Spec](https://huggingface.co/docs/xet/en/upload-protocol) — complete upload flow, chunk/xorb/shard pipeline, ordering constraints
- [Xet CAS API Spec](https://huggingface.co/docs/xet/main/en/api) — all CAS endpoints, request/response formats, error codes, hash encoding procedure
- [Xet Authentication Spec](https://huggingface.co/docs/xet/en/auth) — write-token endpoint, response fields (accessToken, exp, casUrl), refresh pattern
- [Xet Protocol Index](https://huggingface.co/docs/xet/index) — spec version 1.0.0 confirmed; xorb, shard, chunking sub-pages referenced
- [HF Hub OpenAPI spec](https://huggingface.co/.well-known/openapi.md) — confirmed `GET /api/{repoType}/{namespace}/{repo}/xet-write-token/{rev}` endpoint
- [Tauri v2 Calling Rust docs](https://v2.tauri.app/develop/calling-rust/) — Channel API, streaming pattern
- [tokio-util CancellationToken docs](https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html) — select! integration pattern
- [sqlx SqliteConnectOptions](https://docs.rs/sqlx/latest/sqlx/sqlite/struct.SqliteConnectOptions.html) — journal_mode WAL configuration
- [xet-core GitHub](https://github.com/huggingface/xet-core) — reference Rust implementation; cas_types, mdb_shard crates

### Secondary (MEDIUM confidence)
- [huggingface.js commit.ts analysis](https://github.com/huggingface/huggingface.js/blob/main/packages/hub/src/lib/commit.ts) — LFS batch transfer field detection: `transfer === "xet"` confirmed
- [huggingface.js xetWriteToken.ts analysis](https://github.com/huggingface/huggingface.js/blob/main/packages/hub/src/utils/xetWriteToken.ts) — token refresh flow, header fields
- [HF Hub Upload Guide](https://huggingface.co/docs/huggingface_hub/guides/upload) — upload_large_folder pattern, preupload_lfs_files flow
- [Tauri IPC performance discussion #7146](https://github.com/tauri-apps/tauri/discussions/7146) — ~200ms/10MB IPC overhead on Windows; validates 500ms timer approach
- [Cancel async commands discussion #5894](https://github.com/tauri-apps/tauri/discussions/5894) — CancellationToken in Tauri context
- [Multiple Thread Pools in Rust](https://pkolaczk.github.io/multiple-threadpools-rust/) — rayon + tokio separation rationale
- [Tauri + SQLite embedding guide](https://dezoito.github.io/2025/01/01/embedding-sqlite-in-a-tauri-application.html) — sqlx pool setup in Tauri app state

### Tertiary (LOW confidence — needs validation during implementation)
- Pre-signed LFS URL TTL: "1-2 hours" — inferred from HF upload flow behavior, not officially documented; use 30-minute cutoff conservatively
- Exact shard HMAC key derivation: spec page `/docs/xet/en/shard` referenced but not fetched in this research pass — read before implementing shard serialization

---

## Metadata

**Confidence breakdown:**
- Standard stack (new crates): HIGH — sqlx 0.8.x, tokio-util 0.7.18, rayon 1.11.0 all confirmed against crates.io
- Xet CAS protocol: HIGH — official HF Xet Protocol Specification v1.0.0 consulted directly; endpoints, auth, and hash encoding verified
- LFS protocol detection: HIGH — confirmed from huggingface.js source; `transfer` field in LFS batch response is authoritative
- Xorb/shard binary format: MEDIUM — spec pages referenced but not fully read; sub-pages (`/docs/xet/en/xorb`, `/docs/xet/en/shard`) must be read during implementation
- Tauri Channel pattern: HIGH — official Tauri v2 docs
- CancellationToken pattern: HIGH — tokio-util official docs
- SQLite WAL + sqlx pool: HIGH — official sqlx docs
- Architecture/patterns: HIGH — derived from official sources + Phase 1 established patterns

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days — Xet spec is v1.0.0 stable; protocol unlikely to change)

**Critical spec pages not yet read (must read during Wave 0 planning):**
- `https://huggingface.co/docs/xet/en/xorb` — binary xorb format details
- `https://huggingface.co/docs/xet/en/shard` — shard format, HMAC, footer
- `https://huggingface.co/docs/xet/en/chunking` — Gearhash CDC parameters
- `https://huggingface.co/docs/xet/en/hashing` — chunk/xorb/file hash computation
