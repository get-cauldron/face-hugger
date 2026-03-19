import { useCommitHistory } from '../../queries/useCommitHistory';
import CommitRow from './CommitRow';

interface CommitTimelineProps {
  repoId: string;
  repoType: 'model' | 'dataset';
}

export default function CommitTimeline({ repoId, repoType }: CommitTimelineProps) {
  const { data: commits, isLoading, error } = useCommitHistory(repoId, repoType);

  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-3 h-3 mt-1 rounded-full bg-secondary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-secondary rounded w-3/4" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">Failed to load commit history.</p>
        <p className="text-xs mt-1">{String(error)}</p>
      </div>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No commits yet.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-4 border-l-2 border-border">
      {commits.map((commit, index) => (
        <CommitRow
          key={commit.oid}
          commit={commit}
          repoId={repoId}
          repoType={repoType}
          isLatest={index === 0}
        />
      ))}
    </div>
  );
}
