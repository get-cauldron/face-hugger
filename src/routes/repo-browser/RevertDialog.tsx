import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../../components/ui/alert-dialog';
import { computeRevertDiff, executeRevert, type FileDiff } from './revertUtils';
import { useAuthStore } from '../../stores/authStore';

interface RevertDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoId: string;
  repoType: 'model' | 'dataset';
  targetOid: string;
  commitTitle: string;
  onReverted: () => void;
}

function DiffSummary({ diffs }: { diffs: FileDiff[] }) {
  const toRestore = diffs.filter((d) => d.status === 'added' || d.status === 'modified').length;
  const toDelete = diffs.filter((d) => d.status === 'removed').length;
  const unchanged = diffs.filter((d) => d.status === 'unchanged').length;

  return (
    <div className="text-sm text-muted-foreground space-y-1 py-2">
      {toRestore > 0 && <p>{toRestore} file{toRestore !== 1 ? 's' : ''} to restore</p>}
      {toDelete > 0 && <p>{toDelete} file{toDelete !== 1 ? 's' : ''} to delete</p>}
      {unchanged > 0 && <p>{unchanged} file{unchanged !== 1 ? 's' : ''} unchanged</p>}
    </div>
  );
}

/**
 * RevertCommitDialog — safe revert: creates a new commit matching the target state.
 * No history is lost.
 */
export function RevertCommitDialog({
  open,
  onOpenChange,
  repoId,
  repoType,
  targetOid,
  commitTitle,
  onReverted,
}: RevertDialogBaseProps) {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [diffs, setDiffs] = useState<FileDiff[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shortOid = targetOid.slice(0, 7);

  async function handleConfirm() {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: compute diff
      const computedDiffs = await computeRevertDiff({
        repoId,
        repoType,
        targetRevision: targetOid,
        token,
      });
      setDiffs(computedDiffs);

      // Step 2: execute revert
      await executeRevert({
        repoId,
        repoType,
        targetRevision: targetOid,
        commitTitle: `Revert to ${shortOid}: ${commitTitle}`,
        token,
        diffs: computedDiffs,
      });

      // Step 3: invalidate queries so timeline + file tree refresh
      await queryClient.invalidateQueries({ queryKey: ['repo-files', repoId] });
      await queryClient.invalidateQueries({ queryKey: ['commit-history', repoId] });

      onReverted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!loading) {
      setDiffs(null);
      setError(null);
      onOpenChange(nextOpen);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revert to commit {shortOid}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will create a new commit that restores the repo to match this point. No history
            will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {diffs && <DiffSummary diffs={diffs} />}
        {error && <p className="text-sm text-destructive py-1">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            {loading ? 'Reverting…' : 'Revert'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * RestoreVersionDialog — destructive-looking restore:
 * Creates a new commit that exactly matches the target revision's file tree.
 * Requires the user to type the repo name to confirm.
 */
export function RestoreVersionDialog({
  open,
  onOpenChange,
  repoId,
  repoType,
  targetOid,
  commitTitle,
  onReverted,
}: RevertDialogBaseProps) {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [diffs, setDiffs] = useState<FileDiff[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shortOid = targetOid.slice(0, 7);
  // Match against the short repo name (after last slash)
  const shortRepoName = repoId.includes('/') ? repoId.split('/').pop()! : repoId;
  const confirmed = typedName === shortRepoName;

  async function handleConfirm() {
    if (!token || !confirmed) return;
    setLoading(true);
    setError(null);

    try {
      const computedDiffs = await computeRevertDiff({
        repoId,
        repoType,
        targetRevision: targetOid,
        token,
      });
      setDiffs(computedDiffs);

      await executeRevert({
        repoId,
        repoType,
        targetRevision: targetOid,
        commitTitle: `Restore to ${shortOid}: ${commitTitle}`,
        token,
        diffs: computedDiffs,
      });

      await queryClient.invalidateQueries({ queryKey: ['repo-files', repoId] });
      await queryClient.invalidateQueries({ queryKey: ['commit-history', repoId] });

      onReverted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!loading) {
      setDiffs(null);
      setError(null);
      setTypedName('');
      onOpenChange(nextOpen);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore {shortRepoName} to this version?</AlertDialogTitle>
          <AlertDialogDescription>
            This will create a new commit that makes the repo match its state at commit{' '}
            <span className="font-mono">{shortOid}</span>. All files added after this commit will
            be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {diffs && <DiffSummary diffs={diffs} />}

        <div className="py-2">
          <p className="text-sm text-muted-foreground mb-1">
            Type <span className="font-mono font-medium text-foreground">{shortRepoName}</span> to
            confirm:
          </p>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={shortRepoName}
            disabled={loading}
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>

        {error && <p className="text-sm text-destructive py-1">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !confirmed}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Restoring…' : 'Restore to this version'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
