# Phase 3: Upload UI + Repo Management - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Upload wizard (guided 3-step flow), advanced mode (drag-and-drop queue, folder sync), repo file browser with CRUD, commit history with rollback, and inline repo creation. This phase surfaces the Phase 2 upload engine through the React UI and adds the repo management features. No OAuth (Phase 4), no dataset preview (Phase 4), no background/tray uploads (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Upload wizard flow
- 3-step wizard: 1. Pick/create repo → 2. Select files → 3. Review + commit message → Upload
- Step 1 (Repo): full scrollable list of user's repos with filter tabs (model/dataset) and a "Create new" button — not a dropdown
- Step 2 (Files): drag zone + "Browse files" button + folder picker — all three add to the same file list with remove buttons per file
- Step 3 (Review): summary card — target repo, file count, total size, commit message field — one glance before clicking Upload
- After clicking Upload: wizard closes, files appear in the upload queue, progress visible there
- Wizard accessible from the Upload section in sidebar (now active, no longer disabled)

### Queue & drag-drop UX
- Split sections layout: Active uploads at top (expanded with full progress bar, speed, ETA, bytes), queued below (compact list), completed at bottom
- Drop files anywhere in the app — app detects drop and opens a mini repo picker dialog, then queues uploads
- Folder sync: one-time manual sync — user picks a local folder, app compares to remote repo, uploads only changed/new files. No watch mode in v1.
- Priority: star icon on each queued row — click to toggle priority (moves to front of queue)
- Per-file metrics in active section: progress bar + %, speed (MB/s), ETA, bytes transferred / total (from Phase 2 decisions)
- Completed items: brief success toast on completion, item moves to completed section, stays until user clears

### Repo file browser
- File tree view: hierarchical with expandable folders — like VS Code or Finder
- Per-file actions: delete (with confirmation modal), download, copy HF URL, view metadata (size, last modified, SHA)
- Commit history: vertical timeline of commits — message, date, author — click to expand and see changed files
- Rollback: both options available — "Revert" (creates new commit undoing changes, safe) and "Reset" (destructive, resets repo to that point, requires confirmation dialog with typed repo name)
- File browser opens when clicking on a repo card/row from the Models or Datasets pages

### Create repo experience
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — UPLD-06, UPLD-07, UPLD-08, REPO-02, REPO-03, REPO-04, REPO-05, REPO-06

### Phase 1 patterns (UI patterns)
- `src/components/shell/AppShell.tsx` — App shell layout, sidebar, routing pattern
- `src/components/shell/Sidebar.tsx` — Sidebar structure with section headers and recent repos
- `src/components/repos/RepoCard.tsx` — Card component pattern, theme class usage
- `src/components/repos/RepoListToolbar.tsx` — Search/filter/sort toolbar pattern
- `src/app.css` — Theme variables (dark, warm orange, spacing)

### Phase 2 patterns (upload engine API)
- `src/commands/upload.ts` — Frontend upload command wrappers (enqueue, cancel, pause, resume, list, etc.)
- `src-tauri/src/upload/types.rs` — UploadJob, UploadProgress, UploadJobState types
- `src-tauri/src/commands/upload.rs` — Tauri command signatures for upload operations

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Visual identity decisions (dark theme, orange, spacious, mixed rounding, playful touches)
- `.planning/phases/02-upload-engine/02-CONTEXT.md` — Queue/progress/error decisions that the UI must surface

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/repos/RepoCard.tsx`: Card component — reuse for repo picker in wizard
- `src/components/repos/RepoGrid.tsx` / `RepoTable.tsx`: Hybrid view — reuse for repo selection in wizard step 1
- `src/components/repos/RepoListToolbar.tsx`: Search/filter toolbar — reuse in wizard repo picker
- `src/commands/upload.ts`: All 9 upload commands ready (enqueue, cancel, pause, resume, pause_all, list, set_priority, start_monitoring, set_concurrent_limit)
- `src/stores/authStore.ts`: Auth store pattern — create similar uploadStore for queue UI state
- `src/lib/preferences.ts`: Preference persistence via tauri-plugin-store — reuse for upload settings
- `@huggingface/hub`: JS library provides `createRepo`, `deleteFile`, `deleteRepo`, `listFiles`, `listCommits` for repo management

### Established Patterns
- Tailwind v4 semantic classes (text-foreground, bg-card, etc.) — NOT var() arbitrary values
- Zustand for client UI state, TanStack Query for HF API data
- Commands wrapped with unwrap() in src/commands/*.ts
- tauri-specta auto-generates TypeScript types from Rust

### Integration Points
- Upload sidebar section becomes active (replace disabled placeholder)
- Upload commands from Phase 2 are the backend for wizard and queue
- Repo file browser needs new routes/pages wired into AppShell
- Create repo needs new Rust command or can use @huggingface/hub JS directly
- Commit history/rollback may need new HF API calls (listCommits, revert)

</code_context>

<specifics>
## Specific Ideas

- Wizard should feel effortless for someone who has never used HF — no jargon, clear labels
- Drag-and-drop anywhere is a power move — makes the app feel native and responsive
- File tree should feel like Finder/VS Code — familiar, not custom
- The star icon for priority should be immediately obvious but not visually noisy
- Rollback with typed repo name confirmation (for destructive reset) prevents accidents — familiar from GitHub's "delete repo" pattern

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-upload-ui-repo-management*
*Context gathered: 2026-03-19*
