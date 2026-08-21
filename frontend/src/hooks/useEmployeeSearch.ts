import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchEmployees } from '@/services/employee.service';
import { EMPLOYEE_SEARCH_LIMIT, type EmployeePickerItem } from '@/types/employee.types';

/**
 * Remote, debounced employee lookup for a "pick a person" dropdown.
 *
 * The only consumer is the manager field on `/catalog/departments`. Together
 * with `services/employee.service.ts` and `types/employee.types.ts` this is the
 * whole of the frontend's dependency on `GET /employees` — an endpoint that has
 * no automated tests yet and may be withdrawn. Nothing else may build on it.
 *
 * Three deliberate behaviours:
 *
 * 1. **Debounced 300ms** (docs/architecture.md §"Debounce search"). Every
 *    keystroke would otherwise be a request; the query key is the *debounced*
 *    term, so TanStack Query also caches each term for the life of the modal and
 *    typing back to a previous term costs nothing.
 *
 * 2. **`isError` is a first-class result, not a thrown exception.** `retry: false`
 *    means a failure — including a 404 if the endpoint is removed — is reported
 *    once, immediately, so the caller can render a usable fallback instead of a
 *    dropdown that spins for ever. The modal must never depend on this endpoint
 *    being up.
 *
 * 3. **`known` remembers everyone already returned.** A `Select` renders the
 *    label of the *option* matching its value, and with server-side filtering the
 *    options are only ever the current search results — so after "search Lan →
 *    pick Lan → search something else" the chosen person is no longer among them
 *    and the field would fall back to showing a bare id. `known` lets the caller
 *    keep a label for whoever is selected regardless of the current term.
 */

export const EMPLOYEE_SEARCH_DEBOUNCE_MS = 300;

/** Cache keys — `['employees', …]` per docs/architecture.md §4.1. */
export const EMPLOYEE_KEYS = {
  root: ['employees'] as const,
  search: (term: string) => ['employees', 'search', term] as const,
};

export interface EmployeeSearchOptions {
  /**
   * Only query while the picker is actually on screen (i.e. the modal is open).
   * Flipping this to `false` also clears the typed term, so the next opening
   * starts from an untyped search rather than the previous record's.
   */
  enabled: boolean;
}

export interface EmployeeSearchState {
  /** People matching the current debounced term (or the first page, untyped). */
  results: EmployeePickerItem[];
  /** A request is in flight — drives `loading` / `notFoundContent` (§7). */
  isSearching: boolean;
  /**
   * The endpoint failed and the caller MUST degrade to something usable. Covers
   * a 404 (endpoint withdrawn), a 403, and network failure alike.
   */
  isError: boolean;
  /** Everyone returned since the picker opened, by id — see note 3 above. */
  known: Record<number, EmployeePickerItem>;
  /** Raw, undebounced term — pass straight to `Select.onSearch`. */
  onSearch: (value: string) => void;
}

export function useEmployeeSearch({ enabled }: EmployeeSearchOptions): EmployeeSearchState {
  const [typed, setTyped] = useState('');
  const [term, setTerm] = useState('');
  const [known, setKnown] = useState<Record<number, EmployeePickerItem>>({});

  // Debounce: `typed` follows the keyboard, `term` (the query key) lags 300ms.
  useEffect(() => {
    if (typed === term) {
      return;
    }
    const timer = window.setTimeout(() => setTerm(typed), EMPLOYEE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [term, typed]);

  // Closing the picker clears the typed term: a search run for one department
  // must not be the starting state for the next one. `known` deliberately
  // SURVIVES — it is only a label cache, and clearing it would strand the labels
  // for results that TanStack Query still serves from its own cache on reopen.
  useEffect(() => {
    if (!enabled) {
      setTyped('');
      setTerm('');
    }
  }, [enabled]);

  const query = useQuery({
    queryKey: EMPLOYEE_KEYS.search(term),
    queryFn: () => searchEmployees({ search: term, limit: EMPLOYEE_SEARCH_LIMIT }),
    enabled,
    // Fail fast and visibly: three silent retries would leave the field spinning
    // for seconds before the caller could offer the fallback.
    retry: false,
    staleTime: 60_000,
  });

  const results = useMemo(() => query.data?.items ?? [], [query.data]);

  useEffect(() => {
    if (results.length === 0) {
      return;
    }
    setKnown((previous) => {
      const next = { ...previous };
      let changed = false;
      for (const employee of results) {
        if (next[employee.id] === undefined) {
          next[employee.id] = employee;
          changed = true;
        }
      }
      // Same object when nothing is new, so this never re-renders in a loop.
      return changed ? next : previous;
    });
  }, [results]);

  const onSearch = useCallback((value: string) => setTyped(value), []);

  return {
    results,
    isSearching: query.isFetching,
    isError: query.isError,
    known,
    onSearch,
  };
}
