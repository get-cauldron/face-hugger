import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { DatasetFeature, DatasetRow } from '@/lib/datasetTypes';
import { PAGE_SIZE } from '@/queries/useDatasetViewer';

interface PreviewTableProps {
  features: DatasetFeature[];
  rows: DatasetRow[];
  totalRows: number;
  page: number;
  onPageChange: (page: number) => void;
  searchQuery: string;
  onColumnClick: (columnName: string) => void;
  activeFilters: Record<string, string>;
  onFilterChange: (column: string, value: string | null) => void;
  isLoading: boolean;
}

function getTypeColor(feature: DatasetFeature): string {
  const t = feature.type._type?.toLowerCase() ?? '';
  const dtype = feature.type.dtype?.toLowerCase() ?? '';
  if (t === 'value' && (dtype.startsWith('int') || dtype.startsWith('float') || dtype.startsWith('uint'))) {
    return 'text-amber-400';
  }
  if (t === 'value' && dtype === 'bool') {
    return 'text-green-400';
  }
  if (t === 'value' && (dtype === 'string' || dtype === 'large_string')) {
    return 'text-blue-400';
  }
  if (t === 'classlabel') {
    return 'text-blue-400';
  }
  return 'text-muted-foreground';
}

function getTypeName(feature: DatasetFeature): string {
  const t = feature.type._type?.toLowerCase() ?? '';
  if (t === 'value') return feature.type.dtype ?? 'value';
  if (t === 'classlabel') return 'class';
  if (t === 'sequence') return 'list';
  if (t === 'image') return 'image';
  if (t === 'audio') return 'audio';
  return t;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-primary rounded-sm px-1">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function isFilterableColumn(feature: DatasetFeature): boolean {
  const t = feature.type._type?.toLowerCase() ?? '';
  const dtype = feature.type.dtype?.toLowerCase() ?? '';
  if (t === 'classlabel') return true;
  if (t === 'value' && (dtype === 'string' || dtype === 'large_string')) return true;
  return false;
}

export default function PreviewTable({
  features,
  rows,
  totalRows,
  page,
  onPageChange,
  searchQuery,
  onColumnClick,
  activeFilters,
  onFilterChange,
  isLoading,
}: PreviewTableProps) {
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalRows);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {features.map((feature) => (
                <TableHead key={feature.name} className="min-w-[120px]">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => onColumnClick(feature.name)}
                      className="flex items-center gap-1.5 cursor-pointer hover:text-foreground text-muted-foreground text-xs font-medium text-left"
                    >
                      {feature.name}
                      <Badge
                        variant="secondary"
                        className={`px-1 py-0 text-[10px] ${getTypeColor(feature)}`}
                      >
                        {getTypeName(feature)}
                      </Badge>
                    </button>
                    {isFilterableColumn(feature) && (
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={activeFilters[feature.name] ?? ''}
                        onChange={(e) =>
                          onFilterChange(feature.name, e.target.value || null)
                        }
                        className="h-6 w-full rounded border border-border bg-background px-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {(features.length > 0 ? features : [null]).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-10 w-full animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow key={row.row_idx} className="h-10">
                    {features.map((feature) => {
                      const value = row.row[feature.name];
                      if (value === null || value === undefined) {
                        return (
                          <TableCell key={feature.name}>
                            <span className="text-muted-foreground italic">—</span>
                          </TableCell>
                        );
                      }
                      const str = String(value);
                      return (
                        <TableCell key={feature.name}>
                          <span className="max-w-[240px] truncate block text-sm">
                            {searchQuery
                              ? highlightText(str, searchQuery)
                              : str}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between px-2 py-3 border-t border-border">
        <span className="text-sm text-muted-foreground">
          Rows {start}–{end} of {totalRows.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-primary font-medium">{page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={end >= totalRows}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
