"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hoursBefore = hoursBefore;
function hoursBefore(date, hours) { return new Date(date.getTime() - hours * 60 * 60 * 1000); }
//# sourceMappingURL=date.util.js.map