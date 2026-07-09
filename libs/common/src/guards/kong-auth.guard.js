"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KongAuthGuard = void 0;
const common_1 = require("@nestjs/common");
function decodeJwtPayload(token) {
    const [, payload] = token.split('.');
    if (!payload)
        throw new common_1.UnauthorizedException('Invalid bearer token');
    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}
let KongAuthGuard = class KongAuthGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const header = request.headers.authorization;
        const raw = Array.isArray(header) ? header[0] : header;
        if (!raw?.startsWith('Bearer '))
            throw new common_1.UnauthorizedException('Missing bearer token');
        const payload = decodeJwtPayload(raw.slice('Bearer '.length));
        request.user = { id: String(payload.sub ?? payload.id ?? ''), roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [], email: typeof payload.email === 'string' ? payload.email : undefined };
        if (!request.user.id)
            throw new common_1.UnauthorizedException('Token payload missing subject');
        return true;
    }
};
exports.KongAuthGuard = KongAuthGuard;
exports.KongAuthGuard = KongAuthGuard = __decorate([
    (0, common_1.Injectable)()
], KongAuthGuard);
//# sourceMappingURL=kong-auth.guard.js.map