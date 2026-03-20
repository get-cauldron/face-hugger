import { test, expect } from '@playwright/test';
import { ipcHandlers } from '../fixtures/mocks/ipc';
import { mockUserInfo } from '../fixtures/data/users';
import { mockModelRepo } from '../fixtures/data/repos';

// Build authenticated IPC handler map
function buildAuthHandlerMap() {
  const handlerMap: Record<string, any> = {};
  for (const [cmd, fn] of Object.entries(ipcHandlers)) {
    handlerMap[cmd] = fn();
  }
  handlerMap['check_existing_token'] = 'hf_test';
  handlerMap['validate_token'] = mockUserInfo;
  return handlerMap;
}

// HF API mock data for model repo listing
const modelApiResponse = [{
  _id: 'abc123',
  id: mockModelRepo.id,       // "testuser/test-model"
  private: false,
  downloads: 100,
  likes: 10,
  lastModified: mockModelRepo.lastModified,
  tags: mockModelRepo.tags,
}];

// File tree API response
const fileTreeApiResponse = [
  { type: 'file', oid: 'aaa111', path: 'README.md', size: 1024 },
  { type: 'file', oid: 'bbb222', path: 'model.safetensors', size: 2048000 },
];

// Commits API response
const commitsApiResponse = [
  {
    id: 'sha1abc',
    title: 'Initial commit',
    message: 'Initial commit with model files',
    authors: [{ user: 'testuser', avatar: 'https://example.com/av.png' }],
    date: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sha2def',
    title: 'Update README',
    message: 'Update README with usage instructions',
    authors: [{ user: 'testuser', avatar: 'https://example.com/av.png' }],
    date: '2026-01-02T00:00:00Z',
  },
];

test.describe('repo management', () => {
  test.beforeEach(async ({ page }) => {
    // Set up HF API route mocks before navigation
    await page.route('**/api/models**', (route) => {
      // Distinguish between listing and file tree
      const url = route.request().url();
      if (url.includes('/tree/')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fileTreeApiResponse),
        });
      } else if (url.includes('/commits/')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(commitsApiResponse),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(modelApiResponse),
        });
      }
    });
    await page.route('**/api/datasets**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Set up IPC mocks with auth
    const handlerMap = buildAuthHandlerMap();
    await page.addInitScript((handlers: Record<string, any>) => {
      let callbackId = 0;
      const callbackRegistry: Record<number, (...args: any[]) => void> = {};

      (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, _args?: any) => {
          if (cmd === 'plugin:event|listen') return 1;
          if (cmd === 'plugin:event|unlisten') return null;
          if (cmd === 'plugin:event|emit') return null;
          if (cmd === 'plugin:event|emit_to') return null;
          if (cmd === 'plugin:webview|get_all_webviews') return [];
          if (cmd === 'plugin:window|get_all_windows') return [];
          if (cmd === 'plugin:opener|open_url') return null;
          if (cmd === 'plugin:updater|check') return null;
          if (cmd in handlers) {
            return handlers[cmd];
          }
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
      (window as any).__tauriCallbackRegistry = callbackRegistry;
    }, handlerMap);

    await page.goto('/');
    await expect(page.getByText('testuser')).toBeVisible({ timeout: 8000 });
    // Navigate to Models section
    await page.getByRole('button', { name: 'Models' }).click();
  });

  test('browse repos and open file browser', async ({ page }) => {
    // Model repo name "test-model" should appear in the grid
    await expect(page.getByText('test-model')).toBeVisible({ timeout: 8000 });

    // Click on the repo card to navigate to repo browser
    await page.getByText('test-model').click();

    // Repo browser should show the repo ID in header
    await expect(page.getByText('testuser/test-model')).toBeVisible({ timeout: 5000 });

    // File tree should show the files
    await expect(page.getByText('README.md')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('model.safetensors')).toBeVisible({ timeout: 5000 });
  });

  test('commit history shows timeline', async ({ page }) => {
    // Navigate to repo browser
    await expect(page.getByText('test-model')).toBeVisible({ timeout: 8000 });
    await page.getByText('test-model').click();
    await expect(page.getByText('testuser/test-model')).toBeVisible({ timeout: 5000 });

    // Click the History tab
    await page.getByRole('button', { name: 'History' }).click();

    // At least one commit message should be visible
    await expect(page.getByText('Initial commit')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Update README')).toBeVisible({ timeout: 5000 });
  });

  test('delete file dialog appears', async ({ page }) => {
    // Navigate to repo browser
    await expect(page.getByText('test-model')).toBeVisible({ timeout: 8000 });
    await page.getByText('test-model').click();
    await expect(page.getByText('testuser/test-model')).toBeVisible({ timeout: 5000 });

    // Wait for files to load
    await expect(page.getByText('README.md')).toBeVisible({ timeout: 5000 });

    // Trigger delete repo dialog by clicking "Delete Repository" button in the header
    await page.getByRole('button', { name: 'Delete Repository' }).first().click();

    // Confirmation dialog should appear — check for the dialog heading
    await expect(page.getByRole('heading', { name: /Delete testuser\/test-model/i })).toBeVisible({ timeout: 3000 });
  });

  test('create repo flow', async ({ page }) => {
    // On Models page (beforeEach navigated to Models), click "New Repository" button
    await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'New Repository' }).click();

    // Create repo sheet should appear with a name input (placeholder "my-model")
    await expect(page.getByPlaceholder('my-model')).toBeVisible({ timeout: 3000 });
  });
});
