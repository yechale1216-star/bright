"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getSettings = exports.DEFAULT_FIXED_STAFF_SESSIONS = exports.ScheduleValidationError = void 0;
exports.sanitizeStaffSessions = sanitizeStaffSessions;
const db_1 = __importDefault(require("../config/db"));
const schedule_validation_1 = require("../utils/schedule-validation");
class ScheduleValidationError extends Error {
    errors;
    constructor(message, errors) {
        super(message);
        this.name = 'ScheduleValidationError';
        this.errors = errors;
    }
}
exports.ScheduleValidationError = ScheduleValidationError;
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
        allowCheckinAfterCutoff: false,
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
        allowCheckinAfterCutoff: false,
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
        const allowCheckinAfterCutoff = raw?.allowCheckinAfterCutoff === true;
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
            allowCheckinAfterCutoff,
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
    staff_absence_cutoff_minutes: 120,
    staff_absence_cutoff_time: '10:00',
    staff_earliest_checkin_time: '06:00',
    staff_latest_checkout_time: '20:00',
    staff_face_required: true,
    staff_geo_required: true,
    allow_staff_checkin_after_cutoff: false,
};
const ALLOWED_SETTINGS_FIELDS = new Set([
    'school_name',
    'school_phone',
    'school_address',
    'academic_year',
    'calendar_type',
    'attendance_mode',
    'attendance_ui_type',
    'attendance_threshold',
    'allow_late_mark',
    'email_notifications',
    'sms_notifications',
    'notification_time',
    'school_logo',
    'allow_attendance_editing',
    'restrict_location',
    'school_latitude',
    'school_longitude',
    'allowed_radius_meters',
    'allow_outside_attendance',
    'staff_attendance_mode',
    'staff_sessions',
    'staff_working_days',
    'staff_work_start_time',
    'staff_work_end_time',
    'staff_late_grace_minutes',
    'staff_early_checkout_tolerance_minutes',
    'staff_absence_cutoff_minutes',
    'staff_absence_cutoff_time',
    'staff_earliest_checkin_time',
    'staff_latest_checkout_time',
    'staff_checkin_start',
    'staff_checkin_late',
    'staff_checkout_early',
    'staff_face_required',
    'staff_geo_required',
    'allow_staff_checkin_after_cutoff',
]);
const getSettings = async (_schoolId) => {
    let settings = await db_1.default.schoolSettings.findFirst();
    if (!settings) {
        settings = await db_1.default.schoolSettings.create({
            data: { id: 'singleton', ...DEFAULT_SETTINGS },
        });
    }
    // Ensure staff_sessions is sanitized to fixed morning & afternoon sessions
    settings.staff_sessions = sanitizeStaffSessions(settings.staff_sessions);
    // Ensure settings.academic_year reflects the currently active AcademicYear record
    const activeAY = await db_1.default.academicYear.findFirst({
        where: { isCurrent: true },
        select: { name: true }
    });
    if (activeAY && activeAY.name) {
        settings.academic_year = activeAY.name;
    }
    return settings;
};
exports.getSettings = getSettings;
const updateSettings = async (_schoolId, data) => {
    const rawData = { ...data };
    // ── Authoritative Validation Before Persistence ──
    if (rawData.staff_sessions !== undefined) {
        const sessions = sanitizeStaffSessions(rawData.staff_sessions);
        const morning = sessions.find(s => s.id === 'morning') || sessions[0];
        const afternoon = sessions.find(s => s.id === 'afternoon') || sessions[1];
        const sessionValidation = (0, schedule_validation_1.validateSessionSchedule)(morning, afternoon);
        if (!sessionValidation.isValid) {
            const firstError = sessionValidation.errors[0]?.message || 'Invalid session configuration';
            throw new ScheduleValidationError(firstError, sessionValidation.errors);
        }
        rawData.staff_sessions = sessions;
    }
    const hasDailyFields = rawData.staff_work_start_time !== undefined ||
        rawData.staff_work_end_time !== undefined ||
        rawData.staff_late_grace_minutes !== undefined ||
        rawData.staff_early_checkout_tolerance_minutes !== undefined ||
        rawData.staff_absence_cutoff_time !== undefined;
    if (hasDailyFields) {
        const existing = await db_1.default.schoolSettings.findFirst();
        const mergedDaily = {
            ...(existing || DEFAULT_SETTINGS),
            ...rawData,
        };
        const dailyValidation = (0, schedule_validation_1.validateDailySchedule)(mergedDaily);
        if (!dailyValidation.isValid) {
            const firstError = dailyValidation.errors[0]?.message || 'Invalid daily schedule configuration';
            throw new ScheduleValidationError(firstError, dailyValidation.errors);
        }
    }
    const sanitizedData = {};
    for (const key of Object.keys(rawData)) {
        if (ALLOWED_SETTINGS_FIELDS.has(key)) {
            sanitizedData[key] = rawData[key];
        }
    }
    const settings = await db_1.default.schoolSettings.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', ...DEFAULT_SETTINGS, ...sanitizedData },
        update: sanitizedData,
    });
    settings.staff_sessions = sanitizeStaffSessions(settings.staff_sessions);
    // Keep AcademicYear table in sync if academic_year changed
    if (data?.academic_year) {
        const ayName = String(data.academic_year).trim();
        if (ayName) {
            await db_1.default.$transaction(async (tx) => {
                await tx.academicYear.updateMany({
                    data: { isCurrent: false },
                });
                await tx.academicYear.upsert({
                    where: { name: ayName },
                    create: {
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
