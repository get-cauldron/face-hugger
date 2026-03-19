import type { RepoItem } from '../../queries/useRepos';
import RepoCard from './RepoCard';

interface RepoGridProps {
  repos: RepoItem[];
  onRepoClick?: (repo: RepoItem) => void;
}

export default function RepoGrid({ repos, onRepoClick }: RepoGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {repos.map((repo) => (
        <RepoCard key={repo.id} repo={repo} onClick={onRepoClick} />
      ))}
    </div>
  );
}
