import { verifyTurnstileToken } from './verify-turnstile-token.js';

describe('verifyTurnstileToken', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns true when Cloudflare reports success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) }) as never;
    await expect(verifyTurnstileToken('secret', 'token', '1.2.3.4')).resolves.toBe(true);
  });

  it('returns false when Cloudflare reports failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: false }) }) as never;
    await expect(verifyTurnstileToken('secret', 'token')).resolves.toBe(false);
  });

  it('returns false (fails closed) on a non-OK HTTP response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }) as never;
    await expect(verifyTurnstileToken('secret', 'token')).resolves.toBe(false);
  });

  it('returns false (fails closed) when the request itself throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as never;
    await expect(verifyTurnstileToken('secret', 'token')).resolves.toBe(false);
  });

  it('sends the secret, response, and remoteip as form fields', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
    global.fetch = fetchMock as never;

    await verifyTurnstileToken('my-secret', 'my-token', '9.9.9.9');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const body = options.body as URLSearchParams;
    expect(body.get('secret')).toBe('my-secret');
    expect(body.get('response')).toBe('my-token');
    expect(body.get('remoteip')).toBe('9.9.9.9');
  });
});
