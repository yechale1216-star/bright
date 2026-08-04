"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAdminAttendanceNotification = exports.bulkMarkAttendance = exports.sendAttendanceParentNotification = exports.getAttendanceAuditLogs = exports.rejectEditRequest = exports.approveEditRequest = exports.getEditRequests = exports.createEditRequest = exports.getAttendanceByStudent = exports.getAttendance = exports.markAttendance = exports.resolveTeacherId = void 0;
exports.calculateDistanceMeters = calculateDistanceMeters;
const db_1 = __importDefault(require("../config/db"));
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}
const resolveTeacherId = async (schoolId, rawTeacherId) => {
    if (!rawTeacherId)
        return null;
    // 1. Try finding Teacher directly by id or user_id
    const teacher = await db_1.default.teacher.findFirst({
        where: {
            schoolId,
            OR: [
                { id: rawTeacherId },
                { user_id: rawTeacherId }
            ]
        }
    });
    if (teacher)
        return teacher.id;
    // 2. Try finding User by id or teacher_id
    const user = await db_1.default.user.findFirst({
        where: {
            schoolId,
            OR: [
                { id: rawTeacherId },
                { teacher_id: rawTeacherId }
            ]
        }
    });
    if (user?.teacher_id) {
        const teacherFromUser = await db_1.default.teacher.findFirst({
            where: { id: user.teacher_id }
        });
        if (teacherFromUser)
            return teacherFromUser.id;
    }
    // 3. If user is a teacher role but has no Teacher profile row yet, auto-create one
    if (user && user.role === 'teacher') {
        const newTeacher = await db_1.default.teacher.create({
            data: {
                name: user.full_name,
                email: user.email,
                schoolId,
                phone: user.phone || null,
                user_id: user.id
            }
        });
        await db_1.default.user.update({
            where: { id: user.id },
            data: { teacher_id: newTeacher.id }
        }).catch(() => { });
        return newTeacher.id;
    }
    return null;
};
exports.resolveTeacherId = resolveTeacherId;
const markAttendance = async (data, schoolId) => {
    const { studentId, date, status, remarks, teacherId, userRole, userId } = data;
    const session = data.session ? data.session.toLowerCase() : null;
    if (!studentId || !date) {
        throw new Error("Student ID and Date are required");
    }
    // Resolve valid teacherId foreign key (or null if marked by admin/non-teacher)
    const resolvedTeacherId = await (0, exports.resolveTeacherId)(schoolId, teacherId || userId);
    // Ensure student belongs to this school
    const student = await db_1.default.student.findFirst({
        where: { id: studentId, schoolId }
    });
    if (!student) {
        throw new Error("Student not found in this school");
    }
    // Fetch school settings for location restriction & edit permission checks
    const settings = await db_1.default.schoolSettings.findUnique({ where: { schoolId } });
    // 1. Geofence & Location Restriction Verification
    let locVerified = data.locationVerified ?? false;
    let locDistance = data.locationDistance != null ? Number(data.locationDistance) : null;
    if (settings?.restrict_location && !settings?.allow_outside_attendance) {
        if (settings.school_latitude != null && settings.school_longitude != null) {
            if (data.latitude == null || data.longitude == null) {
                throw new Error("Location verification failed: Device GPS location is required to submit attendance.");
            }
            const dist = calculateDistanceMeters(Number(data.latitude), Number(data.longitude), settings.school_latitude, settings.school_longitude);
            const allowedRadius = settings.allowed_radius_meters || 200;
            if (dist > allowedRadius) {
                throw new Error(`Attendance submission blocked: You are ${dist}m away from school location (Allowed radius: ${allowedRadius}m).`);
            }
            locVerified = true;
            locDistance = dist;
        }
    }
    else if (data.latitude != null && data.longitude != null && settings?.school_latitude != null && settings?.school_longitude != null) {
        locDistance = calculateDistanceMeters(Number(data.latitude), Number(data.longitude), settings.school_latitude, settings.school_longitude);
        locVerified = locDistance <= (settings.allowed_radius_meters || 200);
    }
    // Parse the day range in UTC
    const dateStr = typeof date === 'string' ? date.split("T")[0] : new Date(date).toISOString().split("T")[0];
    const startDate = new Date(`${dateStr}T00:00:00.000Z`);
    const endDate = new Date(`${dateStr}T23:59:59.999Z`);
    // Find if a record already exists for this student on this day and session.
    const existing = await db_1.default.attendance.findFirst({
        where: {
            schoolId,
            studentId,
            date: {
                gte: startDate,
                lte: endDate,
            },
            ...(session
                ? { session: { equals: session, mode: 'insensitive' } }
                : { session: null }),
        }
    });
    // 2. Attendance Edit Permission Verification
    if (existing && userRole === 'teacher') {
        if (settings && settings.allow_attendance_editing === false) {
            // Find active approved request
            const approvedRequest = await db_1.default.attendanceEditRequest.findFirst({
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
            await db_1.default.attendanceEditRequest.update({
                where: { id: approvedRequest.id },
                data: { isUsed: true }
            });
            await db_1.default.auditLog.create({
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
    const result = existing
        ? await db_1.default.attendance.update({
            where: { id: existing.id },
            data: {
                status,
                remarks,
                teacherId: resolvedTeacherId,
                session: session || null,
                latitude: data.latitude != null ? Number(data.latitude) : existing.latitude,
                longitude: data.longitude != null ? Number(data.longitude) : existing.longitude,
                locationVerified: locVerified,
                locationDistance: locDistance,
            }
        })
        : await db_1.default.attendance.create({
            data: {
                studentId,
                schoolId,
                teacherId: resolvedTeacherId,
                date: startDate,
                status,
                session: session || null,
                remarks,
                latitude: data.latitude != null ? Number(data.latitude) : null,
                longitude: data.longitude != null ? Number(data.longitude) : null,
                locationVerified: locVerified,
                locationDistance: locDistance,
            }
        });
    // Audit log attendance operation
    await db_1.default.auditLog.create({
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
    await (0, exports.sendAttendanceParentNotification)(student, status, dateStr, schoolId);
    return result;
};
exports.markAttendance = markAttendance;
const getAttendance = async (filters, schoolId) => {
    const { studentId, date, session, grade, section, startDate: filterStartDate, endDate: filterEndDate } = filters;
    const where = { schoolId };
    if (studentId)
        where.studentId = studentId;
    if (date) {
        const dateStr = typeof date === 'string' ? date.split("T")[0] : date;
        const startDate = new Date(`${dateStr}T00:00:00.000Z`);
        const endDate = new Date(`${dateStr}T23:59:59.999Z`);
        where.date = {
            gte: startDate,
            lte: endDate,
        };
    }
    else if (filterStartDate || filterEndDate) {
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
        if (session === 'none') {
            where.session = null;
        }
        else {
            where.session = { equals: session.trim().toLowerCase(), mode: 'insensitive' };
        }
    }
    if (grade || section) {
        where.student = { schoolId };
        if (grade)
            where.student.gradeId = grade;
        if (section)
            where.student.sectionId = section;
    }
    return await db_1.default.attendance.findMany({
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
exports.getAttendance = getAttendance;
const getAttendanceByStudent = async (studentId, schoolId, filters = {}) => {
    const { session } = filters;
    const where = { studentId, schoolId };
    if (session !== undefined && session !== null) {
        if (session === 'none') {
            where.session = null;
        }
        else {
            where.session = { equals: session.trim().toLowerCase(), mode: 'insensitive' };
        }
    }
    return await db_1.default.attendance.findMany({
        where,
        orderBy: { date: 'desc' },
    });
};
exports.getAttendanceByStudent = getAttendanceByStudent;
// ─── ATTENDANCE EDIT REQUESTS & AUDIT LOGS ──────────────────────────────────
const createEditRequest = async (schoolId, teacherId, data) => {
    const { studentId, gradeId, sectionId, date, session, reason } = data;
    if (!date) {
        throw new Error("Date is required for edit request");
    }
    const dateStr = typeof date === 'string' ? date.split("T")[0] : new Date(date).toISOString().split("T")[0];
    const parsedDate = new Date(`${dateStr}T00:00:00.000Z`);
    // Ensure teacher record exists or resolve teacherId
    let resolvedTeacherId = teacherId;
    const teacherRecord = await db_1.default.teacher.findFirst({
        where: { schoolId, OR: [{ id: teacherId }, { user_id: teacherId }] }
    });
    if (teacherRecord) {
        resolvedTeacherId = teacherRecord.id;
    }
    const editRequest = await db_1.default.attendanceEditRequest.create({
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
    await db_1.default.auditLog.create({
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
exports.createEditRequest = createEditRequest;
const getEditRequests = async (schoolId, filters = {}) => {
    const { teacherId, status } = filters;
    const where = { schoolId };
    if (teacherId) {
        where.OR = [
            { teacherId },
            { teacher: { user_id: teacherId } }
        ];
    }
    if (status) {
        where.status = status;
    }
    return await db_1.default.attendanceEditRequest.findMany({
        where,
        include: {
            teacher: true,
            student: true
        },
        orderBy: { createdAt: 'desc' }
    });
};
exports.getEditRequests = getEditRequests;
const approveEditRequest = async (requestId, adminUserId, schoolId, adminNote) => {
    const request = await db_1.default.attendanceEditRequest.findFirst({
        where: { id: requestId, schoolId }
    });
    if (!request) {
        throw new Error("Edit request not found");
    }
    const updated = await db_1.default.attendanceEditRequest.update({
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
    await db_1.default.auditLog.create({
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
exports.approveEditRequest = approveEditRequest;
const rejectEditRequest = async (requestId, adminUserId, schoolId, adminNote) => {
    const request = await db_1.default.attendanceEditRequest.findFirst({
        where: { id: requestId, schoolId }
    });
    if (!request) {
        throw new Error("Edit request not found");
    }
    const updated = await db_1.default.attendanceEditRequest.update({
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
    await db_1.default.auditLog.create({
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
exports.rejectEditRequest = rejectEditRequest;
const getAttendanceAuditLogs = async (schoolId) => {
    return await db_1.default.auditLog.findMany({
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
exports.getAttendanceAuditLogs = getAttendanceAuditLogs;
const sendAttendanceParentNotification = async (student, status, dateStr, schoolId) => {
    if (!status)
        return;
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
        const parentLinks = await db_1.default.parentStudentLink.findMany({
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
        await db_1.default.parentNotification.create({
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
        const school = await db_1.default.school.findUnique({
            where: { id: schoolId },
            select: { name: true }
        });
        const schoolName = school?.name || 'ZeTime School';
        const categoryLabel = isAbsent ? 'Absent Alert' : isLate ? 'Late Arrival' : 'Excused Absence';
        for (const link of parentLinks) {
            if (link.parent && link.parent.pushToken) {
                if (link.parent.phone) {
                    const prefs = await db_1.default.parentPreferences.findUnique({
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
                }).catch((err) => {
                    console.error(`Failed to dispatch push to parent ${link.parentId}:`, err);
                });
            }
        }
    }
    catch (notificationError) {
        console.error("Failed to create parent notification or send push:", notificationError);
    }
};
exports.sendAttendanceParentNotification = sendAttendanceParentNotification;
const bulkMarkAttendance = async (records, schoolId, meta) => {
    if (!Array.isArray(records) || records.length === 0)
        return [];
    if (records.length > 200) {
        throw new Error('Maximum 200 attendance records allowed per bulk request');
    }
    const { userRole, userId, teacherId } = meta;
    const resolvedTeacherId = await (0, exports.resolveTeacherId)(schoolId, teacherId || userId);
    // Fetch school settings once
    const settings = await db_1.default.schoolSettings.findUnique({ where: { schoolId } });
    // Geofence check once
    let locVerified = meta.locationVerified ?? false;
    let locDistance = meta.locationDistance != null ? Number(meta.locationDistance) : null;
    if (settings?.restrict_location && !settings?.allow_outside_attendance) {
        if (settings.school_latitude != null && settings.school_longitude != null) {
            if (meta.latitude == null || meta.longitude == null) {
                throw new Error("Location verification failed: Device GPS location is required to submit attendance.");
            }
            const dist = calculateDistanceMeters(Number(meta.latitude), Number(meta.longitude), settings.school_latitude, settings.school_longitude);
            const allowedRadius = settings.allowed_radius_meters || 200;
            if (dist > allowedRadius) {
                throw new Error(`Attendance submission blocked: You are ${dist}m away from school location (Allowed radius: ${allowedRadius}m).`);
            }
            locVerified = true;
            locDistance = dist;
        }
    }
    // Batch query students
    const studentIds = records.map(r => r.studentId).filter(Boolean);
    const validStudents = await db_1.default.student.findMany({
        where: { id: { in: studentIds }, schoolId },
        select: { id: true, fullName: true, gender: true }
    });
    const studentMap = new Map(validStudents.map(s => [s.id, s]));
    // Standardize date and session
    const dateSample = records[0]?.date || new Date();
    const dateStr = typeof dateSample === 'string' ? dateSample.split("T")[0] : new Date(dateSample).toISOString().split("T")[0];
    const startDate = new Date(`${dateStr}T00:00:00.000Z`);
    const endDate = new Date(`${dateStr}T23:59:59.999Z`);
    const session = records[0]?.session ? records[0].session.toLowerCase() : null;
    // Batch query existing attendance records
    const existingRecords = await db_1.default.attendance.findMany({
        where: {
            schoolId,
            studentId: { in: Array.from(studentMap.keys()) },
            date: { gte: startDate, lte: endDate },
            ...(session ? { session: { equals: session, mode: 'insensitive' } } : { session: null })
        }
    });
    const existingMap = new Map(existingRecords.map(e => [e.studentId, e]));
    // Build atomic transaction queries
    const txOps = [];
    for (const record of records) {
        const student = studentMap.get(record.studentId);
        if (!student)
            continue;
        const existing = existingMap.get(record.studentId);
        const status = record.status;
        const remarks = record.remarks;
        if (existing) {
            txOps.push(db_1.default.attendance.update({
                where: { id: existing.id },
                data: {
                    status,
                    remarks,
                    teacherId: resolvedTeacherId,
                    session: session || null,
                    locationVerified: locVerified,
                    locationDistance: locDistance,
                }
            }));
        }
        else {
            txOps.push(db_1.default.attendance.create({
                data: {
                    studentId: record.studentId,
                    schoolId,
                    teacherId: resolvedTeacherId,
                    date: startDate,
                    status,
                    session: session || null,
                    remarks,
                    locationVerified: locVerified,
                    locationDistance: locDistance,
                }
            }));
        }
    }
    // Execute all upserts in a single DB round-trip transaction
    const results = await db_1.default.$transaction(txOps);
    // Build status summary for admin notification
    const presentCount = records.filter(r => r.status?.toLowerCase() === 'present').length;
    const lateCount = records.filter(r => r.status?.toLowerCase() === 'late').length;
    const absentCount = records.filter(r => r.status?.toLowerCase() === 'absent').length;
    const excusedCount = records.filter(r => r.status?.toLowerCase() === 'excused').length;
    // Determine grade/section from first valid student record
    const firstStudent = records.map(r => studentMap.get(r.studentId)).find(Boolean);
    const gradeLabel = firstStudent ? `${firstStudent.fullName.split(' ')[0]}'s class` : 'A class';
    // Fire admin notification in background (does not block response)
    (0, exports.sendAdminAttendanceNotification)({
        schoolId,
        teacherId: resolvedTeacherId,
        dateStr,
        session: session || null,
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
            (0, exports.sendAttendanceParentNotification)(student, record.status, dateStr, schoolId).catch(err => {
                console.error(`[BulkAttendance] Parent notification dispatch error for student ${student.id}:`, err);
            });
        }
    }
    // Background audit log
    db_1.default.auditLog.create({
        data: {
            schoolId,
            user_id: userId || teacherId || null,
            action: 'BULK_ATTENDANCE_MARKED',
            entity_type: 'ATTENDANCE',
            new_values: { count: results.length, dateStr, session }
        }
    }).catch(() => { });
    return results;
};
exports.bulkMarkAttendance = bulkMarkAttendance;
/**
 * Notifies all school admins (with a registered push token) when a teacher submits attendance.
 * Sent asynchronously after the bulk upsert — never blocks the teacher's response.
 */
const sendAdminAttendanceNotification = async (params) => {
    const { schoolId, teacherId, dateStr, session, totalCount, presentCount, lateCount, absentCount, excusedCount } = params;
    try {
        const { sendCategoryNotification } = require('./notification.service');
        // Fetch school name and all admin users with a push token in parallel
        const [school, adminUsers, teacher] = await Promise.all([
            db_1.default.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
            db_1.default.user.findMany({
                where: {
                    schoolId,
                    role: 'admin',
                    pushToken: { not: null },
                    is_active: true,
                },
                select: { id: true, pushToken: true },
            }),
            teacherId
                ? db_1.default.teacher.findUnique({ where: { id: teacherId }, select: { name: true } })
                : null,
        ]);
        if (!adminUsers || adminUsers.length === 0)
            return;
        const schoolName = school?.name || 'School';
        const teacherName = teacher?.name || 'A teacher';
        const sessionLabel = session ? ` (${session})` : '';
        // Build compact status summary: e.g. "✅ 28  ⚠️ 2  ❌ 1"
        const parts = [];
        if (presentCount > 0)
            parts.push(`✅ ${presentCount} Present`);
        if (lateCount > 0)
            parts.push(`⏰ ${lateCount} Late`);
        if (absentCount > 0)
            parts.push(`❌ ${absentCount} Absent`);
        if (excusedCount > 0)
            parts.push(`📝 ${excusedCount} Excused`);
        const summary = parts.join('  ') || `${totalCount} students`;
        const title = `Attendance Submitted — ${schoolName}`;
        const body = `${teacherName} submitted attendance for ${dateStr}${sessionLabel}.\n${summary}`;
        const expiredIds = [];
        for (const admin of adminUsers) {
            if (!admin.pushToken)
                continue;
            const result = await sendCategoryNotification(admin.pushToken, {
                type: 'attendance_submitted',
                title,
                body,
                route: '/school/admin',
                schoolId,
                schoolName,
                categoryLabel: 'Attendance Alert',
                tag: `attendance-admin-${schoolId}-${dateStr}`,
            }).catch((err) => {
                console.error(`[AdminNotification] Push error for admin ${admin.id}:`, err);
                return null;
            });
            if (result === 'EXPIRED_TOKEN')
                expiredIds.push(admin.id);
        }
        // Clear stale tokens
        if (expiredIds.length > 0) {
            db_1.default.user.updateMany({
                where: { id: { in: expiredIds } },
                data: { pushToken: null },
            }).catch(() => { });
        }
    }
    catch (err) {
        console.error('[AdminNotification] Failed to send admin attendance notification:', err);
    }
};
exports.sendAdminAttendanceNotification = sendAdminAttendanceNotification;
