import { useQuery } from '@tanstack/react-query';
import { listModels, listDatasets } from '@huggingface/hub';
import { useAuthStore } from '../stores/authStore';

export interface RepoItem {
  id: string;           // "username/repo-name"
  name: string;         // "repo-name" (extracted from id)
  owner: string;        // "username" (extracted from id)
  private: boolean;
  downloads: number;
  lastModified: string; // ISO date string
  tags: string[];
  likes: number;
  type: 'model' | 'dataset';
}

export function useModels() {
  const { user, token } = useAuthStore();
  return useQuery({
    queryKey: ['repos', 'models', user?.name],
    queryFn: async (): Promise<RepoItem[]> => {
      const models: RepoItem[] = [];
      for await (const model of listModels({
        search: { owner: user!.name },
        accessToken: token!,
        additionalFields: ['tags'],
      })) {
        models.push({
          id: model.name,
          name: model.name.includes('/') ? model.name.split('/').slice(1).join('/') : model.name,
          owner: model.name.includes('/') ? model.name.split('/')[0] : user!.name,
          private: model.private ?? false,
          downloads: model.downloads ?? 0,
          lastModified: model.updatedAt ? model.updatedAt.toISOString() : '',
          tags: (model as any).tags ?? [],
          likes: model.likes ?? 0,
          type: 'model',
        });
      }
      return models;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.name && !!token,
  });
}

export function useDatasets() {
  const { user, token } = useAuthStore();
  return useQuery({
    queryKey: ['repos', 'datasets', user?.name],
    queryFn: async (): Promise<RepoItem[]> => {
      const datasets: RepoItem[] = [];
      for await (const dataset of listDatasets({
        search: { owner: user!.name },
        accessToken: token!,
        additionalFields: ['tags'],
      })) {
        datasets.push({
          id: dataset.name,
          name: dataset.name.includes('/') ? dataset.name.split('/').slice(1).join('/') : dataset.name,
          owner: dataset.name.includes('/') ? dataset.name.split('/')[0] : user!.name,
          private: dataset.private ?? false,
          downloads: dataset.downloads ?? 0,
          lastModified: dataset.updatedAt ? dataset.updatedAt.toISOString() : '',
          tags: (dataset as any).tags ?? [],
          likes: dataset.likes ?? 0,
          type: 'dataset',
        });
      }
      return datasets;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.name && !!token,
  });
}
