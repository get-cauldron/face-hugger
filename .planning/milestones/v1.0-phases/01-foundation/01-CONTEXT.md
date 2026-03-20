# Phase 1: Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Tauri v2 desktop app with HF token authentication, OS keychain storage, authenticated user display, and a repo listing view for models and datasets. Establishes the app shell, navigation, IPC scaffold (tauri-specta), and visual identity that all subsequent phases build on. No upload functionality — that's Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Login experience
- Full-screen login on first launch — centered card with Face Hugger icon, token field, welcome message, nothing else until authenticated
- Auto-detect existing `~/.huggingface/token` (or `~/.cache/huggingface/token`) before showing paste field — skip login if valid token found
- If no existing token: single paste field with clear instructions and a link to HF token page
- On valid token: instant transition — validate against HF API, flash green check with username/avatar, slide into main app
- On invalid token: inline red error text under the field — "Invalid token — check your HF settings" with a link to HF token settings page
- Token stored in OS keyring immediately after validation (macOS Keychain, Windows Credential Manager, Linux Secret Service)

### App shell & navigation
- Custom titlebar — no native titlebar, custom drag region with app title and window controls (like Spotify, Discord)
- Left sidebar — full panel style with section headers, not just icons
- Sidebar sections for Phase 1: Upload (placeholder/disabled until Phase 2), Models, Datasets, Settings
- Recent repos (last 3-5 accessed) shown under each section for quick access
- User info (avatar + username) at sidebar bottom — click for settings/logout (like Discord, Slack)
- Minimum window size: 800x600
- Sidebar is not collapsible in Phase 1 — full panel always visible

### Repo list display
- Hybrid view: card grid default, toggleable to table/list view — user chooses density
- Card info: repo name, type badge (model/dataset), visibility (public/private), total size, file count, HF tags as small badges
- Search bar + filter by type (model/dataset) and visibility (public/private) available from Phase 1
- Sort order: user-selectable dropdown (last updated, alphabetical, size), app remembers preference
- Empty state: friendly illustration + "Create your first repo" CTA button
- Models and Datasets are separate sections in sidebar, each with their own repo list view

### Visual identity
- Dark theme by default, light mode available in settings
- Warm orange/amber accent color palette — matches the Face Hugger icon, orange accents on dark background
- Playful touches — icon in sidebar, fun empty states, personality in microcopy (like Raycast or Arc)
- Mixed shape language — rounded containers (generous border-radius on cards, panels), sharper inner elements (like macOS)
- Spacious information density — generous whitespace, breathing room (like Apple apps)
- Subtle polish motion — smooth page transitions, hover effects, loading shimmers, not distracting
- shadcn/ui components as base, customized to match the warm orange/dark theme

### Claude's Discretion
- Font choice (system fonts vs Inter vs Geist — pick what fits the warm/spacious design)
- Repo list pagination strategy (pick based on HF API pagination behavior)
- Loading skeleton design for repo list
- Exact animation easing curves and durations
- Error state handling beyond token validation
- Exact spacing scale and typography sizes

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-02, AUTH-04, REPO-01 are this phase's requirements
- `.planning/research/SUMMARY.md` — Full research summary with stack recommendations and pitfalls

### Stack research
- `.planning/research/STACK.md` — Specific library versions, Tauri v2 + React 19 + shadcn/ui + tauri-specta stack details
- `.planning/research/ARCHITECTURE.md` — Component boundaries, IPC patterns, state management approach

### Visual reference
- `icon.png` — App icon in project root, defines the warm orange/amber visual identity

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes all patterns (IPC, state management, component structure, styling)

### Integration Points
- This phase creates the foundation all subsequent phases plug into:
  - Auth state (token in keyring + in-memory) used by every HF API call
  - Sidebar navigation extended by future phases (Upload becomes active in Phase 2)
  - tauri-specta typed IPC bridge used by all Rust commands
  - shadcn/ui theme tokens used by all UI components
  - TanStack Query setup used by all HF data fetching

</code_context>

<specifics>
## Specific Ideas

- The icon is a cute, warm orange facehugger character — the UI should echo this warmth without being childish
- Sidebar should feel like Finder's full panel but with the polish of Linear
- Login screen should feel welcoming, not corporate — the mascot can appear here
- Auto-detecting existing HF tokens respects power users who already have `huggingface-cli` configured

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-19*
