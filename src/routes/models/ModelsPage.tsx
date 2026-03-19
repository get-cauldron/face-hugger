import { useState, useEffect, useMemo } from 'react';
import { useModels, type RepoItem } from '../../queries/useRepos';
import { getPreference, setPreference } from '../../lib/preferences';
import RepoGrid from '../../components/repos/RepoGrid';
import RepoTable from '../../components/repos/RepoTable';
import RepoListToolbar, { type ViewMode, type SortBy, type FilterVisibility } from '../../components/repos/RepoListToolbar';
import RepoEmptyState from '../../components/repos/RepoEmptyState';
import CreateRepoSheet from '../../components/repos/CreateRepoSheet';
import { Button } from '../../components/ui/button';
import { Plus } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse h-40" />
  );
}

export default function ModelsPage() {
  const { data: repos, isPending, isError } = useModels();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('lastModified');
  const [filterVisibility, setFilterVisibility] = useState<FilterVisibility>('all');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    async function loadPrefs() {
      const [savedView, savedSort, savedFilter] = await Promise.all([
        getPreference<ViewMode>('models.viewMode', 'grid'),
        getPreference<SortBy>('models.sortBy', 'lastModified'),
        getPreference<FilterVisibility>('models.filterVisibility', 'all'),
      ]);
      setViewMode(savedView);
      setSortBy(savedSort);
      setFilterVisibility(savedFilter);
      setPrefsLoaded(true);
    }
    loadPrefs();
  }, []);

  // Persist viewMode changes
  useEffect(() => {
    if (!prefsLoaded) return;
    setPreference('models.viewMode', viewMode);
  }, [viewMode, prefsLoaded]);

  // Persist sortBy changes
  useEffect(() => {
    if (!prefsLoaded) return;
    setPreference('models.sortBy', sortBy);
  }, [sortBy, prefsLoaded]);

  // Persist filterVisibility changes
  useEffect(() => {
    if (!prefsLoaded) return;
    setPreference('models.filterVisibility', filterVisibility);
  }, [filterVisibility, prefsLoaded]);

  // Client-side filter + sort
  const filteredRepos = useMemo(() => {
    if (!repos) return [];

    let result = repos.filter((repo) => {
      if (searchQuery && !repo.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterVisibility === 'public' && repo.private) return false;
      if (filterVisibility === 'private' && !repo.private) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'lastModified':
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'downloads':
          return b.downloads - a.downloads;
        default:
          return 0;
      }
    });

    return result;
  }, [repos, searchQuery, filterVisibility, sortBy]);

  const handleRepoClick = async (repo: RepoItem) => {
    const recent = await getPreference<string[]>('recentModels', []);
    const updated = [repo.id, ...recent.filter((id) => id !== repo.id)].slice(0, 5);
    await setPreference('recentModels', updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Models</h1>
        <Button size="sm" onClick={() => setCreateSheetOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Repository
        </Button>
      </div>

      <CreateRepoSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        defaultType="model"
      />

      <RepoListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterVisibility={filterVisibility}
        onFilterVisibilityChange={setFilterVisibility}
      />

      {/* Loading state */}
      {isPending && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <p className="text-destructive text-sm">
          Failed to load models. Please try again.
        </p>
      )}

      {/* Empty state */}
      {!isPending && !isError && filteredRepos.length === 0 && (
        <RepoEmptyState type="model" />
      )}

      {/* Repo list */}
      {!isPending && !isError && filteredRepos.length > 0 && (
        viewMode === 'grid' ? (
          <RepoGrid repos={filteredRepos} onRepoClick={handleRepoClick} />
        ) : (
          <RepoTable repos={filteredRepos} onRepoClick={handleRepoClick} />
        )
      )}
    </div>
  );
}
