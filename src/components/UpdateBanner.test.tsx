import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';

// Mock @tauri-apps/plugin-updater
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

// Mock @tauri-apps/plugin-process
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn().mockResolvedValue(undefined),
}));

describe('UpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no update is available', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    (check as any).mockResolvedValue(null);

    const { default: UpdateBanner } = await import('./UpdateBanner');
    const { container } = render(createElement(UpdateBanner));

    // Wait for the async check to complete
    await waitFor(() => {
      expect(check).toHaveBeenCalled();
    });

    // Container should be empty (component returns null)
    expect(container.firstChild).toBeNull();
  });

  it('shows update banner when update is available', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    const mockUpdate = {
      version: '0.2.0',
      body: 'New release with improvements',
      downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    };
    (check as any).mockResolvedValue(mockUpdate);

    const { default: UpdateBanner } = await import('./UpdateBanner');
    render(createElement(UpdateBanner));

    await waitFor(() => {
      expect(screen.getByText(/0\.2\.0/)).toBeTruthy();
    });
  });

  it('shows install/update button when update is available', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    const mockUpdate = {
      version: '0.2.0',
      body: 'New release',
      downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    };
    (check as any).mockResolvedValue(mockUpdate);

    const { default: UpdateBanner } = await import('./UpdateBanner');
    render(createElement(UpdateBanner));

    await waitFor(() => {
      // The banner has an "Update now" button
      expect(screen.getByText('Update now')).toBeTruthy();
    });
  });
});
