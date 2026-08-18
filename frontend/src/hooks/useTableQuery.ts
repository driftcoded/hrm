import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { MAX_PAGE_LIMIT, type SortOrder } from '@/types/masterData.types';

/**
 * Table state that lives in the URL query string
 * (`?page=2&pageSize=20&search=...`), per docs/ui-conventions.md §5.
 *
 * Why the URL and not `useState`: a list screen's state is part of "where the
 * user is". Keeping it in the address bar means F5 and a shared link both land on
 * the same rows, which is exactly what the Giai đoạn 2.2 test asks for
 * ("refresh trang không mất data").
 *
 * Page-reset rule: changing a FILTER resets to page 1 (the result set changed,
 * so page 7 may not exist any more), but only when the value really changed —
 * re-applying the same filter, sorting, or paginating never moves the page
 * behind the user's back.
 */

/** §5: default 20 rows, options 10 / 20 / 50 / 100. */
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const PAGE_PARAM = 'page';
const PAGE_SIZE_PARAM = 'pageSize';
const SORT_PARAM = 'sort';
const ORDER_PARAM = 'order';

/** Params owned by this hook; everything else in the URL is a filter. */
const RESERVED_PARAMS = new Set<string>([PAGE_PARAM, PAGE_SIZE_PARAM, SORT_PARAM, ORDER_PARAM]);

export interface TableQuery {
  page: number;
  /** Guaranteed to be one of PAGE_SIZE_OPTIONS, so `limit` can never exceed 100. */
  pageSize: number;
  sort?: string;
  order?: SortOrder;
  /** Raw string values of every non-pagination param currently in the URL. */
  filters: Record<string, string>;
  setPagination: (page: number, pageSize: number) => void;
  setSorter: (sort: string | undefined, order: SortOrder | undefined) => void;
  /** Set/clear one filter. `undefined` or `''` removes the param. */
  setFilter: (key: string, value: string | number | boolean | undefined) => void;
}

/** `"true"` -> true, `"false"` -> false, anything else -> undefined. */
export function parseBoolParam(value: string | undefined): boolean | undefined {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

/** Positive integer or `undefined` — never NaN, so it is safe to send as a param. */
export function parseIntParam(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/** Keep an unknown string out of a whitelisted param (the backend 400s on those). */
export function parseEnumParam<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function readPage(params: URLSearchParams): number {
  const parsed = Number(params.get(PAGE_PARAM));
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/**
 * Clamped to the offered options on purpose: a hand-edited `?pageSize=500` would
 * otherwise be sent as `limit=500`, which the backend rejects with a 400 and the
 * user would see a broken table instead of their rows.
 */
function readPageSize(params: URLSearchParams): number {
  const parsed = Number(params.get(PAGE_SIZE_PARAM));
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : Math.min(parsed, MAX_PAGE_LIMIT);
}

export function useTableQuery(defaults?: { sort?: string; order?: SortOrder }): TableQuery {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = readPage(searchParams);
  const pageSize = readPageSize(searchParams);
  const sort = searchParams.get(SORT_PARAM) ?? defaults?.sort;
  const rawOrder = searchParams.get(ORDER_PARAM) ?? defaults?.order;
  const order: SortOrder | undefined =
    rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : undefined;

  const filters = useMemo(() => {
    const entries: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (!RESERVED_PARAMS.has(key) && value !== '') {
        entries[key] = value;
      }
    });
    return entries;
  }, [searchParams]);

  /**
   * Always mutates a copy of the CURRENT params so two setters called in the
   * same tick can't drop each other's changes. `replace` keeps the history stack
   * free of one entry per keystroke in the search box.
   */
  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPagination = useCallback(
    (nextPage: number, nextPageSize: number) => {
      update((next) => {
        next.set(PAGE_PARAM, String(Math.max(1, nextPage)));
        next.set(PAGE_SIZE_PARAM, String(nextPageSize));
      });
    },
    [update],
  );

  const setSorter = useCallback(
    (nextSort: string | undefined, nextOrder: SortOrder | undefined) => {
      update((next) => {
        if (nextSort && nextOrder) {
          next.set(SORT_PARAM, nextSort);
          next.set(ORDER_PARAM, nextOrder);
        } else {
          next.delete(SORT_PARAM);
          next.delete(ORDER_PARAM);
        }
      });
    },
    [update],
  );

  const setFilter = useCallback(
    (key: string, value: string | number | boolean | undefined) => {
      const nextValue = value === undefined || value === '' ? undefined : String(value);
      update((next) => {
        const currentValue = next.get(key) ?? undefined;
        if (currentValue === nextValue) {
          return; // No real change — leave the page where it is.
        }
        if (nextValue === undefined) {
          next.delete(key);
        } else {
          next.set(key, nextValue);
        }
        next.delete(PAGE_PARAM);
      });
    },
    [update],
  );

  return {
    page,
    pageSize,
    sort,
    order,
    filters,
    setPagination,
    setSorter,
    setFilter,
  };
}
