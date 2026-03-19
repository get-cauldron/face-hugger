import { create } from 'zustand';
import type { UploadJob, UploadProgress } from '../commands/upload';

interface UploadState {
  jobs: UploadJob[];
  progressMap: Record<string, UploadProgress>;
  wizardOpen: boolean;
  wizardRepoId: string | null; // pre-selected repo for wizard (from drag-drop)
  setJobs: (jobs: UploadJob[]) => void;
  updateProgress: (updates: UploadProgress[]) => void;
  setWizardOpen: (open: boolean) => void;
  setWizardRepoId: (repoId: string | null) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  jobs: [],
  progressMap: {},
  wizardOpen: false,
  wizardRepoId: null,
  setJobs: (jobs) => set({ jobs }),
  updateProgress: (updates) =>
    set((state) => ({
      progressMap: updates.reduce(
        (acc, p) => ({ ...acc, [p.job_id]: p }),
        { ...state.progressMap }
      ),
    })),
  setWizardOpen: (open) => set({ wizardOpen: open }),
  setWizardRepoId: (repoId) => set({ wizardRepoId: repoId }),
}));
