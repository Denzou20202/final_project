import { BadRequestException } from '@nestjs/common';
import { attachmentValidationExceptionFactory } from './attachments.controller.js';

describe('attachmentValidationExceptionFactory', () => {
  it('tags a file-size validation error as ATTACHMENT_TOO_LARGE', () => {
    const raw = 'Validation failed (current file size is 20000000, expected size is less than 15728640)';
    try {
      attachmentValidationExceptionFactory(raw);
      fail('expected attachmentValidationExceptionFactory to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as { message: string; code: string };
      expect(response.code).toBe('ATTACHMENT_TOO_LARGE');
      expect(response.message).toBe(raw);
    }
  });

  it('tags a file-type validation error as ATTACHMENT_UNSUPPORTED_TYPE', () => {
    const raw =
      'Validation failed (current file type is application/x-msdownload, expected type is /^(...)$/) - magic number detection failed, used mimetype fallback';
    try {
      attachmentValidationExceptionFactory(raw);
      fail('expected attachmentValidationExceptionFactory to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as { message: string; code: string };
      expect(response.code).toBe('ATTACHMENT_UNSUPPORTED_TYPE');
      expect(response.message).toBe(raw);
    }
  });
});
