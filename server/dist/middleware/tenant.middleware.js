"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureGuard = exports.authorize = exports.tenantMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_resolution_service_1 = require("../services/auth_resolution.service");
const redis_1 = require("../redis");
const jwt_1 = require("../utils/jwt");
/**
 * Middleware to verify JWT and extract tenant information.
 * Every request must pass through this or a public route.
 */
const tenantMiddleware = async (req, res, next) => {
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
    let token;
    if (req.cookies && req.cookies.attendance_token) {
        token = req.cookies.attendance_token;
    }
    else if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    if (!token) {
        return res.status(401).json({ success: false, message: 'Authorization token required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, (0, jwt_1.getJwtSecret)());
        let schoolId = decoded.schoolId;
        let role = decoded.role;
        // Resolve context-specific role
        const activeSchoolId = schoolIdHeader || schoolId;
        let requestedRole = req.headers['x-requested-role'];
        if (!requestedRole) {
            if (url.startsWith('/api/parent')) {
                requestedRole = 'parent';
            }
            else if (url.startsWith('/api/teachers') || url.includes('/attendance-sessions')) {
                requestedRole = 'teacher';
            }
            else if (url.startsWith('/api/school/') || url.startsWith('/api/schools/') || url.startsWith('/api/settings')) {
                requestedRole = 'school_admin';
            }
        }
        if (activeSchoolId) {
            const cacheKey = `role:${decoded.id}:${activeSchoolId}:${requestedRole || ''}`;
            let contextRole = await (0, redis_1.cacheGet)(cacheKey);
            if (!contextRole) {
                contextRole = await (0, auth_resolution_service_1.resolveRoleInSchool)(decoded.id, activeSchoolId, requestedRole);
                if (contextRole) {
                    await (0, redis_1.cacheSetEx)(cacheKey, 300, contextRole); // 5 min TTL
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
    }
    catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};
exports.tenantMiddleware = tenantMiddleware;
/**
 * Role-based Access Control Middleware
 */
const authorize = (roles) => {
    return (req, res, next) => {
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
exports.authorize = authorize;
/**
 * Feature Guard (All features granted in Single-School Edition)
 */
const featureGuard = (_featureKey) => {
    return (_req, _res, next) => {
        next();
    };
};
exports.featureGuard = featureGuard;
