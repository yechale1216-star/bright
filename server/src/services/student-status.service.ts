import prisma from '../config/db';
import { cacheDel } from '../redis';
import { academicYearService } from './academic-year.service';

export type StudentLifecycleStatus = 'ACTIVE' | 'WITHDRAWN' | 'TRANSFERRED' | 'GRADUATED' | 'SUSPENDED' | 'ARCHIVED';

export interface ChangeStatusInput {
  newStatus: StudentLifecycleStatus;
  effectiveDate: string; // ISO date string
  reason: string;
  suspensionEndDate?: string; // required when newStatus = SUSPENDED
  destinationSchool?: string; // for TRANSFERRED
  changedByUserId: string;
}

// Allowed status transitions
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  ACTIVE:      new Set(['SUSPENDED', 'WITHDRAWN', 'TRANSFERRED', 'GRADUATED', 'ARCHIVED']),
  SUSPENDED:   new Set(['ACTIVE', 'WITHDRAWN', 'TRANSFERRED', 'ARCHIVED']),
  WITHDRAWN:   new Set(['ACTIVE', 'ARCHIVED']),
  TRANSFERRED: new Set(['ACTIVE', 'ARCHIVED']),
  GRADUATED:   new Set(['ARCHIVED']),
  ARCHIVED:    new Set(), // Terminal
};

const SETS_DEPARTURE = new Set(['WITHDRAWN', 'TRANSFERRED', 'GRADUATED']);

export async function changeStudentStatus(
  studentId: string,
  input: ChangeStatusInput
): Promise<{ student: any; historyEntry: any }> {
  const { newStatus, effectiveDate, reason, suspensionEndDate, destinationSchool, changedByUserId } = input;

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
      user_id: true,
    },
  });

  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  const fromStatus = (student.status || 'ACTIVE').toUpperCase() as StudentLifecycleStatus;
  const toStatus = newStatus.toUpperCase() as StudentLifecycleStatus;

  if (fromStatus === toStatus) {
    throw new Error(`Student is already in "${toStatus}" status.`);
  }

  if (!VALID_TRANSITIONS[fromStatus]) {
    throw new Error(`Unknown current status "${fromStatus}".`);
  }

  if (!VALID_TRANSITIONS[fromStatus].has(toStatus)) {
    throw new Error(
      `Invalid status transition: "${fromStatus}" → "${toStatus}". ` +
      (VALID_TRANSITIONS[fromStatus].size === 0
        ? `"${fromStatus}" is a permanent status and cannot be changed.`
        : `Allowed transitions from "${fromStatus}": ${Array.from(VALID_TRANSITIONS[fromStatus]).join(', ')}.`)
    );
  }

  if (!reason || reason.trim().length < 3) {
    throw new Error('A reason is required for status changes (at least 3 characters).');
  }

  if (!effectiveDate) {
    throw new Error('Effective date is required for status changes.');
  }

  const parsedEffectiveDate = new Date(effectiveDate);
  if (isNaN(parsedEffectiveDate.getTime())) {
    throw new Error('Invalid effective date format.');
  }

  if (toStatus === 'SUSPENDED') {
    if (!suspensionEndDate) {
      throw new Error('Suspension end date is required when suspending a student.');
    }
    const parsedEnd = new Date(suspensionEndDate);
    if (isNaN(parsedEnd.getTime())) {
      throw new Error('Invalid suspension end date format.');
    }
    if (parsedEnd <= parsedEffectiveDate) {
      throw new Error('Suspension end date must be after the effective start date.');
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const studentUpdate: any = {
      status: toStatus,
      lifecycleEffectiveDate: parsedEffectiveDate,
      statusReason: reason.trim(),
      destinationSchool: destinationSchool?.trim() || null,
      suspensionEndDate: toStatus === 'SUSPENDED' && suspensionEndDate ? new Date(suspensionEndDate) : null,
    };

    if (toStatus === 'ACTIVE') {
      studentUpdate.suspensionEndDate = null;
    }

    const updatedStudent = await tx.student.update({
      where: { id: studentId },
      data: studentUpdate,
      include: { grade: true, section: true, stream: true },
    });

    const historyEntry = await (tx as any).studentStatusHistory.create({
      data: {
        studentId,
        fromStatus,
        toStatus,
        effectiveDate: parsedEffectiveDate,
        reason: reason.trim(),
        metadata: {
          destinationSchool: destinationSchool?.trim() || null,
          suspensionEndDate: toStatus === 'SUSPENDED' ? suspensionEndDate : null,
          studentName: student.fullName,
          studentCode: student.student_id,
        },
        changedByUserId,
      },
    });

    if (SETS_DEPARTURE.has(toStatus)) {
      await tx.studentAcademicYearRecord.updateMany({
        where: {
          studentId,
          effectiveEndDate: null,
        },
        data: {
          effectiveEndDate: parsedEffectiveDate,
          departureReason: `${toStatus}: ${reason.trim()}`,
          status: toStatus,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        user_id: changedByUserId,
        action: 'CHANGE_STUDENT_STATUS',
        entity_type: 'Student',
        entity_id: studentId,
        old_values: { status: fromStatus } as any,
        new_values: { status: toStatus, effectiveDate, reason: reason.trim(), destinationSchool } as any,
      },
    });

    return { student: updatedStudent, historyEntry };
  });

  // Revoke cached user session on status changes
  if (student.user_id) {
    try {
      await cacheDel(`role:${student.user_id}:student`);
      await cacheDel(`role:${student.user_id}:`);
    } catch (e) {
      console.error('[StudentStatusService] Failed to revoke session cache:', e);
    }
  }

  return result;
}

export async function getStudentStatusHistory(studentId: string): Promise<any[]> {
  const records = await (prisma as any).studentStatusHistory.findMany({
    where: { studentId },
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
  });

  const userIds = Array.from(new Set(records.map((r: any) => r.changedByUserId).filter(Boolean))) as string[];
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, full_name: true, role: true },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u.full_name || u.role]));
    return records.map((r: any) => ({
      ...r,
      changedByName: r.changedByUserId ? userMap.get(r.changedByUserId) || r.changedByUserId : null,
    }));
  }

  return records;
}

export async function reEnrollStudent(
  studentId: string,
  academicYearId: string,
  gradeId: string,
  sectionId: string,
  streamId: string | null,
  enrolledByUserId: string
): Promise<any> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, status: true, fullName: true, student_id: true },
  });
  if (!student) throw new Error('Student not found.');

  const currentStatus = (student.status || 'ACTIVE').toUpperCase();
  const reEnrollable = new Set(['WITHDRAWN', 'TRANSFERRED', 'ACTIVE']);
  if (!reEnrollable.has(currentStatus)) {
    throw new Error(`Cannot re-enroll a student with status "${currentStatus}". Only Withdrawn or Transferred students can be re-enrolled.`);
  }

  const existing = await prisma.studentAcademicYearRecord.findUnique({
    where: { studentId_academicYearId: { studentId, academicYearId } },
  });
  if (existing && !existing.effectiveEndDate) {
    throw new Error('Student already has an active, unclosed enrollment in the target academic year.');
  }

  return await prisma.$transaction(async (tx) => {
    let enrollment;
    if (existing) {
      // Re-activate existing record with cleared end date
      enrollment = await tx.studentAcademicYearRecord.update({
        where: { id: existing.id },
        data: {
          gradeId,
          sectionId,
          streamId: streamId || null,
          status: 'ACTIVE',
          effectiveEndDate: null,
          departureReason: null,
        },
      });
    } else {
      enrollment = await tx.studentAcademicYearRecord.create({
        data: {
          studentId,
          academicYearId,
          gradeId,
          sectionId,
          streamId: streamId || null,
          status: 'ACTIVE',
        },
      });
    }

    await tx.student.update({
      where: { id: studentId },
      data: {
        status: 'ACTIVE',
        gradeId,
        sectionId,
        streamId: streamId || null,
        lifecycleEffectiveDate: new Date(),
        statusReason: 'Re-enrolled into school',
        suspensionEndDate: null,
      },
    });

    await (tx as any).studentStatusHistory.create({
      data: {
        studentId,
        fromStatus: currentStatus,
        toStatus: 'ACTIVE',
        effectiveDate: new Date(),
        reason: 'Re-enrolled into academic year',
        changedByUserId: enrolledByUserId,
      },
    });

    await tx.auditLog.create({
      data: {
        user_id: enrolledByUserId,
        action: 'RE_ENROLL_STUDENT',
        entity_type: 'Student',
        entity_id: studentId,
        old_values: { status: currentStatus } as any,
        new_values: { status: 'ACTIVE', academicYearId, gradeId, sectionId, streamId } as any,
      },
    });

    return enrollment;
  });
}

