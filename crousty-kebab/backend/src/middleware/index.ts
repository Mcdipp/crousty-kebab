import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ZodError, type ZodType, z } from 'zod';
import { config } from '../config.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/errors.js';

/** Valide body / params avec Zod et remplace les valeurs par la version nettoyée. */
export function validate<B extends ZodType | undefined, P extends ZodType | undefined>(schemas: {
  body?: B;
  params?: P;
}): RequestHandler {
  return (req, _res, next) => {
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    if (schemas.params) {
      // req.params est un getter en Express 5 : on stocke la version validée à part.
      res(req).validatedParams = schemas.params.parse(req.params);
    }
    next();
  };
}

const res = (req: Request) => req as Request & { validatedParams?: unknown };
export const params = <T>(req: Request) => (res(req).validatedParams ?? req.params) as T;

/** Jetons transmis UNIQUEMENT par en-têtes (jamais dans l'URL, pour ne pas finir dans les logs). */
export function tokensOf(req: Request) {
  const p = req.header('x-participant-token');
  const c = req.header('x-creator-token');
  return {
    participantToken: p && p.length <= 100 ? p : undefined,
    creatorToken: c && c.length <= 100 ? c : undefined,
  };
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes, calme-toi un peu 😅 Réessaie dans quelques minutes.' } },
});

export const createLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.RATE_LIMIT_CREATE_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de sessions créées. Réessaie plus tard.' } },
});

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route introuvable.' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues[0]?.message ?? 'Données invalides.',
        details: z.flattenError(err),
      },
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Cet élément existe déjà.' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' } });
      return;
    }
  }
  // JSON mal formé
  if (typeof err === 'object' && err && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Corps de requête JSON invalide.' } });
    return;
  }
  if (typeof err === 'object' && err && 'type' in err && err.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Requête trop volumineuse.' } });
    return;
  }
  if (config.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Oups, une erreur interne est survenue.' } });
};
