import { listFiles, commit } from '@huggingface/hub';
import type { ListFileEntry } from '../../queries/useRepoFiles';

export interface FileDiff {
  path: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  currentSize?: number;
  targetSize?: number;
}

/**
 * Compare file tree at targetRevision to current HEAD.
 * Returns the list of diffs needed to make current match target.
 */
export async function computeRevertDiff(params: {
  repoId: string;
  repoType: 'model' | 'dataset';
  targetRevision: string;
  token: string;
}): Promise<FileDiff[]> {
  const repo = { name: params.repoId, type: params.repoType };

  // Get file tree at target revision
  const targetFiles = new Map<string, ListFileEntry>();
  for await (const f of listFiles({
    repo,
    recursive: true,
    revision: params.targetRevision,
    accessToken: params.token,
  })) {
    if (f.type === 'file') targetFiles.set(f.path, f);
  }

  // Get current file tree (HEAD)
  const currentFiles = new Map<string, ListFileEntry>();
  for await (const f of listFiles({ repo, recursive: true, accessToken: params.token })) {
    if (f.type === 'file') currentFiles.set(f.path, f);
  }

  const diffs: FileDiff[] = [];

  // Files in target: compare to current
  for (const [path, targetEntry] of targetFiles) {
    const currentEntry = currentFiles.get(path);
    if (!currentEntry) {
      diffs.push({ path, status: 'added', targetSize: targetEntry.size });
    } else if (currentEntry.oid !== targetEntry.oid) {
      diffs.push({
        path,
        status: 'modified',
        currentSize: currentEntry.size,
        targetSize: targetEntry.size,
      });
    } else {
      diffs.push({
        path,
        status: 'unchanged',
        currentSize: currentEntry.size,
        targetSize: targetEntry.size,
      });
    }
  }

  // Files in current but not in target → need to be deleted
  for (const [path, currentEntry] of currentFiles) {
    if (!targetFiles.has(path)) {
      diffs.push({ path, status: 'removed', currentSize: currentEntry.size });
    }
  }

  return diffs;
}

/**
 * Execute the revert/restore by creating a new commit that matches the target revision's file tree.
 * For files that need to be added/modified: use the HF URL at the target revision as content source.
 * For files that need to be deleted: add delete operations.
 * Uses HF server-side URL resolution — no large file downloads on the client.
 */
export async function executeRevert(params: {
  repoId: string;
  repoType: 'model' | 'dataset';
  targetRevision: string;
  commitTitle: string;
  token: string;
  diffs: FileDiff[];
}): Promise<void> {
  const repo = { name: params.repoId, type: params.repoType };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = [];

  for (const diff of params.diffs) {
    if (diff.status === 'added' || diff.status === 'modified') {
      // Use HF URL to the file at target revision — hub fetches content server-side
      const repoTypeSegment = params.repoType === 'model' ? 'models' : 'datasets';
      const fileUrl = `https://huggingface.co/${repoTypeSegment}/${params.repoId}/resolve/${params.targetRevision}/${diff.path}`;
      operations.push({
        operation: 'addOrUpdate',
        path: diff.path,
        content: new URL(fileUrl),
      });
    } else if (diff.status === 'removed') {
      operations.push({
        operation: 'delete',
        path: diff.path,
      });
    }
    // 'unchanged' → no operation needed
  }

  if (operations.length === 0) return; // nothing to do

  await commit({
    repo,
    operations,
    title: params.commitTitle,
    accessToken: params.token,
  });
}
