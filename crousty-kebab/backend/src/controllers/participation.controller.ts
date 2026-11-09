import type { Request, Response } from 'express';
import { params, tokensOf } from '../middleware/index.js';
import type { ParticipationInput } from '../schemas/index.js';
import * as participations from '../services/participation.service.js';

export async function upsert(req: Request, res: Response) {
  const { id } = params<{ id: string }>(req);
  const result = await participations.upsertParticipation(id, req.body as ParticipationInput, tokensOf(req));
  res.status(200).json(result);
}

export async function remove(req: Request, res: Response) {
  const { id, participantId } = params<{ id: string; participantId: string }>(req);
  res.json(await participations.removeParticipation(id, participantId, tokensOf(req)));
}
