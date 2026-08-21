"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const app_1 = __importDefault(require("./app"));
const socket_1 = require("./socket");
const redis_1 = require("./redis");
const PORT = Number(process.env.PORT) || 5000;
const httpServer = (0, http_1.createServer)(app_1.default);
// Prevent hanging requests and gateway races behind reverse proxies
httpServer.requestTimeout = 30000; // 30s max request handling time
httpServer.headersTimeout = 31000; // Must be greater than requestTimeout
httpServer.keepAliveTimeout = 65000; // > 60s for Cloudflare/ALB/Render keep-alive
async function start() {
    // 1. Connect Redis (gracefully falls back if unavailable — socket still works on single instance)
    await (0, redis_1.connectRedis)();
    // 2. Initialize Socket.IO (with Redis adapter already attached inside initSocket)
    (0, socket_1.initSocket)(httpServer);
    // 3. Start HTTP server
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
    });
    // 4. Periodic Automatic Absence Processing (Every 5 minutes)
    const ABSENCE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
    setInterval(async () => {
        try {
            const { processAutomaticStaffAbsences } = await Promise.resolve().then(() => __importStar(require('./services/staff-attendance.service')));
            const result = await processAutomaticStaffAbsences();
            if (result.markedAbsent > 0) {
                console.log(`[AutoAbsenceWorker] Processed absences: marked ${result.markedAbsent} staff as absent.`);
            }
        }
        catch (err) {
            console.warn('[AutoAbsenceWorker] Error in background absence processing:', err);
        }
    }, ABSENCE_CHECK_INTERVAL_MS);
}
start().catch((err) => {
    console.error('[startup] Fatal error:', err);
    process.exit(1);
});
