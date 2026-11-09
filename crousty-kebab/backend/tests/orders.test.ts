import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { api, createCrousty, createTacos, join, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function setup() {
  const thomas = await createCrousty('Thomas');
  const sessionId = thomas.state.session.id as string;
  const lucas = await join(thomas.state.session.code, 'Lucas');
  const mehdi = await join(thomas.state.session.code, 'Mehdi');
  return { thomas, lucas, mehdi, sessionId };
}

const addOrder = (sessionId: string, token: string, body: object) =>
  api().post(`/api/sessions/${sessionId}/orders`).set('X-Participant-Token', token).send(body);

describe('Commandes Crousty', () => {
  it('ajoute une commande pour soi et pour un autre participant / un nouveau nom', async () => {
    const { lucas, sessionId } = await setup();
    const own = await addOrder(sessionId, lucas.participantToken, {
      targetName: 'Lucas',
      productType: 'SUCRE',
      quantity: 2,
    }).expect(201);
    expect(own.body.order).toMatchObject({ targetName: 'Lucas', productType: 'SUCRE', quantity: 2 });
    expect(own.body.order.participantId).toBe(lucas.participantId);

    await addOrder(sessionId, lucas.participantToken, { targetName: 'Mehdi', productType: 'SUCRE_PIQUANT', quantity: 1 }).expect(201);
    await addOrder(sessionId, lucas.participantToken, {
      targetName: 'Yanis',
      productType: 'PIQUANT',
      quantity: 1,
      notes: 'sans oignons',
    }).expect(201);

    const list = await api().get(`/api/sessions/${sessionId}/orders`).expect(200);
    expect(list.body.orders.map((o: any) => o.targetName)).toEqual(['Lucas', 'Mehdi', 'Yanis']);
    expect(list.body.orders[2].notes).toBe('sans oignons');
  });

  it('refuse une commande sans jeton, avec un jeton d’une autre session ou invalide', async () => {
    const { sessionId } = await setup();
    const other = await createCrousty('Intrus');
    await api().post(`/api/sessions/${sessionId}/orders`).send({ targetName: 'X', productType: 'NATURE', quantity: 1 }).expect(401);
    await addOrder(sessionId, other.participantToken, { targetName: 'X', productType: 'NATURE', quantity: 1 }).expect(401);
    await addOrder(sessionId, 'n'.repeat(43), { targetName: 'X', productType: 'NATURE', quantity: 1 }).expect(401);
  });

  it('valide le produit et la quantité', async () => {
    const { lucas, sessionId } = await setup();
    await addOrder(sessionId, lucas.participantToken, { targetName: 'Lucas', productType: 'PIZZA', quantity: 1 }).expect(400);
    await addOrder(sessionId, lucas.participantToken, { targetName: 'Lucas', productType: 'NATURE', quantity: 0 }).expect(400);
    await addOrder(sessionId, lucas.participantToken, { targetName: 'Lucas', productType: 'NATURE', quantity: 21 }).expect(400);
    await addOrder(sessionId, lucas.participantToken, { targetName: 'Lucas', productType: 'NATURE', quantity: 1.5 }).expect(400);
    await addOrder(sessionId, lucas.participantToken, { productType: 'NATURE', quantity: 1 }).expect(400);
  });

  it('chacun modifie / supprime ses propres commandes, le créateur gère tout', async () => {
    const { thomas, lucas, mehdi, sessionId } = await setup();
    const order = (await addOrder(sessionId, lucas.participantToken, { targetName: 'Lucas', productType: 'NATURE', quantity: 1 }).expect(201))
      .body.order;

    // Mehdi ne peut pas toucher la commande de Lucas
    await api().patch(`/api/orders/${order.id}`).set('X-Participant-Token', mehdi.participantToken).send({ quantity: 3 }).expect(403);
    await api().delete(`/api/orders/${order.id}`).set('X-Participant-Token', mehdi.participantToken).expect(403);

    // Lucas modifie la sienne
    const upd = await api()
      .patch(`/api/orders/${order.id}`)
      .set('X-Participant-Token', lucas.participantToken)
      .send({ quantity: 3, productType: 'PIQUANT' })
      .expect(200);
    expect(upd.body.order).toMatchObject({ quantity: 3, productType: 'PIQUANT' });

    // Le créateur (jeton de gestion) peut modifier puis supprimer
    await api().patch(`/api/orders/${order.id}`).set('X-Creator-Token', thomas.creatorToken).send({ quantity: 4 }).expect(200);
    await api().delete(`/api/orders/${order.id}`).set('X-Creator-Token', thomas.creatorToken).expect(200);
    await api().delete(`/api/orders/${order.id}`).set('X-Creator-Token', thomas.creatorToken).expect(404);
  });

  it('le créateur peut commander avec son seul jeton de gestion', async () => {
    const { thomas, sessionId } = await setup();
    const res = await api()
      .post(`/api/sessions/${sessionId}/orders`)
      .set('X-Creator-Token', thomas.creatorToken)
      .send({ targetName: 'Thomas', productType: 'NATURE', quantity: 1 })
      .expect(201);
    expect(res.body.order.participantId).toBe(thomas.participantId);
  });

  it("interdit d'ajouter, modifier ou supprimer après la fermeture", async () => {
    const { thomas, lucas, sessionId } = await setup();
    const order = (await addOrder(sessionId, lucas.participantToken, { targetName: 'Lucas', productType: 'NATURE', quantity: 1 }).expect(201))
      .body.order;
    await api().post(`/api/sessions/${sessionId}/close`).set('X-Creator-Token', thomas.creatorToken).expect(200);

    const add = await addOrder(sessionId, lucas.participantToken, { targetName: 'Lucas', productType: 'SUCRE', quantity: 1 }).expect(409);
    expect(add.body.error.code).toBe('SESSION_CLOSED');
    await api().patch(`/api/orders/${order.id}`).set('X-Participant-Token', lucas.participantToken).send({ quantity: 2 }).expect(409);
    await api().delete(`/api/orders/${order.id}`).set('X-Participant-Token', lucas.participantToken).expect(409);
    // Même le créateur ne peut plus modifier sans rouvrir
    await api().delete(`/api/orders/${order.id}`).set('X-Creator-Token', thomas.creatorToken).expect(409);

    await api().post(`/api/sessions/${sessionId}/reopen`).set('X-Creator-Token', thomas.creatorToken).expect(200);
    await addOrder(sessionId, lucas.participantToken, { targetName: 'Lucas', productType: 'SUCRE', quantity: 1 }).expect(201);
  });

  it('refuse les commandes Crousty dans une sortie Tacos / Kebab', async () => {
    const t = await createTacos();
    await addOrder(t.state.session.id, t.participantToken, { targetName: 'Yanis', productType: 'NATURE', quantity: 1 }).expect(400);
  });
});
