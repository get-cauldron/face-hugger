export interface DatasetRow {
  text: string;
  label: number;
  score: number;
}

export interface ColumnStat {
  type: 'string' | 'int' | 'float';
  count: number;
  nullCount: number;
}

export const mockDatasetRows: DatasetRow[] = [
  { text: 'The quick brown fox', label: 0, score: 0.92 },
  { text: 'Machine learning is fascinating', label: 1, score: 0.87 },
  { text: 'Natural language processing', label: 1, score: 0.95 },
  { text: 'Deep learning architectures', label: 2, score: 0.78 },
  { text: 'Transformer models excel here', label: 2, score: 0.91 },
];

export const mockColumnStats: Record<string, ColumnStat> = {
  text: { type: 'string', count: 5, nullCount: 0 },
  label: { type: 'int', count: 5, nullCount: 0 },
  score: { type: 'float', count: 5, nullCount: 0 },
};
