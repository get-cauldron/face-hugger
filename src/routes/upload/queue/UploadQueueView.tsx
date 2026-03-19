import { useState } from 'react';
import { ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useUploadStore } from '../../../stores/uploadStore';
import ActiveJobRow from './ActiveJobRow';
import QueuedJobRow from './QueuedJobRow';
import CompletedJobRow from './CompletedJobRow';
import type { UploadJob } from '../../../commands/upload';

interface SectionProps {
  title: string;
  jobs: UploadJob[];
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  children: (job: UploadJob) => React.ReactNode;
}

function Section({ title, jobs, defaultOpen = true, headerRight, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (jobs.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        className="flex items-center gap-1.5 py-1 w-full text-left group"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground flex-1">
          {title} ({jobs.length})
        </span>
        {headerRight && (
          <span onClick={(e) => e.stopPropagation()}>{headerRight}</span>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 pl-1">
          {jobs.map((job) => (
            <div key={job.id}>{children(job)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  onStartUpload?: () => void;
}

export default function UploadQueueView({ onStartUpload }: Props) {
  const { jobs, setJobs } = useUploadStore();

  const activeJobs = jobs.filter((j) =>
    ['hashing', 'uploading', 'committing'].includes(j.state)
  );
  const queuedJobs = jobs.filter((j) =>
    ['pending', 'paused'].includes(j.state)
  );
  const completedJobs = jobs.filter((j) =>
    ['done', 'failed', 'cancelled'].includes(j.state)
  );

  const isEmpty = activeJobs.length === 0 && queuedJobs.length === 0 && completedJobs.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <Upload className="w-10 h-10 opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium">No uploads yet</p>
          <p className="text-xs mt-0.5">Start an upload to see it here</p>
        </div>
        {onStartUpload && (
          <Button size="sm" variant="outline" onClick={onStartUpload}>
            Start Upload
          </Button>
        )}
      </div>
    );
  }

  function clearCompleted() {
    setJobs(jobs.filter((j) => !['done', 'failed', 'cancelled'].includes(j.state)));
  }

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Active Uploads"
        jobs={activeJobs}
        defaultOpen={true}
      >
        {(job) => <ActiveJobRow job={job} />}
      </Section>

      <Section
        title="Queue"
        jobs={queuedJobs}
        defaultOpen={true}
      >
        {(job) => <QueuedJobRow job={job} />}
      </Section>

      <Section
        title="Completed"
        jobs={completedJobs}
        defaultOpen={false}
        headerRight={
          completedJobs.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-6 px-2 text-muted-foreground"
              onClick={clearCompleted}
            >
              Clear All
            </Button>
          ) : undefined
        }
      >
        {(job) => <CompletedJobRow job={job} />}
      </Section>
    </div>
  );
}
