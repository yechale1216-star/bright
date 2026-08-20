import prisma from '../config/db';

export interface LogCallParams {
  callId?: string;
  userId: string;       // caller
  recipientId: string;  // callee
  conversationId?: string;
  type: string;         // VOICE | VIDEO
  status: string;       // ANSWERED | MISSED | DECLINED | CANCELLED | FAILED | BUSY
  duration?: number;    // seconds
  answerTime?: Date;
  endTime?: Date;
  disconnectReason?: string;
  networkQuality?: string;
}

export const logCall = async (params: LogCallParams) => {
  const now = new Date();

  let session;
  if (params.callId) {
    session = await prisma.callSession.upsert({
      where: { callId: params.callId },
      create: {
        callId: params.callId,
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
            { userId: params.userId },
            { userId: params.recipientId },
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
  } else {
    session = await prisma.callSession.create({
      data: {
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
            { userId: params.userId },
            { userId: params.recipientId },
          ],
        },
      },
    });
  }

  const historyEntry = await prisma.callHistory.create({
    data: {
      callId: params.callId,
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

export const getCallHistory = async (_schoolId?: string, userId?: string, limit = 100) => {
  const historyRecords = await prisma.callHistory.findMany({
    where: {
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

  const recipientIds = Array.from(
    new Set(historyRecords.map((r) => r.recipientId).filter(Boolean))
  ) as string[];

  const recipientUsers = recipientIds.length > 0
    ? await prisma.user.findMany({
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
