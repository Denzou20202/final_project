import { ForbiddenException } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller.js';

describe('TelegramWebhookController.handleWebhook — secret verification', () => {
  let ingestion: { processUpdate: jest.Mock };
  let controller: TelegramWebhookController;

  beforeEach(() => {
    ingestion = { processUpdate: jest.fn().mockResolvedValue(undefined) };
    const config = { getOrThrow: jest.fn().mockReturnValue('real-secret') };
    controller = new TelegramWebhookController(config as never, ingestion as never);
  });

  it('accepts the correct secret', async () => {
    await expect(controller.handleWebhook('real-secret', {})).resolves.toEqual({ ok: true });
    expect(ingestion.processUpdate).toHaveBeenCalled();
  });

  it('rejects a missing secret', async () => {
    await expect(controller.handleWebhook(undefined, {})).rejects.toThrow(ForbiddenException);
  });

  // Same length as 'real-secret' (11 chars) — exercises the actual
  // timingSafeEqual call, not just the length-mismatch shortcut below.
  it('rejects a wrong secret of the same length', async () => {
    await expect(controller.handleWebhook('fake-secret', {})).rejects.toThrow(ForbiddenException);
  });

  it('rejects a wrong secret of a different length', async () => {
    await expect(controller.handleWebhook('short', {})).rejects.toThrow(ForbiddenException);
  });
});
