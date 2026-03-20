# Face Hugger

## What This Is

A desktop application that attaches to Hugging Face and never lets go. Face Hugger is a native client for uploading large files (models and datasets) to Hugging Face with rock-solid reliability, plus browsing, previewing, and managing HF repositories. Built with Tauri v2 (Rust) + React, it ships as a lightweight native app on macOS, Windows, and Linux.

## Core Value

Uploading multi-GB files to Hugging Face should work reliably on flaky connections without babysitting — resumable, visible, and recoverable.

## Current State

**v1.0 shipped** — 2026-03-20
- 12,811 lines of code (TypeScript + Rust)
- 6 phases, 24 plans, 145 commits
- 23/23 requirements satisfied
- 21 test files (51 unit tests, 17 E2E tests, 4 Rust tests, native tests)
- CI pipeline gates releases on all 3 platforms

## Requirements

### Validated — v1.0

- ✓ HF authentication via token paste — v1.0
- ✓ OAuth browser login with PKCE + token fallback — v1.0
- ✓ Secure keyring storage (macOS Keychain, Windows Credential Manager, Linux Secret Service) — v1.0
- ✓ User info display (username, avatar, token scopes) — v1.0
- ✓ Model and dataset repo browsing with search, filter, sort — v1.0
- ✓ Resumable, fault-tolerant chunked uploads (1-100GB+) — v1.0
- ✓ Upload progress with speed and ETA — v1.0
- ✓ Upload queue with pause, resume, cancel per file — v1.0
- ✓ Runtime concurrent upload limit control — v1.0
- ✓ Auto Xet/LFS protocol detection — v1.0
- ✓ Upload wizard for guided first-time experience — v1.0
- ✓ Drag-and-queue uploads with immediate queue refresh — v1.0
- ✓ Folder sync to HF repo — v1.0
- ✓ Background uploads with system tray, close-to-tray, notifications — v1.0
- ✓ Repository CRUD (create, browse files, delete files, delete repos) — v1.0
- ✓ Commit history timeline with revert and restore — v1.0
- ✓ Dataset preview with rows, search, filter, column statistics — v1.0
- ✓ Cross-platform CI/CD release workflow with auto-update — v1.0
- ✓ Comprehensive test suite with CI gate — v1.0

### Active

(No active requirements — planning next milestone)

### Out of Scope

- Model training or fine-tuning — file management tool, not a training platform
- Dataset annotation or labeling — out of domain
- Real-time collaboration — single-user client
- HF Spaces management — focused on models and datasets only
- Mobile app — desktop-first, Tauri supports mobile but deferring

## Known Tech Debt

- Xet shard format is JSON placeholder — Xet CAS uploads will fail (LFS works fine)
- Fixed-size 64MB chunking instead of Gearhash CDC — reduces Xet deduplication
- Upload commands bypass generated bindings.ts (two invocation styles, both work)
- Updater pubkey placeholder in tauri.conf.json — needs signing key before releases

## Context

- Built with Tauri v2 (Rust backend) + React frontend
- Target audience: HF community members who work with large models and datasets
- Open source project, potentially published free on app stores
- shadcn/ui component library, Tailwind v4, TanStack Query for data fetching
- SQLite for upload queue persistence, OS keychain for token storage

## Constraints

- **Tech stack**: Tauri v2 + React — Rust backend for file I/O and network resilience, React for UI
- **HF API**: Must work within Hugging Face Hub API capabilities and rate limits
- **Cross-platform**: macOS, Windows, Linux (Tauri supports all three)
- **File sizes**: Must handle files 100GB+ without memory issues — streaming/chunked uploads

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri v2 over Electron | Lightweight, Rust backend great for file I/O and network ops | ✓ Good — 12.8k LOC, fast builds, native feel |
| Wizard + advanced mode | Wizard teaches workflow for new users, power mode for repeat users | ✓ Good — both paths working end-to-end |
| Token + OAuth auth | Token for power users, OAuth for ease — covers all users | ✓ Good — unified keyring storage |
| Section-based routing | No React Router for 3-4 view desktop app — local state routing | ✓ Good — simpler, no URL management overhead |
| tauri-specta for IPC | Type-safe Rust↔React IPC boundary prevents JS/Rust bugs | ✓ Good — caught multiple type issues early |
| Playwright + tauri-driver | Layered E2E: browser tests + native tests (Linux/Windows only) | ✓ Good — 17 E2E + native coverage, macOS manual-only |
| Hard CI gate on releases | All tests must pass before release artifacts build | ✓ Good — prevents shipping broken builds |

---
*Last updated: 2026-03-20 after v1.0 milestone shipped*
