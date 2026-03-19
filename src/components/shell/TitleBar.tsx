import { WindowTitlebar } from 'tauri-controls';

export default function TitleBar() {
  return (
    <WindowTitlebar
      className="h-10 bg-[var(--color-sidebar)] flex items-center px-3 w-full"
      data-tauri-drag-region
    >
      <span className="text-sm font-medium text-[var(--color-sidebar-foreground)] pl-20">
        Face Hugger
      </span>
    </WindowTitlebar>
  );
}
