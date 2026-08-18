export interface ValidationErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: ValidationErrorDetail[];
}

export interface ErrorResponse {
  success: false;
  error: ErrorBody;
  timestamp: string;
}

/**
 * Shape thrown by the custom exceptionFactory (ValidationPipe) and by services
 * that need to return a domain error with a specific "code", e.g.:
 *   throw new ConflictException({ code: 'DUPLICATE_CCCD', message: 'CCCD already exists' });
 */
export interface HttpExceptionBody {
  code: string;
  message: string;
  details?: ValidationErrorDetail[];
  /**
   * Seconds until the caller may retry (account lockout, rate limiting).
   *
   * Transport-only: HttpExceptionFilter turns this into the standard
   * `Retry-After` response header and then STRIPS it from the JSON body, so the
   * error envelope stays exactly as api-spec.md §1.1 defines it. It exists
   * because `error.message` is English developer text that must never be shown
   * to a user — without a machine-readable field the frontend cannot tell the
   * user how long they are locked out for.
   */
  retryAfterSeconds?: number;
}

export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
