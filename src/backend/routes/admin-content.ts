import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';

import {
  authenticateJWT,
  loadAdminContext,
  requirePermission,
  requireRegionScope,
  validateBody,
} from '../middleware.js';
import { query, mapRow, dbOperations } from '../database.js';
import { statsService } from '../../services/statsService.js';
import { emailService } from '../../services/emailService.js';
import { afroSmsService } from '../../services/afroSmsService.js';
import { exportService } from '../../services/exportService.js';
import { SupportedLanguage } from '../../types.js';

export const adminContentRouter = express.Router();

const adminAuthChain = [authenticateJWT, loadAdminContext];