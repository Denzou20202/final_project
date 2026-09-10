import 'dotenv/config';
import { DataSource } from 'typeorm';
import { entities } from './entities/index.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'veloxdesk',
  password: process.env.DB_PASSWORD ?? 'secret',
  database: process.env.DB_NAME ?? 'veloxdesk',
  entities,
  migrations: ['libs/database/src/migrations/*.ts'],
  synchronize: false,
});
