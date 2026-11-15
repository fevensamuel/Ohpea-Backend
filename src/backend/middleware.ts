/**
 * Authentication, Authorization, RBAC, Rate Limiting, and Validation Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ZodSchema, ZodError } from 'zod';
import { dbOperations } from './database.js';
import { AuthUser } from '../types.js';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Fatal Security Error: JWT_SECRET must be configured and be at least 32 characters long.');
  }
  return secret;
}

/**
 * Verify JWT Bearer token and attach payload to req.user
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing or malformed authorization token',
    });
  }

  const token = authHeader.substring(7).trim();

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired token',
    });
  }
}

/**
 * Re-read admin user from DB on every request so deactivations and permission changes apply immediately
 */
export async function loadAdminContext(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, error: 'Unauthorized: User context missing' });
  }

  try {
    const admin = await dbOperations.getAdminById(req.user.id);
    if (!admin) {
      return res.status(401).json({ success: false, error: 'User record no longer exists' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, error: 'Account has been deactivated. Please contact SuperAdmin.' });
    }

    req.admin = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      permissions: admin.permissions || [],
      regionId: admin.regionId,
      mustChangePassword: admin.mustChangePassword,
    };

    next();
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to verify admin context' });
  }
}

/**
 * Enforce SuperAdmin role
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.admin) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (req.admin.role !== 'SuperAdmin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: SuperAdmin privileges required',
    });
  }

  next();
}

/**
 * Enforce specific permission key. SuperAdmin always bypasses.
 */
export function requirePermission(permissionKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (req.admin.role === 'SuperAdmin') {
      return next();
    }

    if (!req.admin.permissions.includes(permissionKey)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Missing required permission '${permissionKey}'`,
      });
    }

    next();
  };
}

/**
 * Enforce regional scoping: If RegionalAdmin, override or restrict regionId to their assigned region.
 */
export function requireRegionScope(req: Request, res: Response, next: NextFunction) {
  if (req.admin?.role === 'RegionalAdmin') {
    if (!req.admin.regionId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: RegionalAdmin has no region assigned',
      });
    }
    // Inject into query/body to prevent cross-region data leaks
    req.query.regionId = req.admin.regionId;
    if (req.body && typeof req.body === 'object') {
      req.body.regionId = req.admin.regionId;
    }
  }
  next();
}

/**
 * Custom memory-based sliding window rate limiter
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitRecord>();

export function customRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, max, message = 'Too many requests. Please try again later.' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // In dev/test environments, grant headroom for rapid developer reloads and smoke testing
    const effectiveMax = process.env.NODE_ENV === 'production' ? max : Math.max(max, 100);

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : `${req.ip || '127.0.0.1'}:${req.baseUrl || req.path}`;

    const now = Date.now();
    const existing = rateLimitBuckets.get(key);

    if (!existing || now > existing.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > effectiveMax) {
      res.setHeader('Retry-After', Math.ceil((existing.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: message,
      });
    }

    next();
  };
}

/**
 * Zod Body Validation Middleware
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formattedFields: Record<string, string> = {};
      const err = result.error as ZodError;
      for (const issue of err.issues) {
        const fieldName = issue.path.join('.') || 'body';
        formattedFields[fieldName] = issue.message;
      }
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: formattedFields,
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Zod Query Validation Middleware
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const formattedFields: Record<string, string> = {};
      const err = result.error as ZodError;
      for (const issue of err.issues) {
        const fieldName = issue.path.join('.') || 'query';
        formattedFields[fieldName] = issue.message;
      }
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: formattedFields,
      });
    }
    req.query = result.data as any;
    next();
  };
}
