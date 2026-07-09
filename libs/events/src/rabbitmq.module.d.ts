import { DynamicModule } from '@nestjs/common';
import { EventName } from './event-names';
export interface RabbitMqModuleOptions {
    url: string;
    exchange?: string;
}
export declare class EventPublisher {
    publish<TPayload>(eventName: EventName, payload: TPayload): Promise<void>;
}
export declare class RabbitMqModule {
    static forRoot(options: RabbitMqModuleOptions): DynamicModule;
}
