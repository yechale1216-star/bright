import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { verifyToken } from "../utils/jwt";

let cachedConfig: any = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

export const invalidateMaintenanceCache = () => {
  cachedConfig = null;
  cacheExpiry = 0;
};

/**
 * Global Maintenance Middleware with in-memory caching to avoid remote DB round-trips on every request.
 */
export const maintenanceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Fast path for health check
  if (req.path === '/health' || req.originalUrl === '/health') {
    return next();
  }

  try {
    const now = Date.now();
    let config = cachedConfig;

    if (!config || now > cacheExpiry) {
      try {
        config = await (prisma as any).platformConfig?.findUnique({
          where: { id: "singleton" }
        });
        cachedConfig = config || { maintenanceMode: false };
        cacheExpiry = now + CACHE_TTL_MS;
      } catch (dbErr) {
        // If DB fails, don't block requests
        cachedConfig = { maintenanceMode: false };
        cacheExpiry = now + 10_000;
        return next();
      }
    }

    if (!config || !config.maintenanceMode) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token);
        if (decoded && (decoded.role === "admin" || decoded.role === "school_admin")) {
          return next();
        }
      } catch (err) {
        // invalid token
      }
    }

    return res.status(503).json({
      success: false,
      maintenance: true,
      message: config.maintenanceMessage || "System is currently undergoing maintenance. Please try again later.",
      retryAfter: 3600
    });
  } catch (e) {
    next();
  }
};

