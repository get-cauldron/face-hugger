import { Search, LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'grid' | 'table';
export type SortBy = 'lastModified' | 'name-asc' | 'name-desc' | 'downloads';
export type FilterVisibility = 'all' | 'public' | 'private';

interface RepoListToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  filterVisibility: FilterVisibility;
  onFilterVisibilityChange: (filter: FilterVisibility) => void;
}

export default function RepoListToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  filterVisibility,
  onFilterVisibilityChange,
}: RepoListToolbarProps) {
  const selectClass =
    'px-3 py-1.5 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer';

  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      {/* Search input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search repos..."
          className="w-full pl-9 pr-4 py-1.5 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder-[var(--color-muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Sort dropdown */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortBy)}
        className={selectClass}
        aria-label="Sort by"
      >
        <option value="lastModified">Last updated</option>
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
        <option value="downloads">Downloads</option>
      </select>

      {/* Visibility filter dropdown */}
      <select
        value={filterVisibility}
        onChange={(e) => onFilterVisibilityChange(e.target.value as FilterVisibility)}
        className={selectClass}
        aria-label="Filter by visibility"
      >
        <option value="all">All</option>
        <option value="public">Public</option>
        <option value="private">Private</option>
      </select>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 border border-border rounded-lg p-1">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === 'grid'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Grid view"
          title="Grid view"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewModeChange('table')}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === 'table'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="List view"
          title="List view"
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
