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
const settingsService = __importStar(require("../services/settings.service"));
const router = (0, express_1.Router)();
// Get settings for a school
router.get('/', async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const settings = await settingsService.getSettings(schoolId);
        res.status(200).json({ success: true, data: settings });
    }
    catch (error) {
        next(error);
    }
});
// Update settings for a school
router.put('/', async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const settings = await settingsService.updateSettings(schoolId, req.body);
        res.status(200).json({ success: true, data: settings });
    }
    catch (error) {
        next(error);
    }
});
// ─── Holiday & Non-Working Days Routes ────────────────────────────────────────
const holidayService = __importStar(require("../services/holiday.service"));
const auth_middleware_1 = require("../middleware/auth.middleware");
// GET /api/settings/holidays — list holidays for the school
router.get('/holidays', async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const includeInactive = req.query.includeInactive === 'true';
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const holidays = await holidayService.getSchoolHolidays(schoolId, { startDate, endDate, includeInactive });
        res.status(200).json({ success: true, data: holidays });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/settings/is-working-day — check working day status for a specific date
router.get('/is-working-day', async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const date = req.query.date;
        const status = await holidayService.isDateWorkingDay(schoolId, date);
        res.status(200).json({ success: true, data: status });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/settings/holidays — create holiday (admin only)
router.post('/holidays', (0, auth_middleware_1.authorize)(['admin', 'school_admin']), async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const holiday = await holidayService.createSchoolHoliday(schoolId, req.body);
        res.status(201).json({ success: true, data: holiday, message: 'Holiday created successfully.' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Failed to create holiday' });
    }
});
// PUT /api/settings/holidays/:id — update holiday (admin only)
router.put('/holidays/:id', (0, auth_middleware_1.authorize)(['admin', 'school_admin']), async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const holiday = await holidayService.updateSchoolHoliday(req.params.id, schoolId, req.body);
        res.status(200).json({ success: true, data: holiday, message: 'Holiday updated successfully.' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Failed to update holiday' });
    }
});
// DELETE /api/settings/holidays/:id — delete holiday (admin only)
router.delete('/holidays/:id', (0, auth_middleware_1.authorize)(['admin', 'school_admin']), async (req, res, next) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        await holidayService.deleteSchoolHoliday(req.params.id, schoolId);
        res.status(200).json({ success: true, message: 'Holiday deleted successfully.' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Failed to delete holiday' });
    }
});
exports.default = router;
