import { test, expect } from '@playwright/test';
import { setupTauriMocks, ipcHandlers } from '../fixtures/mocks/ipc';
import { mockUserInfo } from '../fixtures/data/users';

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
  await page.goto('/');
});

test('token paste login succeeds', async ({ page }) => {
  // Override validate_token after page load to return mockUserInfo
  await page.evaluate((user) => {
    const orig = (window as any).__TAURI_INTERNALS__;
    const origInvoke = orig.invoke;
    orig.invoke = async (cmd: string, args?: any) => {
      if (cmd === 'validate_token') return user;
      return origInvoke(cmd, args);
    };
  }, mockUserInfo);

  // Switch to token mode
  await page.getByRole('button', { name: 'Use access token instead' }).click();

  // Fill token input and submit
  await page.getByPlaceholder('hf_...').fill('hf_testtoken123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Assert welcome flash appears
  await expect(page.getByText('Welcome, testuser!')).toBeVisible({ timeout: 5000 });
});

test('token paste login shows error on invalid token', async ({ page }) => {
  // Override validate_token to throw
  await page.evaluate(() => {
    const orig = (window as any).__TAURI_INTERNALS__;
    const origInvoke = orig.invoke;
    orig.invoke = async (cmd: string, args?: any) => {
      if (cmd === 'validate_token') throw new Error('Invalid token');
      return origInvoke(cmd, args);
    };
  });

  // Switch to token mode
  await page.getByRole('button', { name: 'Use access token instead' }).click();

  // Fill and submit
  await page.getByPlaceholder('hf_...').fill('hf_badtoken');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Assert error message
  await expect(page.getByText('Invalid token')).toBeVisible({ timeout: 5000 });
});

test('OAuth mode shows waiting state', async ({ page }) => {
  // Override oauth_start and silence the opener plugin call
  await page.evaluate(() => {
    const orig = (window as any).__TAURI_INTERNALS__;
    const origInvoke = orig.invoke;
    orig.invoke = async (cmd: string, args?: any) => {
      if (cmd === 'oauth_start') return 'https://huggingface.co/oauth/authorize?client_id=test';
      return origInvoke(cmd, args);
    };
  });

  // Click "Sign in with Hugging Face"
  await page.getByRole('button', { name: 'Sign in with Hugging Face' }).click();

  // Assert waiting state text and cancel button
  await expect(page.getByText('Waiting for browser login...')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Cancel Sign-in' })).toBeVisible();
});

test('logout clears session', async ({ page }) => {
  // Build handlers map with check_existing_token returning a token
  // so the app starts authenticated on the next navigation.
  const handlerMap: Record<string, any> = {};
  for (const [cmd, fn] of Object.entries(ipcHandlers)) {
    handlerMap[cmd] = fn();
  }
  // Override auth to simulate an existing session
  handlerMap['check_existing_token'] = 'hf_test';
  handlerMap['validate_token'] = mockUserInfo;

  // Add a new init script BEFORE the second page.goto — it runs alongside the
  // setupTauriMocks init script from beforeEach. We use a SEPARATE __TAURI_INTERNALS__
  // replacement that has the updated handlers baked in.
  await page.addInitScript((handlers: Record<string, any>) => {
    // Callback registry for transformCallback
    let callbackId = 0;
    const callbackRegistry: Record<number, (...args: any[]) => void> = {};

    // Completely replace __TAURI_INTERNALS__ with an authenticated version
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

  // Navigate — all init scripts run before React starts
  await page.goto('/');

  // Wait for app shell (user name shows in sidebar UserBadge)
  await expect(page.getByText('testuser')).toBeVisible({ timeout: 8000 });

  // Click user badge to log out (title="Click to log out")
  await page.getByTitle('Click to log out').click();

  // Login screen should reappear
  await expect(page.getByText('Sign in to Face Hugger')).toBeVisible({ timeout: 5000 });
});
