"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStreams = exports.getSections = exports.getGrades = exports.getAllSchools = exports.getSchoolByCustomId = exports.getSchoolById = exports.updateSchool = exports.createSchool = void 0;
const db_1 = __importDefault(require("../config/db"));
const school_id_1 = require("../utils/school-id");
const createSchool = async (data) => {
    const customId = await (0, school_id_1.generateSchoolId)();
    const school = await db_1.default.school.create({
        data: {
            id: data.id,
            name: data.name,
            schoolId: customId,
            settings: {
                create: {
                    school_name: data.name,
                    attendance_mode: 'session_based',
                    attendance_ui_type: 'card_based'
                }
            }
        },
        include: {
            settings: true
        }
    });
    return school;
};
exports.createSchool = createSchool;
const updateSchool = async (id, data) => {
    const school = await db_1.default.school.update({
        where: { id },
        data: {
            name: data.name,
        },
        include: {
            settings: true
        }
    });
    // Also update school_name in settings for consistency
    if (data.name) {
        await db_1.default.schoolSettings.update({
            where: { schoolId: id },
            data: { school_name: data.name }
        });
    }
    return school;
};
exports.updateSchool = updateSchool;
const getSchoolById = async (id) => {
    return await db_1.default.school.findUnique({
        where: { id },
        include: {
            settings: true,
        },
    });
};
exports.getSchoolById = getSchoolById;
const getSchoolByCustomId = async (schoolId) => {
    return await db_1.default.school.findFirst({
        where: { schoolId },
        include: {
            settings: true,
        }
    });
};
exports.getSchoolByCustomId = getSchoolByCustomId;
const getAllSchools = async () => {
    return await db_1.default.school.findMany({
        orderBy: { createdAt: 'desc' },
    });
};
exports.getAllSchools = getAllSchools;
const getGrades = async (schoolId) => {
    return await db_1.default.grade.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' }
    });
};
exports.getGrades = getGrades;
const getSections = async (schoolId) => {
    return await db_1.default.section.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' }
    });
};
exports.getSections = getSections;
const getStreams = async (schoolId) => {
    return await db_1.default.stream.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' }
    });
};
exports.getStreams = getStreams;
