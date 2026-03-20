import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { logout } from '../../commands/auth';
import { setConcurrentLimit } from '../../commands/upload';
import { getPreference } from '../../lib/preferences';

export default function SettingsPage() {
  const { user, clearAuth } = useAuthStore();
  const [concurrentLimit, setConcurrentLimitState] = useState(2);

  useEffect(() => {
    getPreference<number>('concurrent_upload_limit', 2).then(setConcurrentLimitState);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Even if Rust-side logout fails, clear the JS auth state
    }
    clearAuth();
  };

  const handleLimitChange = async (newLimit: number) => {
    setConcurrentLimitState(newLimit);
    await setConcurrentLimit(newLimit);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      {/* User info section */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Account
        </h2>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-4 mb-4">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-12 h-12 rounded-full border border-border"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-foreground">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <p className="font-medium text-foreground">{user?.name ?? 'Unknown'}</p>
              {user?.fullname && (
                <p className="text-sm text-muted-foreground">{user.fullname}</p>
              )}
              {user?.email && (
                <p className="text-sm text-muted-foreground">{user.email}</p>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Token stored securely in OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service)
            </p>
          </div>
        </div>
      </section>

      {/* Theme section */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Appearance
        </h2>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">
            Light mode coming soon
          </p>
        </div>
      </section>

      {/* Uploads section */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Uploads
        </h2>
        <div className="bg-card border border-border rounded-xl p-5">
          <div>
            <p className="text-sm font-medium text-foreground">Concurrent upload limit</p>
            <p className="text-sm text-muted-foreground">
              Maximum number of files uploading simultaneously (1-5)
            </p>
            <div className="flex gap-2 mt-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => handleLimitChange(n)}
                  className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                    concurrentLimit === n
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Logout section */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Session
        </h2>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground mb-4">
            Sign out and remove your token from the OS keychain.
          </p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
