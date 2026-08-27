import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

// Two independent gaps in Nest's default WS exception handling, found live
// during a large-scale workflow simulation:
//
// 1. BaseWsExceptionFilter never logs an IntrinsicException (every
//    HttpException subclass, including the BadRequestException a
//    ValidationPipe throws) — the client gets a generic "Internal server
//    error" 'exception' event, but nothing at all reaches the server
//    console, so a pipe/guard failure on a WS handler is completely
//    invisible server-side, unlike its HTTP equivalent.
//
// 2. A caller using .timeout(ms).emit(event, data, ack) — see
//    ChatGateway.handleMessage's own comment for why that pattern exists —
//    gets its ack callback invoked only if the HANDLER BODY itself calls
//    it (handleMessage's own try/catch does this for exceptions it throws).
//    An exception thrown BEFORE the handler body ever runs — pipe
//    validation, guards — never reaches that try/catch, so the ack is
//    simply never called. The sender then just sits until ITS OWN
//    client-side timeout fires, indistinguishable from the server actually
//    hanging: an invalid payload (e.g. a frontend bug sending body:
//    undefined) turns into a full 10s stall with no specific error, worse
//    than the WsException case this same pattern was originally built to
//    fix.
//
// Fixed by acking directly whenever the raw handler args include a
// callback — located exactly the way @Ack() itself does it
// (ws-params-factory.js: args.find(isFunction)) — regardless of which
// handler pattern threw or whether it happens to consume @Ack(). A handler
// invoked without .timeout().emit() never has a callback in its args, so
// this is a no-op for every other gateway method.
@Catch()
export class WsLoggingExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('WsExceptionsHandler');

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof WsException)) {
      this.logger.error(exception);
    }

    const args = host.getArgs<unknown[]>();
    const ack = args.find((arg): arg is (response: unknown) => void => typeof arg === 'function');
    if (ack) {
      const message = exception instanceof WsException ? String(exception.getError()) : 'Внутренняя ошибка сервера';
      ack({ error: true, message });
    }

    super.catch(exception as Error, host);
  }
}
