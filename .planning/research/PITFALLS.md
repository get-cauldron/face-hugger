# Pitfalls Research

**Domain:** Tauri v2 desktop app — large file upload client for Hugging Face Hub
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH (verified against official HF Hub docs, Tauri v2 docs, and community issues)

---

## Critical Pitfalls

### Pitfall 1: Using `upload_folder()` Instead of `upload_large_folder()` for Large Datasets

**What goes wrong:**
The `upload_folder()` API method — and by extension any naive "upload all files in one commit" approach — silently fails or produces corrupt results when uploading more than ~50 files at once. Users attempting to upload 2,000 files in a single commit have had the Hub register only 723 LFS files. The commit appears to succeed but the repo is incomplete.

**Why it happens:**
`upload_folder()` builds a single commit with all files included. The HF backend must perform individual S3 consistency checks for every LFS file. With a 60-second server timeout and thousands of files, the request fails before the consistency check completes. The error message is generic and does not reveal the root cause.

**How to avoid:**
Use the `upload_large_folder()` approach — break uploads into many small tasks (hash, pre-upload, commit) with local resumption state. In Rust, this means managing a persistent state file that tracks which chunks have been successfully acknowledged by the CAS (content-addressable store), not just "sent." Never assume a 200 response on a chunk means it was committed.

**Warning signs:**
- Upload "completes" but file count on HF repo is lower than local count
- Vague error messages on large uploads
- Upload time that is too fast for the file count (partial commit succeeded, rest silently dropped)

**Phase to address:** Upload Core (Phase 1 / upload engine)

---

### Pitfall 2: Treating HF Token as a Static Secret During Multi-Hour Uploads

**What goes wrong:**
HF user tokens are long-lived but the pre-signed S3 upload URLs issued by HF during the upload flow have their own expiry. If a 50GB upload spans several hours and the pre-signed URL for a chunk was issued 2+ hours ago, re-attempting that chunk (after a network failure) will get a 403 from S3 — not from HF — with no clear explanation.

**Why it happens:**
Developers focus on "do I have a valid HF token?" but the actual upload path goes: HF token → HF API → pre-signed S3 URL → S3 upload. The S3 pre-signed URL is a different credential with its own TTL (typically 1-2 hours). After a resumption, the state file may hold a stale pre-signed URL.

**How to avoid:**
When resuming an upload, always re-request fresh pre-signed URLs from the HF API for any chunks not yet confirmed. Never store pre-signed URLs in the resumption state as if they are permanently valid. Treat them as ephemeral. The resumption state should track "chunk N was confirmed by CAS" — not "chunk N has a URL ready."

**Warning signs:**
- 403 errors from `s3.amazonaws.com` (not `huggingface.co`) on resumed uploads
- Upload succeeds on fresh start but fails consistently on resumption

**Phase to address:** Upload Core (Phase 1), specifically the resumption state schema design

---

### Pitfall 3: IPC Bottleneck for Progress Updates Choking the Upload Pipeline

**What goes wrong:**
Emitting progress events from Rust to the React frontend for every chunk (e.g., every 8MB chunk of a 100GB file = 12,500 events) creates a JSON serialization backlog in Tauri's IPC layer. Benchmark data shows IPC throughput of ~200ms per 10MB on Windows. At high chunk frequency, the UI event queue backs up, causing the frontend to lag or freeze, and — worse — backpressure can indirectly stall the Tokio async runtime if progress is emitted synchronously inside the upload task.

**Why it happens:**
Tauri's primary invoke/event system is JSON-RPC based. Sending every chunk completion as a `emit()` call creates thousands of JSON-serialized payloads over the lifetime of a large upload. Developers assume "events are fire-and-forget" but the WebView event queue is bounded.

**How to avoid:**
Decouple progress tracking from the upload pipeline. Use a shared `Arc<Mutex<UploadState>>` in Rust updated on each chunk completion, and have a separate timer-based task that reads the state and emits a single consolidated progress event to the frontend on a cadence (e.g., every 500ms or every 1% progress). Never emit per-chunk events directly from the upload task.

**Warning signs:**
- UI framerate drops during active upload
- Progress bar updates arrive in bursts then freeze
- Upload throughput visible in system monitor is higher than what the progress bar suggests
- On Windows, IPC latency noticeably higher than macOS (known platform difference)

**Phase to address:** Upload Core (Phase 1), specifically the progress reporting architecture

---

### Pitfall 4: No Cancellation Path Causes Zombie Tokio Tasks

**What goes wrong:**
When a user cancels an upload from the UI, the Rust upload task continues running in the background if cancellation is not explicitly plumbed through. The upload keeps consuming bandwidth, holds file handles open, and may attempt to write to state files even after the user has started a new upload or closed the app. On app exit, Tauri does not automatically cancel Tokio tasks spawned with `tokio::spawn`.

**Why it happens:**
It is easy to spawn an async upload task with `tokio::spawn` and wire up UI progress events, but forget to implement the cancellation channel. The task runs to completion regardless of user action.

**How to avoid:**
Use `tokio::sync::oneshot` or `tokio_util::sync::CancellationToken` channels passed into every upload task. Each chunk loop iteration should `select!` on both the chunk future and the cancellation signal. Store the cancellation sender in Tauri's managed state, keyed by upload ID, so the frontend `cancel_upload` command can trigger it. Test cancellation explicitly, including mid-chunk.

**Warning signs:**
- Network activity continues after "cancel" button click
- System tray still shows "uploading" after cancellation
- Multiple simultaneous uploads accumulate when user restarts after cancel

**Phase to address:** Upload Core (Phase 1) — cancellation must be designed in from the start, not retrofitted

---

### Pitfall 5: Xet Storage vs LFS: Conflating Two Different Upload Protocols

**What goes wrong:**
As of May 2025, all new HF repos default to Xet storage (chunk-based, content-addressable, deduplicating at ~64KB granularity). Older repos use Git LFS. An upload client that only implements the LFS upload path will fail silently or fall back to a slow path for Xet-enabled repos without warning. Conversely, assuming Xet is always available will break uploads to legacy repos.

**Why it happens:**
The HF docs present both paths, but the switch to Xet-default is relatively recent (May 2025). Most third-party examples and community code still show the LFS path. The `huggingface_hub` Python library handles this transparently via `hf_xet`, but a Rust implementation must detect and branch explicitly.

**How to avoid:**
On repo creation or first upload, check the `xet_enabled` field in the repo metadata response. Route to the Xet upload pipeline (CAS/xorb chunking) for new repos and to the LFS pre-signed URL path for legacy repos. Keep both implementations maintained. The Xet protocol: scan file → content-defined chunking (~64KB) → aggregate into 64MB xorbs → upload xorbs to CAS → register xorb metadata with LFS SHA256.

**Warning signs:**
- Upload works on newly created repos but fails on existing repos (or vice versa)
- `xet_enabled` field not being read from repo metadata
- SHA256 hash mismatch errors after upload

**Phase to address:** Upload Core (Phase 1) — protocol detection must be explicit in the upload engine design

---

### Pitfall 6: File Hashing 100GB Files In-Process Blocks the Runtime

**What goes wrong:**
Computing SHA256 (required for LFS) or content-defined chunk hashes (required for Xet) on a 100GB file is CPU-bound and takes 30-90 seconds on typical hardware. If this is done synchronously or even via `tokio::spawn_blocking` without careful resource management, it can saturate all Tokio blocking threads, preventing other async work (network I/O, event handling) from making progress.

**Why it happens:**
Developers call `std::fs::read` and then hash, or use `tokio::fs` without bounding the blocking pool usage. `spawn_blocking` uses a separate thread pool but that pool is shared — filling it with 4 concurrent 100GB hash jobs blocks all other blocking I/O in the app.

**How to avoid:**
Hash files in streaming fashion (read in chunks, feed to hasher) rather than loading into memory. Use a dedicated `rayon` threadpool for CPU-bound hashing, separate from Tokio's blocking pool. Implement concurrency limits: hash at most 2 files simultaneously (configurable). Never load a full file into memory to hash it — streaming is mandatory for 100GB+ files.

**Warning signs:**
- App freezes or becomes unresponsive when adding a large file to the upload queue
- Memory usage spikes to file size during queuing
- UI progress never starts — stuck in "preparing" state

**Phase to address:** Upload Core (Phase 1) — file scanning and hashing pipeline design

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store pre-signed S3 URLs in resumption state | Simpler state schema, no re-request on resume | Stale URL 403 errors on resumed uploads — very hard to debug | Never |
| Per-chunk IPC events instead of batched progress | Simpler code, instant feedback | UI freeze on large uploads, Windows IPC bottleneck | Never for chunk-level; OK for file-level |
| `upload_folder()` for all uploads | Single API call, less code | Silent partial commits on large datasets | Only for < 10 files, < 1GB total |
| Hardcode token in config file | Easier dev setup | Token leaks if user shares config, no rotation path | Never in production code |
| Single Tokio threadpool for hash + network | Less complex setup | Hash work starves network I/O, vice versa | Never for 100GB+ files |
| No cancellation in MVP | Faster initial ship | Zombie upload tasks, resource leaks, confusing UX | MVP only if upload is < 1 minute and can't be queued |
| Skip Xet detection, LFS-only | Half the implementation | Broken uploads for all new HF repos (default since May 2025) | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| HF Hub API | Treating 5-minute rate limit windows as per-request limits | Rate limits apply per 5-minute fixed window. Free users: 1,000 API calls / 5 min. Batch repo-listing and metadata calls; don't poll per file. |
| HF Hub API | Not passing `HF_TOKEN` on every request | Unauthenticated requests hit the anonymous 500 req/5min bucket. Always authenticate. |
| HF Hub API | Using Hub API endpoint for file downloads | Use resolver URLs (`/resolve/` path) — they have a separate, much higher rate limit (5,000 vs 1,000 for free users). |
| HF Hub API | Infinite retry on permanent errors | `upload_large_folder` has documented infinite retry on all errors including permanent ones (403 permission denied). Implement error classification: transient (retry) vs permanent (surface to user). |
| HF Hub OAuth | Storing OAuth tokens in plain files in app data dir | Use OS keychain (Tauri's `keyring` plugin or `keytar`) for token storage. Never write tokens to `~/.config/face-hugger/token.json` in plaintext. |
| HF Hub Xet | Treating Xet upload as a single HTTP request | Xet is a multi-step protocol: scan → chunk → upload xorbs → register metadata. Each step can fail independently. |
| Tauri IPC | Sending large binary data (file previews, dataset rows) through JSON IPC | Use Tauri's `ReadableStream` response type or serve data via a local HTTP server (`tauri-plugin-localhost` or asset protocol) for binary/large payloads. |
| Tauri file system | Requesting broad `fs:allow-read-recursive` on `$HOME` | Scope filesystem access to user-selected paths using Tauri's scope system. Request access only to the folder the user explicitly selects. |
| Tauri on Linux | Assuming system tray works out of the box | Requires `libayatana-appindicator` or `libappindicator3`. Neither exists on all distros. Gate the tray feature at runtime and fall back gracefully. |
| macOS notarization | Shipping without notarization | Users see "app is damaged and can't be opened." Apple Developer account + notarization is mandatory for macOS distribution. Build this into CI early. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full file into memory before upload | OOM crash or system swap on 100GB files | Always stream: open file as `BufReader`, read fixed-size chunks | Files > available RAM (< 16GB RAM machines fail on 20GB+ files) |
| Parallel uploads without connection limit | Network saturation, all chunks timeout, upload slower than sequential | Cap concurrent chunk uploads at 4-8 (configurable). Use `tokio::sync::Semaphore`. | Any file > 1GB on connections < 100 Mbps |
| MD5/SHA256 of entire file before any upload starts | User waits 60-90s on 100GB file before upload begins | Compute hash as streaming upload proceeds (use HMAC streaming). For Xet, hashing and chunking happen together. | Files > ~20GB on average hardware |
| Polling repo list API on every UI focus | Rate limit exhaustion on free accounts | Cache repo list with TTL (30s-5min). Invalidate on explicit refresh only. | > ~100 API calls / 5 min (free tier limit approached quickly) |
| Storing Xet chunk metadata in SQLite without WAL | DB lock contention between upload and read threads | Enable WAL mode: `PRAGMA journal_mode=WAL`. Use connection pool. | Concurrent uploads > 2, or any UI reads while upload is active |
| Emitting upload progress on every byte written | Tokio event loop saturation | Throttle progress events to max 2/second per upload. Use timestamp gating in the event emitter. | Any file > ~100MB |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing HF token in plaintext config file | Token exfiltration if user shares config or has malware | Use OS keychain via Tauri's `keyring` plugin. Never write tokens to disk in plaintext. |
| Logging token value in debug/error output | Token visible in log files, crash reports, or dev console | Redact tokens in all log output. Log only token prefix (first 8 chars) for debugging. |
| Not scoping filesystem permissions in `tauri.conf.json` | Malicious JS or compromised webview can read arbitrary files | Use Tauri's scope system. Only allow access to user-selected upload directories. |
| Opening arbitrary file URLs from HF API responses | Server-side request forgery if API is compromised | Validate all URLs from API responses against expected HF domains before using. |
| Not validating chunk checksums after upload | Corrupt uploads accepted silently — user's model is damaged | Verify SHA256 of each uploaded chunk against the pre-computed hash. Reject and retry mismatches. |
| Using `write` token scope when `read+write` is needed for uploads | Runtime permission errors mid-upload | HF upload requires write scope. Validate token permissions at auth time, not at first upload attempt. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing upload speed in bytes/sec only | Users can't estimate time for 50GB files | Show both MB/s and ETA. Smooth the ETA over a rolling 30-second window (instantaneous speed is too noisy on flaky connections). |
| No persistent upload queue across restarts | Users must re-add files after crash or restart | Persist the upload queue to disk (SQLite or JSON). Resume in-progress uploads automatically on app start. |
| Overwriting a file that already exists on HF without confirmation | Accidental data loss — previous model version gone | Show diff preview (size, hash) before overwrite. Require explicit confirmation. |
| Treating all upload errors as fatal | User loses entire multi-hour upload on network blip | Classify errors: transient (network timeout, 429) → retry silently; permanent (403, repo not found) → surface with clear action. |
| No indication of background upload in system tray | User closes window thinking upload is done | System tray icon must visually indicate in-progress uploads (animated icon or badge). Show clear notification on completion/failure. |
| Showing raw HF API error messages | "400 Bad Request" tells user nothing | Map known HF error codes to human-readable messages. Provide actionable next steps (e.g., "File already exists — choose overwrite or skip"). |
| Blocking the UI during initial folder scan | App appears frozen while scanning 10,000 files | Run folder scanning in a Tokio background task. Emit incremental scan results to update the UI while scanning continues. |
| No upload history / log | Users can't verify what was uploaded when | Maintain a local upload log with timestamps, file sizes, checksums, and HF commit URLs. |

---

## "Looks Done But Isn't" Checklist

- [ ] **Resumable upload:** Often missing server-side confirmation — verify that the local resumption state is only updated after CAS acknowledgement, not after bytes-sent
- [ ] **Cancellation:** Often looks done because the UI stops updating — verify the Tokio task actually exits (no more network traffic in system monitor)
- [ ] **Cross-platform:** Often tested on macOS only — verify system tray works on Ubuntu (needs `libayatana-appindicator`), Windows code signing works, and paths use Tauri's `path` plugin not hardcoded separators
- [ ] **Token security:** Storing token in OS keychain may look done but the fallback code path may still write to disk — verify no plaintext token on disk in any code path
- [ ] **Large file support:** Often tested with 1GB files — verify with actual 50GB+ files that memory usage stays flat (no spike to file size)
- [ ] **Xet vs LFS detection:** Upload working on a test repo doesn't mean both protocols are tested — verify against both a Xet-enabled repo (any new repo) and a legacy LFS repo
- [ ] **Rate limit handling:** No errors during development doesn't mean rate limits are handled — verify the app recovers cleanly from a 429 and surfaces appropriate state to the user
- [ ] **macOS notarization:** App runs in dev doesn't mean it can be distributed — verify the CI pipeline produces a properly signed and notarized `.dmg` before calling distribution "done"

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Resumption state stores stale pre-signed URLs | LOW | Add URL expiry timestamps to state schema; discard and re-request any URL older than 30 minutes |
| Per-chunk IPC events causing UI freeze | LOW-MEDIUM | Refactor progress emission to batched/timer-based; no upload logic change needed |
| Upload engine uses `upload_folder()` approach | HIGH | Requires redesign of state machine to support multi-commit, task-level resumption |
| Cancellation not implemented | MEDIUM | Add `CancellationToken` threading through upload task chain; requires task refactor but not data model change |
| Token stored in plaintext | MEDIUM | Add keyring plugin, migrate token on first launch of new version |
| No Xet protocol support | HIGH | Requires implementing the full Xet upload pipeline (chunking, xorb assembly, CAS API calls) as a parallel code path |
| Memory spike on large file hashing | MEDIUM | Replace buffer-all approach with streaming hasher; no API changes required |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `upload_folder()` for large datasets | Phase 1: Upload Engine | Integration test uploading 1,000+ files verifies commit fragmentation is handled |
| Stale pre-signed URLs on resume | Phase 1: Upload Engine | Test: interrupt upload after 2h, verify resume issues fresh URL and completes |
| IPC progress event bottleneck | Phase 1: Upload Engine | Benchmark: 100GB upload — UI framerate must stay > 30fps throughout |
| Missing cancellation path | Phase 1: Upload Engine | Test: cancel mid-upload, verify Tokio task exits and network traffic stops |
| Xet vs LFS protocol conflation | Phase 1: Upload Engine | Test against both Xet-enabled (new) and legacy LFS repos |
| File hashing blocks runtime | Phase 1: Upload Engine | Memory profiler during queue-add of 100GB file shows no spike |
| Token stored in plaintext | Phase 2: Auth | Security audit: `find ~/.config -name "*.json"` — no token values in files |
| Rate limit not handled | Phase 2: Auth + API layer | Simulate 429 response — app shows informative state, retries after backoff |
| macOS notarization | Phase 4: Distribution | CI produces notarized `.dmg`; test on fresh macOS VM with no dev tools |
| System tray Linux dependency | Phase 3: Background/Tray | Test on Ubuntu 20.04, 22.04, Debian 11 — tray works or degrades gracefully |
| No Xet chunk integrity check | Phase 1: Upload Engine | Unit test: corrupt one chunk in mock, verify upload rejects and retries |
| Cross-platform path handling | Phase 1 + Phase 3 | Manual QA on Windows with paths containing spaces and Unicode characters |

---

## Sources

- [Upload files to the Hub — Hugging Face official docs](https://huggingface.co/docs/huggingface_hub/guides/upload) — HIGH confidence
- [Hub Rate Limits — Hugging Face official docs](https://huggingface.co/docs/hub/rate-limits) — HIGH confidence
- [Resolving pain-points for uploading large files and folders — GitHub Issue #2612](https://github.com/huggingface/huggingface_hub/issues/2612) — HIGH confidence (official maintainer responses)
- [429 when uploading many files — GitHub Issue #2587](https://github.com/huggingface/huggingface_hub/issues/2587) — HIGH confidence
- [Xet on the Hub — Hugging Face blog](https://huggingface.co/blog/xet-on-the-hub) — HIGH confidence
- [Using Xet Storage — Hugging Face docs](https://huggingface.co/docs/hub/xet/using-xet-storage) — HIGH confidence
- [Tauri IPC performance discussion — GitHub Discussion #7146](https://github.com/tauri-apps/tauri/discussions/7146) — MEDIUM confidence
- [Tauri IPC binary data feature request — GitHub Issue #7127](https://github.com/tauri-apps/tauri/issues/7127) — MEDIUM confidence
- [Cancel async commands in Tauri — GitHub Discussion #5894](https://github.com/tauri-apps/tauri/discussions/5894) — MEDIUM confidence
- [Long running background processes in Tauri — GitHub Issue #2166](https://github.com/tauri-apps/tauri-docs/issues/2166) — MEDIUM confidence
- [Tauri v2 file system permissions](https://v2.tauri.app/plugin/file-system/) — HIGH confidence
- [Tauri v2 capabilities and platform-specific permissions](https://v2.tauri.app/security/capabilities/) — HIGH confidence
- [Windows code signing in Tauri v2](https://v2.tauri.app/distribute/sign/windows/) — HIGH confidence
- [System Tray in Tauri v2](https://v2.tauri.app/learn/system-tray/) — HIGH confidence
- [Hub security tokens](https://huggingface.co/docs/hub/security-tokens) — HIGH confidence

---
*Pitfalls research for: Tauri v2 + HF Hub large file upload desktop client*
*Researched: 2026-03-19*
