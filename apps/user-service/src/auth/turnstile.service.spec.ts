import * as commonModule from '@veloxdesk/common';
import { TurnstileService } from './turnstile.service.js';

jest.mock('@veloxdesk/common', () => ({
  ...jest.requireActual('@veloxdesk/common'),
  verifyTurnstileToken: jest.fn(),
}));

describe('TurnstileService', () => {
  let config: { get: jest.Mock };
  let service: TurnstileService;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { get: jest.fn().mockReturnValue('the-secret-key') };
    service = new TurnstileService(config as never);
  });

  it('short-circuits (no network call) when no token was provided', async () => {
    await expect(service.verify(undefined, '1.2.3.4')).resolves.toBe(false);
    expect(commonModule.verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('fails closed and logs when TURNSTILE_SECRET_KEY is not configured', async () => {
    config.get.mockReturnValue(undefined);
    await expect(service.verify('some-token', '1.2.3.4')).resolves.toBe(false);
    expect(commonModule.verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('delegates to verifyTurnstileToken with the configured secret and caller IP', async () => {
    (commonModule.verifyTurnstileToken as jest.Mock).mockResolvedValue(true);
    await expect(service.verify('some-token', '1.2.3.4')).resolves.toBe(true);
    expect(commonModule.verifyTurnstileToken).toHaveBeenCalledWith('the-secret-key', 'some-token', '1.2.3.4');
  });
});
