import { HttpExceptionFilter } from '@veloxdesk/common';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Only ever holds the short-lived, signed OIDC PKCE/state cookie (see
  // oidc-state-token.ts) — this service otherwise stays fully
  // stateless-JWT (no session cookies for the normal Bearer-token flow).
  app.use(cookieParser());

  // nginx is the only thing this service is ever reached through (see
  // infra/nginx) — trust its X-Forwarded-For so req.ip is the real client
  // IP, not the docker-network hop. Required for the IP-whitelist check in
  // auth.service.ts to see anything meaningful.
  app.set('trust proxy', 1);

  // Let TypeOrmModule (and anything else with lifecycle hooks) close its
  // connections cleanly on SIGTERM/SIGINT instead of leaking them.
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
    .setTitle('VeloxDesk — User Service')
    .setDescription('Аутентификация, пользователи, роли')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);

  const port = process.env.PORT || process.env.USER_SERVICE_PORT || 3002;
  await app.listen(port);
  Logger.log(
    `🚀 user-service is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
