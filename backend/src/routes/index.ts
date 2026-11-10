import { Router } from 'express';
import * as sessionCtrl from '../controllers/session.controller.js';
import * as orderCtrl from '../controllers/order.controller.js';
import * as participationCtrl from '../controllers/participation.controller.js';
import { createLimiter, validate } from '../middleware/index.js';
import {
  codeParams,
  createOrderSchema,
  createSessionSchema,
  joinSessionSchema,
  participationParams,
  participationSchema,
  sessionIdParams,
  updateOrderSchema,
} from '../schemas/index.js';
import { prisma } from '../db.js';

export const router = Router();

router.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});

router.get('/config', sessionCtrl.getConfig);

// Sessions
router.get('/sessions', sessionCtrl.list);
router.post('/sessions', createLimiter, validate({ body: createSessionSchema }), sessionCtrl.create);
router.post('/sessions', createLimiter, validate({ body: createSessionSchema }), sessionCtrl.create);
router.post('/sessions/join', validate({ body: joinSessionSchema }), sessionCtrl.join);
router.get('/sessions/:code', validate({ params: codeParams }), sessionCtrl.getByCode);
router.post('/sessions/:id/close', validate({ params: sessionIdParams }), sessionCtrl.close);
router.post('/sessions/:id/reopen', validate({ params: sessionIdParams }), sessionCtrl.reopen);

// Commandes Crousty
router.get('/sessions/:id/orders', validate({ params: sessionIdParams }), orderCtrl.list);
router.post(
  '/sessions/:id/orders',
  validate({ params: sessionIdParams, body: createOrderSchema }),
  orderCtrl.create,
);
router.patch('/orders/:id', validate({ params: sessionIdParams, body: updateOrderSchema }), orderCtrl.update);
router.delete('/orders/:id', validate({ params: sessionIdParams }), orderCtrl.remove);

// Participations Tacos / Kebab
router.post(
  '/sessions/:id/participations',
  validate({ params: sessionIdParams, body: participationSchema }),
  participationCtrl.upsert,
);
router.delete(
  '/sessions/:id/participations/:participantId',
  validate({ params: participationParams }),
  participationCtrl.remove,
);
