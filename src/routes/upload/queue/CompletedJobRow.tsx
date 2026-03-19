import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useUploadStore } from '../../../stores/uploadStore';
import type { UploadJob } from '../../../commands/upload';

const STATE_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  done: { label: 'Done', color: 'text-green-600 bg-green-500/10' },
  failed: { label: 'Failed', color: 'text-red-600 bg-red-500/10' },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground bg-muted' },
};

interface Props {
  job: UploadJob;
}

export default function CompletedJobRow({ job }: Props) {
  const { jobs, setJobs } = useUploadStore();

  function handleRemove() {
    setJobs(jobs.filter((j) => j.id !== job.id));
  }

  const config = STATE_CONFIG[job.state] ?? { label: job.state, color: 'text-muted-foreground bg-muted' };

  const errorText = job.last_error
    ? job.last_error.length > 80
      ? job.last_error.slice(0, 80) + '…'
      : job.last_error
    : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
      {/* File name */}
      <span
        className="flex-1 text-sm truncate text-muted-foreground"
        title={job.file_path}
      >
        {job.file_name}
      </span>

      {/* Error message (failed only) */}
      {errorText && (
        <span
          className="text-xs text-red-500 truncate max-w-[200px] shrink-0"
          title={job.last_error ?? undefined}
        >
          {errorText}
        </span>
      )}

      {/* Repo */}
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block truncate max-w-[120px]">
        {job.repo_id}
      </span>

      {/* State badge */}
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${config.color}`}>
        {config.label}
      </span>

      {/* Remove */}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Remove from list"
        onClick={handleRemove}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
