import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'socket.io';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { attachSockets } from '../src/sockets/index.js';
import { setIo } from '../src/sockets/realtime.js';
import { inOneHour, resetDb } from './helpers.js';

let http: HttpServer;
let io: Server;
let url: string;
const clients: Socket[] = [];

beforeAll(async () => {
  http = createServer(createApp());
  io = attachSockets(http);
  await new Promise<void>((r) => http.listen(0, r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  io.close();
  setIo(null);
  await prisma.$disconnect();
});

beforeEach(resetDb);

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, { transports: ['websocket'], forceNew: true });
    clients.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const joinRoom = (s: Socket, sessionId: string) =>
  s.timeout(3000).emitWithAck('session:join', { sessionId }) as Promise<{ ok: boolean; state?: any; error?: string }>;

const nextEvent = <T = any>(s: Socket, event: string) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout en attendant ${event}`)), 3000);
    s.once(event, (p: T) => {
      clearTimeout(t);
      resolve(p);
    });
  });

describe('Synchronisation Socket.IO', () => {
  it('diffuse jointure, commandes et clôture à tous les membres de la room', async () => {
    const http_ = request(http);
    const created = (
      await http_.post('/api/sessions').send({ type: 'CROUSTY', creatorName: 'Thomas', scheduledAt: inOneHour() }).expect(201)
    ).body;
    const sessionId = created.state.session.id;

    const a = await connect();
    const b = await connect();
    const outsider = await connect();
    const ackA = await joinRoom(a, sessionId);
    expect(ackA.ok).toBe(true);
    expect(ackA.state.session.code).toBe(created.state.session.code);
    await joinRoom(b, sessionId);

    let outsiderGotSomething = false;
    outsider.onAny(() => (outsiderGotSomething = true));

    // participant:joined
    const joinedA = nextEvent(a, 'participant:joined');
    const joinedB = nextEvent(b, 'participant:joined');
    const lucas = (await http_.post('/api/sessions/join').send({ code: created.state.session.code, name: 'Lucas' }).expect(200)).body;
    const [pa, pb] = await Promise.all([joinedA, joinedB]);
    expect(pa.actor).toBe('Lucas');
    expect(pb.state.participants).toHaveLength(2);

    // order:created — l'état diffusé reflète la base
    const created1 = nextEvent(b, 'order:created');
    await http_
      .post(`/api/sessions/${sessionId}/orders`)
      .set('X-Participant-Token', lucas.participantToken)
      .send({ targetName: 'Lucas', productType: 'SUCRE_PIQUANT', quantity: 2 })
      .expect(201);
    const oc = await created1;
    expect(oc.data).toMatchObject({ productType: 'SUCRE_PIQUANT', quantity: 2 });
    expect(oc.state.orders).toHaveLength(1);

    // order:updated / order:deleted
    const upd = nextEvent(a, 'order:updated');
    await http_.patch(`/api/orders/${oc.data.id}`).set('X-Participant-Token', lucas.participantToken).send({ quantity: 3 }).expect(200);
    expect((await upd).data.quantity).toBe(3);

    const del = nextEvent(a, 'order:deleted');
    await http_.delete(`/api/orders/${oc.data.id}`).set('X-Participant-Token', lucas.participantToken).expect(200);
    expect((await del).state.orders).toHaveLength(0);

    // session:closed
    const closedA = nextEvent(a, 'session:closed');
    const closedB = nextEvent(b, 'session:closed');
    await http_.post(`/api/sessions/${sessionId}/close`).set('X-Creator-Token', created.creatorToken).expect(200);
    const [ca, cb] = await Promise.all([closedA, closedB]);
    expect(ca.state.session.status).toBe('CLOSED');
    expect(cb.state.session.closedAt).toBeTruthy();

    // session:reopened
    const reo = nextEvent(b, 'session:reopened');
    await http_.post(`/api/sessions/${sessionId}/reopen`).set('X-Creator-Token', created.creatorToken).expect(200);
    expect((await reo).state.session.status).toBe('OPEN');

    // Aucun événement n'est envoyé hors de la room
    await new Promise((r) => setTimeout(r, 100));
    expect(outsiderGotSomething).toBe(false);
  });

  it("n'émet rien si l'opération est refusée (validation avant diffusion)", async () => {
    const http_ = request(http);
    const created = (
      await http_.post('/api/sessions').send({ type: 'CROUSTY', creatorName: 'Thomas', scheduledAt: inOneHour() }).expect(201)
    ).body;
    const a = await connect();
    await joinRoom(a, created.state.session.id);
    let received = false;
    a.onAny(() => (received = true));
    await http_.post(`/api/sessions/${created.state.session.id}/close`).set('X-Creator-Token', 'faux').expect(403);
    await new Promise((r) => setTimeout(r, 150));
    expect(received).toBe(false);
  });

  it('diffuse les participations Tacos / Kebab et le retrait', async () => {
    const http_ = request(http);
    const t = (
      await http_.post('/api/sessions').send({ type: 'TACOS_KEBAB', creatorName: 'Yanis', scheduledAt: inOneHour() }).expect(201)
    ).body;
    const a = await connect();
    await joinRoom(a, t.state.session.id);
    const up = nextEvent(a, 'participation:updated');
    await http_
      .post(`/api/sessions/${t.state.session.id}/participations`)
      .set('X-Participant-Token', t.participantToken)
      .send({ choice: 'KEBAB' })
      .expect(200);
    expect((await up).data.choice).toBe('KEBAB');
    const left = nextEvent(a, 'participant:left');
    await http_
      .delete(`/api/sessions/${t.state.session.id}/participations/${t.participantId}`)
      .set('X-Participant-Token', t.participantToken)
      .expect(200);
    expect((await left).data.name).toBe('Yanis');
  });

  it('refuse de rejoindre une room invalide et permet de récupérer l’état après reconnexion', async () => {
    const a = await connect();
    expect((await joinRoom(a, 'pas-un-uuid')).ok).toBe(false);
    expect((await joinRoom(a, '00000000-0000-4000-8000-000000000000')).ok).toBe(false);

    const http_ = request(http);
    const created = (
      await http_.post('/api/sessions').send({ type: 'CROUSTY', creatorName: 'Thomas', scheduledAt: inOneHour() }).expect(201)
    ).body;
    await joinRoom(a, created.state.session.id);
    a.disconnect();
    // Une commande arrive pendant la déconnexion…
    await http_
      .post(`/api/sessions/${created.state.session.id}/orders`)
      .set('X-Participant-Token', created.participantToken)
      .send({ targetName: 'Thomas', productType: 'NATURE', quantity: 1 })
      .expect(201);
    // …et le client la récupère en se reconnectant.
    a.connect();
    await new Promise<void>((r) => a.once('connect', () => r()));
    const ack = await joinRoom(a, created.state.session.id);
    expect(ack.state.orders).toHaveLength(1);
  });
});
