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
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkCreateStudents = exports.getStudentsByParentPhone = exports.deleteStudent = exports.updateStudent = exports.getStudentById = exports.createStudent = exports.getNextStudentId = exports.getStudents = void 0;
const studentService = __importStar(require("../services/student.service"));
const getStudents = async (req, res, next) => {
    try {
        const search = req.query.search;
        const status = req.query.status;
        const gradeId = req.query.gradeId;
        const sectionId = req.query.sectionId;
        const streamId = req.query.streamId;
        const academicYear = req.query.academicYear;
        const page = req.query.page ? Number(req.query.page) : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const pagination = (page !== undefined || limit !== undefined)
            ? { page, limit }
            : undefined;
        const students = await studentService.getAllStudents(undefined, search, status, gradeId, sectionId, streamId, academicYear, pagination);
        res.status(200).json({ success: true, data: students });
    }
    catch (error) {
        next(error);
    }
};
exports.getStudents = getStudents;
const getNextStudentId = async (_req, res, next) => {
    try {
        const nextId = await studentService.getNextStudentId();
        res.status(200).json({ success: true, data: nextId });
    }
    catch (error) {
        next(error);
    }
};
exports.getNextStudentId = getNextStudentId;
const createStudent = async (req, res, next) => {
    try {
        const student = await studentService.createStudent(req.body);
        res.status(201).json({ success: true, data: student });
    }
    catch (error) {
        next(error);
    }
};
exports.createStudent = createStudent;
const getStudentById = async (req, res, next) => {
    try {
        const student = await studentService.getStudentById(req.params.id);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        res.status(200).json({ success: true, data: student });
    }
    catch (error) {
        next(error);
    }
};
exports.getStudentById = getStudentById;
const updateStudent = async (req, res, next) => {
    try {
        const student = await studentService.updateStudent(req.params.id, req.body);
        res.status(200).json({ success: true, data: student });
    }
    catch (error) {
        next(error);
    }
};
exports.updateStudent = updateStudent;
const deleteStudent = async (req, res, next) => {
    try {
        await studentService.deleteStudent(req.params.id);
        res.status(200).json({ success: true, message: 'Student deleted successfully' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteStudent = deleteStudent;
const getStudentsByParentPhone = async (req, res, next) => {
    try {
        const students = await studentService.getStudentsByParentPhone(req.params.phone);
        res.status(200).json({ success: true, data: students });
    }
    catch (error) {
        next(error);
    }
};
exports.getStudentsByParentPhone = getStudentsByParentPhone;
const bulkCreateStudents = async (req, res, next) => {
    try {
        const { students } = req.body;
        if (!Array.isArray(students)) {
            return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of students.' });
        }
        const results = await studentService.bulkUpsertStudents(students);
        res.status(200).json({ success: true, data: results });
    }
    catch (error) {
        next(error);
    }
};
exports.bulkCreateStudents = bulkCreateStudents;
