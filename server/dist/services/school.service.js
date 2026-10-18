"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkRemoveGradeSubjects = exports.deleteGradeSubject = exports.assignSubjectsToGrade = exports.getGradeSubjects = exports.deleteSubject = exports.updateSubject = exports.createSubject = exports.getSubjects = exports.deleteStream = exports.updateStream = exports.createStream = exports.getStreams = exports.deleteSection = exports.updateSection = exports.createSection = exports.getTeachers = exports.getSections = exports.deleteGrade = exports.updateGrade = exports.createGrade = exports.getGrades = exports.updateSchool = exports.createSchool = exports.getAllSchools = exports.getSchoolByCustomId = exports.getSchoolById = exports.getSingleSchool = void 0;
const db_1 = __importDefault(require("../config/db"));
const settingsService = __importStar(require("./settings.service"));
const getSingleSchool = async () => {
    const settings = await settingsService.getSettings();
    return {
        id: 'single-school',
        name: settings.school_name || 'Bright Path',
        schoolId: 'SCH-0001',
        settings,
    };
};
exports.getSingleSchool = getSingleSchool;
const getSchoolById = async (_id) => {
    return await (0, exports.getSingleSchool)();
};
exports.getSchoolById = getSchoolById;
const getSchoolByCustomId = async (_schoolId) => {
    return await (0, exports.getSingleSchool)();
};
exports.getSchoolByCustomId = getSchoolByCustomId;
const getAllSchools = async () => {
    return [await (0, exports.getSingleSchool)()];
};
exports.getAllSchools = getAllSchools;
const createSchool = async (data) => {
    const settings = await settingsService.updateSettings(undefined, { school_name: data.name });
    return {
        id: 'single-school',
        name: settings.school_name || data.name,
        schoolId: 'SCH-0001',
        settings,
    };
};
exports.createSchool = createSchool;
const updateSchool = async (_id, data) => {
    if (data.name) {
        await settingsService.updateSettings(undefined, { school_name: data.name });
    }
    return await (0, exports.getSingleSchool)();
};
exports.updateSchool = updateSchool;
// ─── Grades ─────────────────────────────────────────────────────────────────
const getGrades = async () => {
    return await db_1.default.grade.findMany({
        orderBy: { name: 'asc' },
    });
};
exports.getGrades = getGrades;
const createGrade = async (data) => {
    const trimmedName = data.name?.trim();
    if (!trimmedName)
        throw new Error('Grade name is required');
    const existing = await db_1.default.grade.findUnique({ where: { name: trimmedName } });
    if (existing)
        throw new Error(`Grade "${trimmedName}" already exists`);
    return await db_1.default.grade.create({
        data: {
            name: trimmedName,
        },
    });
};
exports.createGrade = createGrade;
const updateGrade = async (id, data) => {
    const existing = await db_1.default.grade.findUnique({ where: { id } });
    if (!existing)
        throw new Error('Grade not found');
    return await db_1.default.grade.update({
        where: { id },
        data: {
            ...(data.name ? { name: data.name.trim() } : {}),
        },
    });
};
exports.updateGrade = updateGrade;
const deleteGrade = async (id) => {
    const studentCount = await db_1.default.student.count({ where: { gradeId: id } });
    if (studentCount > 0) {
        throw new Error(`Cannot delete grade: ${studentCount} active students are currently enrolled in it.`);
    }
    return await db_1.default.grade.delete({ where: { id } });
};
exports.deleteGrade = deleteGrade;
// ─── Sections ───────────────────────────────────────────────────────────────
const getSections = async (gradeId, streamId) => {
    try {
        const where = {};
        if (gradeId && gradeId !== 'ALL' && gradeId !== 'all') {
            where.gradeId = gradeId;
        }
        if (streamId && streamId !== 'ALL' && streamId !== 'all') {
            if (streamId === 'NONE' || streamId === 'none') {
                where.streamId = null;
            }
            else {
                where.streamId = streamId;
            }
        }
        return await db_1.default.section.findMany({
            where,
            include: {
                grade: { select: { id: true, name: true } },
                stream: { select: { id: true, name: true } },
                _count: {
                    select: {
                        students: true,
                        assignments: true,
                        timetables: true,
                    },
                },
            },
            orderBy: [{ grade: { name: 'asc' } }, { name: 'asc' }],
        });
    }
    catch (err) {
        console.warn('[getSections] Failed to fetch sections with filters:', err);
        return await db_1.default.section.findMany({
            include: {
                grade: { select: { id: true, name: true } },
                stream: { select: { id: true, name: true } },
            },
            orderBy: { name: 'asc' },
        });
    }
};
exports.getSections = getSections;
// ─── Teachers ───────────────────────────────────────────────────────────────
const getTeachers = async () => {
    return await db_1.default.teacher.findMany({
        orderBy: { name: 'asc' },
    });
};
exports.getTeachers = getTeachers;
const createSection = async (data) => {
    const trimmedName = data.name?.trim();
    if (!trimmedName)
        throw new Error('Section name is required');
    if (!data.gradeId)
        throw new Error('Grade Level is mandatory to create a section');
    const grade = await db_1.default.grade.findUnique({ where: { id: data.gradeId } });
    if (!grade)
        throw new Error('Selected grade not found');
    const gradeName = (grade.name || '').toLowerCase();
    const isSeniorSecondary = gradeName.includes('11') || gradeName.includes('12');
    let streamId = null;
    if (isSeniorSecondary) {
        if (!data.streamId) {
            throw new Error(`Academic Stream (Natural Science or Social Science) is mandatory for ${grade.name}`);
        }
        const stream = await db_1.default.stream.findUnique({ where: { id: data.streamId } });
        if (!stream)
            throw new Error('Selected stream not found');
        streamId = stream.id;
    }
    else {
        streamId = null;
    }
    // Check duplicate section name within this grade and stream
    const existing = await db_1.default.section.findFirst({
        where: {
            gradeId: data.gradeId,
            streamId: streamId,
            name: { equals: trimmedName, mode: 'insensitive' },
        },
    });
    if (existing) {
        throw new Error(`Section "${trimmedName}" already exists for this grade${streamId ? ' and stream' : ''}`);
    }
    return await db_1.default.section.create({
        data: {
            name: trimmedName,
            gradeId: data.gradeId,
            streamId,
        },
        include: {
            grade: true,
            stream: true,
        },
    });
};
exports.createSection = createSection;
const updateSection = async (id, data) => {
    const existing = await db_1.default.section.findUnique({ where: { id } });
    if (!existing)
        throw new Error('Section not found');
    const targetGradeId = data.gradeId || existing.gradeId;
    const grade = await db_1.default.grade.findUnique({ where: { id: targetGradeId } });
    if (!grade)
        throw new Error('Target grade not found');
    const gradeName = (grade.name || '').toLowerCase();
    const isSeniorSecondary = gradeName.includes('11') || gradeName.includes('12');
    let targetStreamId = existing.streamId;
    if (isSeniorSecondary) {
        const candidateStreamId = data.streamId !== undefined ? data.streamId : existing.streamId;
        if (!candidateStreamId) {
            throw new Error(`Academic Stream is required for ${grade.name}`);
        }
        targetStreamId = candidateStreamId;
    }
    else {
        targetStreamId = null;
    }
    const targetName = (data.name ? data.name.trim() : existing.name);
    // Check duplicate
    const duplicate = await db_1.default.section.findFirst({
        where: {
            id: { not: id },
            gradeId: targetGradeId,
            streamId: targetStreamId,
            name: { equals: targetName, mode: 'insensitive' },
        },
    });
    if (duplicate) {
        throw new Error(`Section "${targetName}" already exists for this grade and stream`);
    }
    return await db_1.default.section.update({
        where: { id },
        data: {
            name: targetName,
            gradeId: targetGradeId,
            streamId: targetStreamId,
        },
        include: {
            grade: true,
            stream: true,
        },
    });
};
exports.updateSection = updateSection;
const deleteSection = async (id) => {
    const [studentCount, assignmentCount, timetableCount, assessmentCount] = await Promise.all([
        db_1.default.student.count({ where: { sectionId: id } }),
        db_1.default.teacherAssignment.count({ where: { sectionId: id } }),
        db_1.default.timetable.count({ where: { sectionId: id } }),
        db_1.default.assessment.count({ where: { sectionId: id } }),
    ]);
    if (studentCount > 0) {
        throw new Error(`Cannot delete section: ${studentCount} active students are currently enrolled in it.`);
    }
    if (assignmentCount > 0) {
        throw new Error(`Cannot delete section: ${assignmentCount} teacher assignments are currently attached to it.`);
    }
    if (timetableCount > 0) {
        throw new Error(`Cannot delete section: ${timetableCount} timetables are currently assigned to it.`);
    }
    if (assessmentCount > 0) {
        throw new Error(`Cannot delete section: ${assessmentCount} assessments are currently recorded for it.`);
    }
    return await db_1.default.section.delete({ where: { id } });
};
exports.deleteSection = deleteSection;
// ─── Streams ────────────────────────────────────────────────────────────────
const getStreams = async () => {
    return await db_1.default.stream.findMany({
        orderBy: { name: 'asc' },
    });
};
exports.getStreams = getStreams;
const createStream = async (data) => {
    const trimmedName = data.name?.trim();
    if (!trimmedName)
        throw new Error('Stream name is required');
    const existing = await db_1.default.stream.findUnique({ where: { name: trimmedName } });
    if (existing)
        throw new Error(`Stream "${trimmedName}" already exists`);
    return await db_1.default.stream.create({
        data: { name: trimmedName },
    });
};
exports.createStream = createStream;
const updateStream = async (id, data) => {
    const existing = await db_1.default.stream.findUnique({ where: { id } });
    if (!existing)
        throw new Error('Stream not found');
    return await db_1.default.stream.update({
        where: { id },
        data: {
            ...(data.name ? { name: data.name.trim() } : {}),
        },
    });
};
exports.updateStream = updateStream;
const deleteStream = async (id) => {
    return await db_1.default.stream.delete({ where: { id } });
};
exports.deleteStream = deleteStream;
// ─── Subjects ───────────────────────────────────────────────────────────────
const getSubjects = async () => {
    return await db_1.default.subject.findMany({
        orderBy: { name: 'asc' },
    });
};
exports.getSubjects = getSubjects;
const createSubject = async (data) => {
    const trimmedName = data.name?.trim();
    const trimmedCode = data.code?.trim().toUpperCase();
    if (!trimmedName)
        throw new Error('Subject name is required');
    if (!trimmedCode)
        throw new Error('Subject code is required');
    const existingCode = await db_1.default.subject.findUnique({ where: { code: trimmedCode } });
    if (existingCode)
        throw new Error(`Subject with code "${trimmedCode}" already exists`);
    return await db_1.default.subject.create({
        data: {
            name: trimmedName,
            code: trimmedCode,
            department: data.department?.trim() || null,
            color: data.color || '#3b82f6',
            description: data.description?.trim() || null,
            isActive: data.isActive !== undefined ? data.isActive : true,
        },
    });
};
exports.createSubject = createSubject;
const updateSubject = async (id, data) => {
    const existing = await db_1.default.subject.findUnique({ where: { id } });
    if (!existing)
        throw new Error('Subject not found');
    if (data.code && data.code.trim().toUpperCase() !== existing.code) {
        const codeTaken = await db_1.default.subject.findUnique({ where: { code: data.code.trim().toUpperCase() } });
        if (codeTaken)
            throw new Error(`Subject with code "${data.code}" already exists`);
    }
    return await db_1.default.subject.update({
        where: { id },
        data: {
            ...(data.name ? { name: data.name.trim() } : {}),
            ...(data.code ? { code: data.code.trim().toUpperCase() } : {}),
            ...(data.department !== undefined ? { department: data.department?.trim() || null } : {}),
            ...(data.color ? { color: data.color } : {}),
            ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
    });
};
exports.updateSubject = updateSubject;
const deleteSubject = async (id) => {
    const assignmentCount = await db_1.default.teacherAssignment.count({ where: { subjectId: id } });
    if (assignmentCount > 0) {
        throw new Error(`Cannot delete subject: ${assignmentCount} teacher assignments are currently linked to it.`);
    }
    return await db_1.default.subject.delete({ where: { id } });
};
exports.deleteSubject = deleteSubject;
// ─── Grade Subjects (Curriculum Allocation) ──────────────────────────────────
const getGradeSubjects = async (filter) => {
    const where = {};
    if (filter?.gradeId)
        where.gradeId = filter.gradeId;
    if (filter?.streamId !== undefined) {
        where.streamId = filter.streamId ? filter.streamId : null;
    }
    if (filter?.sectionId !== undefined) {
        where.sectionId = filter.sectionId ? filter.sectionId : null;
    }
    return await db_1.default.gradeSubject.findMany({
        where,
        orderBy: [
            { grade: { name: 'asc' } },
            { subject: { name: 'asc' } },
        ],
        include: {
            grade: true,
            stream: true,
            section: true,
            subject: true,
        },
    });
};
exports.getGradeSubjects = getGradeSubjects;
const assignSubjectsToGrade = async (data) => {
    if (!data.gradeId)
        throw new Error('Grade is required');
    if (!data.subjectIds || !Array.isArray(data.subjectIds) || data.subjectIds.length === 0) {
        throw new Error('At least one subject must be selected');
    }
    const grade = await db_1.default.grade.findUnique({ where: { id: data.gradeId } });
    if (!grade)
        throw new Error('Grade not found');
    const isGrade11or12 = /\b(11|12)\b/.test(grade.name);
    if (isGrade11or12 && !data.streamId) {
        throw new Error('Stream selection (Natural Science or Social Science) is required for Grades 11 and 12');
    }
    const streamId = isGrade11or12 ? data.streamId : (data.streamId || null);
    const sectionId = data.sectionId || null;
    if (streamId) {
        const stream = await db_1.default.stream.findUnique({ where: { id: streamId } });
        if (!stream)
            throw new Error('Stream not found');
    }
    const results = [];
    for (const subjectId of data.subjectIds) {
        const subject = await db_1.default.subject.findUnique({ where: { id: subjectId } });
        if (!subject)
            continue;
        // Check if already assigned to prevent duplicates
        const existing = await db_1.default.gradeSubject.findFirst({
            where: {
                gradeId: data.gradeId,
                streamId: streamId,
                sectionId: sectionId,
                subjectId: subjectId,
            },
        });
        if (!existing) {
            const created = await db_1.default.gradeSubject.create({
                data: {
                    gradeId: data.gradeId,
                    streamId: streamId,
                    sectionId: sectionId,
                    subjectId: subjectId,
                },
                include: {
                    grade: true,
                    stream: true,
                    section: true,
                    subject: true,
                },
            });
            results.push(created);
        }
        else {
            results.push(existing);
        }
    }
    return results;
};
exports.assignSubjectsToGrade = assignSubjectsToGrade;
const deleteGradeSubject = async (id) => {
    const existing = await db_1.default.gradeSubject.findUnique({ where: { id } });
    if (!existing)
        throw new Error('Grade subject assignment not found');
    return await db_1.default.gradeSubject.delete({ where: { id } });
};
exports.deleteGradeSubject = deleteGradeSubject;
const bulkRemoveGradeSubjects = async (data) => {
    return await db_1.default.gradeSubject.deleteMany({
        where: {
            gradeId: data.gradeId,
            streamId: data.streamId || null,
            sectionId: data.sectionId || null,
            subjectId: { in: data.subjectIds },
        },
    });
};
exports.bulkRemoveGradeSubjects = bulkRemoveGradeSubjects;
