import type { PaginatedData } from '@/types/api.types';
import type { Holiday, HolidayFilters, HolidayPayload } from '@/types/masterData.types';
import {
  createHoliday,
  deleteHoliday,
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
): CrudResource<PaginatedData<Holiday>, HolidayPayload> {
  return useCrudResource<PaginatedData<Holiday>, HolidayPayload>({
    entityKey: HOLIDAY_KEYS.root,
    listKey: HOLIDAY_KEYS.list(filters),
    list: () => listHolidays(filters),
    create: createHoliday,
    update: updateHoliday,
    remove: deleteHoliday,
  });
}
