# Feature Research

**Domain:** HF desktop file management and upload client
**Researched:** 2026-03-19
**Confidence:** HIGH (HF API docs direct + official CLI docs + xet storage blog)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Token-based authentication | Every HF tool requires a token; users have one already | LOW | `hf auth login` equivalent; store securely in OS keychain |
| Upload single file or folder | Core job of the tool — without it there is no product | MEDIUM | Wraps `upload_file()` / `upload_folder()` from huggingface_hub |
| Upload progress bar with speed + ETA | Any upload tool shows progress; absence feels broken | MEDIUM | Per-file progress bars; Tauri backend streams progress events to React |
| Resumable / fault-tolerant large uploads | The whole reason to use this over CLI — this is the product's reason to exist | HIGH | Use `upload_large_folder()` semantics: local task cache, retry-forever per task |
| HF repo browser — list owned repos | Users need to pick a destination; blind upload is unusable | LOW | `list_models()` / `list_datasets()` filtered by user; paginate |
| Create new repository | Users create repos before uploading; they expect to do it in-app | LOW | `create_repo()` with name, type (model/dataset), visibility |
| Delete file(s) from repo | Users make mistakes and need to remove files | LOW | `delete_file()` / `delete_folder()` with confirmation prompt |
| Public / private repo visibility toggle | Users regularly flip privacy on models/datasets | LOW | `update_repo_settings(private=True/False)` |
| Cancel in-flight upload | Any long-running operation needs a cancel path | MEDIUM | Tauri async task cancellation; must clean up partial state |
| Error display with recovery suggestion | Uploads fail; users need to know why and what to do next | LOW | Map HF API errors to plain-language messages |
| Persistent login state | Re-entering token on every launch is unacceptable | LOW | Store token in OS keychain (macOS Keychain / Windows Credential Store / libsecret) |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Upload wizard for guided first-time experience | HF newcomers don't know repo types, LFS rules, or commit messages; wizard eliminates confusion | MEDIUM | Step-by-step: auth → pick/create repo → drag files → review → upload |
| Drag-and-drop upload queue with reorder | Power users want to queue multiple folders and reorder priority; CLI can't do this | MEDIUM | Queue abstraction over sequential `upload_large_folder()` calls |
| Background uploads with system tray | Users want to close the window and do other work; no other HF tool supports this | HIGH | Tauri system tray + background Rust tasks; progress badge on tray icon |
| Xet-aware chunk deduplication visibility | Xet storage (default as of May 2025) deduplicates at chunk level; showing "X GB saved via dedup" is novel and impressive | MEDIUM | Parse `hf_xet` output or HF API storage metadata if exposed |
| Dataset row preview in-app | Users want to verify their dataset uploaded correctly without opening a browser | HIGH | Call Dataset Viewer API (`/parquet` endpoint), render first 100 rows in a table |
| Commit message + description on upload | HF repos are git-backed; good commit hygiene matters to researchers | LOW | Expose `commit_message` and `commit_description` params in upload form |
| Commit history view | See what was changed and when; researchers version-track experiments | MEDIUM | `list_repo_commits()` → timeline UI; link to HF web diff |
| Folder sync (two-way diff: local vs remote) | Power users maintain local mirrors; showing what's new locally vs remote saves redundant uploads | HIGH | `list_repo_tree()` + local filesystem scan + checksum diff |
| Branch and tag management | Researchers use branches for experiments, tags for releases; CLI supports this but is clunky | MEDIUM | Create/delete/switch branches and tags via `create_branch()`, `create_tag()` |
| Per-file upload status with retry | Show each file's status (queued / hashing / uploading / done / failed) individually; allow single-file retry | MEDIUM | Map `upload_large_folder()` task states to per-file UI rows |
| OAuth browser login flow | Token paste is fine for power users; OAuth is smoother for newcomers | MEDIUM | Open OS browser to HF OAuth, receive redirect back to app |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Model inference / run model in-app | Users see model files and want to try them | Completely different product domain; adds massive scope (CUDA, model loading, RAM management); bloats the app | Link out to HF Inference API or Spaces |
| Dataset annotation / labeling | Users have datasets they want to annotate | Out of domain; annotation tools (Label Studio, Argilla) are entire products | Integrate "open in Argilla" link if relevant |
| Real-time collaboration / multi-user editing | Multiple people uploading to same repo at once | HF repos are git-backed; concurrent push conflicts are hard; single-user client is the right scope | Support org repos (shared ownership) without concurrent editing |
| HF Spaces management | Users manage all HF resources | Spaces have radically different concerns (hardware, secrets, sleep-time, env vars); doubles the surface area | Explicitly out of scope per PROJECT.md; link to web UI |
| Git clone / local git operations | Power users want full git workflow | git-lfs + large files = huge local disk usage; HTTP API is superior for large files; git workflows confuse new users | Use HTTP API only; document why in onboarding |
| Automatic scheduled sync (cron-like) | Users want fire-and-forget syncing | Background daemon complexity; conflicts with user-initiated uploads; auth token rotation issues | Provide "sync now" one-click action instead |
| Model card editor with rich markdown | Users want to edit README.md visually | Good markdown editors are complex to build well; web HF editor already exists | Provide basic commit-and-push of model card text; link to HF web editor for rich editing |

## Feature Dependencies

```
[Auth (token/OAuth)]
    └──required by──> [Upload any file]
    └──required by──> [Browse repos]
    └──required by──> [Create repo]
    └──required by──> [Delete file]
    └──required by──> [Commit history]
    └──required by──> [Branch/tag management]

[Browse repos]
    └──required by──> [Upload wizard destination step]
    └──required by──> [Folder sync]
    └──required by──> [Dataset preview]

[Upload (basic)]
    └──required by──> [Resumable upload]
                          └──required by──> [Upload queue]
                                               └──required by──> [Background uploads + tray]

[Create repo]
    └──enhances──> [Upload wizard] (wizard can create repo inline)

[Folder sync]
    └──requires──> [Browse repos]
    └──requires──> [Upload (resumable)]

[Dataset preview]
    └──requires──> [Browse repos]
    └──requires──> [HF Dataset Viewer API access] (separate from upload API)

[Branch/tag management]
    └──enhances──> [Commit history]

[Per-file upload status]
    └──enhances──> [Resumable upload] (surfaces per-task state already tracked by upload_large_folder)
```

### Dependency Notes

- **Auth required by everything:** Auth must be in Phase 1. Nothing else works without it.
- **Browse repos required by upload wizard:** The wizard's destination step lists existing repos; it must be built before or alongside the wizard.
- **Resumable upload required by queue:** The queue is a UX abstraction over resumable uploads. Build resumable first.
- **Background uploads require upload queue:** System tray presence only makes sense once there is a queue to monitor.
- **Dataset preview is independent from upload:** It calls a different API (Dataset Viewer), can be added later without touching upload code.
- **Folder sync is high complexity:** Depends on both upload and browse; defer to post-v1.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Token-based authentication with OS keychain storage — without auth nothing works
- [ ] Resumable, fault-tolerant large file/folder upload — the entire product differentiator
- [ ] Per-file upload progress with speed, ETA, and individual status rows — users need visibility
- [ ] Upload queue with cancel — basic control over in-flight uploads
- [ ] Repo browser (list owned models + datasets) — needed to pick upload destination
- [ ] Create new repo (name, type, visibility) — users need a destination
- [ ] Commit message on upload — minimum git hygiene
- [ ] Upload wizard for first-time users — onboarding critical for community adoption
- [ ] Error messages with recovery suggestions — uploads fail; users need guidance

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] OAuth browser login — trigger: user feedback that token paste is confusing for newcomers
- [ ] Background uploads with system tray — trigger: user requests to close window during upload
- [ ] Drag-and-drop upload queue — trigger: power users uploading multiple large folders
- [ ] Delete files from repo — trigger: users making upload mistakes want in-app cleanup
- [ ] Commit history view — trigger: researchers wanting to track upload history
- [ ] Dataset row preview — trigger: dataset-focused users validating uploads

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Folder sync (two-way diff) — defer: high complexity, niche use case until validated
- [ ] Branch and tag management — defer: power feature, low priority until core is solid
- [ ] Xet deduplication visibility — defer: needs HF API to expose chunk-level stats, unclear if available
- [ ] Public/private visibility toggle — defer: trivial to add but not blocking v1 use cases

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Token auth | HIGH | LOW | P1 |
| Resumable upload | HIGH | HIGH | P1 |
| Upload progress (per-file) | HIGH | MEDIUM | P1 |
| Repo browser | HIGH | LOW | P1 |
| Create repo | HIGH | LOW | P1 |
| Upload wizard | HIGH | MEDIUM | P1 |
| Cancel upload | HIGH | MEDIUM | P1 |
| Commit message | MEDIUM | LOW | P1 |
| Error recovery messages | HIGH | LOW | P1 |
| OAuth login | MEDIUM | MEDIUM | P2 |
| Background uploads + tray | HIGH | HIGH | P2 |
| Drag-and-drop queue | MEDIUM | MEDIUM | P2 |
| Delete files | MEDIUM | LOW | P2 |
| Commit history | MEDIUM | MEDIUM | P2 |
| Dataset row preview | MEDIUM | HIGH | P2 |
| Branch/tag management | LOW | MEDIUM | P3 |
| Folder sync | MEDIUM | HIGH | P3 |
| Visibility toggle | LOW | LOW | P3 |
| Xet dedup visibility | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | `hf` CLI (official) | Huggingface-Desktop (community, PyQt6) | Face Hugger (our approach) |
|---------|---------------------|----------------------------------------|----------------------------|
| Resumable large uploads | Yes — `hf upload-large-folder` with local cache | No — basic upload only | Yes — core differentiator |
| Upload progress | Text output only | Basic progress bar | Per-file rows with speed + ETA |
| Background uploads | No | No | Yes — system tray |
| Upload wizard | No | No | Yes — guided first-time flow |
| Drag-and-drop | No | Limited | Yes — queue with reorder |
| Dataset preview | No | No | Yes (v1.x) |
| Repo browser | Text list (`hf models list`) | Partial (upload destination only) | Full browser UI |
| Commit history | No | No | Yes (v1.x) |
| Branch/tag management | Yes — `hf repos branch/tag` | No | Yes (v2) |
| Auth | Token paste only | Token paste + config | Token paste + OAuth |
| Cross-platform | macOS, Linux, Windows | macOS, Linux, Windows | macOS, Linux, Windows (Tauri) |
| App size | Minimal (Python dep) | Large (Python + Qt) | Small (Tauri, ~10MB) |

## Sources

- [HF Hub Upload Guide](https://huggingface.co/docs/huggingface_hub/guides/upload) — upload_file, upload_folder, upload_large_folder, resumability, Xet (HIGH confidence)
- [HF CLI Guide](https://huggingface.co/docs/huggingface_hub/guides/cli) — full command reference including auth, upload, repo management (HIGH confidence)
- [HF Repository Management Guide](https://huggingface.co/docs/huggingface_hub/en/guides/repository) — create/delete/rename/visibility/branches/tags (HIGH confidence)
- [New hf CLI blog](https://huggingface.co/blog/hf-cli) — hf command structure, auth subcommands (HIGH confidence)
- [Xet on the Hub blog](https://huggingface.co/blog/xet-on-the-hub) — chunk deduplication, default for all new repos as of May 2025 (HIGH confidence)
- [From Chunks to Blocks blog](https://huggingface.co/blog/from-chunks-to-blocks) — Xet performance benchmarks (HIGH confidence)
- [Dataset Viewer docs](https://huggingface.co/docs/hub/datasets-viewer) — Parquet auto-conversion, first 100 rows preview (HIGH confidence)
- [Huggingface-Desktop GitHub](https://github.com/Ktiseos-Nyx/Huggingface-Desktop) — community PyQt6 alternative, feature set (MEDIUM confidence — in-progress project)

---
*Feature research for: HF desktop file management and upload client*
*Researched: 2026-03-19*
