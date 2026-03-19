import { listFiles, type ListFileEntry } from '@huggingface/hub';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export type { ListFileEntry };

export function useRepoFiles(repoId: string, repoType: 'model' | 'dataset') {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['repo-files', repoId],
    queryFn: async (): Promise<ListFileEntry[]> => {
      const files: ListFileEntry[] = [];
      for await (const f of listFiles({
        repo: { name: repoId, type: repoType },
        recursive: true,
        expand: false, // expand: false for initial load (fast); metadata fetched on demand
        accessToken: token!,
      })) {
        files.push(f);
      }
      return files;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!token && !!repoId,
  });
}
