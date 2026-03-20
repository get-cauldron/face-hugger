---
phase: 03-upload-ui-repo-management
plan: "04"
subsystem: repo-browser
tags: [file-tree, deletion, dialogs, navigation]
dependency_graph:
  requires: ["03-01", "03-03", "03-05"]
  provides: ["file-tree-browser", "file-deletion", "repo-deletion"]
  affects: ["models-page", "datasets-page", "app-shell"]
tech_stack:
  added: []
  patterns: ["buildTree pure function", "AlertDialog typed-name confirmation", "query invalidation on mutation"]
key_files:
  created:
    - src/routes/repo-browser/FileTree.tsx
    - src/routes/repo-browser/FileTreeNode.tsx
    - src/routes/repo-browser/FileActions.tsx
  modified:
    - src/routes/repo-browser/RepoBrowserPage.tsx
    - src/routes/repo-browser/FileTree.test.ts
    - src/routes/models/ModelsPage.tsx
    - src/routes/datasets/DatasetsPage.tsx
    - src/components/shell/AppShell.tsx
decisions:
  - "FileActions default export is DeleteFileDialog (used by FileTreeNode); DeleteRepoDialog is named export"
  - "buildTree uses Proxy-backed Map to update parent children arrays during recursive path traversal"
  - "onRepoSelect callback threaded through AppShell → ContentArea → ModelsPage/DatasetsPage"
metrics:
  duration: 3min
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_changed: 8
---

# Phase 03 Plan 04: File Tree Browser and Deletion Summary

**One-liner:** Hierarchical VS Code-style file tree with expand/collapse, copy URL, metadata popover, file deletion, and typed-name repo deletion.

## What Was Built

### Task 1: Hierarchical File Tree (commit e492fde)

**FileTree.tsx** — `buildTree(files: ListFileEntry[]): TreeNode[]` converts the flat `useRepoFiles` output into a nested tree. Directories are sorted before files at each level (both alphabetically). The function is pure and fully unit tested (5 cases covering empty input, nesting, sorting, deep paths, size preservation).

**FileTreeNode.tsx** — Renders a single tree node:
- Directories: ChevronRight icon with 90-degree rotation animation on expand, Folder icon (blue), click to toggle `isExpanded` state
- Files: File icon, filename, formatted size, and a hover-visible action tray with Copy URL, Info (metadata popover), and Delete (Trash2) buttons
- Copy URL constructs `https://huggingface.co/{type}s/{repoId}/blob/main/{path}` and writes to clipboard with a 2-second "Copied!" visual
- Metadata popover shows path, size, and OID (SHA) inline below the file row
- Indent: `depth * 16 + 8` px left padding

**RepoBrowserPage.tsx** — Updated to integrate `useRepoFiles` with loading/error states. Files tab renders `<FileTree>`. Delete Repository danger button in header.

**Navigation wiring:**
- `ModelsPage` and `DatasetsPage` accept `onRepoSelect?: (repoId, repoType) => void`
- `handleRepoClick` now calls `onRepoSelect` after writing recent preference
- `AppShell.ContentArea` accepts `onRepoSelect` and threads `navigateToRepo` down

### Task 2: Deletion Dialogs (commit 6db4d48)

**FileActions.tsx** — Two confirmation dialogs:

`DeleteFileDialog` (default export):
- AlertDialog with title "Delete {filename}?"
- Description explains it creates a commit (cannot be undone)
- Delete button calls `deleteFileAction`, then `invalidateQueries(['repo-files', repoId])`
- Loading state on Delete button during API call

`DeleteRepoDialog` (named export):
- AlertDialog with typed-name confirmation gate (GitHub pattern)
- Input must match full `repoId` exactly before Delete button is enabled
- On confirm: calls `deleteRepoAction`, invalidates models/datasets/repos caches
- `onDeleted` triggers `onBack` to navigate away from the now-deleted repo

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- [x] src/routes/repo-browser/FileTree.tsx
- [x] src/routes/repo-browser/FileTreeNode.tsx
- [x] src/routes/repo-browser/FileActions.tsx
- [x] src/routes/repo-browser/RepoBrowserPage.tsx (updated)

### Commits Exist
- e492fde: feat(03-04): build hierarchical file tree browser with expand/collapse and actions
- 6db4d48: feat(03-04): file and repo deletion with confirmation dialogs

## Self-Check: PASSED
