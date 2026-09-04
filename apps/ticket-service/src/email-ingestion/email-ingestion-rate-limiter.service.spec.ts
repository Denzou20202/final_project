import { EmailIngestionRateLimiterService } from './email-ingestion-rate-limiter.service.js';

const redisMock = {
  incr: jest.fn(),
  pexpire: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
};
jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => redisMock),
}));

// Regression coverage: nothing gated the IMAP-polled email channel before
// this — a single From: address (or many distinct ones) could get one
// ticket/comment created per message, unbounded within and across every
// 15s poll tick (see EmailIngestionService.processMessage).
describe('EmailIngestionRateLimiterService', () => {
  let service: EmailIngestionRateLimiterService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailIngestionRateLimiterService({
      get: jest.fn((_key: string, fallback: unknown) => fallback),
    } as never);
  });

  it('allows a first message from a new sender and sets the window expiry', async () => {
    redisMock.incr.mockResolvedValue(1);
    await expect(service.shouldProcess('client@example.com')).resolves.toBe(true);
    expect(redisMock.pexpire).toHaveBeenCalledWith('email-ingestion:sender:client@example.com', 15 * 60_000);
    expect(redisMock.pexpire).toHaveBeenCalledWith('email-ingestion:global', 15 * 60_000);
  });

  it('lowercases the sender address so the same mailbox cannot dodge the key by casing', async () => {
    redisMock.incr.mockResolvedValue(1);
    await service.shouldProcess('Client@Example.com');
    expect(redisMock.incr).toHaveBeenCalledWith('email-ingestion:sender:client@example.com');
  });

  it('rate-limits a single sender past the per-sender threshold', async () => {
    redisMock.incr.mockImplementation((key: string) => Promise.resolve(key.startsWith('email-ingestion:sender:') ? 6 : 6));
    await expect(service.shouldProcess('flood@example.com')).resolves.toBe(false);
  });

  it('rate-limits globally once many distinct senders push the total over threshold, even under the per-sender cap', async () => {
    redisMock.incr.mockImplementation((key: string) => Promise.resolve(key.startsWith('email-ingestion:sender:') ? 1 : 51));
    await expect(service.shouldProcess('one-off@example.com')).resolves.toBe(false);
  });

  it('does not throw and fails open if Redis itself errors', async () => {
    redisMock.incr.mockRejectedValue(new Error('connection reset'));
    await expect(service.shouldProcess('client@example.com')).resolves.toBe(true);
  });
});
