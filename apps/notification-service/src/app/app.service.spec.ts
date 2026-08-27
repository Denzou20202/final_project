import { ServiceUnavailableException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  const query = jest.fn();

  async function createService() {
    const app = await Test.createTestingModule({
      providers: [AppService, { provide: getDataSourceToken(), useValue: { query } }],
    }).compile();

    return app.get<AppService>(AppService);
  }

  beforeEach(() => {
    query.mockReset();
  });

  describe('getHealth', () => {
    it('reports healthy when the database responds', async () => {
      query.mockResolvedValue([{ '?column?': 1 }]);
      const service = await createService();

      await expect(service.getHealth()).resolves.toEqual({ status: 'ok', service: 'notification-service' });
    });

    it('reports unavailable when the database is unreachable', async () => {
      query.mockRejectedValue(new Error('connection refused'));
      const service = await createService();

      await expect(service.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
