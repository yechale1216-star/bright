"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getSettings = exports.DEFAULT_FIXED_STAFF_SESSIONS = void 0;
exports.sanitizeStaffSessions = sanitizeStaffSessions;
const db_1 = __importDefault(require("../config/db"));
exports.DEFAULT_FIXED_STAFF_SESSIONS = [
    {
        id: 'morning',
        name: 'Morning',
        startTime: '08:00',
        endTime: '12:30',
        lateGraceMinutes: 15,
        earlyDepartureToleranceMinutes: 10,
        absenceCutoffMinutes: 90,
        absenceCutoffTime: '09:30',
        earliestCheckinTime: '06:00',
        latestCheckoutTime: '13:30',
        isActive: true,
    },
    {
        id: 'afternoon',
        name: 'Afternoon',
        startTime: '13:30',
        endTime: '17:00',
        lateGraceMinutes: 10,
        earlyDepartureToleranceMinutes: 10,
        absenceCutoffMinutes: 90,
        absenceCutoffTime: '15:00',
        earliestCheckinTime: '12:30',
        latestCheckoutTime: '18:30',
        isActive: true,
    },
];
function addMinutes(timeHHMM, minutes) {
    const [h, m] = (timeHHMM || '08:00').split(':').map(Number);
    const totalMin = Math.max(0, Math.min(24 * 60 - 1, (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m) + minutes));
    const newH = Math.floor(totalMin / 60);
    const newM = totalMin % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}
function getMinutesDiff(timeA, timeB) {
    const [hA, mA] = (timeA || '08:00').split(':').map(Number);
    const [hB, mB] = (timeB || '08:00').split(':').map(Number);
    return (hA * 60 + mA) - (hB * 60 + mB);
}
/**
 * Validates, sanitizes, and locks staff sessions to exactly Morning and Afternoon.
 * Prevents arbitrary session creation, deletion, or renaming.
 */
function sanitizeStaffSessions(rawSessions) {
    let parsed = [];
    if (rawSessions) {
        try {
            parsed = typeof rawSessions === 'string' ? JSON.parse(rawSessions) : rawSessions;
            if (!Array.isArray(parsed))
                parsed = [];
        }
        catch (_) {
            parsed = [];
        }
    }
    const findRaw = (key) => {
        return parsed.find((s) => s &&
            ((s.id && String(s.id).toLowerCase().trim() === key) ||
                (s.name && String(s.name).toLowerCase().trim() === key)));
    };
    const morningRaw = findRaw('morning');
    const afternoonRaw = findRaw('afternoon');
    const buildSession = (key, name, raw, fallback) => {
        const startTime = typeof raw?.startTime === 'string' && /^\d{2}:\d{2}$/.test(raw.startTime)
            ? raw.startTime
            : fallback.startTime;
        const endTime = typeof raw?.endTime === 'string' && /^\d{2}:\d{2}$/.test(raw.endTime)
            ? raw.endTime
            : fallback.endTime;
        const lateGraceMinutes = Number.isFinite(Number(raw?.lateGraceMinutes)) && Number(raw.lateGraceMinutes) >= 0
            ? Math.min(180, Math.floor(Number(raw.lateGraceMinutes)))
            : fallback.lateGraceMinutes;
        const earlyDepartureToleranceMinutes = Number.isFinite(Number(raw?.earlyDepartureToleranceMinutes)) && Number(raw.earlyDepartureToleranceMinutes) >= 0
            ? Math.min(180, Math.floor(Number(raw.earlyDepartureToleranceMinutes)))
            : fallback.earlyDepartureToleranceMinutes;
        // Synchronize absence cutoff minutes & time authoritatively
        let absenceCutoffMinutes = Number.isFinite(Number(raw?.absenceCutoffMinutes)) && Number(raw.absenceCutoffMinutes) >= 0
            ? Math.min(360, Math.floor(Number(raw.absenceCutoffMinutes)))
            : fallback.absenceCutoffMinutes;
        let absenceCutoffTime;
        if (typeof raw?.absenceCutoffTime === 'string' && /^\d{2}:\d{2}$/.test(raw.absenceCutoffTime)) {
            absenceCutoffTime = raw.absenceCutoffTime;
            // Derive minutes if valid
            const diff = getMinutesDiff(absenceCutoffTime, startTime);
            if (diff > 0) {
                absenceCutoffMinutes = diff;
            }
            else {
                absenceCutoffTime = addMinutes(startTime, absenceCutoffMinutes);
            }
        }
        else {
            absenceCutoffTime = addMinutes(startTime, absenceCutoffMinutes);
        }
        const earliestCheckinTime = typeof raw?.earliestCheckinTime === 'string' && /^\d{2}:\d{2}$/.test(raw.earliestCheckinTime)
            ? raw.earliestCheckinTime
            : (typeof raw?.earliestCheckInTime === 'string' && /^\d{2}:\d{2}$/.test(raw.earliestCheckInTime) ? raw.earliestCheckInTime : fallback.earliestCheckinTime);
        const latestCheckoutTime = typeof raw?.latestCheckoutTime === 'string' && /^\d{2}:\d{2}$/.test(raw.latestCheckoutTime)
            ? raw.latestCheckoutTime
            : (typeof raw?.latestCheckOutTime === 'string' && /^\d{2}:\d{2}$/.test(raw.latestCheckOutTime) ? raw.latestCheckOutTime : fallback.latestCheckoutTime);
        return {
            id: key,
            name,
            startTime,
            endTime,
            lateGraceMinutes,
            earlyDepartureToleranceMinutes,
            absenceCutoffMinutes,
            absenceCutoffTime,
            earliestCheckinTime,
            latestCheckoutTime,
            isActive: raw?.isActive !== false,
        };
    };
    return [
        buildSession('morning', 'Morning', morningRaw, exports.DEFAULT_FIXED_STAFF_SESSIONS[0]),
        buildSession('afternoon', 'Afternoon', afternoonRaw, exports.DEFAULT_FIXED_STAFF_SESSIONS[1]),
    ];
}
const DEFAULT_SETTINGS = {
    school_name: '',
    school_phone: '',
    school_address: '',
    academic_year: '2017/2018 E.C.',
    calendar_type: 'ETHIOPIAN',
    attendance_mode: 'session_based',
    attendance_ui_type: 'card_based',
    attendance_threshold: 75,
    allow_late_mark: true,
    email_notifications: true,
    sms_notifications: false,
    notification_time: '16:00',
    school_logo: '',
    allow_attendance_editing: true,
    restrict_location: false,
    school_latitude: null,
    school_longitude: null,
    allowed_radius_meters: 200,
    allow_outside_attendance: true,
    // Staff Attendance Mode & Session Configuration
    staff_attendance_mode: 'daily',
    staff_sessions: exports.DEFAULT_FIXED_STAFF_SESSIONS,
    // Staff Working Hours & Calendar Defaults
    staff_working_days: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY',
    staff_work_start_time: '08:00',
    staff_work_end_time: '17:00',
    staff_late_grace_minutes: 15,
    staff_early_checkout_tolerance_minutes: 15,
    staff_earliest_checkin_time: '06:00',
    staff_latest_checkout_time: '20:00',
    staff_face_required: true,
    staff_geo_required: true,
};
const getSettings = async (schoolId) => {
    let settings = await db_1.default.schoolSettings.findUnique({ where: { schoolId: schoolId } });
    if (!settings) {
        // Auto-create defaults on first access
        settings = await db_1.default.schoolSettings.create({
            data: { ...DEFAULT_SETTINGS, schoolId: schoolId },
        });
    }
    // Ensure staff_sessions is sanitized to fixed morning & afternoon sessions
    settings.staff_sessions = sanitizeStaffSessions(settings.staff_sessions);
    // Ensure settings.academic_year reflects the currently active AcademicYear record
    const activeAY = await db_1.default.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { name: true }
    });
    if (activeAY && activeAY.name) {
        settings.academic_year = activeAY.name;
    }
    return settings;
};
exports.getSettings = getSettings;
const updateSettings = async (schoolId, data) => {
    // If staff_sessions was provided, sanitize and enforce the 2 fixed sessions
    const sanitizedData = { ...data };
    if (sanitizedData.staff_sessions !== undefined) {
        sanitizedData.staff_sessions = sanitizeStaffSessions(sanitizedData.staff_sessions);
    }
    const settings = await db_1.default.schoolSettings.upsert({
        where: { schoolId: schoolId },
        create: { ...DEFAULT_SETTINGS, ...sanitizedData, schoolId: schoolId },
        update: sanitizedData,
    });
    // Ensure output returns sanitized fixed sessions
    settings.staff_sessions = sanitizeStaffSessions(settings.staff_sessions);
    // Keep School table in sync if name changed
    if (data.school_name) {
        await db_1.default.school.update({
            where: { id: schoolId },
            data: { name: data.school_name }
        });
    }
    // Keep AcademicYear table in sync if academic_year changed
    if (data.academic_year) {
        const ayName = String(data.academic_year).trim();
        if (ayName) {
            await db_1.default.$transaction(async (tx) => {
                await tx.academicYear.updateMany({
                    where: { schoolId },
                    data: { isCurrent: false },
                });
                await tx.academicYear.upsert({
                    where: { schoolId_name: { schoolId, name: ayName } },
                    create: {
                        schoolId,
                        name: ayName,
                        startDate: new Date(),
                        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                        isCurrent: true,
                    },
                    update: { isCurrent: true },
                });
            });
        }
    }
    return settings;
};
exports.updateSettings = updateSettings;
