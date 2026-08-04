"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maintenanceMiddleware = void 0;
const db_1 = __importDefault(require("../config/db"));
const jwt_1 = require("../utils/jwt");
/**
 * Global Maintenance Middleware
 */
const maintenanceMiddleware = async (req, res, next) => {
    try {
        const config = await db_1.default.platformConfig?.findUnique({
            where: { id: "singleton" }
        });
        if (!config || !config.maintenanceMode) {
            return next();
        }
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            try {
                const token = authHeader.split(" ")[1];
                const decoded = (0, jwt_1.verifyToken)(token);
                if (decoded && (decoded.role === "admin" || decoded.role === "school_admin")) {
                    return next();
                }
            }
            catch (err) {
                // invalid token
            }
        }
        return res.status(503).json({
            success: false,
            maintenance: true,
            message: config.maintenanceMessage || "System is currently undergoing maintenance. Please try again later.",
            retryAfter: 3600
        });
    }
    catch (e) {
        next();
    }
};
exports.maintenanceMiddleware = maintenanceMiddleware;
