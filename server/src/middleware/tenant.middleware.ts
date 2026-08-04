import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import jwt from 'jsonwebtoken';
import { resolveRoleInSchool } from '../services/auth_resolution.service';
import { cacheGet, cacheSetEx, cacheDel } from '../redis';
import { getJwtSecret } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    schoolId: string; // The internal UUID used for filtering
    customSchoolId?: string; // The SCH-XXXX ID
  };
}

/**
 * Middleware to verify JWT and extract tenant information.
 * Every request must pass through this or a public route.
 */
export const tenantMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const schoolIdHeader = req.headers['x-school-id'];

  // Public routes exclusion
  const publicPaths = [
    '/api/parent/schools',
    '/api/parent/login',
    '/api/auth',
    '/health'
  ];

  const url = req.originalUrl.split('?')[0]; // strip query string for comparison
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
    
    let schoolId = decoded.schoolId;
    let role = decoded.role;

    // Resolve context-specific role
    const activeSchoolId = (schoolIdHeader as string) || schoolId;
    let requestedRole = req.headers['x-requested-role'] as string | undefined;

    if (!requestedRole) {
      if (url.startsWith('/api/parent')) {
        requestedRole = 'parent';
      } else if (url.startsWith('/api/teachers') || url.includes('/attendance-sessions')) {
        requestedRole = 'teacher';
      } else if (url.startsWith('/api/school/') || url.startsWith('/api/schools/') || url.startsWith('/api/settings')) {
        requestedRole = 'school_admin';
      }
    }

    if (activeSchoolId) {
      const cacheKey = `role:${decoded.id}:${activeSchoolId}:${requestedRole || ''}`;
      let contextRole = await cacheGet(cacheKey);

      if (!contextRole) {
        contextRole = await resolveRoleInSchool(decoded.id, activeSchoolId, requestedRole);
        if (contextRole) {
          await cacheSetEx(cacheKey, 300, contextRole); // 5 min TTL
        }
      }

      if (contextRole) {
        schoolId = activeSchoolId;
        role = contextRole;
      }
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: role,
      schoolId: schoolId,
      customSchoolId: decoded.customSchoolId,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

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

/** Call this after a school status change */
export const invalidateSchoolStatusCache = async (schoolId: string) => {
  await cacheDel(`substatus:${schoolId}`);
};

/**
 * Subscription Guard (Pass-through in Single-School Edition)
 */
export const subscriptionGuard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  next();
};

/**
 * Feature Guard (All features granted in Single-School Edition)
 */
export const featureGuard = (featureKey: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    next();
  };
};
