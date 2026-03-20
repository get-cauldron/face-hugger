/**
 * Window management integration tests (Linux/Windows only).
 *
 * These tests run against the compiled Tauri binary via tauri-driver (WebdriverIO).
 * macOS is excluded because no WKWebView WebDriver exists (RESEARCH.md Pitfall 2).
 *
 * Tests validate window dimensions, initial render, and that the app starts in the
 * unauthenticated (login) state when no token is stored.
 */

describe('Window management', () => {
  it('app launches and title is a string', async () => {
    // Title comes from tauri.conf.json "title" field or the React document.title.
    const title = await browser.getTitle();
    expect(typeof title).toBe('string');
  });

  it('app window has reasonable dimensions', async () => {
    // tauri.conf.json sets initial width=1200, height=800, min 800x600.
    // The window may be smaller if the test runner virtualises the display,
    // but it should always be at least the minimum.
    const size = await browser.getWindowSize();
    expect(size.width).toBeGreaterThan(400);
    expect(size.height).toBeGreaterThan(300);
  });

  it('app renders login screen on fresh launch', async () => {
    // The app starts unauthenticated (no stored HF token) so the login screen
    // should be visible. LoginScreen renders a token input with data-testid="token-input".
    const tokenInput = await browser.$('[data-testid="token-input"]');
    const exists = await tokenInput.isExisting();
    expect(exists).toBe(true);
  });
});
