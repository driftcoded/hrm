import { useQuery } from '@tanstack/react-query';
import type { PaginatedData } from '@/types/api.types';
import type {
  Department,
  DepartmentFilters,
  DepartmentPayload,
  DepartmentTreeNode,
} from '@/types/masterData.types';
import {
  createDepartment,
  deleteDepartment,
  listDepartmentTree,
  listDepartments,
  updateDepartment,
} from '@/services/masterData.service';
import { useCrudResource, type CrudResource } from '@/hooks/useCrudResource';

/** Cache keys — `['departments', …]` per docs/architecture.md §4.1. */
export const DEPARTMENT_KEYS = {
  root: ['departments'] as const,
  list: (filters: DepartmentFilters) => ['departments', 'list', filters] as const,
  tree: ['departments', 'tree'] as const,
};

/** Flat, paginated list. */
export function useDepartments(
  filters: DepartmentFilters,
  enabled = true,
): CrudResource<PaginatedData<Department>, DepartmentPayload> {
  return useCrudResource<PaginatedData<Department>, DepartmentPayload>({
    entityKey: DEPARTMENT_KEYS.root,
    listKey: DEPARTMENT_KEYS.list(filters),
    list: () => listDepartments(filters),
    create: createDepartment,
    update: updateDepartment,
    remove: deleteDepartment,
    enabled,
  });
}

/**
 * Nested tree. Shares the `['departments']` key root with the flat list, so a
 * save through either view invalidates both.
 */
export function useDepartmentTree(
  enabled = true,
): CrudResource<DepartmentTreeNode[], DepartmentPayload> {
  return useCrudResource<DepartmentTreeNode[], DepartmentPayload>({
    entityKey: DEPARTMENT_KEYS.root,
    listKey: DEPARTMENT_KEYS.tree,
    list: listDepartmentTree,
    create: createDepartment,
    update: updateDepartment,
    remove: deleteDepartment,
    enabled,
  });
}

/**
 * Every department, for the parent-department and position-department pickers.
 *
 * Reads the TREE endpoint on purpose: the flat list caps `limit` at 100, so a
 * company with more departments than that would get a dropdown that silently
 * omits some of them.
 *
 * `enabled` lets a caller postpone the request until the picker is actually
 * needed (e.g. when the form modal opens). It shares `DEPARTMENT_KEYS.tree` with
 * `useDepartmentTree`, so on a screen that already shows the tree this reads the
 * cache instead of issuing a second request — a disabled query still serves
 * whatever is already cached under its key.
 */
export function useAllDepartments(enabled = true) {
  const query = useQuery({
    queryKey: DEPARTMENT_KEYS.tree,
    queryFn: listDepartmentTree,
    staleTime: 5 * 60_000,
    enabled,
  });

  return {
    tree: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
