import { useState, useMemo } from 'react';
import { FolderOpen, RefreshCw, Upload, Search } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir, stat } from '@tauri-apps/plugin-fs';
import { listFiles } from '@huggingface/hub';
import { Button } from '../../components/ui/button';
import { useModels, useDatasets } from '../../queries/useRepos';
import { useAuthStore } from '../../stores/authStore';
import { enqueueUpload } from '../../commands/upload';
import { formatBytes } from '../../lib/repoUtils';
import type { RepoItem } from '../../queries/useRepos';

type DiffStatus = 'new' | 'changed' | 'unchanged' | 'remote-only';

interface DiffEntry {
  relativePath: string;
  absolutePath: string;
  status: DiffStatus;
  localSize: number | null;
  remoteSize: number | null;
  selected: boolean;
}

async function walkDir(
  folderPath: string,
  basePath: string,
  entries: Array<{ relPath: string; absPath: string }>
) {
  const items = await readDir(folderPath);
  for (const item of items) {
    const absPath = `${folderPath}/${item.name}`;
    const relPath = basePath ? `${basePath}/${item.name}` : item.name;
    if (item.isDirectory) {
      await walkDir(absPath, relPath, entries);
    } else if (item.isFile) {
      entries.push({ relPath, absPath });
    }
  }
}

type SyncState =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'diff'; entries: DiffEntry[] }
  | { phase: 'queuing'; total: number; done: number }
  | { phase: 'done'; queued: number };

export default function FolderSync() {
  const { data: models = [] } = useModels();
  const { data: datasets = [] } = useDatasets();
  const { token } = useAuthStore();

  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [syncState, setSyncState] = useState<SyncState>({ phase: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const allRepos = useMemo(() => {
    const combined = [...models, ...datasets];
    combined.sort((a, b) => {
      if (a.lastModified > b.lastModified) return -1;
      if (a.lastModified < b.lastModified) return 1;
      return 0;
    });
    return combined;
  }, [models, datasets]);

  const filteredRepos = useMemo(() => {
    if (!repoSearch.trim()) return allRepos;
    const q = repoSearch.toLowerCase();
    return allRepos.filter(
      (r) => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    );
  }, [allRepos, repoSearch]);

  async function handleSelectFolder() {
    const result = await openDialog({ directory: true, multiple: false });
    if (typeof result === 'string') {
      setFolderPath(result);
      // Reset any previous diff when folder changes
      if (syncState.phase === 'diff') {
        setSyncState({ phase: 'idle' });
      }
    }
  }

  async function handleCompare() {
    if (!folderPath || !selectedRepo || !token) return;
    setError(null);
    setSyncState({ phase: 'scanning' });

    try {
      // 1. Walk local folder
      const localEntries: Array<{ relPath: string; absPath: string }> = [];
      await walkDir(folderPath, '', localEntries);

      // Get local file sizes
      const localMap = new Map<string, { absPath: string; size: number }>();
      for (const entry of localEntries) {
        try {
          const info = await stat(entry.absPath);
          localMap.set(entry.relPath, { absPath: entry.absPath, size: info.size ?? 0 });
        } catch {
          localMap.set(entry.relPath, { absPath: entry.absPath, size: 0 });
        }
      }

      // 2. List remote files
      const remoteMap = new Map<string, number>();
      try {
        for await (const file of listFiles({
          repo: { type: selectedRepo.type as 'model' | 'dataset', name: selectedRepo.id },
          recursive: true,
          accessToken: token,
        })) {
          remoteMap.set(file.path, (file as any).size ?? 0);
        }
      } catch {
        // Repo may be empty — treat as no remote files
      }

      // 3. Build diff
      const diffEntries: DiffEntry[] = [];

      // Local files
      for (const [relPath, local] of localMap.entries()) {
        const remoteSize = remoteMap.get(relPath);
        let status: DiffStatus;
        if (remoteSize === undefined) {
          status = 'new';
        } else if (remoteSize !== local.size) {
          status = 'changed';
        } else {
          status = 'unchanged';
        }
        diffEntries.push({
          relativePath: relPath,
          absolutePath: local.absPath,
          status,
          localSize: local.size,
          remoteSize: remoteSize ?? null,
          selected: status === 'new' || status === 'changed',
        });
      }

      // Remote-only files
      for (const [remPath, remSize] of remoteMap.entries()) {
        if (!localMap.has(remPath)) {
          diffEntries.push({
            relativePath: remPath,
            absolutePath: '',
            status: 'remote-only',
            localSize: null,
            remoteSize: remSize,
            selected: false,
          });
        }
      }

      // Sort: new/changed first, then unchanged, then remote-only
      const order: Record<DiffStatus, number> = {
        new: 0,
        changed: 1,
        unchanged: 2,
        'remote-only': 3,
      };
      diffEntries.sort((a, b) => order[a.status] - order[b.status]);

      setSyncState({ phase: 'diff', entries: diffEntries });
    } catch (err: any) {
      setError(err?.message ?? 'Comparison failed');
      setSyncState({ phase: 'idle' });
    }
  }

  function toggleEntry(relPath: string) {
    if (syncState.phase !== 'diff') return;
    setSyncState({
      phase: 'diff',
      entries: syncState.entries.map((e) =>
        e.relativePath === relPath && e.status !== 'remote-only'
          ? { ...e, selected: !e.selected }
          : e
      ),
    });
  }

  function toggleAll(checked: boolean) {
    if (syncState.phase !== 'diff') return;
    setSyncState({
      phase: 'diff',
      entries: syncState.entries.map((e) =>
        e.status !== 'remote-only' ? { ...e, selected: checked } : e
      ),
    });
  }

  async function handleSync() {
    if (syncState.phase !== 'diff' || !selectedRepo) return;
    const toUpload = syncState.entries.filter((e) => e.selected && e.absolutePath);
    if (toUpload.length === 0) return;

    const folderName = folderPath?.replace(/\\/g, '/').split('/').pop() ?? 'folder';
    const commitMessage = `Sync folder ${folderName} via Face Hugger`;

    setSyncState({ phase: 'queuing', total: toUpload.length, done: 0 });

    try {
      for (let i = 0; i < toUpload.length; i++) {
        const entry = toUpload[i];
        await enqueueUpload({
          filePath: entry.absolutePath,
          repoId: selectedRepo.id,
          repoType: selectedRepo.type,
          commitMessage,
        });
        setSyncState({ phase: 'queuing', total: toUpload.length, done: i + 1 });
      }
      setSyncState({ phase: 'done', queued: toUpload.length });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to queue files');
      setSyncState({ phase: 'idle' });
    }
  }

  const STATUS_CONFIG: Record<DiffStatus, { label: string; color: string }> = {
    new: { label: 'New', color: 'text-green-600 bg-green-500/10' },
    changed: { label: 'Changed', color: 'text-amber-600 bg-amber-500/10' },
    unchanged: { label: 'Unchanged', color: 'text-muted-foreground bg-muted' },
    'remote-only': { label: 'Remote Only', color: 'text-blue-600 bg-blue-500/10' },
  };

  const selectedCount =
    syncState.phase === 'diff'
      ? syncState.entries.filter((e) => e.selected).length
      : 0;
  const selectedBytes =
    syncState.phase === 'diff'
      ? syncState.entries
          .filter((e) => e.selected)
          .reduce((sum, e) => sum + (e.localSize ?? 0), 0)
      : 0;

  const allSelected =
    syncState.phase === 'diff' &&
    syncState.entries
      .filter((e) => e.status !== 'remote-only')
      .every((e) => e.selected);

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Compare a local folder to a remote repository and upload only new or changed files.
      </p>

      {/* Step 1: Select folder */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Local Folder</label>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectFolder}>
            <FolderOpen className="w-4 h-4 mr-1.5" />
            {folderPath ? 'Change Folder' : 'Select Folder'}
          </Button>
          {folderPath && (
            <span
              className="text-sm text-muted-foreground truncate max-w-xs"
              title={folderPath}
            >
              {folderPath}
            </span>
          )}
        </div>
      </div>

      {/* Step 2: Select repo */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Target Repository</label>
        <div className="relative mb-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Filter repositories…"
            value={repoSearch}
            onChange={(e) => setRepoSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border rounded-md p-1">
          {filteredRepos.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No repositories found</p>
          )}
          {filteredRepos.map((repo) => (
            <button
              key={repo.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                selectedRepo?.id === repo.id
                  ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                  : 'hover:bg-muted'
              }`}
              onClick={() => setSelectedRepo(repo)}
            >
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-medium shrink-0 ${
                  repo.type === 'model'
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-amber-500/10 text-amber-600'
                }`}
              >
                {repo.type}
              </span>
              <span className="truncate flex-1">{repo.id}</span>
            </button>
          ))}
        </div>
        {selectedRepo && (
          <p className="text-xs text-muted-foreground">
            Selected: <span className="text-foreground">{selectedRepo.id}</span>
          </p>
        )}
      </div>

      {/* Compare button */}
      <div>
        <Button
          onClick={handleCompare}
          disabled={!folderPath || !selectedRepo || syncState.phase === 'scanning'}
          size="sm"
        >
          {syncState.phase === 'scanning' ? (
            <>
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Compare
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-500/10 rounded-md px-3 py-2">{error}</p>
      )}

      {/* Diff table */}
      {syncState.phase === 'diff' && (
        <div className="flex flex-col gap-2">
          {/* Select all row */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                className="rounded"
              />
              Select all uploadable
            </label>
            <span className="text-xs text-muted-foreground">
              {syncState.entries.length} files
            </span>
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="w-6 px-2 py-2"></th>
                  <th className="text-left px-2 py-2 font-medium text-xs">File</th>
                  <th className="text-left px-2 py-2 font-medium text-xs">Status</th>
                  <th className="text-right px-2 py-2 font-medium text-xs">Local</th>
                  <th className="text-right px-2 py-2 font-medium text-xs">Remote</th>
                </tr>
              </thead>
              <tbody>
                {syncState.entries.map((entry) => {
                  const cfg = STATUS_CONFIG[entry.status];
                  return (
                    <tr
                      key={entry.relativePath}
                      className="border-t hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-2 py-1.5 text-center">
                        {entry.status !== 'remote-only' && (
                          <input
                            type="checkbox"
                            checked={entry.selected}
                            onChange={() => toggleEntry(entry.relativePath)}
                            className="rounded"
                          />
                        )}
                      </td>
                      <td
                        className="px-2 py-1.5 text-xs truncate max-w-[240px]"
                        title={entry.relativePath}
                      >
                        {entry.relativePath}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right tabular-nums text-muted-foreground">
                        {entry.localSize !== null ? formatBytes(entry.localSize) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right tabular-nums text-muted-foreground">
                        {entry.remoteSize !== null ? formatBytes(entry.remoteSize) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sync button */}
          <Button
            onClick={handleSync}
            disabled={selectedCount === 0}
            className="self-start"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Sync {selectedCount} file{selectedCount !== 1 ? 's' : ''} ({formatBytes(selectedBytes)})
          </Button>
        </div>
      )}

      {/* Queuing progress */}
      {syncState.phase === 'queuing' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Queuing {syncState.done}/{syncState.total}…
        </div>
      )}

      {/* Done */}
      {syncState.phase === 'done' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-green-600 bg-green-500/10 rounded-md px-3 py-2">
            Queued {syncState.queued} file{syncState.queued !== 1 ? 's' : ''} for upload.
            Switch to the Queue tab to monitor progress.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              setSyncState({ phase: 'idle' });
              setFolderPath(null);
              setSelectedRepo(null);
            }}
          >
            Start New Sync
          </Button>
        </div>
      )}
    </div>
  );
}
