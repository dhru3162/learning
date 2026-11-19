import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS Configuration
  app.enableCors({
    origin: ['http://localhost:5000', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─── Swagger API Documentation ──────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bulk Excel User Import API')
    .setDescription(
      'Asynchronous Bulk User Import System built with NestJS, BullMQ, Redis, and PostgreSQL',
    )
    .setVersion('1.0')
    .addTag(
      'Users Import',
      'Excel bulk upload, asynchronous queue tracking, and error management',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Bulk Import API Docs',
  });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(
    `📋 Swagger API Docs available at: http://localhost:${port}/api/docs`,
  );
}

await bootstrap();
