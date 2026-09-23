import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { DataSource } from 'typeorm';
import { createDatabaseOptions, environmentSchema } from './database.config';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const environment = environmentSchema.parse(process.env);

export default new DataSource(
  createDatabaseOptions(new ConfigService(environment)),
);
