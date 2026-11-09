import { prisma, type Tx } from '../db.js';

/**
 * Sélection publique : AUCUN hash de jeton n'est jamais renvoyé au client.
 */
const publicInclude = {
  participants: {
    orderBy: { joinedAt: 'asc' },
    select: { id: true, name: true, isCreator: true, joinedAt: true },
  },
  orders: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      participantId: true,
      targetName: true,
      productType: true,
      quantity: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  participations: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      participantId: true,
      choice: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

export async function loadPublicState(sessionId: string, db: Tx | typeof prisma = prisma) {
  const s = await db.session.findUnique({ where: { id: sessionId }, include: publicInclude });
  if (!s) return null;
  return {
    /** Horodatage de lecture (ms) : permet au client d'ignorer un état plus ancien reçu en retard. */
    revision: Date.now(),
    session: {
      id: s.id,
      code: s.code,
      type: s.type,
      foodChoice: s.foodChoice,
      scheduledAt: s.scheduledAt.toISOString(),
      description: s.description,
      status: s.status,
      creatorName: s.creatorName,
      createdAt: s.createdAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
    },
    participants: s.participants.map((p) => ({ ...p, joinedAt: p.joinedAt.toISOString() })),
    orders: s.orders.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
    participations: s.participations.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}

export type PublicSessionState = NonNullable<Awaited<ReturnType<typeof loadPublicState>>>;
