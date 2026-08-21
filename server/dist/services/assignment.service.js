"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAssignment = exports.deleteAssignment = exports.createAssignment = exports.getAssignments = void 0;
const db_1 = __importDefault(require("../config/db"));
const getAssignments = async (_schoolId, teacherId) => {
    const where = {};
    if (teacherId) {
        let resolvedTeacherId = teacherId;
        const user = await db_1.default.user.findUnique({
            where: { id: teacherId }
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
const createAssignment = async (data, _schoolId) => {
    let teacherId = data.teacher_id;
    const user = await db_1.default.user.findUnique({
        where: { id: teacherId }
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
                }
            });
            await db_1.default.user.update({
                where: { id: user.id },
                data: { teacher_id: newTeacher.id }
            });
            teacherId = newTeacher.id;
        }
    }
    const teacher = await db_1.default.teacher.findUnique({
        where: { id: teacherId }
    });
    if (!teacher) {
        throw new Error("Teacher does not exist.");
    }
    const grade = await db_1.default.grade.findUnique({
        where: { id: data.gradeId }
    });
    if (!grade) {
        throw new Error("Grade does not exist.");
    }
    const section = await db_1.default.section.findUnique({
        where: { id: data.sectionId }
    });
    if (!section) {
        throw new Error("Section does not exist.");
    }
    if (data.streamId) {
        const stream = await db_1.default.stream.findUnique({
            where: { id: data.streamId }
        });
        if (!stream) {
            throw new Error("Stream does not exist.");
        }
    }
    const existingClassAssignment = await db_1.default.teacherAssignment.findFirst({
        where: {
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
            gradeId: data.gradeId,
            sectionId: data.sectionId,
            subject: data.subject || null,
            streamId: data.streamId || null,
        },
        include: { teacher: true, grade: true, section: true, stream: true },
    });
};
exports.createAssignment = createAssignment;
const deleteAssignment = async (id, _schoolId) => {
    return await db_1.default.teacherAssignment.delete({
        where: { id }
    });
};
exports.deleteAssignment = deleteAssignment;
const updateAssignment = async (id, data, _schoolId) => {
    let teacherId = data.teacher_id;
    const user = await db_1.default.user.findUnique({
        where: { id: teacherId }
    });
    if (user && user.teacher_id) {
        teacherId = user.teacher_id;
    }
    const teacher = await db_1.default.teacher.findUnique({
        where: { id: teacherId }
    });
    if (!teacher) {
        throw new Error("Teacher does not exist.");
    }
    const grade = await db_1.default.grade.findUnique({
        where: { id: data.gradeId }
    });
    if (!grade) {
        throw new Error("Grade does not exist.");
    }
    const section = await db_1.default.section.findUnique({
        where: { id: data.sectionId }
    });
    if (!section) {
        throw new Error("Section does not exist.");
    }
    if (data.streamId) {
        const stream = await db_1.default.stream.findUnique({
            where: { id: data.streamId }
        });
        if (!stream) {
            throw new Error("Stream does not exist.");
        }
    }
    const conflictingAssignment = await db_1.default.teacherAssignment.findFirst({
        where: {
            id: { not: id },
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
        where: { id },
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
