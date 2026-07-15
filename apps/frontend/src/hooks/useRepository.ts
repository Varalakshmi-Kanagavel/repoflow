import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api.client.js';

export function useRepository(repoId: string) {
  return useQuery({
    queryKey: ['repository', repoId],
    queryFn: () => apiClient.getRepository(repoId),
    // Poll every 2 seconds if the repo is not fully ingested yet
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && (status === 'COMPLETED' || status === 'FAILED')) {
        return false;
      }
      return 2000;
    },
    enabled: !!repoId,
  });
}
