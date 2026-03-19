import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useModels, useDatasets } from './useRepos';
import { useAuthStore } from '../stores/authStore';

// Mock @huggingface/hub
vi.mock('@huggingface/hub', () => ({
  listModels: vi.fn(),
  listDatasets: vi.fn(),
}));

// Create wrapper with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useModels', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
  });

  it('should not fetch when user is not authenticated', () => {
    const { result } = renderHook(() => useModels(), { wrapper: createWrapper() });
    // With enabled: false, the query should not be in a pending/fetching state
    expect(result.current.isFetching).toBe(false);
  });

  it('should fetch models for the authenticated user', async () => {
    const { listModels } = await import('@huggingface/hub');
    const mockModels = [
      { id: 'testuser/my-model', name: 'my-model', private: false, downloads: 100, lastModified: '2026-01-01', tags: ['pytorch'], likes: 5 },
    ];
    (listModels as any).mockReturnValue((async function* () { for (const m of mockModels) yield m; })());

    useAuthStore.setState({
      token: 'hf_test',
      user: { name: 'testuser', fullname: null, avatar_url: null, email: null, type: null },
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useModels(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('my-model');
    expect(result.current.data![0].type).toBe('model');
  });
});

describe('useDatasets', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
  });

  it('should fetch datasets for the authenticated user', async () => {
    const { listDatasets } = await import('@huggingface/hub');
    const mockDatasets = [
      { id: 'testuser/my-dataset', name: 'my-dataset', private: true, downloads: 50, lastModified: '2026-02-01', tags: ['csv'], likes: 2 },
    ];
    (listDatasets as any).mockReturnValue((async function* () { for (const d of mockDatasets) yield d; })());

    useAuthStore.setState({
      token: 'hf_test',
      user: { name: 'testuser', fullname: null, avatar_url: null, email: null, type: null },
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useDatasets(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].type).toBe('dataset');
  });
});
