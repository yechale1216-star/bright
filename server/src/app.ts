import * as dotenv from 'dotenv';
import path from 'path';
// Choose .env location based on whether we are running compiled code (dist) or source (src)
const envPath = path.resolve(
  __dirname,
  process.env.NODE_ENV === 'production' ? '../../.env' : '../.env'
);
dotenv.config({ path: envPath });

// Validate critical environment variables
const requiredEnv = ['RESEND_API_KEY', 'APP_URL', 'DATABASE_URL'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`[EnvError] Missing required env vars: ${missingEnv.join(', ')}`);
  // Exit the process to avoid running in a broken state
  process.exit(1);
}

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import prisma from './config/db';
import studentRoutes from './routes/student.routes';
import attendanceRoutes from './routes/attendance.routes';
import schoolRoutes from './routes/school.routes';
import userRoutes from './routes/user.routes';
import assignmentRoutes from './routes/assignment.routes';
import settingsRoutes from './routes/settings.routes';
import parentRoutes from './routes/parent.routes';
import attendanceAnalyticsRoutes from './routes/attendance-analytics.routes';
import messageRoutes from './routes/message.routes';
import authRoutes from './routes/auth.routes';
import promotionRoutes from './routes/promotion.routes';
import groupRoutes from './routes/group.routes';
import announcementRoutes from './routes/announcement.routes';
import callRoutes from './routes/call.routes';
import notificationRoutes from './routes/notification.routes';
import savedMessagesRoutes from './routes/saved-messages.routes';
import disciplineRoutes from './routes/discipline.routes';
import rolesRoutes from './routes/roles.routes';
import academicYearRoutes from './routes/academic-year.routes';

import { authMiddleware } from './middleware/auth.middleware';
import { maintenanceMiddleware } from './middleware/maintenance.middleware';
import * as parentController from './controllers/parent.controller';
import { getActiveCall, deleteActiveCall, getUserSocketIds, getIO } from './socket';

const app = express();

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

app.use(compression());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, native apps, or curl requests)
    if (!origin) return callback(null, true);
    
    // Check allowlist
    const isAllowed = defaultAllowedOrigins.includes(origin) || 
                      origin.startsWith('http://localhost:') || 
                      origin.startsWith('http://127.0.0.1:') ||
                      // Local network origins only allowed outside production
                      (process.env.NODE_ENV !== 'production' && (
                        origin.startsWith('http://192.168.') ||
                        origin.startsWith('http://10.') ||
                        origin.startsWith('http://172.')
                      ));

    if (isAllowed || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-school-id', 'x-requested-role']
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Global Maintenance Guard
app.use(maintenanceMiddleware);

// Health check and Auth (Public)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});
app.use('/api/auth', authRoutes);

// Parent Login & Discovery are public (no token required)
// Define them explicitly to ensure they are handled before tenantMiddleware
const publicParentRouter = express.Router();
publicParentRouter.get('/schools', parentController.listParentSchools);
publicParentRouter.post('/login', parentController.loginParent);
app.use('/api/parent', publicParentRouter);

app.post('/api/calls/public-reject', async (req, res) => {
  const { callId, message } = req.body;
  if (!callId) {
    return res.status(400).json({ error: 'Missing callId' });
  }

  const call = await getActiveCall(callId);
  if (call) {
    await deleteActiveCall(callId, call.from, call.to);

    // Notify the caller if online (works across all server instances via Redis)
    const io = getIO();
    if (io) {
      const callerSocketIds = await getUserSocketIds(call.from);
      if (callerSocketIds.length > 0) {
        io.to(callerSocketIds).emit('call_rejected', { from: call.to });
      }
    }

    try {
      const callee = await prisma.user.findUnique({
        where: { id: call.to },
        select: { pushToken: true }
      });

      if (callee?.pushToken) {
        const { sendCallCancellation } = await import('./services/notification.service');
        await sendCallCancellation(callee.pushToken, callId);
      }

      // Create a "Declined Call" message in the database conversation
      const conversation = await prisma.conversation.findFirst({
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
        const msg = await prisma.message.create({
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
          const textMsg = await prisma.message.create({
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

          const callerUser = await prisma.user.findUnique({
            where: { id: call.from },
            select: { pushToken: true }
          });
          if (callerUser?.pushToken) {
            const { sendMessageNotification } = await import('./services/notification.service');
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
    } catch (err) {
      console.error('[PublicReject] Failed to log decline/message in DB:', err);
    }
  }

  res.status(200).json({ success: true });
});

// Apply Auth Middleware to all API routes
app.use('/api', authMiddleware);

// Other API routes are already covered by the /api middleware

// Routes
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/parent', parentRoutes); // Re-use for other parent routes
app.use('/api/attendance-analytics', attendanceAnalyticsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/saved-messages', savedMessagesRoutes);
app.use('/api/discipline', disciplineRoutes);
app.use('/api/roles', rolesRoutes);


// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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

export default app;
