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
exports.getAuditLogs = exports.rejectEditRequest = exports.approveEditRequest = exports.getEditRequests = exports.createEditRequest = exports.bulkMarkAttendance = exports.getAttendanceByStudent = exports.getAttendance = exports.markAttendance = void 0;
const attendanceService = __importStar(require("../services/attendance.service"));
const markAttendance = async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, message: 'School ID context missing' });
        }
        const payload = {
            ...req.body,
            userRole: req.user?.role,
            userId: req.user?.id,
            teacherId: req.body.teacherId || req.user?.teacherId || req.user?.id,
        };
        const result = await attendanceService.markAttendance(payload, schoolId);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.markAttendance = markAttendance;
const getAttendance = async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, message: 'School ID context missing' });
        }
        const filters = {
            ...req.query,
            schoolId
        };
        const result = await attendanceService.getAttendance(filters, schoolId);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getAttendance = getAttendance;
const getAttendanceByStudent = async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, message: 'School ID context missing' });
        }
        const result = await attendanceService.getAttendanceByStudent(req.params.studentId, schoolId, req.query);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getAttendanceByStudent = getAttendanceByStudent;
const bulkMarkAttendance = async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, message: 'School ID context missing' });
        }
        const { records, latitude, longitude, locationVerified, locationDistance } = req.body;
        if (!Array.isArray(records)) {
            return res.status(400).json({ success: false, message: 'Records must be an array' });
        }
        const results = await attendanceService.bulkMarkAttendance(records, schoolId, {
            userRole: req.user?.role,
            userId: req.user?.id,
            teacherId: req.user?.teacherId || req.user?.id,
            latitude,
            longitude,
            locationVerified,
            locationDistance,
        });
        res.status(200).json({ success: true, data: results });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Failed to mark attendance' });
    }
};
exports.bulkMarkAttendance = bulkMarkAttendance;
const createEditRequest = async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const teacherId = req.user?.teacherId || req.user?.id;
        const result = await attendanceService.createEditRequest(schoolId, teacherId, req.body);
        res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.createEditRequest = createEditRequest;
const getEditRequests = async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const filters = {
            ...req.query,
            ...(req.user?.role === 'teacher' ? { teacherId: req.user?.teacherId || req.user?.id } : {})
        };
        const result = await attendanceService.getEditRequests(schoolId, filters);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getEditRequests = getEditRequests;
const approveEditRequest = async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        if (req.user?.role !== 'admin' && req.user?.role !== 'school_admin') {
            return res.status(403).json({ success: false, message: 'Only School Admin can approve edit requests' });
        }
        const result = await attendanceService.approveEditRequest(req.params.id, req.user?.id || 'admin', schoolId, req.body.adminNote);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.approveEditRequest = approveEditRequest;
const rejectEditRequest = async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        if (req.user?.role !== 'admin' && req.user?.role !== 'school_admin') {
            return res.status(403).json({ success: false, message: 'Only School Admin can reject edit requests' });
        }
        const result = await attendanceService.rejectEditRequest(req.params.id, req.user?.id || 'admin', schoolId, req.body.adminNote);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.rejectEditRequest = rejectEditRequest;
const getAuditLogs = async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const result = await attendanceService.getAttendanceAuditLogs(schoolId);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getAuditLogs = getAuditLogs;
