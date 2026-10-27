import prisma from '../config/db';
import { getStatusPolicy, getLifecyclePolicy, StatusPolicy } from './lifecycle-policy.service';
import { academicYearService } from './academic-year.service';

export type EligibilityOperation =
  | 'ATTENDANCE_MARK'
  | 'MARK_ENTRY'
  | 'PROMOTION'
  | 'DISCIPLINE_NEW'
  | 'REPORT_VIEW'
  | 'PORTAL_ACCESS'
  | 'ROSTER_CURRENT'
  | 'ROSTER_HISTORICAL'
  | 'LIBRARY_BORROW'
  | 'TRANSPORT_ASSIGN'
  | 'HOMEWORK_SUBMIT';

export interface EligibilityOptions {
  academicYearId?: string;
  operationDate?: Date;
  allowHistorical?: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  isHistoricalAccess: boolean;
  studentStatus: string;
  policy: StatusPolicy;
  enrollmentId?: string;
}

const DEPARTED_STATUSES = new Set(['WITHDRAWN', 'TRANSFERRED', 'GRADUATED', 'ARCHIVED']);
const CURRENT_OPERATION_STATUSES = new Set(['ACTIVE', 'SUSPENDED']);

/**
 * Validates student suspension expiry and auto-restores if policy allows.
 * Returns the current effective status.
 */
export async function resolveEffectiveStatus(student: {
  id: string;
  status: string;
  suspensionEndDate?: Date | string | null;
  [key: string]: any;
}): Promise<string> {
  const currentStatus = (student.status || 'ACTIVE').toUpperCase();
  if (currentStatus !== 'SUSPENDED') {
    return currentStatus;
  }

  const lifecycle = await getLifecyclePolicy();
  if (
    student.suspensionEndDate &&
    new Date(student.suspensionEndDate) <= new Date() &&
    lifecycle.autoRestoreOnSuspensionEnd
  ) {
    try {
      await prisma.student.update({
        where: { id: student.id },
        data: {
          status: 'ACTIVE',
          suspensionEndDate: null,
          statusReason: 'Suspension expired — automatically restored to Active',
        },
      });

      await (prisma as any).studentStatusHistory.create({
        data: {
          studentId: student.id,
          fromStatus: 'SUSPENDED',
          toStatus: 'ACTIVE',
          effectiveDate: new Date(),
          reason: 'Suspension period expired — automatically restored to Active',
          changedByUserId: null,
        },
      });
    } catch (e: any) {
      if (e?.code !== 'P2025') console.error('[EligibilityService] Failed to auto-restore expired suspension:', e);
    }
    return 'ACTIVE';
  }

  return currentStatus;
}

/**
 * Central eligibility check for any student operation.
 * Contextual decision based on status, enrollment, date, and school policies.
 */
export async function checkStudentEligibility(
  studentId: string,
  operation: EligibilityOperation,
  options: EligibilityOptions = {}
): Promise<EligibilityResult> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      student_id: true,
      status: true,
      gradeId: true,
      sectionId: true,
      streamId: true,
      suspensionEndDate: true,
      lifecycleEffectiveDate: true,
    },
  });

  if (!student) {
    const defaultPolicy = await getStatusPolicy('ARCHIVED');
    return {
      eligible: false,
      reason: 'Student not found.',
      isHistoricalAccess: false,
      studentStatus: 'UNKNOWN',
      policy: defaultPolicy,
    };
  }

  const effectiveStatus = await resolveEffectiveStatus(student);
  const policy = await getStatusPolicy(effectiveStatus);

  const opDate = options.operationDate || new Date();
  const effectiveDate = student.lifecycleEffectiveDate ? new Date(student.lifecycleEffectiveDate) : null;

  // Check if operation date is strictly prior to departure date (for historical corrections)
  const isDatePriorToDeparture = Boolean(
    DEPARTED_STATUSES.has(effectiveStatus) &&
    effectiveDate &&
    opDate < effectiveDate
  );

  // Enrollment verification
  let enrollmentId: string | undefined;
  let hasEnrollment = false;
  const targetAYId = options.academicYearId;

  if (targetAYId) {
    const enr = await prisma.studentAcademicYearRecord.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId: targetAYId } },
      select: { id: true, status: true, effectiveEndDate: true },
    });
    if (enr && (!enr.effectiveEndDate || isDatePriorToDeparture)) {
      hasEnrollment = true;
      enrollmentId = enr.id;
    }
  } else {
    const currentAY = await academicYearService.getCurrentAcademicYear();
    let enr = null;
    if (currentAY) {
      enr = await prisma.studentAcademicYearRecord.findUnique({
        where: { studentId_academicYearId: { studentId, academicYearId: currentAY.id } },
        select: { id: true, status: true, effectiveEndDate: true },
      });
    }
    if (!enr || enr.effectiveEndDate) {
      enr = await prisma.studentAcademicYearRecord.findFirst({
        where: { studentId, status: 'ACTIVE', effectiveEndDate: null },
        select: { id: true, status: true, effectiveEndDate: true },
      });
    }
    if (enr && (!enr.effectiveEndDate || isDatePriorToDeparture)) {
      hasEnrollment = true;
      enrollmentId = enr.id;
    }
  }

  // 1. PORTAL_ACCESS: Enforce configured school portal access policy
  if (operation === 'PORTAL_ACCESS') {
    if (policy.portalAccess === 'DENIED') {
      return {
        eligible: false,
        reason: `Portal access is currently denied for students with status "${effectiveStatus}" under school policy.`,
        isHistoricalAccess: false,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
      };
    }
    return {
      eligible: true,
      isHistoricalAccess: policy.portalAccess === 'HISTORICAL_ONLY',
      studentStatus: effectiveStatus,
      policy,
      enrollmentId,
    };
  }

  // 2. REPORT_VIEW: Enforce report card viewing rules
  if (operation === 'REPORT_VIEW') {
    if (policy.portalAccess === 'DENIED' && !options.allowHistorical) {
      return {
        eligible: false,
        reason: `Access to report cards is denied for students with status "${effectiveStatus}".`,
        isHistoricalAccess: false,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
      };
    }
    if (!policy.canViewReportCards && !options.allowHistorical) {
      return {
        eligible: false,
        reason: `Historical report card viewing is disabled for "${effectiveStatus}" status under current school policy.`,
        isHistoricalAccess: true,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
      };
    }
    return {
      eligible: true,
      isHistoricalAccess: policy.portalAccess !== 'FULL',
      studentStatus: effectiveStatus,
      policy,
      enrollmentId,
    };
  }

  // 3. ROSTER_HISTORICAL: Staff viewing historical records
  if (operation === 'ROSTER_HISTORICAL') {
    return {
      eligible: true,
      isHistoricalAccess: true,
      studentStatus: effectiveStatus,
      policy,
      enrollmentId,
    };
  }

  // 4. Current operations for departed students
  if (!CURRENT_OPERATION_STATUSES.has(effectiveStatus)) {
    if (isDatePriorToDeparture && options.allowHistorical) {
      return {
        eligible: true,
        isHistoricalAccess: true,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
        reason: 'Authorized historical record operation: requested date precedes official departure date.',
      };
    }
    return {
      eligible: false,
      reason: `Action not permitted: student is marked as "${effectiveStatus}". ${
        effectiveStatus === 'ARCHIVED'
          ? 'Archived student records are retained for historical reference only.'
          : `Student departed with status ${effectiveStatus}${effectiveDate ? ' on ' + effectiveDate.toISOString().split('T')[0] : ''}.`
      }`,
      isHistoricalAccess: false,
      studentStatus: effectiveStatus,
      policy,
      enrollmentId,
    };
  }

  // 5. ATTENDANCE_MARK
  if (operation === 'ATTENDANCE_MARK') {
    if (effectiveStatus === 'SUSPENDED' && policy.canMarkAttendance === false) {
      return {
        eligible: false,
        reason: `Cannot mark attendance: student "${student.fullName}" is temporarily suspended until ${
          student.suspensionEndDate ? new Date(student.suspensionEndDate).toLocaleDateString() : 'further notice'
        }.`,
        isHistoricalAccess: false,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
      };
    }
    if (!hasEnrollment) {
      return {
        eligible: false,
        reason: `Student "${student.fullName}" does not have an active enrollment record for this academic year.`,
        isHistoricalAccess: false,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
      };
    }
    return { eligible: true, isHistoricalAccess: false, studentStatus: effectiveStatus, policy, enrollmentId };
  }

  // 6. PROMOTION
  if (operation === 'PROMOTION') {
    if (effectiveStatus !== 'ACTIVE') {
      return {
        eligible: false,
        reason: `Only students with ACTIVE lifecycle status can be promoted. Current status: "${effectiveStatus}".`,
        isHistoricalAccess: false,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
      };
    }
    return { eligible: true, isHistoricalAccess: false, studentStatus: effectiveStatus, policy, enrollmentId };
  }

  // 7. MARK_ENTRY
  if (operation === 'MARK_ENTRY') {
    if (effectiveStatus === 'SUSPENDED') {
      // Suspended students retain academic record capability unless departure occurred
      return { eligible: true, isHistoricalAccess: false, studentStatus: effectiveStatus, policy, enrollmentId };
    }
    if (effectiveStatus !== 'ACTIVE') {
      return {
        eligible: false,
        reason: `Cannot record marks: student lifecycle status is "${effectiveStatus}".`,
        isHistoricalAccess: false,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
      };
    }
    return { eligible: true, isHistoricalAccess: false, studentStatus: effectiveStatus, policy, enrollmentId };
  }

  // 8. DISCIPLINE_NEW
  if (operation === 'DISCIPLINE_NEW') {
    if (DEPARTED_STATUSES.has(effectiveStatus)) {
      return {
        eligible: false,
        reason: `Cannot log new discipline incident for a former student with status "${effectiveStatus}".`,
        isHistoricalAccess: false,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
      };
    }
    return { eligible: true, isHistoricalAccess: false, studentStatus: effectiveStatus, policy, enrollmentId };
  }

  // 9. LIBRARY_BORROW / TRANSPORT_ASSIGN / HOMEWORK_SUBMIT
  if (operation === 'LIBRARY_BORROW' || operation === 'TRANSPORT_ASSIGN' || operation === 'HOMEWORK_SUBMIT') {
    if (effectiveStatus !== 'ACTIVE') {
      return {
        eligible: false,
        reason: `Operation "${operation}" is restricted for students with status "${effectiveStatus}".`,
        isHistoricalAccess: false,
        studentStatus: effectiveStatus,
        policy,
        enrollmentId,
      };
    }
    return { eligible: true, isHistoricalAccess: false, studentStatus: effectiveStatus, policy, enrollmentId };
  }

  return {
    eligible: true,
    isHistoricalAccess: false,
    studentStatus: effectiveStatus,
    policy,
    enrollmentId,
  };
}

/**
 * Batch eligibility check for multiple student IDs.
 */
export async function checkStudentsBatchEligibility(
  studentIds: string[],
  operation: EligibilityOperation,
  options: EligibilityOptions = {}
): Promise<Map<string, EligibilityResult>> {
  const results = new Map<string, EligibilityResult>();
  const CHUNK_SIZE = 25;
  for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
    const chunk = studentIds.slice(i, i + CHUNK_SIZE);
    const checks = await Promise.all(
      chunk.map(async (id) => {
        const res = await checkStudentEligibility(id, operation, options);
        return [id, res] as [string, EligibilityResult];
      })
    );
    for (const [id, res] of checks) {
      results.set(id, res);
    }
  }
  return results;
}

