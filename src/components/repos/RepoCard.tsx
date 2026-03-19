import { Download, Heart } from 'lucide-react';
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

interface RepoCardProps {
  repo: RepoItem;
  onClick?: (repo: RepoItem) => void;
}

export default function RepoCard({ repo, onClick }: RepoCardProps) {
  const visibleTags = repo.tags.slice(0, 4);
  const extraTags = repo.tags.length > 4 ? repo.tags.length - 4 : 0;

  return (
    <div
      className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer min-h-[10rem] flex flex-col gap-2"
      onClick={() => onClick?.(repo)}
    >
      {/* Top row: repo name + type badge */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[var(--color-foreground)] text-sm leading-tight break-all">
          {repo.name}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
            repo.type === 'model'
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
              : 'bg-blue-500/20 text-blue-400'
          }`}
        >
          {repo.type === 'model' ? 'Model' : 'Dataset'}
        </span>
      </div>

      {/* Visibility badge */}
      <div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            repo.private
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-green-500/20 text-green-400'
          }`}
        >
          {repo.private ? 'Private' : 'Public'}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
        <span className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          {repo.downloads.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="w-3 h-3" />
          {repo.likes.toLocaleString()}
        </span>
        <span className="ml-auto">{relativeTime(repo.lastModified)}</span>
      </div>

      {/* Tags */}
      {repo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] text-xs px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="text-xs text-[var(--color-muted-foreground)] px-1 py-0.5">
              +{extraTags} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
