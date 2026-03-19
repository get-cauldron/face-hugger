import { useState, FormEvent } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import {
  oauthStart,
  oauthExchangeCode,
  oauthCancel,
  validateToken,
  getStoredToken,
} from '@/commands/auth';
import { useAuthStore } from '@/stores/authStore';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { UserInfo } from '@/lib/types';

export default function LoginScreen() {
  const { setAuth, oauthStatus, oauthError, setOauthStatus } = useAuthStore();
  const [loginMode, setLoginMode] = useState<'oauth' | 'token'>('oauth');
  const [tokenInput, setTokenInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [successUser, setSuccessUser] = useState<UserInfo | null>(null);

  // OAuth flow handler
  async function handleOAuthStart() {
    setOauthStatus('waiting');
    try {
      const authUrl = await oauthStart();
      await openUrl(authUrl);

      // Listen for callback from Rust
      const unlisten = await listen<string>('oauth-callback', async (event) => {
        unlisten();
        try {
          const userInfo = await oauthExchangeCode(event.payload);
          // Token is now stored in keyring by Rust — retrieve it for the frontend store
          const token = await getStoredToken();
          if (token) {
            setSuccessUser(userInfo as unknown as UserInfo);
            setTimeout(() => {
              setAuth(token, userInfo as unknown as UserInfo);
              setOauthStatus('idle');
            }, 1000);
          } else {
            setOauthStatus('error', 'Sign-in succeeded but token retrieval failed');
          }
        } catch (err) {
          setOauthStatus('error', typeof err === 'string' ? err : (err instanceof Error ? err.message : 'Sign-in failed'));
        }
      });
    } catch (err) {
      setOauthStatus('error', typeof err === 'string' ? err : (err instanceof Error ? err.message : 'Could not start OAuth flow'));
    }
  }

  async function handleOAuthCancel() {
    try {
      await oauthCancel();
    } catch {
      // Ignore cancel errors
    }
    setOauthStatus('idle');
  }

  // Token paste flow handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || isValidating) return;

    setIsValidating(true);
    setTokenError(null);

    try {
      const userInfo = await validateToken(tokenInput.trim());
      setSuccessUser(userInfo as unknown as UserInfo);

      setTimeout(() => {
        setAuth(tokenInput.trim(), userInfo as unknown as UserInfo);
      }, 1000);
    } catch (err) {
      setTokenError(
        typeof err === 'string' ? err : (err instanceof Error ? err.message : 'Invalid token — check your HF settings')
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

        {/* Token fallback mode */}
        {loginMode === 'token' && (
          <>
            <h1 className="text-xl font-semibold text-center text-foreground mb-2">
              Sign in to Face Hugger
            </h1>
            <p className="text-muted-foreground text-center mb-6 text-sm">
              Paste your Hugging Face access token below
            </p>

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
                {tokenError && (
                  <p className="text-destructive text-sm mt-2">{tokenError}</p>
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

            <p className="text-center text-sm text-muted-foreground mt-3">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('oauth');
                  setTokenError(null);
                  setOauthStatus('idle');
                }}
                className="hover:text-foreground cursor-pointer transition-colors"
              >
                Back to OAuth sign-in
              </button>
            </p>
          </>
        )}

        {/* OAuth mode — waiting state */}
        {loginMode === 'oauth' && oauthStatus === 'waiting' && (
          <>
            <div className="flex flex-col items-center gap-3 mb-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <h1 className="text-xl font-semibold text-center text-foreground">
                Waiting for browser login...
              </h1>
              <p className="text-sm text-muted-foreground text-center">
                Complete sign-in in your browser, then return here.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOAuthCancel}
              className="w-full py-2 px-4 rounded-lg border border-border text-foreground hover:bg-secondary font-medium transition-colors"
            >
              Cancel Sign-in
            </button>
          </>
        )}

        {/* OAuth mode — error state */}
        {loginMode === 'oauth' && oauthStatus === 'error' && (
          <>
            <h1 className="text-xl font-semibold text-center text-foreground mb-2">
              Sign in to Face Hugger
            </h1>
            {oauthError && (
              <p className="text-destructive text-sm text-center mb-2">{oauthError}</p>
            )}
            <p className="text-center text-sm mb-6">
              <button
                type="button"
                onClick={() => setOauthStatus('idle')}
                className="text-primary hover:underline"
              >
                Try again
              </button>
            </p>

            <button
              type="button"
              onClick={handleOAuthStart}
              className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity min-h-[44px]"
            >
              Sign in with Hugging Face
            </button>

            <p className="text-center text-sm text-muted-foreground mt-4">
              <button
                type="button"
                onClick={() => setLoginMode('token')}
                className="hover:text-foreground cursor-pointer transition-colors"
              >
                Use access token instead
              </button>
            </p>
          </>
        )}

        {/* OAuth mode — default/idle state */}
        {loginMode === 'oauth' && oauthStatus === 'idle' && (
          <>
            <h1 className="text-xl font-semibold text-center text-foreground mb-2">
              Sign in to Face Hugger
            </h1>
            <p className="text-muted-foreground text-center mb-6 text-sm">
              Sign in with your Hugging Face account
            </p>

            <button
              type="button"
              onClick={handleOAuthStart}
              className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity min-h-[44px]"
            >
              Sign in with Hugging Face
            </button>

            <p className="text-center text-sm text-muted-foreground mt-4">
              <button
                type="button"
                onClick={() => setLoginMode('token')}
                className="hover:text-foreground cursor-pointer transition-colors"
              >
                Use access token instead
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
