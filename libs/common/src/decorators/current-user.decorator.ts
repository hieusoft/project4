import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export interface CurrentUserPayload { id: string; roles: string[]; email?: string; }
export const CurrentUser = createParamDecorator((data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserPayload }>();
  const user = request.user;
  return data && user ? user[data] : user;
});
