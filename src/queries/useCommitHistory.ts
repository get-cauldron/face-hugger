import { listCommits, type CommitData } from '@huggingface/hub';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export type { CommitData };

export function useCommitHistory(repoId: string, repoType: 'model' | 'dataset') {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['commit-history', repoId],
    queryFn: async (): Promise<CommitData[]> => {
      const commits: CommitData[] = [];
      for await (const c of listCommits({
        repo: { name: repoId, type: repoType },
        batchSize: 100,
        accessToken: token!,
      })) {
        commits.push(c);
      }
      return commits;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!token && !!repoId,
  });
}
