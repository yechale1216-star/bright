import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import jwt from 'jsonwebtoken';
import { resolveRoleInSchool } from '../services/auth_resolution.service';
import { cacheGet, cacheSetEx, cacheDel } from '../redis';
import { getJwtSecret } from '../utils/jwt';
import { getSingleSchool } from '../services/school.service';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware to verify JWT and extract user context in Single-School mode.
 */
export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  // Public routes exclusion
  const publicPaths = [
    '/api/parent/schools',
    '/api/parent/login',
    '/api/auth',
    '/health'
  ];

  const url = req.originalUrl.split('?')[0];
  if (publicPaths.some(path => url.startsWith(path))) {
    return next();
  }

  let token: string | undefined;

  if (req.cookies && req.cookies.attendance_token) {
    token = req.cookies.attendance_token;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    let role = decoded.role;

    let requestedRole = req.headers['x-requested-role'] as string | undefined;

    if (!requestedRole) {
      if (url.startsWith('/api/parent')) {
        requestedRole = 'parent';
      } else if (url.startsWith('/api/teachers') || url.includes('/attendance-sessions')) {
        requestedRole = 'teacher';
      } else if (url.startsWith('/api/staff') || url.startsWith('/school/staff')) {
        requestedRole = 'staff';
      } else if (url.startsWith('/api/school/') || url.startsWith('/api/schools/') || url.startsWith('/api/settings')) {
        requestedRole = 'school_admin';
      }
    }

    const cacheKey = `role:${decoded.id}:${requestedRole || ''}`;
    let contextRole = await cacheGet(cacheKey);

    if (!contextRole) {
      contextRole = await resolveRoleInSchool(decoded.id, undefined, requestedRole);
      if (contextRole) {
        await cacheSetEx(cacheKey, 300, contextRole);
      }
    }

    if (contextRole) {
      role = contextRole;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: role || decoded.role,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/** @deprecated Alias for authMiddleware in Single-School Edition */
export const tenantMiddleware = authMiddleware;

/**
 * Role-based Access Control Middleware
 */
export const authorize = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Forbidden: You do not have permission to access this resource' 
      });
    }

    next();
  };
};

/**
 * Feature Guard (All features granted in Single-School Edition)
 */
export const featureGuard = (_featureKey: string) => {
  return (_req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    next();
  };
};
