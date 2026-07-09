import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3002;
const GATEWAY_PREFIX = process.env.OPENAPI_SERVER_URL ?? '/api/community';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('community-service')
    .setDescription('Community service API')
    .setVersion('0.1.0')
    .addServer(GATEWAY_PREFIX)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port, '0.0.0.0');
  console.log(`community-service is running on http://localhost:${port}`);
  console.log(`OpenAPI: http://localhost:${port}/openapi.json`);
}
void bootstrap();
