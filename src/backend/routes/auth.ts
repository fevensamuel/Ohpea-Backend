import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import {
  authenticateJWT,
  loadAdminContext,
  customRateLimiter,
  validateBody,
  getJwtSecret,
} from '../middleware.js';
import { dbOperations } from '../database.js';

export const authRouter = express.Router();

const loginSchema = z.object({
  usernameOrEmail: z.string().min(3),
  password: z.string().min(6),
});

const loginRateLimiter = customRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  keyGenerator: (req) => `login:${req.ip || '127.0.0.1'}`,
});

const handleLogin = async (req: Request, res: Response) => {
  const { usernameOrEmail, password } = req.body;
  const admin = await dbOperations.getAdminByUsernameOrEmail(usernameOrEmail);

  if (!admin) {
    await dbOperations.createAuditLog({
      action: 'auth.login_failed',
      entity: 'admin_users',
      before: { identifier: usernameOrEmail },
      ip: req.ip,
    });
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  if (!admin.isActive) {
    return res.status(403).json({ success: false, error: 'Your administrator account has been deactivated.' });
  }

  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) {
    await dbOperations.createAuditLog({
      adminId: admin.id,
      action: 'auth.login_failed_password',
      entity: 'admin_users',
      entityId: admin.id,
      ip: req.ip,
    });
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  await dbOperations.updateAdminLastLogin(admin.id);

  const tokenPayload = {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    permissions: admin.permissions || [],
    regionId: admin.regionId,
  };

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: expiresIn as any });

  await dbOperations.createAuditLog({
    adminId: admin.id,
    action: 'auth.login_success',
    entity: 'admin_users',
    entityId: admin.id,
    ip: req.ip,
  });

  return res.json({
    success: true,
    data: {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
        regionId: admin.regionId,
        mustChangePassword: admin.mustChangePassword,
      },
    },
  });
};

authRouter.post('/auth/login', loginRateLimiter, validateBody(loginSchema), handleLogin);
authRouter.post('/admin/login', loginRateLimiter, validateBody(loginSchema), handleLogin);

authRouter.get('/auth/me', authenticateJWT, loadAdminContext, (req, res) => {
  return res.json({ success: true, data: req.admin });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

authRouter.post(
  '/auth/change-password',
  authenticateJWT,
  loadAdminContext,
  validateBody(changePasswordSchema),
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const admin = await dbOperations.getAdminById(req.admin!.id);

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password does not match' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await dbOperations.changeAdminPassword(admin.id, newHash);

    await dbOperations.createAuditLog({
      adminId: admin.id,
      action: 'auth.password_changed',
      entity: 'admin_users',
      entityId: admin.id,
      ip: req.ip,
    });

    return res.json({ success: true, message: 'Password changed successfully' });
  }
);

authRouter.post('/auth/logout', authenticateJWT, async (req, res) => {
  if (req.user) {
    await dbOperations.createAuditLog({
      adminId: req.user.id,
      action: 'auth.logout',
      entity: 'admin_users',
      entityId: req.user.id,
      ip: req.ip,
    });
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});