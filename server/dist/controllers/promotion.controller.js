"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollbackPromotion = exports.getPromotionHistory = exports.promoteStudents = exports.getStudentsByGrade = exports.getPromotionPreview = void 0;
const promotion_service_1 = require("../services/promotion.service");
const getPromotionPreview = async (req, res) => {
    const schoolId = req.user?.schoolId;
    if (!schoolId)
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    try {
        const preview = await promotion_service_1.promotionService.getPromotionPreview(schoolId);
        res.status(200).json({ success: true, data: preview });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getPromotionPreview = getPromotionPreview;
const getStudentsByGrade = async (req, res) => {
    const schoolId = req.user?.schoolId;
    if (!schoolId)
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { gradeId } = req.params;
    const { sectionId, streamId } = req.query;
    try {
        const students = await promotion_service_1.promotionService.getStudentsByGrade(schoolId, gradeId, sectionId, streamId);
        res.status(200).json({ success: true, data: students });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getStudentsByGrade = getStudentsByGrade;
const isValidAcademicYear = (year) => {
    if (!year || typeof year !== 'string')
        return false;
    const cleaned = year.trim().replace(/\s*E\.?C\.?$/i, '').trim();
    const rangeMatch = cleaned.match(/^(\d{4})[\/\-](\d{2,4})$/);
    if (rangeMatch) {
        const y1 = parseInt(rangeMatch[1], 10);
        let y2 = parseInt(rangeMatch[2], 10);
        if (y2 < 100) {
            const century = Math.floor(y1 / 100) * 100;
            y2 = century + y2;
        }
        return y2 === y1 + 1;
    }
    const singleMatch = cleaned.match(/^(\d{4})$/);
    if (singleMatch) {
        const y = parseInt(singleMatch[1], 10);
        return y >= 1900 && y <= 2100;
    }
    return false;
};
const promoteStudents = async (req, res) => {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    if (!schoolId || !userId)
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!req.body.academicYear || !isValidAcademicYear(req.body.academicYear)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid academic year format. Examples: 2026/2027, 2017 E.C., 2017.'
        });
    }
    try {
        const result = await promotion_service_1.promotionService.promoteStudents(req.body, schoolId, userId);
        res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        if (error.message.includes('Duplicate promotion')) {
            return res.status(409).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.promoteStudents = promoteStudents;
const getPromotionHistory = async (req, res) => {
    const schoolId = req.user?.schoolId;
    if (!schoolId)
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { academicYear } = req.query;
    try {
        const history = await promotion_service_1.promotionService.getPromotionHistory(schoolId, academicYear);
        res.status(200).json({ success: true, data: history });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getPromotionHistory = getPromotionHistory;
const rollbackPromotion = async (req, res) => {
    const schoolId = req.user?.schoolId;
    if (!schoolId)
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { id } = req.params;
    try {
        const result = await promotion_service_1.promotionService.rollbackPromotion(id, schoolId);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.rollbackPromotion = rollbackPromotion;
