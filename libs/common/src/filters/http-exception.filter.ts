import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] })?.message ??
          'Internal server error');
    // Optional, additive — most exceptions never set this and the response
    // shape is unchanged for them. Lets a specific endpoint (e.g. attachment
    // upload validation) attach a stable, language-independent identifier
    // the frontend can map to a translated string, instead of the frontend
    // having to display (or pattern-match against) raw English exception
    // text meant for logs/API consumers, not end users.
    const code =
      typeof exceptionResponse === 'string' ? undefined : (exceptionResponse as { code?: string })?.code;

    if (!isHttpException) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      message,
      ...(code ? { code } : {}),
      error: HttpStatus[statusCode] ?? 'Error',
      timestamp: new Date().toISOString(),
    });
  }
}
