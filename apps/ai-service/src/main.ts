import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
const { json, urlencoded } = require('express');

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Setup RabbitMQ Microservice for moderation (only if ENABLE_RMQ=true)
  if (process.env.ENABLE_RMQ === 'true') {
    const rabbitmqUrl = process.env.RABBITMQ_URL;
    if (!rabbitmqUrl) {
      logger.error(
        'ENABLE_RMQ=true but RABBITMQ_URL is not set. Set it via .env (see .env.example).',
      );
      process.exit(1);
    }
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl],
        queue: 'ai_moderation_queue',
        queueOptions: {
          durable: true,
        },
        noAck: false, // We will manually ack
      },
    });
    await app.startAllMicroservices();
    logger.log('RabbitMQ Microservice connected.');
  } else {
    logger.log('RabbitMQ is disabled in dev mode. Set ENABLE_RMQ=true to connect.');
  }

  // Setup Swagger for REST APIs
  const config = new DocumentBuilder()
    .setTitle('AI Service API')
    .setDescription('The AI Service API for generating text and moderating content')
    .setVersion('1.0')
    .addServer('/') // Direct local access
    .addServer('/api/ai') // Route through Kong Gateway
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });

  // Enable CORS — comma-separated origins via CORS_ORIGINS (default * for dev).
  // When specific origins are set, credentials are allowed; with "*" they are not
  // (browsers reject the "*" + credentials combination).
  const corsOrigins = process.env.CORS_ORIGINS || '*';
  const corsOptions =
    corsOrigins === '*'
      ? { origin: true, credentials: false }
      : { origin: corsOrigins.split(',').map((o) => o.trim()), credentials: true };
  app.enableCors(corsOptions);

  // Increase payload limit to prevent 413 Payload Too Large for base64 images
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  await app.listen(process.env.PORT || 3007, '0.0.0.0');
  logger.log(`AI Service is running on http://localhost:${process.env.PORT || 3007} (REST)`);
}
bootstrap();
