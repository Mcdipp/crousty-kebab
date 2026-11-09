import { z } from 'zod';

const HOUR = 3_600_000;

/** Prénom / pseudo : lettres (accents inclus), chiffres, espaces, - ' _ . */
export const nameSchema = z
  .string({ error: 'Le nom est obligatoire.' })
  .transform((s) => s.normalize('NFC').trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1, 'Le nom est obligatoire.')
      .max(30, 'Le nom ne doit pas dépasser 30 caractères.')
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} _'.-]*$/u, 'Le nom contient des caractères non autorisés.'),
  );

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Maximum ${max} caractères.`)
    .transform((s) => s.trim())
    .transform((s) => (s.length ? s : null))
    .nullish()
    .transform((v) => v ?? null);

export const sessionCodeSchema = z.string().regex(/^\d{4}$/, 'Le code doit contenir 4 chiffres.');
export const uuidSchema = z.uuid('Identifiant invalide.');

export const croustyProductSchema = z.enum(['NATURE', 'PIQUANT', 'SUCRE', 'SUCRE_PIQUANT']);
export const participationChoiceSchema = z.enum(['TACOS', 'KEBAB']);

export const createSessionSchema = z
  .object({
    type: z.enum(['CROUSTY', 'TACOS_KEBAB']),
    creatorName: nameSchema,
    scheduledAt: z.iso
      .datetime({ offset: true, error: 'Heure prévue invalide.' })
      .transform((s) => new Date(s))
      .refine(
        (d) => d.getTime() > Date.now() - 12 * HOUR && d.getTime() < Date.now() + 7 * 24 * HOUR,
        "L'heure prévue doit être dans les 7 prochains jours.",
      ),
    description: optionalText(300),
    foodChoice: z.enum(['TACOS', 'KEBAB', 'BOTH']).optional(),
  })
  .strict()
  .transform((v) => ({
    ...v,
    foodChoice: v.type === 'TACOS_KEBAB' ? (v.foodChoice ?? 'BOTH') : null,
  }));

export const joinSessionSchema = z
  .object({
    code: sessionCodeSchema,
    name: nameSchema,
    /** Jeton déjà détenu par ce navigateur, pour reprendre son identité. */
    participantToken: z.string().max(100).optional(),
  })
  .strict();

export const createOrderSchema = z
  .object({
    targetName: nameSchema,
    productType: croustyProductSchema,
    quantity: z.coerce.number().int().min(1, 'Quantité minimale : 1.').max(20, 'Quantité maximale : 20.'),
    notes: optionalText(200),
  })
  .strict();

export const updateOrderSchema = z
  .object({
    targetName: nameSchema.optional(),
    productType: croustyProductSchema.optional(),
    quantity: z.coerce.number().int().min(1).max(20).optional(),
    notes: optionalText(200).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Aucune modification fournie.');

export const participationSchema = z
  .object({
    choice: participationChoiceSchema,
    notes: optionalText(200),
  })
  .strict();

export const sessionIdParams = z.object({ id: uuidSchema });
export const codeParams = z.object({ code: sessionCodeSchema });
export const participationParams = z.object({ id: uuidSchema, participantId: uuidSchema });

export type CreateSessionInput = z.output<typeof createSessionSchema>;
export type CreateOrderInput = z.output<typeof createOrderSchema>;
export type UpdateOrderInput = z.output<typeof updateOrderSchema>;
export type ParticipationInput = z.output<typeof participationSchema>;
