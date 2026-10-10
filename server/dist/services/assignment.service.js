"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTeacherClassSubjectAccess = exports.getTeacherClassDetails = exports.getTeacherPortalClasses = exports.deleteAssignment = exports.updateAssignment = exports.createAssignment = exports.getAssignments = void 0;
const db_1 = __importDefault(require("../config/db"));
const getAssignments = async (_schoolId, teacherId, filters = {}) => {
    const where = {};
    if (teacherId || filters.teacherId) {
        const rawId = teacherId || filters.teacherId;
        let resolvedTeacherId = rawId;
        const user = await db_1.default.user.findUnique({
            where: { id: rawId },
        });
        if (user && user.teacher_id) {
            resolvedTeacherId = user.teacher_id;
        }
        where.teacher_id = resolvedTeacherId;
    }
    if (filters.role)
        where.role = filters.role;
    if (filters.gradeId)
        where.gradeId = filters.gradeId;
    if (filters.sectionId)
        where.sectionId = filters.sectionId;
    if (filters.subjectId)
        where.subjectId = filters.subjectId;
    if (filters.academicYearId)
        where.academicYearId = filters.academicYearId;
    return await db_1.default.teacherAssignment.findMany({
        where,
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        include: {
            teacher: true,
            grade: true,
            section: true,
            stream: true,
            academicYear: true,
            subjectRef: true,
        },
    });
};
exports.getAssignments = getAssignments;
const createAssignment = async (data, _schoolId) => {
    let teacherId = data.teacher_id;
    const user = await db_1.default.user.findUnique({
        where: { id: teacherId },
    });
    if (user) {
        if (user.teacher_id) {
            teacherId = user.teacher_id;
        }
        else if (user.role === 'teacher') {
            const newTeacher = await db_1.default.teacher.create({
                data: {
                    name: user.full_name,
                    email: user.email,
                    user_id: user.id,
                    phone: user.phone || null,
                    profile_photo: user.profile_photo || null,
                },
            });
            await db_1.default.user.update({
                where: { id: user.id },
                data: { teacher_id: newTeacher.id },
            });
            teacherId = newTeacher.id;
        }
    }
    const teacher = await db_1.default.teacher.findUnique({
        where: { id: teacherId },
    });
    if (!teacher) {
        throw new Error('Teacher does not exist.');
    }
    const grade = await db_1.default.grade.findUnique({
        where: { id: data.gradeId },
    });
    if (!grade) {
        throw new Error('Grade does not exist.');
    }
    const section = await db_1.default.section.findUnique({
        where: { id: data.sectionId },
    });
    if (!section) {
        throw new Error('Section does not exist.');
    }
    if (data.streamId) {
        const stream = await db_1.default.stream.findUnique({
            where: { id: data.streamId },
        });
        if (!stream) {
            throw new Error('Stream does not exist.');
        }
    }
    // Determine Academic Year
    let targetYearId = data.academicYearId;
    if (!targetYearId) {
        const currentYear = await db_1.default.academicYear.findFirst({ where: { isCurrent: true } });
        if (currentYear)
            targetYearId = currentYear.id;
    }
    // Resolve Subject Name
    let subjectName = data.subject;
    if (data.subjectId) {
        const subj = await db_1.default.subject.findUnique({ where: { id: data.subjectId } });
        if (subj)
            subjectName = subj.name;
    }
    const role = data.role || 'SUBJECT_TEACHER';
    // ── Conflict Check 1: Homeroom Teacher Exclusivity ───────────────────────
    if (role === 'HOMEROOM_TEACHER') {
        const existingHomeroom = await db_1.default.teacherAssignment.findFirst({
            where: {
                gradeId: data.gradeId,
                sectionId: data.sectionId,
                streamId: data.streamId || null,
                ...(targetYearId ? { academicYearId: targetYearId } : {}),
                role: 'HOMEROOM_TEACHER',
            },
            include: { teacher: true },
        });
        if (existingHomeroom) {
            const existingTeacherName = existingHomeroom.teacher?.name || 'another teacher';
            throw new Error(`This class section already has a Homeroom Teacher assigned (${existingTeacherName}) for this academic year.`);
        }
    }
    // ── Conflict Check 2: Subject Teacher Exclusivity per Subject/Section ────
    if (role === 'SUBJECT_TEACHER' && (data.subjectId || subjectName)) {
        const existingSubjectTeacher = await db_1.default.teacherAssignment.findFirst({
            where: {
                gradeId: data.gradeId,
                sectionId: data.sectionId,
                streamId: data.streamId || null,
                ...(targetYearId ? { academicYearId: targetYearId } : {}),
                role: 'SUBJECT_TEACHER',
                OR: [
                    ...(data.subjectId ? [{ subjectId: data.subjectId }] : []),
                    ...(subjectName ? [{ subject: { equals: subjectName, mode: 'insensitive' } }] : []),
                ],
            },
            include: { teacher: true },
        });
        if (existingSubjectTeacher && existingSubjectTeacher.teacher_id !== teacherId) {
            const existingTeacherName = existingSubjectTeacher.teacher?.name || 'another teacher';
            throw new Error(`This subject (${subjectName || 'selected subject'}) in this section is already assigned to ${existingTeacherName}.`);
        }
    }
    // ── Duplicate Assignment Prevention ──────────────────────────────────────
    const existingExact = await db_1.default.teacherAssignment.findFirst({
        where: {
            teacher_id: teacherId,
            gradeId: data.gradeId,
            sectionId: data.sectionId,
            streamId: data.streamId || null,
            role,
            ...(targetYearId ? { academicYearId: targetYearId } : {}),
            ...(data.subjectId ? { subjectId: data.subjectId } : subjectName ? { subject: subjectName } : {}),
        },
    });
    if (existingExact) {
        throw new Error('This teacher already has this exact assignment.');
    }
    return await db_1.default.teacherAssignment.create({
        data: {
            teacher_id: teacherId,
            academicYearId: targetYearId || undefined,
            gradeId: data.gradeId,
            sectionId: data.sectionId,
            streamId: data.streamId || null,
            subjectId: data.subjectId || null,
            subject: subjectName || null,
            role,
        },
        include: {
            teacher: true,
            grade: true,
            section: true,
            stream: true,
            academicYear: true,
            subjectRef: true,
        },
    });
};
exports.createAssignment = createAssignment;
const updateAssignment = async (id, data, _schoolId) => {
    let teacherId = data.teacher_id;
    const user = await db_1.default.user.findUnique({
        where: { id: teacherId },
    });
    if (user && user.teacher_id) {
        teacherId = user.teacher_id;
    }
    const teacher = await db_1.default.teacher.findUnique({
        where: { id: teacherId },
    });
    if (!teacher) {
        throw new Error('Teacher does not exist.');
    }
    const grade = await db_1.default.grade.findUnique({
        where: { id: data.gradeId },
    });
    if (!grade) {
        throw new Error('Grade does not exist.');
    }
    const section = await db_1.default.section.findUnique({
        where: { id: data.sectionId },
    });
    if (!section) {
        throw new Error('Section does not exist.');
    }
    if (data.streamId) {
        const stream = await db_1.default.stream.findUnique({
            where: { id: data.streamId },
        });
        if (!stream) {
            throw new Error('Stream does not exist.');
        }
    }
    let targetYearId = data.academicYearId;
    if (!targetYearId) {
        const currentYear = await db_1.default.academicYear.findFirst({ where: { isCurrent: true } });
        if (currentYear)
            targetYearId = currentYear.id;
    }
    let subjectName = data.subject;
    if (data.subjectId) {
        const subj = await db_1.default.subject.findUnique({ where: { id: data.subjectId } });
        if (subj)
            subjectName = subj.name;
    }
    const role = data.role || 'SUBJECT_TEACHER';
    // Conflict Check 1: Homeroom exclusivity
    if (role === 'HOMEROOM_TEACHER') {
        const conflictingHomeroom = await db_1.default.teacherAssignment.findFirst({
            where: {
                id: { not: id },
                gradeId: data.gradeId,
                sectionId: data.sectionId,
                streamId: data.streamId || null,
                ...(targetYearId ? { academicYearId: targetYearId } : {}),
                role: 'HOMEROOM_TEACHER',
            },
            include: { teacher: true },
        });
        if (conflictingHomeroom) {
            const teacherName = conflictingHomeroom.teacher?.name || 'another teacher';
            throw new Error(`This class section already has an active homeroom teacher (${teacherName}).`);
        }
    }
    // Conflict Check 2: Subject Teacher exclusivity
    if (role === 'SUBJECT_TEACHER' && (data.subjectId || subjectName)) {
        const conflictingSubject = await db_1.default.teacherAssignment.findFirst({
            where: {
                id: { not: id },
                gradeId: data.gradeId,
                sectionId: data.sectionId,
                streamId: data.streamId || null,
                ...(targetYearId ? { academicYearId: targetYearId } : {}),
                role: 'SUBJECT_TEACHER',
                OR: [
                    ...(data.subjectId ? [{ subjectId: data.subjectId }] : []),
                    ...(subjectName ? [{ subject: { equals: subjectName, mode: 'insensitive' } }] : []),
                ],
            },
            include: { teacher: true },
        });
        if (conflictingSubject && conflictingSubject.teacher_id !== teacherId) {
            const teacherName = conflictingSubject.teacher?.name || 'another teacher';
            throw new Error(`This subject (${subjectName || 'selected subject'}) is already assigned to ${teacherName}.`);
        }
    }
    return await db_1.default.teacherAssignment.update({
        where: { id },
        data: {
            teacher_id: teacherId,
            academicYearId: targetYearId || undefined,
            gradeId: data.gradeId,
            sectionId: data.sectionId,
            streamId: data.streamId || null,
            subjectId: data.subjectId || null,
            subject: subjectName || null,
            role,
        },
        include: {
            teacher: true,
            grade: true,
            section: true,
            stream: true,
            academicYear: true,
            subjectRef: true,
        },
    });
};
exports.updateAssignment = updateAssignment;
const deleteAssignment = async (id, _schoolId) => {
    return await db_1.default.teacherAssignment.delete({
        where: { id },
    });
};
exports.deleteAssignment = deleteAssignment;
// ─── Subject Teacher Portal Service ──────────────────────────────────────────
const getTeacherPortalClasses = async (userId) => {
    // Find teacher record associated with this user
    let teacherId;
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        select: { id: true, teacher_id: true, role: true },
    });
    if (user?.teacher_id) {
        teacherId = user.teacher_id;
    }
    else {
        const teacher = await db_1.default.teacher.findFirst({
            where: { user_id: userId },
        });
        if (teacher)
            teacherId = teacher.id;
    }
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    if (!teacherId && !isAdmin) {
        return { assignments: [], currentYear: null };
    }
    const currentYear = await db_1.default.academicYear.findFirst({
        where: { isCurrent: true },
    });
    const teacherIds = [teacherId, userId].filter(Boolean);
    const assignments = await db_1.default.teacherAssignment.findMany({
        where: {
            ...(isAdmin && !teacherId ? {} : { teacher_id: { in: teacherIds } }),
            ...(currentYear
                ? {
                    OR: [
                        { academicYearId: currentYear.id },
                        { academicYearId: null },
                    ],
                }
                : {}),
        },
        include: {
            grade: true,
            section: true,
            stream: true,
            academicYear: true,
            subjectRef: true,
            teacher: {
                select: { id: true, name: true, email: true },
            },
        },
        orderBy: [{ role: 'asc' }, { grade: { name: 'asc' } }, { section: { name: 'asc' } }],
    });
    return { assignments, currentYear };
};
exports.getTeacherPortalClasses = getTeacherPortalClasses;
const getTeacherClassDetails = async (userId, params) => {
    const { assignments } = await (0, exports.getTeacherPortalClasses)(userId);
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    // Verify access: Teacher must have an assignment for this grade and section (or be admin)
    const hasAccess = isAdmin ||
        assignments.some((a) => a.gradeId === params.gradeId &&
            a.sectionId === params.sectionId &&
            (!params.subjectId || !a.subjectId || a.subjectId === params.subjectId));
    if (!hasAccess) {
        throw new Error('Access denied. You are not assigned to this class and subject.');
    }
    // 1. Students in this class
    const students = await db_1.default.student.findMany({
        where: {
            gradeId: params.gradeId,
            sectionId: params.sectionId,
            status: 'ACTIVE',
        },
        orderBy: { fullName: 'asc' },
        select: {
            id: true,
            fullName: true,
            student_id: true,
            gender: true,
            parent_phone: true,
            parent_name: true,
        },
    });
    // 2. Homework & assignments for this class & subject
    const homework = await db_1.default.assignment.findMany({
        where: {
            gradeId: params.gradeId,
            ...(params.sectionId ? { sectionId: params.sectionId } : {}),
            ...(params.subjectId ? { subjectId: params.subjectId } : {}),
        },
        include: {
            subject: true,
            submissions: {
                include: {
                    student: { select: { id: true, fullName: true, student_id: true } },
                },
                orderBy: { submittedAt: 'desc' },
            },
            _count: { select: { submissions: true } },
        },
        orderBy: { dueDate: 'desc' },
    });
    // 3. Learning materials for this grade & subject
    const materials = await db_1.default.learningMaterial.findMany({
        where: {
            gradeId: params.gradeId,
            ...(params.subjectId ? { subjectId: params.subjectId } : {}),
        },
        include: { subject: true },
        orderBy: { createdAt: 'desc' },
    });
    // 4. Assessments & Gradebook for this grade & subject
    const assessments = await db_1.default.assessment.findMany({
        where: {
            gradeId: params.gradeId,
            ...(params.sectionId ? { sectionId: params.sectionId } : {}),
            ...(params.subjectId ? { subjectId: params.subjectId } : {}),
            ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
        },
        include: {
            exam: true,
            subject: true,
            marks: {
                include: {
                    student: { select: { id: true, fullName: true, student_id: true } },
                },
            },
            _count: { select: { marks: true } },
        },
        orderBy: { date: 'desc' },
    });
    return {
        students,
        homework,
        materials,
        assessments,
    };
};
exports.getTeacherClassDetails = getTeacherClassDetails;
/**
 * Verify whether a teacher is authorized to access, create assessments/marks for,
 * or create learning materials for a specific grade and subject (and optional section).
 * Admins, superadmins, and school_admins always bypass this check.
 */
const verifyTeacherClassSubjectAccess = async (userId, params) => {
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        select: { id: true, teacher_id: true, role: true, email: true },
    });
    if (!user)
        return { allowed: false, reason: 'User not found' };
    const nonTeacherRoles = ['admin', 'superadmin', 'school_admin'];
    if (nonTeacherRoles.includes(user.role?.toLowerCase() || '')) {
        return { allowed: true };
    }
    if (user.role?.toLowerCase() !== 'teacher') {
        return { allowed: false, reason: 'Only assigned teachers or administrators are permitted to perform this action.' };
    }
    let teacherId = user.teacher_id;
    if (!teacherId) {
        const teacher = await db_1.default.teacher.findFirst({
            where: {
                OR: [
                    { user_id: userId },
                    ...(user.email ? [{ email: user.email }] : []),
                ],
            },
        });
        if (teacher)
            teacherId = teacher.id;
    }
    if (!teacherId) {
        return { allowed: false, reason: 'No teacher profile linked to your user account.' };
    }
    const assignments = await db_1.default.teacherAssignment.findMany({
        where: {
            teacher_id: teacherId,
            gradeId: params.gradeId,
        },
        include: {
            subjectRef: true,
            grade: true,
            section: true,
        },
    });
    if (assignments.length === 0) {
        return { allowed: false, reason: 'You are not assigned to this grade.' };
    }
    const targetSubject = await db_1.default.subject.findUnique({
        where: { id: params.subjectId },
        select: { id: true, name: true, code: true },
    });
    const matchingAssignment = assignments.find((a) => {
        // Subject match
        const subjMatch = a.subjectId === params.subjectId ||
            (targetSubject && ((a.subject && (a.subject.toLowerCase() === targetSubject.name.toLowerCase() || a.subject.toLowerCase() === targetSubject.code.toLowerCase())) ||
                (a.subjectRef && (a.subjectRef.id === params.subjectId || a.subjectRef.name.toLowerCase() === targetSubject.name.toLowerCase() || a.subjectRef.code.toLowerCase() === targetSubject.code.toLowerCase()))));
        if (!subjMatch)
            return false;
        // If sectionId is specified, check section match
        if (params.sectionId && a.sectionId && a.sectionId !== params.sectionId) {
            return false;
        }
        return true;
    });
    if (!matchingAssignment) {
        return { allowed: false, reason: 'You are not assigned to teach this subject in this grade.' };
    }
    return { allowed: true };
};
exports.verifyTeacherClassSubjectAccess = verifyTeacherClassSubjectAccess;
