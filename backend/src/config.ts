import 'dotenv/config';
import { z } from 'zod';

/** URL de webhook Discord (vide = désactivé). */
const discordWebhook = z
  .string()
  .trim()
  .default('')
  .refine(
    (v) => v === '' || /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(v),
    'URL de webhook Discord invalide (attendu : https://discord.com/api/webhooks/<id>/<token>).',
  );

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
  /** Durée pendant laquelle une session reste visible et joignable après son heure prévue. */
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(48),
  LOBBY_CLOSED_HOURS: z.coerce.number().min(0).max(24 * 7).default(12),
  CROUSTY_PHONE: z.string().regex(/^[0-9+ ]{6,20}$/).default('0554796424'),
  /** Salons Discord prévenus à l'ouverture d'une session. */
  DISCORD_WEBHOOK_CROUSTY: discordWebhook,
  DISCORD_WEBHOOK_TACOS: discordWebhook,
  /** Qui mentionner dans chaque salon : @everyone, @here, un identifiant de rôle, ou vide pour personne. */
  DISCORD_MENTION_CROUSTY: z.string().trim().max(40).default('@everyone'),
  DISCORD_MENTION_TACOS: z.string().trim().max(40).default('@everyone'),
  /** Adresse publique du site, pour mettre le lien de la session dans le message Discord. */
  PUBLIC_URL: z
    .string()
    .trim()
    .default('')
    .refine((v) => v === '' || /^https?:\/\/[^\s/]+(\/\S*)?$/.test(v), 'PUBLIC_URL doit commencer par http:// ou https://')
    .transform((v) => v.replace(/\/+$/, '')),
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
