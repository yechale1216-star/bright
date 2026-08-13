"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCallHistory = exports.logCall = void 0;
const db_1 = __importDefault(require("../config/db"));
/**
 * Create a complete call log entry including a CallSession record and
 * a CallHistory record for the initiating user. All new fields are stored.
 */
const logCall = async (params) => {
    const now = new Date();
    // Create (or upsert by callId) the session record
    let session;
    if (params.callId) {
        session = await db_1.default.callSession.upsert({
            where: { callId: params.callId },
            create: {
                callId: params.callId,
                schoolId: params.schoolId,
                conversationId: params.conversationId,
                type: params.type,
                status: params.status,
                startTime: now,
                answerTime: params.answerTime,
                endTime: params.endTime ?? now,
                duration: params.duration ?? 0,
                disconnectReason: params.disconnectReason,
                networkQuality: params.networkQuality,
                participants: {
                    create: [
                        { userId: params.userId, schoolId: params.schoolId },
                        { userId: params.recipientId, schoolId: params.schoolId },
                    ],
                },
            },
            update: {
                status: params.status,
                endTime: params.endTime ?? now,
                duration: params.duration ?? 0,
                answerTime: params.answerTime,
                disconnectReason: params.disconnectReason,
                networkQuality: params.networkQuality,
            },
        });
    }
    else {
        session = await db_1.default.callSession.create({
            data: {
                schoolId: params.schoolId,
                conversationId: params.conversationId,
                type: params.type,
                status: params.status,
                startTime: now,
                answerTime: params.answerTime,
                endTime: params.endTime ?? now,
                duration: params.duration ?? 0,
                disconnectReason: params.disconnectReason,
                networkQuality: params.networkQuality,
                participants: {
                    create: [
                        { userId: params.userId, schoolId: params.schoolId },
                        { userId: params.recipientId, schoolId: params.schoolId },
                    ],
                },
            },
        });
    }
    // Log CallHistory for the caller
    const historyEntry = await db_1.default.callHistory.create({
        data: {
            callId: params.callId,
            schoolId: params.schoolId,
            userId: params.userId,
            recipientId: params.recipientId,
            callSessionId: session.id,
            type: params.type,
            status: params.status,
            duration: params.duration ?? 0,
            answerTime: params.answerTime,
            endTime: params.endTime ?? now,
            disconnectReason: params.disconnectReason,
        },
        include: {
            user: { select: { id: true, full_name: true, profile_photo: true } },
            callSession: {
                include: {
                    participants: {
                        include: {
                            user: { select: { id: true, full_name: true, profile_photo: true, role: true } },
                        },
                    },
                },
            },
        },
    });
    return historyEntry;
};
exports.logCall = logCall;
/**
 * Fetch call history for a user within their school,
 * ordered by most recent first.
 */
const getCallHistory = async (schoolId, userId, limit = 100) => {
    const historyRecords = await db_1.default.callHistory.findMany({
        where: {
            schoolId,
            ...(userId ? { OR: [{ userId }, { recipientId: userId }] } : {}),
        },
        include: {
            user: { select: { id: true, full_name: true, phone: true, profile_photo: true, role: true } },
            callSession: {
                include: {
                    participants: {
                        include: {
                            user: {
                                select: { id: true, full_name: true, phone: true, profile_photo: true, role: true },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
    // Extract recipient IDs to resolve user names and phone numbers
    const recipientIds = Array.from(new Set(historyRecords.map((r) => r.recipientId).filter(Boolean)));
    const recipientUsers = recipientIds.length > 0
        ? await db_1.default.user.findMany({
            where: { id: { in: recipientIds } },
            select: { id: true, full_name: true, phone: true, role: true, profile_photo: true }
        })
        : [];
    const recipientMap = new Map(recipientUsers.map((u) => [u.id, u]));
    return historyRecords.map((r) => {
        const recipientUser = r.recipientId ? recipientMap.get(r.recipientId) : null;
        return {
            ...r,
            recipientUser,
            recipientName: recipientUser?.full_name || (r.recipientId ? `Contact (${r.recipientId.slice(0, 8)})` : 'Parent / Contact'),
            recipientPhone: recipientUser?.phone || null,
            recipientRole: recipientUser?.role || 'parent',
            callerName: r.user?.full_name || 'Call Center Agent',
            callerRole: r.user?.role || 'discipline_officer',
        };
    });
};
exports.getCallHistory = getCallHistory;
