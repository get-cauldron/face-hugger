import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { useAuthStore } from '../../stores/authStore';

// Mock Tauri modules
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}));

// Mock auth commands
vi.mock('../../commands/auth', () => ({
  validateToken: vi.fn(),
  oauthStart: vi.fn().mockResolvedValue('https://huggingface.co/oauth/authorize?client_id=test'),
  oauthExchangeCode: vi.fn(),
  oauthCancel: vi.fn().mockResolvedValue(null),
  getStoredToken: vi.fn().mockResolvedValue(null),
}));

const mockUserInfo = {
  name: 'testuser',
  fullname: 'Test User',
  avatar_url: null,
  email: null,
  type: 'user',
};

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      oauthStatus: 'idle',
      oauthError: null,
    });
  });

  it('renders OAuth mode by default', async () => {
    const { default: LoginScreen } = await import('./LoginScreen');
    render(createElement(LoginScreen));

    expect(screen.getByText('Sign in with Hugging Face')).toBeTruthy();
    expect(screen.getByText('Use access token instead')).toBeTruthy();
  });

  it('switches to token mode when clicking "Use access token instead"', async () => {
    const { default: LoginScreen } = await import('./LoginScreen');
    render(createElement(LoginScreen));

    const switchBtn = screen.getByText('Use access token instead');
    fireEvent.click(switchBtn);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('hf_...');
      expect(input).toBeTruthy();
    });
  });

  it('shows error on invalid token', async () => {
    const { validateToken } = await import('../../commands/auth');
    (validateToken as any).mockRejectedValue(new Error('Invalid token'));

    const { default: LoginScreen } = await import('./LoginScreen');
    render(createElement(LoginScreen));

    // Switch to token mode
    fireEvent.click(screen.getByText('Use access token instead'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('hf_...')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('hf_...');
    fireEvent.change(input, { target: { value: 'bad_token' } });

    const submitBtn = screen.getByRole('button', { name: 'Sign in' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid token')).toBeTruthy();
    });
  });

  it('shows success on valid token', async () => {
    const { validateToken } = await import('../../commands/auth');
    (validateToken as any).mockResolvedValue(mockUserInfo);

    const { default: LoginScreen } = await import('./LoginScreen');
    render(createElement(LoginScreen));

    // Switch to token mode
    fireEvent.click(screen.getByText('Use access token instead'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('hf_...')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('hf_...');
    fireEvent.change(input, { target: { value: 'hf_valid' } });

    const submitBtn = screen.getByRole('button', { name: 'Sign in' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Welcome, testuser!')).toBeTruthy();
    });
  });

  it('disables submit when input is empty', async () => {
    const { default: LoginScreen } = await import('./LoginScreen');
    render(createElement(LoginScreen));

    // Switch to token mode
    fireEvent.click(screen.getByText('Use access token instead'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('hf_...')).toBeTruthy();
    });

    const submitBtn = screen.getByRole('button', { name: 'Sign in' });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
