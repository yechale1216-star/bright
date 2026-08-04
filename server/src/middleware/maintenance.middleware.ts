import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { verifyToken } from "../utils/jwt";

/**
 * Global Maintenance Middleware
 */
export const maintenanceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await (prisma as any).platformConfig?.findUnique({
      where: { id: "singleton" }
    });

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
