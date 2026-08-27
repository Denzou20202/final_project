import { ServiceUnavailableException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service.js';
import { AppService } from './app.service';

describe('AppService', () => {
  const query = jest.fn();
  const ping = jest.fn();

  async function createService() {
    const app = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: getDataSourceToken(), useValue: { query } },
        { provide: ElasticsearchService, useValue: { ping } },
      ],
    }).compile();

    return app.get<AppService>(AppService);
  }

  beforeEach(() => {
    query.mockReset();
    ping.mockReset();
  });

  describe('getHealth', () => {
    it('reports healthy when the database and Elasticsearch respond', async () => {
      query.mockResolvedValue([{ '?column?': 1 }]);
      ping.mockResolvedValue(undefined);
      const service = await createService();

      await expect(service.getHealth()).resolves.toEqual({ status: 'ok', service: 'knowledge-service' });
    });

    it('reports unavailable when the database is unreachable', async () => {
      query.mockRejectedValue(new Error('connection refused'));
      ping.mockResolvedValue(undefined);
      const service = await createService();

      await expect(service.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('reports unavailable when Elasticsearch is unreachable', async () => {
      query.mockResolvedValue([{ '?column?': 1 }]);
      ping.mockRejectedValue(new Error('connection refused'));
      const service = await createService();

      await expect(service.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
