import prisma from '../config/db';
import { getIO } from '../socket';

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
 * Unified Dispatcher Service for User & Parent Notifications.
 */
export class UnifiedNotificationService {
  static async sendToUser(params: CreateUserNotificationParams) {
    const {
      userId,
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

    try {
      const io = getIO();
      if (io) {
        io.to(`user_${userId}`).emit('new_notification', notification);
        io.emit('new_notification', notification);
      }
    } catch (e) {
      // Socket fail-safe
    }

    return notification;
  }

  static async sendToParent(params: CreateParentNotificationParams) {
    const {
      studentId,
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

    try {
      const io = getIO();
      if (io) {
        io.emit('new_notification', notification);
      }
    } catch (e) {
      // Socket fail-safe
    }

    return notification;
  }

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
    const { targetRole, type = 'ANNOUNCEMENT', category = NotificationCategory.ANNOUNCEMENT, priority = NotificationPriority.NORMAL, title, message, metadata } = params;

    if (targetRole === 'ALL_PARENTS') {
      return this.sendToParent({
        type: 'announcement',
        category,
        priority,
        title,
        message,
        targetRole: 'ALL_PARENTS',
        metadata,
      });
    }

    const users = await (prisma as any).user.findMany({
      where: {
        ...(targetRole === 'ALL_TEACHERS' ? { role: 'teacher' } : {}),
        ...(targetRole === 'SCHOOL_ADMINS' ? { role: 'school_admin' } : {}),
      },
      select: { id: true },
    });

    const notifications = await Promise.all(
      users.map((u: any) =>
        this.sendToUser({
          userId: u.id,
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

    return notifications;
  }
}
