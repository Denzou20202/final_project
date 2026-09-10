import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter.js';

function createHost() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status };
  const request = { method: 'POST', url: '/tickets/1/attachments' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  it('passes through an exception response`s optional code alongside message', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new BadRequestException({ message: 'raw text', code: 'ATTACHMENT_TOO_LARGE' }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'raw text', code: 'ATTACHMENT_TOO_LARGE' }),
    );
  });

  it('omits code entirely for exceptions that never set one', () => {
    const filter = new HttpExceptionFilter();
    const { host, json } = createHost();

    filter.catch(new BadRequestException('plain message'), host);

    const body = json.mock.calls[0][0];
    expect(body).not.toHaveProperty('code');
    expect(body.message).toBe('plain message');
  });
});
