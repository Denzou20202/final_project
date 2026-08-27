import { ChatGateway } from './chat.gateway.js';
import { WsAuthService } from './ws-auth.service.js';

// Regression coverage for the connect-time auth race: handleConnection used
// to authenticate asynchronously AFTER 'connection' had already fired, so a
// client's first message could reach a @SubscribeMessage handler before
// client.data.user was set, which force-disconnected the socket with no
// client-side auto-reconnect. Moving authentication into this Socket.IO
// namespace middleware (afterInit) closes that window — these tests pin the
// middleware's own success/failure/error-handling behavior directly, since
// the gateway otherwise has no unit-testable connection lifecycle.
describe('ChatGateway auth middleware (afterInit)', () => {
  let wsAuth: jest.Mocked<Pick<WsAuthService, 'authenticate'>>;
  let gateway: ChatGateway;
  let middleware: (socket: { data: Record<string, unknown> }, next: (err?: Error) => void) => void;

  beforeEach(() => {
    wsAuth = { authenticate: jest.fn() };
    gateway = new ChatGateway(wsAuth as unknown as WsAuthService, {} as never, {} as never, {} as never, {} as never);
    const server = { use: jest.fn((fn: typeof middleware) => (middleware = fn)) };
    gateway.afterInit(server as never);
  });

  it('sets socket.data.user and calls next() with no error for a valid token', async () => {
    const user = { sub: 'user-1', role: 'operator' };
    wsAuth.authenticate.mockResolvedValue(user as never);
    const socket = { data: {} as Record<string, unknown> };
    const next = jest.fn();

    middleware(socket, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(socket.data['user']).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects the connection (never sets socket.data.user) when there is no valid token', async () => {
    wsAuth.authenticate.mockResolvedValue(null);
    const socket = { data: {} as Record<string, unknown> };
    const next = jest.fn();

    middleware(socket, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(socket.data['user']).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('rejects the connection if authenticate() itself throws', async () => {
    wsAuth.authenticate.mockRejectedValue(new Error('boom'));
    const socket = { data: {} as Record<string, unknown> };
    const next = jest.fn();

    middleware(socket, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(socket.data['user']).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
