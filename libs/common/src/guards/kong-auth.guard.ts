import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  if (!payload) throw new UnauthorizedException('Invalid bearer token');
  return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>;
}
@Injectable()
export class KongAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined>; user?: CurrentUserPayload }>();
    const header = request.headers.authorization;
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    const payload = decodeJwtPayload(raw.slice('Bearer '.length));
    request.user = { id: String(payload.sub ?? payload.id ?? ''), roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [], email: typeof payload.email === 'string' ? payload.email : undefined };
    if (!request.user.id) throw new UnauthorizedException('Token payload missing subject');
    return true;
  }
}
