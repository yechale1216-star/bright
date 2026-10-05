"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = exports.sendAdminAttendanceNotification = exports.bulkMarkAttendance = exports.sendAttendanceParentNotification = exports.getAttendanceAuditLogs = exports.rejectEditRequest = exports.approveEditRequest = exports.getEditRequests = exports.createEditRequest = exports.getAttendanceByStudent = exports.getAttendance = exports.markAttendance = exports.normalizeSession = exports.normalizeDate = exports.resolveTeacherId = void 0;
exports.calculateDistanceMeters = calculateDistanceMeters;
exports.validateGeofence = validateGeofence;
const db_1 = __importDefault(require("../config/db"));
const academic_year_service_1 = require("./academic-year.service");
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}
const resolveTeacherId = async (_schoolId, rawTeacherId) => {
    if (!rawTeacherId)
        return null;
    const teacher = await db_1.default.teacher.findFirst({
        where: {
            OR: [
                { id: rawTeacherId },
                { user_id: rawTeacherId }
            ]
        }
    });
    if (teacher)
        return teacher.id;
    const user = await db_1.default.user.findFirst({
        where: {
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
    if (user && user.role === 'teacher') {
        const newTeacher = await db_1.default.teacher.create({
            data: {
                name: user.full_name,
                email: user.email,
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
const normalizeDate = (dateInput) => {
    let dateStr;
    if (!dateInput) {
        dateStr = new Date().toISOString().split("T")[0];
    }
    else if (typeof dateInput === 'string') {
        dateStr = dateInput.split("T")[0];
    }
    else if (dateInput instanceof Date) {
        dateStr = dateInput.toISOString().split("T")[0];
    }
    else {
        dateStr = new Date(dateInput).toISOString().split("T")[0];
    }
    const startDate = new Date(`${dateStr}T00:00:00.000Z`);
    const endDate = new Date(`${dateStr}T23:59:59.999Z`);
    return { dateStr, startDate, endDate };
};
exports.normalizeDate = normalizeDate;
const normalizeSession = (sess) => {
    if (sess === null || sess === undefined)
        return null;
    const s = String(sess).trim().toLowerCase();
    if (s === '' || s === 'none' || s === 'daily' || s === 'null' || s === 'undefined' || s === 'total') {
        return null;
    }
    return s;
};
exports.normalizeSession = normalizeSession;
function validateGeofence(data, settings) {
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
    return { locVerified, locDistance };
}
const markAttendance = async (data, _schoolId) => {
    const { studentId, date, status, remarks, teacherId, userRole, userId } = data;
    const session = (0, exports.normalizeSession)(data.session);
    if (!studentId || !date) {
        throw new Error("Student ID and Date are required");
    }
    const resolvedTeacherId = await (0, exports.resolveTeacherId)(undefined, teacherId || userId);
    const student = await db_1.default.student.findUnique({
        where: { id: studentId }
    });
    if (!student) {
        throw new Error("Student not found");
    }
    if (student.status && student.status.toUpperCase() !== 'ACTIVE') {
        throw new Error(`Attendance cannot be recorded for student "${student.fullName}" with status "${student.status}". Only actively enrolled students can have attendance marked.`);
    }
    const settings = await db_1.default.schoolSettings.findFirst();
    const { locVerified, locDistance } = validateGeofence(data, settings);
    const { dateStr, startDate, endDate } = (0, exports.normalizeDate)(date);
    const existing = await db_1.default.attendance.findFirst({
        where: {
            studentId,
            date: {
                gte: startDate,
                lte: endDate,
            },
            ...(session
                ? { session: { equals: session, mode: 'insensitive' } }
                : { OR: [{ session: null }, { session: '' }, { session: 'daily' }] }),
        }
    });
    if (existing && userRole === 'teacher') {
        if (settings && settings.allow_attendance_editing === false) {
            const sessionFilter = session
                ? { session: { equals: session, mode: 'insensitive' } }
                : { OR: [{ session: null }, { session: '' }, { session: 'daily' }] };
            const approvedRequest = await db_1.default.attendanceEditRequest.findFirst({
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
            await db_1.default.attendanceEditRequest.update({
                where: { id: approvedRequest.id },
                data: { isUsed: true }
            });
            await db_1.default.auditLog.create({
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
    const activeAY = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
    const academicYearId = activeAY?.id || null;
    let academicYearRecordId = null;
    if (activeAY) {
        const enrollmentRecord = await db_1.default.studentAcademicYearRecord.findUnique({
            where: { studentId_academicYearId: { studentId, academicYearId: activeAY.id } },
            select: { id: true }
        });
        academicYearRecordId = enrollmentRecord?.id || null;
    }
    const result = existing
        ? await db_1.default.attendance.update({
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
        : await db_1.default.attendance.create({
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
    await db_1.default.auditLog.create({
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
    await (0, exports.sendAttendanceParentNotification)(student, status, dateStr);
    return result;
};
exports.markAttendance = markAttendance;
const getAttendance = async (filters, _schoolId) => {
    const { studentId, date, session, grade, section, startDate: filterStartDate, endDate: filterEndDate, academicYearId: filterAcademicYearId } = filters;
    const where = {};
    if (filterAcademicYearId) {
        where.academicYearId = filterAcademicYearId;
    }
    if (studentId)
        where.studentId = studentId;
    if (date) {
        const { startDate, endDate } = (0, exports.normalizeDate)(date);
        where.date = {
            gte: startDate,
            lte: endDate,
        };
    }
    else if (filterStartDate || filterEndDate) {
        where.date = {};
        if (filterStartDate) {
            const { startDate } = (0, exports.normalizeDate)(filterStartDate);
            where.date.gte = startDate;
        }
        if (filterEndDate) {
            const { endDate } = (0, exports.normalizeDate)(filterEndDate);
            where.date.lte = endDate;
        }
    }
    if (session !== undefined && session !== null) {
        const cleanSess = String(session).trim().toLowerCase();
        if (cleanSess === 'none' || cleanSess === 'daily' || cleanSess === '') {
            where.OR = [{ session: null }, { session: '' }, { session: 'daily' }];
        }
        else if (cleanSess === 'session' || cleanSess === 'session_based' || cleanSess === 'any_session') {
            where.AND = [
                { session: { not: null } },
                { session: { not: '' } },
                { session: { not: 'daily' } }
            ];
        }
        else {
            where.session = { equals: cleanSess, mode: 'insensitive' };
        }
    }
    if (grade || section) {
        where.student = {};
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
const getAttendanceByStudent = async (studentId, _schoolId, filters = {}) => {
    const { session, page, limit } = filters;
    const where = { studentId };
    if (session !== undefined && session !== null) {
        const cleanSess = String(session).trim().toLowerCase();
        if (cleanSess === 'none' || cleanSess === 'daily' || cleanSess === '') {
            where.OR = [{ session: null }, { session: '' }, { session: 'daily' }];
        }
        else if (cleanSess === 'session' || cleanSess === 'session_based' || cleanSess === 'any_session') {
            where.AND = [
                { session: { not: null } },
                { session: { not: '' } },
                { session: { not: 'daily' } }
            ];
        }
        else {
            where.session = { equals: cleanSess, mode: 'insensitive' };
        }
    }
    const resolvedLimit = Math.min(Math.max(Number(limit) || 500, 1), 500);
    const resolvedPage = Math.max(Number(page) || 1, 1);
    const skip = (resolvedPage - 1) * resolvedLimit;
    return await db_1.default.attendance.findMany({
        where,
        orderBy: { date: 'desc' },
        take: resolvedLimit,
        skip,
    });
};
exports.getAttendanceByStudent = getAttendanceByStudent;
const createEditRequest = async (_schoolId, teacherId, data) => {
    const { studentId, date, session } = data;
    const grade = data.grade || data.gradeId || null;
    const section = data.section || data.sectionId || null;
    const stream = data.stream || null;
    let reason = data.reason || null;
    if (!date) {
        throw new Error("Date is required for edit request");
    }
    const dateStr = typeof date === 'string' ? date.split("T")[0] : new Date(date).toISOString().split("T")[0];
    const parsedDate = new Date(`${dateStr}T00:00:00.000Z`);
    let resolvedTeacherId = teacherId;
    const teacherRecord = await db_1.default.teacher.findFirst({
        where: { OR: [{ id: teacherId }, { user_id: teacherId }] }
    });
    if (teacherRecord) {
        resolvedTeacherId = teacherRecord.id;
    }
    const editRequest = await db_1.default.attendanceEditRequest.create({
        data: {
            teacherId: resolvedTeacherId,
            studentId: studentId || null,
            gradeId: grade || null,
            sectionId: section || null,
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
const getEditRequests = async (_schoolId, filters = {}) => {
    const { teacherId, status } = filters;
    const where = {};
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
        orderBy: { createdAt: 'desc' },
        take: 200,
    });
};
exports.getEditRequests = getEditRequests;
const approveEditRequest = async (requestId, adminUserId, _schoolId, adminNote) => {
    const request = await db_1.default.attendanceEditRequest.findUnique({
        where: { id: requestId }
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
const rejectEditRequest = async (requestId, adminUserId, _schoolId, adminNote) => {
    const request = await db_1.default.attendanceEditRequest.findUnique({
        where: { id: requestId }
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
const getAttendanceAuditLogs = async (_schoolId) => {
    return await db_1.default.auditLog.findMany({
        where: {
            entity_type: {
                in: ['ATTENDANCE', 'ATTENDANCE_EDIT_REQUEST']
            }
        },
        orderBy: { created_at: 'desc' },
        take: 100
    });
};
exports.getAttendanceAuditLogs = getAttendanceAuditLogs;
const sendAttendanceParentNotification = async (student, status, dateStr, _schoolId) => {
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
                studentId: student.id,
                type,
                title,
                message,
                isRead: false
            }
        });
        const { sendCategoryNotification } = require('./notification.service');
        const settings = await db_1.default.schoolSettings.findFirst();
        const schoolName = settings?.school_name || 'Addis Hiwot School';
        const categoryLabel = isAbsent ? 'Absent Alert' : isLate ? 'Late Arrival' : 'Excused Absence';
        for (const link of parentLinks) {
            if (link.parent && link.parent.pushToken) {
                if (link.parent.phone) {
                    const prefs = await db_1.default.parentPreferences.findUnique({
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
const bulkMarkAttendance = async (records, _schoolId, meta = {}) => {
    if (!Array.isArray(records) || records.length === 0)
        return [];
    if (records.length > 500) {
        throw new Error('Maximum 500 attendance records allowed per bulk request');
    }
    const { userRole, userId, teacherId } = meta;
    const resolvedTeacherId = await (0, exports.resolveTeacherId)(undefined, teacherId || userId);
    const settings = await db_1.default.schoolSettings.findFirst();
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
    const dedupedMap = new Map();
    for (const r of records) {
        if (!r.studentId)
            continue;
        const { dateStr } = (0, exports.normalizeDate)(r.date);
        const recSession = (0, exports.normalizeSession)(r.session) || '__daily__';
        const payloadKey = `${r.studentId}::${dateStr}::${recSession}`;
        dedupedMap.set(payloadKey, r);
    }
    const cleanRecords = Array.from(dedupedMap.values());
    if (cleanRecords.length === 0)
        return [];
    const studentIds = Array.from(new Set(cleanRecords.map(r => r.studentId).filter(Boolean)));
    const validStudents = await db_1.default.student.findMany({
        where: { id: { in: studentIds }, status: 'ACTIVE' },
        select: { id: true, fullName: true, gender: true }
    });
    const studentMap = new Map(validStudents.map(s => [s.id, s]));
    const activeAY = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
    const activeAYId = activeAY?.id || null;
    const enrollmentMap = new Map();
    if (activeAYId) {
        const enrollments = await db_1.default.studentAcademicYearRecord.findMany({
            where: {
                studentId: { in: studentIds },
                academicYearId: activeAYId
            },
            select: { studentId: true, id: true }
        });
        enrollments.forEach(e => enrollmentMap.set(e.studentId, e.id));
    }
    const dateRanges = new Map();
    cleanRecords.forEach(r => {
        const { dateStr, startDate, endDate } = (0, exports.normalizeDate)(r.date);
        if (!dateRanges.has(dateStr)) {
            dateRanges.set(dateStr, { startDate, endDate });
        }
    });
    const dateConditions = Array.from(dateRanges.values()).map(r => ({
        date: { gte: r.startDate, lte: r.endDate }
    }));
    const existingRecords = await db_1.default.attendance.findMany({
        where: {
            studentId: { in: Array.from(studentMap.keys()) },
            OR: dateConditions.length > 0 ? dateConditions : undefined,
        }
    });
    const existingMap = new Map();
    existingRecords.forEach(e => {
        const eDateStr = e.date ? e.date.toISOString().split("T")[0] : 'unknown';
        const sKey = (0, exports.normalizeSession)(e.session) || '__daily__';
        existingMap.set(`${e.studentId}::${eDateStr}::${sKey}`, e);
    });
    const hasExistingUpdates = cleanRecords.some(r => {
        const { dateStr } = (0, exports.normalizeDate)(r.date);
        const recSession = (0, exports.normalizeSession)(r.session);
        const mapKey = `${r.studentId}::${dateStr}::${recSession || '__daily__'}`;
        return existingMap.has(mapKey);
    });
    const sampleSession = (0, exports.normalizeSession)(cleanRecords[0]?.session);
    const sampleDateInfo = (0, exports.normalizeDate)(cleanRecords[0]?.date);
    if (hasExistingUpdates && userRole === 'teacher' && settings && settings.allow_attendance_editing === false) {
        // Collect the unique (date, session) pairs that have existing records needing update.
        // We must verify an approved edit request exists for EACH such pair —
        // checking only the first record was the prior bug that allowed session bypass.
        const pairsNeedingPermission = new Map();
        for (const r of cleanRecords) {
            const { dateStr, startDate, endDate } = (0, exports.normalizeDate)(r.date);
            const recSession = (0, exports.normalizeSession)(r.session);
            const mapKey = `${r.studentId}::${dateStr}::${recSession || '__daily__'}`;
            if (existingMap.has(mapKey)) {
                const pairKey = `${dateStr}::${recSession || '__daily__'}`;
                if (!pairsNeedingPermission.has(pairKey)) {
                    pairsNeedingPermission.set(pairKey, { dateStr, session: recSession, startDate, endDate });
                }
            }
        }
        // Verify an approved, unused edit request for each (date, session) pair
        for (const [, pairInfo] of pairsNeedingPermission) {
            const { dateStr: pDateStr, session: pSession, startDate: pStart, endDate: pEnd } = pairInfo;
            const sessionFilter = pSession
                ? { session: { equals: pSession, mode: 'insensitive' } }
                : { OR: [{ session: null }, { session: '' }, { session: 'daily' }] };
            const approvedRequest = await db_1.default.attendanceEditRequest.findFirst({
                where: {
                    status: 'APPROVED',
                    isUsed: false,
                    date: { gte: pStart, lte: pEnd },
                    ...sessionFilter,
                    OR: [
                        ...(resolvedTeacherId ? [{ teacherId: resolvedTeacherId }] : []),
                        ...(teacherId ? [{ teacherId }] : []),
                        ...(userId ? [{ teacherId: userId }] : [])
                    ],
                }
            });
            if (!approvedRequest) {
                const sessionLabel = pSession ? ` (${pSession} session)` : '';
                throw new Error(`Attendance editing is disabled by School Admin. Please submit an edit request for ${pDateStr}${sessionLabel}.`);
            }
            // Mark each approved request as used
            await db_1.default.attendanceEditRequest.update({
                where: { id: approvedRequest.id },
                data: { isUsed: true }
            });
            await db_1.default.auditLog.create({
                data: {
                    user_id: userId || teacherId || null,
                    action: 'ATTENDANCE_EDIT_PERMITTED',
                    entity_type: 'ATTENDANCE_EDIT_REQUEST',
                    entity_id: approvedRequest.id,
                    new_values: { count: cleanRecords.length, session: pSession || null, dateStr: pDateStr }
                }
            }).catch(err => console.error('[AuditLog] bulk edit permission use log error:', err));
        }
    }
    const txOps = [];
    for (const record of cleanRecords) {
        const student = studentMap.get(record.studentId);
        if (!student)
            continue;
        const { startDate, dateStr } = (0, exports.normalizeDate)(record.date);
        const recSession = (0, exports.normalizeSession)(record.session);
        const mapKey = `${record.studentId}::${dateStr}::${recSession || '__daily__'}`;
        const existing = existingMap.get(mapKey);
        const status = record.status;
        const remarks = record.remarks;
        const ayRecordId = enrollmentMap.get(record.studentId) || null;
        if (existing) {
            txOps.push(db_1.default.attendance.update({
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
            }));
        }
        else {
            txOps.push(db_1.default.attendance.create({
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
            }));
        }
    }
    const results = await db_1.default.$transaction(txOps);
    const presentCount = cleanRecords.filter(r => r.status?.toLowerCase() === 'present').length;
    const lateCount = cleanRecords.filter(r => r.status?.toLowerCase() === 'late').length;
    const absentCount = cleanRecords.filter(r => r.status?.toLowerCase() === 'absent').length;
    const excusedCount = cleanRecords.filter(r => r.status?.toLowerCase() === 'excused').length;
    (0, exports.sendAdminAttendanceNotification)({
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
            const recDateStr = (0, exports.normalizeDate)(record.date).dateStr;
            (0, exports.sendAttendanceParentNotification)(student, record.status, recDateStr).catch(err => {
                console.error(`[BulkAttendance] Parent notification dispatch error for student ${student.id}:`, err);
            });
        }
    }
    db_1.default.auditLog.create({
        data: {
            user_id: userId || teacherId || null,
            action: 'BULK_ATTENDANCE_MARKED',
            entity_type: 'ATTENDANCE',
            new_values: { count: results.length, dateStr: sampleDateInfo.dateStr, session: sampleSession }
        }
    }).catch(() => { });
    return results;
};
exports.bulkMarkAttendance = bulkMarkAttendance;
const sendAdminAttendanceNotification = async (params) => {
    const { teacherId, dateStr, session, totalCount, presentCount, lateCount, absentCount, excusedCount } = params;
    try {
        const { sendCategoryNotification } = require('./notification.service');
        const [settings, adminUsers, teacher] = await Promise.all([
            db_1.default.schoolSettings.findFirst(),
            db_1.default.user.findMany({
                where: {
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
        const schoolName = settings?.school_name || 'Addis Hiwot School';
        const teacherName = teacher?.name || 'A teacher';
        const sessionLabel = session ? ` (${session})` : '';
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
                schoolName,
                categoryLabel: 'Attendance Alert',
                tag: `attendance-admin-${dateStr}`,
            }).catch((err) => {
                console.error(`[AdminNotification] Push error for admin ${admin.id}:`, err);
                return null;
            });
            if (result === 'EXPIRED_TOKEN')
                expiredIds.push(admin.id);
        }
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
/**
 * Lightweight dashboard summary. Uses DB-side aggregation.
 * Returns: totalStudents, today's attendance breakdown, 14-day trend.
 * ~3 queries total — never loads all rows into memory.
 */
const getDashboardSummary = async (filters) => {
    const todayStr = filters.date
        ? String(filters.date).split('T')[0]
        : new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
    const { startDate: todayStart, endDate: todayEnd } = (0, exports.normalizeDate)(todayStr);
    // 14-day window for trend chart
    const trend14Start = new Date(todayStart);
    trend14Start.setDate(trend14Start.getDate() - 13);
    // 1. Active student count & Teacher count in parallel
    const [totalStudents, teacherCount, userTeacherCount] = await Promise.all([
        db_1.default.student.count({
            where: { status: 'ACTIVE' }
        }),
        db_1.default.teacher.count({ where: { is_active: true } }).catch(() => 0),
        db_1.default.user.count({
            where: {
                role: { equals: 'teacher', mode: 'insensitive' },
                is_active: true,
            },
        }).catch(() => 0),
    ]);
    const totalTeachers = Math.max(teacherCount, userTeacherCount);
    // 2. Grade distribution (pre-aggregated)
    const [gradeGroups, grades] = await Promise.all([
        db_1.default.student.groupBy({
            by: ['gradeId'],
            where: { status: 'ACTIVE' },
            _count: { _all: true }
        }).catch(() => []),
        db_1.default.grade.findMany({ select: { id: true, name: true } }).catch(() => []),
    ]);
    const gradeMap = new Map((grades || []).map((g) => [g.id, g.name]));
    const gradeDistribution = (gradeGroups || [])
        .map((g) => ({
        grade: (g.gradeId && gradeMap.get(g.gradeId)) || 'Unassigned',
        students: g._count?._all || 0,
    }))
        .sort((a, b) => b.students - a.students);
    // 3. Today's attendance records
    const todayRecords = await db_1.default.attendance.findMany({
        where: {
            date: { gte: todayStart, lte: todayEnd },
            ...(filters.session && filters.session !== 'all' ? { session: filters.session } : {})
        },
        select: {
            studentId: true,
            status: true,
            session: true,
        }
    });
    const normStatus = (raw) => {
        const s = String(raw || '').toLowerCase().trim();
        if (s === 'present')
            return 'present';
        if (s === 'late')
            return 'late';
        if (s === 'absent')
            return 'absent';
        if (s === 'excused' || s === 'early_departure' || s === 'earlydeparture' || s === 'on_leave')
            return 'excused';
        return 'present';
    };
    const morningSummary = { present: 0, late: 0, absent: 0, earlyDeparture: 0, excused: 0, total: 0 };
    const afternoonSummary = { present: 0, late: 0, absent: 0, earlyDeparture: 0, excused: 0, total: 0 };
    const studentDayMap = new Map();
    for (const r of todayRecords) {
        const st = normStatus(r.status);
        const sess = String(r.session || '').toLowerCase().trim();
        if (!studentDayMap.has(r.studentId)) {
            studentDayMap.set(r.studentId, {});
        }
        const studentEntry = studentDayMap.get(r.studentId);
        if (sess === 'morning') {
            studentEntry.morning = st;
            morningSummary[st === 'excused' ? 'earlyDeparture' : st]++;
            morningSummary.total++;
        }
        else if (sess === 'afternoon') {
            studentEntry.afternoon = st;
            afternoonSummary[st === 'excused' ? 'earlyDeparture' : st]++;
            afternoonSummary.total++;
        }
        else {
            studentEntry.daily = st;
        }
    }
    morningSummary.excused = morningSummary.earlyDeparture;
    afternoonSummary.excused = afternoonSummary.earlyDeparture;
    // Consolidate full-day status per student
    const todaySummary = { present: 0, late: 0, absent: 0, earlyDeparture: 0, excused: 0, total: 0 };
    for (const entry of studentDayMap.values()) {
        let resolved = null;
        if (entry.morning && entry.afternoon) {
            if (entry.morning === entry.afternoon) {
                resolved = entry.morning;
            }
            else if (entry.morning === 'present' || entry.afternoon === 'present') {
                resolved = (entry.morning === 'late' || entry.afternoon === 'late') ? 'late' : 'present';
            }
            else if (entry.morning === 'late' || entry.afternoon === 'late') {
                resolved = 'late';
            }
            else if (entry.morning === 'excused' || entry.afternoon === 'excused') {
                resolved = 'excused';
            }
            else {
                resolved = 'absent';
            }
        }
        else if (entry.morning) {
            resolved = entry.morning;
        }
        else if (entry.afternoon) {
            resolved = entry.afternoon;
        }
        else if (entry.daily) {
            resolved = entry.daily;
        }
        if (resolved) {
            todaySummary[resolved === 'excused' ? 'earlyDeparture' : resolved]++;
            todaySummary.total++;
        }
    }
    todaySummary.excused = todaySummary.earlyDeparture;
    // 4. 14-day trend — group by date+status in one query
    const trendGroups = await db_1.default.attendance.groupBy({
        by: ['date', 'status'],
        where: {
            date: { gte: trend14Start, lte: todayEnd },
            ...(filters.session && filters.session !== 'all' ? { session: filters.session } : {})
        },
        _count: { _all: true },
        orderBy: { date: 'asc' }
    });
    // Build trend map keyed by date string
    const trendMap = {};
    for (const g of trendGroups) {
        const d = g.date instanceof Date
            ? g.date.toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })
            : String(g.date).split('T')[0];
        if (!trendMap[d]) {
            trendMap[d] = { date: d, present: 0, absent: 0, late: 0, earlyDeparture: 0, total: 0 };
        }
        const count = g._count._all;
        trendMap[d].total += count;
        const st = normStatus(g.status);
        if (st === 'present')
            trendMap[d].present += count;
        else if (st === 'absent')
            trendMap[d].absent += count;
        else if (st === 'late')
            trendMap[d].late += count;
        else if (st === 'excused')
            trendMap[d].earlyDeparture += count;
    }
    const trend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));
    return {
        totalStudents,
        totalTeachers,
        gradeDistribution,
        today: {
            date: todayStr,
            ...todaySummary,
        },
        sessionBreakdown: {
            morning: morningSummary,
            afternoon: afternoonSummary,
        },
        trend,
    };
};
exports.getDashboardSummary = getDashboardSummary;
