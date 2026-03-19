import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import { deleteFileAction, deleteRepoAction } from '../../commands/repos';

// ─── DeleteFileDialog ──────────────────────────────────────────────────────────

interface DeleteFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  repoId: string;
  repoType: 'model' | 'dataset';
  onDeleted: () => void;
}

export default function DeleteFileDialog({
  open,
  onOpenChange,
  filePath,
  repoId,
  repoType,
  onDeleted,
}: DeleteFileDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const fileName = filePath.split('/').pop() ?? filePath;

  async function handleDelete() {
    setIsPending(true);
    setError(null);
    try {
      await deleteFileAction({ repoId, repoType, path: filePath });
      await queryClient.invalidateQueries({ queryKey: ['repo-files', repoId] });
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {fileName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will create a new commit removing this file. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive px-1">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── DeleteRepoDialog ──────────────────────────────────────────────────────────

interface DeleteRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoId: string;
  repoType: 'model' | 'dataset';
  onDeleted: () => void;
}

export function DeleteRepoDialog({
  open,
  onOpenChange,
  repoId,
  repoType,
  onDeleted,
}: DeleteRepoDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // The repo name is the part after the owner prefix (e.g. "owner/repo-name" → "repo-name")
  // For typed confirmation, match against the full repoId
  const nameToMatch = repoId;
  const isConfirmed = confirmText === nameToMatch;

  async function handleDelete() {
    if (!isConfirmed) return;
    setIsPending(true);
    setError(null);
    try {
      await deleteRepoAction({ repoId, repoType });
      await queryClient.invalidateQueries({ queryKey: ['repos'] });
      await queryClient.invalidateQueries({ queryKey: ['models'] });
      await queryClient.invalidateQueries({ queryKey: ['datasets'] });
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete repository');
    } finally {
      setIsPending(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmText('');
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {repoId}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action is permanent and irreversible. All files, commits, and history will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-1 space-y-2">
          <label className="text-sm text-muted-foreground">
            Type the repo name to confirm:{' '}
            <span className="font-mono text-foreground font-medium">{nameToMatch}</span>
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={nameToMatch}
            className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive px-1">{error}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleOpenChange(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmed || isPending}
            >
              {isPending ? 'Deleting...' : 'Delete Repository'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
