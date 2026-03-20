import type { RepoItem } from '../../../src/queries/useRepos';

export const mockModelRepo: RepoItem = {
  id: 'testuser/test-model',
  name: 'test-model',
  owner: 'testuser',
  type: 'model' as const,
  private: false,
  downloads: 100,
  likes: 10,
  lastModified: '2026-01-01T00:00:00Z',
  tags: ['pytorch'],
};

export const mockDatasetRepo: RepoItem = {
  id: 'testuser/test-dataset',
  name: 'test-dataset',
  owner: 'testuser',
  type: 'dataset' as const,
  private: false,
  downloads: 50,
  likes: 5,
  lastModified: '2026-01-01T00:00:00Z',
  tags: ['csv'],
};

export const mockRepos: RepoItem[] = [mockModelRepo, mockDatasetRepo];
