import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useDatasetIsValid,
  useDatasetSplits,
  useDatasetRows,
  useDatasetSearch,
  useDatasetFilter,
} from '@/queries/useDatasetViewer';
import PreviewTable from './PreviewTable';
import ColumnStatPanel from './ColumnStatPanel';

interface DatasetPreviewProps {
  repoId: string;
}

export default function DatasetPreview({ repoId }: DatasetPreviewProps) {
  const [selectedSplit, setSelectedSplit] = useState('');
  const [selectedConfig, setSelectedConfig] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [statColumn, setStatColumn] = useState<string | null>(null);

  // Debounce search query 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: validData, isPending: isValidPending } = useDatasetIsValid(repoId);

  const isViewerValid = validData?.viewer === true;

  const { data: splitsData } = useDatasetSplits(repoId, isViewerValid);

  // Pre-select first split once loaded
  useEffect(() => {
    if (splitsData?.splits && splitsData.splits.length > 0 && !selectedSplit) {
      const first = splitsData.splits[0];
      setSelectedConfig(first.config);
      setSelectedSplit(first.split);
    }
  }, [splitsData, selectedSplit]);

  // Build filter where clause
  const whereClause = Object.entries(activeFilters)
    .filter(([, v]) => v.length > 0)
    .map(([col, val]) => `"${col}"='${val.replace(/'/g, "''")}'`)
    .join(' AND ');

  const hasSearch = debouncedQuery.length > 0;
  const hasFilter = whereClause.length > 0;

  // Fetch rows — priority: search > filter > plain
  const rowsResult = useDatasetRows(
    repoId,
    selectedConfig,
    selectedSplit,
    page,
    isViewerValid && !hasSearch && !hasFilter && !!selectedSplit,
  );

  const searchResult = useDatasetSearch(
    repoId,
    selectedConfig,
    selectedSplit,
    debouncedQuery,
    page,
    isViewerValid && hasSearch && !!selectedSplit,
  );

  const filterResult = useDatasetFilter(
    repoId,
    selectedConfig,
    selectedSplit,
    whereClause,
    page,
    isViewerValid && !hasSearch && hasFilter && !!selectedSplit,
  );

  // Pick active result
  const activeResult = hasSearch ? searchResult : hasFilter ? filterResult : rowsResult;
  const isLoading = activeResult.isPending;
  const features = activeResult.data?.features ?? [];
  const rows = activeResult.data?.rows ?? [];
  const totalRows = activeResult.data?.num_rows_total ?? 0;

  function handleFilterChange(column: string, value: string | null) {
    setPage(0);
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (value === null || value === '') {
        delete next[column];
      } else {
        next[column] = value;
      }
      return next;
    });
  }

  function handleColumnClick(col: string) {
    setStatColumn((prev) => (prev === col ? null : col));
  }

  function handleSplitChange(value: string | null) {
    if (!value) return;
    const split = splitsData?.splits.find((s) => `${s.config}/${s.split}` === value);
    if (split) {
      setSelectedConfig(split.config);
      setSelectedSplit(split.split);
      setPage(0);
    }
  }

  // Loading state for is-valid check
  if (isValidPending) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Checking dataset preview...</p>
      </div>
    );
  }

  // Preview unavailable
  if (!isViewerValid) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground mb-2">Preview unavailable</h2>
        <p className="text-sm">This dataset hasn't been processed for preview yet.</p>
      </div>
    );
  }

  const splits = splitsData?.splits ?? [];
  const currentValue = selectedConfig && selectedSplit ? `${selectedConfig}/${selectedSplit}` : '';

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 pr-8"
            placeholder="Search rows..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
          />
          {inputValue && (
            <button
              onClick={() => {
                setInputValue('');
                setDebouncedQuery('');
                setPage(0);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {splits.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Split:</span>
            <Select value={currentValue} onValueChange={handleSplitChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {splits.map((s) => {
                  const val = `${s.config}/${s.split}`;
                  return (
                    <SelectItem key={val} value={val}>
                      {val}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Table + stat panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <PreviewTable
            features={features}
            rows={rows}
            totalRows={totalRows}
            page={page}
            onPageChange={setPage}
            searchQuery={debouncedQuery}
            onColumnClick={handleColumnClick}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            isLoading={isLoading}
          />
        </div>
        {statColumn && (
          <ColumnStatPanel
            columnName={statColumn}
            dataset={repoId}
            config={selectedConfig}
            split={selectedSplit}
            onClose={() => setStatColumn(null)}
          />
        )}
      </div>
    </div>
  );
}
