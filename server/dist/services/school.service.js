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
exports.getStreams = exports.getSections = exports.getGrades = exports.updateSchool = exports.createSchool = exports.getAllSchools = exports.getSchoolByCustomId = exports.getSchoolById = exports.getSingleSchool = void 0;
const db_1 = __importDefault(require("../config/db"));
const settingsService = __importStar(require("./settings.service"));
const getSingleSchool = async () => {
    const settings = await settingsService.getSettings();
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
