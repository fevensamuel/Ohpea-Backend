/**
 * Async-safe Express Router (Express 4)
 *
 * Express 4 does not catch rejected promises from async route handlers. Without this wrapper,
 * a single failed database query or null access inside any `async (req, res) => {}` handler
 * becomes an unhandled promise rejection, which crashes the Node process (Node >= 15) or leaves
 * the request hanging forever.
 *
 * `createAsyncRouter()` returns a normal express.Router whose route methods forward any thrown
 * error / rejected promise to `next(err)`, so the global JSON error handler in server.ts answers.
 */

import express, { Router, Request, Response, NextFunction } from 'express';

type AnyHandler = (req: Request, res: Response, next: NextFunction) => unknown;

const ROUTE_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function wrapHandler(fn: unknown): unknown {
  if (Array.isArray(fn)) return fn.map(wrapHandler);
  if (typeof fn !== 'function') return fn;

  // Error-handling middleware (err, req, res, next) must keep its 4-arg signature.
  if (fn.length === 4) return fn;

  const handler = fn as AnyHandler;
  return function asyncSafeHandler(req: Request, res: Response, next: NextFunction) {
    try {
      const result = handler(req, res, next);
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

export function createAsyncRouter(): Router {
  const router = express.Router();

  for (const method of ROUTE_METHODS) {
    const original = (router as any)[method].bind(router);
    (router as any)[method] = (path: unknown, ...handlers: unknown[]) =>
      original(path, ...handlers.map(wrapHandler));
  }

  return router;
}
