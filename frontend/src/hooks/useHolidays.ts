import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PaginatedData } from '@/types/api.types';
import type {
  GenerateHolidaysPayload,
  Holiday,
  HolidayFilters,
  HolidayPayload,
} from '@/types/masterData.types';
import {
  createHoliday,
  deleteHoliday,
  generateHolidays,
  listHolidays,
  updateHoliday,
} from '@/services/masterData.service';
import { useCrudResource, type CrudResource } from '@/hooks/useCrudResource';

export const HOLIDAY_KEYS = {
  root: ['holidays'] as const,
  list: (filters: HolidayFilters) => ['holidays', 'list', filters] as const,
};

export function useHolidays(
  filters: HolidayFilters,
  /** `false` để không gọi API — dùng cho danh sách của chế độ xem đang tắt. */
  enabled = true,
): CrudResource<PaginatedData<Holiday>, HolidayPayload> {
  return useCrudResource<PaginatedData<Holiday>, HolidayPayload>({
    entityKey: HOLIDAY_KEYS.root,
    listKey: HOLIDAY_KEYS.list(filters),
    enabled,
    list: () => listHolidays(filters),
    create: createHoliday,
    update: updateHoliday,
    remove: deleteHoliday,
  });
}

/**
 * Sinh lịch nghỉ lễ pháp định của một năm.
 *
 * Chỉ làm mới danh sách khi ĐÃ GHI thật; bản xem trước không đụng vào cache vì
 * nó không thay đổi gì trong cơ sở dữ liệu.
 */
export function useGenerateHolidays() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: GenerateHolidaysPayload) => generateHolidays(payload),
    onSuccess: (result) => {
      if (!result.preview) {
        void queryClient.invalidateQueries({ queryKey: HOLIDAY_KEYS.root });
      }
    },
  });

  return {
    generate: mutation.mutateAsync,
    isGenerating: mutation.isPending,
  };
}
