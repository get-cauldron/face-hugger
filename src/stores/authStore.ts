import { create } from 'zustand';
import type { UserInfo } from '../lib/types';

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  oauthStatus: 'idle' | 'waiting' | 'error';
  oauthError: string | null;
  setAuth: (token: string, user: UserInfo) => void;
  clearAuth: () => void;
  setOauthStatus: (status: 'idle' | 'waiting' | 'error', error?: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  oauthStatus: 'idle',
  oauthError: null,
  setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
  clearAuth: () => set({ token: null, user: null, isAuthenticated: false }),
  setOauthStatus: (status, error) => set({ oauthStatus: status, oauthError: error ?? null }),
}));
