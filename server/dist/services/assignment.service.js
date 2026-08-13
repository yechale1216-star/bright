"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAssignment = exports.deleteAssignment = exports.createAssignment = exports.getAssignments = void 0;
const db_1 = __importDefault(require("../config/db"));
const getAssignments = async (schoolId, teacherId) => {
    if (!schoolId)
        throw new Error('School ID is required');
    const where = { schoolId };
    if (teacherId) {
        let resolvedTeacherId = teacherId;
        const user = await db_1.default.user.findFirst({
            where: { id: teacherId, schoolId }
        });
        if (user && user.teacher_id) {
            resolvedTeacherId = user.teacher_id;
        }
        where.teacher_id = resolvedTeacherId;
    }
    return await db_1.default.teacherAssignment.findMany({
        where,
        include: {
            teacher: true,
            grade: true,
            section: true,
            stream: true
        },
    });
};
exports.getAssignments = getAssignments;
const createAssignment = async (data, schoolId) => {
    if (!schoolId)
        throw new Error('School ID is required');
    let teacherId = data.teacher_id;
    // Resolve User.id -> Teacher.id if a User ID was passed
    const user = await db_1.default.user.findFirst({
        where: { id: teacherId, schoolId }
    });
    if (user) {
        if (user.teacher_id) {
            teacherId = user.teacher_id;
        }
        else if (user.role === 'teacher') {
            // Lazy-create missing Teacher record for this user
            const newTeacher = await db_1.default.teacher.create({
                data: {
                    name: user.full_name,
                    email: user.email,
                    schoolId: schoolId,
                    user_id: user.id,
                    phone: user.phone || null,
                    profile_photo: user.profile_photo || null,
                }
            });
            await db_1.default.user.update({
                where: { id: user.id },
                data: { teacher_id: newTeacher.id }
            });
            teacherId = newTeacher.id;
        }
    }
    // VALIDATION: Ensure Teacher, Grade, Section, and Stream belong to this school
    const teacher = await db_1.default.teacher.findFirst({
        where: { id: teacherId, schoolId }
    });
    if (!teacher) {
        throw new Error("Teacher does not exist in this school context.");
    }
    const grade = await db_1.default.grade.findFirst({
        where: { id: data.gradeId, schoolId }
    });
    if (!grade) {
        throw new Error("Grade does not exist in this school context.");
    }
    const section = await db_1.default.section.findFirst({
        where: { id: data.sectionId, schoolId }
    });
    if (!section) {
        throw new Error("Section does not exist in this school context.");
    }
    if (data.streamId) {
        const stream = await db_1.default.stream.findFirst({
            where: { id: data.streamId, schoolId }
        });
        if (!stream) {
            throw new Error("Stream does not exist in this school context.");
        }
    }
    // HOMEROOM RULE: Check if this class/section already has ANY active homeroom teacher.
    // One class = max one homeroom teacher. The same teacher MAY manage multiple classes.
    const existingClassAssignment = await db_1.default.teacherAssignment.findFirst({
        where: {
            schoolId,
            gradeId: data.gradeId,
            sectionId: data.sectionId,
            streamId: data.streamId || null,
        },
        include: { teacher: true }
    });
    if (existingClassAssignment) {
        const teacherName = existingClassAssignment.teacher?.name || 'another teacher';
        throw new Error(`This class already has a homeroom teacher assigned (${teacherName}). Remove or edit the existing assignment first.`);
    }
    return await db_1.default.teacherAssignment.create({
        data: {
            teacher_id: teacherId,
            schoolId: schoolId,
            gradeId: data.gradeId,
            sectionId: data.sectionId,
            subject: data.subject || null,
            streamId: data.streamId || null,
        },
        include: { teacher: true, grade: true, section: true, stream: true },
    });
};
exports.createAssignment = createAssignment;
const deleteAssignment = async (id, schoolId) => {
    return await db_1.default.teacherAssignment.delete({
        where: { id, schoolId }
    });
};
exports.deleteAssignment = deleteAssignment;
const updateAssignment = async (id, data, schoolId) => {
    let teacherId = data.teacher_id;
    // Resolve User.id -> Teacher.id if a User ID was passed
    const user = await db_1.default.user.findFirst({
        where: { id: teacherId, schoolId }
    });
    if (user && user.teacher_id) {
        teacherId = user.teacher_id;
    }
    // VALIDATION: Ensure Teacher, Grade, Section, and Stream belong to this school
    const teacher = await db_1.default.teacher.findFirst({
        where: { id: teacherId, schoolId }
    });
    if (!teacher) {
        throw new Error("Teacher does not exist in this school context.");
    }
    const grade = await db_1.default.grade.findFirst({
        where: { id: data.gradeId, schoolId }
    });
    if (!grade) {
        throw new Error("Grade does not exist in this school context.");
    }
    const section = await db_1.default.section.findFirst({
        where: { id: data.sectionId, schoolId }
    });
    if (!section) {
        throw new Error("Section does not exist in this school context.");
    }
    if (data.streamId) {
        const stream = await db_1.default.stream.findFirst({
            where: { id: data.streamId, schoolId }
        });
        if (!stream) {
            throw new Error("Stream does not exist in this school context.");
        }
    }
    // HOMEROOM RULE: Check if the target class already has a DIFFERENT active homeroom teacher.
    // Excludes the current assignment being edited so editing the same class is allowed.
    const conflictingAssignment = await db_1.default.teacherAssignment.findFirst({
        where: {
            id: { not: id },
            schoolId,
            gradeId: data.gradeId,
            sectionId: data.sectionId,
            streamId: data.streamId || null,
        },
        include: { teacher: true }
    });
    if (conflictingAssignment) {
        const teacherName = conflictingAssignment.teacher?.name || 'another teacher';
        throw new Error(`This class already has an active homeroom teacher (${teacherName}). Remove or edit the existing assignment first.`);
    }
    return await db_1.default.teacherAssignment.update({
        where: { id, schoolId },
        data: {
            teacher_id: teacherId,
            gradeId: data.gradeId,
            sectionId: data.sectionId,
            streamId: data.streamId || null,
            subject: data.subject || null,
        },
        include: { teacher: true, grade: true, section: true, stream: true },
    });
};
exports.updateAssignment = updateAssignment;
