import prisma from '../config/db';
import { getIO } from '../socket';
import { sendCategoryNotification } from './notification.service';

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationCategory {
  ATTENDANCE = 'ATTENDANCE',
  DISCIPLINE = 'DISCIPLINE',
  ACADEMIC = 'ACADEMIC',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  SYSTEM = 'SYSTEM',
  MESSAGE = 'MESSAGE',
  GENERAL = 'GENERAL',
}

export interface CreateUserNotificationParams {
  userId: string;
  schoolId?: string;
  type?: string;
  category?: NotificationCategory | string;
  priority?: NotificationPriority | string;
  title: string;
  message: string;
  targetRole?: string;
  metadata?: Record<string, any> | string;
}

export interface CreateParentNotificationParams {
  studentId?: string;
  schoolId?: string;
  type?: string;
  category?: NotificationCategory | string;
  priority?: NotificationPriority | string;
  title: string;
  message: string;
  targetRole?: string;
  metadata?: Record<string, any> | string;
}

/**
 * Unified Dispatcher Service for User & Parent Notifications with Real-time Socket & Native FCM Push.
 */
export class UnifiedNotificationService {
  /**
   * Dispatch a notification to a specific school portal user (admin, teacher, staff).
   * Persists to DB, emits real-time Socket.IO, and sends native FCM push notification if device is registered.
   */
  static async sendToUser(params: CreateUserNotificationParams) {
    const {
      userId,
      schoolId,
      type = 'INFO',
      category = NotificationCategory.GENERAL,
      priority = NotificationPriority.NORMAL,
      title,
      message,
      targetRole,
      metadata,
    } = params;

    const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;

    const notification = await (prisma as any).userNotification.create({
      data: {
        userId,
        type,
        category,
        priority,
        title,
        message,
        targetRole,
        metadata: metadataStr,
      },
    });

    // 1. Socket.IO Real-time Emit
    try {
      const io = getIO();
      if (io) {
        io.to(`user_${userId}`).emit('new_notification', notification);
        io.emit('new_notification', notification);
      }
    } catch (e) {
      // Socket fail-safe
    }

    // 2. Native Push Delivery (Firebase Cloud Messaging)
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pushToken: true, is_active: true },
      });

      if (user?.is_active && user.pushToken) {
        const route = '/notifications';

        const result = await sendCategoryNotification(user.pushToken, {
          type: String(category).toLowerCase(),
          title,
          body: message,
          route,
          schoolId,
          categoryLabel: String(category),
          tag: `user-notif-${notification.id}`,
        });

        if (result === 'EXPIRED_TOKEN') {
          await prisma.user.update({
            where: { id: userId },
            data: { pushToken: null },
          }).catch(() => {});
        }
      }
    } catch (pushErr) {
      console.error(`[UnifiedNotificationService] FCM push to user ${userId} error:`, pushErr);
    }

    return notification;
  }

  /**
   * Dispatch a notification to a parent (or parents of a student).
   * Persists to DB, emits real-time Socket.IO, and sends native FCM push notifications to linked parent devices.
   */
  static async sendToParent(params: CreateParentNotificationParams) {
    const {
      studentId,
      schoolId,
      type = 'announcement',
      category = NotificationCategory.GENERAL,
      priority = NotificationPriority.NORMAL,
      title,
      message,
      targetRole,
      metadata,
    } = params;

    const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;

    const notification = await (prisma as any).parentNotification.create({
      data: {
        studentId,
        type,
        category,
        priority,
        title,
        message,
        targetRole,
        metadata: metadataStr,
      },
    });

    // 1. Socket.IO Real-time Emit
    try {
      const io = getIO();
      if (io) {
        io.emit('new_notification', notification);
      }
    } catch (e) {
      // Socket fail-safe
    }

    // 2. Native Push Delivery (Firebase Cloud Messaging)
    try {
      const settings = await prisma.schoolSettings.findFirst({
        select: { school_name: true },
      });
      const schoolName = settings?.school_name || 'Bright Path';

      if (studentId) {
        // Targeted parent notification for a specific student
        const links = await prisma.parentStudentLink.findMany({
          where: { studentId },
          include: {
            parent: {
              select: { id: true, phone: true, pushToken: true },
            },
          },
        });

        for (const link of links) {
          const parent = link.parent;
          if (parent?.pushToken) {
            if (parent.phone) {
              const prefs = await prisma.parentPreferences.findUnique({
                where: { parentPhone: parent.phone },
              });
              if (prefs && !prefs.pushNotifications) {
                continue;
              }
            }

            const route = category === NotificationCategory.ATTENDANCE
              ? '/parent/attendance'
              : category === NotificationCategory.DISCIPLINE
              ? '/parent/discipline'
              : '/parent/announcements';

            const result = await sendCategoryNotification(parent.pushToken, {
              type: String(category).toLowerCase(),
              title: schoolName,
              body: message,
              route,
              studentId,
              schoolId,
              schoolName,
              categoryLabel: String(category),
              tag: `parent-notif-${notification.id}`,
            });

            if (result === 'EXPIRED_TOKEN') {
              await prisma.parent.update({
                where: { id: parent.id },
                data: { pushToken: null },
              }).catch(() => {});
            }
          }
        }
      } else if (targetRole === 'ALL_PARENTS') {
        // Broadcast push notification to all parents registered with push tokens
        const allParents = await prisma.parent.findMany({
          where: { pushToken: { not: null } },
          select: { id: true, phone: true, pushToken: true },
        });

        const CHUNK_SIZE = 50;
        for (let i = 0; i < allParents.length; i += CHUNK_SIZE) {
          const chunk = allParents.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(async (parent) => {
              if (!parent.pushToken) return;

              if (parent.phone) {
                const prefs = await prisma.parentPreferences.findUnique({
                  where: { parentPhone: parent.phone },
                });
                if (prefs && !prefs.pushNotifications) {
                  return;
                }
              }

              const result = await sendCategoryNotification(parent.pushToken, {
                type: 'new_announcement',
                title: schoolName,
                body: message,
                route: '/parent/announcements',
                schoolId,
                schoolName,
                categoryLabel: 'Announcement',
                tag: `broadcast-parent-${notification.id}`,
              });

              if (result === 'EXPIRED_TOKEN') {
                await prisma.parent.update({
                  where: { id: parent.id },
                  data: { pushToken: null },
                }).catch(() => {});
              }
            })
          );
        }
      }
    } catch (parentPushErr) {
      console.error('[UnifiedNotificationService] FCM push to parent error:', parentPushErr);
    }

    return notification;
  }

  /**
   * Broadcast a notification to a specific user role or all parents.
   * Uses chunked concurrent processing to handle large recipient bases safely.
   */
  static async broadcastRole(params: {
    schoolId?: string;
    targetRole: 'ALL_PARENTS' | 'ALL_TEACHERS' | 'SCHOOL_ADMINS' | 'ALL_STAFF';
    type?: string;
    category?: NotificationCategory | string;
    priority?: NotificationPriority | string;
    title: string;
    message: string;
    metadata?: Record<string, any> | string;
  }) {
    const {
      schoolId,
      targetRole,
      type = 'ANNOUNCEMENT',
      category = NotificationCategory.ANNOUNCEMENT,
      priority = NotificationPriority.NORMAL,
      title,
      message,
      metadata,
    } = params;

    if (targetRole === 'ALL_PARENTS') {
      return this.sendToParent({
        schoolId,
        type: 'announcement',
        category,
        priority,
        title,
        message,
        targetRole: 'ALL_PARENTS',
        metadata,
      });
    }

    const whereClause: any = {
      is_active: true,
      ...(schoolId ? { schoolId } : {}),
    };

    if (targetRole === 'ALL_TEACHERS') {
      whereClause.role = 'teacher';
    } else if (targetRole === 'SCHOOL_ADMINS') {
      whereClause.role = { in: ['school_admin', 'super_admin'] };
    } else if (targetRole === 'ALL_STAFF') {
      whereClause.role = { in: ['teacher', 'school_admin', 'super_admin', 'staff', 'academic_head'] };
    }

    const users = await (prisma as any).user.findMany({
      where: whereClause,
      select: { id: true },
    });

    const results: any[] = [];
    const CHUNK_SIZE = 50;

    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const chunk = users.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map((u: any) =>
          this.sendToUser({
            userId: u.id,
            schoolId,
            type,
            category,
            priority,
            title,
            message,
            targetRole,
            metadata,
          })
        )
      );
      results.push(...chunkResults);
    }

    return results;
  }
}
