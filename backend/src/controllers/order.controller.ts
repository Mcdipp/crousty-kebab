import type { Request, Response } from 'express';
import { params, tokensOf } from '../middleware/index.js';
import type { CreateOrderInput, UpdateOrderInput } from '../schemas/index.js';
import * as orders from '../services/order.service.js';

export async function list(req: Request, res: Response) {
  const { id } = params<{ id: string }>(req);
  res.set('Cache-Control', 'no-store').json({ orders: await orders.listOrders(id) });
}

export async function create(req: Request, res: Response) {
  const { id } = params<{ id: string }>(req);
  const result = await orders.createOrder(id, req.body as CreateOrderInput, tokensOf(req));
  res.status(201).json(result);
}

export async function update(req: Request, res: Response) {
  const { id } = params<{ id: string }>(req);
  res.json(await orders.updateOrder(id, req.body as UpdateOrderInput, tokensOf(req)));
}

export async function remove(req: Request, res: Response) {
  const { id } = params<{ id: string }>(req);
  res.json(await orders.deleteOrder(id, tokensOf(req)));
}
