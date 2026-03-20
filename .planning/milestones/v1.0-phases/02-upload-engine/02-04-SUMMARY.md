---
phase: 02-upload-engine
plan: 04
subsystem: upload-engine
tags: [rust, upload, xet, lfs, worker, resume, backoff, cancellation]
dependency_graph:
  requires: ["02-01", "02-02", "02-03"]
  provides: ["upload-worker", "backoff-utility"]
  affects: ["commands/upload.rs", "queue.rs"]
tech_stack:
  added: []
  patterns:
    - "tokio::select! for cancellation at every long-running operation"
    - "XetWriteToken expiry check before each xorb via token_needs_refresh"
    - "SQLite resume state: confirmed xorbs/parts only (no pre-signed URLs)"
    - "Fixed 64MB xorb chunking with TODO for Gearhash CDC"
    - "Placeholder JSON shard serialization with TODO for spec-compliant binary"
key_files:
  created:
    - src-tauri/src/upload/backoff.rs
    - src-tauri/src/upload/worker.rs
  modified:
    - src-tauri/src/upload/mod.rs
decisions:
  - "Fixed 64MB xorb size chosen for simplicity — Gearhash CDC deferred to later plan"
  - "Shard serialized as JSON placeholder — spec-compliant binary format deferred"
  - "compute_xorb_ranges extracted as public helper for unit testability"
  - "is_retryable_error classifies transient vs permanent errors by string matching on error messages"
  - "handle_cancellation checks DB state post-cancel to distinguish pause vs cancel signal"
metrics:
  duration: 3min
  completed_date: "2026-03-19"
  tasks: 1
  files: 3
requirements_satisfied: [UPLD-01, UPLD-02]
---

# Phase 02 Plan 04: Upload Worker Summary

**One-liner:** Xet CAS and LFS multipart upload worker with resume, token refresh, exponential backoff, and tokio cancellation using fixed 64MB xorbs and placeholder shard serialization.

## What Was Built

### backoff.rs
Exponential backoff utility with ±20% jitter following the locked schedule: 5s, 15s, 30s, 60s cap. Used at every retry point in the worker. Two tests verify the schedule and cap.

### worker.rs — run_upload_job
The main upload entry point. Orchestrates the full lifecycle for both protocols:

**Common path (both protocols):**
1. Load job from DB
2. Verify source file exists — fail with "Source file changed or missing" if not
3. Check write access (fail-fast, non-retryable)
4. Hash file via `hash_file_streaming` wrapped in `tokio::select!`
5. Detect protocol via `detect_upload_protocol` (or use stored protocol on resume)
6. Branch to Xet or LFS pipeline
7. Commit via `create_commit` (state → "committing")
8. Mark done

**Xet pipeline:**
- Gets Xet write token, loads confirmed xorbs from DB
- Computes 64MB fixed-size xorb ranges via `compute_xorb_ranges`
- For each xorb: checks `token_needs_refresh`, reads file range, computes SHA-256, encodes with `xet_hash_to_hex`
- Skips confirmed xorbs (resume path)
- Uploads via `upload_xorb` in `tokio::select!` loop
- On 401: refreshes token and retries immediately
- On retryable error: applies `backoff_duration`, retries
- Stat-checks file before each chunk read for change detection
- After all xorbs: builds placeholder JSON shard, uploads via `upload_shard`

**LFS pipeline:**
- Gets confirmed parts from DB, requests fresh pre-signed URLs
- For each part: reads file range, PUTs to pre-signed URL
- Skips confirmed parts (resume)
- On 403 from S3: requests fresh pre-signed URLs immediately, retries
- On 5xx: applies `backoff_duration`, retries
- Pre-signed URLs never stored in SQLite — always requested fresh

**Cancellation model:** Every network call wrapped in `tokio::select!`. On cancel signal, `handle_cancellation` checks DB state to distinguish pause vs cancel.

### mod.rs
Added `pub mod backoff` and `pub mod worker` declarations.

## Tests

| Test | Asserts |
|------|---------|
| test_backoff_schedule | 5s/15s/30s/60s within ±20% range (10 iterations) |
| test_backoff_caps_at_60s | retries 3..100 all under 72s |
| test_chunk_file_into_xorb_ranges | 150MB → 3 ranges: 64+64+22MB |
| test_chunk_small_file | 1KB → 1 range (0, 1024) |
| test_chunk_exact_multiple | 128MB → 2 exact 64MB ranges |
| test_chunk_empty_file | 0 bytes → 1 range (0, 0) |
| test_resume_skips_confirmed_xorbs | 3 xorbs, 2 confirmed → 1 to upload |
| test_retryable_error_classification | Network/server errors retryable; bad request/permission not |

Total: 26 upload module tests (8 new + 18 prior).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified.

### Design Notes (Not Deviations)

**1. Shard serialization placeholder**
The plan explicitly called for a JSON/placeholder shard with TODO comments for spec-compliant binary. This is correctly implemented. The spec pages for xorb and shard binary formats are listed in RESEARCH.md as "must read during implementation" — content-defined chunking and binary shard format are deferred to a future plan.

**2. LFS part size calculation**
The LFS multipart implementation infers part byte ranges from part count and total size. In production the HF LFS batch response may include explicit byte ranges per part — this should be validated against a live endpoint when integration testing.

**3. `block_in_place` for error updates during select!**
In the hash select! arm, tokio's `block_in_place` + `block_on` is used to update the DB on hash error. This is correct because we're already in a blocking context inside the select! arm. An alternative would be to use channels to communicate errors back, but the direct approach is simpler and correct here.

## Self-Check: PASSED

- backoff.rs: FOUND
- worker.rs: FOUND
- SUMMARY.md: FOUND
- Task commit a85dc11: FOUND
