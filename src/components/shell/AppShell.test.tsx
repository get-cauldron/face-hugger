import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';

// Mock all Tauri APIs
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: () => Promise.resolve(),
    toggleMaximize: () => Promise.resolve(),
    close: () => Promise.resolve(),
    metadata: () => Promise.resolve({ isMaximized: false }),
  }),
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: () => Promise.resolve(() => {}),
  }),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  load: () => Promise.resolve({ get: () => null, set: () => Promise.resolve() }),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: () => Promise.resolve(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: () => Promise.resolve(null),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: () => Promise.resolve(() => {}),
}));

// Mock the preferences module
vi.mock('../../lib/preferences', () => ({
  getPreference: vi.fn().mockResolvedValue([]),
  setPreference: vi.fn().mockResolvedValue(undefined),
}));

// Mock HF hub
vi.mock('@huggingface/hub', () => ({
  listModels: vi.fn(),
  listDatasets: vi.fn(),
  listFiles: vi.fn(),
  listCommits: vi.fn(),
}));

// Track what repoId gets passed to RepoBrowserPage
let capturedRepoId: string | null = null;
let capturedRepoType: string | null = null;

vi.mock('../../routes/repo-browser/RepoBrowserPage', () => ({
  default: ({ repoId, repoType, onBack }: any) => {
    capturedRepoId = repoId;
    capturedRepoType = repoType;
    return createElement('div', { 'data-testid': 'repo-browser' },
      createElement('span', { 'data-testid': 'repo-id' }, repoId),
      createElement('span', { 'data-testid': 'repo-type' }, repoType),
      createElement('button', { 'data-testid': 'back-btn', onClick: onBack }, 'Back'),
    );
  },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

const mockUser = { name: 'zkeown', fullname: null, avatar_url: null, email: null, type: null };

describe('AppShell repo navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedRepoId = null;
    capturedRepoType = null;
    useAuthStore.setState({ token: 'hf_test123', user: mockUser, isAuthenticated: true });
  });

  it('navigateToRepo passes full repo.id string (not index) to RepoBrowserPage', async () => {
    const { listModels } = await import('@huggingface/hub');
    // @huggingface/hub: id = MongoDB _id (hex), name = slug (user/repo)
    const mockModels = [
      {
        id: '69988749d9b39c5c7970c0f4',
        name: 'zkeown/llama-fine-tuned',
        private: false,
        downloads: 42,
        likes: 5,
        updatedAt: new Date('2026-03-19'),
        tags: ['pytorch'],
      },
      {
        id: '70a12345abcdef0123456789',
        name: 'zkeown/bert-custom',
        private: true,
        downloads: 10,
        likes: 1,
        updatedAt: new Date('2026-03-18'),
        tags: [],
      },
    ];
    (listModels as any).mockReturnValue(
      (async function* () {
        for (const m of mockModels) yield m;
      })()
    );

    // Import AppShell after mocks are set up
    const { default: AppShell } = await import('./AppShell');

    const Wrapper = createWrapper();
    render(createElement(Wrapper, null, createElement(AppShell)));

    // Wait for models to load — name is now extracted as short name from slug
    await waitFor(() => {
      expect(screen.getByText('llama-fine-tuned')).toBeTruthy();
    });

    // Click the first model card
    const card = screen.getByText('llama-fine-tuned').closest('[class*="cursor-pointer"]');
    expect(card).toBeTruthy();
    fireEvent.click(card!);

    // Wait for repo browser to appear
    await waitFor(() => {
      expect(screen.getByTestId('repo-browser')).toBeTruthy();
    });

    // THE CRITICAL ASSERTION: repoId should be the full slug, not a number
    expect(capturedRepoId).toBe('zkeown/llama-fine-tuned');
    expect(capturedRepoType).toBe('model');
    expect(screen.getByTestId('repo-id').textContent).toBe('zkeown/llama-fine-tuned');
  });

  it('navigateToRepo for dataset passes correct repoType', async () => {
    const { listModels, listDatasets } = await import('@huggingface/hub');
    (listModels as any).mockReturnValue((async function* () {})());

    // @huggingface/hub: id = MongoDB _id (hex), name = slug (user/repo)
    const mockDatasets = [
      {
        id: '80b56789abcdef0123456789',
        name: 'zkeown/my-dataset',
        private: false,
        downloads: 100,
        likes: 3,
        updatedAt: new Date('2026-03-19'),
        tags: ['text'],
      },
    ];
    (listDatasets as any).mockReturnValue(
      (async function* () {
        for (const d of mockDatasets) yield d;
      })()
    );

    const { default: AppShell } = await import('./AppShell');
    const Wrapper = createWrapper();
    render(createElement(Wrapper, null, createElement(AppShell)));

    // Switch to Datasets section — use the sidebar button (has a <span> child)
    const datasetsBtn = screen.getAllByText('Datasets').find(
      (el) => el.tagName === 'SPAN'
    )!;
    fireEvent.click(datasetsBtn);

    // Wait for datasets to load
    await waitFor(() => {
      expect(screen.getByText('my-dataset')).toBeTruthy();
    });

    // Click the dataset card
    const card = screen.getByText('my-dataset').closest('[class*="cursor-pointer"]');
    expect(card).toBeTruthy();
    fireEvent.click(card!);

    await waitFor(() => {
      expect(screen.getByTestId('repo-browser')).toBeTruthy();
    });

    expect(capturedRepoId).toBe('zkeown/my-dataset');
    expect(capturedRepoType).toBe('dataset');
  });
});
