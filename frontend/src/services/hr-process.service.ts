import { apiClient } from '@/lib/axios';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  DisciplineReward,
  DisciplineRewardPayload,
  DisciplineRewardType,
} from '@/types/hr-process.types';

/**
 * Mọi call của phân hệ Khen thưởng / Kỷ luật (frontend/CLAUDE.md folder rule).
 */

export async function listDisciplineRewards(
  employeeId: number,
  type?: DisciplineRewardType,
): Promise<DisciplineReward[]> {
  const { data } = await apiClient.get<ApiSuccessResponse<DisciplineReward[]>>(
    `/employees/${employeeId}/disciplines-rewards`,
    { params: type ? { type } : undefined },
  );
  return data.data;
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
