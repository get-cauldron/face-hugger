import { useState, useMemo } from 'react';
import { Search, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useModels, useDatasets } from '../../queries/useRepos';
import { enqueueUpload } from '../../commands/upload';
import type { RepoItem } from '../../queries/useRepos';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  droppedPaths: string[];
  onConfirm: (repoId: string, repoType: string) => void;
}

function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
}

export default function MiniRepoPicker({ open, onOpenChange, droppedPaths, onConfirm }: Props) {
  const { data: models = [] } = useModels();
  const { data: datasets = [] } = useDatasets();
  const [search, setSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [commitMessage, setCommitMessage] = useState('Add files via Face Hugger');
  const [enqueueing, setEnqueueing] = useState(false);

  const allRepos = useMemo(() => {
    const combined = [...models, ...datasets];
    combined.sort((a, b) => {
      if (a.lastModified > b.lastModified) return -1;
      if (a.lastModified < b.lastModified) return 1;
      return 0;
    });
    return combined;
  }, [models, datasets]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allRepos;
    const q = search.toLowerCase();
    return allRepos.filter(
      (r) => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    );
  }, [allRepos, search]);

  async function handleConfirm() {
    if (!selectedRepo || droppedPaths.length === 0) return;
    setEnqueueing(true);
    try {
      for (const filePath of droppedPaths) {
        await enqueueUpload({
          filePath,
          repoId: selectedRepo.id,
          repoType: selectedRepo.type,
          commitMessage,
        });
      }
      onConfirm(selectedRepo.id, selectedRepo.type);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to enqueue files:', err);
    } finally {
      setEnqueueing(false);
    }
  }

  function handleClose() {
    setSearch('');
    setSelectedRepo(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Upload to Repository</DialogTitle>
          {droppedPaths.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {droppedPaths.length === 1
                ? `1 file: ${basename(droppedPaths[0])}`
                : `${droppedPaths.length} files dropped`}
            </p>
          )}
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Filter repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Repo list */}
        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto -mx-1 px-1">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No repositories found
            </p>
          )}
          {filtered.map((repo) => (
            <button
              key={repo.id}
              className={`flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm transition-colors ${
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
              {repo.private && (
                <span className="text-[10px] text-muted-foreground shrink-0">private</span>
              )}
            </button>
          ))}
        </div>

        {/* Commit message */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Commit message</label>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={enqueueing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedRepo || enqueueing || droppedPaths.length === 0}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            {enqueueing
              ? 'Queueing…'
              : selectedRepo
              ? `Upload to ${selectedRepo.name}`
              : 'Select a repo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
