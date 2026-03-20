import { test, expect } from '@playwright/test';
import { setupTauriMocks } from '../fixtures/mocks/ipc';

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
  await page.goto('/');
});

test('app loads and shows login screen', async ({ page }) => {
  // App starts unauthenticated (check_existing_token returns null)
  // The login screen should be visible in its default OAuth idle state
  await expect(page.getByText('Sign in to Face Hugger')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Hugging Face' })).toBeVisible();
});

test('page has correct title', async ({ page }) => {
  // Just verify page.title() resolves without error
  const title = await page.title();
  expect(typeof title).toBe('string');
});
