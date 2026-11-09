import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, corsOrigins } from './config.js';
import { apiLimiter, errorHandler, notFoundHandler } from './middleware/index.js';
import { router } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  app.set('query parser', 'simple');

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins.length ? corsOrigins : false,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Participant-Token', 'X-Creator-Token'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '10kb', strict: true }));

  app.use('/api', apiLimiter, router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
