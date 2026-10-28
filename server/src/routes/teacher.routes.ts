import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/auth.middleware';
import { teacherAccessService, TeacherAccountStatus, ALLOWED_STATUS_TRANSITIONS } from '../services/teacher-access.service';
import prisma from '../config/db';

const router = Router();

// GET /api/teachers - List teachers with employment status
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, search } = req.query as { status?: string; search?: string };
    const where: any = {};

    if (status === 'active') {
      where.employmentStatus = 'ACTIVE';
      where.is_active = true;
    } else if (status === 'terminated') {
      where.OR = [
        { employmentStatus: 'TERMINATED' },
        { employmentStatus: 'FIRED' },
        { is_active: false },
      ];
    }

    if (search && search.trim()) {
      where.OR = [
        ...(where.OR || []),
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim() } },
      ];
    }

    const teachers = await prisma.teacher.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        qualification: true,
        experience_years: true,
        is_active: true,
        user_id: true,
        profile_photo: true,
        employmentStatus: true,
        terminationEffectiveDate: true,
        terminationReason: true,
        terminatedBy: true,
        reinstatedDate: true,
        reinstatedBy: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { assignments: true },
        },
      },
    });

    res.status(200).json({ success: true, data: teachers });
  } catch (error) {
    next(error);
  }
});

// GET /api/teachers/:id/status - Get teacher employment and assignment status
router.get('/:id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const access = await teacherAccessService.validateTeacherActiveAccess(id);
    res.status(200).json({
      success: true,
      data: {
        allowed: access.allowed,
        code: access.code,
        message: access.message,
        teacher: access.teacher,
        currentYear: access.currentYear,
        assignmentsCount: access.assignments?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/teachers/:id/terminate - Terminate or fire a teacher with immediate session revocation
router.post(
  '/:id/terminate',
  authorize(['admin', 'school_admin', 'super_admin']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason, effectiveDate } = req.body;
      const adminId = req.user?.id || 'admin';
      const adminEmail = req.user?.email;

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Termination reason is required.',
        });
      }

      const result = await teacherAccessService.terminateTeacher(id, {
        reason: reason.trim(),
        effectiveDate,
        adminId,
        adminEmail,
      });

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to terminate teacher.' });
    }
  }
);

// POST /api/teachers/:id/reinstate - Reinstate an inactive/terminated teacher
router.post(
  '/:id/reinstate',
  authorize(['admin', 'school_admin', 'super_admin']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id || 'admin';

      const result = await teacherAccessService.reinstateTeacher(id, {
        reason,
        adminId,
      });

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to reinstate teacher.' });
    }
  }
);

// GET /api/teachers/:id/account-status - Get teacher account status and allowed transitions
router.get(
  '/:id/account-status',
  authorize(['admin', 'school_admin', 'super_admin', 'teacher']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { user, teacher } = await teacherAccessService.resolveTeacherProfile(id);
      if (!user && !teacher) {
        return res.status(404).json({ success: false, message: 'Teacher not found' });
      }
      const currentStatus = (user?.employmentStatus || teacher?.employmentStatus || (user?.is_active === false ? 'SUSPENDED' : 'ACTIVE')) as TeacherAccountStatus;
      const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
      res.status(200).json({
        success: true,
        data: {
          currentStatus,
          allowedTransitions,
          is_active: user?.is_active ?? teacher?.is_active ?? true,
          suspensionReason: (teacher as any)?.suspensionReason || null,
          statusChangedAt: (teacher as any)?.statusChangedAt || null,
          statusChangedBy: (teacher as any)?.statusChangedBy || null,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
);

// POST /api/teachers/:id/suspend - Suspend teacher account with immediate session revocation
router.post(
  '/:id/suspend',
  authorize(['admin', 'school_admin', 'super_admin']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id || 'admin';
      const adminEmail = req.user?.email;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Suspension reason is required.' });
      }

      const result = await teacherAccessService.changeAccountStatus(id, {
        newStatus: 'SUSPENDED',
        reason: reason.trim(),
        adminId,
        adminEmail,
      });

      res.status(200).json({
        success: true,
        message: 'Teacher has been suspended and sessions revoked.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to suspend teacher.' });
    }
  }
);

// POST /api/teachers/:id/reactivate - Reactivate teacher account
router.post(
  '/:id/reactivate',
  authorize(['admin', 'school_admin', 'super_admin']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id || 'admin';
      const adminEmail = req.user?.email;

      const result = await teacherAccessService.changeAccountStatus(id, {
        newStatus: 'ACTIVE',
        reason: reason?.trim() || 'Reactivated by administrator',
        adminId,
        adminEmail,
      });

      res.status(200).json({
        success: true,
        message: 'Teacher account reactivated successfully.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to reactivate teacher.' });
    }
  }
);

// POST /api/teachers/:id/approve - Approve pending teacher account
router.post(
  '/:id/approve',
  authorize(['admin', 'school_admin', 'super_admin']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id || 'admin';
      const adminEmail = req.user?.email;

      const result = await teacherAccessService.changeAccountStatus(id, {
        newStatus: 'ACTIVE',
        reason: reason?.trim() || 'Approved by administrator',
        adminId,
        adminEmail,
      });

      res.status(200).json({
        success: true,
        message: 'Teacher account approved successfully.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to approve teacher.' });
    }
  }
);

// POST /api/teachers/:id/deactivate - Deactivate teacher account with immediate session revocation
router.post(
  '/:id/deactivate',
  authorize(['admin', 'school_admin', 'super_admin']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id || 'admin';
      const adminEmail = req.user?.email;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Deactivation reason is required.' });
      }

      const result = await teacherAccessService.changeAccountStatus(id, {
        newStatus: 'DEACTIVATED',
        reason: reason.trim(),
        adminId,
        adminEmail,
      });

      res.status(200).json({
        success: true,
        message: 'Teacher account deactivated and sessions revoked.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to deactivate teacher.' });
    }
  }
);

// POST /api/teachers/:id/set-pending - Set teacher account to pending approval
router.post(
  '/:id/set-pending',
  authorize(['admin', 'school_admin', 'super_admin']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id || 'admin';
      const adminEmail = req.user?.email;

      const result = await teacherAccessService.changeAccountStatus(id, {
        newStatus: 'PENDING_APPROVAL',
        reason: reason?.trim() || 'Set to pending approval by administrator',
        adminId,
        adminEmail,
      });

      res.status(200).json({
        success: true,
        message: 'Teacher account status changed to Pending Approval.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to set teacher to pending approval.' });
    }
  }
);

// GET /api/teachers/:id/audit-history - Get teacher account status audit history
router.get(
  '/:id/audit-history',
  authorize(['admin', 'school_admin', 'super_admin']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { user, teacher } = await teacherAccessService.resolveTeacherProfile(id);
      const targetIds = [id];
      if (teacher?.id && !targetIds.includes(teacher.id)) targetIds.push(teacher.id);
      if (user?.id && !targetIds.includes(user.id)) targetIds.push(user.id);

      const logs = await prisma.auditLog.findMany({
        where: {
          entity_type: { in: ['Teacher', 'User'] },
          entity_id: { in: targetIds },
          action: { in: ['TEACHER_STATUS_CHANGED', 'TEACHER_SUSPENDED', 'TEACHER_TERMINATED', 'TEACHER_REINSTATED'] },
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });

      // Enrich logs with admin name
      const adminUserIds = Array.from(new Set(logs.map(l => l.user_id).filter(Boolean))) as string[];
      const adminUsers = await prisma.user.findMany({
        where: { id: { in: adminUserIds } },
        select: { id: true, full_name: true, email: true },
      });
      const adminMap = new Map(adminUsers.map(u => [u.id, u]));

      const enriched = logs.map(l => ({
        ...l,
        adminName: l.user_id ? adminMap.get(l.user_id)?.full_name || adminMap.get(l.user_id)?.email || l.user_id : 'System',
      }));

      res.status(200).json({ success: true, data: enriched });
    } catch (error: any) {
      next(error);
    }
  }
);

export default router;

