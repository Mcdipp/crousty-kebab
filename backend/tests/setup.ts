import { config as loadEnv } from 'dotenv';

// Base dédiée aux tests (jamais la base de développement).
loadEnv({ path: '.env.test', override: true, quiet: true });
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_MAX ??= '100000';
process.env.RATE_LIMIT_CREATE_MAX ??= '100000';
process.env.CORS_ORIGIN ??= '';

if (!process.env.DATABASE_URL?.includes('test')) {
  throw new Error('DATABASE_URL de test doit pointer vers une base contenant "test".');
}
