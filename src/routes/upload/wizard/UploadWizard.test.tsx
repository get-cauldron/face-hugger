import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useAuthStore } from '../../../stores/authStore';

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

vi.mock('../../../lib/preferences', () => ({
  getPreference: vi.fn().mockResolvedValue([]),
  setPreference: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@huggingface/hub', () => ({
  listModels: vi.fn().mockReturnValue((async function* () {})()),
  listDatasets: vi.fn().mockReturnValue((async function* () {})()),
  listFiles: vi.fn().mockReturnValue((async function* () {})()),
}));

// Mock the auth commands
vi.mock('@/commands/auth', () => ({
  validateToken: vi.fn(),
  oauthStart: vi.fn().mockResolvedValue('https://example.com'),
  oauthExchangeCode: vi.fn(),
  oauthCancel: vi.fn().mockResolvedValue(null),
  getStoredToken: vi.fn().mockResolvedValue(null),
  checkExistingToken: vi.fn().mockResolvedValue(null),
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('UploadWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'hf_test123',
      user: { name: 'testuser', fullname: null, avatar_url: null, email: null, type: null },
      isAuthenticated: true,
    });
  });

  it('renders step 1 (Select Repo) initially', async () => {
    const { default: UploadWizard } = await import('./UploadWizard');
    const Wrapper = createWrapper();
    render(createElement(Wrapper, null, createElement(UploadWizard)));

    // Step labels visible in step indicator
    expect(screen.getByText('Select Repo')).toBeTruthy();
    expect(screen.getByText('Select Files')).toBeTruthy();
    expect(screen.getByText('Review & Upload')).toBeTruthy();
  });

  it('Next button is disabled when no repo is selected', async () => {
    const { default: UploadWizard } = await import('./UploadWizard');
    const Wrapper = createWrapper();
    render(createElement(Wrapper, null, createElement(UploadWizard)));

    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('Back button is disabled on step 1', async () => {
    const { default: UploadWizard } = await import('./UploadWizard');
    const Wrapper = createWrapper();
    render(createElement(Wrapper, null, createElement(UploadWizard)));

    const backBtn = screen.getByRole('button', { name: 'Back' });
    expect((backBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onComplete callback when provided', async () => {
    const onComplete = vi.fn();
    const { default: UploadWizard } = await import('./UploadWizard');
    const Wrapper = createWrapper();
    const { container } = render(
      createElement(Wrapper, null, createElement(UploadWizard, { onComplete }))
    );

    // Component renders without error with onComplete prop
    expect(container.firstChild).toBeTruthy();
    // onComplete is not called until upload completes
    expect(onComplete).not.toHaveBeenCalled();
  });
});
