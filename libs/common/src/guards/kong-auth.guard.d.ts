import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class KongAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
