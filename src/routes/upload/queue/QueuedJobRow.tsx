import { useState } from 'react';
import { Star, X, Play, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useUploadStore } from '../../../stores/uploadStore';
import {
  cancelUpload,
  resumeUpload,
  setUploadPriority,
  listUploads,
} from '../../../commands/upload';
import type { UploadJob } from '../../../commands/upload';

interface Props {
  job: UploadJob;
}

export default function QueuedJobRow({ job }: Props) {
  const { setJobs } = useUploadStore();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState<'star' | 'resume' | 'cancel' | null>(null);

  const isPaused = job.state === 'paused';

  async function handleTogglePriority() {
    setLoading('star');
    try {
      await setUploadPriority(job.id, !job.priority);
      const updated = await listUploads();
      setJobs(updated);
    } catch (_) {
      // ignore
    } finally {
      setLoading(null);
    }
  }

  async function handleResume() {
    setLoading('resume');
    try {
      await resumeUpload(job.id);
    } catch (_) {
      // ignore
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setLoading('cancel');
    setConfirming(false);
    try {
      await cancelUpload(job.id);
    } catch (_) {
      // ignore
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
      {/* Priority star */}
      <button
        className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
        onClick={handleTogglePriority}
        disabled={loading === 'star'}
        aria-label={job.priority ? 'Remove priority' : 'Move to front of queue'}
        title={job.priority ? 'Remove priority' : 'Move to front of queue (star to prioritize)'}
      >
        {loading === 'star' ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <Star
            className={`w-4 h-4 transition-colors ${
              job.priority
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground hover:text-yellow-400'
            }`}
          />
        )}
      </button>

      {/* File name */}
      <span
        className="flex-1 text-sm truncate"
        title={job.file_path}
      >
        {job.file_name}
      </span>

      {/* Repo type + name */}
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block truncate max-w-[140px]">
        {job.repo_id}
      </span>

      {/* Paused badge */}
      {isPaused && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
          Paused
        </span>
      )}

      {/* Resume (if paused) */}
      {isPaused && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Resume upload"
          onClick={handleResume}
          disabled={loading !== null}
        >
          {loading === 'resume' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </Button>
      )}

      {/* Cancel */}
      {confirming ? (
        <Button
          size="sm"
          variant="destructive"
          className="text-xs h-7 px-2 shrink-0"
          onClick={handleCancel}
          disabled={loading === 'cancel'}
        >
          Confirm cancel
        </Button>
      ) : (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Cancel upload"
          onClick={handleCancel}
          disabled={loading !== null}
        >
          {loading === 'cancel' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}
