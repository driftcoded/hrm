import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../dto/pagination.dto';

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface ResolvedPagination {
  page: number;
  limit: number;
  /** OFFSET passed down to the repository. */
  skip: number;
}

function toPositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const truncated = Math.trunc(value);

  return truncated >= 1 ? truncated : fallback;
}

/**
 * Normalizes `page`/`limit` before they reach the repository.
 *
 * `limit` is capped at MAX_PAGE_LIMIT (= 100, api-spec.md §1.2 + the "cap
 * limit" security item in PLAN §8.1). PaginationDto already has `@Max(100)`,
 * so an HTTP request with `?limit=1000` is rejected by ValidationPipe (400
 * VALIDATION_ERROR); this function is the second line of defense for any
 * service call that bypasses the pipe (internal jobs, calls from other
 * services) — the DB is never asked for more than 100 rows.
 */
export function resolvePagination(query: PaginationQuery): ResolvedPagination {
  const page = toPositiveInt(query.page, 1);
  const requestedLimit = toPositiveInt(query.limit, DEFAULT_PAGE_LIMIT);
  const limit = Math.min(requestedLimit, MAX_PAGE_LIMIT);

  return { page, limit, skip: (page - 1) * limit };
}
