"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRoleInSchool = exports.getMemberships = void 0;
const db_1 = __importDefault(require("../config/db"));
const getMemberships = async (userId) => {
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
    });
    const settings = await db_1.default.schoolSettings.findFirst();
    const schoolName = settings?.school_name || 'Bright Path';
    const logo = settings?.school_logo || '';
    if (!user)
        return [];
    return [{
            id: 'single-school',
            name: schoolName,
            role: user.role,
            customSchoolId: 'SCH-0001',
            logo,
        }];
};
exports.getMemberships = getMemberships;
const resolveRoleInSchool = async (userId, _schoolId, requestedRole) => {
    if (!userId)
        return null;
    if (requestedRole) {
        if (requestedRole === 'parent') {
            const parent = await db_1.default.parentStudentLink.findFirst({
                where: { parentId: userId }
            });
            if (parent)
                return 'parent';
        }
        if (requestedRole === 'teacher') {
            const teacher = await db_1.default.teacher.findFirst({
                where: { user_id: userId }
            });
            if (teacher)
                return 'teacher';
            const user = await db_1.default.user.findFirst({
                where: { id: userId, role: 'teacher' }
            });
            if (user)
                return 'teacher';
        }
        if (requestedRole === 'admin' || requestedRole === 'school_admin' || requestedRole === 'school-admin') {
            const user = await db_1.default.user.findFirst({
                where: { id: userId, role: { in: ['admin', 'school_admin', 'super_admin'] } }
            });
            if (user)
                return user.role;
        }
        const staffRoles = [
            'staff',
            'staff_member',
            'registrar',
            'discipline_officer',
            'academic_head',
            'librarian',
            'transport_manager',
            'staff_attendance_officer',
            'hr_officer'
        ];
        if (staffRoles.includes(requestedRole)) {
            const user = await db_1.default.user.findFirst({
                where: { id: userId, role: { in: requestedRole === 'staff' ? ['staff', 'staff_member'] : [requestedRole] } }
            });
            if (user)
                return user.role;
        }
        const customUser = await db_1.default.user.findFirst({
            where: { id: userId, role: requestedRole, is_active: true }
        });
        if (customUser)
            return customUser.role;
    }
    const user = await db_1.default.user.findUnique({
        where: { id: userId }
    });
    if (user && user.role && !['parent', 'student'].includes(user.role))
        return user.role;
    const teacher = await db_1.default.teacher.findFirst({
        where: { user_id: userId }
    });
    if (teacher)
        return 'teacher';
    const parent = await db_1.default.parentStudentLink.findFirst({
        where: { parentId: userId }
    });
    if (parent)
        return 'parent';
    return user?.role || null;
};
exports.resolveRoleInSchool = resolveRoleInSchool;
