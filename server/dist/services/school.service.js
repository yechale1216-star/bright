"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStreams = exports.getSections = exports.getGrades = exports.updateSchool = exports.createSchool = exports.getAllSchools = exports.getSchoolByCustomId = exports.getSchoolById = exports.getSingleSchool = void 0;
const db_1 = __importDefault(require("../config/db"));
const getSingleSchool = async () => {
    let settings = await db_1.default.schoolSettings.findFirst();
    if (!settings) {
        settings = await db_1.default.schoolSettings.create({
            data: {
                id: 'singleton',
                school_name: 'Addis Hiwot School',
                attendance_mode: 'session_based',
                attendance_ui_type: 'card_based',
            },
        });
    }
    return {
        id: 'single-school',
        name: settings.school_name || 'Addis Hiwot School',
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
    const settings = await db_1.default.schoolSettings.upsert({
        where: { id: 'singleton' },
        update: { school_name: data.name },
        create: {
            id: 'singleton',
            school_name: data.name,
            attendance_mode: 'session_based',
            attendance_ui_type: 'card_based',
        },
    });
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
        await db_1.default.schoolSettings.upsert({
            where: { id: 'singleton' },
            update: { school_name: data.name },
            create: { id: 'singleton', school_name: data.name },
        });
    }
    return await (0, exports.getSingleSchool)();
};
exports.updateSchool = updateSchool;
const getGrades = async () => {
    return await db_1.default.grade.findMany({
        orderBy: { name: 'asc' },
    });
};
exports.getGrades = getGrades;
const getSections = async () => {
    return await db_1.default.section.findMany({
        orderBy: { name: 'asc' },
    });
};
exports.getSections = getSections;
const getStreams = async () => {
    return await db_1.default.stream.findMany({
        orderBy: { name: 'asc' },
    });
};
exports.getStreams = getStreams;
