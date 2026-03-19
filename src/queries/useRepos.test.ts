import { describe, it, expect } from 'vitest';

// Wave 0 test stubs for repo listing behavior (REPO-01)

describe('useModels', () => {
  it('should fetch models for the authenticated user', () => {
    // REPO-01: useModels must return RepoItem[] for the logged-in user
    expect(true).toBe(false); // WAVE 0 STUB: mock @huggingface/hub and test useModels
  });

  it('should not fetch when user is not authenticated', () => {
    // REPO-01: useModels must have enabled: false when no token
    expect(true).toBe(false); // WAVE 0 STUB: test enabled flag
  });
});

describe('useDatasets', () => {
  it('should fetch datasets for the authenticated user', () => {
    // REPO-01: useDatasets must return RepoItem[] for the logged-in user
    expect(true).toBe(false); // WAVE 0 STUB: mock @huggingface/hub and test useDatasets
  });
});
