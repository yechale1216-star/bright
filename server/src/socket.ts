import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { sendCallNotification, sendCallCancellation, sendMessageNotification } from './services/notification.service';
import { logCall } from './services/call.service';
import { pubClient, subClient, isRedisAvailable } from './redis';
import { getJwtSecret } from './utils/jwt';
import prisma from './config/db';

// ─────────────────────────────────────────────────────────────────────────────
// Redis key helpers
// ─────────────────────────────────────────────────────────────────────────────
const KEY = {
  userSockets:  (uid: string)    => `sockets:user:${uid}`,
  socketData:   (sid: string)    => `sockets:data:${sid}`,
  userSchool:   (uid: string)    => `sockets:school:${uid}`,
  onlineUsers:  (schoolId: string) => `online:${schoolId}`,
  activeCall:   (callId: string) => `calls:${callId}`,
  userInCall:   (uid: string)    => `calls:user:${uid}`,
  schoolStatus: (sid: string)    => `cache:school:${sid}`,
  userInfo:     (uid: string)    => `cache:user:${uid}`,
  convSchool:   (cid: string)    => `cache:conv:${cid}`,
  convMembers:  (cid: string)    => `cache:members:${cid}`,
  tempId:       (key: string)    => `dedup:${key}`,
};

const TTL = {
  schoolStatus: 5 * 60,
  userInfo:     5 * 60,
  convSchool:   5 * 60,
  convMembers:  60,
  tempId:       60,
  activeCall:   60,
  socketData:   12 * 3600,
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory fallback state (used when Redis is unavailable)
// ─────────────────────────────────────────────────────────────────────────────
const memUserSockets  = new Map<string, Set<string>>();            // userId → Set<socketId>
const memSocketData   = new Map<string, { userId: string; schoolId: string }>();
const memUserSchool   = new Map<string, string>();
const memOnlineUsers  = new Map<string, Set<string>>();            // schoolId → Set<userId>
const memActiveCalls  = new Map<string, any>();                    // callId → call data
const memUserInCall   = new Map<string, string>();                 // userId → callId
const memSchoolStatus = new Map<string, { status: string; expires: number }>();
const memUserInfo     = new Map<string, { data: any; expires: number }>();
const memConvSchool   = new Map<string, { schoolId: string; expires: number }>();
const memConvMembers  = new Map<string, { memberIds: string[]; expires: number }>();
const memTempIds      = new Map<string, { messageId: string; expires: number }>();

// ─────────────────────────────────────────────────────────────────────────────
// Local store for NodeJS.Timeout handles (cannot be stored in Redis)
// ─────────────────────────────────────────────────────────────────────────────
const localTimeoutHandles = new Map<string, NodeJS.Timeout>();

// ─────────────────────────────────────────────────────────────────────────────
// Safe Redis wrapper — catches errors so they never crash the process
// ─────────────────────────────────────────────────────────────────────────────
async function safeRedis<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isRedisAvailable()) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// School suspension cache
// ─────────────────────────────────────────────────────────────────────────────
async function isSchoolSuspended(schoolId: string): Promise<boolean> {
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// User info cache
// ─────────────────────────────────────────────────────────────────────────────
async function getUserCachedInfo(userId: string): Promise<{ schoolId: string; role: string; full_name: string; profile_photo?: string } | null> {
  if (isRedisAvailable()) {
    const cached = await safeRedis(() => pubClient.hgetall(KEY.userInfo(userId)), null);
    if (cached && cached.role) {
      return {
        schoolId:     cached.schoolId || '',
        role:         cached.role || '',
        full_name:    cached.full_name || 'User',
        profile_photo: cached.profile_photo || undefined,
      };
    }
  } else {
    const cached = memUserInfo.get(userId);
    if (cached && cached.expires > Date.now()) return cached.data;
  }

  try {
    const info = await prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true, role: true, full_name: true, profile_photo: true },
    });
    if (info) {
      const result = {
        schoolId:     info.schoolId || '',
        role:         info.role || '',
        full_name:    info.full_name || 'User',
        profile_photo: info.profile_photo || undefined,
      };
      if (isRedisAvailable()) {
        const storeData: Record<string, string> = { schoolId: result.schoolId, role: result.role, full_name: result.full_name };
        if (result.profile_photo) storeData.profile_photo = result.profile_photo;
        await safeRedis(async () => {
          const p = pubClient.multi();
          p.hset(KEY.userInfo(userId), storeData);
          p.expire(KEY.userInfo(userId), TTL.userInfo);
          await p.exec();
        }, null);
      } else {
        memUserInfo.set(userId, { data: result, expires: Date.now() + TTL.userInfo * 1000 });
      }
      return result;
    }
  } catch (err) {
    console.error(`[Socket] Error fetching user info for ${userId}:`, err);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation school cache
// ─────────────────────────────────────────────────────────────────────────────
async function getConvSchoolId(convId: string): Promise<string> {
  if (isRedisAvailable()) {
    const cached = await safeRedis(() => pubClient.get(KEY.convSchool(convId)), null);
    if (cached !== null) return cached;
  } else {
    const cached = memConvSchool.get(convId);
    if (cached && cached.expires > Date.now()) return cached.schoolId;
  }
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: convId }, select: { schoolId: true } });
    const schoolId = conv?.schoolId || '';
    if (isRedisAvailable()) {
      await safeRedis(() => pubClient.setex(KEY.convSchool(convId), TTL.convSchool, schoolId), null);
    } else {
      memConvSchool.set(convId, { schoolId, expires: Date.now() + TTL.convSchool * 1000 });
    }
    return schoolId;
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation member cache
// ─────────────────────────────────────────────────────────────────────────────
async function getConversationMemberIds(conversationId: string): Promise<string[]> {
  if (isRedisAvailable()) {
    const cached = await safeRedis(() => pubClient.smembers(KEY.convMembers(conversationId)), null);
    if (cached && cached.length > 0) return cached;
  } else {
    const cached = memConvMembers.get(conversationId);
    if (cached && cached.expires > Date.now()) return cached.memberIds;
  }
  const members = await prisma.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
  const memberIds = members.map(m => m.userId);
  if (memberIds.length > 0) {
    if (isRedisAvailable()) {
      await safeRedis(async () => {
        const p = pubClient.multi();
        p.sadd(KEY.convMembers(conversationId), ...memberIds);
        p.expire(KEY.convMembers(conversationId), TTL.convMembers);
        await p.exec();
      }, null);
    } else {
      memConvMembers.set(conversationId, { memberIds, expires: Date.now() + TTL.convMembers * 1000 });
    }
  }
  return memberIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// User socket management
// ─────────────────────────────────────────────────────────────────────────────
async function addUserSocket(userId: string, socketId: string, schoolId: string): Promise<void> {
  if (isRedisAvailable()) {
    await safeRedis(async () => {
      const p = pubClient.multi();
      p.sadd(KEY.userSockets(userId), socketId);
      p.hset(KEY.socketData(socketId), { userId, schoolId });
      p.expire(KEY.socketData(socketId), TTL.socketData);
      p.set(KEY.userSchool(userId), schoolId);
      p.sadd(KEY.onlineUsers(schoolId), userId);
      await p.exec();
    }, null);
  } else {
    if (!memUserSockets.has(userId)) memUserSockets.set(userId, new Set());
    memUserSockets.get(userId)!.add(socketId);
    memSocketData.set(socketId, { userId, schoolId });
    memUserSchool.set(userId, schoolId);
    if (!memOnlineUsers.has(schoolId)) memOnlineUsers.set(schoolId, new Set());
    memOnlineUsers.get(schoolId)!.add(userId);
  }
}

async function removeUserSocket(userId: string, socketId: string, schoolId: string): Promise<{ fullyOffline: boolean }> {
  if (isRedisAvailable()) {
    await safeRedis(async () => {
      await pubClient.srem(KEY.userSockets(userId), socketId);
      await pubClient.del(KEY.socketData(socketId));
    }, null);
    const remaining = await safeRedis(() => pubClient.scard(KEY.userSockets(userId)), 1);
    if (remaining === 0) {
      await safeRedis(async () => {
        await pubClient.del(KEY.userSockets(userId));
        await pubClient.del(KEY.userSchool(userId));
        await pubClient.srem(KEY.onlineUsers(schoolId), userId);
      }, null);
      return { fullyOffline: true };
    }
    return { fullyOffline: false };
  } else {
    const sids = memUserSockets.get(userId);
    if (sids) {
      sids.delete(socketId);
      if (sids.size === 0) {
        memUserSockets.delete(userId);
        memUserSchool.delete(userId);
        memSocketData.delete(socketId);
        memOnlineUsers.get(schoolId)?.delete(userId);
        return { fullyOffline: true };
      }
    }
    memSocketData.delete(socketId);
    return { fullyOffline: false };
  }
}

async function getUserSocketIds(userId: string): Promise<string[]> {
  if (isRedisAvailable()) {
    return safeRedis(() => pubClient.smembers(KEY.userSockets(userId)), []);
  }
  return Array.from(memUserSockets.get(userId) || []);
}

async function getSocketData(socketId: string): Promise<{ userId: string; schoolId: string } | null> {
  if (isRedisAvailable()) {
    const data = await safeRedis(() => pubClient.hgetall(KEY.socketData(socketId)), null);
    if (data && data.userId) return data as { userId: string; schoolId: string };
    return null;
  }
  return memSocketData.get(socketId) || null;
}

async function isUserOnline(userId: string): Promise<boolean> {
  if (isRedisAvailable()) {
    return (await safeRedis(() => pubClient.scard(KEY.userSockets(userId)), 0)) > 0;
  }
  return (memUserSockets.get(userId)?.size ?? 0) > 0;
}

async function getOnlineUsersForSchool(schoolId: string): Promise<string[]> {
  if (isRedisAvailable()) {
    return safeRedis(() => pubClient.smembers(KEY.onlineUsers(schoolId)), []);
  }
  return Array.from(memOnlineUsers.get(schoolId) || []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Active calls management
// ─────────────────────────────────────────────────────────────────────────────
interface CallData {
  callId: string;
  from: string;
  to: string;
  offer: any;
  type: string;
  profile: any;
  conversationId?: string;
  schoolId?: string;
  startTime: string;
  answerTime?: string;
  timestamp: string;
}

async function setActiveCall(call: CallData): Promise<void> {
  if (isRedisAvailable()) {
    await safeRedis(async () => {
      const data: Record<string, string> = {
        callId:         call.callId,
        from:           call.from,
        to:             call.to,
        offer:          JSON.stringify(call.offer),
        type:           call.type,
        profile:        JSON.stringify(call.profile),
        conversationId: call.conversationId || '',
        schoolId:       call.schoolId || '',
        startTime:      call.startTime,
        timestamp:      call.timestamp,
      };
      const p = pubClient.multi();
      p.hset(KEY.activeCall(call.callId), data);
      p.expire(KEY.activeCall(call.callId), TTL.activeCall);
      p.set(KEY.userInCall(call.from), call.callId, 'EX', TTL.activeCall);
      p.set(KEY.userInCall(call.to),   call.callId, 'EX', TTL.activeCall);
      await p.exec();
    }, null);
  } else {
    memActiveCalls.set(call.callId, call);
    memUserInCall.set(call.from, call.callId);
    memUserInCall.set(call.to,   call.callId);
  }
}

async function getActiveCall(callId: string): Promise<CallData | null> {
  if (isRedisAvailable()) {
    const raw = await safeRedis(() => pubClient.hgetall(KEY.activeCall(callId)), null);
    if (!raw || !raw.callId) return null;
    return {
      ...raw,
      offer:   raw.offer   ? JSON.parse(raw.offer)   : null,
      profile: raw.profile ? JSON.parse(raw.profile) : null,
    } as any;
  }
  return memActiveCalls.get(callId) || null;
}

async function deleteActiveCall(callId: string, fromId?: string, toId?: string): Promise<void> {
  const call = await getActiveCall(callId);
  const from = fromId || call?.from;
  const to   = toId   || call?.to;

  if (isRedisAvailable()) {
    await safeRedis(async () => {
      const p = pubClient.multi();
      p.del(KEY.activeCall(callId));
      if (from) p.del(KEY.userInCall(from));
      if (to)   p.del(KEY.userInCall(to));
      await p.exec();
    }, null);
  } else {
    memActiveCalls.delete(callId);
    if (from) memUserInCall.delete(from);
    if (to)   memUserInCall.delete(to);
  }

  const handle = localTimeoutHandles.get(callId);
  if (handle) {
    clearTimeout(handle);
    localTimeoutHandles.delete(callId);
  }
}

async function isUserBusy(userId: string): Promise<boolean> {
  if (isRedisAvailable()) {
    return !!(await safeRedis(() => pubClient.get(KEY.userInCall(userId)), null));
  }
  return memUserInCall.has(userId);
}

async function getActiveCallForUsers(fromId: string, toId: string): Promise<CallData | null> {
  if (isRedisAvailable()) {
    const callIdFrom = await safeRedis(() => pubClient.get(KEY.userInCall(fromId)), null);
    if (callIdFrom) return getActiveCall(callIdFrom);
    const callIdTo = await safeRedis(() => pubClient.get(KEY.userInCall(toId)), null);
    if (callIdTo) return getActiveCall(callIdTo);
    return null;
  }
  const callIdFrom = memUserInCall.get(fromId);
  if (callIdFrom) return memActiveCalls.get(callIdFrom) || null;
  const callIdTo = memUserInCall.get(toId);
  if (callIdTo) return memActiveCalls.get(callIdTo) || null;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message deduplication
// ─────────────────────────────────────────────────────────────────────────────
async function checkAndSetTempId(key: string, messageId: string): Promise<{ alreadyExists: boolean; existingMessageId?: string }> {
  if (isRedisAvailable()) {
    const existing = await safeRedis(() => pubClient.get(KEY.tempId(key)), null);
    if (existing && existing !== 'pending') return { alreadyExists: true, existingMessageId: existing };
    if (!existing) await safeRedis(() => pubClient.setex(KEY.tempId(key), TTL.tempId, messageId), null);
    return { alreadyExists: false };
  }
  const existing = memTempIds.get(key);
  if (existing && existing.expires > Date.now() && existing.messageId !== 'pending') {
    return { alreadyExists: true, existingMessageId: existing.messageId };
  }
  if (!existing) memTempIds.set(key, { messageId, expires: Date.now() + TTL.tempId * 1000 });
  return { alreadyExists: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported helpers (used by app.ts for the public-reject endpoint)
// ─────────────────────────────────────────────────────────────────────────────
export let ioInstance: SocketIOServer | null = null;
export const getIO = () => ioInstance;
export { getActiveCall, deleteActiveCall, getUserSocketIds };

// ─────────────────────────────────────────────────────────────────────────────
// Emit helpers
// ─────────────────────────────────────────────────────────────────────────────
async function emitToUser(io: SocketIOServer, userId: string, event: string, data: any) {
  const sids = await getUserSocketIds(userId);
  for (const sid of sids) io.to(sid).emit(event, data);
}

async function emitToUserExcept(io: SocketIOServer, userId: string, excludeSocketId: string, event: string, data: any) {
  const sids = await getUserSocketIds(userId);
  for (const sid of sids) {
    if (sid !== excludeSocketId) io.to(sid).emit(event, data);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Presence
// ─────────────────────────────────────────────────────────────────────────────
async function emitPresenceToSchoolMates(
  io: SocketIOServer,
  event: 'user_online' | 'user_offline',
  userId: string,
  schoolId: string,
  excludeSocketId?: string
) {
  try {
    const userConvs = await prisma.conversationMember.findMany({ where: { userId }, select: { conversationId: true } });
    const convIds = userConvs.map(m => m.conversationId);
    if (convIds.length === 0) return;

    const sharedMembers = await prisma.conversationMember.findMany({
      where: { conversation: { schoolId }, conversationId: { in: convIds } },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId: mateId } of sharedMembers) {
      if (mateId === userId) continue;
      const sids = await getUserSocketIds(mateId);
      for (const sid of sids) {
        if (sid !== excludeSocketId) io.to(sid).emit(event, userId);
      }
    }
  } catch (err) {
    console.error(`[Socket] Failed to emit ${event}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Periodic in-memory cleanup (only runs when Redis is unavailable)
// ─────────────────────────────────────────────────────────────────────────────
setInterval(() => {
  if (isRedisAvailable()) return;
  const now = Date.now();
  for (const [k, v] of memSchoolStatus) if (v.expires < now) memSchoolStatus.delete(k);
  for (const [k, v] of memUserInfo)     if (v.expires < now) memUserInfo.delete(k);
  for (const [k, v] of memConvSchool)   if (v.expires < now) memConvSchool.delete(k);
  for (const [k, v] of memConvMembers)  if (v.expires < now) memConvMembers.delete(k);
  for (const [k, v] of memTempIds)      if (v.expires < now) memTempIds.delete(k);
}, 30_000);

// ─────────────────────────────────────────────────────────────────────────────
// Main Socket.IO init
// ─────────────────────────────────────────────────────────────────────────────
export const initSocket = (server: HttpServer) => {
  const io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ['websocket'],
  });

  // Only attach Redis adapter if Redis is available
  if (isRedisAvailable()) {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket] Redis adapter attached — multi-instance broadcasting ENABLED.');
  } else {
    console.log('[Socket] Using default in-memory adapter (single-instance mode).');
  }

  ioInstance = io;

  io.on('connection', (socket) => {
    // ── Authentication ────────────────────────────────────────────────────
    socket.on('authenticate', async ({ token }: { token: string }) => {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        const { id: userId, schoolId } = decoded;

        await addUserSocket(userId, socket.id, schoolId);

        const schoolOnline = await getOnlineUsersForSchool(schoolId);
        socket.emit('initial_online_users', schoolOnline);
        emitPresenceToSchoolMates(io, 'user_online', userId, schoolId, socket.id);

        // Re-deliver any pending incoming call
        const callId = isRedisAvailable()
          ? await safeRedis(() => pubClient.get(KEY.userInCall(userId)), null)
          : (memUserInCall.get(userId) || null);
        if (callId) {
          const call = await getActiveCall(callId);
          if (call && call.to === userId) {
            socket.emit('incoming_call', { from: call.from, offer: call.offer, type: call.type, profile: call.profile, callId: call.callId });
            emitToUser(io, call.from, 'call_ringing', { from: userId });
          }
        }
      } catch {
        socket.emit('auth_error', { message: 'Authentication failed' });
      }
    });

    socket.on('register_push_token', async ({ token }: { token: string }) => {
      const tenant = await getSocketData(socket.id);
      if (!tenant || !token) return;
      try {
        await prisma.user.update({ where: { id: tenant.userId }, data: { pushToken: token } });
      } catch (err) { console.error('[Socket] push token error:', err); }
    });

    socket.on('join_conversation', async (conversationId: string) => {
      socket.join(conversationId);
      const tenant = await getSocketData(socket.id);
      if (!tenant) return;
      prisma.message.findMany({
        where: { conversationId, schoolId: tenant.schoolId, senderId: { not: tenant.userId }, readBy: { none: { userId: tenant.userId } } },
        select: { id: true }, take: 100, orderBy: { createdAt: 'desc' },
      }).then(unread => {
        if (unread.length > 0) socket.to(conversationId).emit('messages_delivered', { conversationId, userId: tenant.userId, messageIds: unread.map(m => m.id) });
      });
    });

    // ── Send Message ──────────────────────────────────────────────────────
    socket.on('send_message', async (data: any) => {
      const startTime = Date.now();
      const tenant = await getSocketData(socket.id);
      if (!tenant || tenant.userId !== data.senderId) return;

      const [targetSchoolId, senderInfo] = await Promise.all([
        data.conversationId ? getConvSchoolId(data.conversationId) : Promise.resolve(tenant.schoolId),
        getUserCachedInfo(data.senderId),
      ]);

      const senderSchoolId = (senderInfo && senderInfo.role !== 'parent') ? senderInfo.schoolId : null;
      const schoolIdsToCheck = [...new Set([targetSchoolId || '', senderSchoolId].filter(Boolean))] as string[];
      const suspensionResults = await Promise.all(schoolIdsToCheck.map(id => isSchoolSuspended(id)));

      if (suspensionResults.some(Boolean)) {
        socket.emit('message_error', { tempId: data.tempId, message: 'Your school account is suspended. Read-only access only.' });
        socket.emit('school_suspended', { message: 'Your school account is suspended.' });
        return;
      }

      try {
        if (data.tempId) {
          const dedupeKey = `${tenant.schoolId}:${data.tempId}`;
          const { alreadyExists, existingMessageId } = await checkAndSetTempId(dedupeKey, 'pending');
          if (alreadyExists && existingMessageId) {
            socket.emit('message_sent', { tempId: data.tempId, messageId: existingMessageId });
            return;
          }
        }

        let attachmentsJson: any = undefined;
        if (data.attachment) {
          const { isLocal, ...cleanAttachment } = data.attachment;
          if (cleanAttachment.url && !cleanAttachment.url.startsWith('blob:')) attachmentsJson = [cleanAttachment];
        }

        const dbStart = Date.now();
        const message = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId:       data.senderId,
            schoolId:       targetSchoolId,
            content:        data.content,
            type:           data.type,
            replyToId:      data.replyToId,
            attachments:    attachmentsJson ?? undefined,
          },
          include: { sender: { select: { id: true, full_name: true, profile_photo: true } } }
        });
        const dbEnd = Date.now();

        // Update dedup entry with real messageId
        if (data.tempId) {
          const dedupeKey = `${tenant.schoolId}:${data.tempId}`;
          if (isRedisAvailable()) {
            await safeRedis(() => pubClient.setex(KEY.tempId(dedupeKey), TTL.tempId, message.id), null);
          } else {
            memTempIds.set(dedupeKey, { messageId: message.id, expires: Date.now() + TTL.tempId * 1000 });
          }
        }

        const serverEnd = Date.now();
        const totalDuration = serverEnd - startTime;
        const transitLatency = startTime - (data.clientTimestamp || startTime);
        console.log(`[Socket Latency] Message: transit=${transitLatency}ms db=${dbEnd - dbStart}ms total=${totalDuration}ms`);

        const broadcastPayload = { ...message, tempId: data.tempId };
        io.to(data.conversationId).emit('new_message', broadcastPayload);
        socket.emit('message_sent', { tempId: data.tempId, messageId: message.id });

        // Guaranteed delivery to online-but-not-in-room members
        getConversationMemberIds(data.conversationId).then(async (memberIds) => {
          const roomSockets = io.sockets.adapter.rooms.get(data.conversationId) || new Set<string>();
          for (const memberId of memberIds) {
            if (memberId === data.senderId) continue;
            const memberSocketIds = await getUserSocketIds(memberId);
            for (const sid of memberSocketIds) {
              if (!roomSockets.has(sid)) io.to(sid).emit('new_message', broadcastPayload);
            }
          }
        }).catch(() => {});

        // Push notifications for offline members
        getConversationMemberIds(data.conversationId).then(async (memberIds) => {
          const onlineChecks = await Promise.all(memberIds.map(async id => ({ id, online: id === data.senderId || await isUserOnline(id) })));
          const offlineTargets = onlineChecks.filter(u => !u.online).map(u => u.id);
          if (offlineTargets.length === 0) return;

          const usersWithTokens = await prisma.user.findMany({
            where: { id: { in: offlineTargets }, pushToken: { not: null } },
            select: { id: true, pushToken: true }
          });
          const expiredIds: string[] = [];
          for (const u of usersWithTokens) {
            if (!u.pushToken) continue;
            const result = await sendMessageNotification(u.pushToken, {
              conversationId: data.conversationId,
              senderId: message.sender.id, senderName: message.sender.full_name,
              senderAvatar: message.sender.profile_photo || '',
              messagePreview: data.content || (data.attachment ? '📎 Attachment' : 'New message'),
              messageType: data.type || 'TEXT',
            });
            if (result === 'EXPIRED_TOKEN') expiredIds.push(u.id);
          }
          if (expiredIds.length > 0) prisma.user.updateMany({ where: { id: { in: expiredIds } }, data: { pushToken: null } }).catch(() => {});
        });
      } catch {
        socket.emit('message_error', { message: 'Failed to send', tempId: data.tempId });
      }
    });

    // ── Delete Message ─────────────────────────────────────────────────────
    socket.on('delete_message', async (data: { messageId: string; conversationId: string; deleteForEveryone?: boolean }) => {
      const tenant = await getSocketData(socket.id);
      if (!tenant) return;
      if (await isSchoolSuspended(tenant.schoolId)) { socket.emit('school_suspended', { message: 'Your school account is suspended.' }); return; }
      try {
        const message = await prisma.message.findFirst({ where: { id: data.messageId, schoolId: tenant.schoolId }, select: { id: true, senderId: true, conversationId: true } });
        if (!message) return;
        if (message.senderId !== tenant.userId) {
          const member = await prisma.conversationMember.findFirst({ where: { conversationId: message.conversationId, userId: tenant.userId, role: { in: ['OWNER', 'ADMIN'] } } });
          if (!member) return;
        }
        if (data.deleteForEveryone !== false) {
          await prisma.message.update({ where: { id: data.messageId }, data: { isDeleted: true, content: null } });
          io.to(data.conversationId).emit('message_deleted', { messageId: data.messageId, conversationId: data.conversationId });
        } else {
          socket.emit('message_deleted_for_me', { messageId: data.messageId, conversationId: data.conversationId });
          await emitToUserExcept(io, tenant.userId, socket.id, 'message_deleted_for_me', { messageId: data.messageId, conversationId: data.conversationId });
        }
      } catch (err) { console.error('[Socket] delete_message error:', err); }
    });

    // ── Edit Message ───────────────────────────────────────────────────────
    socket.on('edit_message', async (data: { messageId: string; conversationId: string; content: string }) => {
      const tenant = await getSocketData(socket.id);
      if (!tenant) return;
      if (await isSchoolSuspended(tenant.schoolId)) { socket.emit('school_suspended', { message: 'Your school account is suspended.' }); return; }
      try {
        const message = await prisma.message.findFirst({ where: { id: data.messageId, schoolId: tenant.schoolId, senderId: tenant.userId }, select: { id: true, conversationId: true } });
        if (!message) return;
        const updated = await prisma.message.update({ where: { id: data.messageId }, data: { content: data.content, editedAt: new Date() } });
        io.to(data.conversationId).emit('message_edited', { messageId: data.messageId, conversationId: data.conversationId, content: data.content, editedAt: updated.editedAt });
      } catch (err) { console.error('[Socket] edit_message error:', err); }
    });

    // ── Pin / Unpin Message ────────────────────────────────────────────────
    socket.on('pin_message', async (data: { messageId: string; conversationId: string }) => {
      const tenant = await getSocketData(socket.id);
      if (!tenant) return;
      if (await isSchoolSuspended(tenant.schoolId)) { socket.emit('school_suspended', { message: 'Your school account is suspended.' }); return; }
      try {
        const conversation = await prisma.conversation.findUnique({ where: { id: data.conversationId }, select: { isGroup: true } });
        if (!conversation) return;
        if (conversation.isGroup) {
          const member = await prisma.conversationMember.findFirst({ where: { conversationId: data.conversationId, userId: tenant.userId, role: { in: ['OWNER', 'ADMIN'] } }, select: { id: true } });
          if (!member) return;
        } else {
          const member = await prisma.conversationMember.findFirst({ where: { conversationId: data.conversationId, userId: tenant.userId }, select: { id: true } });
          if (!member) return;
        }
        const existing = await prisma.pinnedMessage.findUnique({ where: { conversationId_messageId: { conversationId: data.conversationId, messageId: data.messageId } } });
        if (existing) {
          await prisma.pinnedMessage.delete({ where: { conversationId_messageId: { conversationId: data.conversationId, messageId: data.messageId } } });
          io.to(data.conversationId).emit('message_pinned', { messageId: data.messageId, conversationId: data.conversationId, pinnedBy: tenant.userId, isPinned: false });
        } else {
          const pinned = await prisma.pinnedMessage.create({
            data: { conversationId: data.conversationId, messageId: data.messageId, pinnedBy: tenant.userId },
            include: { message: { select: { id: true, content: true, type: true, sender: { select: { full_name: true } } } } },
          });
          io.to(data.conversationId).emit('message_pinned', { messageId: data.messageId, conversationId: data.conversationId, pinnedBy: tenant.userId, isPinned: true, messageContent: pinned.message.content, senderName: pinned.message.sender.full_name, messageType: pinned.message.type });
        }
      } catch (err) { console.error('[Socket] pin_message error:', err); }
    });

    socket.on('typing', (data: any) => socket.to(data.conversationId).emit('user_typing', data));

    socket.on('mark_conversation_read', async (data: any) => {
      const tenant = await getSocketData(socket.id);
      if (!tenant || tenant.userId !== data.userId || !data.messageIds?.length) return;
      try {
        await Promise.allSettled(data.messageIds.map((messageId: string) =>
          prisma.messageRead.upsert({
            where:  { messageId_userId: { messageId, userId: data.userId } },
            update: { readAt: new Date() },
            create: { messageId, userId: data.userId, schoolId: tenant.schoolId },
          })
        ));
        socket.to(data.conversationId).emit('messages_read', { conversationId: data.conversationId, userId: data.userId, messageIds: data.messageIds });
      } catch (err) { console.warn('[Socket] mark_conversation_read error (non-fatal):', err); }
    });

    // ── CALL: Initiate ─────────────────────────────────────────────────────
    socket.on('call_user', async (data: any) => {
      const tenant = await getSocketData(socket.id);
      if (!tenant || tenant.userId !== data.from) return;

      const [callerInfo, targetUser] = await Promise.all([
        prisma.user.findUnique({ where: { id: data.from }, select: { schoolId: true, role: true, full_name: true } }),
        prisma.user.findFirst({ where: { id: data.to, is_active: true }, select: { id: true, schoolId: true, role: true, pushToken: true } }),
      ]);
      if (!targetUser) return;

      let callSchoolId = tenant.schoolId;
      if (callerInfo && callerInfo.role !== 'parent') callSchoolId = callerInfo.schoolId || '';
      else if (targetUser && targetUser.role !== 'parent') callSchoolId = targetUser.schoolId || '';

      if (await isSchoolSuspended(callSchoolId)) {
        socket.emit('call_blocked', { code: 'SCHOOL_SUSPENDED', callType: data.type || 'VOICE', message: 'Voice and video calls are disabled while the school account is suspended.' });
        return;
      }

      const callId = data.callId || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (await isUserBusy(data.to)) {
        socket.emit('call_busy', { callId, from: data.to, to: data.from });
        const busySchoolId = callerInfo?.schoolId || targetUser.schoolId || tenant.schoolId;
        if (busySchoolId) logCall({ callId, schoolId: busySchoolId, userId: data.from, recipientId: data.to, conversationId: data.conversationId, type: data.type || 'VOICE', status: 'BUSY', endTime: new Date(), duration: 0, disconnectReason: 'BUSY' }).catch(() => {});
        return;
      }

      const callStartTime = Date.now();
      const resolvedSchoolId = targetUser.schoolId || callerInfo?.schoolId || tenant.schoolId;

      const timeoutHandle = setTimeout(async () => {
        const call = await getActiveCall(callId);
        if (call) {
          await deleteActiveCall(callId, call.from, call.to);
          emitToUser(io, call.from, 'call_missed',  { callId, reason: 'NO_ANSWER' });
          emitToUser(io, call.to,   'call_ended',   { from: call.from, callId, reason: 'MISSED' });
          if (call.schoolId) logCall({ callId, schoolId: call.schoolId, userId: call.from, recipientId: call.to, conversationId: call.conversationId, type: call.type, status: 'MISSED', endTime: new Date(), duration: 0, disconnectReason: 'MISSED' }).catch(() => {});
        }
      }, 45000);
      localTimeoutHandles.set(callId, timeoutHandle);

      await setActiveCall({ callId, from: data.from, to: data.to, offer: data.offer, type: data.type || 'VOICE', profile: data.profile, conversationId: data.conversationId, schoolId: resolvedSchoolId, startTime: String(callStartTime), timestamp: String(callStartTime) });
      await emitToUser(io, data.to, 'incoming_call', { from: data.from, offer: data.offer, type: data.type || 'VOICE', profile: data.profile, callId });

      if (targetUser.pushToken) {
        const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'https://zetime-backend-dmlv.onrender.com';
        sendCallNotification(targetUser.pushToken, { callId, callerId: data.from, callerName: (data.profile?.name || callerInfo?.full_name || 'Unknown').slice(0, 64), callType: (data.type || 'VOICE') as 'VOICE' | 'VIDEO', serverUrl });
      }
    });

    socket.on('call_ringing', async (data: any) => { await emitToUser(io, data.to, 'call_ringing', { from: data.from }); });

    // ── CALL: Answer ───────────────────────────────────────────────────────
    socket.on('answer_call', async (data: any) => {
      const tenant = await getSocketData(socket.id);
      if (!tenant) return;

      const [answererInfo, callerInfo] = await Promise.all([
        prisma.user.findUnique({ where: { id: data.from }, select: { schoolId: true, role: true } }),
        prisma.user.findUnique({ where: { id: data.to },   select: { schoolId: true, role: true } }),
      ]);

      let callSchoolId = tenant.schoolId;
      if (answererInfo && answererInfo.role !== 'parent') callSchoolId = answererInfo.schoolId || '';
      else if (callerInfo && callerInfo.role !== 'parent') callSchoolId = callerInfo.schoolId || '';

      if (await isSchoolSuspended(callSchoolId || '')) {
        socket.emit('call_blocked', { code: 'SCHOOL_SUSPENDED', callType: data.type || 'VOICE', message: 'Voice and video calls are disabled while the school account is suspended.' });
        return;
      }

      await emitToUser(io, data.to, 'call_answered', { from: data.from, answer: data.answer });
      await emitToUserExcept(io, data.from, socket.id, 'call_stop_ringing', { callId: data.callId });

      if (data.callId) await deleteActiveCall(data.callId, data.from, data.to);
      else { const call = await getActiveCallForUsers(data.from, data.to); if (call) await deleteActiveCall(call.callId, call.from, call.to); }
    });

    socket.on('ice_candidate',     async (data: any) => { await emitToUser(io, data.to, 'ice_candidate',     { from: data.from, candidate: data.candidate }); });
    socket.on('ice_restart',       async (data: any) => { await emitToUser(io, data.to, 'ice_restart',       { from: data.from, offer:     data.offer }); });
    socket.on('ice_restart_answer',async (data: any) => { await emitToUser(io, data.to, 'ice_restart_answer',{ from: data.from, answer:    data.answer }); });
    socket.on('media_state_change',async (data: any) => { await emitToUser(io, data.to, 'media_state_changed',{ from: data.from, isCameraOff: data.isCameraOff, isMuted: data.isMuted }); });

    // ── CALL: Reject ───────────────────────────────────────────────────────
    socket.on('reject_call', async (data: any) => {
      const tenant = await getSocketData(socket.id);
      if (!tenant) return;

      await emitToUser(io, data.to, 'call_rejected', { from: data.from, callId: data.callId });
      await emitToUserExcept(io, data.from, socket.id, 'call_stop_ringing', { callId: data.callId });

      let rejectedCall = data.callId ? await getActiveCall(data.callId) : null;
      if (!rejectedCall) rejectedCall = await getActiveCallForUsers(data.from, data.to);

      if (data.callId) await deleteActiveCall(data.callId, data.from, data.to);
      else if (rejectedCall) await deleteActiveCall(rejectedCall.callId, rejectedCall.from, rejectedCall.to);

      const targetUserForReject = await prisma.user.findUnique({ where: { id: data.to }, select: { pushToken: true } });
      if (targetUserForReject?.pushToken) sendCallCancellation(targetUserForReject.pushToken, data.callId || '');

      const callSchoolId = rejectedCall?.schoolId || tenant.schoolId;
      if (callSchoolId) logCall({ callId: data.callId, schoolId: callSchoolId, userId: data.from, recipientId: data.to, conversationId: data.conversationId || rejectedCall?.conversationId, type: data.type || rejectedCall?.type || 'VOICE', status: 'DECLINED', endTime: new Date(), duration: 0, disconnectReason: 'DECLINED' }).catch(err => console.warn('[Socket] reject logCall error:', err));

      const rejectConvId = data.conversationId || rejectedCall?.conversationId;
      if (rejectConvId) {
        const msg = await prisma.message.create({ data: { conversationId: rejectConvId, senderId: data.from, schoolId: tenant.schoolId, content: data.reason === 'MISSED' ? 'Missed Call' : 'Declined Call', type: data.type === 'VIDEO' ? 'CALL_MISSED_VIDEO' : 'CALL_MISSED_VOICE', metadata: { reason: data.reason || 'DECLINED' } } });
        io.to(rejectConvId).emit('new_message', msg);
      }
    });

    // ── CALL: End ──────────────────────────────────────────────────────────
    socket.on('end_call', async (data: any) => {
      const tenant = await getSocketData(socket.id);
      if (!tenant) return;

      await emitToUser(io, data.to, 'call_ended', { from: data.from, callId: data.callId });

      if (data.callId) await deleteActiveCall(data.callId, data.from, data.to);
      else { const call = await getActiveCallForUsers(data.from, data.to); if (call) await deleteActiveCall(call.callId, call.from, call.to); }

      const targetUser = await prisma.user.findUnique({ where: { id: data.to }, select: { pushToken: true } });
      if (targetUser?.pushToken) sendCallCancellation(targetUser.pushToken, data.callId || '');

      const durationSecs = typeof data.duration === 'number' ? Math.round(data.duration) : 0;
      const answerTime   = data.answerTime ? new Date(data.answerTime) : undefined;
      const callStatus   = data.reason === 'CANCELLED' ? 'CANCELLED' : data.reason === 'MISSED' ? 'MISSED' : durationSecs > 0 ? 'ANSWERED' : 'CANCELLED';

      if (tenant.schoolId) logCall({ callId: data.callId, schoolId: data.schoolId || tenant.schoolId, userId: data.from, recipientId: data.to, conversationId: data.conversationId, type: data.type || 'VOICE', status: callStatus, duration: durationSecs, answerTime, endTime: new Date(), disconnectReason: data.reason || 'ENDED', networkQuality: data.networkQuality }).catch(err => console.warn('[Socket] end_call logCall error:', err));

      if (data.conversationId) {
        let content = 'Call ended';
        let msgType = data.type === 'VIDEO' ? 'CALL_VIDEO' : 'CALL_VOICE';
        if (data.reason === 'CANCELLED') { content = 'Canceled Call'; msgType = data.type === 'VIDEO' ? 'CALL_MISSED_VIDEO' : 'CALL_MISSED_VOICE'; }
        else if (data.reason === 'MISSED') { content = 'Missed Call'; msgType = data.type === 'VIDEO' ? 'CALL_MISSED_VIDEO' : 'CALL_MISSED_VOICE'; }
        const msg = await prisma.message.create({ data: { conversationId: data.conversationId, senderId: data.from, schoolId: tenant.schoolId, content, type: msgType, metadata: { duration: data.duration, reason: data.reason } } });
        io.to(data.conversationId).emit('new_message', msg);
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const tenant = await getSocketData(socket.id);
      if (tenant) {
        const { userId, schoolId } = tenant;
        const { fullyOffline } = await removeUserSocket(userId, socket.id, schoolId);
        if (fullyOffline) await emitPresenceToSchoolMates(io, 'user_offline', userId, schoolId, socket.id);
      }
    });
  });

  return io;
};
