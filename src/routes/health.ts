import { Router, Request, Response } from 'express';
import { query } from '../backend/database.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const startedAt = Date.now();
  let dbOk = false;
  try {
    await query('SELECT 1');
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const payload = {
    status: dbOk ? 'ok' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    db: dbOk ? 'ok' : 'unreachable',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
  };

  res.status(dbOk ? 200 : 503).json({ success: dbOk, data: payload });
});
