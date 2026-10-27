import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/auth.middleware';
import { teacherAccessService } from '../services/teacher-access.service';
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

export default router;
