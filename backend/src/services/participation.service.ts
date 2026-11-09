import { prisma } from '../db.js';
import type { ParticipationInput } from '../schemas/index.js';
import { BadRequest, Forbidden, NotFound } from '../utils/errors.js';
import { broadcast } from '../sockets/realtime.js';
import { loadPublicState } from './serializer.js';
import { assertSessionOpen, resolveActor } from './session.service.js';

interface Tokens {
  participantToken?: string;
  creatorToken?: string;
}

/** Inscription ou modification du choix (upsert) pour le participant appelant. */
export async function upsertParticipation(sessionId: string, input: ParticipationInput, tokens: Tokens) {
  const actor = await resolveActor(sessionId, tokens.participantToken, tokens.creatorToken);
  let participantId = actor.participantId;

  await prisma.$transaction(async (tx) => {
    const s = await assertSessionOpen(tx, sessionId);
    if (s.type !== 'TACOS_KEBAB') {
      throw BadRequest('WRONG_SESSION_TYPE', 'Cette session n’est pas une sortie Tacos / Kebab.');
    }
    if (s.foodChoice && s.foodChoice !== 'BOTH' && s.foodChoice !== input.choice) {
      throw BadRequest(
        'CHOICE_NOT_ALLOWED',
        `Cette sortie est uniquement ${s.foodChoice === 'TACOS' ? 'Tacos' : 'Kebab'}.`,
      );
    }
    if (!participantId) {
      const creator = await tx.participant.findFirst({ where: { sessionId, isCreator: true }, select: { id: true } });
      participantId = creator!.id;
    }
    await tx.participation.upsert({
      where: { sessionId_participantId: { sessionId, participantId } },
      create: { sessionId, participantId, choice: input.choice, notes: input.notes },
      update: { choice: input.choice, notes: input.notes },
    });
  });

  const state = (await loadPublicState(sessionId))!;
  const data = state.participations.find((p) => p.participantId === participantId);
  broadcast(sessionId, 'participation:updated', { state, actor: actor.participantName, data });
  return { participation: data!, state };
}

/** Retrait d'un participant de la sortie (lui-même ou le créateur). Ne touche à rien d'autre. */
export async function removeParticipation(sessionId: string, participantId: string, tokens: Tokens) {
  const actor = await resolveActor(sessionId, tokens.participantToken, tokens.creatorToken);
  if (!actor.isCreator && actor.participantId !== participantId) {
    throw Forbidden('Tu ne peux retirer que ta propre participation.');
  }
  await prisma.$transaction(async (tx) => {
    await assertSessionOpen(tx, sessionId);
    const deleted = await tx.participation.deleteMany({ where: { sessionId, participantId } });
    if (deleted.count === 0) throw NotFound('Aucune participation à retirer.');
  });
  const state = (await loadPublicState(sessionId))!;
  const name = state.participants.find((p) => p.id === participantId)?.name ?? null;
  broadcast(sessionId, 'participant:left', { state, actor: actor.participantName, data: { participantId, name } });
  return { state };
}
