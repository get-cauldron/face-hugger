import { useState } from 'react';
import { type RepoItem } from '../../../queries/useRepos';
import { type FileEntry } from './StepFilePicker';
import { formatBytes } from '../../../lib/repoUtils';
import { enqueueUpload } from '../../../commands/upload';
import { useUploadStore } from '../../../stores/uploadStore';
import { Button } from '../../../components/ui/button';
import { Loader2 } from 'lucide-react';

interface StepReviewProps {
  selectedRepo: RepoItem;
  files: FileEntry[];
  commitMessage: string;
  onCommitMessageChange: (msg: string) => void;
  onUploadComplete: () => void;
}

export default function StepReview({
  selectedRepo,
  files,
  commitMessage,
  onCommitMessageChange,
  onUploadComplete,
}: StepReviewProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setWizardOpen = useUploadStore((s) => s.setWizardOpen);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  async function handleUpload() {
    if (!commitMessage.trim()) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const file of files) {
        await enqueueUpload({
          filePath: file.path,
          repoId: selectedRepo.id,
          repoType: selectedRepo.type,
          commitMessage: commitMessage.trim(),
        });
      }
      setWizardOpen(false);
      onUploadComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enqueue uploads');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Summary card */}
      <div className="bg-secondary/50 border border-border rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Upload Summary</h3>

        {/* Target repo */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Target Repository</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{selectedRepo.id}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                selectedRepo.type === 'model'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {selectedRepo.type === 'model' ? 'Model' : 'Dataset'}
            </span>
          </div>
        </div>

        {/* File count */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Files</span>
          <span className="text-sm text-foreground">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Total size */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total Size</span>
          <span className="text-sm text-foreground">{formatBytes(totalSize)}</span>
        </div>

        {/* File list preview (first 5) */}
        {files.length > 0 && (
          <div className="border-t border-border/50 pt-2">
            <p className="text-xs text-muted-foreground mb-1.5">Files to upload:</p>
            <div className="flex flex-col gap-0.5">
              {files.slice(0, 5).map((file) => (
                <div key={file.path} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate max-w-[70%]">{file.name}</span>
                  <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                </div>
              ))}
              {files.length > 5 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  +{files.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Commit message */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Commit Message <span className="text-destructive">*</span>
        </label>
        <textarea
          value={commitMessage}
          onChange={(e) => onCommitMessageChange(e.target.value)}
          placeholder="Add files via Face Hugger"
          rows={3}
          className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-ring resize-none"
        />
        {!commitMessage.trim() && (
          <p className="text-xs text-muted-foreground">Required to proceed</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Upload button */}
      <div className="mt-auto">
        <Button
          className="w-full"
          onClick={handleUpload}
          disabled={isUploading || !commitMessage.trim()}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}
