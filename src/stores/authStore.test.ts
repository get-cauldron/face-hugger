import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('should start with unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('should set authenticated state with setAuth', () => {
    const mockUser = { name: 'testuser', fullname: 'Test User', avatar_url: null, email: null, type: null };
    useAuthStore.getState().setAuth('hf_test_token', mockUser);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('hf_test_token');
    expect(state.user).toEqual(mockUser);
  });

  it('should clear authenticated state with clearAuth', () => {
    const mockUser = { name: 'testuser', fullname: 'Test User', avatar_url: null, email: null, type: null };
    useAuthStore.getState().setAuth('hf_test_token', mockUser);
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });
});
