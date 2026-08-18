import type { LeaveType, LeaveTypeFilters, LeaveTypePayload } from '@/types/masterData.types';
import {
  createLeaveType,
  deleteLeaveType,
  listLeaveTypes,
  updateLeaveType,
} from '@/services/masterData.service';
import { useCrudResource, type CrudResource } from '@/hooks/useCrudResource';

export const LEAVE_TYPE_KEYS = {
  root: ['leave-types'] as const,
  list: (filters: LeaveTypeFilters) => ['leave-types', 'list', filters] as const,
};

/**
 * `GET /leave-types` returns a PLAIN ARRAY — the table is unpaginated by design
 * (the primary key is a TINYINT, so the table can hold at most 255 rows and the
 * UI always wants the whole list for dropdowns).
 */
export function useLeaveTypes(filters: LeaveTypeFilters): CrudResource<LeaveType[], LeaveTypePayload> {
  return useCrudResource<LeaveType[], LeaveTypePayload>({
    entityKey: LEAVE_TYPE_KEYS.root,
    listKey: LEAVE_TYPE_KEYS.list(filters),
    list: () => listLeaveTypes(filters),
    create: createLeaveType,
    update: updateLeaveType,
    remove: deleteLeaveType,
  });
}
