"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRoleInSchool = exports.getMemberships = void 0;
const db_1 = __importDefault(require("../config/db"));
/**
 * Resolves all schools and roles associated with a user.
 * Checks User (staff), Teacher, and ParentStudentLink models.
 */
const getMemberships = async (userId) => {
    const memberships = [];
    // 1. Staff/Admin Memberships (via User table)
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        include: { school: { include: { settings: true } } }
    });
    if (user && user.schoolId && user.role && user.role !== 'parent') {
        memberships.push({
            id: user.schoolId,
            name: user.school?.name || 'My School',
            role: user.role,
            customSchoolId: user.school?.schoolId || '',
            logo: user.school?.settings?.school_logo || ''
        });
    }
    // 2. Teacher Memberships (via Teacher table)
    // Note: currently Teacher table has @unique on user_id, but we handle as potentially multiple for future-proofing
    const teacherRecords = await db_1.default.teacher.findMany({
        where: { user_id: userId },
        include: { school: { include: { settings: true } } }
    });
    for (const t of teacherRecords) {
        if (t.schoolId && !memberships.some(m => m.id === t.schoolId && m.role === 'teacher')) {
            memberships.push({
                id: t.schoolId,
                name: t.school?.name || 'My School',
                role: 'teacher',
                customSchoolId: t.school?.schoolId || '',
                logo: t.school?.settings?.school_logo || ''
            });
        }
    }
    // 3. Parent Memberships (via ParentStudentLink)
    const parentLinks = await db_1.default.parentStudentLink.findMany({
        where: { parentId: userId },
        include: { school: { include: { settings: true } } }
    });
    for (const l of parentLinks) {
        if (l.schoolId && !memberships.some(m => m.id === l.schoolId && m.role === 'parent')) {
            memberships.push({
                id: l.schoolId,
                name: l.school?.name || 'My School',
                role: 'parent',
                customSchoolId: l.school?.schoolId || '',
                logo: l.school?.settings?.school_logo || ''
            });
        }
    }
    return memberships;
};
exports.getMemberships = getMemberships;
/**
 * Determines the specific role a user has within a specific school.
 * If requestedRole is provided, it validates if the user actually has that role.
 * If not provided, it falls back to the highest available role in priority order (Staff > Teacher > Parent).
 */
const resolveRoleInSchool = async (userId, schoolId, requestedRole) => {
    if (!userId || !schoolId)
        return null;
    // 1. If a specific role is requested, validate it specifically
    if (requestedRole) {
        if (requestedRole === 'parent') {
            const parent = await db_1.default.parentStudentLink.findFirst({
                where: { parentId: userId, schoolId }
            });
            if (parent)
                return 'parent';
        }
        if (requestedRole === 'teacher') {
            const teacher = await db_1.default.teacher.findFirst({
                where: { user_id: userId, schoolId }
            });
            if (teacher)
                return 'teacher';
            // Also check if they are in the User table with teacher role
            const user = await db_1.default.user.findFirst({
                where: { id: userId, schoolId, role: 'teacher' }
            });
            if (user)
                return 'teacher';
        }
        if (requestedRole === 'admin' || requestedRole === 'school_admin' || requestedRole === 'school-admin') {
            const user = await db_1.default.user.findFirst({
                where: { id: userId, schoolId, role: { in: ['admin', 'school_admin'] } }
            });
            if (user)
                return user.role;
        }
        // Staff / generic non-teacher school roles (includes 3 new system roles)
        const staffRoles = ['staff', 'registrar', 'discipline_officer', 'call_center'];
        if (staffRoles.includes(requestedRole)) {
            const user = await db_1.default.user.findFirst({
                where: { id: userId, schoolId, role: requestedRole }
            });
            if (user)
                return requestedRole;
        }
    }
    // 2. Fallback: Determine highest available role in priority order
    // Priority: Admin/Staff > Teacher > Parent
    // A. Check User table (Staff/Admin roles) — covers all non-parent/non-student roles
    //    including: admin, school_admin, teacher, staff, registrar, discipline_officer, call_center
    const user = await db_1.default.user.findFirst({
        where: { id: userId, schoolId }
    });
    if (user && user.role && !['parent', 'student'].includes(user.role))
        return user.role;
    // B. Check Teacher table
    const teacher = await db_1.default.teacher.findFirst({
        where: { user_id: userId, schoolId }
    });
    if (teacher)
        return 'teacher';
    // C. Check ParentStudentLink
    const parent = await db_1.default.parentStudentLink.findFirst({
        where: { parentId: userId, schoolId }
    });
    if (parent)
        return 'parent';
    return null;
};
exports.resolveRoleInSchool = resolveRoleInSchool;
