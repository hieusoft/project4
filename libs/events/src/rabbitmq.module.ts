import { DynamicModule, Global, Module } from '@nestjs/common';
import { EventName } from './event-names';
export interface RabbitMqModuleOptions { url: string; exchange?: string; }
export class EventPublisher { async publish<TPayload>(eventName: EventName, payload: TPayload): Promise<void> { void eventName; void payload; } }
@Global()
@Module({})
export class RabbitMqModule { static forRoot(options: RabbitMqModuleOptions): DynamicModule { return { module: RabbitMqModule, providers: [{ provide: 'RABBITMQ_OPTIONS', useValue: options }, EventPublisher], exports: [EventPublisher] }; } }
