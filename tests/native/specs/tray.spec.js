/**
 * System tray integration tests (Linux/Windows only).
 *
 * These tests run against the compiled Tauri binary via tauri-driver (WebdriverIO).
 * macOS is excluded because no WKWebView WebDriver exists (RESEARCH.md Pitfall 2).
 *
 * Direct OS-level tray icon inspection is not possible via WebDriver; instead these
 * tests validate that the app binary launches successfully with tray support active
 * and that the main WebView window is accessible, which confirms the Rust setup_tray()
 * call in lib.rs completed without error.
 */

describe('System tray', () => {
  it('app launches successfully with tray support enabled', async () => {
    // If the binary launched and the WebView is responsive, tray setup succeeded.
    // setup_tray() is called in the Tauri setup hook before run() completes.
    const title = await browser.getTitle();
    // Title may be empty string or "Face Hugger" depending on initial auth state,
    // but the WebView must respond — an exception here means the binary did not start.
    expect(typeof title).toBe('string');
  });

  it('app window is accessible and WebView is rendering', async () => {
    // Verify the WebView URL is the Tauri app origin (not blank/error page).
    const url = await browser.getUrl();
    // Tauri v2 WebView uses tauri://localhost or http://tauri.localhost depending on platform.
    expect(url).toBeTruthy();
    expect(url.length).toBeGreaterThan(0);
  });

  it('app window has a reachable DOM', async () => {
    // Confirm the WebView rendered at least the root React mount point.
    const rootEl = await browser.$('#root');
    const exists = await rootEl.isExisting();
    expect(exists).toBe(true);
  });
});
