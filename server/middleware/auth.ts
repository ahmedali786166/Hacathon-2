/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbHelper } from '../db/database.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'hcm_lite_jwt_enterprise_secure_token_secret_saylani_2026';

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'HR' | 'EMPLOYEE';
  employeeId?: string | null;
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId || null,
      mustChangePassword: !!user.mustChangePassword
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      employeeId: decoded.employeeId || null,
      mustChangePassword: !!decoded.mustChangePassword
    };
  } catch {
    return null;
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  // Verify in database that user is active
  const user = dbHelper.queryOne<any>('SELECT id, email, role, is_active, must_change_password FROM users WHERE id = ?', [payload.id]);
  if (!user || user.is_active !== 1) {
    return res.status(401).json({ error: 'User account is inactive or not found.' });
  }

  // Retrieve employee record if employee
  let employeeId = payload.employeeId;
  if (!employeeId) {
    const emp = dbHelper.queryOne<any>('SELECT id FROM employees WHERE user_id = ?', [user.id]);
    if (emp) {
      employeeId = emp.id;
    }
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: employeeId || null,
    mustChangePassword: user.must_change_password === 1
  };

  next();
}

export function requireRole(allowedRoles: ('ADMIN' | 'HR' | 'EMPLOYEE')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden. Role '${req.user.role}' lacks permission for this action.`
      });
    }

    next();
  };
}
