import { Router, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { UnifiedNotificationService } from '../services/unified-notification.service';

const router = Router();

/**
 * Role-to-Categories Mapping
 * Dictates which notification categories each role is authorized to access and view.
 */
export const ROLE_ALLOWED_CATEGORIES: Record<string, string[]> = {
  super_admin: ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'ATTENDANCE', 'ACADEMIC', 'DISCIPLINE', 'SYSTEM', 'GENERAL'],
  school_admin: ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'ATTENDANCE', 'ACADEMIC', 'DISCIPLINE', 'SYSTEM', 'GENERAL'],
  admin: ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'ATTENDANCE', 'ACADEMIC', 'DISCIPLINE', 'SYSTEM', 'GENERAL'],
  academic_head: ['ALL', 'UNREAD', 'ACADEMIC', 'ANNOUNCEMENT', 'ATTENDANCE', 'SYSTEM', 'GENERAL'],
  teacher: ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'ACADEMIC', 'ATTENDANCE', 'GENERAL'],
  discipline_officer: ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'ATTENDANCE', 'SYSTEM', 'GENERAL'],
  registrar: ['ALL', 'UNREAD', 'ACADEMIC', 'ANNOUNCEMENT', 'ATTENDANCE', 'SYSTEM', 'GENERAL'],
  staff_attendance_officer: ['ALL', 'UNREAD', 'ATTENDANCE', 'ANNOUNCEMENT', 'SYSTEM', 'GENERAL'],
  hr_officer: ['ALL', 'UNREAD', 'ATTENDANCE', 'ANNOUNCEMENT', 'SYSTEM', 'GENERAL'],
  librarian: ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'SYSTEM', 'GENERAL'],
  transport_manager: ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'ATTENDANCE', 'SYSTEM', 'GENERAL'],
  parent: ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'ATTENDANCE', 'ACADEMIC', 'DISCIPLINE', 'GENERAL'],
  student: ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'ACADEMIC', 'ATTENDANCE', 'GENERAL'],
};

const DEFAULT_STAFF_CATEGORIES = ['ALL', 'UNREAD', 'ANNOUNCEMENT', 'ATTENDANCE', 'SYSTEM', 'GENERAL'];

// GET /api/notifications — fetch paginated notifications for the authenticated user with role-based category authorization
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const role = (req.user?.role || '').toLowerCase();
    const allowedCategories = ROLE_ALLOWED_CATEGORIES[role] || DEFAULT_STAFF_CATEGORIES;

    const { category, priority, search, isRead, page: reqPage, limit: reqLimit } = req.query;

    const page = Math.max(1, parseInt(String(reqPage)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(reqLimit)) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      userId,
    };

    if (category && category !== 'ALL') {
      const requestedCat = String(category).toUpperCase();
      // Role authorization check: user cannot request categories outside their role permissions
      if (!allowedCategories.includes(requestedCat)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Role '${role}' is not authorized to view '${requestedCat}' notifications.`,
          allowedCategories: allowedCategories.filter((c) => c !== 'ALL' && c !== 'UNREAD'),
        });
      }
      whereClause.category = requestedCat;
    } else {
      // If viewing ALL, constrain by role-allowed categories so unauthorized categories never leak
      const filterableCategories = allowedCategories.filter((c) => c !== 'ALL' && c !== 'UNREAD');
      whereClause.category = { in: filterableCategories };
    }

    if (priority && priority !== 'ALL') {
      whereClause.priority = String(priority);
    }
    if (isRead !== undefined && isRead !== '') {
      whereClause.isRead = isRead === 'true';
    }
    if (search && typeof search === 'string' && search.trim() !== '') {
      whereClause.OR = [
        { title: { contains: search } },
        { message: { contains: search } },
      ];
    }

    const [totalCount, notifications, unreadCount] = await Promise.all([
      (prisma as any).userNotification.count({ where: whereClause }),
      (prisma as any).userNotification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).userNotification.count({
        where: { userId, isRead: false },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.status(200).json({
      success: true,
      data: notifications,
      totalCount,
      totalPages,
      page,
      limit,
      unreadCount,
      allowedCategories: allowedCategories.filter((c) => c !== 'ALL' && c !== 'UNREAD'),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/:id — fetch a single notification with user-isolation check
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const notification = await (prisma as any).userNotification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot access another user\'s notification.' });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications — dispatch a new notification (Admins / Staff only)
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (!['school_admin', 'super_admin', 'discipline_officer', 'teacher'].includes(role || '')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const { targetUserId, targetRole, studentId, title, message, category, priority, metadata } = req.body;

    if (category === 'DISCIPLINE' && !['school_admin', 'super_admin', 'admin'].includes(role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only school admin can manage discipline notifications' });
    }

    if (targetRole) {
      const result = await UnifiedNotificationService.broadcastRole({
        targetRole,
        title,
        message,
        category,
        priority,
        metadata,
      });
      return res.status(201).json({ success: true, data: result });
    }

    if (studentId) {
      const result = await UnifiedNotificationService.sendToParent({
        studentId,
        title,
        message,
        category,
        priority,
        metadata,
      });
      return res.status(201).json({ success: true, data: result });
    }

    if (targetUserId) {
      const result = await UnifiedNotificationService.sendToUser({
        userId: targetUserId,
        title,
        message,
        category,
        priority,
        metadata,
      });
      return res.status(201).json({ success: true, data: result });
    }

    return res.status(400).json({ success: false, message: 'Target specification required (targetUserId, targetRole, or studentId)' });
  } catch (error) {
    next(error);
  }
});

// Mark single as read handler (supports PATCH and PUT)
const markSingleRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const notification = await (prisma as any).userNotification.findUnique({ where: { id: req.params.id } });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notification.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updated = await (prisma as any).userNotification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

router.patch('/:id/read', markSingleRead);
router.put('/:id/read', markSingleRead);

// Mark all as read handler (supports PATCH and PUT for /read-all and /mark-all-read)
const markAllRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await (prisma as any).userNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

router.patch('/read-all', markAllRead);
router.put('/read-all', markAllRead);
router.patch('/mark-all-read', markAllRead);
router.put('/mark-all-read', markAllRead);

// DELETE /api/notifications/:id — delete one notification
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const notification = await (prisma as any).userNotification.findUnique({ where: { id: req.params.id } });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notification.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await (prisma as any).userNotification.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/clear-all — clear all notifications
router.delete('/clear-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await (prisma as any).userNotification.deleteMany({
      where: { userId },
    });

    res.status(200).json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    next(error);
  }
});

export default router;
