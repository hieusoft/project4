import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Setup RabbitMQ Microservice for moderation
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672'],
      queue: 'ai_moderation_queue',
      queueOptions: {
        durable: true,
      },
      noAck: false, // We will manually ack
    },
  });

  // Setup Swagger for REST APIs
  const config = new DocumentBuilder()
    .setTitle('AI Service API')
    .setDescription('The AI Service API for generating text and moderating content')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });

  // Enable CORS
  app.enableCors({ origin: '*' });

  // Start all microservices and HTTP server
  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 3007, '0.0.0.0');
  logger.log(`AI Service is running on http://localhost:${process.env.PORT || 3007} (REST)`);
}
bootstrap();
