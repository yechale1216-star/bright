"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promotionService = exports.PromotionService = void 0;
const db_1 = __importDefault(require("../config/db"));
class PromotionService {
    /**
     * Get total student count grouped by grade, section, and stream for the preview
     */
    async getPromotionPreview(schoolId) {
        const students = await db_1.default.student.findMany({
            where: {
                schoolId,
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
            // Sort by grade first
            const gradeA = parseInt(a.gradeName.replace(/[^\d]/g, '')) || 0;
            const gradeB = parseInt(b.gradeName.replace(/[^\d]/g, '')) || 0;
            if (gradeA !== gradeB)
                return gradeA - gradeB;
            // Then section
            if (a.sectionName !== b.sectionName)
                return a.sectionName.localeCompare(b.sectionName);
            // Then stream
            return (a.streamName || '').localeCompare(b.streamName || '');
        });
    }
    /**
     * Get individual students for a specific grade, optionally filtered by section and stream
     */
    async getStudentsByGrade(schoolId, gradeId, sectionId, streamId) {
        const students = await db_1.default.student.findMany({
            where: {
                schoolId,
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
    async promoteStudents(data, schoolId, promotedByUserId) {
        let { studentIds, gradeId, sectionId, streamId, toGradeId, toSectionId, toSectionName, toStreamId, academicYear, notes } = data;
        // 1. If criteria provided, fetch student IDs
        if (!studentIds && (gradeId || sectionId || streamId)) {
            const students = await db_1.default.student.findMany({
                where: {
                    schoolId,
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
        // 2. Stream Validation for Ethiopian Secondary Schools (Grade 10 -> 11)
        if (toGradeId && toGradeId !== 'GRADUATE') {
            const toGrade = await db_1.default.grade.findUnique({ where: { id: toGradeId } });
            // If promoting to Grade 11 or 12, stream is REQUIRED
            const toGradeNum = parseInt((toGrade?.name || '').replace(/[^\d]/g, '')) || 0;
            if (toGradeNum >= 11 && !toStreamId) {
                throw new Error('Stream assignment (Natural or Social Science) is required when promoting to Grade 11 or 12');
            }
            // If toStreamId is a name rather than a UUID, resolve/create it
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (toStreamId && !uuidRegex.test(toStreamId)) {
                // It's a stream name - upsert it for this school
                const streamRecord = await db_1.default.stream.upsert({
                    where: { schoolId_name: { schoolId, name: toStreamId } },
                    create: { name: toStreamId, schoolId },
                    update: {},
                });
                toStreamId = streamRecord.id;
            }
            // If promoting to Grade <= 10, ensure stream is null
            if (toGradeNum > 0 && toGradeNum <= 10) {
                toStreamId = null;
            }
        }
        // 3. Guard: Prevent duplicate promotions
        const existingPromotions = await db_1.default.studentPromotion.findMany({
            where: {
                studentId: { in: studentIds },
                academicYear,
                schoolId,
            },
        });
        if (existingPromotions.length > 0) {
            const duplicateIds = existingPromotions.map(p => p.studentId);
            throw new Error(`Duplicate promotion detected for ${duplicateIds.length} students in academic year ${academicYear}`);
        }
        // 4. Atomic transaction
        return await db_1.default.$transaction(async (tx) => {
            const results = [];
            for (const studentId of studentIds) {
                const student = await tx.student.findUnique({
                    where: { id: studentId, schoolId },
                    select: { gradeId: true, sectionId: true, streamId: true, fullName: true },
                });
                if (!student)
                    continue;
                // Handle dynamic section resolution
                let targetSectionId = toSectionId;
                // If neither ID nor Name provided, default to the student's current section NAME in the target grade
                const sectionNameResolver = toSectionName || (student.sectionId ? (await tx.section.findUnique({ where: { id: student.sectionId } }))?.name : null);
                if (!targetSectionId && sectionNameResolver && toGradeId && toGradeId !== 'GRADUATE') {
                    // Find or create the section by name in the school
                    const section = await tx.section.upsert({
                        where: {
                            schoolId_name: {
                                name: sectionNameResolver,
                                schoolId,
                            },
                        },
                        update: {},
                        create: {
                            name: sectionNameResolver,
                            schoolId,
                        },
                    });
                    targetSectionId = section.id;
                }
                // Log the promotion
                const promotion = await tx.studentPromotion.create({
                    data: {
                        schoolId,
                        studentId,
                        academicYear,
                        fromGradeId: student.gradeId,
                        fromSectionId: student.sectionId,
                        fromStreamId: student.streamId,
                        toGradeId: toGradeId === 'GRADUATE' ? null : toGradeId,
                        toSectionId: toGradeId === 'GRADUATE' ? null : targetSectionId,
                        toStreamId: toGradeId === 'GRADUATE' ? null : toStreamId,
                        promotedByUserId,
                        notes,
                    },
                });
                // Update Student Record
                if (toGradeId && toGradeId !== 'GRADUATE') {
                    const toGrade = await tx.grade.findUnique({ where: { id: toGradeId } });
                    const toGradeNum = toGrade ? parseInt((toGrade.name || '').replace(/[^\d]/g, '')) || 0 : 0;
                    const isSecondary = toGradeNum >= 11;
                    await tx.student.update({
                        where: { id: studentId },
                        data: {
                            gradeId: toGradeId,
                            sectionId: targetSectionId || student.sectionId,
                            streamId: toStreamId || (isSecondary ? student.streamId : null),
                            status: 'ACTIVE',
                        },
                    });
                }
                else {
                    await tx.student.update({
                        where: { id: studentId },
                        data: {
                            status: 'GRADUATED',
                        },
                    });
                }
                results.push(promotion);
            }
            return results;
        });
    }
    /**
     * Get promotion history for a school
     */
    async getPromotionHistory(schoolId, academicYear) {
        return await db_1.default.studentPromotion.findMany({
            where: {
                schoolId,
                ...(academicYear ? { academicYear } : {}),
            },
            include: {
                student: {
                    select: { fullName: true, student_id: true },
                },
                // We'd ideally include names for fromGrade/toGrade but they are strings in the model
                // We might need to join them manually or fetch references
            },
            orderBy: { promotedAt: 'desc' },
        });
    }
    /**
     * Rollback a promotion record
     */
    async rollbackPromotion(promotionId, schoolId) {
        return await db_1.default.$transaction(async (tx) => {
            const promotion = await tx.studentPromotion.findUnique({
                where: { id: promotionId },
            });
            if (!promotion || promotion.schoolId !== schoolId) {
                throw new Error('Promotion record not found');
            }
            // Revert student to previous state
            await tx.student.update({
                where: { id: promotion.studentId },
                data: {
                    gradeId: promotion.fromGradeId,
                    sectionId: promotion.fromSectionId,
                    streamId: promotion.fromStreamId,
                    status: 'ACTIVE',
                },
            });
            // Remove promotion record
            await tx.studentPromotion.delete({
                where: { id: promotionId },
            });
            return { success: true };
        });
    }
}
exports.PromotionService = PromotionService;
exports.promotionService = new PromotionService();
