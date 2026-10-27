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
exports.reEnrollStudent = exports.getStudentStatusHistory = exports.changeStudentStatus = exports.bulkGenerateActivationCodes = exports.generateActivationCode = exports.bulkCreateStudents = exports.getStudentsByParentPhone = exports.deleteStudent = exports.updateStudent = exports.getStudentById = exports.createStudent = exports.getNextStudentId = exports.getStudents = void 0;
const studentService = __importStar(require("../services/student.service"));
const AUTHORIZED_STAFF_ROLES = ['admin', 'school_admin', 'super_admin', 'registrar'];
const sanitizeStudentForRole = (student, role) => {
    if (!student)
        return null;
    const isAuthorized = AUTHORIZED_STAFF_ROLES.includes(role || '');
    const canSeeActivation = isAuthorized && student.accountStatus === 'PENDING_ACTIVATION';
    const isPlaintextLegacy = student.activation_code && !student.activation_code.startsWith('$2') && student.activation_code.length <= 10;
    return {
        ...student,
        // Never expose cryptographic hashes or passwords over API
        activation_code: canSeeActivation && isPlaintextLegacy ? student.activation_code : null,
        has_activation_code: canSeeActivation ? Boolean(student.activation_code) : false,
        activation_code_expires: canSeeActivation ? student.activation_code_expires : null,
    };
};
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
        const userRole = req.user?.role;
        let sanitizedData;
        if (Array.isArray(students)) {
            sanitizedData = students.map((s) => sanitizeStudentForRole(s, userRole));
        }
        else if (students && Array.isArray(students.items)) {
            sanitizedData = {
                ...students,
                items: students.items.map((s) => sanitizeStudentForRole(s, userRole)),
            };
        }
        else {
            sanitizedData = sanitizeStudentForRole(students, userRole);
        }
        res.status(200).json({ success: true, data: sanitizedData });
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
        const userRole = req.user?.role;
        res.status(200).json({ success: true, data: sanitizeStudentForRole(student, userRole) });
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
// ─── ACTIVATION CODE MANAGEMENT ───────────────────────────────────────────────
const generateActivationCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const slip = await studentService.generateActivationCode(id);
        res.status(200).json({ success: true, data: slip });
    }
    catch (error) {
        next(error);
    }
};
exports.generateActivationCode = generateActivationCode;
const bulkGenerateActivationCodes = async (req, res, next) => {
    try {
        const { gradeId, sectionId } = req.body;
        const slips = await studentService.bulkGenerateActivationCodes(gradeId, sectionId);
        res.status(200).json({ success: true, data: slips });
    }
    catch (error) {
        next(error);
    }
};
exports.bulkGenerateActivationCodes = bulkGenerateActivationCodes;
// ─── LIFECYCLE & STATUS MANAGEMENT ──────────────────────────────────────────
const changeStudentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newStatus, effectiveDate, reason, suspensionEndDate, destinationSchool } = req.body;
        const changedByUserId = req.user?.id;
        if (!changedByUserId) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        if (!newStatus || !effectiveDate || !reason) {
            return res.status(400).json({ success: false, message: 'newStatus, effectiveDate, and reason are required.' });
        }
        const { changeStudentStatus: svc } = await Promise.resolve().then(() => __importStar(require('../services/student-status.service')));
        const result = await svc(id, {
            newStatus,
            effectiveDate,
            reason,
            suspensionEndDate,
            destinationSchool,
            changedByUserId,
        });
        res.status(200).json({
            success: true,
            data: result,
            message: `Student status successfully changed to ${newStatus}.`,
        });
    }
    catch (error) {
        if (error.message?.includes('Invalid status transition') ||
            error.message?.includes('required') ||
            error.message?.includes('permanent') ||
            error.message?.includes('already in')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};
exports.changeStudentStatus = changeStudentStatus;
const getStudentStatusHistory = async (req, res, next) => {
    try {
        const { getStudentStatusHistory: svc } = await Promise.resolve().then(() => __importStar(require('../services/student-status.service')));
        const history = await svc(req.params.id);
        res.status(200).json({ success: true, data: history });
    }
    catch (error) {
        next(error);
    }
};
exports.getStudentStatusHistory = getStudentStatusHistory;
const reEnrollStudent = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { academicYearId, gradeId, sectionId, streamId } = req.body;
        const enrolledByUserId = req.user?.id;
        if (!enrolledByUserId) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        if (!academicYearId || !gradeId || !sectionId) {
            return res.status(400).json({ success: false, message: 'academicYearId, gradeId, and sectionId are required.' });
        }
        const { reEnrollStudent: svc } = await Promise.resolve().then(() => __importStar(require('../services/student-status.service')));
        const enrollment = await svc(id, academicYearId, gradeId, sectionId, streamId || null, enrolledByUserId);
        res.status(200).json({ success: true, data: enrollment, message: 'Student successfully re-enrolled.' });
    }
    catch (error) {
        if (error.message?.includes('Cannot re-enroll') || error.message?.includes('already has') || error.message?.includes('required')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};
exports.reEnrollStudent = reEnrollStudent;
