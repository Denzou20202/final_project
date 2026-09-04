import { ChatGateway } from './chat.gateway.js';
import { WsAuthService } from './ws-auth.service.js';

const OPERATORS_ROOM = 'operators';

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

// Regression coverage: a client's reply used to broadcast 'ticket:notification'
// to the whole OPERATORS_ROOM with no per-recipient scoping — the same
// confidentiality gap already fixed for internal messages (this same
// broadcastMessage method, a few lines above) and for the sibling
// 'created'/'updated'/'attachment' channel in TicketEventsSubscriberService.
// A department-/own-tickets-restricted operator's socket would receive the
// ticket's title/number/status/team over the wire regardless of whether they
// could see that ticket over REST.
describe('ChatGateway.broadcastMessage — client-reply notification scoping', () => {
  let wsAuth: jest.Mocked<Pick<WsAuthService, 'authenticate'>>;
  let gateway: ChatGateway;

  const ticket = {
    id: 'ticket-1',
    ticketNumber: 42,
    title: 'Не работает принтер',
    teamId: 'team-restricted',
    assignedTo: null,
    createdBy: 'client-1',
    status: {
      id: 'status-1',
      key: 'open',
      name: 'Открыт',
      color: '#000',
      isDefault: true,
      isClosed: false,
      tracksSla: true,
      sortOrder: 0,
    },
  };

  function makeSocket(user: Record<string, unknown> | undefined) {
    return { data: { user }, emit: jest.fn() };
  }

  beforeEach(() => {
    wsAuth = { authenticate: jest.fn() };
    gateway = new ChatGateway(wsAuth as unknown as WsAuthService, {} as never, {} as never, {} as never, {} as never);
  });

  it('does not deliver a client reply notification to an operator restricted to a different department', async () => {
    const inScope = makeSocket({ sub: 'op-in-scope', role: 'operator', restrictToDepartments: true, departmentIds: ['team-restricted'] });
    const outOfScope = makeSocket({ sub: 'op-out-of-scope', role: 'operator', restrictToDepartments: true, departmentIds: ['some-other-team'] });
    const unrestricted = makeSocket({ sub: 'op-unrestricted', role: 'operator' });
    const fetchSockets = jest.fn().mockResolvedValue([inScope, outOfScope, unrestricted]);
    gateway.server = {
      in: jest.fn().mockReturnValue({ fetchSockets }),
      // Non-internal branch of broadcastMessage also emits 'ticket:message'
      // to the ticket room — unrelated to what this test verifies, but the
      // method isn't split, so it still needs a working mock here.
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as never;

    const clientSocket = { to: jest.fn() } as never;
    const clientUser = { sub: 'client-1', role: 'client' } as never;
    const comment = { isInternal: false, body: 'Спасибо!' } as never;

    await (gateway as unknown as { broadcastMessage: (...args: unknown[]) => Promise<void> }).broadcastMessage(
      clientSocket,
      clientUser,
      ticket,
      comment,
      [],
    );

    expect(gateway.server.in).toHaveBeenCalledWith(OPERATORS_ROOM);
    expect(inScope.emit).toHaveBeenCalledWith('ticket:notification', expect.objectContaining({ ticketId: 'ticket-1' }));
    expect(unrestricted.emit).toHaveBeenCalledWith('ticket:notification', expect.objectContaining({ ticketId: 'ticket-1' }));
    expect(outOfScope.emit).not.toHaveBeenCalled();
  });
});
