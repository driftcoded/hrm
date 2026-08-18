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
 * Shape ném ra bởi custom exceptionFactory (ValidationPipe) và bởi các service
 * khi cần trả lỗi domain có "code" cụ thể, ví dụ:
 *   throw new ConflictException({ code: 'DUPLICATE_CCCD', message: 'CCCD already exists' });
 */
export interface HttpExceptionBody {
  code: string;
  message: string;
  details?: ValidationErrorDetail[];
}

export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
