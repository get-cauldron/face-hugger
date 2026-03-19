import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useRepoFiles } from './useRepoFiles';
import { useAuthStore } from '../stores/authStore';

vi.mock('@huggingface/hub', () => ({
  listFiles: vi.fn(),
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

const mockUser = { name: 'testuser', fullname: null, avatar_url: null, email: null, type: null };

describe('useRepoFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
  });

  it('should not fetch when token is null', () => {
    const { result } = renderHook(
      () => useRepoFiles('testuser/my-model', 'model'),
      { wrapper: createWrapper() }
    );
    // Query should not be enabled
    expect(result.current.isFetching).toBe(false);
  });

  it('should call listFiles with correct repo name and type', async () => {
    const { listFiles } = await import('@huggingface/hub');
    const mockFiles = [
      { path: 'README.md', type: 'file', size: 100 },
      { path: 'model.safetensors', type: 'file', size: 5000000 },
      { path: 'config.json', type: 'file', size: 200 },
    ];
    (listFiles as any).mockReturnValue(
      (async function* () {
        for (const f of mockFiles) yield f;
      })()
    );

    useAuthStore.setState({ token: 'hf_test123', user: mockUser, isAuthenticated: true });

    const { result } = renderHook(
      () => useRepoFiles('testuser/my-model', 'model'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify listFiles was called with the right arguments
    expect(listFiles).toHaveBeenCalledWith({
      repo: { name: 'testuser/my-model', type: 'model' },
      recursive: true,
      expand: false,
      accessToken: 'hf_test123',
    });

    // Verify returned data
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0].path).toBe('README.md');
    expect(result.current.data![2].path).toBe('config.json');
  });

  it('should call listFiles with dataset type for datasets', async () => {
    const { listFiles } = await import('@huggingface/hub');
    (listFiles as any).mockReturnValue(
      (async function* () {
        yield { path: 'data.parquet', type: 'file', size: 10000 };
      })()
    );

    useAuthStore.setState({ token: 'hf_test123', user: mockUser, isAuthenticated: true });

    const { result } = renderHook(
      () => useRepoFiles('testuser/my-dataset', 'dataset'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: { name: 'testuser/my-dataset', type: 'dataset' },
      })
    );
  });

  it('should set isError when listFiles throws', async () => {
    const { listFiles } = await import('@huggingface/hub');
    (listFiles as any).mockReturnValue(
      (async function* () {
        throw new Error('404 Not Found');
      })()
    );

    useAuthStore.setState({ token: 'hf_test123', user: mockUser, isAuthenticated: true });

    const { result } = renderHook(
      () => useRepoFiles('testuser/nonexistent', 'model'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('404');
  });
});
