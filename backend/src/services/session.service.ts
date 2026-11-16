import { prisma, type Tx } from '../db.js';
import { config } from '../config.js';
import type { CreateSessionInput } from '../schemas/index.js';
import { AppError, Conflict, Forbidden, NotFound, SessionClosed, Unauthorized } from '../utils/errors.js';
import { generateToken, hashToken, nameKey, verifyToken } from '../utils/tokens.js';
import { broadcast, broadcastLobby } from '../sockets/realtime.js';
import { loadPublicState, type PublicSessionState } from './serializer.js';

const activeWhere = () => ({ expiresAt: { gt: new Date() } });

export async function createSession(input: CreateSessionInput) {
  const creatorToken = generateToken();
  const participantToken = generateToken();
  const expiresAt = new Date(
    Math.max(Date.now(), input.scheduledAt.getTime()) + config.SESSION_TTL_HOURS * 3_600_000,
  );

  const { sessionId, participantId } = await prisma.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: {
        type: input.type,
        foodChoice: input.foodChoice,
        scheduledAt: input.scheduledAt,
        description: input.description,
        creatorName: input.creatorName,
        creatorTokenHash: hashToken(creatorToken),
        expiresAt,
        participants: {
          create: {
            name: input.creatorName,
            nameKey: nameKey(input.creatorName),
            tokenHash: hashToken(participantToken),
            isCreator: true,
          },
        },
      },
      include: { participants: { select: { id: true } } },
    });
    return { sessionId: session.id, participantId: session.participants[0]!.id };
  });

  const state = (await loadPublicState(sessionId))!;
  broadcastLobby(state);
  return { state, participantId, participantToken, creatorToken };
}

export async function getStateById(id: string): Promise<PublicSessionState> {
  const state = await loadPublicState(id);
  if (!state) throw NotFound('Session introuvable.');
  return state;
}

export async function joinSession(sessionId: string, name: string, presentedToken?: string) {
  const key = nameKey(name);

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.session.findFirst({ where: { id: sessionId, ...activeWhere() } });
    if (!session) throw NotFound('Cette session n’existe pas ou a expiré.');
    const existing = await tx.participant.findUnique({
      where: { sessionId_nameKey: { sessionId, nameKey: key } },
    });

    // Reprise d'identité : même nom + jeton valide détenu par ce navigateur.
    if (existing) {
      if (presentedToken && verifyToken(presentedToken, existing.tokenHash)) {
        return { participantId: existing.id, participantToken: presentedToken, isNew: false };
      }
      throw Conflict(
        'NAME_TAKEN',
        `Le prénom « ${existing.name} » est déjà utilisé dans cette session. Choisis un autre pseudo.`,
      );
    }

    if (session.status === 'CLOSED') {
      throw new AppError(409, 'SESSION_CLOSED', 'Cette session est clôturée : il n’est plus possible de la rejoindre.');
    }

    const participantToken = generateToken();
    const p = await tx.participant.create({
      data: { sessionId, name, nameKey: key, tokenHash: hashToken(participantToken) },
    });
    return { participantId: p.id, participantToken, isNew: true };
  });

  const state = (await loadPublicState(sessionId))!;
  if (result.isNew) {
    const p = state.participants.find((x) => x.id === result.participantId);
    broadcast(sessionId, 'participant:joined', { state, actor: name, data: p });
  }
  return { state, participantId: result.participantId, participantToken: result.participantToken };
}

/** Identité de l'appelant, déduite des jetons présentés (jamais du corps de la requête). */
export interface Actor {
  participantId: string | null;
  participantName: string | null;
  isCreator: boolean;
}

export async function resolveActor(
  sessionId: string,
  participantToken: string | undefined,
  creatorToken: string | undefined,
): Promise<Actor> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { creatorTokenHash: true },
  });
  if (!session) throw NotFound('Session introuvable.');

  const isCreator = verifyToken(creatorToken, session.creatorTokenHash);
  let participantId: string | null = null;
  let participantName: string | null = null;
  if (participantToken) {
    const p = await prisma.participant.findFirst({
      where: { sessionId, tokenHash: hashToken(participantToken) },
      select: { id: true, name: true },
    });
    if (p) {
      participantId = p.id;
      participantName = p.name;
    }
  }
  if (!participantId && !isCreator) throw Unauthorized('Rejoins la session pour effectuer cette action.');
  return { participantId, participantName, isCreator };
}

/**
 * Verrouille la ligne de session (FOR SHARE) et vérifie qu'elle est ouverte.
 * La clôture fait un UPDATE sur cette même ligne : elle attend donc la fin des écritures en cours.
 */
export async function assertSessionOpen(tx: Tx, sessionId: string) {
  const rows = await tx.$queryRaw<{ status: string; type: string; foodChoice: string | null }[]>`
    SELECT "status"::text AS status, "type"::text AS type, "foodChoice"::text AS "foodChoice"
    FROM "Session" WHERE "id" = ${sessionId}::uuid FOR SHARE`;
  const row = rows[0];
  if (!row) throw NotFound('Session introuvable.');
  if (row.status !== 'OPEN') throw SessionClosed();
  return row;
}

async function setStatus(sessionId: string, creatorToken: string | undefined, open: boolean) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw NotFound('Session introuvable.');
  if (!verifyToken(creatorToken, session.creatorTokenHash)) {
    throw Forbidden('Seul le créateur de la session peut clôturer ou rouvrir la commande.');
  }
  await prisma.session.update({
    where: { id: sessionId },
    data: open ? { status: 'OPEN', closedAt: null } : { status: 'CLOSED', closedAt: session.closedAt ?? new Date() },
  });
  const state = (await loadPublicState(sessionId))!;
  broadcast(sessionId, open ? 'session:reopened' : 'session:closed', {
    state,
    actor: session.creatorName,
  });
  return state;
}

export const closeSession = (id: string, token: string | undefined) => setStatus(id, token, false);
export const reopenSession = (id: string, token: string | undefined) => setStatus(id, token, true);

export async function verifyCreator(sessionId: string, creatorToken: string | undefined): Promise<boolean> {
  const s = await prisma.session.findUnique({ where: { id: sessionId }, select: { creatorTokenHash: true } });
  if (!s) throw NotFound('Session introuvable.');
  return verifyToken(creatorToken, s.creatorTokenHash);
}
