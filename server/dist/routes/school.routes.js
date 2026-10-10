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
const schoolService = __importStar(require("../services/school.service"));
const router = (0, express_1.Router)();
// ─── Grades ─────────────────────────────────────────────────────────────────
const getGradesHandler = async (_req, res, next) => {
    try {
        const grades = await schoolService.getGrades();
        res.status(200).json({ success: true, data: grades });
    }
    catch (error) {
        next(error);
    }
};
router.get('/me/grades', getGradesHandler);
router.get('/grades', getGradesHandler); // alias for frontend compatibility
router.post('/me/grades', async (req, res, next) => {
    try {
        const grade = await schoolService.createGrade(req.body);
        res.status(201).json({ success: true, data: grade });
    }
    catch (error) {
        next(error);
    }
});
router.put('/me/grades/:id', async (req, res, next) => {
    try {
        const grade = await schoolService.updateGrade(req.params.id, req.body);
        res.status(200).json({ success: true, data: grade });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/me/grades/:id', async (req, res, next) => {
    try {
        await schoolService.deleteGrade(req.params.id);
        res.status(200).json({ success: true, message: 'Grade deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ─── Sections ───────────────────────────────────────────────────────────────
const getSectionsHandler = async (req, res, next) => {
    try {
        const { gradeId } = req.query;
        const sections = await schoolService.getSections(gradeId);
        res.status(200).json({ success: true, data: sections });
    }
    catch (error) {
        next(error);
    }
};
router.get('/me/sections', getSectionsHandler);
router.get('/sections', getSectionsHandler); // alias for frontend compatibility
router.post('/me/sections', async (req, res, next) => {
    try {
        const section = await schoolService.createSection(req.body);
        res.status(201).json({ success: true, data: section });
    }
    catch (error) {
        next(error);
    }
});
router.put('/me/sections/:id', async (req, res, next) => {
    try {
        const section = await schoolService.updateSection(req.params.id, req.body);
        res.status(200).json({ success: true, data: section });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/me/sections/:id', async (req, res, next) => {
    try {
        await schoolService.deleteSection(req.params.id);
        res.status(200).json({ success: true, message: 'Section deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ─── Streams ────────────────────────────────────────────────────────────────
router.get('/me/streams', async (_req, res, next) => {
    try {
        const streams = await schoolService.getStreams();
        res.status(200).json({ success: true, data: streams });
    }
    catch (error) {
        next(error);
    }
});
router.post('/me/streams', async (req, res, next) => {
    try {
        const stream = await schoolService.createStream(req.body);
        res.status(201).json({ success: true, data: stream });
    }
    catch (error) {
        next(error);
    }
});
router.put('/me/streams/:id', async (req, res, next) => {
    try {
        const stream = await schoolService.updateStream(req.params.id, req.body);
        res.status(200).json({ success: true, data: stream });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/me/streams/:id', async (req, res, next) => {
    try {
        await schoolService.deleteStream(req.params.id);
        res.status(200).json({ success: true, message: 'Stream deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ─── Subjects ───────────────────────────────────────────────────────────────
const getSubjectsHandler = async (_req, res, next) => {
    try {
        const subjects = await schoolService.getSubjects();
        res.status(200).json({ success: true, data: subjects });
    }
    catch (error) {
        next(error);
    }
};
router.get('/me/subjects', getSubjectsHandler);
router.get('/subjects', getSubjectsHandler); // alias for frontend compatibility
router.post('/me/subjects', async (req, res, next) => {
    try {
        const subject = await schoolService.createSubject(req.body);
        res.status(201).json({ success: true, data: subject });
    }
    catch (error) {
        next(error);
    }
});
router.put('/me/subjects/:id', async (req, res, next) => {
    try {
        const subject = await schoolService.updateSubject(req.params.id, req.body);
        res.status(200).json({ success: true, data: subject });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/me/subjects/:id', async (req, res, next) => {
    try {
        await schoolService.deleteSubject(req.params.id);
        res.status(200).json({ success: true, message: 'Subject deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Create or upsert school
router.post('/', async (req, res, next) => {
    try {
        const school = await schoolService.createSchool(req.body);
        res.status(200).json({ success: true, data: school });
    }
    catch (error) {
        next(error);
    }
});
// Update school by ID
router.put('/:id', async (req, res, next) => {
    try {
        const school = await schoolService.updateSchool(req.params.id, req.body);
        res.status(200).json({ success: true, data: school });
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
