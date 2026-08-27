import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:4200,http://localhost:4201')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins, credentials: true });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const port = process.env.PORT || process.env.CHAT_SERVICE_PORT || 3004;
  await app.listen(port);
  Logger.log(
    `🚀 chat-service is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
