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
exports.deleteSubject = exports.updateSubject = exports.createSubject = exports.getSubjects = exports.deleteStream = exports.updateStream = exports.createStream = exports.getStreams = exports.deleteSection = exports.updateSection = exports.createSection = exports.getSections = exports.deleteGrade = exports.updateGrade = exports.createGrade = exports.getGrades = exports.updateSchool = exports.createSchool = exports.getAllSchools = exports.getSchoolByCustomId = exports.getSchoolById = exports.getSingleSchool = void 0;
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
const getSections = async (gradeId) => {
    return await db_1.default.section.findMany({
        where: gradeId ? { gradeId } : undefined,
        orderBy: { name: 'asc' },
    });
};
exports.getSections = getSections;
const createSection = async (data) => {
    const trimmedName = data.name?.trim();
    if (!trimmedName)
        throw new Error('Section name is required');
    const existing = await db_1.default.section.findUnique({ where: { name: trimmedName } });
    if (existing)
        throw new Error(`Section "${trimmedName}" already exists`);
    return await db_1.default.section.create({
        data: { name: trimmedName },
    });
};
exports.createSection = createSection;
const updateSection = async (id, data) => {
    const existing = await db_1.default.section.findUnique({ where: { id } });
    if (!existing)
        throw new Error('Section not found');
    return await db_1.default.section.update({
        where: { id },
        data: {
            ...(data.name ? { name: data.name.trim() } : {}),
        },
    });
};
exports.updateSection = updateSection;
const deleteSection = async (id) => {
    const studentCount = await db_1.default.student.count({ where: { sectionId: id } });
    if (studentCount > 0) {
        throw new Error(`Cannot delete section: ${studentCount} active students are currently assigned to it.`);
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
