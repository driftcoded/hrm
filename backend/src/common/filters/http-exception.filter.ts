import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ErrorResponse,
  HttpExceptionBody,
  VALIDATION_ERROR_CODE,
  ValidationErrorDetail,
} from '../dto/error-response.dto';

const STATUS_CODE_MAP: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

function codeFromStatus(status: number): string {
  return STATUS_CODE_MAP[status] ?? `HTTP_${status}`;
}

function isHttpExceptionBody(value: unknown): value is HttpExceptionBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string'
  );
}

/**
 * Bắt MỌI exception (HttpException của Nest lẫn lỗi không xác định) và trả về
 * format lỗi chuẩn:
 *   { success: false, error: { code, message, details? }, timestamp }
 *
 * `details[]` chỉ xuất hiện khi code === 'VALIDATION_ERROR' (api-spec.md §21).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.resolveException(exception);

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.originalUrl ?? request.url} -> ${status} ${code}: ${message}`,
        stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl ?? request.url} -> ${status} ${code}: ${message}`,
      );
    }

    const body: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(code === VALIDATION_ERROR_CODE && details ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private resolveException(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: ValidationErrorDetail[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();

      if (isHttpExceptionBody(responseBody)) {
        return {
          status,
          code: responseBody.code,
          message: responseBody.message ?? exception.message,
          details: responseBody.details,
        };
      }

      // NestJS default HttpException (message string hoặc { message, error, statusCode })
      let message = exception.message;
      if (
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody
      ) {
        const rawMessage = responseBody.message;
        if (Array.isArray(rawMessage)) {
          message = rawMessage.join(', ');
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }
      }

      return { status, code: codeFromStatus(status), message };
    }

    // Lỗi không xác định (bug, DB lỗi kết nối...) -> KHÔNG bao giờ lộ stack trace.
    const message =
      exception instanceof Error ? exception.message : 'Unexpected error';

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : message,
    };
  }
}
