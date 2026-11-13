import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';

import {
  authenticateJWT,
  loadAdminContext,
  requireSuperAdmin,
  requirePermission,
  validateBody,
} from '../middleware.js';
import { query, mapRow, dbOperations } from '../database.js';
import { afroSmsService } from '../../services/afroSmsService.js';
import { smsCampaignService } from '../../services/smsCampaignService.js';

export const adminSystemRouter = express.Router();

const adminAuthChain = [authenticateJWT, loadAdminContext];