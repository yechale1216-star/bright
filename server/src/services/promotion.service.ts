import prisma from '../config/db';
import { academicYearService } from './academic-year.service';

export interface PromotionData {
  studentIds?: string[];
  gradeId?: string;
  sectionId?: string;
  streamId?: string;
  toGradeId: string | null;
  toSectionId?: string | null;
  toSectionName?: string | null;
  toStreamId?: string | null;
  academicYear: string;
  notes?: string;
}

export class PromotionService {
  /**
   * Get total student count grouped by grade, section, and stream for the preview
   */
  async getPromotionPreview(schoolId: string) {
    const students = await prisma.student.findMany({
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

    const cohortsMap: Record<string, {
      id: string;
      gradeId: string;
      gradeName: string;
      sectionId: string;
      sectionName: string;
      streamId: string | null;
      streamName: string | null;
      count: number;
    }> = {};

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
      if (gradeA !== gradeB) return gradeA - gradeB;
      
      // Then section
      if (a.sectionName !== b.sectionName) return a.sectionName.localeCompare(b.sectionName);
      
      // Then stream
      return (a.streamName || '').localeCompare(b.streamName || '');
    });
  }

  /**
   * Get individual students for a specific grade, optionally filtered by section and stream
   */
  async getStudentsByGrade(schoolId: string, gradeId: string, sectionId?: string, streamId?: string) {
    const students = await prisma.student.findMany({
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
  async promoteStudents(data: PromotionData, schoolId: string, promotedByUserId: string) {
    let { studentIds, gradeId, sectionId, streamId, toGradeId, toSectionId, toSectionName, toStreamId, academicYear, notes } = data;

    // Resolve the target AcademicYear DB record from the name
    let targetAcademicYearRecord = await prisma.academicYear.findUnique({
      where: { schoolId_name: { schoolId, name: academicYear } }
    });
    // If not found by exact name, fall back to the current active year
    if (!targetAcademicYearRecord) {
      targetAcademicYearRecord = await academicYearService.getCurrentAcademicYear(schoolId);
    }

    // Also resolve the source (current active) AY for marking source records
    const sourceAcademicYearRecord = await academicYearService.getCurrentAcademicYear(schoolId);

    // 1. If criteria provided, fetch student IDs
    if (!studentIds && (gradeId || sectionId || streamId)) {
      const students = await prisma.student.findMany({
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
      const toGrade = await prisma.grade.findUnique({ where: { id: toGradeId } });
      const toGradeNum = parseInt((toGrade?.name || '').replace(/[^\d]/g, '')) || 0;

      // If toStreamId is a name rather than a UUID, resolve/create it
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (toStreamId && !uuidRegex.test(toStreamId)) {
        const streamRecord = await prisma.stream.upsert({
          where: { schoolId_name: { schoolId, name: toStreamId } },
          create: { name: toStreamId, schoolId },
          update: {},
        });
        toStreamId = streamRecord.id;
      }

      // If promoting to Grade 11 or 12, stream is REQUIRED unless student already has one (e.g. Gr 11 -> 12)
      if (toGradeNum >= 11 && !toStreamId) {
        const sampleStudent = studentIds.length > 0 ? await prisma.student.findUnique({ where: { id: studentIds[0] }, select: { streamId: true } }) : null;
        if (!sampleStudent?.streamId) {
          throw new Error('Stream assignment (Natural Science or Social Science) is required when promoting to Grade 11 or 12');
        }
      }

      // If promoting to Grade <= 10, ensure stream is null
      if (toGradeNum > 0 && toGradeNum <= 10) {
        toStreamId = null as any;
      }
    }

    // 3. Guard: Prevent duplicate promotions
    const existingPromotions = await prisma.studentPromotion.findMany({
      where: {
        studentId: { in: studentIds },
        academicYear,
        schoolId,
      },
    });

    if (existingPromotions.length > 0) {
      const duplicateSet = new Set(existingPromotions.map(p => p.studentId));
      studentIds = studentIds.filter(id => !duplicateSet.has(id));
      
      if (studentIds.length === 0) {
        return [];
      }
    }

    // 4. Atomic transaction with extended timeout for batch operations
    return await prisma.$transaction(async (tx) => {
      // Pre-fetch/resolve grade, section, stream objects ONCE outside per-student processing
      let toGrade: { id: string; name: string } | null = null;
      if (toGradeId && toGradeId !== 'GRADUATE') {
        toGrade = await tx.grade.findUnique({ where: { id: toGradeId }, select: { id: true, name: true } });
      }

      const toGradeNum = toGrade ? parseInt((toGrade.name || '').replace(/[^\d]/g, '')) || 0 : 0;
      const isSecondary = toGradeNum >= 11;

      // Resolve section once if toSectionName is provided
      let globalTargetSectionId = toSectionId || null;
      if (!globalTargetSectionId && toSectionName && toGradeId && toGradeId !== 'GRADUATE') {
        const section = await tx.section.upsert({
          where: { schoolId_name: { name: toSectionName, schoolId } },
          update: {},
          create: { name: toSectionName, schoolId },
        });
        globalTargetSectionId = section.id;
      }

      const targetStreamObj = toStreamId ? await tx.stream.findUnique({ where: { id: toStreamId }, select: { name: true } }) : null;

      // Bulk fetch all targeted student records
      const students = await tx.student.findMany({
        where: { id: { in: studentIds }, schoolId },
        select: { id: true, gradeId: true, sectionId: true, streamId: true, fullName: true, section: { select: { name: true } } },
      });

      const results = [];

      for (const student of students) {
        // Handle dynamic section resolution per student if globalTargetSectionId wasn't set
        let targetSectionId = globalTargetSectionId;
        if (!targetSectionId && student.section?.name && toGradeId && toGradeId !== 'GRADUATE') {
          const section = await tx.section.upsert({
            where: { schoolId_name: { name: student.section.name, schoolId } },
            update: {},
            create: { name: student.section.name, schoolId },
          });
          targetSectionId = section.id;
        }

        const effectiveTargetSectionId = targetSectionId || student.sectionId;
        const effectiveTargetStreamId = toStreamId || (isSecondary ? student.streamId : null);

        // Log the promotion
        const promotion = await tx.studentPromotion.create({
          data: {
            schoolId,
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

          // Mark source academic year record as PROMOTED
          if (sourceAcademicYearRecord) {
            await tx.studentAcademicYearRecord.updateMany({
              where: { studentId: student.id, academicYearId: sourceAcademicYearRecord.id },
              data: { status: 'PROMOTED' }
            }).catch(() => {});
          }

          // Create StudentAcademicYearRecord for target academic year (prevent duplicates via upsert)
          if (targetAcademicYearRecord) {
            await tx.studentAcademicYearRecord.upsert({
              where: {
                studentId_academicYearId: {
                  studentId: student.id,
                  academicYearId: targetAcademicYearRecord.id
                }
              },
              create: {
                schoolId,
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

          // Create parent notification
          const streamInfo = targetStreamObj ? ` (${targetStreamObj.name})` : '';
          const sectionName = toSectionName || student.section?.name || '';
          const sectionInfo = sectionName ? ` Sec ${sectionName}` : '';

          await tx.parentNotification.create({
            data: {
              schoolId,
              studentId: student.id,
              type: 'PROMOTION',
              category: 'ACADEMIC',
              priority: 'NORMAL',
              title: '🎓 Student Promoted',
              message: `${student.fullName} has been promoted to ${toGrade?.name || 'the next grade'}${streamInfo}${sectionInfo} for academic year ${academicYear}.`,
            }
          }).catch(() => {});
        } else {
          await tx.student.update({
            where: { id: student.id },
            data: {
              status: 'GRADUATED',
            },
          });

          // Mark source academic year record as GRADUATED
          if (sourceAcademicYearRecord) {
            await tx.studentAcademicYearRecord.updateMany({
              where: { studentId: student.id, academicYearId: sourceAcademicYearRecord.id },
              data: { status: 'GRADUATED' }
            }).catch(() => {});
          }

          await tx.parentNotification.create({
            data: {
              schoolId,
              studentId: student.id,
              type: 'GRADUATION',
              category: 'ACADEMIC',
              priority: 'HIGH',
              title: '🎓 Student Graduated',
              message: `${student.fullName} has successfully graduated for academic year ${academicYear}!`,
            }
          }).catch(() => {});
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
  async getPromotionHistory(schoolId: string, academicYear?: string) {
    return await prisma.studentPromotion.findMany({
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
  async rollbackPromotion(promotionId: string, schoolId: string) {
    return await prisma.$transaction(async (tx) => {
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

export const promotionService = new PromotionService();
