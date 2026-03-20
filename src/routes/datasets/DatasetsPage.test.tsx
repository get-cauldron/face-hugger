import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';

// Mock Tauri modules
vi.mock('@tauri-apps/api/event', () => ({
  listen: () => Promise.resolve(() => {}),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: () => Promise.resolve(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: () => Promise.resolve(null),
}));

// Mock preferences
vi.mock('../../lib/preferences', () => ({
  getPreference: vi.fn().mockResolvedValue('grid'),
  setPreference: vi.fn().mockResolvedValue(undefined),
}));

// Mock HF hub
vi.mock('@huggingface/hub', () => ({
  listDatasets: vi.fn(),
  listModels: vi.fn().mockReturnValue((async function* () {})()),
}));

// Mock auth commands
vi.mock('@/commands/auth', () => ({
  validateToken: vi.fn(),
  oauthStart: vi.fn(),
  oauthExchangeCode: vi.fn(),
  oauthCancel: vi.fn(),
  getStoredToken: vi.fn().mockResolvedValue(null),
  checkExistingToken: vi.fn().mockResolvedValue(null),
}));

// Mock CreateRepoSheet to avoid heavy deps
vi.mock('../../components/repos/CreateRepoSheet', () => ({
  default: () => null,
}));

const mockDatasets = [
  {
    id: 'testuser/my-dataset',
    name: 'my-dataset',
    owner: 'testuser',
    type: 'dataset' as const,
    private: false,
    downloads: 50,
    likes: 5,
    lastModified: '2026-01-01T00:00:00Z',
    tags: ['csv'],
  },
  {
    id: 'testuser/another-dataset',
    name: 'another-dataset',
    owner: 'testuser',
    type: 'dataset' as const,
    private: true,
    downloads: 10,
    likes: 1,
    lastModified: '2026-02-01T00:00:00Z',
    tags: [],
  },
];

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('DatasetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'hf_test123',
      user: { name: 'testuser', fullname: null, avatar_url: null, email: null, type: null },
      isAuthenticated: true,
    });
  });

  it('renders dataset list when datasets are loaded', async () => {
    const { listDatasets } = await import('@huggingface/hub');
    (listDatasets as any).mockReturnValue(
      (async function* () {
        for (const d of mockDatasets) {
          yield {
            id: 'hex_id',
            name: d.id, // HF hub: name = slug
            private: d.private,
            downloads: d.downloads,
            likes: d.likes,
            lastModified: d.lastModified,
            tags: d.tags,
          };
        }
      })()
    );

    const { default: DatasetsPage } = await import('./DatasetsPage');
    const Wrapper = createWrapper();
    const onRepoSelect = vi.fn();
    render(
      createElement(Wrapper, null,
        createElement(DatasetsPage, { onRepoSelect })
      )
    );

    await waitFor(() => {
      expect(screen.getByText('my-dataset')).toBeTruthy();
    });

    expect(screen.getByText('another-dataset')).toBeTruthy();
  });

  it('clicking a dataset calls onRepoSelect', async () => {
    const { listDatasets } = await import('@huggingface/hub');
    (listDatasets as any).mockReturnValue(
      (async function* () {
        yield {
          id: 'hex_id',
          name: 'testuser/my-dataset',
          private: false,
          downloads: 50,
          likes: 5,
          lastModified: '2026-01-01T00:00:00Z',
          tags: [],
        };
      })()
    );

    const { getPreference } = await import('../../lib/preferences');
    (getPreference as any).mockResolvedValue([]);

    const { default: DatasetsPage } = await import('./DatasetsPage');
    const Wrapper = createWrapper();
    const onRepoSelect = vi.fn();
    render(
      createElement(Wrapper, null,
        createElement(DatasetsPage, { onRepoSelect })
      )
    );

    await waitFor(() => {
      expect(screen.getByText('my-dataset')).toBeTruthy();
    });

    // Click the dataset card
    const card = screen.getByText('my-dataset').closest('[class*="cursor-pointer"]');
    expect(card).toBeTruthy();
    fireEvent.click(card!);

    await waitFor(() => {
      expect(onRepoSelect).toHaveBeenCalledWith('testuser/my-dataset', 'dataset');
    });
  });
});
