/** Feature (column) metadata from /rows and /search endpoints */
export interface DatasetFeature {
  feature_idx: number;
  name: string;
  type: { dtype?: string; _type: string; names?: string[] };
}

/** Single row from /rows, /search, /filter */
export interface DatasetRow {
  row_idx: number;
  row: Record<string, unknown>;
  truncated_cells: string[];
}

/** Response from GET /rows */
export interface DatasetRowsResponse {
  features: DatasetFeature[];
  rows: DatasetRow[];
  num_rows_total: number;
  num_rows_per_page: number;
  partial: boolean;
}

/** Response from GET /search (same structure as /rows + search-specific) */
export interface DatasetSearchResponse extends DatasetRowsResponse {}

/** Response from GET /filter (same structure as /rows) */
export interface DatasetFilterResponse extends DatasetRowsResponse {}

/** Response from GET /splits */
export interface DatasetSplitsResponse {
  splits: Array<{
    dataset: string;
    config: string;
    split: string;
  }>;
}

/** Response from GET /is-valid */
export interface DatasetIsValidResponse {
  viewer: boolean;
  preview: boolean;
  search: boolean;
  filter: boolean;
  statistics: boolean;
}

/** Per-column statistics from GET /statistics */
export interface ColumnStatistics {
  column_name: string;
  column_type: 'int' | 'float' | 'bool' | 'class_label' | 'string_label' | 'string_text' | 'list' | 'audio' | 'image' | 'datetime';
  column_statistics: {
    nan_count: number;
    nan_proportion: number;
    min?: number | string;
    max?: number | string;
    mean?: number | string;
    median?: number | string;
    std?: number | string;
    n_unique?: number;
    frequencies?: Record<string, number>;
    histogram?: { hist: number[]; bin_edges: (number | string)[] };
  };
}

/** Response from GET /statistics */
export interface DatasetStatisticsResponse {
  num_examples: number;
  statistics: ColumnStatistics[];
  partial: boolean;
}
