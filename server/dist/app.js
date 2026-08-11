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
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Choose .env location based on whether we are running compiled code (dist) or source (src)
const envPath = path_1.default.resolve(__dirname, process.env.NODE_ENV === 'production' ? '../../.env' : '../.env');
dotenv.config({ path: envPath });
// Validate critical environment variables
const requiredEnv = ['RESEND_API_KEY', 'APP_URL', 'DATABASE_URL'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`[EnvError] Missing required env vars: ${missingEnv.join(', ')}`);
    // Exit the process to avoid running in a broken state
    process.exit(1);
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const db_1 = __importDefault(require("./config/db"));
const student_routes_1 = __importDefault(require("./routes/student.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const school_routes_1 = __importDefault(require("./routes/school.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const assignment_routes_1 = __importDefault(require("./routes/assignment.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const parent_routes_1 = __importDefault(require("./routes/parent.routes"));
const attendance_analytics_routes_1 = __importDefault(require("./routes/attendance-analytics.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const promotion_routes_1 = __importDefault(require("./routes/promotion.routes"));
const group_routes_1 = __importDefault(require("./routes/group.routes"));
const announcement_routes_1 = __importDefault(require("./routes/announcement.routes"));
const call_routes_1 = __importDefault(require("./routes/call.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const saved_messages_routes_1 = __importDefault(require("./routes/saved-messages.routes"));
const discipline_routes_1 = __importDefault(require("./routes/discipline.routes"));
const roles_routes_1 = __importDefault(require("./routes/roles.routes"));
const academic_year_routes_1 = __importDefault(require("./routes/academic-year.routes"));
const auth_middleware_1 = require("./middleware/auth.middleware");
const maintenance_middleware_1 = require("./middleware/maintenance.middleware");
const parentController = __importStar(require("./controllers/parent.controller"));
const socket_1 = require("./socket");
const app = (0, express_1.default)();
// Middleware
const defaultAllowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'https://zetime.pro.et',
    'https://www.zetime.pro.et',
    'https://zetime.vercel.app',
    'https://zetime.app',
    'capacitor://localhost',
    'https://localhost'
];
if (process.env.FRONTEND_URL) {
    defaultAllowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}
if (process.env.APP_URL) {
    defaultAllowedOrigins.push(process.env.APP_URL.replace(/\/$/, ''));
}
if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(o => defaultAllowedOrigins.push(o.trim().replace(/\/$/, '')));
}
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, native apps, or curl requests)
        if (!origin)
            return callback(null, true);
        // Check allowlist
        const isAllowed = defaultAllowedOrigins.includes(origin) ||
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            // Local network origins only allowed outside production
            (process.env.NODE_ENV !== 'production' && (origin.startsWith('http://192.168.') ||
                origin.startsWith('http://10.') ||
                origin.startsWith('http://172.')));
        if (isAllowed || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        }
        else {
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-school-id', 'x-requested-role']
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '5mb' }));
app.use(express_1.default.urlencoded({ limit: '5mb', extended: true }));
// Global Maintenance Guard
app.use(maintenance_middleware_1.maintenanceMiddleware);
// Health check and Auth (Public)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});
app.use('/api/auth', auth_routes_1.default);
// Parent Login & Discovery are public (no token required)
// Define them explicitly to ensure they are handled before tenantMiddleware
const publicParentRouter = express_1.default.Router();
publicParentRouter.get('/schools', parentController.listParentSchools);
publicParentRouter.post('/login', parentController.loginParent);
app.use('/api/parent', publicParentRouter);
app.post('/api/calls/public-reject', async (req, res) => {
    const { callId, message } = req.body;
    if (!callId) {
        return res.status(400).json({ error: 'Missing callId' });
    }
    const call = await (0, socket_1.getActiveCall)(callId);
    if (call) {
        await (0, socket_1.deleteActiveCall)(callId, call.from, call.to);
        // Notify the caller if online (works across all server instances via Redis)
        const io = (0, socket_1.getIO)();
        if (io) {
            const callerSocketIds = await (0, socket_1.getUserSocketIds)(call.from);
            if (callerSocketIds.length > 0) {
                io.to(callerSocketIds).emit('call_rejected', { from: call.to });
            }
        }
        try {
            const callee = await db_1.default.user.findUnique({
                where: { id: call.to },
                select: { pushToken: true }
            });
            if (callee?.pushToken) {
                const { sendCallCancellation } = await Promise.resolve().then(() => __importStar(require('./services/notification.service')));
                await sendCallCancellation(callee.pushToken, callId);
            }
            // Create a "Declined Call" message in the database conversation
            const conversation = await db_1.default.conversation.findFirst({
                where: {
                    isGroup: false,
                    members: {
                        every: {
                            userId: { in: [call.from, call.to] }
                        }
                    }
                },
                select: { id: true, schoolId: true }
            });
            if (conversation) {
                const msg = await db_1.default.message.create({
                    data: {
                        conversationId: conversation.id,
                        senderId: call.to, // the person who declined
                        schoolId: conversation.schoolId,
                        content: 'Declined Call',
                        type: call.type === 'VIDEO' ? 'CALL_MISSED_VIDEO' : 'CALL_MISSED_VOICE',
                        metadata: { reason: 'DECLINED' }
                    }
                });
                if (io) {
                    io.to(conversation.id).emit('new_message', msg);
                }
                // If a message was sent as a rejection response, save and broadcast it
                if (message && typeof message === 'string' && message.trim().length > 0) {
                    const textMsg = await db_1.default.message.create({
                        data: {
                            conversationId: conversation.id,
                            senderId: call.to,
                            schoolId: conversation.schoolId,
                            content: message,
                            type: 'TEXT'
                        },
                        include: { sender: { select: { id: true, full_name: true, profile_photo: true } } }
                    });
                    if (io) {
                        io.to(conversation.id).emit('new_message', textMsg);
                    }
                    const callerUser = await db_1.default.user.findUnique({
                        where: { id: call.from },
                        select: { pushToken: true }
                    });
                    if (callerUser?.pushToken) {
                        const { sendMessageNotification } = await Promise.resolve().then(() => __importStar(require('./services/notification.service')));
                        await sendMessageNotification(callerUser.pushToken, {
                            conversationId: conversation.id,
                            senderId: call.to,
                            senderName: textMsg.sender.full_name,
                            senderAvatar: textMsg.sender.profile_photo || '',
                            messagePreview: textMsg.content || '',
                            messageType: 'TEXT',
                        });
                    }
                }
            }
        }
        catch (err) {
            console.error('[PublicReject] Failed to log decline/message in DB:', err);
        }
    }
    res.status(200).json({ success: true });
});
// Apply Auth Middleware to all API routes
app.use('/api', auth_middleware_1.authMiddleware);
// Other API routes are already covered by the /api middleware
// Routes
app.use('/api/students', student_routes_1.default);
app.use('/api/attendance', attendance_routes_1.default);
app.use('/api/schools', school_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/assignments', assignment_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/parent', parent_routes_1.default); // Re-use for other parent routes
app.use('/api/attendance-analytics', attendance_analytics_routes_1.default);
app.use('/api/messages', message_routes_1.default);
app.use('/api/groups', group_routes_1.default);
app.use('/api/promotions', promotion_routes_1.default);
app.use('/api/academic-years', academic_year_routes_1.default);
app.use('/api/announcements', announcement_routes_1.default);
app.use('/api/calls', call_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/saved-messages', saved_messages_routes_1.default);
app.use('/api/discipline', discipline_routes_1.default);
app.use('/api/roles', roles_routes_1.default);
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    // Prisma Error Handling
    if (err.code === 'P2002') {
        return res.status(409).json({
            success: false,
            message: 'A record with this unique value already exists.',
            details: err.meta,
        });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({
            success: false,
            message: 'Record not found.',
        });
    }
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});
exports.default = app;
