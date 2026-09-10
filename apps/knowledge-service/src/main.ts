import { HttpExceptionFilter } from '@veloxdesk/common';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // nginx is the only thing this service is ever reached through — trust its
  // X-Forwarded-For so req.ip is the real client IP, not nginx's own
  // container address. Without this, ThrottlerGuard's default IP-based
  // tracker sees the same address for every proxied request, turning its
  // per-service rate limit into one bucket shared by every user instead of
  // one per client.
  app.set('trust proxy', 1);

  app.enableShutdownHooks();

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:4200,http://localhost:4201')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins, credentials: true });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VeloxDesk — Knowledge Service')
    .setDescription('База знаний (CRUD статей) и полнотекстовый поиск по тикетам/статьям (Elasticsearch)')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);

  const port = process.env.PORT || process.env.KNOWLEDGE_SERVICE_PORT || 3006;
  await app.listen(port);
  Logger.log(
    `🚀 knowledge-service is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
