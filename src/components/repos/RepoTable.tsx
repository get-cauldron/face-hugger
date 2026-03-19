import type { RepoItem } from '../../queries/useRepos';

function relativeTime(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;
  const diffYears = Math.floor(diffMonths / 12);
  if (diffYears === 1) return '1 year ago';
  return `${diffYears} years ago`;
}

interface RepoTableProps {
  repos: RepoItem[];
  onRepoClick?: (repo: RepoItem) => void;
}

export default function RepoTable({ repos, onRepoClick }: RepoTableProps) {
  return (
    <div className="flex flex-col divide-y divide-[var(--color-border)]">
      {/* Table header */}
      <div className="flex items-center py-2 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">
        <span className="flex-1">Name</span>
        <span className="w-20 text-center">Type</span>
        <span className="w-20 text-center">Visibility</span>
        <span className="w-24 text-right">Downloads</span>
        <span className="w-28 text-right">Last Modified</span>
      </div>

      {/* Table rows */}
      {repos.map((repo) => (
        <div
          key={repo.id}
          className="flex items-center py-3 px-4 hover:bg-secondary/50 rounded-lg cursor-pointer transition-colors"
          onClick={() => onRepoClick?.(repo)}
        >
          <span className="flex-1 font-medium text-foreground text-sm truncate pr-4">
            {repo.name || repo.id}
          </span>
          <span className="w-20 text-center">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                repo.type === 'model'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {repo.type === 'model' ? 'Model' : 'Dataset'}
            </span>
          </span>
          <span className="w-20 text-center">
            <span
              className={`text-xs ${
                repo.private ? 'text-amber-400' : 'text-green-400'
              }`}
            >
              {repo.private ? 'Private' : 'Public'}
            </span>
          </span>
          <span className="w-24 text-right text-sm text-muted-foreground">
            {repo.downloads.toLocaleString()}
          </span>
          <span className="w-28 text-right text-xs text-muted-foreground">
            {relativeTime(repo.lastModified)}
          </span>
        </div>
      ))}
    </div>
  );
}
