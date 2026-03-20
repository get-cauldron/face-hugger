import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';

// Mock Tauri modules
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

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: () => Promise.resolve(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: () => Promise.resolve(() => {}),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: () => Promise.resolve(null),
}));

// Mock HF hub
vi.mock('@huggingface/hub', () => ({
  listFiles: vi.fn().mockReturnValue((async function* () {})()),
  listCommits: vi.fn().mockReturnValue((async function* () {})()),
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

// Mock heavy sub-components to keep tests focused
vi.mock('../../routes/repo-browser/FileTree', () => ({
  default: ({ files }: any) =>
    createElement('div', { 'data-testid': 'file-tree' },
      `${files?.length ?? 0} files`
    ),
}));

vi.mock('../../routes/repo-browser/CommitTimeline', () => ({
  default: ({ repoId }: any) =>
    createElement('div', { 'data-testid': 'commit-timeline' },
      `Commit history for ${repoId}`
    ),
}));

vi.mock('../../routes/repo-browser/preview/DatasetPreview', () => ({
  default: () => createElement('div', { 'data-testid': 'dataset-preview' }, 'Dataset Preview'),
}));

vi.mock('../../routes/repo-browser/FileActions', () => ({
  DeleteRepoDialog: ({ open, repoId }: any) =>
    open ? createElement('div', { 'data-testid': 'delete-repo-dialog' }, `Delete ${repoId}`) : null,
  default: () => null,
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('RepoBrowserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'hf_test123',
      user: { name: 'testuser', fullname: null, avatar_url: null, email: null, type: null },
      isAuthenticated: true,
    });
  });

  it('renders file browser tab by default', async () => {
    // Provide mock file data
    const { listFiles } = await import('@huggingface/hub');
    (listFiles as any).mockReturnValue(
      (async function* () {
        yield { path: 'README.md', type: 'file', size: 100 };
      })()
    );

    const { default: RepoBrowserPage } = await import('./RepoBrowserPage');
    const Wrapper = createWrapper();
    render(
      createElement(Wrapper, null,
        createElement(RepoBrowserPage, {
          repoId: 'testuser/test-model',
          repoType: 'model',
          onBack: vi.fn(),
        })
      )
    );

    // The Files tab should be visible and active by default
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();

    // File tree is rendered (the default tab)
    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeTruthy();
    });
  });

  it('switches to commit history tab when History is clicked', async () => {
    const { listFiles } = await import('@huggingface/hub');
    (listFiles as any).mockReturnValue((async function* () {})());

    const { default: RepoBrowserPage } = await import('./RepoBrowserPage');
    const Wrapper = createWrapper();
    render(
      createElement(Wrapper, null,
        createElement(RepoBrowserPage, {
          repoId: 'testuser/test-model',
          repoType: 'model',
          onBack: vi.fn(),
        })
      )
    );

    // Click the History tab
    const historyTab = screen.getByText('History');
    fireEvent.click(historyTab);

    // Commit timeline should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('commit-timeline')).toBeTruthy();
    });
    expect(screen.getByText(/Commit history for testuser\/test-model/)).toBeTruthy();
  });

  it('renders Delete Repository button', async () => {
    const { listFiles } = await import('@huggingface/hub');
    (listFiles as any).mockReturnValue((async function* () {})());

    const { default: RepoBrowserPage } = await import('./RepoBrowserPage');
    const Wrapper = createWrapper();
    render(
      createElement(Wrapper, null,
        createElement(RepoBrowserPage, {
          repoId: 'testuser/test-model',
          repoType: 'model',
          onBack: vi.fn(),
        })
      )
    );

    // Delete Repository button should be present
    expect(screen.getByText('Delete Repository')).toBeTruthy();
  });
});
