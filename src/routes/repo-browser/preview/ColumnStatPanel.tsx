import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';
import { useDatasetStatistics } from '@/queries/useDatasetViewer';
import type { ColumnStatistics } from '@/lib/datasetTypes';

interface ColumnStatPanelProps {
  columnName: string;
  dataset: string;
  config: string;
  split: string;
  onClose: () => void;
}

function getTypeColor(colType: ColumnStatistics['column_type']): string {
  if (colType === 'int' || colType === 'float') return 'text-amber-400';
  if (colType === 'bool') return 'text-green-400';
  if (colType === 'string_label' || colType === 'string_text' || colType === 'class_label') return 'text-blue-400';
  return 'text-muted-foreground';
}

function formatValue(val: number | string | undefined): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'number') return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(val);
}

export default function ColumnStatPanel({
  columnName,
  dataset,
  config,
  split,
  onClose,
}: ColumnStatPanelProps) {
  const { data, isPending } = useDatasetStatistics(dataset, config, split, true);

  const stat = data?.statistics.find((s) => s.column_name === columnName);
  const cs = stat?.column_statistics;

  return (
    <div
      className="w-80 flex-shrink-0 flex flex-col bg-card border-l border-border overflow-y-auto"
      style={{ transform: 'translateX(0)', transition: 'transform 200ms' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <h3 className="text-[20px] font-semibold text-foreground truncate">{columnName}</h3>
        <button
          onClick={onClose}
          aria-label="Close statistics panel"
          className="text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Type badge */}
      {stat && (
        <div className="px-4 pb-3">
          <Badge
            variant="secondary"
            className={`text-xs ${getTypeColor(stat.column_type)}`}
          >
            {stat.column_type}
          </Badge>
        </div>
      )}

      <Separator />

      {/* Statistics */}
      <div className="p-4 space-y-3">
        {isPending ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))
        ) : cs ? (
          <>
            <StatRow label="Null count" value={cs.nan_count.toLocaleString()} />
            <StatRow
              label="Null %"
              value={`${(cs.nan_proportion * 100).toFixed(1)}%`}
            />
            {cs.n_unique !== undefined && (
              <StatRow label="Unique values" value={cs.n_unique.toLocaleString()} />
            )}
            {cs.min !== undefined && (
              <StatRow label="Min" value={formatValue(cs.min)} />
            )}
            {cs.max !== undefined && (
              <StatRow label="Max" value={formatValue(cs.max)} />
            )}
            {cs.mean !== undefined && (
              <StatRow label="Mean" value={formatValue(cs.mean)} />
            )}
            {cs.median !== undefined && (
              <StatRow label="Median" value={formatValue(cs.median)} />
            )}
            {cs.std !== undefined && (
              <StatRow label="Std Dev" value={formatValue(cs.std)} />
            )}
          </>
        ) : (
          !isPending && (
            <p className="text-sm text-muted-foreground">No statistics available.</p>
          )
        )}
      </div>

      <Separator />

      {/* Chart */}
      <div className="p-4">
        {isPending ? (
          <Skeleton className="h-[200px] w-full" />
        ) : cs?.histogram ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={cs.histogram.hist.map((count, i) => ({
                bin: cs.histogram!.bin_edges[i],
                count,
              }))}
              margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
            >
              <XAxis
                dataKey="bin"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) =>
                  typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(v)
                }
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={2} />
            </BarChart>
          </ResponsiveContainer>
        ) : cs?.frequencies ? (
          <ResponsiveContainer width="100%" height={Math.min(Object.keys(cs.frequencies).length * 24 + 40, 400)}>
            <BarChart
              data={Object.entries(cs.frequencies)
                .map(([label, count]) => ({ label, count }))
                .slice(0, 20)}
              layout="vertical"
              margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
            >
              <YAxis
                dataKey="label"
                type="category"
                width={100}
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) =>
                  v.length > 14 ? v.slice(0, 14) + '…' : v
                }
              />
              <XAxis dataKey="count" type="number" tick={{ fontSize: 10 }} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={2} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No distribution data available
          </p>
        )}
      </div>

      {/* Partial notice */}
      {data?.partial && (
        <p className="text-xs text-muted-foreground italic px-4 pb-4">
          Statistics are partial — dataset exceeds 5 GB.
        </p>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono text-xs">{value}</span>
    </div>
  );
}
