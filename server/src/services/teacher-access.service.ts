import prisma from '../config/db';
import { cacheGet, cacheSetEx, cacheDel } from '../redis';
import { AcademicYearService } from './academic-year.service';

const academicYearService = new AcademicYearService();

const ADMIN_ROLES = [
  'admin',
  'superadmin',
  'super_admin',
  'school_admin',
  'academic_head',
  'director',
  'principal',
  'coordinator',
  'head_teacher',
];

export const VALID_TEACHER_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'DEACTIVATED'] as const;
export type TeacherAccountStatus = typeof VALID_TEACHER_STATUSES[number];

export const ALLOWED_STATUS_TRANSITIONS: Record<TeacherAccountStatus, TeacherAccountStatus[]> = {
  ACTIVE: ['SUSPENDED', 'DEACTIVATED', 'PENDING_APPROVAL'],
  SUSPENDED: ['ACTIVE', 'DEACTIVATED'],
  PENDING_APPROVAL: ['ACTIVE', 'DEACTIVATED', 'SUSPENDED'],
  DEACTIVATED: ['ACTIVE', 'SUSPENDED'],
};

/** User-facing message for each non-active status */
const STATUS_LOGIN_MESSAGES: Record<string, string> = {
  SUSPENDED: 'Your account has been suspended. Please contact school administration.',
  PENDING_APPROVAL: 'Your account is pending administrator approval. Please contact school administration.',
  DEACTIVATED: 'Your account has been deactivated. Please contact school administration.',
  TERMINATED: 'Your employment has been terminated. Please contact school administration.',
  FIRED: 'Your employment has been terminated. Please contact school administration.',
};

export interface TeacherAccessContext {
  allowed: boolean;
  code?: string;
  message?: string;
  teacher?: any;
  user?: any;
  currentYear?: any;
  assignments?: any[];
}

/**
 * Service to manage Teacher Lifecycle, Academic-Year Access Control, and Account Revocation.
 * Supports four account statuses: ACTIVE, SUSPENDED, PENDING_APPROVAL, DEACTIVATED.
 */
export class TeacherAccessService {
  /**
   * Helper to check if a user role is administrative
   */
  isAdmin(role?: string): boolean {
    return ADMIN_ROLES.includes((role || '').toLowerCase().trim());
  }

  /**
   * Resolve user and linked teacher profile
   */
  async resolveTeacherProfile(idOrUserId: string) {
    let user = await prisma.user.findUnique({
      where: { id: idOrUserId },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_active: true,
        teacher_id: true,
        employmentStatus: true,
      },
    });

    let teacher = null;
    if (user) {
      if (user.teacher_id) {
        teacher = await prisma.teacher.findUnique({ where: { id: user.teacher_id } });
      }
      if (!teacher) {
        teacher = await prisma.teacher.findFirst({
          where: {
            OR: [
              { user_id: user.id },
              ...(user.email ? [{ email: { equals: user.email, mode: 'insensitive' as const } }] : []),
            ],
          },
        });
      }
    } else {
      teacher = await prisma.teacher.findUnique({
        where: { id: idOrUserId },
      });
      if (teacher) {
        if (teacher.user_id) {
          user = await prisma.user.findUnique({
            where: { id: teacher.user_id },
            select: {
              id: true,
              email: true,
              full_name: true,
              role: true,
              is_active: true,
              teacher_id: true,
              employmentStatus: true,
            },
          });
        }
        if (!user && teacher.email) {
          user = await prisma.user.findUnique({
            where: { email: teacher.email },
            select: {
              id: true,
              email: true,
              full_name: true,
              role: true,
              is_active: true,
              teacher_id: true,
              employmentStatus: true,
            },
          });
        }
      }
    }

    return { user, teacher };
  }

  /**
   * Check if a teacher account is active and permitted to log in.
   * Checks Redis revocation first (O(1)), then DB status.
   * Returns { active, reason, status } for all four account statuses.
   */
  async checkAccountActive(userId: string): Promise<{ active: boolean; reason?: string; status?: string }> {
    // 1. Fast Redis check for immediate session revocation
    try {
      const revoked = await cacheGet(`revoked_user:${userId}`);
      if (revoked) {
        let revokedData: any = {};
        try { revokedData = JSON.parse(revoked); } catch {}
        const status = revokedData.status || 'SUSPENDED';
        return {
          active: false,
          status,
          reason: STATUS_LOGIN_MESSAGES[status] || 'Your account access has been revoked. Please contact school administration.',
        };
      }
    } catch {
      // Redis fallback: proceed to DB check
    }

    // 2. Database verification
    const { user, teacher } = await this.resolveTeacherProfile(userId);
    if (!user) {
      return { active: false, reason: 'User record not found.' };
    }

    const empStatus = user.employmentStatus || 'ACTIVE';

    // Non-active employment statuses
    if (empStatus !== 'ACTIVE') {
      return {
        active: false,
        status: empStatus,
        reason: STATUS_LOGIN_MESSAGES[empStatus] || 'Your account is currently unavailable. Please contact school administration.',
      };
    }

    if (user.is_active === false) {
      return {
        active: false,
        status: 'SUSPENDED',
        reason: STATUS_LOGIN_MESSAGES['SUSPENDED'],
      };
    }

    if (teacher && (teacher.is_active === false || teacher.employmentStatus === 'TERMINATED' || teacher.employmentStatus === 'FIRED')) {
      const tStatus = teacher.employmentStatus || 'SUSPENDED';
      return {
        active: false,
        status: tStatus,
        reason: STATUS_LOGIN_MESSAGES[tStatus] || 'Your teacher account is inactive. Please contact school administration.',
      };
    }

    return { active: true, status: 'ACTIVE' };
  }

  /**
   * Validate that a teacher has an active account AND a valid active assignment for the current academic year.
   * Admins bypass teaching assignment checks.
   */
  async validateTeacherActiveAccess(userId: string): Promise<TeacherAccessContext> {
    const { user, teacher } = await this.resolveTeacherProfile(userId);
    if (!user) {
      return { allowed: false, code: 'USER_NOT_FOUND', message: 'User account not found.' };
    }

    // Admins bypass teacher restrictions
    if (this.isAdmin(user.role)) {
      const currentYear = await academicYearService.getCurrentAcademicYear();
      return { allowed: true, user, teacher, currentYear, assignments: [] };
    }

    // 1. Account status & employment check
    const statusCheck = await this.checkAccountActive(userId);
    if (!statusCheck.active) {
      return {
        allowed: false,
        code: 'ACCOUNT_TERMINATED',
        message: statusCheck.reason || 'Your account is inactive.',
      };
    }

    // 2. Fetch the school's configured currently active academic year
    const currentYear = await academicYearService.getCurrentAcademicYear();
    if (!currentYear) {
      return {
        allowed: false,
        code: 'NO_ACTIVE_ACADEMIC_YEAR',
        message: 'No active academic year is currently configured for the school. Please contact administration.',
      };
    }

    // 3. Resolve active assignments strictly for the CURRENT academic year
    const teacherIds = [teacher?.id, userId].filter(Boolean) as string[];
    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        teacher_id: { in: teacherIds },
        academicYearId: currentYear.id,
        status: 'ACTIVE',
      },
      include: {
        grade: true,
        section: true,
        stream: true,
        subjectRef: true,
      },
      orderBy: [{ role: 'asc' }, { grade: { name: 'asc' } }, { section: { name: 'asc' } }],
    });

    if (assignments.length === 0) {
      return {
        allowed: false,
        code: 'NO_ACTIVE_YEAR_ASSIGNMENT',
        message: `Teaching portal access requires an active assignment for the current academic year (${currentYear.name}). You do not currently have any active assignments for this year.`,
        user,
        teacher,
        currentYear,
        assignments: [],
      };
    }

    return {
      allowed: true,
      user,
      teacher,
      currentYear,
      assignments,
    };
  }

  /**
   * Validate that a teacher is not attempting to access a previous or future academic year.
   */
  async validateAcademicYearRequest(userId: string, requestedYearId?: string): Promise<{ allowed: boolean; currentYear?: any; reason?: string }> {
    const { user } = await this.resolveTeacherProfile(userId);
    if (!user || this.isAdmin(user.role)) {
      return { allowed: true };
    }

    const currentYear = await academicYearService.getCurrentAcademicYear();
    if (!currentYear) {
      return { allowed: false, reason: 'No active academic year configured.' };
    }

    if (requestedYearId && requestedYearId !== currentYear.id) {
      return {
        allowed: false,
        reason: `Access denied. Teachers are restricted to the currently active academic year (${currentYear.name}). Access to historical or future academic year data (${requestedYearId}) is prohibited.`,
        currentYear,
      };
    }

    return { allowed: true, currentYear };
  }

  /**
   * Validate teacher's authorization for a specific class section and subject within the active academic year.
   */
  async verifyClassSubjectScope(
    userId: string,
    params: {
      gradeId: string;
      sectionId?: string;
      subjectId?: string;
      academicYearId?: string;
    }
  ): Promise<{ allowed: boolean; reason?: string }> {
    const access = await this.validateTeacherActiveAccess(userId);
    if (!access.allowed) {
      return { allowed: false, reason: access.message };
    }

    // Admins bypass scope checks
    if (this.isAdmin(access.user?.role)) {
      return { allowed: true };
    }

    // Check academic year match
    if (params.academicYearId && params.academicYearId !== access.currentYear?.id) {
      return {
        allowed: false,
        reason: `Access denied. Data requested belongs to academic year ${params.academicYearId}, but teachers can only access the active year (${access.currentYear?.name}).`,
      };
    }

    // Check teacher assignments
    const assignments = access.assignments || [];
    const hasMatch = assignments.some((a) => {
      const gradeMatches = a.gradeId === params.gradeId;
      const sectionMatches = !params.sectionId || a.sectionId === params.sectionId;
      const subjectMatches = !params.subjectId || !a.subjectId || a.subjectId === params.subjectId;
      return gradeMatches && sectionMatches && subjectMatches;
    });

    if (!hasMatch) {
      return {
        allowed: false,
        reason: 'Access denied. You are not assigned to this class and subject for the active academic year.',
      };
    }

    return { allowed: true };
  }

  /**
   * Verify teacher's authorization to access or grade a specific student.
   */
  async verifyStudentScope(userId: string, studentId: string): Promise<{ allowed: boolean; reason?: string }> {
    const access = await this.validateTeacherActiveAccess(userId);
    if (!access.allowed) {
      return { allowed: false, reason: access.message };
    }

    if (this.isAdmin(access.user?.role)) {
      return { allowed: true };
    }

    // Find student's current enrollment
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, gradeId: true, sectionId: true },
    });

    if (!student) {
      return { allowed: false, reason: 'Student not found.' };
    }

    const assignments = access.assignments || [];
    const isAssigned = assignments.some(
      (a) => a.gradeId === student.gradeId && a.sectionId === student.sectionId
    );

    if (!isAssigned) {
      return {
        allowed: false,
        reason: `Access denied. Student ${student.fullName} is not in any of your assigned classes for the active academic year.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Change teacher account status (ACTIVE ↔ SUSPENDED ↔ PENDING_APPROVAL ↔ DEACTIVATED).
   * Validates the transition, revokes/restores sessions, and creates a complete audit record.
   */
  async changeAccountStatus(
    teacherIdOrUserId: string,
    payload: {
      newStatus: TeacherAccountStatus;
      reason?: string;
      adminId: string;
      adminEmail?: string;
    }
  ) {
    const { newStatus, adminId } = payload;
    const reason = payload.reason?.trim() || `Status changed to ${newStatus} by administrator`;

    const { user, teacher } = await this.resolveTeacherProfile(teacherIdOrUserId);
    if (!user && !teacher) {
      throw new Error('Teacher record not found.');
    }

    const teacherId = teacher?.id || user?.teacher_id;
    const userId = user?.id || teacher?.user_id;

    // Determine current status
    const currentStatus = (user?.employmentStatus || teacher?.employmentStatus || 'ACTIVE') as string;

    // Validate transition — only check VALID_TEACHER_STATUSES transitions, not TERMINATED/FIRED
    const validAccountStatuses: string[] = [...VALID_TEACHER_STATUSES];
    if (validAccountStatuses.includes(currentStatus)) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus as TeacherAccountStatus];
      if (!allowed.includes(newStatus)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(', ')}.`);
      }
    }

    const isRestrictive = newStatus !== 'ACTIVE';
    const isActive = !isRestrictive;
    const changedAt = new Date();

    return await prisma.$transaction(async (tx) => {
      // 1. Capture previous status for audit
      let previousStatus = currentStatus;
      if (teacherId) {
        const currentTeacher = await tx.teacher.findUnique({
          where: { id: teacherId },
          select: { employmentStatus: true },
        });
        previousStatus = currentTeacher?.employmentStatus || currentStatus;
      }

      // 2. Update Teacher profile
      let updatedTeacher = null;
      if (teacherId) {
        updatedTeacher = await tx.teacher.update({
          where: { id: teacherId },
          data: {
            employmentStatus: newStatus,
            is_active: isActive,
            statusChangedAt: changedAt,
            statusChangedBy: adminId,
            ...(isRestrictive && reason ? { suspensionReason: reason } : {}),
          } as any,
        });
      }

      // 3. Update User record
      let updatedUser = null;
      if (userId) {
        updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            employmentStatus: newStatus,
            is_active: isActive,
          },
        });
      }

      // 4. Session revocation / restoration via Redis
      if (userId) {
        if (isRestrictive) {
          // Set revocation key — blocks all existing JWTs immediately
          await cacheSetEx(`revoked_user:${userId}`, 30 * 24 * 60 * 60, JSON.stringify({
            revokedAt: changedAt.toISOString(),
            status: newStatus,
            reason,
            changedBy: adminId,
          })).catch(() => {});
        } else {
          // Restore access — clear revocation
          await cacheDel(`revoked_user:${userId}`).catch(() => {});
        }
        // Always clear role caches on status change
        await cacheDel(`role:${userId}:`).catch(() => {});
        await cacheDel(`role:${userId}:teacher`).catch(() => {});
      }

      // 5. Audit Log with old_values and new_values
      await tx.auditLog.create({
        data: {
          user_id: adminId,
          action: 'TEACHER_STATUS_CHANGED',
          entity_type: 'Teacher',
          entity_id: teacherId,
          old_values: {
            status: previousStatus,
          },
          new_values: {
            status: newStatus,
            reason,
            teacherId,
            userId,
            teacherName: teacher?.name || user?.full_name,
            changedBy: adminId,
            changedByEmail: payload.adminEmail,
            changedAt: changedAt.toISOString(),
          },
        },
      }).catch(() => {});

      const statusLabels: Record<string, string> = {
        ACTIVE: 'activated',
        SUSPENDED: 'suspended',
        PENDING_APPROVAL: 'set to pending approval',
        DEACTIVATED: 'deactivated',
      };

      return {
        success: true,
        teacher: updatedTeacher,
        user: updatedUser,
        previousStatus,
        newStatus,
        message: `Teacher account ${statusLabels[newStatus] || newStatus}${isRestrictive ? '. All active sessions have been revoked.' : '. The teacher may log in again.'}`,
      };
    });
  }

  /**
   * Terminate or Fire a Teacher (permanent employment action — separate from account status management).
   * 1. Records employment status, termination effective date, reason, authorized administrator.
   * 2. Immediately revokes sessions in Redis and blocks subsequent requests.
   * 3. Deactivates active assignments.
   * 4. Preserves all accounts, historical assignments, and official records.
   */
  async terminateTeacher(
    teacherIdOrUserId: string,
    payload: {
      reason: string;
      effectiveDate?: string | Date;
      adminId: string;
      adminEmail?: string;
    }
  ) {
    const { user, teacher } = await this.resolveTeacherProfile(teacherIdOrUserId);
    if (!user && !teacher) {
      throw new Error('Teacher record not found.');
    }

    const effectiveDate = payload.effectiveDate ? new Date(payload.effectiveDate) : new Date();
    const reason = payload.reason?.trim() || 'Employment terminated by administration';

    const teacherId = teacher?.id || user?.teacher_id;
    const userId = user?.id || teacher?.user_id;

    return await prisma.$transaction(async (tx) => {
      // Capture previous status for audit
      let previousStatus = 'ACTIVE';
      if (teacherId) {
        const currentTeacher = await tx.teacher.findUnique({
          where: { id: teacherId },
          select: { employmentStatus: true },
        });
        previousStatus = currentTeacher?.employmentStatus || 'ACTIVE';
      }

      // 1. Update Teacher profile
      let updatedTeacher = null;
      if (teacherId) {
        updatedTeacher = await tx.teacher.update({
          where: { id: teacherId },
          data: {
            is_active: false,
            employmentStatus: 'TERMINATED',
            terminationEffectiveDate: effectiveDate,
            terminationReason: reason,
            terminatedBy: payload.adminId,
            statusChangedAt: new Date(),
            statusChangedBy: payload.adminId,
          } as any,
        });

        // 2. Deactivate currently active teacher assignments
        await tx.teacherAssignment.updateMany({
          where: { teacher_id: teacherId, status: 'ACTIVE' },
          data: { status: 'ENDED' },
        });
      }

      // 3. Update User record
      let updatedUser = null;
      if (userId) {
        updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            is_active: false,
            employmentStatus: 'TERMINATED',
          },
        });
      }

      // 4. Immediate Session Revocation
      if (userId) {
        await cacheSetEx(`revoked_user:${userId}`, 30 * 24 * 60 * 60, JSON.stringify({
          revokedAt: new Date().toISOString(),
          status: 'TERMINATED',
          reason,
          changedBy: payload.adminId,
        })).catch(() => {});
        await cacheDel(`role:${userId}:`).catch(() => {});
        await cacheDel(`role:${userId}:teacher`).catch(() => {});
      }

      // 5. Audit Log with old_values
      await tx.auditLog.create({
        data: {
          user_id: payload.adminId,
          action: 'TEACHER_TERMINATED',
          entity_type: 'Teacher',
          entity_id: teacherId,
          old_values: {
            status: previousStatus,
          },
          new_values: {
            status: 'TERMINATED',
            teacherId,
            userId,
            teacherName: teacher?.name || user?.full_name,
            reason,
            effectiveDate,
            terminatedBy: payload.adminId,
            changedAt: new Date().toISOString(),
          },
        },
      }).catch(() => {});

      return {
        success: true,
        teacher: updatedTeacher,
        user: updatedUser,
        message: 'Teacher employment terminated and all portal sessions immediately revoked.',
      };
    });
  }

  /**
   * Reinstate a Terminated Teacher.
   * Restores active account status, removes session blacklist, and records reinstatement audit trail.
   * Note: Portal access remains gated until a valid assignment for the active academic year is created or activated.
   */
  async reinstateTeacher(
    teacherIdOrUserId: string,
    payload: {
      reason?: string;
      adminId: string;
    }
  ) {
    const { user, teacher } = await this.resolveTeacherProfile(teacherIdOrUserId);
    if (!user && !teacher) {
      throw new Error('Teacher record not found.');
    }

    const teacherId = teacher?.id || user?.teacher_id;
    const userId = user?.id || teacher?.user_id;
    const reinstatedDate = new Date();
    const reason = payload.reason?.trim() || 'Reinstated by school administration';

    return await prisma.$transaction(async (tx) => {
      // Capture previous status for audit
      let previousStatus = 'TERMINATED';
      if (teacherId) {
        const currentTeacher = await tx.teacher.findUnique({
          where: { id: teacherId },
          select: { employmentStatus: true },
        });
        previousStatus = currentTeacher?.employmentStatus || 'TERMINATED';
      }

      // 1. Update Teacher profile
      let updatedTeacher = null;
      if (teacherId) {
        updatedTeacher = await tx.teacher.update({
          where: { id: teacherId },
          data: {
            is_active: true,
            employmentStatus: 'ACTIVE',
            reinstatedDate,
            reinstatedBy: payload.adminId,
            statusChangedAt: reinstatedDate,
            statusChangedBy: payload.adminId,
          } as any,
        });
      }

      // 2. Update User record
      let updatedUser = null;
      if (userId) {
        updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            is_active: true,
            employmentStatus: 'ACTIVE',
          },
        });

        // 3. Clear Redis session revocation blacklist
        await cacheDel(`revoked_user:${userId}`).catch(() => {});
        await cacheDel(`role:${userId}:`).catch(() => {});
        await cacheDel(`role:${userId}:teacher`).catch(() => {});
      }

      // 4. Audit Log with old_values
      await tx.auditLog.create({
        data: {
          user_id: payload.adminId,
          action: 'TEACHER_REINSTATED',
          entity_type: 'Teacher',
          entity_id: teacherId,
          old_values: {
            status: previousStatus,
          },
          new_values: {
            status: 'ACTIVE',
            teacherId,
            userId,
            teacherName: teacher?.name || user?.full_name,
            reason,
            reinstatedDate: reinstatedDate.toISOString(),
            reinstatedBy: payload.adminId,
          },
        },
      }).catch(() => {});

      return {
        success: true,
        teacher: updatedTeacher,
        user: updatedUser,
        message: 'Teacher account reinstated. Note: An active assignment for the current academic year is required for portal access.',
      };
    });
  }
}

export const teacherAccessService = new TeacherAccessService();
