import { getCurrentWindow } from '@tauri-apps/api/window';

export default function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div
      className="h-10 bg-sidebar flex items-center justify-between px-3 w-full select-none"
      data-tauri-drag-region
    >
      <span
        className="text-sm font-medium text-sidebar-foreground pl-20"
        data-tauri-drag-region
      >
        Face Hugger
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => appWindow.minimize()}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/10 text-sidebar-foreground"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/10 text-sidebar-foreground"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.close()}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-500/80 text-sidebar-foreground"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
