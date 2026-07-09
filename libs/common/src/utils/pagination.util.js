"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPagination = getPagination;
function getPagination(dto) { return { take: dto.limit, skip: (dto.page - 1) * dto.limit }; }
//# sourceMappingURL=pagination.util.js.map