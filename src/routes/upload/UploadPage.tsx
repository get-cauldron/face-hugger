import { useEffect } from 'react';
import { useUploadStore } from '../../stores/uploadStore';
import { startUploadMonitoring, listUploads } from '../../commands/upload';
import UploadWizard from './wizard/UploadWizard';
import { Button } from '../../components/ui/button';
import { Plus } from 'lucide-react';

export default function UploadPage() {
  const { jobs, setJobs, updateProgress } = useUploadStore();

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
    (j) => j.state !== 'done' && j.state !== 'cancelled'
  );
  const hasActiveUploads = activeJobs.length > 0;

  if (!hasActiveUploads) {
    return (
      <div className="flex flex-col h-full">
        <h1 className="text-2xl font-bold text-foreground mb-6">Upload</h1>
        <div className="flex-1">
          <UploadWizard />
        </div>
      </div>
    );
  }

  // Queue view with a "New Upload" button
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Upload Queue</h1>
        <Button
          size="sm"
          onClick={() => {
            // Reset to show wizard by clearing jobs (queue view handles this via UploadPage re-render)
            // For now we navigate to wizard via a local state change
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Upload
        </Button>
      </div>

      {/* Queue placeholder — built in Plan 03 */}
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <p className="text-sm">Upload queue — coming in plan 03-03</p>
        <p className="text-xs mt-1">{activeJobs.length} active upload{activeJobs.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}
