import { test, expect } from '@playwright/test';
import { ipcHandlers } from '../fixtures/mocks/ipc';
import { mockUserInfo } from '../fixtures/data/users';
import { mockDatasetRepo } from '../fixtures/data/repos';
import { mockDatasetRows } from '../fixtures/data/datasets';

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

// HF API mock responses
const datasetApiResponse = [{
  _id: 'def456',
  id: mockDatasetRepo.id,       // "testuser/test-dataset"
  private: false,
  downloads: 50,
  likes: 5,
  lastModified: mockDatasetRepo.lastModified,
  tags: mockDatasetRepo.tags,
}];

const fileTreeApiResponse = [
  { type: 'file', oid: 'ccc333', path: 'data.csv', size: 4096 },
];

// Dataset preview API responses (datasets-server.huggingface.co)
const isValidResponse = { viewer: true, preview: true };
const splitsResponse = {
  splits: [{ config: 'default', split: 'train' }],
};
const rowsResponse = {
  features: [
    { name: 'text', type: { _type: 'Value', dtype: 'string' } },
    { name: 'label', type: { _type: 'Value', dtype: 'int64' } },
  ],
  rows: mockDatasetRows.map((row, idx) => ({
    row_idx: idx,
    row_id: `${idx}`,
    truncated_cells: [],
    row,
  })),
  num_rows_total: mockDatasetRows.length,
  num_rows_per_page: 50,
  partial: false,
};

test.describe('dataset preview', () => {
  test.beforeEach(async ({ page }) => {
    // HF API routes
    await page.route('**/api/models**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/datasets**', (route) => {
      const url = route.request().url();
      if (url.includes('/tree/')) {
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(fileTreeApiResponse),
        });
      } else if (url.includes('/commits/')) {
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(datasetApiResponse),
        });
      }
    });

    // Dataset preview server routes
    await page.route('**/datasets-server.huggingface.co/is-valid**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isValidResponse) });
    });
    await page.route('**/datasets-server.huggingface.co/splits**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(splitsResponse) });
    });
    await page.route('**/datasets-server.huggingface.co/rows**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rowsResponse) });
    });
    await page.route('**/datasets-server.huggingface.co/search**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rowsResponse) });
    });
    await page.route('**/datasets-server.huggingface.co/statistics**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ statistics: [] }) });
    });

    // IPC mocks
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
    // Navigate to Datasets section
    await page.getByRole('button', { name: 'Datasets' }).click();
  });

  test('dataset list shows datasets', async ({ page }) => {
    // Dataset repo name "test-dataset" should appear in the grid
    await expect(page.getByText('test-dataset')).toBeVisible({ timeout: 8000 });
  });

  test('dataset preview shows rows', async ({ page }) => {
    // Navigate to dataset repo browser
    await expect(page.getByText('test-dataset')).toBeVisible({ timeout: 8000 });
    await page.getByText('test-dataset').click();

    // Repo browser header should show the dataset ID
    await expect(page.getByText('testuser/test-dataset')).toBeVisible({ timeout: 5000 });

    // Click the Preview tab (only visible for datasets)
    await page.getByRole('button', { name: 'Preview' }).click();

    // Dataset rows should appear — check for row values from mockDatasetRows
    await expect(page.getByText('The quick brown fox')).toBeVisible({ timeout: 8000 });
  });

  test('dataset search filters rows', async ({ page }) => {
    // Navigate to dataset preview
    await expect(page.getByText('test-dataset')).toBeVisible({ timeout: 8000 });
    await page.getByText('test-dataset').click();
    await expect(page.getByText('testuser/test-dataset')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Preview' }).click();

    // Wait for rows to load
    await expect(page.getByText('The quick brown fox')).toBeVisible({ timeout: 8000 });

    // Find the search input and type a query
    const searchInput = page.getByPlaceholder('Search rows...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Machine learning');

    // The search input has the typed value
    await expect(searchInput).toHaveValue('Machine learning');
  });

  test('column stats panel opens', async ({ page }) => {
    // Navigate to dataset preview
    await expect(page.getByText('test-dataset')).toBeVisible({ timeout: 8000 });
    await page.getByText('test-dataset').click();
    await expect(page.getByText('testuser/test-dataset')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Preview' }).click();

    // Wait for rows to load, then click on a column header to open stats panel
    await expect(page.getByText('The quick brown fox')).toBeVisible({ timeout: 8000 });

    // Click the "text" column header button to open stat panel
    await page.getByRole('button', { name: 'text' }).click();

    // Stats panel should appear — shows "No statistics available." when no stats data
    await expect(page.getByText('No statistics available.')).toBeVisible({ timeout: 3000 });
  });
});
