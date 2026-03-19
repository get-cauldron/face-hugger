import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import type {
  DatasetIsValidResponse,
  DatasetSplitsResponse,
  DatasetRowsResponse,
  DatasetSearchResponse,
  DatasetFilterResponse,
  DatasetStatisticsResponse,
} from '@/lib/datasetTypes';

const DS_BASE = 'https://datasets-server.huggingface.co';
export const PAGE_SIZE = 50;

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useDatasetIsValid(dataset: string) {
  return useQuery<DatasetIsValidResponse>({
    queryKey: ['dataset-is-valid', dataset],
    queryFn: async () => {
      const url = `${DS_BASE}/is-valid?dataset=${encodeURIComponent(dataset)}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!dataset,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDatasetSplits(dataset: string, enabled: boolean) {
  return useQuery<DatasetSplitsResponse>({
    queryKey: ['dataset-splits', dataset],
    queryFn: async () => {
      const url = `${DS_BASE}/splits?dataset=${encodeURIComponent(dataset)}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!dataset && enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDatasetRows(
  dataset: string,
  config: string,
  split: string,
  page: number,
  enabled: boolean,
) {
  return useQuery<DatasetRowsResponse>({
    queryKey: ['dataset-rows', dataset, config, split, page],
    queryFn: async () => {
      const offset = page * PAGE_SIZE;
      const url = `${DS_BASE}/rows?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${PAGE_SIZE}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!dataset && !!config && !!split && enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useDatasetSearch(
  dataset: string,
  config: string,
  split: string,
  query: string,
  page: number,
  enabled: boolean,
) {
  return useQuery<DatasetSearchResponse>({
    queryKey: ['dataset-search', dataset, config, split, query, page],
    queryFn: async () => {
      const offset = page * PAGE_SIZE;
      const url = `${DS_BASE}/search?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&query=${encodeURIComponent(query)}&offset=${offset}&length=${PAGE_SIZE}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: query.length > 0 && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDatasetFilter(
  dataset: string,
  config: string,
  split: string,
  where_clause: string,
  page: number,
  enabled: boolean,
) {
  return useQuery<DatasetFilterResponse>({
    queryKey: ['dataset-filter', dataset, config, split, where_clause, page],
    queryFn: async () => {
      const offset = page * PAGE_SIZE;
      const url = `${DS_BASE}/filter?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&where=${encodeURIComponent(where_clause)}&offset=${offset}&length=${PAGE_SIZE}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: where_clause.length > 0 && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDatasetStatistics(
  dataset: string,
  config: string,
  split: string,
  enabled: boolean,
) {
  return useQuery<DatasetStatisticsResponse>({
    queryKey: ['dataset-statistics', dataset, config, split],
    queryFn: async () => {
      const url = `${DS_BASE}/statistics?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!dataset && !!config && !!split && enabled,
    staleTime: 10 * 60 * 1000,
  });
}
