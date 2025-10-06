import { useQueryClient } from '@tanstack/react-query';

export function useRefresh() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.refetchQueries({ type: 'active' });
  };
}
