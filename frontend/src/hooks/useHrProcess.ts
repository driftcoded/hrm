import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acknowledgeReview,
  completeParticipant,
  createDisciplineReward,
  createReview,
  createTraining,
  deleteDisciplineReward,
  deleteReview,
  deleteTraining,
  enrollEmployees,
  listDisciplineRewards,
  listEmployeeTrainings,
  listParticipants,
  listReviews,
  listTrainings,
  submitReview,
  unenrollParticipant,
  updateDisciplineReward,
  updateReview,
  updateTraining,
} from '@/services/hr-process.service';
import type {
  CompleteTrainingPayload,
  CreateReviewPayload,
  DisciplineRewardPayload,
  DisciplineRewardType,
  ReviewFilters,
  TrainingFilters,
  TrainingPayload,
  UpdateReviewPayload,
} from '@/types/hr-process.types';

/** Query key của ba phân hệ HR Processes. */
export const HR_KEYS = {
  rewardsRoot: ['hr', 'rewards'] as const,
  rewards: (employeeId: number, type?: DisciplineRewardType) =>
    ['hr', 'rewards', employeeId, type ?? 'all'] as const,
  reviewsRoot: ['hr', 'reviews'] as const,
  reviews: (filters?: ReviewFilters) => ['hr', 'reviews', filters] as const,
  trainingsRoot: ['hr', 'trainings'] as const,
  trainings: (filters?: TrainingFilters) =>
    ['hr', 'trainings', 'list', filters] as const,
  participants: (trainingId: number) =>
    ['hr', 'trainings', 'participants', trainingId] as const,
  employeeTrainings: (employeeId: number) =>
    ['hr', 'trainings', 'employee', employeeId] as const,
};

// -------------------------------------------------- khen thưởng / kỷ luật ----

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

// ------------------------------------------------------ đánh giá hiệu suất ----

export function useReviews(filters?: ReviewFilters) {
  return useQuery({
    queryKey: HR_KEYS.reviews(filters),
    queryFn: () => listReviews(filters),
  });
}

export function useReviewMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: HR_KEYS.reviewsRoot });
  };

  const create = useMutation({
    mutationFn: (payload: CreateReviewPayload) => createReview(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateReviewPayload }) =>
      updateReview(id, payload),
    onSuccess: invalidate,
  });

  const submit = useMutation({
    mutationFn: (id: number) => submitReview(id),
    onSuccess: invalidate,
  });

  const acknowledge = useMutation({
    mutationFn: (id: number) => acknowledgeReview(id),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteReview(id),
    onSuccess: invalidate,
  });

  return {
    createReview: create.mutateAsync,
    updateReview: update.mutateAsync,
    submitReview: submit.mutateAsync,
    acknowledgeReview: acknowledge.mutateAsync,
    deleteReview: remove.mutateAsync,
    isCreating: create.isPending,
    isUpdating: update.isPending,
    isSubmitting: submit.isPending,
    isAcknowledging: acknowledge.isPending,
    isDeleting: remove.isPending,
  };
}

// ---------------------------------------------------------------- đào tạo ----

export function useTrainings(filters?: TrainingFilters) {
  return useQuery({
    queryKey: HR_KEYS.trainings(filters),
    queryFn: () => listTrainings(filters),
  });
}

export function useTrainingParticipants(trainingId: number | null) {
  return useQuery({
    queryKey: HR_KEYS.participants(trainingId ?? 0),
    queryFn: () => listParticipants(trainingId as number),
    enabled: trainingId !== null,
  });
}

export function useEmployeeTrainings(employeeId: number) {
  return useQuery({
    queryKey: HR_KEYS.employeeTrainings(employeeId),
    queryFn: () => listEmployeeTrainings(employeeId),
  });
}

export function useTrainingMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: HR_KEYS.trainingsRoot });
  };

  const create = useMutation({
    mutationFn: (payload: TrainingPayload) => createTraining(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<TrainingPayload>;
    }) => updateTraining(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTraining(id),
    onSuccess: invalidate,
  });

  const enroll = useMutation({
    mutationFn: ({
      trainingId,
      employeeIds,
    }: {
      trainingId: number;
      employeeIds: number[];
    }) => enrollEmployees(trainingId, employeeIds),
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: ({
      trainingId,
      employeeId,
      payload,
    }: {
      trainingId: number;
      employeeId: number;
      payload: CompleteTrainingPayload;
    }) => completeParticipant(trainingId, employeeId, payload),
    onSuccess: invalidate,
  });

  const unenroll = useMutation({
    mutationFn: ({
      trainingId,
      employeeId,
    }: {
      trainingId: number;
      employeeId: number;
    }) => unenrollParticipant(trainingId, employeeId),
    onSuccess: invalidate,
  });

  return {
    createTraining: create.mutateAsync,
    updateTraining: update.mutateAsync,
    deleteTraining: remove.mutateAsync,
    enrollEmployees: enroll.mutateAsync,
    completeParticipant: complete.mutateAsync,
    unenrollParticipant: unenroll.mutateAsync,
    isCreating: create.isPending,
    isUpdating: update.isPending,
    isDeleting: remove.isPending,
    isEnrolling: enroll.isPending,
    isCompleting: complete.isPending,
    isUnenrolling: unenroll.isPending,
  };
}
