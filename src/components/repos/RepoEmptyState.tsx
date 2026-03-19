import { Package } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';

interface RepoEmptyStateProps {
  type: 'model' | 'dataset';
}

export default function RepoEmptyState({ type }: RepoEmptyStateProps) {
  const label = type === 'model' ? 'model' : 'dataset';

  const handleCreate = () => {
    openUrl('https://huggingface.co/new');
  };

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Package className="w-16 h-16 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">
        No {label}s yet
      </h3>
      <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
        Create your first {label} on Hugging Face to see it here
      </p>
      <button
        onClick={handleCreate}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Create a {label}
      </button>
    </div>
  );
}
