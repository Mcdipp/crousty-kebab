import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

export const app = createApp();
export const api = () => request(app);

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Order", "Participation", "Participant", "Session" RESTART IDENTITY CASCADE',
  );
}

export const inOneHour = () => new Date(Date.now() + 3_600_000).toISOString();

export async function createCrousty(creatorName = 'Thomas') {
  const res = await api()
    .post('/api/sessions')
    .send({ type: 'CROUSTY', creatorName, scheduledAt: inOneHour(), description: 'Soirée match' })
    .expect(201);
  return res.body as {
    state: any;
    participantId: string;
    participantToken: string;
    creatorToken: string;
  };
}

export async function createTacos(foodChoice: 'TACOS' | 'KEBAB' | 'BOTH' = 'BOTH', creatorName = 'Yanis') {
  const res = await api()
    .post('/api/sessions')
    .send({ type: 'TACOS_KEBAB', creatorName, scheduledAt: inOneHour(), foodChoice })
    .expect(201);
  return res.body as { state: any; participantId: string; participantToken: string; creatorToken: string };
}

export async function join(code: string, name: string) {
  const res = await api().post('/api/sessions/join').send({ code, name }).expect(200);
  return res.body as { state: any; participantId: string; participantToken: string };
}
