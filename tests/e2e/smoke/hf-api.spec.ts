import { test, expect } from '@playwright/test';

// Real HF API smoke tests — only run when HF_TEST_TOKEN secret is available.
// These tests use Playwright's APIRequestContext (the `request` fixture) to make
// direct HTTP calls without launching a browser or using Tauri IPC.
//
// Usage locally:
//   HF_TEST_TOKEN=hf_xxx npx playwright test tests/e2e/smoke/
//
// In CI: set HF_TEST_TOKEN as a repository secret. The test workflow only runs
// this suite when the secret is available.

const HF_TOKEN = process.env.HF_TEST_TOKEN;

test.describe('HF API smoke tests', () => {
  test.skip(!HF_TOKEN, 'HF_TEST_TOKEN not set -- skipping real API tests');

  test('whoami returns valid user info', async ({ request }) => {
    const response = await request.get('https://huggingface.co/api/whoami-v2', {
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
      },
    });

    expect(response.ok()).toBe(true);

    const body = await response.json();

    // Must contain a name field (the HF username)
    expect(typeof body.name).toBe('string');
    expect(body.name.length).toBeGreaterThan(0);

    // Must identify as a user or org
    expect(['user', 'org']).toContain(body.type);
  });

  test('list models returns array', async ({ request }) => {
    const response = await request.get('https://huggingface.co/api/models?limit=1', {
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
      },
    });

    expect(response.ok()).toBe(true);

    const body = await response.json();

    // Must be a non-empty array
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    // Each item must have an id (the model repo name)
    const model = body[0];
    expect(typeof model.id).toBe('string');
  });
});
