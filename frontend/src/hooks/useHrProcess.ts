import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDisciplineReward,
  deleteDisciplineReward,
  listDisciplineRewards,
  updateDisciplineReward,
} from '@/services/hr-process.service';
import type {
  DisciplineRewardPayload,
  DisciplineRewardType,
} from '@/types/hr-process.types';

/** Query key của phân hệ Khen thưởng / Kỷ luật. */
export const HR_KEYS = {
  rewardsRoot: ['hr', 'rewards'] as const,
  rewards: (employeeId: number, type?: DisciplineRewardType) =>
    ['hr', 'rewards', employeeId, type ?? 'all'] as const,
};

export function useDisciplineRewards(
  employeeId: number,
  type?: DisciplineRewardType,
) {
  return useQuery({
    queryKey: HR_KEYS.rewards(employeeId, type),
    queryFn: () => listDisciplineRewards(employeeId, type),
  });
}

export function useDisciplineRewardMutations(employeeId: number) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: HR_KEYS.rewardsRoot });
  };

  const create = useMutation({
    mutationFn: (payload: DisciplineRewardPayload) =>
      createDisciplineReward(employeeId, payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      recordId,
      payload,
    }: {
      recordId: number;
      payload: Partial<DisciplineRewardPayload>;
    }) => updateDisciplineReward(employeeId, recordId, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (recordId: number) =>
      deleteDisciplineReward(employeeId, recordId),
    onSuccess: invalidate,
  });

  return {
    createRecord: create.mutateAsync,
    updateRecord: update.mutateAsync,
    deleteRecord: remove.mutateAsync,
    isCreating: create.isPending,
    isUpdating: update.isPending,
    isDeleting: remove.isPending,
  };
}
