import prisma from '../config/db';
import { academicYearService } from './academic-year.service';

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const resolveTeacherId = async (_schoolId?: string, rawTeacherId?: string | null): Promise<string | null> => {
  if (!rawTeacherId) return null;

  const teacher = await prisma.teacher.findFirst({
    where: {
      OR: [
        { id: rawTeacherId },
        { user_id: rawTeacherId }
      ]
    }
  });
  if (teacher) return teacher.id;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: rawTeacherId },
        { teacher_id: rawTeacherId }
      ]
    }
  });

  if (user?.teacher_id) {
    const teacherFromUser = await prisma.teacher.findFirst({
      where: { id: user.teacher_id }
    });
    if (teacherFromUser) return teacherFromUser.id;
  }

  if (user && user.role === 'teacher') {
    const newTeacher = await prisma.teacher.create({
      data: {
        name: user.full_name,
        email: user.email,
        phone: user.phone || null,
        user_id: user.id
      }
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { teacher_id: newTeacher.id }
    }).catch(() => {});
    return newTeacher.id;
  }

  return null;
};

export const normalizeDate = (dateInput?: any): { dateStr: string; startDate: Date; endDate: Date } => {
  let dateStr: string;
  if (!dateInput) {
    dateStr = new Date().toISOString().split("T")[0];
  } else if (typeof dateInput === 'string') {
    dateStr = dateInput.split("T")[0];
  } else if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().split("T")[0];
  } else {
    dateStr = new Date(dateInput).toISOString().split("T")[0];
  }
  const startDate = new Date(`${dateStr}T00:00:00.000Z`);
  const endDate = new Date(`${dateStr}T23:59:59.999Z`);
  return { dateStr, startDate, endDate };
};

export const normalizeSession = (sess?: any): string | null => {
  if (sess === null || sess === undefined) return null;
  const s = String(sess).trim().toLowerCase();
  if (s === '' || s === 'none' || s === 'daily' || s === 'null' || s === 'undefined' || s === 'total') {
    return null;
  }
  return s;
};

export function validateGeofence(
  data: { latitude?: number | null; longitude?: number | null; locationVerified?: boolean; locationDistance?: number | null },
  settings: { restrict_location?: boolean | null; allow_outside_attendance?: boolean | null; school_latitude?: number | null; school_longitude?: number | null; allowed_radius_meters?: number | null } | null
): { locVerified: boolean; locDistance: number | null } {
  let locVerified = data.locationVerified ?? false;
  let locDistance: number | null = data.locationDistance != null ? Number(data.locationDistance) : null;

  if (settings?.restrict_location && !settings?.allow_outside_attendance) {
    if (settings.school_latitude != null && settings.school_longitude != null) {
      if (data.latitude == null || data.longitude == null) {
        throw new Error("Location verification failed: Device GPS location is required to submit attendance.");
      }
      const dist = calculateDistanceMeters(
        Number(data.latitude),
        Number(data.longitude),
        settings.school_latitude,
        settings.school_longitude
      );
      const allowedRadius = settings.allowed_radius_meters || 200;
      if (dist > allowedRadius) {
        throw new Error(`Attendance submission blocked: You are ${dist}m away from school location (Allowed radius: ${allowedRadius}m).`);
      }
      locVerified = true;
      locDistance = dist;
    }
  } else if (data.latitude != null && data.longitude != null && settings?.school_latitude != null && settings?.school_longitude != null) {
    locDistance = calculateDistanceMeters(
      Number(data.latitude),
      Number(data.longitude),
      settings.school_latitude,
      settings.school_longitude
    );
    locVerified = locDistance <= (settings.allowed_radius_meters || 200);
  }

  return { locVerified, locDistance };
}

export const markAttendance = async (data: any, _schoolId?: string) => {
  const { studentId, date, status, remarks, teacherId, userRole, userId } = data;
  const session = normalizeSession(data.session);

  if (!studentId || !date) {
    throw new Error("Student ID and Date are required");
  }

  const resolvedTeacherId = await resolveTeacherId(undefined, teacherId || userId);

  const student = await prisma.student.findUnique({
    where: { id: studentId }
  });
  if (!student) {
    throw new Error("Student not found");
  }
  if (student.status && student.status.toUpperCase() !== 'ACTIVE') {
    throw new Error(`Attendance cannot be recorded for student "${student.fullName}" with status "${student.status}". Only actively enrolled students can have attendance marked.`);
  }

  const settings = await prisma.schoolSettings.findFirst();

  const { locVerified, locDistance } = validateGeofence(data, settings);
  const { dateStr, startDate, endDate } = normalizeDate(date);

  const existing = await prisma.attendance.findFirst({
    where: {
      studentId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      ...(session
        ? { session: { equals: session, mode: 'insensitive' } }
        : { OR: [{ session: null }, { session: '' }, { session: 'daily' }] }
      ),
    }
  });

  if (existing && userRole === 'teacher') {
    if (settings && settings.allow_attendance_editing === false) {
      const sessionFilter: any = session
        ? { session: { equals: session, mode: 'insensitive' } }
        : { OR: [{ session: null }, { session: '' }, { session: 'daily' }] };

      const approvedRequest = await prisma.attendanceEditRequest.findFirst({
        where: {
          status: 'APPROVED',
          isUsed: false,
          date: {
            gte: startDate,
            lte: endDate,
          },
          ...sessionFilter,
          OR: [
            ...(resolvedTeacherId ? [{ teacherId: resolvedTeacherId }] : []),
            ...(teacherId ? [{ teacherId }] : []),
            ...(userId ? [{ teacherId: userId }] : [])
          ],
        }
      });

      if (!approvedRequest) {
        const sessionLabel = session ? ` (${session} session)` : '';
        throw new Error(`Attendance editing is disabled by School Admin. Please submit an edit request for ${dateStr}${sessionLabel}.`);
      }

      await prisma.attendanceEditRequest.update({
        where: { id: approvedRequest.id },
        data: { isUsed: true }
      });

      await prisma.auditLog.create({
        data: {
          user_id: userId || teacherId || null,
          action: 'ATTENDANCE_EDIT_PERMITTED',
          entity_type: 'ATTENDANCE_EDIT_REQUEST',
          entity_id: approvedRequest.id,
          old_values: { status: existing.status, remarks: existing.remarks },
          new_values: { newStatus: status, session: session || null, remarks }
        }
      }).catch(err => console.error('[AuditLog] edit permission use log error:', err));
    }
  }

  const activeAY = await academicYearService.getCurrentAcademicYear();
  const academicYearId = activeAY?.id || null;
  let academicYearRecordId: string | null = null;
  if (activeAY) {
    const enrollmentRecord = await prisma.studentAcademicYearRecord.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId: activeAY.id } },
      select: { id: true }
    });
    academicYearRecordId = enrollmentRecord?.id || null;
  }

  const result = existing
    ? await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status,
          remarks,
          teacherId: resolvedTeacherId,
          session: session,
          latitude: data.latitude != null ? Number(data.latitude) : existing.latitude,
          longitude: data.longitude != null ? Number(data.longitude) : existing.longitude,
          locationVerified: locVerified,
          locationDistance: locDistance,
          ...(academicYearId && !existing.academicYearId ? { academicYearId } : {}),
          ...(academicYearRecordId && !existing.academicYearRecordId ? { academicYearRecordId } : {}),
        }
      })
    : await prisma.attendance.create({
        data: {
          studentId,
          teacherId: resolvedTeacherId,
          date: startDate,
          status,
          session: session,
          remarks,
          latitude: data.latitude != null ? Number(data.latitude) : null,
          longitude: data.longitude != null ? Number(data.longitude) : null,
          locationVerified: locVerified,
          locationDistance: locDistance,
          academicYearId,
          academicYearRecordId,
        }
      });

  await prisma.auditLog.create({
    data: {
      user_id: userId || teacherId || null,
      action: existing ? 'ATTENDANCE_UPDATED' : 'ATTENDANCE_MARKED',
      entity_type: 'ATTENDANCE',
      entity_id: result.id,
      old_values: existing ? { status: existing.status, remarks: existing.remarks } : undefined,
      new_values: {
        studentId,
        status,
        session: session || null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        locationVerified: locVerified,
        locationDistance: locDistance
      }
    }
  }).catch(err => console.error('[AuditLog] Attendance error:', err));

  await sendAttendanceParentNotification(student, status, dateStr);

  return result;
};

export const getAttendance = async (filters: any, _schoolId?: string) => {
  const { studentId, date, session, grade, section, startDate: filterStartDate, endDate: filterEndDate, academicYearId: filterAcademicYearId } = filters;
  const where: any = {};

  if (filterAcademicYearId) {
    where.academicYearId = filterAcademicYearId;
  }

  if (studentId) where.studentId = studentId;
  if (date) {
    const { startDate, endDate } = normalizeDate(date);
    where.date = {
      gte: startDate,
      lte: endDate,
    };
  } else if (filterStartDate || filterEndDate) {
    where.date = {};
    if (filterStartDate) {
      const { startDate } = normalizeDate(filterStartDate);
      where.date.gte = startDate;
    }
    if (filterEndDate) {
      const { endDate } = normalizeDate(filterEndDate);
      where.date.lte = endDate;
    }
  }

  if (session !== undefined && session !== null) {
    const cleanSess = String(session).trim().toLowerCase();
    if (cleanSess === 'none' || cleanSess === 'daily' || cleanSess === '') {
      where.OR = [{ session: null }, { session: '' }, { session: 'daily' }];
    } else if (cleanSess === 'session' || cleanSess === 'session_based' || cleanSess === 'any_session') {
      where.AND = [
        { session: { not: null } },
        { session: { not: '' } },
        { session: { not: 'daily' } }
      ];
    } else {
      where.session = { equals: cleanSess, mode: 'insensitive' };
    }
  }

  if (grade || section) {
    where.student = {};
    if (grade) where.student.gradeId = grade;
    if (section) where.student.sectionId = section;
  }

  return await prisma.attendance.findMany({
    where,
    include: { 
      student: {
        include: {
          grade: true,
          section: true,
          stream: true
        }
      }
    },
  });
};

export const getAttendanceByStudent = async (studentId: string, _schoolId?: string, filters: any = {}) => {
  const { session } = filters;
  const where: any = { studentId };

  if (session !== undefined && session !== null) {
    const cleanSess = String(session).trim().toLowerCase();
    if (cleanSess === 'none' || cleanSess === 'daily' || cleanSess === '') {
      where.OR = [{ session: null }, { session: '' }, { session: 'daily' }];
    } else if (cleanSess === 'session' || cleanSess === 'session_based' || cleanSess === 'any_session') {
      where.AND = [
        { session: { not: null } },
        { session: { not: '' } },
        { session: { not: 'daily' } }
      ];
    } else {
      where.session = { equals: cleanSess, mode: 'insensitive' };
    }
  }

  return await prisma.attendance.findMany({
    where,
    orderBy: { date: 'desc' },
  });
};

export const createEditRequest = async (_schoolId: string | undefined, teacherId: string, data: any) => {
  const { studentId, gradeId, sectionId, date, session, reason } = data;

  if (!date) {
    throw new Error("Date is required for edit request");
  }

  const dateStr = typeof date === 'string' ? date.split("T")[0] : new Date(date).toISOString().split("T")[0];
  const parsedDate = new Date(`${dateStr}T00:00:00.000Z`);

  let resolvedTeacherId = teacherId;
  const teacherRecord = await prisma.teacher.findFirst({
    where: { OR: [{ id: teacherId }, { user_id: teacherId }] }
  });
  if (teacherRecord) {
    resolvedTeacherId = teacherRecord.id;
  }

  const editRequest = await prisma.attendanceEditRequest.create({
    data: {
      teacherId: resolvedTeacherId,
      studentId: studentId || null,
      gradeId: gradeId || null,
      sectionId: sectionId || null,
      date: parsedDate,
      session: session ? session.toLowerCase() : null,
      reason: reason || null,
      status: 'PENDING',
    },
    include: {
      teacher: true,
      student: true
    }
  });

  await prisma.auditLog.create({
    data: {
      user_id: teacherId,
      action: 'ATTENDANCE_EDIT_REQUEST_SUBMITTED',
      entity_type: 'ATTENDANCE_EDIT_REQUEST',
      entity_id: editRequest.id,
      new_values: { date: dateStr, session, reason }
    }
  }).catch(err => console.error('[AuditLog] Edit request submit error:', err));

  return editRequest;
};

export const getEditRequests = async (_schoolId?: string, filters: any = {}) => {
  const { teacherId, status } = filters;
  const where: any = {};

  if (teacherId) {
    where.OR = [
      { teacherId },
      { teacher: { user_id: teacherId } }
    ];
  }

  if (status) {
    where.status = status;
  }

  return await prisma.attendanceEditRequest.findMany({
    where,
    include: {
      teacher: true,
      student: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const approveEditRequest = async (requestId: string, adminUserId: string, _schoolId?: string, adminNote?: string) => {
  const request = await prisma.attendanceEditRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new Error("Edit request not found");
  }

  const updated = await prisma.attendanceEditRequest.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      processedBy: adminUserId,
      processedAt: new Date(),
      adminNote: adminNote || null,
    },
    include: {
      teacher: true,
      student: true
    }
  });

  await prisma.auditLog.create({
    data: {
      user_id: adminUserId,
      action: 'ATTENDANCE_EDIT_REQUEST_APPROVED',
      entity_type: 'ATTENDANCE_EDIT_REQUEST',
      entity_id: requestId,
      old_values: { status: request.status },
      new_values: { status: 'APPROVED', adminNote }
    }
  }).catch(err => console.error('[AuditLog] Approve error:', err));

  return updated;
};

export const rejectEditRequest = async (requestId: string, adminUserId: string, _schoolId?: string, adminNote?: string) => {
  const request = await prisma.attendanceEditRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new Error("Edit request not found");
  }

  const updated = await prisma.attendanceEditRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      processedBy: adminUserId,
      processedAt: new Date(),
      adminNote: adminNote || null,
    },
    include: {
      teacher: true,
      student: true
    }
  });

  await prisma.auditLog.create({
    data: {
      user_id: adminUserId,
      action: 'ATTENDANCE_EDIT_REQUEST_REJECTED',
      entity_type: 'ATTENDANCE_EDIT_REQUEST',
      entity_id: requestId,
      old_values: { status: request.status },
      new_values: { status: 'REJECTED', adminNote }
    }
  }).catch(err => console.error('[AuditLog] Reject error:', err));

  return updated;
};

export const getAttendanceAuditLogs = async (_schoolId?: string) => {
  return await prisma.auditLog.findMany({
    where: {
      entity_type: {
        in: ['ATTENDANCE', 'ATTENDANCE_EDIT_REQUEST']
      }
    },
    orderBy: { created_at: 'desc' },
    take: 100
  });
};

export const sendAttendanceParentNotification = async (
  student: { id: string; fullName: string; gender?: string | null },
  status: string,
  dateStr: string,
  _schoolId?: string
) => {
  if (!status) return;
  const statusLower = status.toLowerCase();
  if (statusLower !== 'absent' && statusLower !== 'late' && statusLower !== 'excused') {
    return;
  }

  try {
    const type = statusLower;
    const typePush = statusLower === 'absent' ? 'absent_arrival' : statusLower === 'late' ? 'late_arrival' : 'excused_arrival';
    
    const isFemale = student.gender?.toLowerCase() === 'female';
    const isAbsent = statusLower === 'absent';
    const isLate = statusLower === 'late';
    
    const title = isAbsent
      ? (isFemale ? `${student.fullName} ዛሬ ቀርታለች` : `${student.fullName} ዛሬ ቀርቷል`)
      : isLate
      ? (isFemale ? `${student.fullName} ዛሬ ዘግይታለች` : `${student.fullName} ዛሬ ዘግይቷል`)
      : (isFemale ? `${student.fullName} ፈቃድ አላት` : `${student.fullName} ፈቃድ አለው`);

    const parentLinks = await prisma.parentStudentLink.findMany({
      where: { studentId: student.id },
      include: { parent: true }
    });

    if (!parentLinks || parentLinks.length === 0) {
      return;
    }

    const firstParentName = parentLinks[0]?.parent?.full_name || 'ወላጅ';

    const message = isAbsent
      ? (isFemale 
          ? `ውድ ${firstParentName}፣ ልጅዎ ${student.fullName} ዛሬ ${dateStr} በትምህርት ቤት አልተገኘችም ። የልጅዎ መደበኛ የትምህርት ተሳትፎ ለትምህርታዊ እድገቷ እጅግ አስፈላጊ በመሆኑ፣ እባክዎ የቀረችበትን ምክንያት ለትምህርት ቤታችን ያሳውቁ። ለትብብርዎ እናመሰግናለን።`
          : `ውድ ${firstParentName}፣ ልጅዎ ${student.fullName} ዛሬ ${dateStr} በትምህርት ቤት አልተገኘም። የልጅዎ መደበኛ የትምህርት ተሳትፎ ለትምህርታዊ እድገቱ እጅግ አስፈላጊ በመሆኑ፣ እባክዎ የቀረበትን ምክንያት ለትምህርት ቤታችን ያሳውቁ። ለትብብርዎ እናመሰግናለን።`)
      : isLate
      ? (isFemale
          ? `ውድ ${firstParentName}፣ ልጅዎ ${student.fullName} ዛሬ ${dateStr} ወደ ትምህርት ቤት ዘግይታ ደርሳለች። በሰዓቱ መገኘት ለትምህርት ጥራትና ለሥነ-ምግባር ከፍተኛ አስተዋጽኦ ስላለው፣ ሁልጊዜ በሰዓቱ እንድትገኝ እንዲያሳስቡልን በአክብሮት እንጠይቃለን። ለትብብርዎ እናመሰግናለን።`
          : `ውድ ${firstParentName}፣ ልጅዎ ${student.fullName} ዛሬ ${dateStr} ወደ ትምህርት ቤት በመደበኛው ሰዓት ሳይደርስ ዘግይቶ ተገኝቷል። በሰዓቱ መገኘት ለትምህርት እና ለሥነ-ምግባር ጠቃሚ መሆኑን ለልጅዎ እንዲያስታውሱት በአክብሮት እንጠይቃለን። ለትብብርዎ እናመሰግናለን።`)
      : (isFemale
          ? `ውድ ${firstParentName}፣ ልጅዎ ${student.fullName} ዛሬ ${dateStr} በተሰጠው ፈቃድ መሰረት ከትምህርት ቀርታለች። በሚቀጥለው የትምህርት ቀን በትምህርቷ ላይ እንድትገኝ እንጠብቃለን። ስለ ትብብርዎ እናመሰግናለን።`
          : `ውድ ${firstParentName}፣ ልጅዎ ${student.fullName} ዛሬ ${dateStr} በተሰጠው ፈቃድ መሰረት ከትምህርት ቀርቷል። በሚቀጥለው የትምህርት ቀን በትምህርቱ ላይ እንዲገኝ እንጠብቃለን። ለትብብርዎ እናመሰግናለን።`);
    
    await prisma.parentNotification.create({
      data: {
        studentId: student.id,
        type,
        title,
        message,
        isRead: false
      }
    });

    const { sendCategoryNotification } = require('./notification.service');
    const settings = await prisma.schoolSettings.findFirst();
    const schoolName = settings?.school_name || 'Addis Hiwot School';
    const categoryLabel = isAbsent ? 'Absent Alert' : isLate ? 'Late Arrival' : 'Excused Absence';

    for (const link of parentLinks) {
      if (link.parent && link.parent.pushToken) {
        if (link.parent.phone) {
          const prefs = await prisma.parentPreferences.findUnique({
            where: { parentPhone: link.parent.phone }
          });
          if (prefs && !prefs.pushNotifications) {
            continue;
          }
        }

        const specificParentName = link.parent.full_name || firstParentName;
        const parentSpecificMessage = message.replace(firstParentName, specificParentName);

        await sendCategoryNotification(link.parent.pushToken, {
          type: typePush,
          title: schoolName,
          body: parentSpecificMessage,
          route: `/parent/attendance`,
          studentId: student.id,
          schoolName,
          categoryLabel,
          tag: `attendance-${student.id}`
        }).catch((err: any) => {
          console.error(`Failed to dispatch push to parent ${link.parentId}:`, err);
        });
      }
    }
  } catch (notificationError) {
    console.error("Failed to create parent notification or send push:", notificationError);
  }
};

export const bulkMarkAttendance = async (
  records: any[],
  _schoolId?: string,
  meta: {
    userRole?: string;
    userId?: string;
    teacherId?: string;
    latitude?: number;
    longitude?: number;
    locationVerified?: boolean;
    locationDistance?: number;
  } = {}
) => {
  if (!Array.isArray(records) || records.length === 0) return [];
  if (records.length > 500) {
    throw new Error('Maximum 500 attendance records allowed per bulk request');
  }

  const { userRole, userId, teacherId } = meta;
  const resolvedTeacherId = await resolveTeacherId(undefined, teacherId || userId);
  const settings = await prisma.schoolSettings.findFirst();

  let locVerified = meta.locationVerified ?? false;
  let locDistance: number | null = meta.locationDistance != null ? Number(meta.locationDistance) : null;

  if (settings?.restrict_location && !settings?.allow_outside_attendance) {
    if (settings.school_latitude != null && settings.school_longitude != null) {
      if (meta.latitude == null || meta.longitude == null) {
        throw new Error("Location verification failed: Device GPS location is required to submit attendance.");
      }
      const dist = calculateDistanceMeters(
        Number(meta.latitude),
        Number(meta.longitude),
        settings.school_latitude,
        settings.school_longitude
      );
      const allowedRadius = settings.allowed_radius_meters || 200;
      if (dist > allowedRadius) {
        throw new Error(`Attendance submission blocked: You are ${dist}m away from school location (Allowed radius: ${allowedRadius}m).`);
      }
      locVerified = true;
      locDistance = dist;
    }
  }

  const dedupedMap = new Map<string, any>();
  for (const r of records) {
    if (!r.studentId) continue;
    const { dateStr } = normalizeDate(r.date);
    const recSession = normalizeSession(r.session) || '__daily__';
    const payloadKey = `${r.studentId}::${dateStr}::${recSession}`;
    dedupedMap.set(payloadKey, r);
  }
  const cleanRecords = Array.from(dedupedMap.values());
  if (cleanRecords.length === 0) return [];

  const studentIds = Array.from(new Set(cleanRecords.map(r => r.studentId).filter(Boolean)));
  const validStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, status: 'ACTIVE' },
    select: { id: true, fullName: true, gender: true }
  });
  const studentMap = new Map(validStudents.map(s => [s.id, s]));

  const activeAY = await academicYearService.getCurrentAcademicYear();
  const activeAYId = activeAY?.id || null;
  const enrollmentMap = new Map<string, string>();
  if (activeAYId) {
    const enrollments = await prisma.studentAcademicYearRecord.findMany({
      where: {
        studentId: { in: studentIds },
        academicYearId: activeAYId
      },
      select: { studentId: true, id: true }
    });
    enrollments.forEach(e => enrollmentMap.set(e.studentId, e.id));
  }

  const dateRanges = new Map<string, { startDate: Date; endDate: Date }>();
  cleanRecords.forEach(r => {
    const { dateStr, startDate, endDate } = normalizeDate(r.date);
    if (!dateRanges.has(dateStr)) {
      dateRanges.set(dateStr, { startDate, endDate });
    }
  });

  const dateConditions = Array.from(dateRanges.values()).map(r => ({
    date: { gte: r.startDate, lte: r.endDate }
  }));

  const existingRecords = await prisma.attendance.findMany({
    where: {
      studentId: { in: Array.from(studentMap.keys()) },
      OR: dateConditions.length > 0 ? dateConditions : undefined,
    }
  });

  const existingMap = new Map<string, any>();
  existingRecords.forEach(e => {
    const eDateStr = e.date ? e.date.toISOString().split("T")[0] : 'unknown';
    const sKey = normalizeSession(e.session) || '__daily__';
    existingMap.set(`${e.studentId}::${eDateStr}::${sKey}`, e);
  });

  const hasExistingUpdates = cleanRecords.some(r => {
    const { dateStr } = normalizeDate(r.date);
    const recSession = normalizeSession(r.session);
    const mapKey = `${r.studentId}::${dateStr}::${recSession || '__daily__'}`;
    return existingMap.has(mapKey);
  });

  const sampleSession = normalizeSession(cleanRecords[0]?.session);
  const sampleDateInfo = normalizeDate(cleanRecords[0]?.date);

  if (hasExistingUpdates && userRole === 'teacher' && settings && settings.allow_attendance_editing === false) {
    const sessionFilter: any = sampleSession
      ? { session: { equals: sampleSession, mode: 'insensitive' } }
      : { OR: [{ session: null }, { session: '' }, { session: 'daily' }] };

    const approvedRequest = await prisma.attendanceEditRequest.findFirst({
      where: {
        status: 'APPROVED',
        isUsed: false,
        date: {
          gte: sampleDateInfo.startDate,
          lte: sampleDateInfo.endDate,
        },
        ...sessionFilter,
        OR: [
          ...(resolvedTeacherId ? [{ teacherId: resolvedTeacherId }] : []),
          ...(teacherId ? [{ teacherId }] : []),
          ...(userId ? [{ teacherId: userId }] : [])
        ],
      }
    });

    if (!approvedRequest) {
      const sessionLabel = sampleSession ? ` (${sampleSession} session)` : '';
      throw new Error(`Attendance editing is disabled by School Admin. Please submit an edit request for ${sampleDateInfo.dateStr}${sessionLabel}.`);
    }

    await prisma.attendanceEditRequest.update({
      where: { id: approvedRequest.id },
      data: { isUsed: true }
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId || teacherId || null,
        action: 'ATTENDANCE_EDIT_PERMITTED',
        entity_type: 'ATTENDANCE_EDIT_REQUEST',
        entity_id: approvedRequest.id,
        new_values: { count: cleanRecords.length, session: sampleSession || null, dateStr: sampleDateInfo.dateStr }
      }
    }).catch(err => console.error('[AuditLog] bulk edit permission use log error:', err));
  }

  const txOps: any[] = [];

  for (const record of cleanRecords) {
    const student = studentMap.get(record.studentId);
    if (!student) continue;

    const { startDate, dateStr } = normalizeDate(record.date);
    const recSession = normalizeSession(record.session);
    const mapKey = `${record.studentId}::${dateStr}::${recSession || '__daily__'}`;
    const existing = existingMap.get(mapKey);
    const status = record.status;
    const remarks = record.remarks;
    const ayRecordId = enrollmentMap.get(record.studentId) || null;

    if (existing) {
      txOps.push(
        prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status,
            remarks,
            teacherId: resolvedTeacherId,
            session: recSession,
            locationVerified: locVerified,
            locationDistance: locDistance,
            ...(activeAYId && !existing.academicYearId ? { academicYearId: activeAYId } : {}),
            ...(ayRecordId && !existing.academicYearRecordId ? { academicYearRecordId: ayRecordId } : {}),
          }
        })
      );
    } else {
      txOps.push(
        prisma.attendance.create({
          data: {
            studentId: record.studentId,
            teacherId: resolvedTeacherId,
            date: startDate,
            status,
            session: recSession,
            remarks,
            locationVerified: locVerified,
            locationDistance: locDistance,
            academicYearId: activeAYId,
            academicYearRecordId: ayRecordId,
          }
        })
      );
    }
  }

  const results = await prisma.$transaction(txOps);

  const presentCount  = cleanRecords.filter(r => r.status?.toLowerCase() === 'present').length;
  const lateCount     = cleanRecords.filter(r => r.status?.toLowerCase() === 'late').length;
  const absentCount   = cleanRecords.filter(r => r.status?.toLowerCase() === 'absent').length;
  const excusedCount  = cleanRecords.filter(r => r.status?.toLowerCase() === 'excused').length;

  sendAdminAttendanceNotification({
    teacherId: resolvedTeacherId,
    dateStr: sampleDateInfo.dateStr,
    session: sampleSession,
    totalCount: results.length,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
  }).catch(err => {
    console.error('[BulkAttendance] Admin notification dispatch error:', err);
  });

  for (const record of cleanRecords) {
    const student = studentMap.get(record.studentId);
    if (student) {
      const recDateStr = normalizeDate(record.date).dateStr;
      sendAttendanceParentNotification(student, record.status, recDateStr).catch(err => {
        console.error(`[BulkAttendance] Parent notification dispatch error for student ${student.id}:`, err);
      });
    }
  }

  prisma.auditLog.create({
    data: {
      user_id: userId || teacherId || null,
      action: 'BULK_ATTENDANCE_MARKED',
      entity_type: 'ATTENDANCE',
      new_values: { count: results.length, dateStr: sampleDateInfo.dateStr, session: sampleSession }
    }
  }).catch(() => {});

  return results;
};

export const sendAdminAttendanceNotification = async (params: {
  schoolId?: string;
  teacherId: string | null;
  dateStr: string;
  session: string | null;
  totalCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
}) => {
  const { teacherId, dateStr, session, totalCount, presentCount, lateCount, absentCount, excusedCount } = params;

  try {
    const { sendCategoryNotification } = require('./notification.service');

    const [settings, adminUsers, teacher] = await Promise.all([
      prisma.schoolSettings.findFirst(),
      prisma.user.findMany({
        where: {
          role: 'admin',
          pushToken: { not: null },
          is_active: true,
        },
        select: { id: true, pushToken: true },
      }),
      teacherId
        ? prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true } })
        : null,
    ]);

    if (!adminUsers || adminUsers.length === 0) return;

    const schoolName  = settings?.school_name || 'Addis Hiwot School';
    const teacherName = teacher?.name || 'A teacher';
    const sessionLabel = session ? ` (${session})` : '';

    const parts: string[] = [];
    if (presentCount > 0) parts.push(`✅ ${presentCount} Present`);
    if (lateCount    > 0) parts.push(`⏰ ${lateCount} Late`);
    if (absentCount  > 0) parts.push(`❌ ${absentCount} Absent`);
    if (excusedCount > 0) parts.push(`📝 ${excusedCount} Excused`);
    const summary = parts.join('  ') || `${totalCount} students`;

    const title = `Attendance Submitted — ${schoolName}`;
    const body  = `${teacherName} submitted attendance for ${dateStr}${sessionLabel}.\n${summary}`;

    const expiredIds: string[] = [];

    for (const admin of adminUsers) {
      if (!admin.pushToken) continue;
      const result = await sendCategoryNotification(admin.pushToken, {
        type:          'attendance_submitted',
        title,
        body,
        route:         '/school/admin',
        schoolName,
        categoryLabel: 'Attendance Alert',
        tag:           `attendance-admin-${dateStr}`,
      }).catch((err: any) => {
        console.error(`[AdminNotification] Push error for admin ${admin.id}:`, err);
        return null;
      });

      if (result === 'EXPIRED_TOKEN') expiredIds.push(admin.id);
    }

    if (expiredIds.length > 0) {
      prisma.user.updateMany({
        where: { id: { in: expiredIds } },
        data:  { pushToken: null },
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[AdminNotification] Failed to send admin attendance notification:', err);
  }
};
