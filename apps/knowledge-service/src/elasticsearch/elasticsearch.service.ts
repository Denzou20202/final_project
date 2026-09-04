import { Client, estypes } from '@elastic/elasticsearch';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const TICKETS_INDEX = 'tickets';
export const ARTICLES_INDEX = 'knowledge_articles';

export interface SearchHit<T> {
  id: string;
  score: number | null;
  source: T;
  highlight?: Record<string, string[]>;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly client: Client;

  constructor(config: ConfigService) {
    this.client = new Client({ node: config.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200') });
  }

  // Russian analyzer on free-text fields: VeloxDesk's content is Russian
  // (per the design prototype and all seed data), and the default "standard"
  // analyzer doesn't stem Russian word forms — "заказ"/"заказа"/"заказов"
  // would otherwise only match their exact surface form.
  //
  // ES unreachable at boot (not ready yet, network blip) used to throw
  // uncaught out of here, crashing the whole knowledge-service — including
  // its Postgres-backed article CRUD, which has nothing to do with search.
  // Best-effort instead: log and move on, so the service still starts;
  // search/index calls will simply keep failing until ES comes up, same as
  // any other runtime ES outage after a successful boot.
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndex(TICKETS_INDEX, {
        properties: {
          title: { type: 'text', analyzer: 'russian' },
          description: { type: 'text', analyzer: 'russian' },
          status: { type: 'keyword' },
          priority: { type: 'keyword' },
          createdBy: { type: 'keyword' },
          assignedTo: { type: 'keyword' },
          createdAt: { type: 'date' },
        },
      });
      await this.ensureIndex(ARTICLES_INDEX, {
        properties: {
          title: { type: 'text', analyzer: 'russian' },
          content: { type: 'text', analyzer: 'russian' },
          publishedAt: { type: 'date' },
          isPublic: { type: 'boolean' },
        },
      });
    } catch (error) {
      this.logger.error(`Elasticsearch unavailable at startup — indices not verified/created: ${error}`);
    }
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  async index(index: string, id: string, document: Record<string, unknown>): Promise<void> {
    await this.client.index({ index, id, document, refresh: 'wait_for' });
  }

  async delete(index: string, id: string): Promise<void> {
    // Same reasoning as index()'s refresh:'wait_for' — an unpublish/delete
    // must be reflected in search results immediately, not after the next
    // ~1s background refresh cycle.
    await this.client.delete({ index, id, refresh: 'wait_for' }, { ignore: [404] });
  }

  async search<T>(
    index: string,
    query: string,
    fields: string[],
    limit = 20,
  ): Promise<SearchHit<T>[]> {
    const result = await this.client.search<T>({
      index,
      size: limit,
      query: { multi_match: { query, fields, fuzziness: 'AUTO' } },
      highlight: { fields: Object.fromEntries(fields.map((field) => [field, {}])) },
    });

    return result.hits.hits.map((hit) => ({
      id: hit._id as string,
      score: hit._score ?? null,
      source: hit._source as T,
      highlight: hit.highlight,
    }));
  }

  private async ensureIndex(index: string, mappings: estypes.MappingTypeMapping): Promise<void> {
    const exists = await this.client.indices.exists({ index });
    if (!exists) {
      await this.client.indices.create({ index, mappings });
      this.logger.log(`Created Elasticsearch index "${index}"`);
    }
  }
}
