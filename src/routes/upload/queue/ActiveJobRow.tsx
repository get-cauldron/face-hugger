import { useState } from 'react';
import { Pause, Play, X, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Progress } from '../../../components/ui/progress';
import { useUploadStore } from '../../../stores/uploadStore';
import { pauseUpload, resumeUpload, cancelUpload } from '../../../commands/upload';
import { formatBytes, formatSpeed, formatEta } from '../../../lib/repoUtils';
import type { UploadJob } from '../../../commands/upload';

const STATE_LABELS: Record<string, string> = {
  hashing: 'Hashing',
  uploading: 'Uploading',
  committing: 'Committing',
  paused: 'Paused',
};

const STATE_COLORS: Record<string, string> = {
  hashing: 'text-blue-500 bg-blue-500/10',
  uploading: 'text-primary bg-primary/10',
  committing: 'text-amber-500 bg-amber-500/10',
  paused: 'text-muted-foreground bg-muted',
};

interface Props {
  job: UploadJob;
}

export default function ActiveJobRow({ job }: Props) {
  const { progressMap, setJobs } = useUploadStore();
  const progress = progressMap[job.id];
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState<'pause' | 'resume' | 'cancel' | null>(null);

  const pct = progress && progress.total_bytes > 0
    ? Math.round((progress.bytes_sent / progress.total_bytes) * 100)
    : (job.total_bytes > 0 ? Math.round((job.bytes_confirmed / job.total_bytes) * 100) : 0);

  const bytesSent = progress?.bytes_sent ?? job.bytes_confirmed;
  const totalBytes = progress?.total_bytes ?? job.total_bytes;
  const speedBps = progress?.speed_bps ?? 0;
  const etaSec = progress?.eta_seconds ?? 0;

  const isPaused = job.state === 'paused';

  async function handlePause() {
    setLoading('pause');
    try {
      await pauseUpload(job.id);
    } catch (_) {
      // ignore — state will update via progress events
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

  const stateLabel = STATE_LABELS[job.state] ?? job.state;
  const stateColor = STATE_COLORS[job.state] ?? 'text-muted-foreground bg-muted';

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border bg-card">
      {/* Row 1: filename + state badge + actions */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="flex-1 text-sm font-medium truncate"
          title={job.file_path}
        >
          {job.file_name}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${stateColor}`}>
          {stateLabel}
        </span>
        {isPaused ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Resume upload"
            onClick={handleResume}
            disabled={loading !== null}
          >
            {loading === 'resume' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          </Button>
        ) : (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Pause upload"
            onClick={handlePause}
            disabled={loading !== null}
          >
            {loading === 'pause' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
          </Button>
        )}
        {confirming ? (
          <Button
            size="sm"
            variant="destructive"
            className="text-xs h-7 px-2"
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
            {loading === 'cancel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>

      {/* Row 2: target repo */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide text-[10px]">
          {job.repo_type}
        </span>
        <span className="truncate">{job.repo_id}</span>
      </div>

      {/* Row 3: progress bar */}
      <Progress value={pct} className="gap-0" />

      {/* Row 4: speed / ETA / bytes */}
      <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
        <span>{speedBps > 0 ? formatSpeed(speedBps) : '-- B/s'}</span>
        <span>ETA {etaSec > 0 ? formatEta(etaSec) : '--'}</span>
        <span>{formatBytes(bytesSent)} / {formatBytes(totalBytes)}</span>
      </div>
    </div>
  );
}
