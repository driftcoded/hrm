import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedData } from '@/types/api.types';
import type { DeleteResult } from '@/types/masterData.types';
import type {
  Contract,
  ContractFilters,
  CreateContractPayload,
  CreateDependentPayload,
  CreateEmployeePayload,
  Dependent,
  EmployeeDetail,
  EmployeeFilters,
  EmployeeListItem,
  EmployeeStats,
  FamilyMember,
  FamilyMemberPayload,
  RoleOption,
  TerminateContractPayload,
  UpdateContractPayload,
  UpdateDependentPayload,
  UpdateEmployeePayload,
} from '@/types/employee.types';
import {
  createContract,
  createDependent,
  createEmployee,
  createFamilyMember,
  deleteContract,
  deleteDependent,
  deleteEmployee,
  deleteFamilyMember,
  getEmployee,
  getEmployeeStats,
  listContracts,
  listDependents,
  listEmployees,
  listFamilyMembers,
  listRoles,
  restoreEmployee,
  terminateContract,
  updateContract,
  updateDependent,
  updateEmployee,
  updateFamilyMember,
  uploadEmployeeAvatar,
} from '@/services/employee.service';

/**
 * TanStack Query wiring for the Employees module.
 *
 * These do NOT go through `useCrudResource` (the Settings hook). That helper
 * assumes one list + create/update/delete over a single flat entity, and the
 * Employees module breaks all three assumptions: it has a detail query, a stats
 * query, soft-delete plus restore, an upload, and two child collections keyed by
 * employee id. Forcing it through would mean adding options to a shared helper
 * that only one caller ever uses.
 *
 * Cache keys follow docs/architecture.md §4.1 — `['employees', …]`,
 * `['contracts', …]`. Invalidation is on the KEY ROOT after every write, so a
 * save refreshes every cached page/filter combination rather than only the one
 * the user happens to be looking at.
 *
 * A write that changes headcount or status also invalidates
 * `['employees','stats']`, because the tiles at the top of the list read from
 * there and would otherwise keep showing the old totals until a reload.
 */

export const EMPLOYEE_KEYS = {
  root: ['employees'] as const,
  list: (filters: EmployeeFilters) => ['employees', 'list', filters] as const,
  detail: (id: number) => ['employees', 'detail', id] as const,
  stats: ['employees', 'stats'] as const,
  search: (term: string) => ['employees', 'search', term] as const,
  family: (employeeId: number) => ['employees', 'family', employeeId] as const,
  dependents: (employeeId: number) => ['employees', 'dependents', employeeId] as const,
};

export const CONTRACT_KEYS = {
  root: ['contracts'] as const,
  list: (filters: ContractFilters) => ['contracts', 'list', filters] as const,
};

export const ROLE_KEYS = {
  root: ['roles'] as const,
};

// ------------------------------------------------------------------ list ---

export function useEmployees(filters: EmployeeFilters, enabled = true) {
  const query = useQuery({
    queryKey: EMPLOYEE_KEYS.list(filters),
    queryFn: () => listEmployees(filters),
    enabled,
  });

  return {
    data: query.data as PaginatedData<EmployeeListItem> | undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

/**
 * The overview tiles and the right-hand rail.
 *
 * `isError` is a first-class result rather than a thrown exception: the numbers
 * are context, not the point of the screen, so a failing stats call must leave
 * the employee table perfectly usable. The page renders the rail's error state
 * and carries on.
 */
export function useEmployeeStats(enabled = true) {
  const query = useQuery({
    queryKey: EMPLOYEE_KEYS.stats,
    queryFn: getEmployeeStats,
    enabled,
    staleTime: 60_000,
    retry: false,
  });

  return {
    data: query.data as EmployeeStats | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

export function useEmployee(id: number | undefined) {
  const query = useQuery({
    queryKey: EMPLOYEE_KEYS.detail(id ?? 0),
    queryFn: () => getEmployee(id as number),
    enabled: id !== undefined && Number.isInteger(id) && id > 0,
  });

  return {
    data: query.data as EmployeeDetail | undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

// --------------------------------------------------------------- writes ---

export function useEmployeeMutations() {
  const queryClient = useQueryClient();

  /** Rows, the open detail record and the tiles all go stale together. */
  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.root });
  };

  const create = useMutation({
    mutationFn: (payload: CreateEmployeePayload) => createEmployee(payload),
    onSuccess: invalidateAll,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateEmployeePayload }) =>
      updateEmployee(id, payload),
    onSuccess: invalidateAll,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteEmployee(id),
    onSuccess: invalidateAll,
  });

  const restore = useMutation({
    mutationFn: (id: number) => restoreEmployee(id),
    onSuccess: invalidateAll,
  });

  const uploadAvatar = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => uploadEmployeeAvatar(id, file),
    onSuccess: invalidateAll,
  });

  return {
    createEmployee: (payload: CreateEmployeePayload): Promise<EmployeeDetail> =>
      create.mutateAsync(payload),
    updateEmployee: (id: number, payload: UpdateEmployeePayload): Promise<EmployeeDetail> =>
      update.mutateAsync({ id, payload }),
    removeEmployee: (id: number): Promise<DeleteResult> => remove.mutateAsync(id),
    restoreEmployee: (id: number) => restore.mutateAsync(id),
    uploadAvatar: (id: number, file: File) => uploadAvatar.mutateAsync({ id, file }),
    isSaving: create.isPending || update.isPending,
    isDeleting: remove.isPending,
    isRestoring: restore.isPending,
    isUploading: uploadAvatar.isPending,
  };
}

// ------------------------------------------------------------- contracts ---

export function useContracts(filters: ContractFilters, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CONTRACT_KEYS.list(filters),
    queryFn: () => listContracts(filters),
    enabled,
  });

  /**
   * Contracts invalidate the EMPLOYEE key too: `baseSalary` on a table row and
   * `activeContract` in the payroll summary are both derived from the active
   * contract, so signing or ending one changes the employee screens as well.
   */
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: CONTRACT_KEYS.root });
    void queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.root });
  };

  const create = useMutation({
    mutationFn: (payload: CreateContractPayload) => createContract(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateContractPayload }) =>
      updateContract(id, payload),
    onSuccess: invalidate,
  });

  const terminate = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TerminateContractPayload }) =>
      terminateContract(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteContract(id),
    onSuccess: invalidate,
  });

  return {
    data: query.data as PaginatedData<Contract> | undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => void query.refetch(),
    createContract: (payload: CreateContractPayload) => create.mutateAsync(payload),
    updateContract: (id: number, payload: UpdateContractPayload) =>
      update.mutateAsync({ id, payload }),
    terminateContract: (id: number, payload: TerminateContractPayload) =>
      terminate.mutateAsync({ id, payload }),
    removeContract: (id: number) => remove.mutateAsync(id),
    isSaving: create.isPending || update.isPending || terminate.isPending,
    isDeleting: remove.isPending,
  };
}

// --------------------------------------------------------- family members ---

export function useFamilyMembers(employeeId: number | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const id = employeeId ?? 0;

  const query = useQuery({
    queryKey: EMPLOYEE_KEYS.family(id),
    queryFn: () => listFamilyMembers(id),
    enabled: enabled && id > 0,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.family(id) });
  };

  const create = useMutation({
    mutationFn: (payload: FamilyMemberPayload) => createFamilyMember(id, payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      memberId,
      payload,
    }: {
      memberId: number;
      payload: Partial<FamilyMemberPayload>;
    }) => updateFamilyMember(id, memberId, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (memberId: number) => deleteFamilyMember(id, memberId),
    onSuccess: invalidate,
  });

  return {
    data: query.data as FamilyMember[] | undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => void query.refetch(),
    createMember: (payload: FamilyMemberPayload) => create.mutateAsync(payload),
    updateMember: (memberId: number, payload: Partial<FamilyMemberPayload>) =>
      update.mutateAsync({ memberId, payload }),
    removeMember: (memberId: number) => remove.mutateAsync(memberId),
    isSaving: create.isPending || update.isPending,
    isDeleting: remove.isPending,
  };
}


// ------------------------------------------------------------- dependents ---

/**
 * Người phụ thuộc — the tax deduction register for one employee.
 *
 * A write here also invalidates the EMPLOYEE key root, because
 * `GET /employees/:id/summary` reports `activeDependents` and payroll reads it.
 * Registering a dependent without refreshing that count would leave the payroll
 * summary quietly one person behind.
 */
export function useDependents(employeeId: number | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const id = employeeId ?? 0;

  const query = useQuery({
    queryKey: EMPLOYEE_KEYS.dependents(id),
    queryFn: () => listDependents(id),
    enabled: enabled && id > 0,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.dependents(id) });
    void queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.root });
  };

  const create = useMutation({
    mutationFn: (payload: CreateDependentPayload) => createDependent(id, payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      dependentId,
      payload,
    }: {
      dependentId: number;
      payload: UpdateDependentPayload;
    }) => updateDependent(id, dependentId, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (dependentId: number) => deleteDependent(id, dependentId),
    onSuccess: invalidate,
  });

  return {
    data: query.data as Dependent[] | undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => void query.refetch(),
    createDependent: (payload: CreateDependentPayload) => create.mutateAsync(payload),
    updateDependent: (dependentId: number, payload: UpdateDependentPayload) =>
      update.mutateAsync({ dependentId, payload }),
    removeDependent: (dependentId: number) => remove.mutateAsync(dependentId),
    isSaving: create.isPending || update.isPending,
    isDeleting: remove.isPending,
  };
}

// ------------------------------------------------------------------ roles ---

/**
 * Roles for the account step's dropdown. Cached for the session: the five rows
 * are seeded reference data that does not change while someone fills in a form.
 */
export function useRoles(enabled = true) {
  const query = useQuery({
    queryKey: ROLE_KEYS.root,
    queryFn: listRoles,
    enabled,
    staleTime: 30 * 60_000,
  });

  return {
    data: query.data as RoleOption[] | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
