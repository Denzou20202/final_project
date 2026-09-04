import { ElasticsearchService } from './elasticsearch.service.js';

// Regression coverage: onModuleInit previously let an ES connection error at
// startup (ES not ready yet, network blip) propagate uncaught, crashing the
// whole knowledge-service — including its unrelated Postgres-backed article
// CRUD. It should now log and resolve instead.
describe('ElasticsearchService.onModuleInit — ES unreachable at startup', () => {
  it('does not throw when the ES client fails to connect', async () => {
    const configService = { get: () => 'http://localhost:9200' };
    const service = new ElasticsearchService(configService as never);

    // `client` is constructed internally in the constructor — swap it for a
    // stub that fails the way a real connection error would, same as
    // stubbing any other internally-constructed SDK client in this codebase.
    (service as unknown as { client: unknown }).client = {
      indices: {
        exists: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:9200')),
      },
    };

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
