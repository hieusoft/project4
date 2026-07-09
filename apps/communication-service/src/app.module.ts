import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommunicationConfigService } from './infrastructure/config/communication.config';
import { LoggingEmailSender } from './infrastructure/email/logging-email.sender';
import { RabbitMqConsumerService } from './infrastructure/messaging/rabbitmq-consumer.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, CommunicationConfigService, LoggingEmailSender, RabbitMqConsumerService],
})
export class AppModule {}
