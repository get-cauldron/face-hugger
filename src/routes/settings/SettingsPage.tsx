import { useAuthStore } from '../../stores/authStore';
import { logout } from '../../commands/auth';

export default function SettingsPage() {
  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Even if Rust-side logout fails, clear the JS auth state
    }
    clearAuth();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-foreground)] mb-6">Settings</h1>

      {/* User info section */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">
          Account
        </h2>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-center gap-4 mb-4">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-12 h-12 rounded-full border border-[var(--color-border)]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--color-secondary)] flex items-center justify-center text-lg font-bold text-[var(--color-foreground)]">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <p className="font-medium text-[var(--color-foreground)]">{user?.name ?? 'Unknown'}</p>
              {user?.fullname && (
                <p className="text-sm text-[var(--color-muted-foreground)]">{user.fullname}</p>
              )}
              {user?.email && (
                <p className="text-sm text-[var(--color-muted-foreground)]">{user.email}</p>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Token stored securely in OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service)
            </p>
          </div>
        </div>
      </section>

      {/* Theme section */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">
          Appearance
        </h2>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Light mode coming soon
          </p>
        </div>
      </section>

      {/* Logout section */}
      <section>
        <h2 className="text-sm font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">
          Session
        </h2>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
            Sign out and remove your token from the OS keychain.
          </p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
