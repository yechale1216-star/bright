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
// Get all grades
router.get('/me/grades', async (_req, res, next) => {
    try {
        const grades = await schoolService.getGrades();
        res.status(200).json({ success: true, data: grades });
    }
    catch (error) {
        next(error);
    }
});
// Get all sections
router.get('/me/sections', async (_req, res, next) => {
    try {
        const sections = await schoolService.getSections();
        res.status(200).json({ success: true, data: sections });
    }
    catch (error) {
        next(error);
    }
});
// Get all streams
router.get('/me/streams', async (_req, res, next) => {
    try {
        const streams = await schoolService.getStreams();
        res.status(200).json({ success: true, data: streams });
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
