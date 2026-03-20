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

  // Upload commands
  enqueue_upload: () => ({
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
  }),
  cancel_upload: () => null,
  pause_upload: () => null,
  resume_upload: () => null,
  pause_all_uploads: () => 0,
  list_uploads: () => [],
  set_upload_priority: () => null,
  start_upload_monitoring: () => null,
  set_concurrent_limit: () => null,
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
    // window.__TAURI_INTERNALS__ is the v2 Tauri IPC entry point
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, _args?: any) => {
        if (cmd in handlers) {
          return handlers[cmd];
        }
        throw new Error(`No IPC mock for command: ${cmd}`);
      },
      metadata: {
        currentWindow: { label: 'main' },
      },
      convertFileSrc: (path: string) => path,
    };
  }, handlerMap);
}
