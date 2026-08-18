"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getSettings = void 0;
const db_1 = __importDefault(require("../config/db"));
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
    const settings = await db_1.default.schoolSettings.upsert({
        where: { schoolId: schoolId },
        create: { ...DEFAULT_SETTINGS, ...data, schoolId: schoolId },
        update: data,
    });
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
