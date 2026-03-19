import { useState, useEffect } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export default function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    check()
      .then((u) => { if (u) setUpdate(u); })
      .catch(() => {}); // Non-fatal — never block app launch
  }, []);

  if (!update || dismissed) return null;

  const handleUpdate = async () => {
    setDownloading(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between bg-card border-b border-border px-4 h-12 flex-shrink-0">
      <div className="flex items-center gap-2">
        <ArrowUpCircle className="w-4 h-4 text-primary" />
        <span className="text-sm text-foreground">
          Version {update.version} is available
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleUpdate}
          disabled={downloading}
          className="text-sm text-primary hover:underline cursor-pointer disabled:opacity-50"
        >
          {downloading ? 'Downloading...' : 'Update now'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
