import prisma from '../config/db';
import { academicYearService } from './academic-year.service';

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
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

export const resolveTeacherId = async (schoolId: string, rawTeacherId?: string | null): Promise<string | null> => {
  if (!rawTeacherId) return null;

  // 1. Try finding Teacher directly by id or user_id
  const teacher = await prisma.teacher.findFirst({
    where: {
      schoolId,
      OR: [
        { id: rawTeacherId },
        { user_id: rawTeacherId }
      ]
    }
  });
  if (teacher) return teacher.id;

  // 2. Try finding User by id or teacher_id
  const user = await prisma.user.findFirst({
    where: {
      schoolId,
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

  // 3. If user is a teacher role but has no Teacher profile row yet, auto-create one
  if (user && user.role === 'teacher') {
    const newTeacher = await prisma.teacher.create({
      data: {
        name: user.full_name,
        email: user.email,
        schoolId,
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

export const normalizeSession = (sess?: any): string | null => {
  if (sess === null || sess === undefined) return null;
  const s = String(sess).trim().toLowerCase();
  if (s === '' || s === 'none' || s === 'daily' || s === 'null' || s === 'undefined') {
    return null;
  }
  return s;
};

export const markAttendance = async (data: any, schoolId: string) => {
  const { studentId, date, status, remarks, teacherId, userRole, userId } = data;
  const session = normalizeSession(data.session);

  if (!studentId || !date) {
    throw new Error("Student ID and Date are required");
  }

  // Resolve valid teacherId foreign key (or null if marked by admin/non-teacher)
  const resolvedTeacherId = await resolveTeacherId(schoolId, teacherId || userId);

  // Ensure student belongs to this school and is actively enrolled
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId }
  });
  if (!student) {
    throw new Error("Student not found in this school");
  }
  if (student.status && student.status.toUpperCase() !== 'ACTIVE') {
    throw new Error(`Attendance cannot be recorded for student "${student.fullName}" with status "${student.status}". Only actively enrolled students can have attendance marked.`);
  }

  // Fetch school settings for location restriction & edit permission checks
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });

  // 1. Geofence & Location Restriction Verification
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

  // Parse the day range in UTC
  const dateStr = typeof date === 'string' ? date.split("T")[0] : new Date(date).toISOString().split("T")[0];
  const startDate = new Date(`${dateStr}T00:00:00.000Z`);
  const endDate = new Date(`${dateStr}T23:59:59.999Z`);

  // Find if a record already exists for this student on this day and session.
  const existing = await prisma.attendance.findFirst({
    where: {
      schoolId,
      studentId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      ...(session
        ? { session: { equals: session, mode: 'insensitive' } }
        : { session: null }
      ),
    }
  });

  // 2. Attendance Edit Permission Verification
  if (existing && userRole === 'teacher') {
    if (settings && settings.allow_attendance_editing === false) {
      // Find active approved request
      const approvedRequest = await prisma.attendanceEditRequest.findFirst({
        where: {
          OR: [
            ...(resolvedTeacherId ? [{ teacherId: resolvedTeacherId }] : []),
            ...(teacherId ? [{ teacherId }] : []),
            ...(userId ? [{ teacherId: userId }] : [])
          ],
          isUsed: false,
          date: {
            gte: startDate,
            lte: endDate,
          },
        }
      });

      if (!approvedRequest) {
        throw new Error("Attendance editing is disabled by School Admin. Please submit an edit request.");
      }

      // Consume the approved permission
      await prisma.attendanceEditRequest.update({
        where: { id: approvedRequest.id },
        data: { isUsed: true }
      });

      await prisma.auditLog.create({
        data: {
          schoolId,
          user_id: userId || teacherId || null,
          action: 'ATTENDANCE_EDIT_PERMITTED',
          entity_type: 'ATTENDANCE_EDIT_REQUEST',
          entity_id: approvedRequest.id,
          old_values: { status: existing.status, remarks: existing.remarks },
          new_values: { newStatus: status, remarks }
        }
      }).catch(err => console.error('[AuditLog] edit permission use log error:', err));
    }
  }

  // Resolve active academic year and student's enrollment record
  const activeAY = await academicYearService.getCurrentAcademicYear(schoolId);
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
        }
      })
    : await prisma.attendance.create({
        data: {
          studentId,
          schoolId,
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

  // Audit log attendance operation
  await prisma.auditLog.create({
    data: {
      schoolId,
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

  // Intercept and create parent notification if status is Absent, Late, or Excused
  await sendAttendanceParentNotification(student, status, dateStr, schoolId);

  return result;
};

export const getAttendance = async (filters: any, schoolId: string) => {
  const { studentId, date, session, grade, section, startDate: filterStartDate, endDate: filterEndDate, academicYearId: filterAcademicYearId } = filters;
  const where: any = { schoolId };

  // Scope to active academic year by default (can be overridden by explicit academicYearId filter)
  if (filterAcademicYearId) {
    where.academicYearId = filterAcademicYearId;
  } else {
    const activeAY = await academicYearService.getCurrentAcademicYear(schoolId);
    if (activeAY) {
      where.academicYearId = activeAY.id;
    }
  }

  if (studentId) where.studentId = studentId;
  if (date) {
    const dateStr = typeof date === 'string' ? date.split("T")[0] : date;
    const startDate = new Date(`${dateStr}T00:00:00.000Z`);
    const endDate = new Date(`${dateStr}T23:59:59.999Z`);
    
    where.date = {
      gte: startDate,
      lte: endDate,
    };
  } else if (filterStartDate || filterEndDate) {
    where.date = {};
    if (filterStartDate) {
      const dateStr = typeof filterStartDate === 'string' ? filterStartDate.split("T")[0] : filterStartDate;
      where.date.gte = new Date(`${dateStr}T00:00:00.000Z`);
    }
    if (filterEndDate) {
      const dateStr = typeof filterEndDate === 'string' ? filterEndDate.split("T")[0] : filterEndDate;
      where.date.lte = new Date(`${dateStr}T23:59:59.999Z`);
    }
  }

  if (session !== undefined && session !== null) {
    const cleanSess = String(session).trim().toLowerCase();
    if (cleanSess === 'none' || cleanSess === 'daily' || cleanSess === '') {
      where.session = null;
    } else if (cleanSess === 'session' || cleanSess === 'session_based' || cleanSess === 'any_session') {
      where.session = { not: null };
    } else {
      where.session = { equals: cleanSess, mode: 'insensitive' };
    }
  }

  if (grade || section) {
    where.student = { schoolId };
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

export const getAttendanceByStudent = async (studentId: string, schoolId: string, filters: any = {}) => {
  const { session } = filters;
  const where: any = { studentId, schoolId };

  if (session !== undefined && session !== null) {
    const cleanSess = String(session).trim().toLowerCase();
    if (cleanSess === 'none' || cleanSess === 'daily' || cleanSess === '') {
      where.session = null;
    } else if (cleanSess === 'session' || cleanSess === 'session_based' || cleanSess === 'any_session') {
      where.session = { not: null };
    } else {
      where.session = { equals: cleanSess, mode: 'insensitive' };
    }
  }

  return await prisma.attendance.findMany({
    where,
    orderBy: { date: 'desc' },
  });
};

// ─── ATTENDANCE EDIT REQUESTS & AUDIT LOGS ──────────────────────────────────

export const createEditRequest = async (schoolId: string, teacherId: string, data: any) => {
  const { studentId, gradeId, sectionId, date, session, reason } = data;

  if (!date) {
    throw new Error("Date is required for edit request");
  }

  const dateStr = typeof date === 'string' ? date.split("T")[0] : new Date(date).toISOString().split("T")[0];
  const parsedDate = new Date(`${dateStr}T00:00:00.000Z`);

  // Ensure teacher record exists or resolve teacherId
  let resolvedTeacherId = teacherId;
  const teacherRecord = await prisma.teacher.findFirst({
    where: { schoolId, OR: [{ id: teacherId }, { user_id: teacherId }] }
  });
  if (teacherRecord) {
    resolvedTeacherId = teacherRecord.id;
  }

  const editRequest = await prisma.attendanceEditRequest.create({
    data: {
      schoolId,
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
      schoolId,
      user_id: teacherId,
      action: 'ATTENDANCE_EDIT_REQUEST_SUBMITTED',
      entity_type: 'ATTENDANCE_EDIT_REQUEST',
      entity_id: editRequest.id,
      new_values: { date: dateStr, session, reason }
    }
  }).catch(err => console.error('[AuditLog] Edit request submit error:', err));

  return editRequest;
};

export const getEditRequests = async (schoolId: string, filters: any = {}) => {
  const { teacherId, status } = filters;
  const where: any = { schoolId };

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

export const approveEditRequest = async (requestId: string, adminUserId: string, schoolId: string, adminNote?: string) => {
  const request = await prisma.attendanceEditRequest.findFirst({
    where: { id: requestId, schoolId }
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
      schoolId,
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

export const rejectEditRequest = async (requestId: string, adminUserId: string, schoolId: string, adminNote?: string) => {
  const request = await prisma.attendanceEditRequest.findFirst({
    where: { id: requestId, schoolId }
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
      schoolId,
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

export const getAttendanceAuditLogs = async (schoolId: string) => {
  return await prisma.auditLog.findMany({
    where: {
      schoolId,
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
  schoolId: string
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
      console.log(`[ParentNotification] No linked parent found for student ${student.fullName} (${student.id})`);
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
        schoolId,
        studentId: student.id,
        type,
        title,
        message,
        isRead: false
      }
    });

    const { sendCategoryNotification } = require('./notification.service');

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true }
    });
    const schoolName = school?.name || 'Addis Hiwot School';
    const categoryLabel = isAbsent ? 'Absent Alert' : isLate ? 'Late Arrival' : 'Excused Absence';

    for (const link of parentLinks) {
      if (link.parent && link.parent.pushToken) {
        if (link.parent.phone) {
          const prefs = await prisma.parentPreferences.findUnique({
            where: { parentPhone_schoolId: { parentPhone: link.parent.phone, schoolId } }
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
          schoolId,
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
  schoolId: string,
  meta: {
    userRole?: string;
    userId?: string;
    teacherId?: string;
    latitude?: number;
    longitude?: number;
    locationVerified?: boolean;
    locationDistance?: number;
  }
) => {
  if (!Array.isArray(records) || records.length === 0) return [];
  if (records.length > 200) {
    throw new Error('Maximum 200 attendance records allowed per bulk request');
  }

  const { userRole, userId, teacherId } = meta;
  const resolvedTeacherId = await resolveTeacherId(schoolId, teacherId || userId);

  // Fetch school settings once
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });

  // Geofence check once
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

  // Batch query active enrolled students only
  const studentIds = records.map(r => r.studentId).filter(Boolean);
  const validStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId, status: 'ACTIVE' },
    select: { id: true, fullName: true, gender: true }
  });
  const studentMap = new Map(validStudents.map(s => [s.id, s]));

  // Standardize date and session range
  const dateSample = records[0]?.date || new Date();
  const dateStr = typeof dateSample === 'string' ? dateSample.split("T")[0] : new Date(dateSample).toISOString().split("T")[0];
  const startDate = new Date(`${dateStr}T00:00:00.000Z`);
  const endDate = new Date(`${dateStr}T23:59:59.999Z`);
  const sampleSession = normalizeSession(records[0]?.session);

  // Batch query existing attendance records for the target students on this date.
  // Build a composite lookup map keyed by `${studentId}:${normalizeSession(session) || 'daily'}`
  const existingRecords = await prisma.attendance.findMany({
    where: {
      schoolId,
      studentId: { in: Array.from(studentMap.keys()) },
      date: { gte: startDate, lte: endDate },
    }
  });
  const existingMap = new Map<string, any>();
  existingRecords.forEach(e => {
    const sKey = normalizeSession(e.session) || 'daily';
    existingMap.set(`${e.studentId}:${sKey}`, e);
  });

  // Build atomic transaction queries
  const txOps: any[] = [];

  for (const record of records) {
    const student = studentMap.get(record.studentId);
    if (!student) continue;

    const recSession = normalizeSession(record.session);
    const mapKey = `${record.studentId}:${recSession || 'daily'}`;
    const existing = existingMap.get(mapKey);
    const status = record.status;
    const remarks = record.remarks;

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
          }
        })
      );
    } else {
      // Resolve AY record ids for new creates (batch lookup)
      let bulkAcademicYearId: string | null = null;
      let bulkAcademicYearRecordId: string | null = null;
      if (!bulkAcademicYearId) {
        const activeAY = await academicYearService.getCurrentAcademicYear(schoolId);
        bulkAcademicYearId = activeAY?.id || null;
        if (activeAY) {
          const enrRec = await prisma.studentAcademicYearRecord.findUnique({
            where: { studentId_academicYearId: { studentId: record.studentId, academicYearId: activeAY.id } },
            select: { id: true }
          });
          bulkAcademicYearRecordId = enrRec?.id || null;
        }
      }
      txOps.push(
        prisma.attendance.create({
          data: {
            studentId: record.studentId,
            schoolId,
            teacherId: resolvedTeacherId,
            date: startDate,
            status,
            session: recSession,
            remarks,
            locationVerified: locVerified,
            locationDistance: locDistance,
            academicYearId: bulkAcademicYearId,
            academicYearRecordId: bulkAcademicYearRecordId,
          }
        })
      );
    }
  }

  // Execute all upserts in a single DB round-trip transaction
  const results = await prisma.$transaction(txOps);

  // Build status summary for admin notification
  const presentCount  = records.filter(r => r.status?.toLowerCase() === 'present').length;
  const lateCount     = records.filter(r => r.status?.toLowerCase() === 'late').length;
  const absentCount   = records.filter(r => r.status?.toLowerCase() === 'absent').length;
  const excusedCount  = records.filter(r => r.status?.toLowerCase() === 'excused').length;

  // Determine grade/section from first valid student record
  const firstStudent = records.map(r => studentMap.get(r.studentId)).find(Boolean);
  const gradeLabel   = firstStudent ? `${firstStudent.fullName.split(' ')[0]}'s class` : 'A class';

  // Fire admin notification in background (does not block response)
  sendAdminAttendanceNotification({
    schoolId,
    teacherId: resolvedTeacherId,
    dateStr,
    session: sampleSession,
    totalCount: results.length,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
  }).catch(err => {
    console.error('[BulkAttendance] Admin notification dispatch error:', err);
  });

  // Asynchronously send parent notifications for absent, late, or excused students
  for (const record of records) {
    const student = studentMap.get(record.studentId);
    if (student) {
      sendAttendanceParentNotification(student, record.status, dateStr, schoolId).catch(err => {
        console.error(`[BulkAttendance] Parent notification dispatch error for student ${student.id}:`, err);
      });
    }
  }

  // Background audit log
  prisma.auditLog.create({
    data: {
      schoolId,
      user_id: userId || teacherId || null,
      action: 'BULK_ATTENDANCE_MARKED',
      entity_type: 'ATTENDANCE',
      new_values: { count: results.length, dateStr, session: sampleSession }
    }
  }).catch(() => {});

  return results;
};

/**
 * Notifies all school admins (with a registered push token) when a teacher submits attendance.
 * Sent asynchronously after the bulk upsert — never blocks the teacher's response.
 */
export const sendAdminAttendanceNotification = async (params: {
  schoolId: string;
  teacherId: string | null;
  dateStr: string;
  session: string | null;
  totalCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
}) => {
  const { schoolId, teacherId, dateStr, session, totalCount, presentCount, lateCount, absentCount, excusedCount } = params;

  try {
    const { sendCategoryNotification } = require('./notification.service');

    // Fetch school name and all admin users with a push token in parallel
    const [school, adminUsers, teacher] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
      prisma.user.findMany({
        where: {
          schoolId,
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

    const schoolName  = school?.name || 'School';
    const teacherName = teacher?.name || 'A teacher';
    const sessionLabel = session ? ` (${session})` : '';

    // Build compact status summary: e.g. "✅ 28  ⚠️ 2  ❌ 1"
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
        schoolId,
        schoolName,
        categoryLabel: 'Attendance Alert',
        tag:           `attendance-admin-${schoolId}-${dateStr}`,
      }).catch((err: any) => {
        console.error(`[AdminNotification] Push error for admin ${admin.id}:`, err);
        return null;
      });

      if (result === 'EXPIRED_TOKEN') expiredIds.push(admin.id);
    }

    // Clear stale tokens
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

