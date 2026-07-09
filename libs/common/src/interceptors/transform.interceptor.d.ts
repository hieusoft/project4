import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
export declare class TransformInterceptor<T> implements NestInterceptor<T, {
    data: T;
}> {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<{
        data: T;
    }>;
}
