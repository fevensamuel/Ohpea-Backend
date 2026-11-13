import express from 'express';
import { customRateLimiter } from './middleware.js';

import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { adminMembersRouter } from './routes/admin-members.js';
import { adminContentRouter } from './routes/admin-content.js';
import { adminSystemRouter } from './routes/admin-system.js';

export const apiRouter = express.Router();

// Global API rate limiter: 300 requests per 15 minutes
apiRouter.use(
  customRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'Global API rate limit exceeded. Please wait a few moments.',
  })
);

// Mount sub-routers. Order matters for overlapping paths.
apiRouter.use('/', authRouter);
apiRouter.use('/', publicRouter);
apiRouter.use('/', adminMembersRouter);
apiRouter.use('/', adminContentRouter);
apiRouter.use('/', adminSystemRouter);