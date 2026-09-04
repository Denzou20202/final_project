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

  // Regression coverage: a single try/catch around both ensureIndex calls
  // meant a transient failure on the FIRST (ES reachable but flaking
  // mid-init, not fully down) silently skipped the second entirely, with no
  // later retry — this method only ever runs once per process lifetime, so
  // one index stayed permanently missing until a manual restart.
  it('still attempts the second index when the first one fails', async () => {
    const configService = { get: () => 'http://localhost:9200' };
    const service = new ElasticsearchService(configService as never);
    const exists = jest.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(true);

    (service as unknown as { client: unknown }).client = { indices: { exists } };

    await service.onModuleInit();

    expect(exists).toHaveBeenCalledTimes(2);
  });
});
