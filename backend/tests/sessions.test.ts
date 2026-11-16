import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { api, createCrousty, createTacos, inOneHour, join, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('Création de session', () => {
  it('crée une session Crousty identifiée par un UUID et ajoute le créateur', async () => {
    const res = await createCrousty('Thomas');
    expect(res.state.session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.state.session).not.toHaveProperty('code');
    expect(res.state.session.status).toBe('OPEN');
    expect(res.state.session.type).toBe('CROUSTY');
    expect(res.state.participants).toHaveLength(1);
    expect(res.state.participants[0]).toMatchObject({ name: 'Thomas', isCreator: true });
    expect(res.creatorToken).toHaveLength(43);
    expect(res.participantToken).toHaveLength(43);
  });

  it("n'expose jamais les jetons ni leurs empreintes dans les réponses publiques", async () => {
    const created = await createCrousty();
    const res = await api().get(`/api/sessions/${created.state.session.id}`).expect(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('tokenHash');
    expect(raw).not.toContain('creatorTokenHash');
    expect(raw).not.toContain(created.creatorToken);
    expect(raw).not.toContain(created.participantToken);
    expect(res.body.isCreator).toBe(false);
    const asCreator = await api()
      .get(`/api/sessions/${created.state.session.id}`)
      .set('X-Creator-Token', created.creatorToken)
      .expect(200);
    expect(asCreator.body.isCreator).toBe(true);
  });

  it("refuse de rejoindre une session expirée, mais la garde consultable", async () => {
    const old = await createCrousty();
    const id = old.state.session.id;
    await prisma.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await api().post(`/api/sessions/${id}/join`).send({ name: 'Lucas' }).expect(404);
    await api().get(`/api/sessions/${id}`).expect(200);
  });

  it('refuse des données invalides', async () => {
    await api().post('/api/sessions').send({ type: 'CROUSTY', creatorName: '', scheduledAt: inOneHour() }).expect(400);
    await api().post('/api/sessions').send({ type: 'PIZZA', creatorName: 'Bob', scheduledAt: inOneHour() }).expect(400);
    await api().post('/api/sessions').send({ type: 'CROUSTY', creatorName: 'Bob', scheduledAt: 'demain' }).expect(400);
    await api()
      .post('/api/sessions')
      .send({ type: 'CROUSTY', creatorName: '<script>', scheduledAt: inOneHour() })
      .expect(400);
    await api()
      .post('/api/sessions')
      .send({ type: 'CROUSTY', creatorName: 'Bob', scheduledAt: inOneHour(), isAdmin: true })
      .expect(400);
    await api().post('/api/sessions').set('Content-Type', 'application/json').send('{oops').expect(400);
  });

  it('crée une session Tacos / Kebab avec le choix de nourriture', async () => {
    const res = await createTacos('KEBAB');
    expect(res.state.session).toMatchObject({ type: 'TACOS_KEBAB', foodChoice: 'KEBAB' });
  });
});

describe('Rejoindre une session', () => {
  it('rejoint une session avec son identifiant', async () => {
    const s = await createCrousty('Thomas');
    const j = await join(s.state.session.id, 'Lucas');
    expect(j.state.participants.map((p: any) => p.name)).toEqual(['Thomas', 'Lucas']);
    expect(j.participantToken).toBeTruthy();
  });

  it('renvoie 404 pour une session inconnue et 400 pour un identifiant mal formé', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    await api().post(`/api/sessions/${unknown}/join`).send({ name: 'Lucas' }).expect(404);
    await api().get(`/api/sessions/${unknown}`).expect(404);
    await api().post('/api/sessions/1234/join').send({ name: 'Lucas' }).expect(400);
    await api().get('/api/sessions/1234').expect(400);
  });

  it('refuse un prénom déjà pris, sauf reprise avec le bon jeton', async () => {
    const s = await createCrousty('Thomas');
    const id = s.state.session.id;
    const lucas = await join(id, 'Lucas');
    const dup = await api().post(`/api/sessions/${id}/join`).send({ name: ' lucas ' }).expect(409);
    expect(dup.body.error.code).toBe('NAME_TAKEN');
    const again = await api()
      .post(`/api/sessions/${id}/join`)
      .send({ name: 'Lucas', participantToken: lucas.participantToken })
      .expect(200);
    expect(again.body.participantId).toBe(lucas.participantId);
  });

  it('refuse de rejoindre une session clôturée', async () => {
    const s = await createCrousty();
    await api().post(`/api/sessions/${s.state.session.id}/close`).set('X-Creator-Token', s.creatorToken).expect(200);
    const res = await api().post(`/api/sessions/${s.state.session.id}/join`).send({ name: 'Lucas' }).expect(409);
    expect(res.body.error.code).toBe('SESSION_CLOSED');
  });
});

describe('Fermeture / réouverture', () => {
  it('seul le créateur peut clôturer et rouvrir', async () => {
    const s = await createCrousty('Thomas');
    const id = s.state.session.id;
    const lucas = await join(s.state.session.id, 'Lucas');

    await api().post(`/api/sessions/${id}/close`).expect(403);
    await api().post(`/api/sessions/${id}/close`).set('X-Creator-Token', lucas.participantToken).expect(403);
    await api().post(`/api/sessions/${id}/close`).set('X-Participant-Token', s.participantToken).expect(403);

    const closed = await api().post(`/api/sessions/${id}/close`).set('X-Creator-Token', s.creatorToken).expect(200);
    expect(closed.body.state.session.status).toBe('CLOSED');
    expect(closed.body.state.session.closedAt).toBeTruthy();

    await api().post(`/api/sessions/${id}/reopen`).set('X-Creator-Token', lucas.participantToken).expect(403);
    const reopened = await api().post(`/api/sessions/${id}/reopen`).set('X-Creator-Token', s.creatorToken).expect(200);
    expect(reopened.body.state.session).toMatchObject({ status: 'OPEN', closedAt: null });
  });

  it('la liste finale reste visible après clôture', async () => {
    const s = await createCrousty();
    await api()
      .post(`/api/sessions/${s.state.session.id}/orders`)
      .set('X-Participant-Token', s.participantToken)
      .send({ targetName: 'Thomas', productType: 'NATURE', quantity: 2 })
      .expect(201);
    await api().post(`/api/sessions/${s.state.session.id}/close`).set('X-Creator-Token', s.creatorToken).expect(200);
    const res = await api().get(`/api/sessions/${s.state.session.id}`).expect(200);
    expect(res.body.state.orders).toHaveLength(1);
    expect(res.body.state.session.status).toBe('CLOSED');
  });
});

describe('Sécurité HTTP', () => {
  it('applique les en-têtes Helmet et renvoie 404 JSON sur route inconnue', async () => {
    const res = await api().get('/api/nope').expect(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('healthcheck et configuration', async () => {
    await api().get('/api/health').expect(200, { status: 'ok' });
    const res = await api().get('/api/config').expect(200);
    expect(res.body.croustyPhone).toMatch(/^[0-9+ ]+$/);
  });
});
