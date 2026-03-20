---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [react, zustand, tanstack-query, tailwind, tauri, login, auth-gate, sidebar, titlebar]

# Dependency graph
requires:
  - phase: 01-01
    provides: Tauri scaffold, Rust auth commands, tauri-specta IPC, src/bindings.ts with typed commands

provides:
  - Zustand auth store (token, user, isAuthenticated, setAuth, clearAuth)
  - Typed command wrappers in src/commands/auth.ts re-exporting from bindings
  - TanStack Query client with 5-min stale, no window-focus refetch
  - Tailwind v4 dark/orange theme via @theme CSS variables
  - Custom titlebar (tauri-controls WindowTitlebar, data-tauri-drag-region)
  - Left sidebar with Upload (disabled), Models, Datasets, Settings sections + active state
  - UserBadge showing avatar/username from auth store with logout on click
  - AppShell composing TitleBar + Sidebar + content area (section-based routing)
  - LoginScreen: full-screen card with password token input, inline error, green check success flash
  - SplashScreen: centered loading spinner while checking existing token
  - App.tsx auth gate: SplashScreen -> LoginScreen | AppShell based on isAuthenticated
  - 3 behavioral auth store tests passing

affects:
  - 01-03 (repo listing — depends on auth store, AppShell, sidebar sections)
  - All future phases (auth gate and app shell are top-level routing)

# Tech tracking
tech-stack:
  added:
    - tailwindcss 4.x (CSS @import "tailwindcss" v4 syntax)
    - "@tailwindcss/vite" (Vite plugin for Tailwind v4)
    - zustand 5.0.12 (auth store)
    - "@tanstack/react-query" 5.91.2 (QueryClient + QueryClientProvider)
    - tauri-controls 0.4.0 (WindowTitlebar with platform window controls)
    - lucide-react (icons: User, UploadCloud, Box, Database, Settings, CheckCircle)
    - clsx (peer dep for tauri-controls)
    - tailwind-merge (peer dep for tauri-controls)
  patterns:
    - Auth gate pattern: App.tsx reads isAuthenticated, renders SplashScreen | LoginScreen | AppShell
    - Splash-to-main guaranteed via .finally(() => setChecking(false)) in checkExistingToken useEffect
    - Command wrappers: components import from @/commands/auth not bindings directly
    - CSS custom properties via @theme block, not tailwind.config.js (Tailwind v4)
    - Section-based routing via local state in AppShell (no router library for 3-4 views)

key-files:
  created:
    - src/lib/types.ts
    - src/lib/queryClient.ts
    - src/stores/authStore.ts
    - src/commands/auth.ts
    - src/app.css
    - src/components/shell/TitleBar.tsx
    - src/components/shell/Sidebar.tsx
    - src/components/shell/UserBadge.tsx
    - src/components/shell/AppShell.tsx
    - src/components/auth/SplashScreen.tsx
    - src/components/auth/LoginScreen.tsx
    - src/App.tsx
  modified:
    - src/main.tsx (add QueryClientProvider wrapper)
    - src/stores/authStore.test.ts (replace Wave 0 stubs with real behavioral tests)
    - vite.config.ts (add @tailwindcss/vite plugin)
    - package.json (add tailwindcss, @tailwindcss/vite, clsx, tailwind-merge)

key-decisions:
  - "src/lib/types.ts UserInfo uses 'type' not 'user_type' — aligned with bindings.ts which has 'type' field from Rust serde"
  - "Tailwind v4 requires @tailwindcss/vite Vite plugin; @import 'tailwindcss' in CSS alone is insufficient without the plugin"
  - "Use openUrl() not open() from @tauri-apps/plugin-opener — correct export name per the package API"
  - "clsx and tailwind-merge are unlisted peer deps of tauri-controls that must be explicitly installed"
  - "Section-based routing in AppShell via local state — no React Router needed for 3-4 view desktop app (per RESEARCH.md)"

patterns-established:
  - "Auth gate: App.tsx reads useAuthStore.isAuthenticated to route between SplashScreen, LoginScreen, AppShell"
  - "Splash guarantee: .finally(() => setChecking(false)) always fires after checkExistingToken resolves/rejects"
  - "Command layer: all components import from @/commands/auth, never from bindings directly"
  - "Tailwind v4 CSS-native @theme: CSS variables as --color-*, --radius, consumed via var() in JSX classNames"

requirements-completed: [AUTH-01, AUTH-02, AUTH-04]

# Metrics
duration: 7min
completed: 2026-03-19
---

# Phase 01 Plan 02: App Shell and Auth Flow Summary

**Full-screen login flow with token validation, green check success flash, and app shell (custom titlebar + sidebar + content area) with Zustand auth store and Tailwind v4 dark/orange theme**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T14:58:55Z
- **Completed:** 2026-03-19T15:06:33Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Auth store with Zustand (token, user, isAuthenticated, setAuth, clearAuth) — 3 behavioral tests pass
- Complete login flow: paste token, validate via Rust command, flash green check with username/avatar, transition to app shell
- App shell with custom titlebar (tauri-controls), 240px sidebar (Upload disabled, Models, Datasets, Settings), UserBadge at bottom
- Auth gate in App.tsx: SplashScreen (checking) → LoginScreen (unauthenticated) → AppShell (authenticated), with .finally() guarantee

## Task Commits

Each task was committed atomically:

1. **Task 1: Zustand auth store, command wrappers, query client, types, Tailwind theme** - `ae71e17` (feat)
2. **Task 2: Custom titlebar, sidebar, user badge, AppShell** - `23936c6` (feat)
3. **Task 3: Login screen, splash screen, auth gate in App.tsx** - `dfc19c7` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `src/lib/types.ts` - UserInfo interface aligned with bindings.ts (uses 'type' field not 'user_type')
- `src/lib/queryClient.ts` - TanStack Query client, staleTime 5min, gcTime 10min, no window focus refetch
- `src/stores/authStore.ts` - Zustand store with token/user/isAuthenticated/setAuth/clearAuth
- `src/stores/authStore.test.ts` - 3 behavioral tests replacing Wave 0 stubs (all pass)
- `src/commands/auth.ts` - Typed re-exports of validateToken/logout/getStoredToken/checkExistingToken from bindings
- `src/app.css` - Tailwind v4 @import + @theme with dark background + warm orange primary
- `src/components/shell/TitleBar.tsx` - WindowTitlebar from tauri-controls, data-tauri-drag-region, pl-20 for macOS traffic lights
- `src/components/shell/Sidebar.tsx` - 240px sidebar, 4 sections, active state tracking, Upload disabled
- `src/components/shell/UserBadge.tsx` - Avatar/fallback icon, user.name, logout on click
- `src/components/shell/AppShell.tsx` - TitleBar + Sidebar + content area, section-based routing
- `src/components/auth/SplashScreen.tsx` - Centered spinner + "Loading..."
- `src/components/auth/LoginScreen.tsx` - Full-screen card, password input, error display, 1s success flash
- `src/App.tsx` - checkExistingToken on mount, .finally() splash transition, auth gate
- `src/main.tsx` - QueryClientProvider wrapper added
- `vite.config.ts` - @tailwindcss/vite plugin added
- `package.json` - tailwindcss, @tailwindcss/vite, clsx, tailwind-merge added

## Decisions Made

- `src/lib/types.ts` uses `type` (not `user_type`) to match `bindings.ts` — the Rust serde serializes the field as `type`
- Tailwind v4 requires `@tailwindcss/vite` Vite plugin; CSS `@import "tailwindcss"` alone is insufficient
- Used `openUrl()` not `open()` from `@tauri-apps/plugin-opener` — correct API per package exports
- `clsx` and `tailwind-merge` are unlisted peer deps of `tauri-controls` — must be explicitly installed
- Section routing via local state in AppShell (no React Router) per RESEARCH.md recommendation for 3-4 view desktop apps

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong import name from @tauri-apps/plugin-opener**
- **Found during:** Task 3 (login screen implementation)
- **Issue:** Plan specified `open()` but the package exports `openUrl()` — TypeScript error TS2305
- **Fix:** Changed import and call to `openUrl()`
- **Files modified:** src/components/auth/LoginScreen.tsx
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** dfc19c7 (Task 3 commit)

**2. [Rule 3 - Blocking] Tailwind v4 missing Vite plugin**
- **Found during:** Task 3 verification (`npm run build` failure)
- **Issue:** `@import "tailwindcss"` in CSS requires `@tailwindcss/vite` plugin in Vite config — build failed with ENOENT on tailwindcss
- **Fix:** Installed `tailwindcss @tailwindcss/vite`, added `tailwindcss()` plugin to vite.config.ts
- **Files modified:** vite.config.ts, package.json, package-lock.json
- **Verification:** `npm run build` passes, dist/ emitted
- **Committed in:** dfc19c7 (Task 3 commit)

**3. [Rule 3 - Blocking] Missing tauri-controls peer dependencies**
- **Found during:** Task 3 verification (`npm run build` second failure)
- **Issue:** tauri-controls v0.4.0 requires `clsx` and `tailwind-merge` but does not list them as package.json dependencies — build failed with Rolldown resolve errors
- **Fix:** Installed `clsx tailwind-merge --legacy-peer-deps`
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm run build` passes cleanly after install
- **Committed in:** dfc19c7 (Task 3 commit)

**4. [Rule 1 - Type Alignment] UserInfo field name mismatch**
- **Found during:** Task 1 (creating src/lib/types.ts)
- **Issue:** Plan specified `user_type: string | null` but bindings.ts exports `type: string | null` — would cause type errors when passing validateToken result to setAuth
- **Fix:** Used `type: string | null` in src/lib/types.ts to match bindings.ts
- **Files modified:** src/lib/types.ts, src/stores/authStore.test.ts (updated mock user objects)
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** ae71e17 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 bug, 1 type alignment)
**Impact on plan:** All fixes necessary for correct TypeScript compilation and successful build. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Auth store, app shell, and all shell components are complete — Plan 03 (repo listing) can consume `useAuthStore` for token/user and render into the AppShell content area
- Models and Datasets sidebar sections are clickable, and AppShell passes `activeSection` — Plan 03 populates the content area placeholders
- Sidebar "Recent" subgroups are empty placeholders ready for Plan 03 to populate with recently accessed repos

## Self-Check: PASSED

All key files verified present on disk. All task commits verified in git history.

---
*Phase: 01-foundation*
*Completed: 2026-03-19*
