"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = exports.getIO = exports.ioInstance = void 0;
exports.getActiveCall = getActiveCall;
exports.deleteActiveCall = deleteActiveCall;
exports.getUserSocketIds = getUserSocketIds;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const notification_service_1 = require("./services/notification.service");
const call_service_1 = require("./services/call.service");
const redis_1 = require("./redis");
const jwt_1 = require("./utils/jwt");
const db_1 = __importDefault(require("./config/db"));
// ─────────────────────────────────────────────────────────────────────────────
// Redis key helpers
// ─────────────────────────────────────────────────────────────────────────────
const KEY = {
    userSockets: (uid) => `sockets:user:${uid}`,
    socketData: (sid) => `sockets:data:${sid}`,
    onlineUsers: () => `online:all`,
    activeCall: (callId) => `calls:${callId}`,
    userInCall: (uid) => `calls:user:${uid}`,
    userInfo: (uid) => `cache:user:${uid}`,
    convMembers: (cid) => `cache:members:${cid}`,
    tempId: (key) => `dedup:${key}`,
};
const TTL = {
    userInfo: 5 * 60,
    convMembers: 60,
    tempId: 60,
    activeCall: 60,
    socketData: 12 * 3600,
};
// ─────────────────────────────────────────────────────────────────────────────
// In-memory fallback state (used when Redis is unavailable)
// ─────────────────────────────────────────────────────────────────────────────
const memUserSockets = new Map(); // userId → Set<socketId>
const memSocketData = new Map();
const memOnlineUsers = new Set(); // Set<userId>
const memActiveCalls = new Map(); // callId → call data
const memUserInCall = new Map(); // userId → callId
const memUserInfo = new Map();
const memConvMembers = new Map();
const memTempIds = new Map();
// ─────────────────────────────────────────────────────────────────────────────
// Local store for NodeJS.Timeout handles (cannot be stored in Redis)
// ─────────────────────────────────────────────────────────────────────────────
const localTimeoutHandles = new Map();
// ─────────────────────────────────────────────────────────────────────────────
// Safe Redis wrapper — catches errors so they never crash the process
// ─────────────────────────────────────────────────────────────────────────────
async function safeRedis(fn, fallback) {
    if (!(0, redis_1.isRedisAvailable)())
        return fallback;
    try {
        return await fn();
    }
    catch {
        return fallback;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// User info cache
// ─────────────────────────────────────────────────────────────────────────────
async function getUserCachedInfo(userId) {
    if ((0, redis_1.isRedisAvailable)()) {
        const cached = await safeRedis(() => redis_1.pubClient.hgetall(KEY.userInfo(userId)), null);
        if (cached && cached.role) {
            return {
                role: cached.role || '',
                full_name: cached.full_name || 'User',
                profile_photo: cached.profile_photo || undefined,
            };
        }
    }
    else {
        const cached = memUserInfo.get(userId);
        if (cached && cached.expires > Date.now())
            return cached.data;
    }
    try {
        const info = await db_1.default.user.findUnique({
            where: { id: userId },
            select: { role: true, full_name: true, profile_photo: true },
        });
        if (info) {
            const result = {
                role: info.role || '',
                full_name: info.full_name || 'User',
                profile_photo: info.profile_photo || undefined,
            };
            if ((0, redis_1.isRedisAvailable)()) {
                const storeData = { role: result.role, full_name: result.full_name };
                if (result.profile_photo)
                    storeData.profile_photo = result.profile_photo;
                await safeRedis(async () => {
                    const p = redis_1.pubClient.multi();
                    p.hset(KEY.userInfo(userId), storeData);
                    p.expire(KEY.userInfo(userId), TTL.userInfo);
                    await p.exec();
                }, null);
            }
            else {
                memUserInfo.set(userId, { data: result, expires: Date.now() + TTL.userInfo * 1000 });
            }
            return result;
        }
    }
    catch (err) {
        console.error(`[Socket] Error fetching user info for ${userId}:`, err);
    }
    return null;
}
// ─────────────────────────────────────────────────────────────────────────────
// Conversation member cache
// ─────────────────────────────────────────────────────────────────────────────
async function getConversationMemberIds(conversationId) {
    if ((0, redis_1.isRedisAvailable)()) {
        const cached = await safeRedis(() => redis_1.pubClient.smembers(KEY.convMembers(conversationId)), null);
        if (cached && cached.length > 0)
            return cached;
    }
    else {
        const cached = memConvMembers.get(conversationId);
        if (cached && cached.expires > Date.now())
            return cached.memberIds;
    }
    try {
        const members = await db_1.default.conversationMember.findMany({
            where: { conversationId },
            select: { userId: true },
        });
        const ids = members.map(m => m.userId);
        if ((0, redis_1.isRedisAvailable)()) {
            if (ids.length > 0) {
                await safeRedis(async () => {
                    const p = redis_1.pubClient.multi();
                    p.sadd(KEY.convMembers(conversationId), ...ids);
                    p.expire(KEY.convMembers(conversationId), TTL.convMembers);
                    await p.exec();
                }, null);
            }
        }
        else {
            memConvMembers.set(conversationId, { memberIds: ids, expires: Date.now() + TTL.convMembers * 1000 });
        }
        return ids;
    }
    catch {
        return [];
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// User socket management
// ─────────────────────────────────────────────────────────────────────────────
async function addUserSocket(userId, socketId) {
    if ((0, redis_1.isRedisAvailable)()) {
        await safeRedis(async () => {
            const p = redis_1.pubClient.multi();
            p.sadd(KEY.userSockets(userId), socketId);
            p.hset(KEY.socketData(socketId), { userId });
            p.expire(KEY.socketData(socketId), TTL.socketData);
            p.sadd(KEY.onlineUsers(), userId);
            await p.exec();
        }, null);
    }
    else {
        if (!memUserSockets.has(userId))
            memUserSockets.set(userId, new Set());
        memUserSockets.get(userId).add(socketId);
        memSocketData.set(socketId, { userId });
        memOnlineUsers.add(userId);
    }
}
async function removeUserSocket(userId, socketId) {
    if ((0, redis_1.isRedisAvailable)()) {
        await safeRedis(async () => {
            await redis_1.pubClient.srem(KEY.userSockets(userId), socketId);
            await redis_1.pubClient.del(KEY.socketData(socketId));
        }, null);
        const remaining = await safeRedis(() => redis_1.pubClient.scard(KEY.userSockets(userId)), 1);
        if (remaining === 0) {
            await safeRedis(async () => {
                await redis_1.pubClient.del(KEY.userSockets(userId));
                await redis_1.pubClient.srem(KEY.onlineUsers(), userId);
            }, null);
            return { fullyOffline: true };
        }
        return { fullyOffline: false };
    }
    else {
        const sids = memUserSockets.get(userId);
        if (sids) {
            sids.delete(socketId);
            if (sids.size === 0) {
                memUserSockets.delete(userId);
                memSocketData.delete(socketId);
                memOnlineUsers.delete(userId);
                return { fullyOffline: true };
            }
        }
        memSocketData.delete(socketId);
        return { fullyOffline: false };
    }
}
async function getUserSocketIds(userId) {
    if ((0, redis_1.isRedisAvailable)()) {
        return safeRedis(() => redis_1.pubClient.smembers(KEY.userSockets(userId)), []);
    }
    return Array.from(memUserSockets.get(userId) || []);
}
async function getSocketData(socketId) {
    if ((0, redis_1.isRedisAvailable)()) {
        const data = await safeRedis(() => redis_1.pubClient.hgetall(KEY.socketData(socketId)), null);
        if (data && data.userId)
            return data;
        return null;
    }
    return memSocketData.get(socketId) || null;
}
async function isUserOnline(userId) {
    if ((0, redis_1.isRedisAvailable)()) {
        return (await safeRedis(() => redis_1.pubClient.scard(KEY.userSockets(userId)), 0)) > 0;
    }
    return (memUserSockets.get(userId)?.size ?? 0) > 0;
}
async function getOnlineUsers() {
    if ((0, redis_1.isRedisAvailable)()) {
        return safeRedis(() => redis_1.pubClient.smembers(KEY.onlineUsers()), []);
    }
    return Array.from(memOnlineUsers);
}
async function setActiveCall(call) {
    if ((0, redis_1.isRedisAvailable)()) {
        await safeRedis(async () => {
            const data = {
                callId: call.callId,
                from: call.from,
                to: call.to,
                offer: JSON.stringify(call.offer),
                type: call.type,
                profile: JSON.stringify(call.profile),
                conversationId: call.conversationId || '',
                startTime: call.startTime,
                timestamp: call.timestamp,
            };
            const p = redis_1.pubClient.multi();
            p.hset(KEY.activeCall(call.callId), data);
            p.expire(KEY.activeCall(call.callId), TTL.activeCall);
            p.set(KEY.userInCall(call.from), call.callId, 'EX', TTL.activeCall);
            p.set(KEY.userInCall(call.to), call.callId, 'EX', TTL.activeCall);
            await p.exec();
        }, null);
    }
    else {
        memActiveCalls.set(call.callId, call);
        memUserInCall.set(call.from, call.callId);
        memUserInCall.set(call.to, call.callId);
    }
}
async function getActiveCall(callId) {
    if ((0, redis_1.isRedisAvailable)()) {
        const raw = await safeRedis(() => redis_1.pubClient.hgetall(KEY.activeCall(callId)), null);
        if (!raw || !raw.callId)
            return null;
        return {
            ...raw,
            offer: raw.offer ? JSON.parse(raw.offer) : null,
            profile: raw.profile ? JSON.parse(raw.profile) : null,
        };
    }
    return memActiveCalls.get(callId) || null;
}
async function deleteActiveCall(callId, fromId, toId) {
    const call = await getActiveCall(callId);
    const from = fromId || call?.from;
    const to = toId || call?.to;
    if ((0, redis_1.isRedisAvailable)()) {
        await safeRedis(async () => {
            const p = redis_1.pubClient.multi();
            p.del(KEY.activeCall(callId));
            if (from)
                p.del(KEY.userInCall(from));
            if (to)
                p.del(KEY.userInCall(to));
            await p.exec();
        }, null);
    }
    else {
        memActiveCalls.delete(callId);
        if (from)
            memUserInCall.delete(from);
        if (to)
            memUserInCall.delete(to);
    }
    const handle = localTimeoutHandles.get(callId);
    if (handle) {
        clearTimeout(handle);
        localTimeoutHandles.delete(callId);
    }
}
async function isUserBusy(userId) {
    if ((0, redis_1.isRedisAvailable)()) {
        return !!(await safeRedis(() => redis_1.pubClient.get(KEY.userInCall(userId)), null));
    }
    return memUserInCall.has(userId);
}
async function getActiveCallForUsers(fromId, toId) {
    if ((0, redis_1.isRedisAvailable)()) {
        const callIdFrom = await safeRedis(() => redis_1.pubClient.get(KEY.userInCall(fromId)), null);
        if (callIdFrom)
            return getActiveCall(callIdFrom);
        const callIdTo = await safeRedis(() => redis_1.pubClient.get(KEY.userInCall(toId)), null);
        if (callIdTo)
            return getActiveCall(callIdTo);
        return null;
    }
    const callIdFrom = memUserInCall.get(fromId);
    if (callIdFrom)
        return memActiveCalls.get(callIdFrom) || null;
    const callIdTo = memUserInCall.get(toId);
    if (callIdTo)
        return memActiveCalls.get(callIdTo) || null;
    return null;
}
// ─────────────────────────────────────────────────────────────────────────────
// Message deduplication
// ─────────────────────────────────────────────────────────────────────────────
async function checkAndSetTempId(key, messageId) {
    if ((0, redis_1.isRedisAvailable)()) {
        const existing = await safeRedis(() => redis_1.pubClient.get(KEY.tempId(key)), null);
        if (existing && existing !== 'pending')
            return { alreadyExists: true, existingMessageId: existing };
        if (!existing)
            await safeRedis(() => redis_1.pubClient.setex(KEY.tempId(key), TTL.tempId, messageId), null);
        return { alreadyExists: false };
    }
    const existing = memTempIds.get(key);
    if (existing && existing.expires > Date.now() && existing.messageId !== 'pending') {
        return { alreadyExists: true, existingMessageId: existing.messageId };
    }
    if (!existing)
        memTempIds.set(key, { messageId, expires: Date.now() + TTL.tempId * 1000 });
    return { alreadyExists: false };
}
// ─────────────────────────────────────────────────────────────────────────────
// Exported helpers (used by app.ts for the public-reject endpoint)
// ─────────────────────────────────────────────────────────────────────────────
exports.ioInstance = null;
const getIO = () => exports.ioInstance;
exports.getIO = getIO;
// ─────────────────────────────────────────────────────────────────────────────
// Emit helpers
// ─────────────────────────────────────────────────────────────────────────────
async function emitToUser(io, userId, event, data) {
    const sids = await getUserSocketIds(userId);
    for (const sid of sids)
        io.to(sid).emit(event, data);
}
async function emitToUserExcept(io, userId, excludeSocketId, event, data) {
    const sids = await getUserSocketIds(userId);
    for (const sid of sids) {
        if (sid !== excludeSocketId)
            io.to(sid).emit(event, data);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Presence
// ─────────────────────────────────────────────────────────────────────────────
async function emitPresenceToMates(io, event, userId, excludeSocketId) {
    try {
        const userConvs = await db_1.default.conversationMember.findMany({ where: { userId }, select: { conversationId: true } });
        const convIds = userConvs.map(m => m.conversationId);
        if (convIds.length === 0)
            return;
        const sharedMembers = await db_1.default.conversationMember.findMany({
            where: { conversationId: { in: convIds } },
            select: { userId: true },
            distinct: ['userId'],
        });
        for (const { userId: mateId } of sharedMembers) {
            if (mateId === userId)
                continue;
            const sids = await getUserSocketIds(mateId);
            for (const sid of sids) {
                if (sid !== excludeSocketId)
                    io.to(sid).emit(event, userId);
            }
        }
    }
    catch (err) {
        console.error(`[Socket] Failed to emit ${event}:`, err);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Periodic in-memory cleanup (only runs when Redis is unavailable)
// ─────────────────────────────────────────────────────────────────────────────
setInterval(() => {
    if ((0, redis_1.isRedisAvailable)())
        return;
    const now = Date.now();
    for (const [k, v] of memUserInfo)
        if (v.expires < now)
            memUserInfo.delete(k);
    for (const [k, v] of memConvMembers)
        if (v.expires < now)
            memConvMembers.delete(k);
    for (const [k, v] of memTempIds)
        if (v.expires < now)
            memTempIds.delete(k);
}, 30_000);
// ─────────────────────────────────────────────────────────────────────────────
// Main Socket.IO init
// ─────────────────────────────────────────────────────────────────────────────
const initSocket = (server) => {
    const io = new socket_io_1.Server(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        pingInterval: 25000,
        pingTimeout: 60000,
        transports: ['websocket'],
    });
    if ((0, redis_1.isRedisAvailable)()) {
        io.adapter((0, redis_adapter_1.createAdapter)(redis_1.pubClient, redis_1.subClient));
        console.log('[Socket] Redis adapter attached — multi-instance broadcasting ENABLED.');
    }
    else {
        console.log('[Socket] Using default in-memory adapter (single-instance mode).');
    }
    exports.ioInstance = io;
    io.on('connection', (socket) => {
        // ── Authentication ────────────────────────────────────────────────────
        socket.on('authenticate', async ({ token }) => {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, (0, jwt_1.getJwtSecret)());
                const { id: userId } = decoded;
                await addUserSocket(userId, socket.id);
                const onlineUsers = await getOnlineUsers();
                socket.emit('initial_online_users', onlineUsers);
                emitPresenceToMates(io, 'user_online', userId, socket.id);
                const callId = (0, redis_1.isRedisAvailable)()
                    ? await safeRedis(() => redis_1.pubClient.get(KEY.userInCall(userId)), null)
                    : (memUserInCall.get(userId) || null);
                if (callId) {
                    const call = await getActiveCall(callId);
                    if (call && call.to === userId) {
                        socket.emit('incoming_call', { from: call.from, offer: call.offer, type: call.type, profile: call.profile, callId: call.callId });
                        emitToUser(io, call.from, 'call_ringing', { from: userId });
                    }
                }
            }
            catch {
                socket.emit('auth_error', { message: 'Authentication failed' });
            }
        });
        socket.on('register_push_token', async ({ token }) => {
            const tenant = await getSocketData(socket.id);
            if (!tenant || !token)
                return;
            try {
                await db_1.default.user.update({ where: { id: tenant.userId }, data: { pushToken: token } });
            }
            catch (err) {
                console.error('[Socket] push token error:', err);
            }
        });
        socket.on('join_conversation', async (conversationId) => {
            socket.join(conversationId);
            const tenant = await getSocketData(socket.id);
            if (!tenant)
                return;
            db_1.default.message.findMany({
                where: { conversationId, senderId: { not: tenant.userId }, readBy: { none: { userId: tenant.userId } } },
                select: { id: true }, take: 100, orderBy: { createdAt: 'desc' },
            }).then(unread => {
                if (unread.length > 0)
                    socket.to(conversationId).emit('messages_delivered', { conversationId, userId: tenant.userId, messageIds: unread.map(m => m.id) });
            });
        });
        // ── Send Message ──────────────────────────────────────────────────────
        socket.on('send_message', async (data) => {
            const startTime = Date.now();
            const tenant = await getSocketData(socket.id);
            if (!tenant || tenant.userId !== data.senderId)
                return;
            try {
                const convMembers = await db_1.default.conversationMember.findMany({
                    where: { conversationId: data.conversationId },
                    select: { userId: true, isMuted: true },
                });
                const recipientIds = convMembers.map(m => m.userId).filter(id => id !== data.senderId);
                if (recipientIds.length === 1) {
                    const blockExists = await db_1.default.userBlock.findFirst({
                        where: {
                            OR: [
                                { blockerId: data.senderId, blockedId: recipientIds[0] },
                                { blockerId: recipientIds[0], blockedId: data.senderId },
                            ]
                        },
                        select: { id: true },
                    });
                    if (blockExists) {
                        socket.emit('message_blocked', { tempId: data.tempId, message: 'You cannot send messages to this user.' });
                        return;
                    }
                }
                if (data.tempId) {
                    const dedupeKey = `msg:${data.tempId}`;
                    const { alreadyExists, existingMessageId } = await checkAndSetTempId(dedupeKey, 'pending');
                    if (alreadyExists && existingMessageId) {
                        socket.emit('message_sent', { tempId: data.tempId, messageId: existingMessageId });
                        return;
                    }
                }
                let attachmentsJson = undefined;
                if (data.attachment) {
                    const { isLocal, ...cleanAttachment } = data.attachment;
                    if (cleanAttachment.url && !cleanAttachment.url.startsWith('blob:'))
                        attachmentsJson = [cleanAttachment];
                }
                const dbStart = Date.now();
                const message = await db_1.default.message.create({
                    data: {
                        conversationId: data.conversationId,
                        senderId: data.senderId,
                        content: data.content,
                        type: data.type,
                        replyToId: data.replyToId,
                        attachments: attachmentsJson ?? undefined,
                    },
                    include: { sender: { select: { id: true, full_name: true, profile_photo: true } } }
                });
                const dbEnd = Date.now();
                if (data.tempId) {
                    const dedupeKey = `msg:${data.tempId}`;
                    if ((0, redis_1.isRedisAvailable)()) {
                        await safeRedis(() => redis_1.pubClient.setex(KEY.tempId(dedupeKey), TTL.tempId, message.id), null);
                    }
                    else {
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
                getConversationMemberIds(data.conversationId).then(async (memberIds) => {
                    const roomSockets = io.sockets.adapter.rooms.get(data.conversationId) || new Set();
                    for (const memberId of memberIds) {
                        if (memberId === data.senderId)
                            continue;
                        const memberSocketIds = await getUserSocketIds(memberId);
                        for (const sid of memberSocketIds) {
                            if (!roomSockets.has(sid))
                                io.to(sid).emit('new_message', broadcastPayload);
                        }
                    }
                }).catch(() => { });
                getConversationMemberIds(data.conversationId).then(async (memberIds) => {
                    const pushTargetIds = [];
                    for (const id of memberIds) {
                        if (id === data.senderId)
                            continue;
                        const online = await isUserOnline(id);
                        if (!online)
                            pushTargetIds.push(id);
                    }
                    if (pushTargetIds.length === 0)
                        return;
                    const usersWithTokens = await db_1.default.user.findMany({
                        where: { id: { in: pushTargetIds }, pushToken: { not: null } },
                        select: { id: true, pushToken: true }
                    });
                    const mutedMemberIds = new Set(convMembers.filter(m => m.isMuted).map(m => m.userId));
                    const expiredIds = [];
                    for (const u of usersWithTokens) {
                        if (!u.pushToken)
                            continue;
                        if (mutedMemberIds.has(u.id))
                            continue;
                        const result = await (0, notification_service_1.sendMessageNotification)(u.pushToken, {
                            conversationId: data.conversationId,
                            senderId: message.sender.id,
                            senderName: message.sender.full_name,
                            senderAvatar: message.sender.profile_photo || '',
                            messagePreview: data.content || (data.attachment ? '📎 Attachment' : 'New message'),
                            messageType: data.type || 'TEXT',
                        });
                        if (result === 'EXPIRED_TOKEN')
                            expiredIds.push(u.id);
                    }
                    if (expiredIds.length > 0)
                        db_1.default.user.updateMany({ where: { id: { in: expiredIds } }, data: { pushToken: null } }).catch(() => { });
                });
            }
            catch {
                socket.emit('message_error', { message: 'Failed to send', tempId: data.tempId });
            }
        });
        // ── Delete Message ─────────────────────────────────────────────────────
        socket.on('delete_message', async (data) => {
            const tenant = await getSocketData(socket.id);
            if (!tenant)
                return;
            try {
                const message = await db_1.default.message.findFirst({ where: { id: data.messageId }, select: { id: true, senderId: true, conversationId: true } });
                if (!message)
                    return;
                if (message.senderId !== tenant.userId) {
                    const member = await db_1.default.conversationMember.findFirst({ where: { conversationId: message.conversationId, userId: tenant.userId, role: { in: ['OWNER', 'ADMIN'] } } });
                    if (!member)
                        return;
                }
                if (data.deleteForEveryone !== false) {
                    await db_1.default.message.update({ where: { id: data.messageId }, data: { isDeleted: true, content: null } });
                    io.to(data.conversationId).emit('message_deleted', { messageId: data.messageId, conversationId: data.conversationId });
                }
                else {
                    socket.emit('message_deleted_for_me', { messageId: data.messageId, conversationId: data.conversationId });
                    await emitToUserExcept(io, tenant.userId, socket.id, 'message_deleted_for_me', { messageId: data.messageId, conversationId: data.conversationId });
                }
            }
            catch (err) {
                console.error('[Socket] delete_message error:', err);
            }
        });
        // ── Edit Message ───────────────────────────────────────────────────────
        socket.on('edit_message', async (data) => {
            const tenant = await getSocketData(socket.id);
            if (!tenant)
                return;
            try {
                const message = await db_1.default.message.findFirst({ where: { id: data.messageId, senderId: tenant.userId }, select: { id: true, conversationId: true } });
                if (!message)
                    return;
                const updated = await db_1.default.message.update({ where: { id: data.messageId }, data: { content: data.content, editedAt: new Date() } });
                io.to(data.conversationId).emit('message_edited', { messageId: data.messageId, conversationId: data.conversationId, content: data.content, editedAt: updated.editedAt });
            }
            catch (err) {
                console.error('[Socket] edit_message error:', err);
            }
        });
        // ── Pin / Unpin Message ────────────────────────────────────────────────
        socket.on('pin_message', async (data) => {
            const tenant = await getSocketData(socket.id);
            if (!tenant)
                return;
            try {
                const conversation = await db_1.default.conversation.findUnique({ where: { id: data.conversationId }, select: { isGroup: true } });
                if (!conversation)
                    return;
                if (conversation.isGroup) {
                    const member = await db_1.default.conversationMember.findFirst({ where: { conversationId: data.conversationId, userId: tenant.userId, role: { in: ['OWNER', 'ADMIN'] } }, select: { id: true } });
                    if (!member)
                        return;
                }
                else {
                    const member = await db_1.default.conversationMember.findFirst({ where: { conversationId: data.conversationId, userId: tenant.userId }, select: { id: true } });
                    if (!member)
                        return;
                }
                const existing = await db_1.default.pinnedMessage.findUnique({ where: { conversationId_messageId: { conversationId: data.conversationId, messageId: data.messageId } } });
                if (existing) {
                    await db_1.default.pinnedMessage.delete({ where: { conversationId_messageId: { conversationId: data.conversationId, messageId: data.messageId } } });
                    io.to(data.conversationId).emit('message_pinned', { messageId: data.messageId, conversationId: data.conversationId, pinnedBy: tenant.userId, isPinned: false });
                }
                else {
                    const pinned = await db_1.default.pinnedMessage.create({
                        data: { conversationId: data.conversationId, messageId: data.messageId, pinnedBy: tenant.userId },
                        include: { message: { select: { id: true, content: true, type: true, sender: { select: { full_name: true } } } } },
                    });
                    io.to(data.conversationId).emit('message_pinned', { messageId: data.messageId, conversationId: data.conversationId, pinnedBy: tenant.userId, isPinned: true, messageContent: pinned.message.content, senderName: pinned.message.sender.full_name, messageType: pinned.message.type });
                }
            }
            catch (err) {
                console.error('[Socket] pin_message error:', err);
            }
        });
        socket.on('typing', (data) => socket.to(data.conversationId).emit('user_typing', data));
        socket.on('mark_conversation_read', async (data) => {
            const tenant = await getSocketData(socket.id);
            if (!tenant || tenant.userId !== data.userId || !data.messageIds?.length)
                return;
            try {
                await Promise.allSettled(data.messageIds.map((messageId) => db_1.default.messageRead.upsert({
                    where: { messageId_userId: { messageId, userId: data.userId } },
                    update: { readAt: new Date() },
                    create: { messageId, userId: data.userId },
                })));
                socket.to(data.conversationId).emit('messages_read', { conversationId: data.conversationId, userId: data.userId, messageIds: data.messageIds });
                emitToUser(io, data.userId, 'conversation_read_ack', { conversationId: data.conversationId, userId: data.userId, messageIds: data.messageIds });
            }
            catch (err) {
                console.warn('[Socket] mark_conversation_read error (non-fatal):', err);
            }
        });
        // ── CALL: Initiate ─────────────────────────────────────────────────────
        socket.on('call_user', async (data) => {
            const tenant = await getSocketData(socket.id);
            if (!tenant || tenant.userId !== data.from)
                return;
            const [callerInfo, targetUser] = await Promise.all([
                db_1.default.user.findUnique({ where: { id: data.from }, select: { role: true, full_name: true } }),
                db_1.default.user.findFirst({ where: { id: data.to, is_active: true }, select: { id: true, role: true, pushToken: true } }),
            ]);
            if (!targetUser)
                return;
            const callId = data.callId || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            if (await isUserBusy(data.to)) {
                socket.emit('call_busy', { callId, from: data.to, to: data.from });
                (0, call_service_1.logCall)({ callId, userId: data.from, recipientId: data.to, conversationId: data.conversationId, type: data.type || 'VOICE', status: 'BUSY', endTime: new Date(), duration: 0, disconnectReason: 'BUSY' }).catch(() => { });
                return;
            }
            const callStartTime = Date.now();
            const timeoutHandle = setTimeout(async () => {
                const call = await getActiveCall(callId);
                if (call) {
                    await deleteActiveCall(callId, call.from, call.to);
                    emitToUser(io, call.from, 'call_missed', { callId, reason: 'NO_ANSWER' });
                    emitToUser(io, call.to, 'call_ended', { from: call.from, callId, reason: 'MISSED' });
                    (0, call_service_1.logCall)({ callId, userId: call.from, recipientId: call.to, conversationId: call.conversationId, type: call.type, status: 'MISSED', endTime: new Date(), duration: 0, disconnectReason: 'MISSED' }).catch(() => { });
                }
            }, 45000);
            localTimeoutHandles.set(callId, timeoutHandle);
            await setActiveCall({ callId, from: data.from, to: data.to, offer: data.offer, type: data.type || 'VOICE', profile: data.profile, conversationId: data.conversationId, startTime: String(callStartTime), timestamp: String(callStartTime) });
            await emitToUser(io, data.to, 'incoming_call', { from: data.from, offer: data.offer, type: data.type || 'VOICE', profile: data.profile, callId });
            if (targetUser.pushToken) {
                const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'https://zetime-backend-dmlv.onrender.com';
                (0, notification_service_1.sendCallNotification)(targetUser.pushToken, { callId, callerId: data.from, callerName: (data.profile?.name || callerInfo?.full_name || 'Unknown').slice(0, 64), callType: (data.type || 'VOICE'), serverUrl });
            }
        });
        socket.on('call_ringing', async (data) => { await emitToUser(io, data.to, 'call_ringing', { from: data.from }); });
        // ── CALL: Answer ───────────────────────────────────────────────────────
        socket.on('answer_call', async (data) => {
            const tenant = await getSocketData(socket.id);
            if (!tenant)
                return;
            await emitToUser(io, data.to, 'call_answered', { from: data.from, answer: data.answer });
            await emitToUserExcept(io, data.from, socket.id, 'call_stop_ringing', { callId: data.callId });
            if (data.callId)
                await deleteActiveCall(data.callId, data.from, data.to);
            else {
                const call = await getActiveCallForUsers(data.from, data.to);
                if (call)
                    await deleteActiveCall(call.callId, call.from, call.to);
            }
        });
        socket.on('ice_candidate', async (data) => { await emitToUser(io, data.to, 'ice_candidate', { from: data.from, candidate: data.candidate }); });
        socket.on('ice_restart', async (data) => { await emitToUser(io, data.to, 'ice_restart', { from: data.from, offer: data.offer }); });
        socket.on('ice_restart_answer', async (data) => { await emitToUser(io, data.to, 'ice_restart_answer', { from: data.from, answer: data.answer }); });
        socket.on('media_state_change', async (data) => { await emitToUser(io, data.to, 'media_state_changed', { from: data.from, isCameraOff: data.isCameraOff, isMuted: data.isMuted }); });
        // ── CALL: Reject ───────────────────────────────────────────────────────
        socket.on('reject_call', async (data) => {
            const tenant = await getSocketData(socket.id);
            if (!tenant)
                return;
            await emitToUser(io, data.to, 'call_rejected', { from: data.from, callId: data.callId });
            await emitToUserExcept(io, data.from, socket.id, 'call_stop_ringing', { callId: data.callId });
            let rejectedCall = data.callId ? await getActiveCall(data.callId) : null;
            if (!rejectedCall)
                rejectedCall = await getActiveCallForUsers(data.from, data.to);
            if (data.callId)
                await deleteActiveCall(data.callId, data.from, data.to);
            else if (rejectedCall)
                await deleteActiveCall(rejectedCall.callId, rejectedCall.from, rejectedCall.to);
            const targetUserForReject = await db_1.default.user.findUnique({ where: { id: data.to }, select: { pushToken: true } });
            if (targetUserForReject?.pushToken)
                (0, notification_service_1.sendCallCancellation)(targetUserForReject.pushToken, data.callId || '');
            (0, call_service_1.logCall)({ callId: data.callId, userId: data.from, recipientId: data.to, conversationId: data.conversationId || rejectedCall?.conversationId, type: data.type || rejectedCall?.type || 'VOICE', status: 'DECLINED', endTime: new Date(), duration: 0, disconnectReason: 'DECLINED' }).catch(err => console.warn('[Socket] reject logCall error:', err));
            const rejectConvId = data.conversationId || rejectedCall?.conversationId;
            if (rejectConvId) {
                const msg = await db_1.default.message.create({ data: { conversationId: rejectConvId, senderId: data.from, content: data.reason === 'MISSED' ? 'Missed Call' : 'Declined Call', type: data.type === 'VIDEO' ? 'CALL_MISSED_VIDEO' : 'CALL_MISSED_VOICE', metadata: { reason: data.reason || 'DECLINED' } } });
                io.to(rejectConvId).emit('new_message', msg);
            }
        });
        // ── CALL: End ──────────────────────────────────────────────────────────
        socket.on('end_call', async (data) => {
            const tenant = await getSocketData(socket.id);
            if (!tenant)
                return;
            await emitToUser(io, data.to, 'call_ended', { from: data.from, callId: data.callId });
            if (data.callId)
                await deleteActiveCall(data.callId, data.from, data.to);
            else {
                const call = await getActiveCallForUsers(data.from, data.to);
                if (call)
                    await deleteActiveCall(call.callId, call.from, call.to);
            }
            const targetUser = await db_1.default.user.findUnique({ where: { id: data.to }, select: { pushToken: true } });
            if (targetUser?.pushToken)
                (0, notification_service_1.sendCallCancellation)(targetUser.pushToken, data.callId || '');
            const durationSecs = typeof data.duration === 'number' ? Math.round(data.duration) : 0;
            const answerTime = data.answerTime ? new Date(data.answerTime) : undefined;
            const callStatus = data.reason === 'CANCELLED' ? 'CANCELLED' : data.reason === 'MISSED' ? 'MISSED' : durationSecs > 0 ? 'ANSWERED' : 'CANCELLED';
            (0, call_service_1.logCall)({ callId: data.callId, userId: data.from, recipientId: data.to, conversationId: data.conversationId, type: data.type || 'VOICE', status: callStatus, duration: durationSecs, answerTime, endTime: new Date(), disconnectReason: data.reason || 'ENDED', networkQuality: data.networkQuality }).catch(err => console.warn('[Socket] end_call logCall error:', err));
            if (data.conversationId) {
                let content = 'Call ended';
                let msgType = data.type === 'VIDEO' ? 'CALL_VIDEO' : 'CALL_VOICE';
                if (data.reason === 'CANCELLED') {
                    content = 'Canceled Call';
                    msgType = data.type === 'VIDEO' ? 'CALL_MISSED_VIDEO' : 'CALL_MISSED_VOICE';
                }
                else if (data.reason === 'MISSED') {
                    content = 'Missed Call';
                    msgType = data.type === 'VIDEO' ? 'CALL_MISSED_VIDEO' : 'CALL_MISSED_VOICE';
                }
                const msg = await db_1.default.message.create({ data: { conversationId: data.conversationId, senderId: data.from, content, type: msgType, metadata: { duration: data.duration, reason: data.reason } } });
                io.to(data.conversationId).emit('new_message', msg);
            }
        });
        // ── Disconnect ─────────────────────────────────────────────────────────
        socket.on('disconnect', async () => {
            const tenant = await getSocketData(socket.id);
            if (tenant) {
                const { userId } = tenant;
                const { fullyOffline } = await removeUserSocket(userId, socket.id);
                if (fullyOffline)
                    await emitPresenceToMates(io, 'user_offline', userId, socket.id);
            }
        });
    });
    return io;
};
exports.initSocket = initSocket;
