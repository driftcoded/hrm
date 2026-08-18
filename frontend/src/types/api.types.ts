/**
 * Shared API response/error envelope types.
 *
 * Mirrors the real backend envelope (backend/docs/api-spec.md), NOT the
 * stale shape documented in frontend/docs/architecture.md §7.
 *
 *   success: { success: true, data, timestamp }
 *   error:   { success: false, error: { code, message, details? }, timestamp }
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T>;
