# Face Hugger

## What This Is

A desktop application that attaches to Hugging Face and never lets go. Face Hugger is an interactive client for uploading large files (models and datasets) to Hugging Face with rock-solid reliability, plus browsing, previewing, and managing HF repositories. Built with Tauri + React, it's a lightweight native app aimed at the open-source HF community.

## Core Value

Uploading multi-GB files to Hugging Face should work reliably on flaky connections without babysitting — resumable, visible, and recoverable.

## Requirements

### Validated

- ✓ HF authentication via token paste — Validated in Phase 1: Foundation
- ✓ Model repo browsing and basic management — Validated in Phase 1: Foundation
- ✓ Resumable, fault-tolerant uploads for large files — Validated in Phase 2: Upload Engine
- ✓ Upload progress visibility — Validated in Phase 2: Upload Engine

### Active

- [ ] Resumable, fault-tolerant uploads for large files (models and datasets, 1-100+ GB)
- [ ] Upload progress visibility — per-file progress bars, speed, ETA
- [ ] Upload wizard for guided first-time experience
- [ ] Advanced mode with drag-and-queue and folder sync for power users
- [ ] OAuth browser login
- [ ] Browse and preview datasets — view rows, check schema
- [ ] Repository CRUD — create, rename, delete repos and files on HF
- [ ] Version tracking — commit history, compare versions, rollback
- [ ] Background uploads with system tray presence

### Out of Scope

- Model training or fine-tuning — this is a file management tool, not a training platform
- Dataset annotation or labeling — out of domain
- Real-time collaboration — single-user client
- HF Spaces management — focused on models and datasets only

## Context

- The existing HF CLI (`huggingface-cli upload`) is clunky and unreliable for large uploads, especially on unstable connections
- Built with Tauri v2 (Rust backend) + React frontend for a lightweight, fast native experience
- Target audience: HF community members who work with large models and datasets regularly
- Open source project, potentially published free on app stores
- Needs to be polished enough for community adoption — good UX, onboarding, and reliability are non-negotiable

## Constraints

- **Tech stack**: Tauri v2 + React — Rust backend for file I/O and network resilience, React for UI
- **HF API**: Must work within Hugging Face Hub API capabilities and rate limits
- **Cross-platform**: Desktop app should work on macOS, Windows, Linux (Tauri supports all three)
- **File sizes**: Must handle files 100GB+ without memory issues — streaming/chunked uploads required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri v2 over Electron | Lightweight, Rust backend great for file I/O and network ops | — Pending |
| Wizard + advanced mode | Wizard teaches workflow for new users, power mode for repeat users | — Pending |
| Token + OAuth auth | Token for power users, OAuth for ease — covers all users | — Pending |
| Open source + app store | Community tool, free distribution | — Pending |

---
*Last updated: 2026-03-19 after Phase 2: Upload Engine complete*
