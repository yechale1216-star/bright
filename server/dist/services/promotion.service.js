"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promotionService = exports.PromotionService = void 0;
const db_1 = __importDefault(require("../config/db"));
const academic_year_service_1 = require("./academic-year.service");
class PromotionService {
    /**
     * Get total student count grouped by grade, section, and stream for the preview
     */
    async getPromotionPreview(_schoolId) {
        const students = await db_1.default.student.findMany({
            where: {
                status: 'ACTIVE',
            },
            include: {
                grade: true,
                section: true,
                stream: true,
            },
        });
        const cohortsMap = {};
        students.forEach(student => {
            const cohortKey = `${student.gradeId}-${student.sectionId}-${student.streamId || 'none'}`;
            if (!cohortsMap[cohortKey]) {
                cohortsMap[cohortKey] = {
                    id: cohortKey,
                    gradeId: student.gradeId,
                    gradeName: student.grade.name,
                    sectionId: student.sectionId,
                    sectionName: student.section.name,
                    streamId: student.streamId,
                    streamName: student.stream?.name || null,
                    count: 0,
                };
            }
            cohortsMap[cohortKey].count++;
        });
        return Object.values(cohortsMap).sort((a, b) => {
            const gradeA = parseInt(a.gradeName.replace(/[^\d]/g, '')) || 0;
            const gradeB = parseInt(b.gradeName.replace(/[^\d]/g, '')) || 0;
            if (gradeA !== gradeB)
                return gradeA - gradeB;
            if (a.sectionName !== b.sectionName)
                return a.sectionName.localeCompare(b.sectionName);
            return (a.streamName || '').localeCompare(b.streamName || '');
        });
    }
    /**
     * Get individual students for a specific grade, optionally filtered by section and stream
     */
    async getStudentsByGrade(_schoolId, gradeId, sectionId, streamId) {
        const students = await db_1.default.student.findMany({
            where: {
                gradeId,
                ...(sectionId ? { sectionId } : {}),
                ...(streamId ? { streamId: streamId === 'none' ? null : streamId } : {}),
                status: 'ACTIVE',
            },
            select: {
                id: true,
                fullName: true,
                student_id: true,
                gender: true,
                sectionId: true,
                streamId: true,
                section: { select: { id: true, name: true } },
                stream: { select: { id: true, name: true } },
            },
            orderBy: { fullName: 'asc' },
        });
        return students;
    }
    /**
     * Execute promotion for a list of students
     */
    async promoteStudents(data, _schoolId, promotedByUserId) {
        let { studentIds, gradeId, sectionId, streamId, toGradeId, toSectionId, toSectionName, toStreamId, academicYear, notes } = data;
        let targetAcademicYearRecord = await db_1.default.academicYear.findUnique({
            where: { name: academicYear }
        });
        if (!targetAcademicYearRecord) {
            targetAcademicYearRecord = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
        }
        const sourceAcademicYearRecord = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
        if (!studentIds && (gradeId || sectionId || streamId)) {
            const students = await db_1.default.student.findMany({
                where: {
                    ...(gradeId ? { gradeId } : {}),
                    ...(sectionId ? { sectionId } : {}),
                    ...(streamId ? { streamId: streamId === 'none' ? null : streamId } : {}),
                    status: 'ACTIVE',
                },
                select: { id: true },
            });
            studentIds = students.map(s => s.id);
        }
        if (!studentIds || studentIds.length === 0) {
            throw new Error('No students selected for promotion');
        }
        if (toGradeId && toGradeId !== 'GRADUATE') {
            const toGrade = await db_1.default.grade.findUnique({ where: { id: toGradeId } });
            const toGradeNum = parseInt((toGrade?.name || '').replace(/[^\d]/g, '')) || 0;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (toStreamId && !uuidRegex.test(toStreamId)) {
                const streamRecord = await db_1.default.stream.upsert({
                    where: { name: toStreamId },
                    create: { name: toStreamId },
                    update: {},
                });
                toStreamId = streamRecord.id;
            }
            if (toGradeNum >= 11 && !toStreamId) {
                const sampleStudent = studentIds.length > 0 ? await db_1.default.student.findUnique({ where: { id: studentIds[0] }, select: { streamId: true } }) : null;
                if (!sampleStudent?.streamId) {
                    throw new Error('Stream assignment (Natural Science or Social Science) is required when promoting to Grade 11 or 12');
                }
            }
            if (toGradeNum > 0 && toGradeNum <= 10) {
                toStreamId = null;
            }
        }
        const existingPromotions = await db_1.default.studentPromotion.findMany({
            where: {
                studentId: { in: studentIds },
                academicYear,
            },
        });
        if (existingPromotions.length > 0) {
            const duplicateSet = new Set(existingPromotions.map(p => p.studentId));
            studentIds = studentIds.filter(id => !duplicateSet.has(id));
            if (studentIds.length === 0) {
                return [];
            }
        }
        return await db_1.default.$transaction(async (tx) => {
            let toGrade = null;
            if (toGradeId && toGradeId !== 'GRADUATE') {
                toGrade = await tx.grade.findUnique({ where: { id: toGradeId }, select: { id: true, name: true } });
            }
            const toGradeNum = toGrade ? parseInt((toGrade.name || '').replace(/[^\d]/g, '')) || 0 : 0;
            const isSecondary = toGradeNum >= 11;
            let globalTargetSectionId = toSectionId || null;
            if (!globalTargetSectionId && toSectionName && toGradeId && toGradeId !== 'GRADUATE') {
                const section = await tx.section.upsert({
                    where: { name: toSectionName },
                    update: {},
                    create: { name: toSectionName },
                });
                globalTargetSectionId = section.id;
            }
            const targetStreamObj = toStreamId ? await tx.stream.findUnique({ where: { id: toStreamId }, select: { name: true } }) : null;
            const students = await tx.student.findMany({
                where: { id: { in: studentIds } },
                select: { id: true, gradeId: true, sectionId: true, streamId: true, fullName: true, section: { select: { name: true } } },
            });
            const results = [];
            for (const student of students) {
                let targetSectionId = globalTargetSectionId;
                if (!targetSectionId && student.section?.name && toGradeId && toGradeId !== 'GRADUATE') {
                    const section = await tx.section.upsert({
                        where: { name: student.section.name },
                        update: {},
                        create: { name: student.section.name },
                    });
                    targetSectionId = section.id;
                }
                const effectiveTargetSectionId = targetSectionId || student.sectionId;
                const effectiveTargetStreamId = toStreamId || (isSecondary ? student.streamId : null);
                const promotion = await tx.studentPromotion.create({
                    data: {
                        studentId: student.id,
                        academicYear,
                        fromGradeId: student.gradeId,
                        fromSectionId: student.sectionId,
                        fromStreamId: student.streamId,
                        toGradeId: toGradeId === 'GRADUATE' ? null : toGradeId,
                        toSectionId: toGradeId === 'GRADUATE' ? null : effectiveTargetSectionId,
                        toStreamId: toGradeId === 'GRADUATE' ? null : effectiveTargetStreamId,
                        promotedByUserId,
                        notes,
                    },
                });
                if (toGradeId && toGradeId !== 'GRADUATE') {
                    await tx.student.update({
                        where: { id: student.id },
                        data: {
                            gradeId: toGradeId,
                            sectionId: effectiveTargetSectionId,
                            streamId: effectiveTargetStreamId,
                            status: 'ACTIVE',
                        },
                    });
                    if (sourceAcademicYearRecord) {
                        await tx.studentAcademicYearRecord.updateMany({
                            where: { studentId: student.id, academicYearId: sourceAcademicYearRecord.id },
                            data: { status: 'PROMOTED' }
                        }).catch(() => { });
                    }
                    if (targetAcademicYearRecord) {
                        await tx.studentAcademicYearRecord.upsert({
                            where: {
                                studentId_academicYearId: {
                                    studentId: student.id,
                                    academicYearId: targetAcademicYearRecord.id
                                }
                            },
                            create: {
                                studentId: student.id,
                                academicYearId: targetAcademicYearRecord.id,
                                gradeId: toGradeId,
                                sectionId: effectiveTargetSectionId || student.sectionId,
                                streamId: effectiveTargetStreamId || null,
                                status: 'ACTIVE',
                            },
                            update: {
                                gradeId: toGradeId,
                                sectionId: effectiveTargetSectionId || student.sectionId,
                                streamId: effectiveTargetStreamId || null,
                                status: 'ACTIVE',
                            }
                        });
                    }
                    const streamInfo = targetStreamObj ? ` (${targetStreamObj.name})` : '';
                    const sectionName = toSectionName || student.section?.name || '';
                    const sectionInfo = sectionName ? ` Sec ${sectionName}` : '';
                    await tx.parentNotification.create({
                        data: {
                            studentId: student.id,
                            type: 'PROMOTION',
                            category: 'ACADEMIC',
                            priority: 'NORMAL',
                            title: '🎓 Student Promoted',
                            message: `${student.fullName} has been promoted to ${toGrade?.name || 'the next grade'}${streamInfo}${sectionInfo} for academic year ${academicYear}.`,
                        }
                    }).catch(() => { });
                }
                else {
                    await tx.student.update({
                        where: { id: student.id },
                        data: {
                            status: 'GRADUATED',
                        },
                    });
                    if (sourceAcademicYearRecord) {
                        await tx.studentAcademicYearRecord.updateMany({
                            where: { studentId: student.id, academicYearId: sourceAcademicYearRecord.id },
                            data: { status: 'GRADUATED' }
                        }).catch(() => { });
                    }
                    await tx.parentNotification.create({
                        data: {
                            studentId: student.id,
                            type: 'GRADUATION',
                            category: 'ACADEMIC',
                            priority: 'HIGH',
                            title: '🎓 Student Graduated',
                            message: `${student.fullName} has successfully graduated for academic year ${academicYear}!`,
                        }
                    }).catch(() => { });
                }
                results.push(promotion);
            }
            return results;
        }, {
            maxWait: 10000,
            timeout: 60000,
        });
    }
    /**
     * Get promotion history for a school
     */
    async getPromotionHistory(_schoolId, academicYear) {
        return await db_1.default.studentPromotion.findMany({
            where: {
                ...(academicYear ? { academicYear } : {}),
            },
            include: {
                student: {
                    select: { fullName: true, student_id: true },
                },
            },
            orderBy: { promotedAt: 'desc' },
        });
    }
    /**
     * Rollback a promotion record
     */
    async rollbackPromotion(promotionId, _schoolId) {
        return await db_1.default.$transaction(async (tx) => {
            const promotion = await tx.studentPromotion.findUnique({
                where: { id: promotionId },
            });
            if (!promotion) {
                throw new Error('Promotion record not found');
            }
            await tx.student.update({
                where: { id: promotion.studentId },
                data: {
                    gradeId: promotion.fromGradeId,
                    sectionId: promotion.fromSectionId,
                    streamId: promotion.fromStreamId,
                    status: 'ACTIVE',
                },
            });
            await tx.studentPromotion.delete({
                where: { id: promotionId },
            });
            return { success: true };
        });
    }
}
exports.PromotionService = PromotionService;
exports.promotionService = new PromotionService();
