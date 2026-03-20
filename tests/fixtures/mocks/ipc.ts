import type { Page } from '@playwright/test';
import { mockUserInfo } from '../data/users';

// Map of Tauri command names (snake_case) to mock return values
// These are the raw return values (before tauri-specta wraps in Result)
export const ipcHandlers: Record<string, (args?: any) => any> = {
  // Auth commands
  check_existing_token: () => null,
  get_stored_token: () => null,
  validate_token: () => mockUserInfo,
  logout: () => null,

  // OAuth commands
  oauth_start: () => 'https://huggingface.co/oauth/authorize?client_id=test',
  oauth_exchange_code: () => mockUserInfo,
  oauth_cancel: () => null,

  // Upload commands — upload.ts uses raw invoke() + local unwrap(), so these must
  // return { status: 'ok', data: T } (not raw values like auth commands via bindings.ts)
  enqueue_upload: () => ({ status: 'ok', data: {
    id: 'job-001',
    file_path: '/tmp/test.txt',
    file_name: 'test.txt',
    repo_id: 'testuser/test-model',
    repo_type: 'model',
    revision: 'main',
    commit_message: 'Upload test.txt',
    total_bytes: 1024,
    bytes_confirmed: 0,
    protocol: null,
    state: 'pending',
    priority: false,
    retry_count: 0,
    last_error: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  }}),
  cancel_upload: () => ({ status: 'ok', data: null }),
  pause_upload: () => ({ status: 'ok', data: null }),
  resume_upload: () => ({ status: 'ok', data: null }),
  pause_all_uploads: () => ({ status: 'ok', data: 0 }),
  list_uploads: () => ({ status: 'ok', data: [] }),
  set_upload_priority: () => ({ status: 'ok', data: null }),
  start_upload_monitoring: () => ({ status: 'ok', data: null }),
  set_concurrent_limit: () => ({ status: 'ok', data: null }),
};

/**
 * Inject Tauri IPC mocks into the page before it loads.
 * Must be called BEFORE page.goto() — uses addInitScript so it runs
 * before any app scripts execute.
 *
 * @param page - Playwright Page object
 */
export async function setupTauriMocks(page: Page): Promise<void> {
  // Serialize handlers to pass into browser context
  // We can't pass functions directly, so we stringify the return values map
  const handlerMap: Record<string, any> = {};
  for (const [cmd, fn] of Object.entries(ipcHandlers)) {
    handlerMap[cmd] = fn();
  }

  await page.addInitScript((handlers: Record<string, any>) => {
    // Callback registry for transformCallback (used by listen/event system)
    let callbackId = 0;
    const callbackRegistry: Record<number, (...args: any[]) => void> = {};

    // window.__TAURI_INTERNALS__ is the v2 Tauri IPC entry point
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, _args?: any) => {
        // Silence Tauri event system commands (listen/unlisten/emit)
        if (cmd === 'plugin:event|listen') return 1;
        if (cmd === 'plugin:event|unlisten') return null;
        if (cmd === 'plugin:event|emit') return null;
        if (cmd === 'plugin:event|emit_to') return null;
        // Silence Tauri webview/window commands
        if (cmd === 'plugin:webview|get_all_webviews') return [];
        if (cmd === 'plugin:window|get_all_windows') return [];
        // Silence opener plugin
        if (cmd === 'plugin:opener|open_url') return null;
        if (cmd === 'plugin:opener|reveal_item_in_dir') return null;
        // Silence updater plugin
        if (cmd === 'plugin:updater|check') return null;
        if (cmd in handlers) {
          return handlers[cmd];
        }
        // For unknown commands, return null rather than throw (graceful degradation)
        console.warn(`[IPC Mock] Unhandled command: ${cmd}`);
        return null;
      },
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main', windowLabel: 'main' },
      },
      convertFileSrc: (path: string) => path,
      transformCallback: (callback: (...args: any[]) => void, once?: boolean) => {
        const id = ++callbackId;
        callbackRegistry[id] = (...args: any[]) => {
          callback(...args);
          if (once) delete callbackRegistry[id];
        };
        return id;
      },
    };

    // Expose callback registry globally so tests can trigger events
    (window as any).__tauriCallbackRegistry = callbackRegistry;
  }, handlerMap);
}
