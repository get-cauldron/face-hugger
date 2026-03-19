import { useState } from 'react';
import { useModels, useDatasets, type RepoItem } from '../../../queries/useRepos';
import { Button } from '../../../components/ui/button';
import { Plus, Search } from 'lucide-react';

type FilterTab = 'all' | 'models' | 'datasets';

interface StepRepoPickerProps {
  selectedRepo: RepoItem | null;
  onSelect: (repo: RepoItem) => void;
  onCreateNew: () => void;
}

export default function StepRepoPicker({
  selectedRepo,
  onSelect,
  onCreateNew,
}: StepRepoPickerProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: models = [], isPending: modelsLoading } = useModels();
  const { data: datasets = [], isPending: datasetsLoading } = useDatasets();

  const allRepos: RepoItem[] = [
    ...(filter === 'datasets' ? [] : models),
    ...(filter === 'models' ? [] : datasets),
  ].filter(
    (repo) =>
      !searchQuery ||
      repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = modelsLoading || datasetsLoading;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar: filter tabs + search + create button */}
      <div className="flex items-center gap-2">
        {/* Filter tabs */}
        <div className="flex items-center bg-secondary rounded-lg p-0.5 gap-0.5">
          {(['all', 'models', 'datasets'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors capitalize ${
                filter === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Filter repos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 pl-8 pr-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
          />
        </div>

        {/* Create New button */}
        <Button size="sm" variant="outline" onClick={onCreateNew}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Repo
        </Button>
      </div>

      {/* Repo list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-0">
        {isLoading && (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-3 h-14 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && allRepos.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground py-8">
            <p className="text-sm">No repositories found</p>
            <button
              onClick={onCreateNew}
              className="text-primary text-sm mt-1 hover:underline"
            >
              Create your first repository
            </button>
          </div>
        )}

        {!isLoading &&
          allRepos.map((repo) => {
            const isSelected = selectedRepo?.id === repo.id;
            return (
              <button
                key={repo.id}
                onClick={() => onSelect(repo)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-foreground truncate">
                    {repo.id}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        repo.type === 'model'
                          ? 'bg-primary/20 text-primary'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {repo.type === 'model' ? 'Model' : 'Dataset'}
                    </span>
                    {repo.private && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                        Private
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      {/* Count footer */}
      {!isLoading && allRepos.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {allRepos.length} repo{allRepos.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
