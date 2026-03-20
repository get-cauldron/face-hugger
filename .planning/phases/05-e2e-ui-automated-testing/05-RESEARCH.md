# Phase 05: E2E/UI Automated Testing - Research

**Researched:** 2026-03-19
**Domain:** Playwright + Tauri v2 IPC mocking, MSW v2, tauri-driver, Vitest/RTL, Rust tauri::test, GitHub Actions CI matrix
**Confidence:** HIGH (core Playwright + MSW stack), MEDIUM (tauri-driver due to macOS exclusion)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Layered approach: Playwright for UI flows (fast, reliable) + tauri-driver for native-specific tests
- Playwright tests run against Vite dev server with Tauri IPC mocked
- IPC mocking: Mock `window.__TAURI__` for Tauri invoke() commands AND use MSW for any direct HTTP calls (both layers)
- tauri-driver (WebDriver) tests run against the compiled Tauri binary for native feature coverage
- Comprehensive coverage across all layers — every feature gets at least one E2E test
- Fill unit test gaps in both frontend (React components, hooks, stores) AND Rust backend (commands, auth, tray)
- Most tests mock the HF API for speed and determinism
- 1-2 critical smoke tests hit the real HF API (login, list repos) using a dedicated test account
- Existing 7 frontend unit tests and Rust inline tests are kept as-is; new tests fill gaps alongside them
- Hard gate: all tests must pass before release artifacts are built — red tests = no release
- Test matrix: all three platforms (macOS, Windows, Linux)
- HF API smoke tests use a dedicated test HF account with fine-grained token stored as GitHub secret
- Test workflow separate from release workflow but release workflow depends on test passing

### Claude's Discretion
- Test file organization and naming conventions
- Specific mock data fixtures design
- Playwright page object pattern vs inline selectors
- tauri-driver test setup and teardown approach
- Which specific Rust modules need additional unit test coverage (based on gap analysis)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase adds comprehensive automated test coverage to a finished Tauri v2 + React desktop app. The stack is layered: Playwright tests run against the Vite dev server (port 1420) with Tauri IPC mocked via `page.addInitScript()` + `@tauri-apps/api/mocks`, while MSW v2 intercepts any direct HTTP calls to the HF API. For native features (tray, notifications, window management), tauri-driver provides WebDriver-based tests against the compiled binary — but only on Linux and Windows (macOS has no WKWebView driver). The Rust test gap is filled using `tauri::test::{mock_app, get_ipc_response}` with the `test` feature flag, which creates a full mock app without spawning real OS subsystems.

The CI strategy creates a new `test.yml` workflow that runs the full test matrix (unit, Playwright, tauri-driver) on all platforms, and `release.yml` gains a `needs: [test]` dependency so tag pushes only build artifacts if tests are green.

**Primary recommendation:** Use `@tauri-apps/api/mocks` `mockIPC()` as the primary IPC interception layer for Playwright. Inject it before page load with `page.addInitScript()`. Use MSW v2 `setupServer` from `msw/node` for Vitest unit tests, and MSW browser worker for any Playwright tests that need HTTP-level interception. Keep tauri-driver tests narrow: only features that require a real compiled binary.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | 1.58.2 | E2E browser automation against Vite dev server | Official Playwright test runner, built-in assertions |
| msw | 2.12.13 | Mock HTTP requests in both Node (Vitest) and browser (Playwright) | Only library that intercepts at network level; v2 is current |
| tauri-driver | 2.x (cargo install) | WebDriver wrapper for compiled Tauri binary | Official Tauri WebDriver integration |
| tauri (test feature) | 2.x | `tauri::test` module for Rust command unit tests | Official mock runtime, no real OS/UI needed |
| @testing-library/react | latest (already installed) | React component rendering + queries | Already in project devDependencies |
| @testing-library/jest-dom | latest (already installed) | Custom DOM matchers (toBeInDocument, etc.) | Already in project devDependencies |
| vitest | 4.1.0 (already installed) | Unit test runner for frontend + Rust-adjacent tests | Already configured, jsdom environment active |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @msw/playwright | npm latest | Official MSW binding for Playwright cross-process mocking | If MSW handlers need to be manipulated per-test from Node side |
| playwright-msw | npm latest (community) | Alt community MSW-Playwright binding using page.route() | Alternative if @msw/playwright cross-process model is complex |

**Version verification (checked 2026-03-19 against npm registry):**
- @playwright/test: 1.58.2 (published current)
- msw: 2.12.13 (published current)

**Installation:**
```bash
# Frontend E2E and mocking
npm install -D @playwright/test msw --legacy-peer-deps
npx playwright install

# tauri-driver (Rust binary — install globally)
cargo install tauri-driver --locked

# tauri test feature — add to src-tauri/Cargo.toml dev section
# [dev-dependencies]
# (see Architecture Patterns section)
```

---

## Architecture Patterns

### Recommended Project Structure
```
tests/
├── e2e/                     # Playwright tests (browser-level)
│   ├── auth.spec.ts         # Login flow, logout, session persistence
│   ├── upload-wizard.spec.ts # Upload wizard end-to-end
│   ├── repo-management.spec.ts # Create, browse, delete, history, revert
│   ├── dataset-preview.spec.ts # Dataset rows, search, filter, stats
│   ├── drag-drop.spec.ts    # OS file drop onto queue
│   ├── folder-sync.spec.ts  # Local folder sync
│   └── smoke/
│       └── hf-api.spec.ts   # 1-2 real HF API tests (gated by HF_TEST_TOKEN)
├── native/                  # tauri-driver tests (compiled binary)
│   ├── package.json         # Separate Node project for WebdriverIO
│   ├── wdio.conf.js         # WebdriverIO config
│   └── specs/
│       ├── tray.spec.js     # Tray icon, menu items, close-to-tray
│       ├── notifications.spec.js # Upload complete/failure notifications
│       ├── window.spec.js   # Launch, titlebar, window state
│       └── update-banner.spec.js # UpdateBanner behavior
├── fixtures/
│   ├── mocks/
│   │   ├── handlers.ts      # MSW request handlers (HF API mocks)
│   │   ├── node.ts          # MSW server for Vitest
│   │   └── ipc.ts           # Tauri IPC mock map (cmd → response)
│   └── data/
│       ├── users.ts         # Mock UserInfo fixtures
│       ├── repos.ts         # Mock RepoItem fixtures
│       └── datasets.ts      # Mock dataset row fixtures
└── playwright.config.ts     # Playwright config

src/
└── [existing source]

src-tauri/
└── tests/
    ├── auth_test.rs          # Existing (keep as-is)
    └── [new Rust tests TBD by gap analysis]
```

### Pattern 1: Tauri IPC Mocking in Playwright via addInitScript

**What:** Before page loads, inject `@tauri-apps/api/mocks` mockIPC handler into the browser context.
**When to use:** All Playwright tests — this is the primary way to mock `invoke()` calls.
**Example:**
```typescript
// Source: https://v2.tauri.app/develop/tests/mocking/ + https://playwright.dev/docs/mock-browser-apis
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';
import { mockUserInfo } from '../fixtures/data/users';

test.beforeEach(async ({ page }) => {
  // Inject Tauri IPC mock BEFORE page loads (critical — Tauri checks on startup)
  await page.addInitScript(() => {
    // @tauri-apps/api/mocks mockIPC expects window.__TAURI_INTERNALS__
    // We expose the mock setup function so tests can configure per-command
    (window as any).__TEST_IPC_HANDLERS__ = {};
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: any) => {
        const handler = (window as any).__TEST_IPC_HANDLERS__[cmd];
        if (handler) return handler(args);
        throw new Error(`No IPC mock for command: ${cmd}`);
      },
      metadata: { currentWindow: { label: 'main' } },
    };
  });
  await page.goto('/');
});

test('token paste login succeeds', async ({ page }) => {
  // Wire a specific command before trigger
  await page.evaluate((user) => {
    (window as any).__TEST_IPC_HANDLERS__['validate_token'] = async () => user;
    (window as any).__TEST_IPC_HANDLERS__['get_stored_token'] = async () => null;
    (window as any).__TEST_IPC_HANDLERS__['check_existing_token'] = async () => null;
  }, mockUserInfo);

  await page.fill('[data-testid="token-input"]', 'hf_testtoken');
  await page.click('[data-testid="login-button"]');
  await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
});
```

**Alternative — use official mockIPC:**
```typescript
// If @tauri-apps/api/mocks is importable in addInitScript context:
await page.addInitScript(async () => {
  const { mockIPC } = await import('@tauri-apps/api/mocks');
  mockIPC((cmd, payload) => {
    if (cmd === 'validate_token') return { name: 'testuser', fullname: null, ... };
  });
});
```

Note: Direct ES module import inside addInitScript may not resolve in all environments; the raw `__TAURI_INTERNALS__` approach is more reliable.

### Pattern 2: MSW v2 in Vitest (Node) for HTTP Mocking

**What:** Use `setupServer` from `msw/node` with lifecycle hooks in Vitest setup file.
**When to use:** Unit and hook tests in Vitest that call `@huggingface/hub` directly (not via Tauri IPC).
**Example:**
```typescript
// Source: https://mswjs.io/docs/quick-start/
// tests/fixtures/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://huggingface.co/api/whoami-v2', () =>
    HttpResponse.json({ name: 'testuser', fullname: 'Test User', type: 'user' })
  ),
  http.get('https://huggingface.co/api/models', () =>
    HttpResponse.json([{ id: 'abc123', modelId: 'testuser/my-model' }])
  ),
];

// tests/fixtures/mocks/node.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);

// vitest.setup.ts (add to vitest.config.ts setupFiles)
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './tests/fixtures/mocks/node';
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Pattern 3: Tauri Rust Command Testing with tauri::test

**What:** Enable `test` feature in Cargo.toml, use `tauri::test::mock_app()` to get a real `AppHandle` backed by `MockRuntime`.
**When to use:** Testing Rust command functions that accept `AppHandle` or `State<AppState>`.
**Critical constraint:** The `test` feature must be enabled in `[dev-dependencies]` OR as a feature flag.
**Example:**
```rust
// Source: https://docs.rs/tauri/2.10.2/tauri/test/index.html
// src-tauri/Cargo.toml — add to [dev-dependencies]:
// tauri = { version = "2", features = ["test"] }

#[cfg(test)]
mod tests {
    use tauri::test::{mock_app, mock_context, noop_assets};

    #[tokio::test]
    async fn test_logout_command() {
        let app = mock_app();
        let handle = app.handle().clone();
        // Manage state needed by the command
        // app.manage(AppState::default());
        // Note: commands using AppHandle<MockRuntime> may require generic bounds
        // Use function-level tests for pure logic; IPC tests for commands with handle
    }
}
```

**Current limitation (December 2024 GitHub issue):** Commands with `AppHandle` in signature face a trait bound error `AppHandle: CommandArg<'_, R>` when using MockRuntime. Workaround: test pure logic functions directly; use `#[ignore]` + real binary for commands that deeply integrate with AppHandle. The `try_start_next(None)` pattern in upload/queue.rs (from STATE.md) was specifically designed to support `None` AppHandle for testability.

### Pattern 4: tauri-driver WebDriver Test (WebdriverIO)

**What:** tauri-driver wraps native platform WebDriver; tests use WebdriverIO to drive the compiled Tauri binary.
**When to use:** System tray, notifications, window management — features that require native OS integration.
**Platform constraint:** Linux (WebKitWebDriver) and Windows (Edge Driver) only. macOS has no WKWebView driver — macOS native tests must use Playwright or remain manual.

```javascript
// Source: https://v2.tauri.app/develop/tests/webdriver/
// tests/native/wdio.conf.js
const { spawn, spawnSync } = require('child_process');
const tauriDriver = require.resolve('tauri-driver');

module.exports = {
  specs: ['./specs/**/*.spec.js'],
  maxInstances: 1,
  capabilities: [{
    maxInstances: 1,
    'tauri:options': {
      application: '../../src-tauri/target/release/face-hugger',
    },
    browserName: 'wry',
    'ms:edgeOptions': undefined, // remove if Linux
  }],
  services: [['wdio-service', {
    onPrepare: function () {
      this.tauriDriver = spawn(tauriDriver, [], { stdio: [null, process.stdout, process.stderr] });
    },
    onComplete: function () {
      this.tauriDriver.kill();
    },
  }]],
};
```

### Pattern 5: GitHub Actions Test → Release Gate

**What:** Separate `test.yml` workflow; `release.yml` adds `workflow_run` trigger or both jobs live in one workflow with `needs`.
**Recommended approach:** Add test jobs directly to `release.yml` as earlier jobs that `build-tauri` depends on. This avoids cross-workflow dependency complexity.

```yaml
# Add to .github/workflows/release.yml
jobs:
  test:
    strategy:
      matrix:
        include:
          - platform: macos-latest
          - platform: ubuntu-22.04
          - platform: windows-latest
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: Install Linux deps
        if: matrix.platform == 'ubuntu-22.04'
        run: sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf webkit2gtk-driver xvfb
      - uses: actions/setup-node@v4
        with: { node-version: lts/*, cache: npm }
      - run: npm ci --legacy-peer-deps
      - name: Frontend unit tests
        run: npm test
      - name: Playwright install browsers
        run: npx playwright install --with-deps chromium
      - name: Playwright E2E tests
        run: npx playwright test
      - name: Rust unit tests
        run: cargo test --manifest-path src-tauri/Cargo.toml
      # tauri-driver tests (Linux/Windows only)
      - name: Install tauri-driver
        if: matrix.platform != 'macos-latest'
        run: cargo install tauri-driver --locked
      - name: Build Tauri binary for native tests
        if: matrix.platform != 'macos-latest'
        run: npm run tauri build -- --debug
      - name: Native tests (Linux xvfb)
        if: matrix.platform == 'ubuntu-22.04'
        run: xvfb-run npm run test:native --prefix tests/native
      - name: Native tests (Windows)
        if: matrix.platform == 'windows-latest'
        run: npm run test:native --prefix tests/native

  build-tauri:
    needs: [test, create-release]   # ← gate on test passing
    # ... rest unchanged
```

**HF smoke tests:**
```yaml
- name: HF API smoke tests
  if: env.HF_TEST_TOKEN != ''
  env:
    HF_TEST_TOKEN: ${{ secrets.HF_TEST_TOKEN }}
  run: npx playwright test tests/e2e/smoke/
```

### Pattern 6: Playwright Config for Vite Dev Server (port 1420)

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

Note: Use only Chromium for Playwright E2E — Tauri uses WebKit/Chromium depending on platform, but browser-based tests with mocked IPC don't need cross-browser coverage. Keep Playwright tests focused on React app logic.

### Anti-Patterns to Avoid
- **Mocking both Tauri IPC and MSW in the wrong layer:** MSW intercepts HTTP at network level (for `@huggingface/hub` direct calls). `mockIPC` intercepts Tauri IPC (for `invoke()`). They are not interchangeable — HF API calls made from React go through `@huggingface/hub` (HTTP), not through IPC.
- **Running tauri-driver on macOS in CI:** No WKWebView driver exists — any macOS native tests must be explicitly excluded or marked `#[ignore]`.
- **Importing ESM in `page.addInitScript`:** The addInitScript callback runs in an isolated browser context. Avoid top-level `import` statements; use dynamic imports or raw object assignment to `window.__TAURI_INTERNALS__`.
- **Missing `clearMocks()` between tests:** Tauri mocks are stateful. Call `clearMocks()` in `afterEach` or reset `__TEST_IPC_HANDLERS__` between tests.
- **Enabling `test` feature in release Cargo:** The `test` feature in tauri must only appear in `[dev-dependencies]` not `[dependencies]` — otherwise it ships in production builds.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tauri IPC interception | Custom `window.invoke` stub | `@tauri-apps/api/mocks` mockIPC | Handles `__TAURI_INTERNALS__` protocol correctly |
| HTTP API mocking in Node | Custom Jest intercept | `msw/node` setupServer | Intercepts at network level, works with fetch/axios/huggingface/hub |
| HTTP API mocking in browser | Manual fetch override | MSW browser service worker | Runs in SW context, survives page navigation |
| WebDriver protocol for Tauri | Custom binary control | `tauri-driver` + WebdriverIO | Official cross-platform wrapper |
| Mock Tauri App for Rust tests | Real OS app startup | `tauri::test::mock_app()` | MockRuntime, no OS window, tokio-safe |
| Cross-platform CI runner setup | Custom runner scripts | GitHub matrix + existing release.yml pattern | Already has all platform deps set up |

**Key insight:** The `@huggingface/hub` library uses browser fetch directly — MSW service worker is the correct interception point for those calls in Playwright tests. Tauri IPC calls via `invoke()` require `mockIPC`, not MSW.

---

## Common Pitfalls

### Pitfall 1: addInitScript Timing with Tauri IPC
**What goes wrong:** Tauri checks for `window.__TAURI_INTERNALS__` immediately on page load. If mockIPC setup runs after the page scripts, initial `invoke()` calls during app startup throw.
**Why it happens:** `page.goto()` triggers page load before `evaluate()` runs.
**How to avoid:** Always set up mocks in `page.addInitScript()` (runs before any page script), never in `page.evaluate()` called after `goto()`.
**Warning signs:** Tests fail with "cannot read properties of undefined (reading 'invoke')" or "Uncaught Error: No IPC mock for command: check_existing_token".

### Pitfall 2: tauri-driver macOS Gap
**What goes wrong:** CI matrix includes macOS; tauri-driver tests hang or fail immediately.
**Why it happens:** No WKWebView WebDriver implementation exists on macOS (official Tauri docs confirm).
**How to avoid:** Exclude tauri-driver test job on `macos-latest` with `if: matrix.platform != 'macos-latest'`. For macOS native feature coverage, document as "validated on Linux/Windows CI + macOS smoke testing required manually."
**Warning signs:** CI job hangs indefinitely waiting for WebKitWebDriver on macOS.

### Pitfall 3: Section-Based Routing Navigation in Playwright
**What goes wrong:** Tests try to navigate via `page.goto('/upload')` or URL routing, but the app uses local React state for section routing (no React Router, no URL segments).
**Why it happens:** AppShell uses `section` state, not URLs, to switch views.
**How to avoid:** Navigate by clicking sidebar buttons, not URLs. Use `page.click('[data-testid="nav-upload"]')` etc. Alternatively, pre-set Zustand store state via `page.evaluate()` before tests.
**Warning signs:** `page.goto('/upload')` lands on root/login regardless of path.

### Pitfall 4: MSW + Vitest jsdom "TextDecoder not defined" / Service Worker Missing
**What goes wrong:** MSW browser integration requires an actual Service Worker registration; jsdom doesn't support SW. MSW v1→v2 migration breaks `setupWorker` in Node context.
**Why it happens:** MSW v2 has two separate entry points: `msw/node` (for Vitest/jsdom) and `msw/browser` (for real browsers/Playwright).
**How to avoid:** In Vitest setup file, always use `msw/node`'s `setupServer`. In Playwright, use either page.route() interception or the browser SW setup with MSW public dir copied (`npx msw init public/ --save`).
**Warning signs:** "Cannot use Service Worker in a non-browser environment" errors in Vitest.

### Pitfall 5: Rust `tauri::test` Feature Enabling
**What goes wrong:** `tauri::test::mock_app()` panics or compilation fails because the `test` feature isn't enabled.
**Why it happens:** The `test` module is gated behind the `test` feature flag in Tauri's Cargo.
**How to avoid:**
```toml
# src-tauri/Cargo.toml
[dev-dependencies]
tauri = { version = "2", features = ["test"] }
```
NOT in `[dependencies]` (would enable it in production builds).
**Warning signs:** `error[E0433]: failed to resolve: could not find 'test' in 'tauri'`.

### Pitfall 6: AppHandle Generic Bound in Rust Tests
**What goes wrong:** Commands that take `AppHandle` directly fail to compile with MockRuntime — "the trait bound `AppHandle<MockRuntime>: CommandArg` is not satisfied."
**Why it happens:** tauri-specta generates commands with non-generic `AppHandle` signatures. MockRuntime is a different Runtime impl.
**How to avoid:** For commands with AppHandle, extract pure logic into testable helper functions (the upload queue already does `try_start_next(None)` for this reason). Test the helpers, not the command handlers. Mark deeply-integrated command tests `#[ignore]` with note to run against real binary.
**Warning signs:** Trait bound compile errors referencing MockRuntime.

### Pitfall 7: Playwright npm run dev Port Conflict
**What goes wrong:** Playwright `webServer` command starts a second Vite dev server on port 1420, but one is already running from `tauri dev`.
**Why it happens:** Vite uses `strictPort: true` (in vite.config.ts) — port conflict causes crash.
**How to avoid:** In Playwright tests, either run against an isolated dev server (separate terminal/CI step) OR set `reuseExistingServer: true` in playwright.config.ts. In CI, start the server as a background step before Playwright.
**Warning signs:** "Port 1420 is already in use".

---

## Code Examples

Verified patterns from official sources:

### Tauri IPC Mock (Official API)
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacemocks/
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

// In test setup:
mockIPC((cmd, payload) => {
  switch (cmd) {
    case 'validate_token': return { name: 'testuser', fullname: null, avatar_url: null, email: null, type: 'user' };
    case 'get_stored_token': return null;
    case 'check_existing_token': return null;
    case 'logout': return null;
    default: throw new Error(`Unhandled IPC command: ${cmd}`);
  }
});

// Teardown:
afterEach(() => clearMocks());
```

### MSW v2 Handler Definition
```typescript
// Source: https://mswjs.io/docs/quick-start/
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://huggingface.co/api/whoami-v2', ({ request }) => {
    const token = request.headers.get('Authorization');
    if (!token) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return HttpResponse.json({ name: 'testuser', fullname: 'Test User', type: 'user' });
  }),
  http.get('https://huggingface.co/api/models', () =>
    HttpResponse.json([{ id: 'abc123', modelId: 'testuser/my-model', private: false }])
  ),
];
```

### tauri-driver Prerequisite Check (CI)
```yaml
# Source: https://v2.tauri.app/develop/tests/webdriver/ci/
- name: Install tauri-driver deps (Ubuntu)
  if: matrix.platform == 'ubuntu-22.04'
  run: |
    sudo apt-get update
    sudo apt-get install -y webkit2gtk-driver xvfb

- name: Run native tests (Ubuntu headless)
  if: matrix.platform == 'ubuntu-22.04'
  run: xvfb-run npm run test:native --prefix tests/native
```

### Rust tauri::test mock_app Pattern
```rust
// Source: https://docs.rs/tauri/2.10.2/tauri/test/index.html
#[cfg(test)]
mod tests {
    use tauri::test::{mock_app};

    #[test]
    fn test_app_state_accessible() {
        let app = mock_app();
        // Manage state for commands that need it
        // app.manage(MyState::default());
        let _handle = app.handle().clone();
        // Test pure logic; avoid commands that require full OS integration
    }
}
```

### Playwright Config for Tauri Vite App
```typescript
// Source: https://playwright.dev/docs/test-configuration
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:1420',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  reporter: process.env.CI ? 'github' : 'list',
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cypress for E2E | Playwright | 2022-2023 | Playwright faster, better multi-tab, official Tauri examples use it |
| MSW v1 (`rest.*` syntax) | MSW v2 (`http.*` + `HttpResponse`) | MSW 2.0 (2023) | Breaking API change — use `http.get()` not `rest.get()` |
| `@tauri-apps/api/mocks` v1 | Same module, v2 mocking with `shouldMockEvents` option | Tauri v2 release | `shouldMockEvents: true` enables event mocking since v2.7.0 |
| tauri-driver v1 | tauri-driver v2 (same install, updated protocol) | Tauri v2 | Install via `cargo install tauri-driver --locked` |
| `listFiles` mock return value as array | Must mock as async generator | Current @huggingface/hub | Already handled correctly in existing tests (see useRepoFiles.test.ts) |

**Deprecated/outdated:**
- MSW `rest.*` import: Replaced by `http.*` in MSW v2 — do not use `import { rest } from 'msw'`
- `window.__TAURI_IPC__`: Pre-v2 property name — Tauri v2 uses `window.__TAURI_INTERNALS__`
- Cypress: Not the standard for Tauri apps — Playwright is the community-standard and has official Tauri examples
- `tauri::test::get_ipc_response` with v1 InvokePayload: API changed in v2 — verify current API via docs.rs

---

## Coverage Gap Analysis

### Frontend — Existing Tests (keep as-is)
| File | What's Covered |
|------|----------------|
| authStore.test.ts | Auth store state transitions |
| uploadStore.test.ts | Upload store wizard/progress state |
| useRepoFiles.test.ts | File listing hook with mock |
| useRepos.test.ts | Repo listing hook with mock |
| AppShell.test.tsx | Section routing, repo navigation |
| repoUtils.test.ts | Utility functions |
| FileTree.test.ts | File tree component |

### Frontend — Gaps to Fill with New Unit Tests
| Component/Hook | What's Missing |
|----------------|----------------|
| LoginScreen.tsx | Token paste input, submit, error display |
| UploadWizard.tsx | Step transitions, wizard close |
| StepRepoPicker.tsx | Repo selection, create repo sheet open/close |
| StepFilePicker.tsx | File selection state |
| RepoBrowserPage.tsx | Tab switching, commit history display |
| FileActions.tsx | Delete file dialog, delete repo dialog |
| DatasetPreviewPage.tsx | Row rendering, search/filter controls |
| UpdateBanner.tsx | Appears with update data, absent without |
| useDatasetRows query | Search/filter/plain query priority |

### Rust — Existing Tests (keep as-is)
10+ files with `#[cfg(test)]` inline modules across: client.rs, xet.rs, api.rs, backoff.rs, types.rs, cancel.rs, worker.rs, queue.rs, progress.rs, hash.rs + auth_test.rs integration

### Rust — Gaps to Fill (Claude's Discretion to determine depth)
| Module | Missing Coverage |
|--------|-----------------|
| commands/auth.rs | validate_token command flow (mock keyring) |
| commands/upload.rs | start_upload / cancel_upload command routing |
| upload/queue.rs | try_start_next state transitions |
| tray.rs | tray menu item handlers |

---

## Open Questions

1. **AppHandle in tauri::test — v2 status**
   - What we know: December 2024 GitHub issue (#12077) reports trait bound errors when testing commands with AppHandle using MockRuntime
   - What's unclear: Whether a patch landed in tauri 2.10.x that resolves this
   - Recommendation: During Wave 0, test compile a minimal command with AppHandle + MockRuntime. If it fails, document which commands can be tested vs. must use `#[ignore]`.

2. **MSW browser worker vs page.route() for Playwright**
   - What we know: MSW browser integration requires service worker registration; `@msw/playwright` uses `page.route()` to avoid cross-process issues
   - What's unclear: Whether HF API calls from `@huggingface/hub` (fetch-based) work reliably with `page.route()` vs service worker in Playwright's Chromium context
   - Recommendation: Start with `page.route()` interception pattern (simpler, no SW setup); switch to MSW if handler reuse across tests becomes complex.

3. **tauri-driver macOS test coverage**
   - What we know: No WKWebView driver exists on macOS — tray/notifications cannot be automated on macOS CI
   - What's unclear: Whether the planned macOS native tests (tray, notifications) can be partially tested via Playwright with mocked Tauri APIs
   - Recommendation: Tray/notification behavior on macOS = manually verified + document in test plan. Linux/Windows tauri-driver tests cover the Rust-side logic.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Frontend) | Vitest 4.1.0 |
| Framework (E2E) | @playwright/test 1.58.2 |
| Framework (Native) | tauri-driver + WebdriverIO |
| Framework (Rust) | cargo test + tauri::test |
| Config file (Vitest) | vitest.config.ts (exists, jsdom env) |
| Config file (Playwright) | playwright.config.ts — Wave 0 creates this |
| Quick run command | `npm test` (Vitest unit) |
| Full suite command | `npm test && npx playwright test && cargo test --manifest-path src-tauri/Cargo.toml` |

### Test Type Map
| Area | Behavior | Test Type | Automated Command |
|------|----------|-----------|-------------------|
| Auth store | State transitions | unit | `npm test -- authStore` |
| Upload store | Wizard/progress state | unit | `npm test -- uploadStore` |
| LoginScreen | Token input + submit | unit/component | `npm test -- LoginScreen` |
| UploadWizard | Step navigation | unit/component | `npm test -- UploadWizard` |
| Auth E2E | Login flow, logout, session | E2E | `npx playwright test auth.spec.ts` |
| Upload wizard E2E | Full wizard flow | E2E | `npx playwright test upload-wizard.spec.ts` |
| Repo management E2E | Create, browse, delete, history | E2E | `npx playwright test repo-management.spec.ts` |
| Dataset preview E2E | Rows, search, filter, stats | E2E | `npx playwright test dataset-preview.spec.ts` |
| HF API smoke | Real login + list repos | E2E (guarded) | `HF_TEST_TOKEN=xxx npx playwright test smoke/` |
| Tray/notifications | Native OS integration | native (Linux/Win) | `npm run test:native --prefix tests/native` |
| Rust commands | Auth, upload routing | unit | `cargo test --manifest-path src-tauri/Cargo.toml` |

### Sampling Rate
- **Per task commit:** `npm test` (Vitest unit suite, ~5s)
- **Per wave merge:** `npm test && npx playwright test` (unit + E2E, ~60-90s)
- **Phase gate:** Full suite green (`npm test && npx playwright test && cargo test`) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `playwright.config.ts` — Playwright configuration (baseURL, webServer, project)
- [ ] `tests/e2e/` directory + at minimum one spec to validate Playwright runs
- [ ] `tests/fixtures/mocks/handlers.ts` — MSW HF API handlers
- [ ] `tests/fixtures/mocks/node.ts` — MSW node server
- [ ] `vitest.config.ts` update — add `setupFiles: ['./tests/fixtures/mocks/setup.ts']` if MSW used in Vitest
- [ ] `tests/native/package.json` + `wdio.conf.js` — WebdriverIO config for tauri-driver
- [ ] `src-tauri/Cargo.toml` update — add `tauri = { version = "2", features = ["test"] }` to `[dev-dependencies]`
- [ ] Framework installs: `npm install -D @playwright/test msw --legacy-peer-deps && npx playwright install chromium`
- [ ] `cargo install tauri-driver --locked`

---

## Sources

### Primary (HIGH confidence)
- https://v2.tauri.app/develop/tests/mocking/ — mockIPC, clearMocks, mockWindows API for Tauri v2
- https://v2.tauri.app/reference/javascript/api/namespacemocks/ — Full mocks namespace API signatures
- https://v2.tauri.app/develop/tests/webdriver/ — tauri-driver installation, platform support
- https://v2.tauri.app/develop/tests/webdriver/ci/ — CI setup for tauri-driver on Linux/Windows
- https://docs.rs/tauri/2.10.2/tauri/test/index.html — tauri::test module: mock_app, mock_builder, get_ipc_response
- https://mswjs.io/docs/quick-start/ — MSW v2 setup with Node/Vitest
- https://mswjs.io/docs/integrations/browser/ — MSW v2 browser integration (service worker)
- https://playwright.dev/docs/mock-browser-apis — page.addInitScript for injecting window mocks

### Secondary (MEDIUM confidence)
- https://playwright.dev/docs/test-configuration — playwright.config.ts webServer + baseURL patterns
- https://github.com/mswjs/playwright — @msw/playwright official package (page.route() approach)
- https://ospfranco.com/writting-tests-for-tauri-rust-commands/ — Rust tauri::test usage patterns (v1 era, v2 patterns similar)
- npm registry (live) — @playwright/test 1.58.2, msw 2.12.13 confirmed current versions

### Tertiary (LOW confidence, flag for validation)
- GitHub issue #12077 (tauri-apps/tauri) — AppHandle trait bound error in MockRuntime tests (December 2024); unclear if resolved in 2.10.x
- https://github.com/valendres/playwright-msw — Community playwright-msw alternative (updated for MSW v2)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm registry 2026-03-19; tools confirmed from official Tauri docs
- Architecture patterns: HIGH — mockIPC, MSW, Playwright config verified from official docs; tauri-driver CI from official Tauri docs
- Pitfalls: HIGH — section routing confirmed from STATE.md decisions; macOS tauri-driver exclusion confirmed from official docs; MSW v1→v2 migration from official docs; AppHandle trait bound from active GitHub issue
- Rust tauri::test: MEDIUM — API structure confirmed from docs.rs; AppHandle compatibility with MockRuntime has active issue (Dec 2024), resolution status unconfirmed

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days — Playwright and MSW stable; tauri::test compatibility may shift with Tauri 2.11.x releases)
