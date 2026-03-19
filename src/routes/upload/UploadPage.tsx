import { useEffect, useState } from 'react';
import { useUploadStore } from '../../stores/uploadStore';
import { startUploadMonitoring, listUploads, pauseAllUploads } from '../../commands/upload';
import UploadWizard from './wizard/UploadWizard';
import UploadQueueView from './queue/UploadQueueView';
import { Button } from '../../components/ui/button';
import { Plus, PauseCircle, RefreshCw, FolderSync } from 'lucide-react';

type UploadView = 'queue' | 'wizard' | 'folder-sync';

export default function UploadPage() {
  const { jobs, setJobs, updateProgress } = useUploadStore();
  const [view, setView] = useState<UploadView>('queue');
  const [pausingAll, setPausingAll] = useState(false);

  useEffect(() => {
    // Initialize upload monitoring on mount
    startUploadMonitoring((updates) => {
      updateProgress(updates);
    }).catch(() => {
      // monitoring may already be started — silently ignore
    });

    listUploads()
      .then((uploadJobs) => setJobs(uploadJobs))
      .catch(() => {
        // silently ignore — no uploads yet
      });
  }, []);

  const activeJobs = jobs.filter(
    (j) => j.state === 'hashing' || j.state === 'uploading' || j.state === 'committing'
  );
  const hasActiveUploads = activeJobs.length > 0;

  async function handlePauseAll() {
    setPausingAll(true);
    try {
      await pauseAllUploads();
    } catch (_) {
      // ignore
    } finally {
      setPausingAll(false);
    }
  }

  // Show wizard directly if no jobs exist yet
  if (jobs.length === 0 && view === 'queue') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Upload</h1>
        </div>
        <div className="flex-1">
          <UploadWizard />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Upload</h1>
        <div className="flex items-center gap-2">
          {hasActiveUploads && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePauseAll}
              disabled={pausingAll}
            >
              <PauseCircle className="w-4 h-4 mr-1.5" />
              Pause All
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setView('wizard')}
            variant={view === 'wizard' ? 'default' : 'outline'}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Upload
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b pb-0">
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === 'queue'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setView('queue')}
        >
          Queue
          {jobs.length > 0 && (
            <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5 tabular-nums">
              {jobs.filter((j) => !['done', 'failed', 'cancelled'].includes(j.state)).length}
            </span>
          )}
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === 'wizard'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setView('wizard')}
        >
          New Upload
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === 'folder-sync'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setView('folder-sync')}
        >
          <FolderSync className="w-3.5 h-3.5 inline mr-1" />
          Folder Sync
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === 'queue' && (
          <UploadQueueView onStartUpload={() => setView('wizard')} />
        )}
        {view === 'wizard' && (
          <UploadWizard />
        )}
        {view === 'folder-sync' && (
          // FolderSync is imported and wired in Task 2
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <RefreshCw className="w-8 h-8 opacity-30 mb-3" />
            <p className="text-sm">Folder Sync — loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}
