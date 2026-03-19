import { useState } from 'react';
import type { CommitData } from '../../queries/useCommitHistory';
import { RevertCommitDialog, RestoreVersionDialog } from './RevertDialog';

interface CommitRowProps {
  commit: CommitData;
  repoId: string;
  repoType: 'model' | 'dataset';
  isLatest: boolean;
}

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function CommitRow({ commit, repoId, repoType, isLatest }: CommitRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  const shortOid = commit.oid.slice(0, 7);
  const dateStr = commit.date ? relativeTime(new Date(commit.date)) : '';

  function handleCopyOid(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(commit.oid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Timeline connector (drawn via CommitTimeline's border-l, not here) */}

      {/* Timeline dot */}
      <div className="relative z-10 mt-1 shrink-0">
        <div
          className={`w-3 h-3 rounded-full border-2 ${
            isLatest
              ? 'bg-primary border-primary'
              : 'bg-background border-muted-foreground/40'
          }`}
        />
      </div>

      {/* Commit content */}
      <div className="flex-1 min-w-0">
        <button
          className="w-full text-left rounded-md hover:bg-secondary/50 transition-colors p-2 -mx-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start gap-2 flex-wrap">
            <span className="font-medium text-sm truncate flex-1">{commit.title}</span>
            {isLatest && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium shrink-0">
                Latest
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {/* Author */}
            {commit.authors && commit.authors.length > 0 && (
              <div className="flex items-center gap-1">
                {commit.authors[0].avatarUrl && (
                  <img
                    src={commit.authors[0].avatarUrl}
                    alt={commit.authors[0].username}
                    className="w-4 h-4 rounded-full"
                  />
                )}
                <span>{commit.authors[0].username}</span>
              </div>
            )}

            {/* Date */}
            {dateStr && <span>{dateStr}</span>}

            {/* Short OID — monospace, clickable to copy */}
            <button
              className="font-mono text-xs hover:text-foreground transition-colors cursor-pointer"
              onClick={handleCopyOid}
              title={copied ? 'Copied!' : 'Click to copy full OID'}
            >
              {copied ? 'Copied!' : shortOid}
            </button>
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-2 pl-2 border-l-2 border-border">
            {/* Full message if different from title */}
            {commit.message && commit.message !== commit.title && (
              <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">
                {commit.message}
              </p>
            )}

            {/* Action buttons */}
            {!isLatest && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setRevertDialogOpen(true)}
                  className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors cursor-pointer"
                >
                  Revert to this
                </button>
                <button
                  onClick={() => setRestoreDialogOpen(true)}
                  className="text-xs px-3 py-1.5 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors cursor-pointer"
                >
                  Restore to this version
                </button>
              </div>
            )}

            {isLatest && (
              <p className="text-xs text-muted-foreground italic">
                This is the current version of the repo.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Revert dialog */}
      <RevertCommitDialog
        open={revertDialogOpen}
        onOpenChange={setRevertDialogOpen}
        repoId={repoId}
        repoType={repoType}
        targetOid={commit.oid}
        commitTitle={commit.title}
        onReverted={() => {
          setExpanded(false);
          setRevertDialogOpen(false);
        }}
      />

      {/* Restore dialog */}
      <RestoreVersionDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        repoId={repoId}
        repoType={repoType}
        targetOid={commit.oid}
        commitTitle={commit.title}
        onReverted={() => {
          setExpanded(false);
          setRestoreDialogOpen(false);
        }}
      />
    </div>
  );
}
