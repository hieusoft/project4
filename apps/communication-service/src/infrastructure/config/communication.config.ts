import { Injectable } from '@nestjs/common';

@Injectable()
export class CommunicationConfigService {
  readonly rabbitMqUrl = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
  readonly rabbitMqExchange = process.env.RABBITMQ_EXCHANGE ?? 'charity.events';
  readonly rabbitMqQueue = process.env.COMMUNICATION_EVENTS_QUEUE ?? 'communication.events';
  readonly frontendBaseUrl = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';
}
