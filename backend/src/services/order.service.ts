import { prisma } from '../db.js';
import type { CreateOrderInput, UpdateOrderInput } from '../schemas/index.js';
import { BadRequest, Forbidden, NotFound } from '../utils/errors.js';
import { broadcast } from '../sockets/realtime.js';
import { loadPublicState } from './serializer.js';
import { assertSessionOpen, resolveActor } from './session.service.js';

interface Tokens {
  participantToken?: string;
  creatorToken?: string;
}

export async function listOrders(sessionId: string) {
  const state = await loadPublicState(sessionId);
  if (!state) throw NotFound('Session introuvable.');
  return state.orders;
}

export async function createOrder(sessionId: string, input: CreateOrderInput, tokens: Tokens) {
  const actor = await resolveActor(sessionId, tokens.participantToken, tokens.creatorToken);

  const order = await prisma.$transaction(async (tx) => {
    const s = await assertSessionOpen(tx, sessionId);
    if (s.type !== 'CROUSTY') throw BadRequest('WRONG_SESSION_TYPE', 'Cette session ne prend pas de commandes Crousty.');
    // Le créateur sans jeton participant agit via son propre profil participant.
    let ownerId = actor.participantId;
    if (!ownerId) {
      const creator = await tx.participant.findFirst({ where: { sessionId, isCreator: true }, select: { id: true } });
      ownerId = creator!.id;
    }
    return tx.order.create({
      data: {
        sessionId,
        participantId: ownerId,
        targetName: input.targetName,
        productType: input.productType,
        quantity: input.quantity,
        notes: input.notes,
      },
    });
  });

  const state = (await loadPublicState(sessionId))!;
  const data = state.orders.find((o) => o.id === order.id);
  broadcast(sessionId, 'order:created', { state, actor: actor.participantName, data });
  return { order: data!, state };
}

async function loadOwnedOrder(orderId: string, tokens: Tokens) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw NotFound('Commande introuvable.');
  const actor = await resolveActor(order.sessionId, tokens.participantToken, tokens.creatorToken);
  if (!actor.isCreator && actor.participantId !== order.participantId) {
    throw Forbidden('Tu ne peux modifier que tes propres commandes.');
  }
  return { order, actor };
}

export async function updateOrder(orderId: string, input: UpdateOrderInput, tokens: Tokens) {
  const { order, actor } = await loadOwnedOrder(orderId, tokens);
  await prisma.$transaction(async (tx) => {
    await assertSessionOpen(tx, order.sessionId);
    await tx.order.update({
      where: { id: orderId },
      data: {
        ...(input.targetName !== undefined && { targetName: input.targetName }),
        ...(input.productType !== undefined && { productType: input.productType }),
        ...(input.quantity !== undefined && { quantity: input.quantity }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  });
  const state = (await loadPublicState(order.sessionId))!;
  const data = state.orders.find((o) => o.id === orderId);
  broadcast(order.sessionId, 'order:updated', { state, actor: actor.participantName, data });
  return { order: data!, state };
}

export async function deleteOrder(orderId: string, tokens: Tokens) {
  const { order, actor } = await loadOwnedOrder(orderId, tokens);
  await prisma.$transaction(async (tx) => {
    await assertSessionOpen(tx, order.sessionId);
    await tx.order.delete({ where: { id: orderId } });
  });
  const state = (await loadPublicState(order.sessionId))!;
  broadcast(order.sessionId, 'order:deleted', { state, actor: actor.participantName, data: { id: orderId } });
  return { state };
}
