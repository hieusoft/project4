import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<{ data: T }> { return next.handle().pipe(map((data: T) => ({ data }))); }
}
