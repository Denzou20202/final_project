import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service.js';

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly elasticsearch: ElasticsearchService,
  ) {}

  async getHealth(): Promise<{ status: string; service: string }> {
    try {
      await Promise.all([this.dataSource.query('SELECT 1'), this.elasticsearch.ping()]);
    } catch {
      throw new ServiceUnavailableException({ status: 'error', service: 'knowledge-service' });
    }

    return { status: 'ok', service: 'knowledge-service' };
  }
}
