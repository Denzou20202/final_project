import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Closes both the TypeORM pool and the BullMQ worker's Redis connection
  // cleanly on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VeloxDesk — Notification Service')
    .setDescription('BullMQ-consumer: email-уведомления по событиям тикетов')
    .setVersion('0.1')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);

  const port = process.env.PORT || process.env.NOTIFICATION_SERVICE_PORT || 3003;
  await app.listen(port);
  Logger.log(
    `🚀 notification-service is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
