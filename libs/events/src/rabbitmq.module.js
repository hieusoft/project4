"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RabbitMqModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMqModule = exports.EventPublisher = void 0;
const common_1 = require("@nestjs/common");
class EventPublisher {
    async publish(eventName, payload) { void eventName; void payload; }
}
exports.EventPublisher = EventPublisher;
let RabbitMqModule = RabbitMqModule_1 = class RabbitMqModule {
    static forRoot(options) { return { module: RabbitMqModule_1, providers: [{ provide: 'RABBITMQ_OPTIONS', useValue: options }, EventPublisher], exports: [EventPublisher] }; }
};
exports.RabbitMqModule = RabbitMqModule;
exports.RabbitMqModule = RabbitMqModule = RabbitMqModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({})
], RabbitMqModule);
//# sourceMappingURL=rabbitmq.module.js.map