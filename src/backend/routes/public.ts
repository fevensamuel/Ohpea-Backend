import express, { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

import { query, mapRow, dbOperations } from '../database.js';
import { statsService } from '../../services/statsService.js';
import { emailService } from '../../services/emailService.js';
import { afroSmsService } from '../../services/afroSmsService.js';
import { otpService } from '../../services/otpService.js';
import { memberRegistrationUpload, calculateFileHash, PRIVATE_UPLOAD_PATH } from '../../config/multer.js';
import { customRateLimiter, validateBody } from '../middleware.js';
import { translations } from '../../translations.js';
import { SupportedLanguage } from '../../types.js';

function normalizeEthiopianPhone(phone: string): string {
  let clean = phone.replace(/[^0-9+]/g, '');
  if (clean.startsWith('09')) clean = '+251' + clean.slice(1);
  else if (clean.startsWith('07')) clean = '+251' + clean.slice(1);
  else if (clean.startsWith('9') && clean.length === 9) clean = '+251' + clean;
  else if (clean.startsWith('7') && clean.length === 9) clean = '+251' + clean;
  else if (clean.startsWith('251')) clean = '+' + clean;
  return clean;
}

export const publicRouter = express.Router();