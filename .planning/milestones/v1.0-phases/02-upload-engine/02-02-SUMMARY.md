---
phase: 02-upload-engine
plan: 02
subsystem: hf-api-layer
tags: [rust, hf-api, xet, lfs, protocol-detection, commit-api]
dependency_graph:
  requires: ["02-01"]
  provides: ["hf/api.rs", "hf/xet.rs"]
  affects: ["02-04-worker"]
tech_stack:
  added: ["bytes = 1"]
  patterns:
    - "Helper function extraction for offline unit testability (parse_protocol, format_commit_body, lfs_batch_url)"
    - "Non-standard Xet hash encoding: LE u64 blocks formatted as hex, not plain hex::encode"
    - "Token expiry buffer: token_needs_refresh checks now + 30s >= exp"
key_files:
  created:
    - src-tauri/src/hf/api.rs
    - src-tauri/src/hf/xet.rs
  modified:
    - src-tauri/src/hf/mod.rs
    - src-tauri/Cargo.toml
decisions:
  - "bytes crate added for bytes::Bytes parameter type in xorb/shard upload functions"
  - "Helper functions (parse_protocol, format_commit_body, lfs_batch_url) kept pub(crate) for offline testability without mocking HTTP"
  - "upload_xorb returns bool (was_inserted) rather than () to expose idempotency signal to callers"
metrics:
  duration: "3min"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_changed: 4
requirements_addressed: ["UPLD-10"]
---

# Phase 02 Plan 02: HF API Layer Summary

HF upload API layer with protocol detection (Xet vs LFS), Xet CAS client (write token, xorb upload, shard upload, non-standard hash encoding), write-access pre-check, and ndjson commit API — all offline-testable via extracted helper functions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | HF API functions — protocol detection, write-access check, commit | fc7fe30 | src-tauri/src/hf/api.rs, src-tauri/src/hf/mod.rs, Cargo.toml |
| 2 | Xet CAS client — write token, xorb upload, shard upload, hash encoding | a2c9432 | src-tauri/src/hf/xet.rs |

## What Was Built

### hf/api.rs

- `detect_upload_protocol` — POST to `{repo}.git/info/lfs/objects/batch`, parses `transfer` field: `"xet"` → `UploadProtocol::Xet`, otherwise `UploadProtocol::LfsMultipart`
- `check_write_access` — GET repo metadata, returns clear errors for 401/403/404
- `create_commit` — POST ndjson to HF Hub commit API; two-line body (header + lfsFile operations)
- `get_lfs_upload_info` — Extract pre-signed multipart upload URLs from LFS batch response
- Helper functions for offline testing: `parse_protocol`, `format_commit_body`, `lfs_batch_url`, `commit_url`

### hf/xet.rs

- `XetWriteToken` — struct with camelCase serde aliases (`accessToken`, `casUrl`)
- `get_xet_write_token` — GET `/api/{type}s/{id}/xet-write-token/{rev}`
- `token_needs_refresh` — returns `true` when `now + 30 >= token.exp`
- `xet_hash_to_hex` — non-standard encoding: each 8-byte block interpreted as LE u64, formatted as 16-char hex. Verified against spec example: `[0..7]` → `"0706050403020100"`
- `upload_xorb` — POST to `/v1/xorbs/default/{hash}`, returns `was_inserted` bool, handles 401 (token expired) distinctly
- `upload_shard` — POST to `/v1/shards`, clear 400 error message for missing xorb case

## Test Results

19 tests pass, 2 ignored (network-gated):

- Protocol detection: xet, multipart, basic fallback — all correct
- Xet hash encoding: spec example, all-zeros, known-value with byte-reversal verification, all four blocks
- Token refresh: expired, fresh, within-30s-buffer
- ndjson format: valid JSON per-line, correct fields, correct sizes
- URL formats: lfs batch, commit, xorb, shard

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
