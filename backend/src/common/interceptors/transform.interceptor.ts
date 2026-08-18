import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Wraps every successful response in the standard format:
 * { success: true, data, timestamp }
 *
 * Has no "message" field (per api-spec.md §1.1).
 * Works for plain objects as well as the paginated shape { items, meta }
 * (that shape is preserved as-is inside "data").
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
