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
 * Bọc mọi response thành công về format chuẩn:
 * { success: true, data, timestamp }
 *
 * KHÔNG có field "message" (theo api-spec.md §1.1).
 * Hỗ trợ cả object thường lẫn shape đã phân trang { items, meta }
 * (giữ nguyên shape đó bên trong "data").
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
