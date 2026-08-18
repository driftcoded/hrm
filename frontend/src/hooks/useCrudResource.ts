import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeleteResult } from '@/types/masterData.types';

/**
 * One list query + create/update/delete mutations for a master-data entity.
 *
 * The five Settings screens differ in their columns, form fields and filters —
 * not in their plumbing. This hook owns the part that is genuinely identical:
 * the TanStack Query wiring and the `invalidateQueries` call after every
 * successful write (docs/architecture.md §4.1). Each entity then gets a thin
 * hook (`useDepartments`, `useHolidays`, …) that supplies its service functions
 * and cache key and nothing else.
 *
 * Invalidation is deliberately done on `entityKey` (e.g. `['departments']`), not
 * on the filtered `listKey`: after saving, every cached page/filter combination
 * of that entity is stale, including the tree view and the dropdown that other
 * screens feed from.
 */

export interface CrudResourceOptions<TList, TPayload> {
  /** Cache-key root used for invalidation, e.g. `['departments']`. */
  entityKey: readonly unknown[];
  /** Full key for this list, e.g. `['departments', 'list', filters]`. */
  listKey: readonly unknown[];
  list: () => Promise<TList>;
  /** Omitted for read-only resources (contract types have no write endpoints). */
  create?: (payload: TPayload) => Promise<unknown>;
  update?: (id: number, payload: Partial<TPayload>) => Promise<unknown>;
  remove?: (id: number) => Promise<DeleteResult>;
  enabled?: boolean;
}

export interface CrudResource<TList, TPayload> {
  data: TList | undefined;
  isLoading: boolean;
  /** A background refetch (e.g. after a save) — used to keep the table dimmed. */
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
  createItem: (payload: TPayload) => Promise<unknown>;
  updateItem: (id: number, payload: Partial<TPayload>) => Promise<unknown>;
  removeItem: (id: number) => Promise<unknown>;
  /** A create or update is in flight. */
  isSaving: boolean;
  isDeleting: boolean;
}

export function useCrudResource<TList, TPayload>(
  options: CrudResourceOptions<TList, TPayload>,
): CrudResource<TList, TPayload> {
  const { entityKey, listKey, list, create, update, remove, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: listKey,
    queryFn: list,
    enabled,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: entityKey });

  const createMutation = useMutation({
    mutationFn: (payload: TPayload) => {
      if (!create) {
        throw new Error('This resource is read-only: no create endpoint.');
      }
      return create(payload);
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TPayload> }) => {
      if (!update) {
        throw new Error('This resource is read-only: no update endpoint.');
      }
      return update(id, payload);
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => {
      if (!remove) {
        throw new Error('This resource is read-only: no delete endpoint.');
      }
      return remove(id);
    },
    onSuccess: invalidate,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => void query.refetch(),
    createItem: (payload) => createMutation.mutateAsync(payload),
    updateItem: (id, payload) => updateMutation.mutateAsync({ id, payload }),
    removeItem: (id) => removeMutation.mutateAsync(id),
    isSaving: createMutation.isPending || updateMutation.isPending,
    isDeleting: removeMutation.isPending,
  };
}
