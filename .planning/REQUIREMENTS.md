# Requirements: Face Hugger

**Defined:** 2026-03-19
**Core Value:** Uploading multi-GB files to Hugging Face should work reliably on flaky connections without babysitting — resumable, visible, and recoverable.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can authenticate by pasting an HF access token
- [ ] **AUTH-02**: Token is stored securely in the OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- [ ] **AUTH-03**: User can authenticate via OAuth browser login flow
- [ ] **AUTH-04**: App displays authenticated user info (username, avatar, token scopes)

### Uploads

- [ ] **UPLD-01**: User can upload files to HF repos using chunked streaming (supports 1-100GB+)
- [ ] **UPLD-02**: Uploads resume automatically after network interruption
- [ ] **UPLD-03**: User sees per-file progress bar with speed and ETA
- [ ] **UPLD-04**: User can queue multiple uploads
- [ ] **UPLD-05**: User can cancel, pause, and resume individual uploads
- [ ] **UPLD-06**: Upload wizard guides first-time users through repo selection, file selection, and upload
- [ ] **UPLD-07**: Advanced mode supports drag-and-queue file uploads
- [ ] **UPLD-08**: Advanced mode supports folder sync to HF repo
- [ ] **UPLD-09**: Uploads continue in background with system tray presence
- [ ] **UPLD-10**: App handles both Xet CAS and legacy LFS upload protocols automatically

### Repository Management

- [ ] **REPO-01**: User can browse their HF repos (models and datasets)
- [ ] **REPO-02**: User can create new repos (model or dataset)
- [ ] **REPO-03**: User can browse files within a repo
- [ ] **REPO-04**: User can delete files and repos
- [ ] **REPO-05**: User can view commit history for a repo
- [ ] **REPO-06**: User can compare versions and rollback to previous commits

### Dataset Preview

- [ ] **DATA-01**: User can preview dataset rows with schema information
- [ ] **DATA-02**: User can view column statistics (counts, distributions, types)
- [ ] **DATA-03**: User can search and filter within dataset preview

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Notifications

- **NOTF-01**: User receives desktop notifications on upload completion/failure
- **NOTF-02**: User receives notification when folder sync detects changes

### Advanced Upload

- **ADVL-01**: User can see Xet deduplication savings per upload
- **ADVL-02**: User can set bandwidth limits for uploads
- **ADVL-03**: User can schedule uploads for specific times

### Collaboration

- **COLLAB-01**: User can browse any public repo (not just own repos)
- **COLLAB-02**: User can browse repos of HF organizations they belong to

## Out of Scope

| Feature | Reason |
|---------|--------|
| Model training/fine-tuning | File management tool, not a training platform |
| Dataset annotation/labeling | Out of domain — specialized tools exist |
| Real-time collaboration | Single-user desktop client |
| HF Spaces management | Focused on models and datasets only |
| Mobile app | Desktop-first, Tauri supports mobile but deferring |
| Model inference/preview | Out of scope — HF web UI handles this |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| UPLD-01 | — | Pending |
| UPLD-02 | — | Pending |
| UPLD-03 | — | Pending |
| UPLD-04 | — | Pending |
| UPLD-05 | — | Pending |
| UPLD-06 | — | Pending |
| UPLD-07 | — | Pending |
| UPLD-08 | — | Pending |
| UPLD-09 | — | Pending |
| UPLD-10 | — | Pending |
| REPO-01 | — | Pending |
| REPO-02 | — | Pending |
| REPO-03 | — | Pending |
| REPO-04 | — | Pending |
| REPO-05 | — | Pending |
| REPO-06 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 ⚠️

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after initial definition*
