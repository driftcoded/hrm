import type { PaginatedData } from '@/types/api.types';
import type { Position, PositionFilters, PositionPayload } from '@/types/masterData.types';
import {
  createPosition,
  deletePosition,
  listPositions,
  updatePosition,
} from '@/services/masterData.service';
import { useCrudResource, type CrudResource } from '@/hooks/useCrudResource';

export const POSITION_KEYS = {
  root: ['positions'] as const,
  list: (filters: PositionFilters) => ['positions', 'list', filters] as const,
};

export function usePositions(
  filters: PositionFilters,
): CrudResource<PaginatedData<Position>, PositionPayload> {
  return useCrudResource<PaginatedData<Position>, PositionPayload>({
    entityKey: POSITION_KEYS.root,
    listKey: POSITION_KEYS.list(filters),
    list: () => listPositions(filters),
    create: createPosition,
    update: updatePosition,
    remove: deletePosition,
  });
}
