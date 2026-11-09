import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { api, createCrousty, createTacos, join, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const participate = (sessionId: string, token: string, body: object) =>
  api().post(`/api/sessions/${sessionId}/participations`).set('X-Participant-Token', token).send(body);

describe('Participations Tacos / Kebab', () => {
  it("s'inscrire, modifier son choix et se retirer", async () => {
    const yanis = await createTacos('BOTH', 'Yanis');
    const id = yanis.state.session.id;
    const thomas = await join(yanis.state.session.code, 'Thomas');
    const lucas = await join(yanis.state.session.code, 'Lucas');

    await participate(id, thomas.participantToken, { choice: 'TACOS' }).expect(200);
    const l = await participate(id, lucas.participantToken, { choice: 'KEBAB', notes: 'sauce blanche' }).expect(200);
    expect(l.body.participation).toMatchObject({ choice: 'KEBAB', notes: 'sauce blanche' });

    // Modifier son choix = upsert, pas de doublon
    const upd = await participate(id, thomas.participantToken, { choice: 'KEBAB' }).expect(200);
    expect(upd.body.state.participations).toHaveLength(2);
    expect(upd.body.participation.choice).toBe('KEBAB');

    // Thomas ne peut pas retirer Lucas
    await api()
      .delete(`/api/sessions/${id}/participations/${lucas.participantId}`)
      .set('X-Participant-Token', thomas.participantToken)
      .expect(403);

    // Thomas se retire : la participation de Lucas est conservée
    const del = await api()
      .delete(`/api/sessions/${id}/participations/${thomas.participantId}`)
      .set('X-Participant-Token', thomas.participantToken)
      .expect(200);
    expect(del.body.state.participations).toHaveLength(1);
    expect(del.body.state.participations[0].participantId).toBe(lucas.participantId);
    // Le participant reste dans la session
    expect(del.body.state.participants.map((p: any) => p.name)).toContain('Thomas');

    // Le créateur peut retirer n'importe qui
    await api()
      .delete(`/api/sessions/${id}/participations/${lucas.participantId}`)
      .set('X-Creator-Token', yanis.creatorToken)
      .expect(200);
  });

  it('respecte le choix imposé par la session', async () => {
    const t = await createTacos('TACOS');
    await participate(t.state.session.id, t.participantToken, { choice: 'KEBAB' }).expect(400);
    await participate(t.state.session.id, t.participantToken, { choice: 'TACOS' }).expect(200);
  });

  it('bloque les inscriptions après clôture', async () => {
    const t = await createTacos();
    const thomas = await join(t.state.session.code, 'Thomas');
    await api().post(`/api/sessions/${t.state.session.id}/close`).set('X-Creator-Token', t.creatorToken).expect(200);
    await participate(t.state.session.id, thomas.participantToken, { choice: 'TACOS' }).expect(409);
  });

  it('refuse les participations dans une session Crousty', async () => {
    const c = await createCrousty();
    await participate(c.state.session.id, c.participantToken, { choice: 'TACOS' }).expect(400);
  });

  it('la suppression d’une participation ne supprime pas de commandes', async () => {
    const t = await createTacos();
    const before = await prisma.order.count();
    await participate(t.state.session.id, t.participantToken, { choice: 'TACOS' }).expect(200);
    await api()
      .delete(`/api/sessions/${t.state.session.id}/participations/${t.participantId}`)
      .set('X-Participant-Token', t.participantToken)
      .expect(200);
    expect(await prisma.order.count()).toBe(before);
  });
});
