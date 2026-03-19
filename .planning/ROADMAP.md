# Roadmap: Face Hugger

## Overview

Face Hugger ships in four phases that match the natural dependency order of a Tauri desktop app for large-file uploads. Phase 1 establishes the authenticated shell and IPC patterns everything else depends on. Phase 2 builds the Rust upload engine — the product's reason to exist — with all six critical pitfalls designed in from the start. Phase 3 surfaces the engine through the upload UI and repo management features so a user can complete the full upload workflow end-to-end. Phase 4 adds the differentiating polish (OAuth, dataset preview, background uploads) and closes out with distribution artifacts for every platform.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri app with auth, OS keychain storage, and type-safe IPC scaffold (completed 2026-03-19)
- [ ] **Phase 2: Upload Engine** - Rust upload engine with Xet/LFS protocol detection, resumable chunked uploads, and SQLite-backed queue state
- [ ] **Phase 3: Upload UI + Repo Management** - Upload wizard, queue view, and full repository browser/CRUD
- [ ] **Phase 4: Secondary Features + Distribution** - OAuth login, dataset preview, background uploads, signed distribution artifacts

## Phase Details

### Phase 1: Foundation
**Goal**: Users can authenticate with Hugging Face and the app shell is wired up for all subsequent features
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03 (deferred to Phase 4), AUTH-04, REPO-01
**Success Criteria** (what must be TRUE):
  1. User can paste an HF access token and the app validates it against the HF API
  2. The token is stored in the OS keychain (not plaintext) and persists across app restarts without re-entry
  3. The app shows the authenticated user's username and avatar after login
  4. User can see a list of their HF repos (models and datasets) after authenticating
  5. The Tauri app builds and runs on macOS, Windows, and Linux with type-safe IPC between Rust and React
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Scaffold Tauri v2 project and build Rust auth backend with tauri-specta IPC
- [ ] 01-02-PLAN.md — React app shell (titlebar, sidebar, theme) and login screen with auth flow
- [ ] 01-03-PLAN.md — Repo listing (Models + Datasets pages) with search, filter, sort, grid/table views

### Phase 2: Upload Engine
**Goal**: Files can be reliably uploaded to HF repos through a fault-tolerant Rust engine that handles both Xet and LFS protocols
**Depends on**: Phase 1
**Requirements**: UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05, UPLD-10
**Success Criteria** (what must be TRUE):
  1. User can upload a file larger than 1 GB to an HF repo without the app running out of memory
  2. An upload interrupted by a network drop automatically resumes from the last confirmed chunk after reconnection — no manual intervention
  3. The upload engine correctly detects whether a repo uses Xet CAS or legacy LFS and routes accordingly
  4. Multiple uploads can be queued simultaneously; each can be paused, resumed, or cancelled individually
  5. Upload progress (bytes transferred, speed, ETA) is visible in the UI and updates smoothly without degrading upload throughput
**Plans**: TBD

### Phase 3: Upload UI + Repo Management
**Goal**: Users can complete the full upload workflow through a guided UI and manage their repos and files end-to-end
**Depends on**: Phase 2
**Requirements**: UPLD-06, UPLD-07, UPLD-08, REPO-02, REPO-03, REPO-04, REPO-05, REPO-06
**Success Criteria** (what must be TRUE):
  1. A first-time user can complete an upload (repo selection → file selection → commit message → upload) by following the wizard with no prior knowledge of HF
  2. A power user can drag files onto a queue, reorder them, and start uploading without using the wizard
  3. User can sync a local folder to an HF repo — the app uploads only files that have changed
  4. User can create a new repo, browse its files, delete individual files, and delete the repo entirely from within the app
  5. User can view the commit history for a repo and roll back to a previous commit
**Plans**: TBD

### Phase 4: Secondary Features + Distribution
**Goal**: The app ships on all three platforms with OAuth login, dataset preview, and background upload support
**Depends on**: Phase 3
**Requirements**: AUTH-03, UPLD-09, DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. User can log in via OAuth browser flow (no token copy-paste required)
  2. Uploads continue running when the main window is closed; the system tray icon shows upload status
  3. User can preview dataset rows, column types, and statistics without leaving the app
  4. User can search and filter within a dataset preview
  5. Signed, notarized distribution artifacts build from CI for macOS (.dmg), Windows (installer), and Linux (.AppImage/.deb)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-03-19 |
| 2. Upload Engine | 0/TBD | Not started | - |
| 3. Upload UI + Repo Management | 0/TBD | Not started | - |
| 4. Secondary Features + Distribution | 0/TBD | Not started | - |

### Phase 5: E2E/UI Automated Testing

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 4
**Plans:** 3/3 plans complete

Plans:
- [ ] TBD (run /gsd:plan-phase 5 to break down)
