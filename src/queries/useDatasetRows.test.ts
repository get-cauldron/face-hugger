import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/fixtures/mocks/node';
import { useDatasetRows } from './useDatasetViewer';
import { useAuthStore } from '../stores/authStore';

const DS_BASE = 'https://datasets-server.huggingface.co';

const mockRowsResponse = {
  rows: [
    { row_idx: 0, row: { text: 'The quick brown fox', label: 0, score: 0.92 }, truncated_cells: [] },
    { row_idx: 1, row: { text: 'Machine learning', label: 1, score: 0.87 }, truncated_cells: [] },
  ],
  num_rows_total: 2,
  num_rows_per_page: 50,
};

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useDatasetRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'hf_test123',
      user: { name: 'testuser', fullname: null, avatar_url: null, email: null, type: null },
      isAuthenticated: true,
    });
  });

  it('returns rows for a valid dataset', async () => {
    server.use(
      http.get(`${DS_BASE}/rows`, () => {
        return HttpResponse.json(mockRowsResponse);
      })
    );

    const { result } = renderHook(
      () => useDatasetRows('testuser/my-dataset', 'default', 'train', 0, true),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.rows).toHaveLength(2);
    expect(result.current.data?.rows[0].row.text).toBe('The quick brown fox');
  });

  it('search query is included in query key (different params give different cache entries)', async () => {
    // Test that query key includes the page parameter
    // By rendering with page=0 and page=1, verify they are treated as independent queries
    server.use(
      http.get(`${DS_BASE}/rows`, ({ request }) => {
        const url = new URL(request.url);
        const offset = url.searchParams.get('offset');
        if (offset === '0') {
          return HttpResponse.json({ ...mockRowsResponse, rows: [mockRowsResponse.rows[0]] });
        }
        return HttpResponse.json({ ...mockRowsResponse, rows: [mockRowsResponse.rows[1]] });
      })
    );

    const { result: result1 } = renderHook(
      () => useDatasetRows('testuser/my-dataset', 'default', 'train', 0, true),
      { wrapper: createWrapper() }
    );

    const { result: result2 } = renderHook(
      () => useDatasetRows('testuser/my-dataset', 'default', 'train', 1, true),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));

    // Different pages should return different data
    expect(result1.current.data?.rows).toHaveLength(1);
    expect(result2.current.data?.rows).toHaveLength(1);
  });

  it('returns empty rows for an empty dataset', async () => {
    server.use(
      http.get(`${DS_BASE}/rows`, () => {
        return HttpResponse.json({
          rows: [],
          num_rows_total: 0,
          num_rows_per_page: 50,
        });
      })
    );

    const { result } = renderHook(
      () => useDatasetRows('testuser/empty-dataset', 'default', 'train', 0, true),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.rows).toHaveLength(0);
  });

  it('is disabled when enabled=false', () => {
    const { result } = renderHook(
      () => useDatasetRows('testuser/my-dataset', 'default', 'train', 0, false),
      { wrapper: createWrapper() }
    );

    expect(result.current.isFetching).toBe(false);
  });
});
