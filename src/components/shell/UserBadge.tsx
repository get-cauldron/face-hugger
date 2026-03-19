import { User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { logout } from '@/commands/auth';

export default function UserBadge() {
  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Proceed with clearing auth even if Rust command fails
    }
    clearAuth();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 p-3 hover:bg-[var(--color-secondary)] rounded-lg w-full transition-colors"
      title="Click to log out"
    >
      {user?.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.name}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[var(--color-secondary)] flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-[var(--color-muted-foreground)]" />
        </div>
      )}
      <span className="text-sm text-[var(--color-sidebar-foreground)] truncate">
        {user?.name ?? 'Unknown'}
      </span>
    </button>
  );
}
