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
}

export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
