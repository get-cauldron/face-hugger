import { useState, FormEvent } from 'react';
import { CheckCircle } from 'lucide-react';
import { validateToken } from '@/commands/auth';
import { useAuthStore } from '@/stores/authStore';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { UserInfo } from '@/lib/types';

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const [tokenInput, setTokenInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successUser, setSuccessUser] = useState<UserInfo | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || isValidating) return;

    setIsValidating(true);
    setErrorMessage(null);

    try {
      const userInfo = await validateToken(tokenInput.trim());
      // Cast to our local UserInfo type (bindings UserInfo is compatible)
      setSuccessUser(userInfo as unknown as UserInfo);

      // After 1 second flash, transition to app shell
      setTimeout(() => {
        setAuth(tokenInput.trim(), userInfo as unknown as UserInfo);
      }, 1000);
    } catch (err) {
      setErrorMessage(
        typeof err === 'string' ? err : 'Invalid token — check your HF settings'
      );
      setIsValidating(false);
    }
  };

  const handleOpenTokenPage = async () => {
    try {
      await openUrl('https://huggingface.co/settings/tokens');
    } catch {
      // Fallback: do nothing if opener fails
    }
  };

  // Success flash state
  if (successUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="max-w-md w-full mx-auto p-8 bg-card rounded-2xl border border-border shadow-xl flex flex-col items-center gap-4">
          <CheckCircle className="w-16 h-16 text-green-500" />
          {successUser.avatar_url && (
            <img
              src={successUser.avatar_url}
              alt={successUser.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          )}
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              Welcome, {successUser.name}!
            </p>
            <p className="text-sm text-muted-foreground">Signing you in...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="max-w-md w-full mx-auto p-8 bg-card rounded-2xl border border-border shadow-xl">
        {/* Icon */}
        <img
          src="/icon.png"
          alt="Face Hugger"
          className="w-16 h-16 mx-auto mb-4 rounded-xl"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Heading */}
        <h1 className="text-2xl font-bold text-center text-foreground mb-2">
          Welcome to Face Hugger
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground text-center mb-6">
          Paste your Hugging Face access token to get started
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <input
              type="password"
              placeholder="hf_..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              disabled={isValidating}
              className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50 transition-colors"
            />
            {errorMessage && (
              <p className="text-destructive text-sm mt-2">{errorMessage}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isValidating || !tokenInput.trim()}
            className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isValidating ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Link to get token */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          Don&apos;t have a token?{' '}
          <button
            type="button"
            onClick={handleOpenTokenPage}
            className="text-primary hover:underline"
          >
            Get one here
          </button>
        </p>
      </div>
    </div>
  );
}
