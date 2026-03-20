import { test, expect } from '@playwright/test';
import { setupTauriMocks, ipcHandlers } from '../fixtures/mocks/ipc';
import { mockUserInfo } from '../fixtures/data/users';
import { mockModelRepo, mockDatasetRepo } from '../fixtures/data/repos';

// Build an authenticated IPC handler map
function buildAuthHandlerMap() {
  const handlerMap: Record<string, any> = {};
  for (const [cmd, fn] of Object.entries(ipcHandlers)) {
    handlerMap[cmd] = fn();
  }
  handlerMap['check_existing_token'] = 'hf_test';
  handlerMap['validate_token'] = mockUserInfo;
  return handlerMap;
}

// @huggingface/hub listModels/listDatasets fetch JSON arrays.
// Fields: _id (hex id), id (slug), private, downloads, likes, lastModified, tags.
const modelApiResponse = [{
  _id: 'abc123',
  id: mockModelRepo.id,
  private: false,
  downloads: 100,
  likes: 10,
  lastModified: mockModelRepo.lastModified,
  tags: mockModelRepo.tags,
}];
const datasetApiResponse = [{
  _id: 'def456',
  id: mockDatasetRepo.id,
  private: false,
  downloads: 50,
  likes: 5,
  lastModified: mockDatasetRepo.lastModified,
  tags: mockDatasetRepo.tags,
}];

test.describe('upload wizard', () => {
  test.beforeEach(async ({ page }) => {
    // Set up HF API route mocks BEFORE page navigation so React Query
    // picks them up on initial fetch.
    await page.route('**/api/models**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(modelApiResponse),
      });
    });
    await page.route('**/api/datasets**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(datasetApiResponse),
      });
    });

    // Set up Tauri IPC mocks with auth enabled
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

    // Wait for app shell to load (authenticated)
    await expect(page.getByText('testuser')).toBeVisible({ timeout: 8000 });

    // Click Upload in sidebar
    await page.getByRole('button', { name: 'Upload' }).click();
  });

  test('wizard shows step 1 (Select Repo)', async ({ page }) => {
    // Step 1 label "Select Repo" should be visible in step indicator
    await expect(page.getByText('Select Repo')).toBeVisible();

    // Next button should be disabled because no repo is selected
    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeDisabled();
  });

  test('wizard advances through all 3 steps', async ({ page }) => {
    // Wait for repo list to load (routes were set up before page.goto)
    await expect(page.getByText('testuser/test-model')).toBeVisible({ timeout: 8000 });
    await page.getByText('testuser/test-model').click();

    // Next should be enabled now; click to advance to step 2
    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Step 2: "Select Files" should be active
    await expect(page.getByText('Select Files')).toBeVisible();

    // Inject files using page.evaluate — bypass the native file dialog.
    // We locate the UploadWizard component fiber and call the setFiles state dispatch.
    await page.evaluate(() => {
      function findReactFiber(el: Element): any {
        const keys = Object.keys(el);
        const fiberKey = keys.find((k) => k.startsWith('__reactFiber'));
        return fiberKey ? (el as any)[fiberKey] : null;
      }

      function getStateAtIndex(fiberMemoizedState: any, index: number): any {
        let hook = fiberMemoizedState;
        for (let i = 0; i < index && hook; i++) {
          hook = hook.next;
        }
        return hook;
      }

      // Walk the document to find the UploadWizard component fiber
      const allDivs = Array.from(document.querySelectorAll('div'));
      for (const div of allDivs) {
        const fiber = findReactFiber(div);
        if (!fiber) continue;

        // Walk up the fiber tree to find UploadWizard
        let current = fiber;
        while (current) {
          if (
            current.type &&
            typeof current.type === 'function' &&
            current.type.name === 'UploadWizard' &&
            current.memoizedState
          ) {
            // UploadWizard state hooks in order:
            // 0: currentStep (number)
            // 1: selectedRepo (RepoItem | null)
            // 2: files (FileEntry[])
            // 3: commitMessage (string)
            const filesHook = getStateAtIndex(current.memoizedState, 2);
            if (filesHook && filesHook.queue && typeof filesHook.queue.dispatch === 'function') {
              filesHook.queue.dispatch([
                { path: '/tmp/test.safetensors', name: 'test.safetensors', size: 102400 },
              ]);
              return 'dispatched';
            }
          }
          current = current.return;
        }
      }
      return 'not found';
    });

    // Wait for file to appear in the file list
    await expect(page.getByText('test.safetensors')).toBeVisible({ timeout: 3000 });

    // Click Review to advance to step 3
    await page.getByRole('button', { name: 'Review' }).click();

    // Step 3: "Review & Upload" should be visible
    await expect(page.getByText('Review & Upload')).toBeVisible();
  });

  test('wizard step 3 shows review with commit message', async ({ page }) => {
    // Select repo
    await expect(page.getByText('testuser/test-model')).toBeVisible({ timeout: 8000 });
    await page.getByText('testuser/test-model').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Inject files
    await page.evaluate(() => {
      function findReactFiber(el: Element): any {
        const keys = Object.keys(el);
        const fiberKey = keys.find((k) => k.startsWith('__reactFiber'));
        return fiberKey ? (el as any)[fiberKey] : null;
      }

      function getStateAtIndex(fiberMemoizedState: any, index: number): any {
        let hook = fiberMemoizedState;
        for (let i = 0; i < index && hook; i++) {
          hook = hook.next;
        }
        return hook;
      }

      const allDivs = Array.from(document.querySelectorAll('div'));
      for (const div of allDivs) {
        const fiber = findReactFiber(div);
        if (!fiber) continue;
        let current = fiber;
        while (current) {
          if (
            current.type &&
            typeof current.type === 'function' &&
            current.type.name === 'UploadWizard' &&
            current.memoizedState
          ) {
            const filesHook = getStateAtIndex(current.memoizedState, 2);
            if (filesHook && filesHook.queue && typeof filesHook.queue.dispatch === 'function') {
              filesHook.queue.dispatch([
                { path: '/tmp/test.safetensors', name: 'test.safetensors', size: 102400 },
              ]);
              return;
            }
          }
          current = current.return;
        }
      }
    });

    await expect(page.getByText('test.safetensors')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: 'Review' }).click();

    // Step 3 should show commit message textarea
    await expect(page.getByPlaceholder('Add files via Face Hugger')).toBeVisible();

    // Upload button should exist (disabled until commit message is filled)
    // "Upload 1 file" is the submit button rendered by StepReview
    await expect(page.getByRole('button', { name: /Upload \d+ file/ })).toBeVisible();
  });
});
