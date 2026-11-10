import type { Request, Response } from 'express';
import { config } from '../config.js';
import { params, tokensOf } from '../middleware/index.js';
import type { CreateSessionInput } from '../schemas/index.js';
import * as sessions from '../services/session.service.js';
import { listLobbySessions } from '../services/lobby.service.js';

export async function getConfig(_req: Request, res: Response) {
  res.json({ croustyPhone: config.CROUSTY_PHONE });
}

export async function list(_req: Request, res: Response) {
  res.set('Cache-Control', 'no-store').json({ sessions: await listLobbySessions() });
}

export async function create(req: Request, res: Response) {
  const result = await sessions.createSession(req.body as CreateSessionInput);
  // creatorToken et participantToken ne sont renvoyés qu'ici, une seule fois, au créateur.
  res.status(201).json(result);
}

export async function getByCode(req: Request, res: Response) {
  const { code } = params<{ code: string }>(req);
  const id = await sessions.findActiveSessionIdByCode(code);
  const state = await sessions.getStateById(id);
  const isCreator = await sessions.verifyCreator(id, tokensOf(req).creatorToken);
  res.set('Cache-Control', 'no-store').json({ state, isCreator });
}

export async function join(req: Request, res: Response) {
  const { code, name, participantToken } = req.body as { code: string; name: string; participantToken?: string };
  const result = await sessions.joinSession(code, name, participantToken);
  res.status(200).json(result);
}

export async function close(req: Request, res: Response) {
  const { id } = params<{ id: string }>(req);
  const state = await sessions.closeSession(id, tokensOf(req).creatorToken);
  res.json({ state });
}

export async function reopen(req: Request, res: Response) {
  const { id } = params<{ id: string }>(req);
  const state = await sessions.reopenSession(id, tokensOf(req).creatorToken);
  res.json({ state });
}
