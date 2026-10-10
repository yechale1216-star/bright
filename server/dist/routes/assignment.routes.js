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
const express_1 = require("express");
const assignmentService = __importStar(require("../services/assignment.service"));
const router = (0, express_1.Router)();
// ─── Teacher Portal ───────────────────────────────────────────────────────────
router.get('/teacher-portal/classes', async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const data = await assignmentService.getTeacherPortalClasses(userId);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.get('/teacher-portal/class-details', async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { gradeId, sectionId, subjectId, academicYearId } = req.query;
        if (!gradeId || !sectionId) {
            return res.status(400).json({ success: false, message: 'gradeId and sectionId are required' });
        }
        const data = await assignmentService.getTeacherClassDetails(userId, {
            gradeId: gradeId,
            sectionId: sectionId,
            subjectId: subjectId,
            academicYearId: academicYearId,
        });
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
// ─── Admin: Assignment CRUD ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
    try {
        const { teacherId, role, gradeId, sectionId, subjectId, academicYearId } = req.query;
        const assignments = await assignmentService.getAssignments(undefined, teacherId, {
            role: role,
            gradeId: gradeId,
            sectionId: sectionId,
            subjectId: subjectId,
            academicYearId: academicYearId,
        });
        res.status(200).json({ success: true, data: assignments });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const assignment = await assignmentService.createAssignment(req.body);
        res.status(201).json({ success: true, data: assignment });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id', async (req, res, next) => {
    try {
        const assignment = await assignmentService.updateAssignment(req.params.id, req.body);
        res.status(200).json({ success: true, data: assignment });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        await assignmentService.deleteAssignment(req.params.id);
        res.status(200).json({ success: true, message: 'Assignment removed' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
