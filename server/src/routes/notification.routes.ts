import { Router, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { UnifiedNotificationService } from '../services/unified-notification.service';

const router = Router();

// GET /api/notifications — fetch notifications for the authenticated user
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { category, priority, search, isRead } = req.query;

    const whereClause: any = {
      userId,
      ...(schoolId ? { schoolId } : {}),
    };

    if (category && category !== 'ALL') {
      whereClause.category = String(category);
    }
    if (priority && priority !== 'ALL') {
      whereClause.priority = String(priority);
    }
    if (isRead !== undefined && isRead !== '') {
      whereClause.isRead = isRead === 'true';
    }
    if (search && typeof search === 'string') {
      whereClause.OR = [
        { title: { contains: search } },
        { message: { contains: search } },
      ];
    }

    const notifications = await (prisma as any).userNotification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const unreadCount = await (prisma as any).userNotification.count({
      where: { userId, ...(schoolId ? { schoolId } : {}), isRead: false },
    });

    res.status(200).json({ success: true, data: notifications, unreadCount });
  } catch (error) { next(error); }
});

// POST /api/notifications — dispatch a new notification (Admins / Staff only)
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (!['school_admin', 'super_admin', 'discipline_officer', 'teacher'].includes(role || '')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const { targetUserId, targetRole, studentId, title, message, category, priority, metadata } = req.body;
    const schoolId = req.user?.schoolId;

    if (targetRole) {
      const result = await UnifiedNotificationService.broadcastRole({
        schoolId,
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
        schoolId,
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
        schoolId,
        title,
        message,
        category,
        priority,
        metadata,
      });
      return res.status(201).json({ success: true, data: result });
    }

    return res.status(400).json({ success: false, message: 'Target specification required (targetUserId, targetRole, or studentId)' });
  } catch (error) { next(error); }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const notification = await (prisma as any).userNotification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updated = await (prisma as any).userNotification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await (prisma as any).userNotification.updateMany({
      where: { userId, ...(schoolId ? { schoolId } : {}), isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({ success: true });
  } catch (error) { next(error); }
});

// DELETE /api/notifications/:id — delete one notification
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const notification = await (prisma as any).userNotification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await (prisma as any).userNotification.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true });
  } catch (error) { next(error); }
});

// DELETE /api/notifications/clear-all — clear all notifications
router.delete('/clear-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await (prisma as any).userNotification.deleteMany({
      where: { userId, ...(schoolId ? { schoolId } : {}) },
    });

    res.status(200).json({ success: true });
  } catch (error) { next(error); }
});

export default router;
