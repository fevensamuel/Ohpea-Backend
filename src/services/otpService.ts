/**
 * OTP Service for Email/SMS verification
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { emailService } from './emailService.js';
import { afroSmsService } from './afroSmsService.js';
import { SupportedLanguage } from '../types.js';

const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

interface OtpMemoryEntry {
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  verifiedAt: Date | null;
  requestCount: number;
  windowStart: number;
}

const memoryStore = new Map<string, OtpMemoryEntry>();

export class OtpService {
  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    return secret;
  }

  public async requestOtp(
    email: string,
    phone?: string,
    ip: string = '127.0.0.1',
    lang: SupportedLanguage = 'en'
  ): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
    const normalizedEmail = email.toLowerCase().trim();
    const now = Date.now();

    const existing = memoryStore.get(normalizedEmail);
    if (existing) {
      if (now - existing.windowStart < 3600 * 1000) {
        if (existing.requestCount >= 3) {
          return {
            success: false,
            error: 'Maximum OTP request limit reached (3 per hour). Please try again later.',
          };
        }
        existing.requestCount += 1;
      } else {
        existing.windowStart = now;
        existing.requestCount = 1;
      }
    } else {
      memoryStore.set(normalizedEmail, {
        email: normalizedEmail,
        codeHash: '',
        expiresAt: new Date(now + OTP_TTL_MINUTES * 60 * 1000),
        attempts: 0,
        verifiedAt: null,
        requestCount: 1,
        windowStart: now,
      });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(code, salt);

    const record = memoryStore.get(normalizedEmail)!;
    record.codeHash = codeHash;
    record.expiresAt = new Date(now + OTP_TTL_MINUTES * 60 * 1000);
    record.attempts = 0;
    record.verifiedAt = null;

    // Send email
    await emailService.sendOtpEmail(normalizedEmail, code, OTP_TTL_MINUTES, lang);

    // If phone is provided and SMS feature is enabled, dispatch SMS
    if (phone && process.env.FEATURE_SMS === 'true') {
      await afroSmsService.sendSms(phone, `OHPEA: Your verification code is ${code}. Valid for ${OTP_TTL_MINUTES} min.`);
    }

    return { success: true };
  }

  public async verifyOtp(
    email: string,
    code: string
  ): Promise<{ success: boolean; otpToken?: string; error?: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const record = memoryStore.get(normalizedEmail);

    if (!record) {
      return { success: false, error: 'No active OTP request found for this email.' };
    }

    if (Date.now() > record.expiresAt.getTime()) {
      return { success: false, error: 'Verification code has expired. Please request a new one.' };
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return { success: false, error: 'Too many incorrect attempts. Please request a new code.' };
    }

    record.attempts += 1;
    const isValid = await bcrypt.compare(code.trim(), record.codeHash);

    if (!isValid) {
      const remaining = OTP_MAX_ATTEMPTS - record.attempts;
      return {
        success: false,
        error: `Incorrect verification code. ${remaining} attempts remaining.`,
      };
    }

    record.verifiedAt = new Date();

    const otpToken = jwt.sign(
      { email: normalizedEmail, purpose: 'registration_otp', verified: true },
      this.getJwtSecret(),
      { expiresIn: '15m' }
    );

    return { success: true, otpToken };
  }

  public verifyOtpToken(token: string, expectedEmail: string): boolean {
    try {
      const decoded: any = jwt.verify(token, this.getJwtSecret());
      return decoded.purpose === 'registration_otp' && decoded.email === expectedEmail.toLowerCase().trim();
    } catch {
      return false;
    }
  }
}

export const otpService = new OtpService();
