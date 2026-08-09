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
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const db_1 = __importDefault(require("../config/db"));
const schoolService = __importStar(require("../services/school.service"));
const router = (0, express_1.Router)();
// Get all grades for current school
router.get('/me/grades', async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const grades = await schoolService.getGrades(schoolId);
        res.status(200).json({ success: true, data: grades });
    }
    catch (error) {
        next(error);
    }
});
// Get all sections for current school
router.get('/me/sections', async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const sections = await schoolService.getSections(schoolId);
        res.status(200).json({ success: true, data: sections });
    }
    catch (error) {
        next(error);
    }
});
// Get all streams for current school
router.get('/me/streams', async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const streams = await schoolService.getStreams(schoolId);
        res.status(200).json({ success: true, data: streams });
    }
    catch (error) {
        next(error);
    }
});
// ─── Help Desk (Support Tickets & Feedback) ──────────────────────────────────────────────
router.get('/support', (0, auth_middleware_1.authorize)(['admin', 'teacher', 'parent', 'student', 'school_admin']), async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const tickets = await db_1.default.supportTicket.findMany({
            where: { schoolId },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: tickets });
    }
    catch (error) {
        next(error);
    }
});
router.post('/support', (0, auth_middleware_1.authorize)(['admin', 'teacher', 'parent', 'student', 'school_admin']), async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        const authorId = req.user?.id;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { subject, message, category, priority } = req.body;
        const ticket = await db_1.default.supportTicket.create({
            data: {
                ticketNumber: `TCK-${Date.now()}`,
                schoolId,
                authorId,
                subject: subject || 'Support Ticket',
                description: message || '',
                category: category || 'GENERAL',
                priority: priority || 'MEDIUM',
                status: 'OPEN',
            }
        });
        res.status(201).json({ success: true, data: ticket });
    }
    catch (error) {
        next(error);
    }
});
// Get school by ID
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        let school;
        if (id.startsWith('SCH-')) {
            school = await schoolService.getSchoolByCustomId(id);
        }
        else {
            school = await schoolService.getSchoolById(id);
        }
        if (!school)
            return res.status(404).json({ success: false, message: 'School not found' });
        res.status(200).json({ success: true, data: school });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
