import { apiClient } from '@/lib/axios';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api.types';
import type {
  CompleteTrainingPayload,
  CreateReviewPayload,
  DisciplineReward,
  DisciplineRewardPayload,
  DisciplineRewardType,
  EnrollResult,
  PerformanceReview,
  ReviewFilters,
  Training,
  TrainingFilters,
  TrainingParticipant,
  TrainingPayload,
  UpdateReviewPayload,
} from '@/types/hr-process.types';

/**
 * Mọi call của ba phân hệ HR Processes — khen thưởng/kỷ luật, đánh giá hiệu
 * suất, đào tạo (frontend/CLAUDE.md folder rule).
 */

function toQuery(filters?: object): Record<string, string> | undefined {
  if (!filters) {
    return undefined;
  }

  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params[key] = String(value);
  }

  return Object.keys(params).length > 0 ? params : undefined;
}

async function get<T>(url: string, filters?: object): Promise<T> {
  const { data } = await apiClient.get<ApiSuccessResponse<T>>(url, {
    params: toQuery(filters),
  });
  return data.data;
}

// -------------------------------------------------- khen thưởng / kỷ luật ----

export function listDisciplineRewards(
  employeeId: number,
  type?: DisciplineRewardType,
): Promise<DisciplineReward[]> {
  return get<DisciplineReward[]>(
    `/employees/${employeeId}/disciplines-rewards`,
    type ? { type } : undefined,
  );
}

export async function createDisciplineReward(
  employeeId: number,
  payload: DisciplineRewardPayload,
): Promise<DisciplineReward> {
  const { data } = await apiClient.post<ApiSuccessResponse<DisciplineReward>>(
    `/employees/${employeeId}/disciplines-rewards`,
    payload,
  );
  return data.data;
}

export async function updateDisciplineReward(
  employeeId: number,
  recordId: number,
  payload: Partial<DisciplineRewardPayload>,
): Promise<DisciplineReward> {
  const { data } = await apiClient.patch<ApiSuccessResponse<DisciplineReward>>(
    `/employees/${employeeId}/disciplines-rewards/${recordId}`,
    payload,
  );
  return data.data;
}

export async function deleteDisciplineReward(
  employeeId: number,
  recordId: number,
): Promise<{ id: number; deleted: boolean }> {
  const { data } = await apiClient.delete<
    ApiSuccessResponse<{ id: number; deleted: boolean }>
  >(`/employees/${employeeId}/disciplines-rewards/${recordId}`);
  return data.data;
}

// ------------------------------------------------------ đánh giá hiệu suất ----

export function listReviews(
  filters?: ReviewFilters,
): Promise<PaginatedData<PerformanceReview>> {
  return get<PaginatedData<PerformanceReview>>(
    '/performance-reviews',
    filters,
  );
}

export function getReview(id: number): Promise<PerformanceReview> {
  return get<PerformanceReview>(`/performance-reviews/${id}`);
}

export async function createReview(
  payload: CreateReviewPayload,
): Promise<PerformanceReview> {
  const { data } = await apiClient.post<ApiSuccessResponse<PerformanceReview>>(
    '/performance-reviews',
    payload,
  );
  return data.data;
}

export async function updateReview(
  id: number,
  payload: UpdateReviewPayload,
): Promise<PerformanceReview> {
  const { data } = await apiClient.patch<ApiSuccessResponse<PerformanceReview>>(
    `/performance-reviews/${id}`,
    payload,
  );
  return data.data;
}

async function reviewTransition(
  id: number,
  action: string,
): Promise<PerformanceReview> {
  const { data } = await apiClient.patch<ApiSuccessResponse<PerformanceReview>>(
    `/performance-reviews/${id}/${action}`,
    {},
  );
  return data.data;
}

export function submitReview(id: number): Promise<PerformanceReview> {
  return reviewTransition(id, 'submit');
}

export function acknowledgeReview(id: number): Promise<PerformanceReview> {
  return reviewTransition(id, 'acknowledge');
}

export async function deleteReview(
  id: number,
): Promise<{ id: number; deleted: boolean }> {
  const { data } = await apiClient.delete<
    ApiSuccessResponse<{ id: number; deleted: boolean }>
  >(`/performance-reviews/${id}`);
  return data.data;
}

// ---------------------------------------------------------------- đào tạo ----

export function listTrainings(
  filters?: TrainingFilters,
): Promise<PaginatedData<Training>> {
  return get<PaginatedData<Training>>('/trainings', filters);
}

export function getTraining(id: number): Promise<Training> {
  return get<Training>(`/trainings/${id}`);
}

export async function createTraining(
  payload: TrainingPayload,
): Promise<Training> {
  const { data } = await apiClient.post<ApiSuccessResponse<Training>>(
    '/trainings',
    payload,
  );
  return data.data;
}

export async function updateTraining(
  id: number,
  payload: Partial<TrainingPayload>,
): Promise<Training> {
  const { data } = await apiClient.patch<ApiSuccessResponse<Training>>(
    `/trainings/${id}`,
    payload,
  );
  return data.data;
}

export async function deleteTraining(
  id: number,
): Promise<{ id: number; deleted: boolean }> {
  const { data } = await apiClient.delete<
    ApiSuccessResponse<{ id: number; deleted: boolean }>
  >(`/trainings/${id}`);
  return data.data;
}

export function listParticipants(
  trainingId: number,
): Promise<TrainingParticipant[]> {
  return get<TrainingParticipant[]>(`/trainings/${trainingId}/participants`);
}

export async function enrollEmployees(
  trainingId: number,
  employeeIds: number[],
): Promise<EnrollResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<EnrollResult>>(
    `/trainings/${trainingId}/participants`,
    { employeeIds },
  );
  return data.data;
}

export async function completeParticipant(
  trainingId: number,
  employeeId: number,
  payload: CompleteTrainingPayload,
): Promise<TrainingParticipant> {
  const { data } = await apiClient.patch<
    ApiSuccessResponse<TrainingParticipant>
  >(`/trainings/${trainingId}/participants/${employeeId}`, payload);
  return data.data;
}

export async function unenrollParticipant(
  trainingId: number,
  employeeId: number,
): Promise<{ id: number; deleted: boolean }> {
  const { data } = await apiClient.delete<
    ApiSuccessResponse<{ id: number; deleted: boolean }>
  >(`/trainings/${trainingId}/participants/${employeeId}`);
  return data.data;
}

/** Lịch sử đào tạo của một nhân viên — cho tab trong hồ sơ. */
export function listEmployeeTrainings(
  employeeId: number,
): Promise<TrainingParticipant[]> {
  return get<TrainingParticipant[]>(`/employees/${employeeId}/trainings`);
}
