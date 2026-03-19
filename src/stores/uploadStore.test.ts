import { describe, it, expect, beforeEach } from 'vitest';
import { useUploadStore } from './uploadStore';

describe('uploadStore', () => {
  beforeEach(() => {
    useUploadStore.setState({ jobs: [], progressMap: {}, wizardOpen: false, wizardRepoId: null });
  });

  it('setWizardOpen toggles wizard state', () => {
    useUploadStore.getState().setWizardOpen(true);
    expect(useUploadStore.getState().wizardOpen).toBe(true);
  });

  it('updateProgress merges progress entries', () => {
    const update = {
      job_id: 'abc',
      bytes_sent: 100,
      total_bytes: 1000,
      speed_bps: 500,
      eta_seconds: 10,
      state: 'uploading' as const,
    };
    useUploadStore.getState().updateProgress([update]);
    expect(useUploadStore.getState().progressMap['abc']).toEqual(update);
  });
});
