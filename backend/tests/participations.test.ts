import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { api, createCrousty, createTacos, join, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const participate = (sessionId: string, token: string, body: object) =>
  api().post(`/api/sessions/${sessionId}/participations`).set('X-Participant-Token', token).send(body);

describe('Participations Tacos / Kebab', () => {
  it("dire « j'y vais », modifier son petit mot et se retirer", async () => {
    const yanis = await createTacos('BOTH', 'Yanis');
    const id = yanis.state.session.id;
    const thomas = await join(yanis.state.session.id, 'Thomas');
    const lucas = await join(yanis.state.session.id, 'Lucas');

    await participate(id, thomas.participantToken, {}).expect(200);
    const l = await participate(id, lucas.participantToken, { notes: 'j’arrive vers 12h15' }).expect(200);
    expect(l.body.participation).toMatchObject({ notes: 'j’arrive vers 12h15' });
    expect(l.body.participation).not.toHaveProperty('choice');

    // Modifier son petit mot = upsert, pas de doublon
    const upd = await participate(id, thomas.participantToken, { notes: 'je ramène Léa' }).expect(200);
    expect(upd.body.state.participations).toHaveLength(2);
    expect(upd.body.participation.notes).toBe('je ramène Léa');

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

  it('refuse les champs inconnus (plus de choix individuel tacos / kebab)', async () => {
    const t = await createTacos('TACOS');
    await participate(t.state.session.id, t.participantToken, { choice: 'KEBAB' }).expect(400);
    await participate(t.state.session.id, t.participantToken, {}).expect(200);
  });

  it('bloque les inscriptions après clôture', async () => {
    const t = await createTacos();
    const thomas = await join(t.state.session.id, 'Thomas');
    await api().post(`/api/sessions/${t.state.session.id}/close`).set('X-Creator-Token', t.creatorToken).expect(200);
    await participate(t.state.session.id, thomas.participantToken, {}).expect(409);
  });

  it('refuse les participations dans une session Crousty', async () => {
    const c = await createCrousty();
    await participate(c.state.session.id, c.participantToken, {}).expect(400);
  });

  it('la suppression d’une participation ne supprime pas de commandes', async () => {
    const t = await createTacos();
    const before = await prisma.order.count();
    await participate(t.state.session.id, t.participantToken, {}).expect(200);
    await api()
      .delete(`/api/sessions/${t.state.session.id}/participations/${t.participantId}`)
      .set('X-Participant-Token', t.participantToken)
      .expect(200);
    expect(await prisma.order.count()).toBe(before);
  });
});
