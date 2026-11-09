import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),
  /** Liste d'origines autorisées séparées par des virgules. Vide = même origine uniquement. */
  CORS_ORIGIN: z.string().default(''),
  /** Nombre de proxys de confiance (Nginx = 1). */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(600),
  RATE_LIMIT_CREATE_MAX: z.coerce.number().int().min(1).default(30),
  /** Durée pendant laquelle un code à 4 chiffres reste réservé à une session. */
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(48),
  CROUSTY_PHONE: z.string().regex(/^[0-9+ ]{6,20}$/).default('0554796424'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Configuration invalide :', z.treeifyError(parsed.error));
  process.exit(1);
}

export const config = parsed.data;

export const corsOrigins = config.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
