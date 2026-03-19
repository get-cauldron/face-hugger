# Phase 3: Upload UI + Repo Management - Research

**Researched:** 2026-03-19
**Domain:** React UI for upload wizard, drag-and-drop queue, file browser, repo CRUD, commit history/rollback
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Upload wizard flow**
- 3-step wizard: 1. Pick/create repo → 2. Select files → 3. Review + commit message → Upload
- Step 1 (Repo): full scrollable list of user's repos with filter tabs (model/dataset) and a "Create new" button — not a dropdown
- Step 2 (Files): drag zone + "Browse files" button + folder picker — all three add to the same file list with remove buttons per file
- Step 3 (Review): summary card — target repo, file count, total size, commit message field — one glance before clicking Upload
- After clicking Upload: wizard closes, files appear in the upload queue, progress visible there
- Wizard accessible from the Upload section in sidebar (now active, no longer disabled)

**Queue & drag-drop UX**
- Split sections layout: Active uploads at top (expanded with full progress bar, speed, ETA, bytes), queued below (compact list), completed at bottom
- Drop files anywhere in the app — app detects drop and opens a mini repo picker dialog, then queues uploads
- Folder sync: one-time manual sync — user picks a local folder, app compares to remote repo, uploads only changed/new files. No watch mode in v1.
- Priority: star icon on each queued row — click to toggle priority (moves to front of queue)
- Per-file metrics in active section: progress bar + %, speed (MB/s), ETA, bytes transferred / total (from Phase 2 decisions)
- Completed items: brief success toast on completion, item moves to completed section, stays until user clears

**Repo file browser**
- File tree view: hierarchical with expandable folders — like VS Code or Finder
- Per-file actions: delete (with confirmation modal), download, copy HF URL, view metadata (size, last modified, SHA)
- Commit history: vertical timeline of commits — message, date, author — click to expand and see changed files
- Rollback: both options available — "Revert" (creates new commit undoing changes, safe) and "Reset" (destructive, resets repo to that point, requires confirmation dialog with typed repo name)
- File browser opens when clicking on a repo card/row from the Models or Datasets pages

**Create repo experience**
- Available in upload wizard step 1 AND as standalone action from Models/Datasets page headers
- Form appears as slide-out panel from right — context preserved, less disruptive
- Fields: repo name (required), model/dataset toggle (required), public/private toggle (default public), license picker dropdown, description (optional)
- Always starts fresh with defaults (model, public) — does not remember last-used type/visibility
- After creation: new repo appears in list immediately, in wizard it auto-selects the new repo

### Claude's Discretion
- Upload wizard step indicator style (numbered dots, progress bar, breadcrumbs)
- Mini repo picker dialog design for drag-and-drop uploads
- File tree expand/collapse animation
- Commit history timeline visual design
- Folder sync comparison UI (what changed, what's new, what's deleted)
- Exact file action button/menu pattern (inline buttons vs context menu vs both)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UPLD-06 | Upload wizard guides first-time users through repo selection, file selection, and upload | 3-step wizard pattern; reuse RepoCard/RepoGrid; `enqueueUpload` command available |
| UPLD-07 | Advanced mode supports drag-and-drop file uploads | Tauri `onDragDropEvent` API provides file paths; HTML5 drag disabled when Tauri drag enabled |
| UPLD-08 | Advanced mode supports folder sync to HF repo | `listFiles({recursive:true})` + local `readDir` diff; upload only changed/new via `enqueueUpload` |
| REPO-02 | User can create new repos (model or dataset) | `createRepo({repo: {name, type}, private, license})` from `@huggingface/hub`; JS-side, no new Rust command |
| REPO-03 | User can browse files within a repo | `listFiles({repo, recursive: true, expand: true})` async generator; TanStack Query |
| REPO-04 | User can delete files and repos | `deleteFile({repo, path})` / `deleteFiles({repo, paths[]})` / `deleteRepo({repo})`; all from `@huggingface/hub` |
| REPO-05 | User can view commit history for a repo | `listCommits({repo, batchSize:100})` async generator returns `CommitData[]` |
| REPO-06 | User can compare versions and rollback to previous commits | "Revert": new commit undoing changes via `commit({operations: [...]})` comparing two revisions; "Reset": no direct API — implemented via a new Rust command using `git reset --hard` + force push approach through HF REST API |
</phase_requirements>

---

## Summary

Phase 3 is a pure React UI phase that surfaces the Phase 2 Rust upload engine and adds repo management through the `@huggingface/hub` JS library. All upload commands already exist in `src/commands/upload.ts` — the phase is wiring them to UI components. Repo management operations (createRepo, deleteRepo, deleteFile/s, listFiles, listCommits) are all available in the installed `@huggingface/hub` v2.11.0 library, callable directly from the React layer with no new Rust commands required — except for the destructive "Reset" rollback operation.

The most technically nuanced area is rollback. The `@huggingface/hub` JS library provides no revert/reset function. "Revert" (safe) is implementable in JS by fetching the file contents at target commit revision and creating a new commit restoring them. "Reset" (destructive) requires force-pushing a commit using the HF REST API's `POST /api/repos/{repo_type}/{repo_id}/super-squash` squash endpoint, or — more reliably — a new Rust command that calls the HF git HTTP API with a force push to reset the branch head. Research confirms the JS SDK does not expose this operation; it is a Rust command concern.

**Primary recommendation:** Use `@huggingface/hub` for all repo reads and writes; add one new Rust command (`reset_to_commit`) for the destructive "Reset" rollback operation. Use Tauri's `onDragDropEvent` API (not HTML5 drag events) for app-wide file drop. Add `tauri-plugin-dialog` for native file/folder picker dialogs.

---

## Standard Stack

### Core (already installed — no new npm installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@huggingface/hub` | ^2.11.0 | createRepo, deleteRepo, deleteFile/s, listFiles, listCommits, commit | Installed Phase 1; covers all repo management operations |
| `@tanstack/react-query` | ^5.91.2 | TanStack Query — caching listFiles, listCommits, repo metadata | Installed Phase 1; established pattern in useRepos.ts |
| `zustand` | ^5.0.12 | uploadStore for queue UI state | Installed Phase 1; authStore is the pattern to follow |
| `lucide-react` | latest | Icons (Star, Trash, Download, Copy, ChevronRight, etc.) | Installed Phase 1 |
| `shadcn/ui` + Tailwind v4 | — | Dialog, Sheet, Progress, Tooltip, Toast components | Already configured; shadcn components are copy-paste, no install |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/plugin-dialog` | ^2 | Native file picker and folder picker dialogs | Step 2 "Browse files" button and folder sync folder picker |

### Supporting (no install needed — already available)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@tauri-apps/api` webview | ^2.10.1 | `onDragDropEvent` for app-wide file drop | Already installed; use `getCurrentWebview().onDragDropEvent()` |
| `@tauri-apps/plugin-fs` | ^2 | `readDir` for local folder listing in folder sync | Already installed |
| `@tauri-apps/plugin-store` | ^2.4.2 | Persist upload settings (concurrent limit already uses this) | Already installed |

**New dependency installation:**
```bash
npm install @tauri-apps/plugin-dialog
```
```toml
# src-tauri/Cargo.toml
tauri-plugin-dialog = "2"
```
```rust
// src-tauri/src/lib.rs — add to plugin list
.plugin(tauri_plugin_dialog::init())
```
```json
// src-tauri/capabilities/default.json — add permission
"dialog:default"
```

**Version verification (confirmed against npm registry 2026-03-19):**
- `@tauri-apps/plugin-dialog`: 2.6.0 (published ~2 months ago)
- `@huggingface/hub`: 2.11.0 (already installed, confirmed in package.json)

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── routes/
│   ├── upload/
│   │   ├── UploadPage.tsx          # Container: wizard + queue tabs
│   │   ├── wizard/
│   │   │   ├── UploadWizard.tsx    # 3-step wizard shell with step indicator
│   │   │   ├── StepRepoPicker.tsx  # Step 1: repo list + "Create new" button
│   │   │   ├── StepFilePicker.tsx  # Step 2: drag zone + browse + folder picker
│   │   │   └── StepReview.tsx      # Step 3: summary + commit message + Upload
│   │   └── queue/
│   │       ├── UploadQueueView.tsx  # Active/Queued/Completed split sections
│   │       ├── ActiveJobRow.tsx     # Expanded row: progress bar, speed, ETA
│   │       ├── QueuedJobRow.tsx     # Compact row: filename, repo, star priority
│   │       └── CompletedJobRow.tsx  # Completed row with clear button
│   ├── models/
│   │   └── ModelsPage.tsx          # Add: "Create repo" button, onClick→FileBrowser
│   ├── datasets/
│   │   └── DatasetsPage.tsx        # Add: "Create repo" button, onClick→FileBrowser
│   └── repo-browser/
│       ├── RepoBrowserPage.tsx     # Container: file tree + commit history tabs
│       ├── FileTree.tsx            # Recursive tree with expand/collapse
│       ├── FileTreeNode.tsx        # Single file/folder row with action menu
│       ├── CommitTimeline.tsx      # Vertical timeline of commits
│       └── CommitRow.tsx           # Single commit: message, date, author + actions
├── components/
│   └── repos/
│       └── CreateRepoSheet.tsx     # Slide-out panel for repo creation
├── commands/
│   ├── upload.ts                   # Existing — no changes needed
│   └── repos.ts                    # New: createRepo, deleteRepo, deleteFile, resetToCommit
├── queries/
│   ├── useRepos.ts                 # Existing — useModels, useDatasets
│   ├── useRepoFiles.ts             # New: useFiles(repoId, path?)
│   └── useCommitHistory.ts         # New: useCommits(repoId)
└── stores/
    ├── authStore.ts                # Existing
    └── uploadStore.ts              # New: queue UI state, wizard state
```

### Pattern 1: Section Navigation Extension (AppShell)
**What:** Add 'upload' and 'repo-browser' to the `Section` type in AppShell and Sidebar. Pass `repoId` state for repo browser context.
**When to use:** The existing local-state section routing is established (no React Router). Extend this pattern rather than introducing a router.
**Example:**
```typescript
// AppShell.tsx extension
type Section = 'models' | 'datasets' | 'settings' | 'upload' | 'repo-browser';

// Sidebar: replace disabled Upload placeholder with active nav item
<button
  className={`${navItemBase} w-full text-left ${activeSection === 'upload' ? navItemActive : ''}`}
  onClick={() => handleSectionChange('upload')}
>
  <UploadCloud className="w-4 h-4 flex-shrink-0" />
  <span>Upload</span>
</button>
```

### Pattern 2: Upload Store (Zustand)
**What:** Zustand store for upload queue display state — mirrors the Rust queue, driven by `startUploadMonitoring` channel updates.
**When to use:** Queue UI is local state (no server sync needed). Follow authStore pattern exactly.
**Example:**
```typescript
// src/stores/uploadStore.ts
import { create } from 'zustand';
import type { UploadJob, UploadProgress } from '../commands/upload';

interface UploadState {
  jobs: UploadJob[];
  progressMap: Record<string, UploadProgress>;
  wizardOpen: boolean;
  setJobs: (jobs: UploadJob[]) => void;
  updateProgress: (updates: UploadProgress[]) => void;
  setWizardOpen: (open: boolean) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  jobs: [],
  progressMap: {},
  wizardOpen: false,
  setJobs: (jobs) => set({ jobs }),
  updateProgress: (updates) =>
    set((state) => ({
      progressMap: updates.reduce(
        (acc, p) => ({ ...acc, [p.job_id]: p }),
        state.progressMap
      ),
    })),
  setWizardOpen: (open) => set({ wizardOpen: open }),
}));
```

### Pattern 3: Tauri Drag-and-Drop (App-Wide)
**What:** Tauri v2's `onDragDropEvent` provides file paths from the OS directly. HTML5 drag is disabled when Tauri drag is active on macOS/Linux.
**When to use:** For dropping files anywhere in the app (not just a specific drop zone). Register listener once in AppShell or a top-level component.
**Critical note:** The `DragDropEvent` provides `paths: string[]` (absolute file system paths), NOT File objects. These paths feed directly into `enqueueUpload({ filePath: path, ... })`.
**Example:**
```typescript
// Source: @tauri-apps/api/webview.d.ts (installed, verified)
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { DragDropEvent } from '@tauri-apps/api/webview';

useEffect(() => {
  const unlisten = getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === 'drop') {
      const paths: string[] = event.payload.paths;
      // Open mini repo picker dialog, then enqueue
      setDroppedPaths(paths);
      setMiniPickerOpen(true);
    }
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

### Pattern 4: TanStack Query for Repo Files and Commits
**What:** Wrap `listFiles` and `listCommits` async generators in TanStack Query hooks. Collect the async generator into an array.
**When to use:** All HF API reads — same pattern as useRepos.ts.
**Example:**
```typescript
// src/queries/useRepoFiles.ts
import { listFiles, type ListFileEntry } from '@huggingface/hub';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export function useRepoFiles(repoId: string, repoType: 'model' | 'dataset') {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['repo-files', repoId],
    queryFn: async (): Promise<ListFileEntry[]> => {
      const files: ListFileEntry[] = [];
      for await (const f of listFiles({
        repo: { name: repoId, type: repoType },
        recursive: true,
        expand: true,  // fetches lastCommit, size per file
        accessToken: token!,
      })) {
        files.push(f);
      }
      return files;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!token && !!repoId,
  });
}
```

### Pattern 5: createRepo (JS-side, no Rust)
**What:** Call `createRepo` from `@huggingface/hub` directly from the React layer. Returns `{ repoUrl, id }`.
**When to use:** Repo creation in wizard Step 1 and standalone CreateRepoSheet.
**Example:**
```typescript
// Source: @huggingface/hub dist/src/lib/create-repo.d.ts (installed, verified)
import { createRepo } from '@huggingface/hub';

await createRepo({
  repo: { name: 'my-model-name', type: 'model' },  // type: 'model' | 'dataset'
  private: false,
  license: 'apache-2.0',
  accessToken: token,
});
// Then invalidate TanStack Query cache:
queryClient.invalidateQueries({ queryKey: ['repos'] });
```

### Pattern 6: deleteFile / deleteFiles (JS-side)
**What:** Call `deleteFile` or `deleteFiles` from `@huggingface/hub`. Both create a new commit.
**When to use:** Per-file delete action in file browser (single file). Both return `CommitOutput | undefined`.
**Example:**
```typescript
// Source: @huggingface/hub dist/src/lib/delete-file.d.ts (installed, verified)
import { deleteFile } from '@huggingface/hub';

await deleteFile({
  repo: { name: repoId, type: repoType },
  path: 'path/to/file.safetensors',
  commitTitle: 'Delete file.safetensors',
  accessToken: token,
});
```

### Pattern 7: Folder Sync Comparison
**What:** Read local directory with `readDir` (tauri-plugin-fs), list remote files with `listFiles({recursive:true})`, diff by filename + size, enqueue only new/changed.
**When to use:** UPLD-08 folder sync. One-shot, no watch mode.
**Note on SHA comparison:** `ListFileEntry.oid` is the git SHA of the pointer file (not the content SHA for LFS/Xet files). Size comparison is more reliable for "changed file" detection than OID. Use filename+size as the diff key.
**Example:**
```typescript
import { readDir } from '@tauri-apps/plugin-fs';

// Build remote file map: path → size
const remoteMap = new Map<string, number>();
for await (const entry of listFiles({ repo, recursive: true, accessToken: token })) {
  if (entry.type === 'file') remoteMap.set(entry.path, entry.size);
}

// Read local dir recursively
const localEntries = await readDir(localFolderPath, { recursive: true });

// Find new or changed
const toUpload = localEntries.filter((entry) => {
  if (!entry.isFile) return false;
  const remotePath = entry.name; // relative path within folder
  const remoteSize = remoteMap.get(remotePath);
  return remoteSize === undefined || remoteSize !== entry.size;
});
```

### Pattern 8: Revert Commit (Safe — JS-side)
**What:** "Revert" creates a new commit that restores files to the state at a target commit OID. Approach: for each file in the target commit's changed files, read the content at that revision and create a new commit with those contents.
**When to use:** The safe rollback option (does not destroy history). REPO-06.
**Limitation:** `listCommits` returns `CommitData` with `oid`, `title`, `date`, `authors` — but does NOT include a list of files changed in that commit. To know which files changed, use `listFiles({revision: oid})` to get the full file tree at that point, compare to current file tree, and produce a diff. This is the most practical approach without a "changed files per commit" API.
**Example (concept):**
```typescript
// Get file tree at target revision
const targetFiles: ListFileEntry[] = [];
for await (const f of listFiles({ repo, recursive: true, revision: targetCommitOid, accessToken: token })) {
  targetFiles.push(f);
}
// Compare to current state and produce restore operations
// Use commit() with operations: [{operation: 'addOrUpdate', path, content: URL}]
// where content is a URL pointing to the HF file at target revision
```

### Pattern 9: Reset to Commit (Destructive — New Rust Command)
**What:** The HF Hub REST API exposes `POST /api/{repo_type}s/{repo_id}/super-squash` for destructive history operations. However, for a true "reset HEAD to commit X", the approach is: force push via the git HTTP smart protocol, or use the HF commit API with `parentCommit` set to the target OID and an empty operations array to create a new squash point.
**Confirmed finding:** There is no `revert` or `reset` function in `@huggingface/hub` JS SDK. The Python `huggingface_hub` library's `super_squash_history` squashes to a single commit but does not reset to a specific commit OID.
**Recommended implementation:** New Rust command `reset_to_commit` that calls the HF REST API directly. This requires using the git HTTP smart protocol's `receive-pack` endpoint with force-push. This is non-trivial but matches how the Python `git push --force` approach works.
**Alternative (simpler, accepted for v1):** Implement "Reset" by creating a new commit that matches the complete file tree at the target revision — effectively "squashing to look like commit X" without rewriting history. This is safe, requires no force push, and is implementable entirely in JS using `listFiles({revision: targetOid})` + `commit({operations})`.

### Anti-Patterns to Avoid
- **Using HTML5 `ondrop` for file drops:** On macOS and Linux, Tauri intercepts drop events at the OS level. HTML5 drag events do NOT fire for files dropped from Finder/Explorer when Tauri drag is enabled. Use `onDragDropEvent` exclusively.
- **`var()` arbitrary Tailwind values:** Established in Phase 1. Use semantic classes (`bg-card`, `text-foreground`) only. `var(--color-primary)` in className strings does not resolve in Tailwind v4.
- **Calling `invoke` directly in components:** Follow established pattern — all Tauri invocations go through `src/commands/*.ts` wrappers that call `unwrap()` on the tauri-specta Result.
- **Loading full file contents for upload via JS:** Do NOT use `fetch()` or `readFile()` to load file content for upload. Pass the absolute file path string to `enqueueUpload`. The Rust engine reads the file directly.
- **`listFiles` with `expand: false` for file browser:** Without `expand: true`, `lastCommit` is not populated. Always use `expand: true` when showing metadata in the file browser.
- **Polling `listUploads` for progress:** Phase 2 provides `startUploadMonitoring` which emits `Vec<UploadProgress>` every 500ms via Channel. Use that, not polling.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File picker dialog | Custom file input overlay | `@tauri-apps/plugin-dialog` `open()` | Native OS dialog, returns absolute paths, handles permissions |
| Folder picker dialog | Custom folder input | `@tauri-apps/plugin-dialog` `open({directory: true})` | Same — native, returns absolute path |
| Repo creation | Custom HF REST call | `createRepo()` from `@huggingface/hub` | Handles auth headers, error handling, all edge cases |
| File deletion | Custom `fetch()` DELETE | `deleteFile()` / `deleteFiles()` from `@huggingface/hub` | Creates proper HF commit, handles LFS/Xet file refs |
| Commit history listing | Custom `fetch()` to git API | `listCommits()` from `@huggingface/hub` | Async generator, handles pagination, correct type |
| File tree listing | Custom `fetch()` to HF tree API | `listFiles({recursive:true, expand:true})` | Handles LFS/Xet metadata, xetHash, lastCommit |
| Confirmation dialogs (delete/reset) | Custom modal | shadcn/ui `AlertDialog` | Accessible, keyboard-dismissible, built-in overlay |
| Slide-out panel (create repo) | Custom drawer | shadcn/ui `Sheet` | Animation, focus trap, backdrop, close on Escape |
| Toast notifications | Custom toast | shadcn/ui `Sonner` (or `useToast`) | Queue management, auto-dismiss, stack behavior |
| Progress bars | CSS `<div>` with width | shadcn/ui `Progress` | Accessible `role="progressbar"`, smooth animation |
| File size formatting | Custom formatter | Inline utility function | Trivial — just format bytes to MB/GB display string |

**Key insight:** The `@huggingface/hub` JS library eliminates the need for any custom HF API HTTP calls in the React layer. Every repo management operation is covered. The only custom Rust command needed is the destructive "Reset" rollback.

---

## Common Pitfalls

### Pitfall 1: HTML5 Drag Events vs Tauri Drag Events
**What goes wrong:** Developer adds `onDrop` HTML5 handler to a drop zone, works in browser dev mode, silently fails in Tauri desktop app when files are dragged from Finder/Explorer.
**Why it happens:** Tauri intercepts OS-level drag events before they reach the WebView on macOS and Linux. The WebView never sees the HTML5 dragover/drop events for files coming from the OS file manager.
**How to avoid:** Use `getCurrentWebview().onDragDropEvent()` registered at app-shell level. Check `event.payload.type === 'drop'` and read `event.payload.paths: string[]`. Return the unlisten function in `useEffect` cleanup.
**Warning signs:** Drop zone works in `vite dev` (which runs in Chrome) but not in `tauri dev` or bundled app.

### Pitfall 2: RepoDesignation Confusion
**What goes wrong:** Passing a string like `"username/model-name"` to `@huggingface/hub` functions that expect a `RepoDesignation`.
**Why it happens:** `RepoDesignation = RepoId | RepoFullName`. `RepoFullName` as a string works only for models (bare `"owner/name"`). For datasets, the string must be `"datasets/owner/name"`, or you must use the `RepoId` object form.
**How to avoid:** Always use the `RepoId` object form: `{ name: repoId, type: 'model' | 'dataset' }`. This is unambiguous and type-safe.
**Warning signs:** API calls succeed for model repos but silently 404 for dataset repos.

### Pitfall 3: listFiles / listCommits Are Async Generators — Must Be Consumed
**What goes wrong:** Developer writes `const files = listFiles({...})` and tries to use `files.length` or iterate with `files.map()` — both fail because the return value is `AsyncGenerator<ListFileEntry>`, not an array.
**Why it happens:** The functions return lazy async generators (like Python generators). They don't load everything upfront.
**How to avoid:** Always consume in a `for await` loop inside the TanStack Query `queryFn`. Collect into an array with `const arr: T[] = []; for await (const x of gen) arr.push(x);`.
**Warning signs:** TypeScript does not error on this — `AsyncGenerator` is iterable but not array-like. Runtime error when calling `.map()` or checking `.length`.

### Pitfall 4: TanStack Query Cache Invalidation After Mutations
**What goes wrong:** User creates a repo or deletes a file, but the list doesn't update because TanStack Query is still serving stale data from cache.
**Why it happens:** `staleTime: 5 * 60 * 1000` in useRepos.ts means data is considered fresh for 5 minutes.
**How to avoid:** After every mutation (createRepo, deleteRepo, deleteFile), call `queryClient.invalidateQueries({ queryKey: ['repos'] })` or the specific query key. Use `useMutation` from TanStack Query to co-locate invalidation logic.
**Warning signs:** After creating a repo, the new repo doesn't appear in the wizard repo picker until user navigates away and back.

### Pitfall 5: listFiles `expand: true` is Slow for Large Repos
**What goes wrong:** A repo with 10,000+ files takes many seconds to load in the file browser when `expand: true` is set, because each file fetches lastCommit metadata.
**Why it happens:** `expand: true` triggers additional API calls per file for commit metadata.
**How to avoid:** For the initial file tree load, use `expand: false`. Only fetch `expand: true` metadata when the user expands a folder or clicks a file to view metadata. Alternatively, use `expand: true` with a loading state and paginate by folder (only load the expanded folder's children eagerly).
**Warning signs:** File browser hangs on repos with many files.

### Pitfall 6: Wizard Step State and File Deduplication
**What goes wrong:** User drags the same file twice (once to the drag zone, once via "Browse files" button) and the same file appears twice in the file list, causing duplicate uploads.
**Why it happens:** The file list in Step 2 is built by appending from multiple sources (drag, browse, folder picker).
**How to avoid:** Deduplicate file list by absolute path. When adding new files, filter out any that already exist in the list by `filePath`.
**Warning signs:** Duplicate rows in upload queue after uploading from wizard.

### Pitfall 7: `plugin-dialog` Requires Cargo.toml + capabilities
**What goes wrong:** `npm install @tauri-apps/plugin-dialog` is added but the dialog calls silently fail or throw "plugin not registered" errors at runtime.
**Why it happens:** Tauri v2 plugins require both: (1) adding the Rust crate to Cargo.toml, (2) calling `.plugin(tauri_plugin_dialog::init())` in the Tauri builder, AND (3) adding `"dialog:default"` to the capabilities file.
**How to avoid:** All three registration steps must be done together. The npm package alone is insufficient.
**Warning signs:** `open()` from plugin-dialog returns null or throws in tauri dev but not in vite dev.

---

## Code Examples

Verified patterns from installed library source:

### listFiles — Collect to Array
```typescript
// Source: @huggingface/hub v2.11.0 dist/src/lib/list-files.d.ts (installed)
import { listFiles, type ListFileEntry } from '@huggingface/hub';

const files: ListFileEntry[] = [];
for await (const f of listFiles({
  repo: { name: 'owner/model-name', type: 'model' },
  recursive: true,
  expand: true,        // includes lastCommit.date, lastCommit.title, size
  accessToken: token,
})) {
  files.push(f);
}
// files[0] shape: { type: 'file'|'directory', path, size, oid?, lfs?, xetHash?, lastCommit? }
```

### listCommits — Collect to Array
```typescript
// Source: @huggingface/hub v2.11.0 dist/src/lib/list-commits.d.ts (installed)
import { listCommits, type CommitData } from '@huggingface/hub';

const commits: CommitData[] = [];
for await (const c of listCommits({
  repo: { name: 'owner/model-name', type: 'model' },
  batchSize: 100,
  accessToken: token,
})) {
  commits.push(c);
}
// CommitData: { oid: string, title: string, message: string, authors: [{username, avatarUrl}], date: Date }
```

### createRepo
```typescript
// Source: @huggingface/hub v2.11.0 dist/src/lib/create-repo.d.ts (installed)
import { createRepo } from '@huggingface/hub';

const result = await createRepo({
  repo: { name: 'my-new-model', type: 'model' },  // type: 'model' | 'dataset'
  private: false,
  license: 'apache-2.0',
  accessToken: token,
});
// result: { repoUrl: string, id: string }
```

### deleteFile
```typescript
// Source: @huggingface/hub v2.11.0 dist/src/lib/delete-file.d.ts (installed)
import { deleteFile } from '@huggingface/hub';

await deleteFile({
  repo: { name: 'owner/model-name', type: 'model' },
  path: 'pytorch_model.bin',
  commitTitle: 'Remove pytorch_model.bin',
  accessToken: token,
});
// Returns CommitOutput | undefined
```

### deleteRepo
```typescript
// Source: @huggingface/hub v2.11.0 dist/src/lib/delete-repo.d.ts (installed)
import { deleteRepo } from '@huggingface/hub';

await deleteRepo({
  repo: { name: 'owner/model-name', type: 'model' },
  accessToken: token,
});
// Returns void. Irreversible.
```

### Tauri file picker (after plugin-dialog is installed)
```typescript
import { open } from '@tauri-apps/plugin-dialog';

// Single file picker
const filePath = await open({
  multiple: false,
  directory: false,
  // filters: [{ name: 'All files', extensions: ['*'] }]
});
// Returns string | null (absolute path)

// Multiple files
const filePaths = await open({ multiple: true, directory: false });
// Returns string[] | null

// Folder picker
const folderPath = await open({ directory: true, multiple: false });
// Returns string | null
```

### Tauri app-wide drag-drop listener
```typescript
// Source: @tauri-apps/api/webview.d.ts (installed, verified)
import { getCurrentWebview } from '@tauri-apps/api/webview';

useEffect(() => {
  let unlistenFn: (() => void) | undefined;

  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === 'enter') {
      setIsDragOver(true);
    } else if (event.payload.type === 'drop') {
      setIsDragOver(false);
      const paths: string[] = event.payload.paths;
      // paths are absolute file system paths — pass directly to enqueueUpload
      handleDroppedPaths(paths);
    } else if (event.payload.type === 'leave') {
      setIsDragOver(false);
    }
  }).then((fn) => { unlistenFn = fn; });

  return () => { unlistenFn?.(); };
}, []);
```

### UploadStore bootstrap (start monitoring on mount)
```typescript
// In UploadPage.tsx or a top-level provider
import { startUploadMonitoring, listUploads } from '../commands/upload';
import { useUploadStore } from '../stores/uploadStore';

useEffect(() => {
  const { setJobs, updateProgress } = useUploadStore.getState();

  // Load initial job list
  listUploads().then(setJobs);

  // Start progress channel
  startUploadMonitoring((updates) => {
    updateProgress(updates);
    // Re-sync job list when states change (e.g., pending→done)
    listUploads().then(setJobs);
  });
}, []);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTML5 `File` objects for drag | Tauri `onDragDropEvent` giving `paths: string[]` | Tauri v2 | Paths passed to Rust directly; no JS file reading |
| HF REST API hand-rolled fetch | `@huggingface/hub` v2+ JS library | 2023+ | All repo ops covered; no custom fetch boilerplate |
| Polling for upload progress | Tauri `Channel` batched events (Phase 2) | Phase 2 decisions | `startUploadMonitoring` emits every 500ms; no polling |
| `@tauri-apps/api/dialog` | `@tauri-apps/plugin-dialog` | Tauri v2 | Dialog is now a separate plugin, not in core API |
| `listModels` `additionalFields: ['private', 'downloads']` | Base fields include private/downloads | Phase 1 finding | Only `tags` needs `additionalFields` |

**Deprecated/outdated:**
- `tauri::api::dialog` (Tauri v1): replaced by `tauri-plugin-dialog` in v2
- `emit_all` for progress: replaced by `tauri::ipc::Channel` (Phase 2 decision)
- `window.__TAURI__.dialog`: replaced by `@tauri-apps/plugin-dialog` module import

---

## Open Questions

1. **Revert "Revert" — no per-commit file diff API**
   - What we know: `listCommits` returns `CommitData` (oid, title, date, authors). It does NOT include a list of files changed in that commit. There is no `getCommitDiff()` function in `@huggingface/hub`.
   - What's unclear: How to determine which files to restore for a "Revert commit X" action without a file diff API. Getting the full file tree at revision X and comparing to current is the workaround, but is O(n) in file count.
   - Recommendation: Implement "Revert" by snapshotting full file tree at `revision: targetOid` vs current, producing an operations array for `commit()`. For large repos this is slow but correct for v1. Document the limitation.

2. **Destructive "Reset" rollback implementation**
   - What we know: No `reset` or `revert` function exists in `@huggingface/hub` JS. The HF REST API has `/super-squash` but it squashes to a single commit (all history flattened), not a "reset to commit X".
   - What's unclear: Whether the HF git HTTP smart protocol's `receive-pack` endpoint (force push) is accessible without a full git client. The only documented approach in the community is `git reset --hard + push --force`.
   - Recommendation: Implement "Reset" in the same way as "Revert" (new commit that matches target revision's file tree), but present it as "Restore to this version" with a destructive-looking confirmation dialog (typed repo name). This is technically a "squash forward" not a history rewrite, but achieves the user's goal of "repo looks like it did at commit X". Flag as LOW confidence — may need revision if users need true history rewrite.

3. **shadcn/ui components not yet added to project**
   - What we know: Tailwind v4 + shadcn/ui are in the established stack but shadcn components are copy-paste, not installed as a package. The project currently has no shadcn component files.
   - What's unclear: Whether to init shadcn/ui (`npx shadcn@latest init`) to set up components.json and copy components, or just hand-copy the specific components needed (Dialog, Sheet, Progress, AlertDialog, Sonner/Toast).
   - Recommendation: Use `npx shadcn@latest init` in Wave 0 to set up the scaffolding, then add specific components as needed. Avoids drift from shadcn defaults.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test` (runs `vitest run --reporter=dot`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPLD-06 | Wizard step navigation (1→2→3, back, validation) | unit | `npm test -- src/routes/upload/wizard` | ❌ Wave 0 |
| UPLD-06 | Files added from multiple sources deduplicate by path | unit | `npm test -- src/routes/upload/wizard/StepFilePicker` | ❌ Wave 0 |
| UPLD-07 | Drop paths from DragDropEvent are passed to enqueueUpload | unit (mock Tauri) | `npm test -- src/routes/upload` | ❌ Wave 0 |
| UPLD-08 | Folder sync diff: local vs remote produces correct upload list | unit | `npm test -- src/routes/upload` | ❌ Wave 0 |
| REPO-02 | createRepo calls hub with correct RepoId object form | unit (mock hub) | `npm test -- src/commands/repos` | ❌ Wave 0 |
| REPO-03 | useRepoFiles collects async generator into array | unit (mock hub) | `npm test -- src/queries/useRepoFiles` | ❌ Wave 0 |
| REPO-04 | deleteFile/deleteRepo called with correct params | unit (mock hub) | `npm test -- src/commands/repos` | ❌ Wave 0 |
| REPO-05 | useCommitHistory collects listCommits generator | unit (mock hub) | `npm test -- src/queries/useCommitHistory` | ❌ Wave 0 |
| REPO-06 | Revert builds correct operations array from file tree diff | unit | `npm test -- src/routes/repo-browser` | ❌ Wave 0 |

**Note on Tauri mocking:** The existing `useRepos.test.ts` and `authStore.test.ts` demonstrate the pattern for mocking `@tauri-apps/api/core` invoke. The same approach applies here — mock `@tauri-apps/api/webview` for drag events, mock `@huggingface/hub` for API calls.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/routes/upload/wizard/UploadWizard.test.tsx` — covers UPLD-06 step navigation
- [ ] `src/routes/upload/wizard/StepFilePicker.test.tsx` — covers UPLD-06 file deduplication, UPLD-07 drag drop
- [ ] `src/routes/upload/FolderSync.test.ts` — covers UPLD-08 diff logic (pure function, no Tauri needed)
- [ ] `src/commands/repos.test.ts` — covers REPO-02, REPO-04 (mock `@huggingface/hub`)
- [ ] `src/queries/useRepoFiles.test.ts` — covers REPO-03 async generator collection
- [ ] `src/queries/useCommitHistory.test.ts` — covers REPO-05 async generator collection
- [ ] `src/routes/repo-browser/revert.test.ts` — covers REPO-06 revert file diff logic

---

## Sources

### Primary (HIGH confidence)
- `@huggingface/hub` v2.11.0 installed at `node_modules/@huggingface/hub/dist/src/lib/` — all function signatures verified directly from TypeScript declaration files
- `@tauri-apps/api` v2.10.1 installed — `DragDropEvent`, `onDragDropEvent`, `TauriEvent.DRAG_DROP` verified from `webview.d.ts` and `event.d.ts`
- `src/commands/upload.ts` — all 9 Phase 2 upload commands confirmed available
- `src-tauri/src/upload/types.rs` — `UploadJob`, `UploadProgress`, `UploadJobState` types confirmed
- `src-tauri/Cargo.toml` — confirmed `tauri-plugin-dialog` is NOT yet installed (needs adding)
- `src-tauri/capabilities/default.json` — confirmed `dialog:default` permission not yet added
- `package.json` — confirmed all React/TanStack/Zustand dependencies already installed

### Secondary (MEDIUM confidence)
- [Tauri v2 dialog plugin docs](https://v2.tauri.app/plugin/dialog/) — `@tauri-apps/plugin-dialog` v2.6.0, `open({directory, multiple, filters})` API confirmed
- [HF Hub API docs](https://huggingface.co/docs/hub/api) — REST API now documented via OpenAPI playground; no dedicated revert/reset commit endpoint found

### Tertiary (LOW confidence — needs validation)
- HF "Reset" destructive rollback: No `reset` function in JS SDK or documented REST endpoint for "reset HEAD to commit X". Community-confirmed approach is `git reset --hard + push --force`. Alternative v1 implementation via "squash forward to match target revision" is unverified but logically sound. [Source: HF community forums, multiple threads]
- `super_squash_history` endpoint: Python `huggingface_hub` has this function but it squashes ALL history to one commit — not reset to specific OID. Not applicable to "Reset to commit X" use case.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified from installed node_modules and Cargo.toml
- Architecture: HIGH — patterns follow established Phase 1 conventions (authStore, useRepos, invoke wrappers)
- `@huggingface/hub` API signatures: HIGH — read directly from installed TypeScript declarations
- Tauri drag-drop API: HIGH — read directly from installed `@tauri-apps/api` declarations
- Rollback (Revert/Reset) implementation: MEDIUM — "Revert" approach is sound but untested; "Reset" approach is a creative workaround due to no official API
- Pitfalls: HIGH for drag-drop and async generator pitfalls (direct code evidence); MEDIUM for cache invalidation and expand:true performance (derived from API understanding)

**Research date:** 2026-03-19
**Valid until:** 2026-06-19 (stable APIs; `@huggingface/hub` minor versions may add revert/reset support)
