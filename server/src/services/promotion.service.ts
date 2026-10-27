import { checkStudentEligibility } from './student-eligibility.service';
import prisma from '../config/db';
import { academicYearService } from './academic-year.service';
import { gradebookService } from './gradebook.service';
import { evaluateStudentPromotion, SubjectPeriodScores, GradingScaleItem } from '../utils/report-card-promotion';

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
  fromAcademicYear?: string;
  notes?: string;
}

export interface StudentEligibilityResult {
  studentId: string;
  fullName: string;
  student_id: string;
  gender: string | null;
  gradeId: string;
  gradeName: string;
  sectionId: string;
  sectionName: string;
  streamId: string | null;
  streamName: string | null;
  finalStatus: 'PASSED' | 'FAILED' | 'INCOMPLETE';
  isEligible: boolean;
  ineligibilityReason: string | null;
  overallAverage: number | null;
  failedSubjectsCount: number;
  incompleteSubjectsCount: number;
  remarkBadge: string;
  reportCardStatus: string | null;
}

export class PromotionService {
  /**
   * Evaluate a student's academic promotion eligibility using authoritative report card results,
   * configured terms, curriculum subjects, grading scales, and pass/fail thresholds.
   *
   * Rules enforced:
   * 1. Promote only PASSED students (all results complete, average >= pass threshold, failing subjects within limit).
   * 2. Block FAILED students.
   * 3. Block INCOMPLETE students (missing terms, missing assessments/marks, unpublished cards, pending approvals).
  /**
   * Batch evaluate academic promotion eligibility for multiple students
   * using authoritative report card results, configured terms, curriculum subjects,
   * grading scales, and pass/fail thresholds in high-performance batch queries.
   */
  async evaluateStudentsAcademicEligibilityBatch(
    studentIds: string[],
    fromAcademicYearName?: string
  ): Promise<Map<string, StudentEligibilityResult>> {
    const resultMap = new Map<string, StudentEligibilityResult>();
    if (studentIds.length === 0) return resultMap;

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: {
        grade: true,
        section: true,
        stream: true,
      },
    });

    let sourceAcademicYear = fromAcademicYearName
      ? await prisma.academicYear.findUnique({ where: { name: fromAcademicYearName } })
      : null;

    if (!sourceAcademicYear) {
      sourceAcademicYear = await academicYearService.getCurrentAcademicYear();
    }

    if (!sourceAcademicYear) {
      for (const s of students) {
        resultMap.set(s.id, {
          studentId: s.id,
          fullName: s.fullName,
          student_id: s.student_id,
          gender: s.gender,
          gradeId: s.gradeId,
          gradeName: s.grade.name,
          sectionId: s.sectionId,
          sectionName: s.section.name,
          streamId: s.streamId,
          streamName: s.stream?.name || null,
          finalStatus: 'INCOMPLETE',
          isEligible: false,
          ineligibilityReason: 'Academic year is not configured in the system.',
          overallAverage: null,
          failedSubjectsCount: 0,
          incompleteSubjectsCount: 0,
          remarkBadge: 'INCOMPLETE',
          reportCardStatus: null,
        });
      }
      return resultMap;
    }

    const terms = await prisma.academicTerm.findMany({
      where: { academicYearId: sourceAcademicYear.id },
      orderBy: { startDate: 'asc' },
    });

    const allReportCards = await prisma.reportCard.findMany({
      where: {
        academicYearId: sourceAcademicYear.id,
        studentId: { in: studentIds },
      },
      include: {
        academicTerm: true,
        subjectScores: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const reportCardsByStudent = new Map<string, typeof allReportCards>();
    for (const rc of allReportCards) {
      if (!reportCardsByStudent.has(rc.studentId)) {
        reportCardsByStudent.set(rc.studentId, []);
      }
      reportCardsByStudent.get(rc.studentId)!.push(rc);
    }

    const dbScales = await prisma.gradingScale.findMany({ orderBy: { minScore: 'desc' } });
    const gradingScales: GradingScaleItem[] = dbScales.map((s) => ({
      grade: s.grade,
      minScore: s.minScore,
      maxScore: s.maxScore,
      gpaPoint: s.gpaPoint,
      isPassing: s.isPassing,
      description: s.description,
    }));

    const passingScales = gradingScales.filter((s) => s.isPassing);
    const policyPassingMinScore = passingScales.length > 0
      ? Math.min(...passingScales.map((s) => s.minScore))
      : 50.0;

    const uniqueGradeIds = Array.from(new Set(students.map((s) => s.gradeId)));
    const explicitAssignments = await prisma.gradeSubject.findMany({
      where: { gradeId: { in: uniqueGradeIds } },
    });
    const explicitGradesSet = new Set(explicitAssignments.map((a) => a.gradeId));

    for (const student of students) {
      const defaultResult: StudentEligibilityResult = {
        studentId: student.id,
        fullName: student.fullName,
        student_id: student.student_id,
        gender: student.gender,
        gradeId: student.gradeId,
        gradeName: student.grade.name,
        sectionId: student.sectionId,
        sectionName: student.section.name,
        streamId: student.streamId,
        streamName: student.stream?.name || null,
        finalStatus: 'INCOMPLETE',
        isEligible: false,
        ineligibilityReason: null,
        overallAverage: null,
        failedSubjectsCount: 0,
        incompleteSubjectsCount: 0,
        remarkBadge: 'INCOMPLETE',
        reportCardStatus: null,
      };

      if (student.status !== 'ACTIVE') {
        resultMap.set(student.id, {
          ...defaultResult,
          ineligibilityReason: `Student is not active (current status: ${student.status}). Only active students can be promoted.`,
        });
        continue;
      }

      const reportCards = reportCardsByStudent.get(student.id) || [];

      if (reportCards.length === 0) {
        resultMap.set(student.id, {
          ...defaultResult,
          ineligibilityReason: `Missing final report card for academic year ${sourceAcademicYear.name}. Report cards must be generated and published before promotion.`,
        });
        continue;
      }

      if (terms.length > 0) {
        const termIdsWithCard = new Set(reportCards.map((rc) => rc.academicTermId));
        const missingTerms = terms.filter((t) => !termIdsWithCard.has(t.id));
        if (missingTerms.length > 0) {
          resultMap.set(student.id, {
            ...defaultResult,
            ineligibilityReason: `Missing report card for required term(s): ${missingTerms.map((t) => t.name).join(', ')}.`,
          });
          continue;
        }
      }

      const unpublishedCards = reportCards.filter((rc) => rc.status !== 'PUBLISHED');
      if (unpublishedCards.length > 0) {
        const statusList = unpublishedCards
          .map((rc) => `${rc.academicTerm?.name || 'Term'}: ${rc.status}`)
          .join(', ');
        resultMap.set(student.id, {
          ...defaultResult,
          reportCardStatus: unpublishedCards[0].status,
          ineligibilityReason: `Report card is not published (${statusList}). Only approved and published results qualify for promotion.`,
        });
        continue;
      }

      let hasUnapproved = false;
      for (const rc of reportCards) {
        for (const subjScore of rc.subjectScores) {
          if (subjScore.status === 'PENDING_APPROVAL') {
            resultMap.set(student.id, {
              ...defaultResult,
              reportCardStatus: 'PENDING_APPROVAL',
              ineligibilityReason: `Marks for "${subjScore.subject?.name || 'Subject'}" are pending administrative approval in ${rc.academicTerm?.name || 'report card'}.`,
            });
            hasUnapproved = true;
            break;
          }
          if (subjScore.status === 'MISSING') {
            resultMap.set(student.id, {
              ...defaultResult,
              reportCardStatus: 'MISSING',
              ineligibilityReason: `Marks for "${subjScore.subject?.name || 'Subject'}" are missing in ${rc.academicTerm?.name || 'report card'}.`,
            });
            hasUnapproved = true;
            break;
          }
          if (subjScore.score === null || subjScore.score === undefined || isNaN(subjScore.score)) {
            resultMap.set(student.id, {
              ...defaultResult,
              ineligibilityReason: `Recorded score for "${subjScore.subject?.name || 'Subject'}" is incomplete in ${rc.academicTerm?.name || 'report card'}.`,
            });
            hasUnapproved = true;
            break;
          }
        }
        if (hasUnapproved) break;
      }
      if (hasUnapproved) continue;

      // Check curriculum subjects if explicitly assigned
      if (explicitGradesSet.has(student.gradeId)) {
        const requiredSubjects = await gradebookService.getRequiredSubjectsForGradeAndSection(
          student.gradeId,
          student.sectionId,
          sourceAcademicYear.id,
          undefined,
          student.streamId || undefined
        );

        let missingCurriculum = false;
        if (requiredSubjects.length > 0) {
          for (const rc of reportCards) {
            const rcSubjectIds = new Set(rc.subjectScores.map((s) => s.subjectId));
            const missingInRc = requiredSubjects.filter((rs) => !rcSubjectIds.has(rs.id));
            if (missingInRc.length > 0) {
              resultMap.set(student.id, {
                ...defaultResult,
                ineligibilityReason: `Required subject(s) missing from ${rc.academicTerm?.name || 'report card'}: ${missingInRc.map((s) => s.name).join(', ')}.`,
              });
              missingCurriculum = true;
              break;
            }
          }
        }
        if (missingCurriculum) continue;
      }

      // Build subject scores across terms
      const subjectMap = new Map<string, { id: string; name: string; code?: string }>();
      for (const rc of reportCards) {
        for (const ss of rc.subjectScores) {
          if (!subjectMap.has(ss.subjectId)) {
            subjectMap.set(ss.subjectId, {
              id: ss.subjectId,
              name: ss.subject?.name || 'Subject',
              code: ss.subject?.code,
            });
          }
        }
      }

      const requiredPeriodIds = terms.length > 0
        ? terms.map((t) => t.id)
        : reportCards.map((rc) => rc.academicTermId);

      const subjectScoresList: SubjectPeriodScores[] = Array.from(subjectMap.values()).map((subj) => {
        const scores: Record<string, number | null | undefined> = {};
        for (const periodId of requiredPeriodIds) {
          const rc = reportCards.find((c) => c.academicTermId === periodId);
          if (!rc) {
            scores[periodId] = null;
            continue;
          }
          const ss = rc.subjectScores.find((s) => s.subjectId === subj.id);
          if (!ss || ss.score === null || ss.score === undefined) {
            scores[periodId] = null;
          } else {
            scores[periodId] = Number(ss.score);
          }
        }
        return {
          subjectId: subj.id,
          subjectName: subj.name,
          code: subj.code,
          scores,
        };
      });

      const promoEval = evaluateStudentPromotion({
        subjectScores: subjectScoresList,
        requiredPeriodIds,
        isSingleTerm: requiredPeriodIds.length <= 1,
        policyPassingMinScore,
        maxAllowedFailedSubjects: 2,
        gradingScales,
      });

      if (promoEval.isIncomplete) {
        resultMap.set(student.id, {
          ...defaultResult,
          finalStatus: 'INCOMPLETE',
          isEligible: false,
          ineligibilityReason: promoEval.missingReasons.join('; ') || 'Required assessments or marks are incomplete',
          overallAverage: promoEval.overallAverage,
          failedSubjectsCount: promoEval.failedSubjectsCount,
          incompleteSubjectsCount: promoEval.incompleteSubjectsCount,
          remarkBadge: 'INCOMPLETE',
          reportCardStatus: 'PUBLISHED',
        });
        continue;
      }

      if (!promoEval.isOverallPassing) {
        const failReason = (promoEval.overallAverage !== null && promoEval.overallAverage < policyPassingMinScore)
          ? `Final average (${promoEval.overallAverage.toFixed(1)}%) is below the passing requirement of ${policyPassingMinScore}%.`
          : `Student failed ${promoEval.failedSubjectsCount} subject(s), exceeding the maximum allowed limit of 2.`;

        resultMap.set(student.id, {
          ...defaultResult,
          finalStatus: 'FAILED',
          isEligible: false,
          ineligibilityReason: failReason,
          overallAverage: promoEval.overallAverage,
          failedSubjectsCount: promoEval.failedSubjectsCount,
          incompleteSubjectsCount: 0,
          remarkBadge: promoEval.remarkBadge,
          reportCardStatus: 'PUBLISHED',
        });
        continue;
      }

      resultMap.set(student.id, {
        ...defaultResult,
        finalStatus: 'PASSED',
        isEligible: true,
        ineligibilityReason: null,
        overallAverage: promoEval.overallAverage,
        failedSubjectsCount: promoEval.failedSubjectsCount,
        incompleteSubjectsCount: 0,
        remarkBadge: promoEval.remarkBadge,
        reportCardStatus: 'PUBLISHED',
      });
    }

    return resultMap;
  }

  /**
   * Evaluate a single student's academic promotion eligibility
   */
  async evaluateStudentAcademicEligibility(
    studentId: string,
    fromAcademicYearName?: string
  ): Promise<StudentEligibilityResult> {
    const map = await this.evaluateStudentsAcademicEligibilityBatch([studentId], fromAcademicYearName);
    const result = map.get(studentId);
    if (!result) {
      throw new Error(`Student with ID "${studentId}" not found`);
    }
    return result;
  }

  /**
   * Get total student count grouped by grade, section, and stream with academic eligibility counts
   */
  async getPromotionPreview(_schoolId?: string, fromAcademicYear?: string) {
    const students = await prisma.student.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        grade: true,
        section: true,
        stream: true,
      },
    });

    const eligibilityMap = await this.evaluateStudentsAcademicEligibilityBatch(
      students.map((s) => s.id),
      fromAcademicYear
    );

    const cohortsMap: Record<string, {
      id: string;
      gradeId: string;
      gradeName: string;
      sectionId: string;
      sectionName: string;
      streamId: string | null;
      streamName: string | null;
      count: number;
      eligibleCount: number;
      failedCount: number;
      incompleteCount: number;
    }> = {};

    for (const student of students) {
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
          eligibleCount: 0,
          failedCount: 0,
          incompleteCount: 0,
        };
      }
      cohortsMap[cohortKey].count++;

      const eligibility = eligibilityMap.get(student.id);
      if (eligibility?.finalStatus === 'PASSED') {
        cohortsMap[cohortKey].eligibleCount++;
      } else if (eligibility?.finalStatus === 'FAILED') {
        cohortsMap[cohortKey].failedCount++;
      } else {
        cohortsMap[cohortKey].incompleteCount++;
      }
    }

    return Object.values(cohortsMap).sort((a, b) => {
      const gradeA = parseInt(a.gradeName.replace(/[^\d]/g, '')) || 0;
      const gradeB = parseInt(b.gradeName.replace(/[^\d]/g, '')) || 0;
      if (gradeA !== gradeB) return gradeA - gradeB;
      if (a.sectionName !== b.sectionName) return a.sectionName.localeCompare(b.sectionName);
      return (a.streamName || '').localeCompare(b.streamName || '');
    });
  }

  /**
   * Get individual students for a specific grade with authoritative academic status and eligibility details
   */
  async getStudentsByGrade(
    _schoolId: string | undefined,
    gradeId: string,
    sectionId?: string,
    streamId?: string,
    fromAcademicYear?: string
  ) {
    const students = await prisma.student.findMany({
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
        gradeId: true,
        sectionId: true,
        streamId: true,
        grade: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        stream: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const eligibilityMap = await this.evaluateStudentsAcademicEligibilityBatch(
      students.map((s) => s.id),
      fromAcademicYear
    );

    return students.map((student) => {
      const eligibility = eligibilityMap.get(student.id);
      return {
        ...student,
        finalStatus: eligibility?.finalStatus || 'INCOMPLETE',
        isEligible: eligibility?.isEligible || false,
        ineligibilityReason: eligibility?.ineligibilityReason || null,
        finalAverage: eligibility?.overallAverage || null,
        failedSubjectsCount: eligibility?.failedSubjectsCount || 0,
        incompleteSubjectsCount: eligibility?.incompleteSubjectsCount || 0,
        remarkBadge: eligibility?.remarkBadge || 'INCOMPLETE',
        reportCardStatus: eligibility?.reportCardStatus || null,
      };
    });
  }

  /**
   * Execute promotion for a list of students with strict backend validation:
   * - Only passed students can be promoted.
   * - Failed and incomplete students are blocked.
   * - Preserves historical academic and attendance records without deletion.
   */
  async promoteStudents(data: PromotionData, _schoolId: string | undefined, promotedByUserId: string) {
    let {
      studentIds,
      gradeId,
      sectionId,
      streamId,
      toGradeId,
      toSectionId,
      toSectionName,
      toStreamId,
      academicYear,
      fromAcademicYear,
      notes,
    } = data;

    let targetAcademicYearRecord = await prisma.academicYear.findUnique({
      where: { name: academicYear },
    });
    if (!targetAcademicYearRecord) {
      targetAcademicYearRecord = await academicYearService.getCurrentAcademicYear();
    }

    let sourceAcademicYearRecord = fromAcademicYear
      ? await prisma.academicYear.findUnique({ where: { name: fromAcademicYear } })
      : null;

    if (!sourceAcademicYearRecord) {
      sourceAcademicYearRecord = await academicYearService.getCurrentAcademicYear();
    }

    const isSelectiveMode = Array.isArray(studentIds) && studentIds.length > 0;

    if (!studentIds && (gradeId || sectionId || streamId)) {
      const students = await prisma.student.findMany({
        where: {
          ...(gradeId ? { gradeId } : {}),
          ...(sectionId ? { sectionId } : {}),
          ...(streamId ? { streamId: streamId === 'none' ? null : streamId } : {}),
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      studentIds = students.map((s) => s.id);
    }

    if (!studentIds || studentIds.length === 0) {
      throw new Error('No students selected for promotion');
    }

    // ─── Authoritative Academic Eligibility Check ─────────────────────────────
    const blockedStudents: Array<{
      studentId: string;
      fullName: string;
      finalStatus: string;
      reason: string;
    }> = [];

    const eligibleStudentIds: string[] = [];

    const eligibilityMap = await this.evaluateStudentsAcademicEligibilityBatch(
      studentIds,
      fromAcademicYear
    );

    for (const sid of studentIds) {
      const eligibility = eligibilityMap.get(sid);

      if (!eligibility || eligibility.finalStatus !== 'PASSED' || !eligibility.isEligible) {
        const studentName = eligibility?.fullName || sid;
        const studentStatus = eligibility?.finalStatus || 'INCOMPLETE';
        const studentReason = eligibility?.ineligibilityReason || 'Final academic status is not PASSED';

        blockedStudents.push({
          studentId: sid,
          fullName: studentName,
          finalStatus: studentStatus,
          reason: studentReason,
        });

        // In selective mode: user explicitly requested to promote this student. BLOCK IT with clear error!
        if (isSelectiveMode) {
          throw new Error(
            `Cannot promote "${studentName}": Final academic status is "${studentStatus}". ${studentReason}`
          );
        }
      } else {
        eligibleStudentIds.push(sid);
      }
    }

    // In bulk mode: only promote students who have passed!
    if (!isSelectiveMode) {
      if (eligibleStudentIds.length === 0) {
        const reasonSummary = blockedStudents
          .slice(0, 3)
          .map((b) => `${b.fullName} (${b.finalStatus}: ${b.reason})`)
          .join('; ');
        throw new Error(
          `No students in this cohort are eligible for promotion. All ${studentIds.length} students have FAILED or INCOMPLETE status. Examples: ${reasonSummary}`
        );
      }
      studentIds = eligibleStudentIds;
    }

    // ─── Duplicate Promotion Check ───────────────────────────────────────────
    const existingPromotions = await prisma.studentPromotion.findMany({
      where: {
        studentId: { in: studentIds },
        academicYear,
      },
      include: { student: { select: { fullName: true } } },
    });

    if (existingPromotions.length > 0) {
      if (isSelectiveMode) {
        const names = existingPromotions.map((p) => p.student.fullName).join(', ');
        throw new Error(
          `Duplicate promotion: Student(s) [${names}] have already been promoted for academic year ${academicYear}.`
        );
      }
      const duplicateSet = new Set(existingPromotions.map((p) => p.studentId));
      studentIds = studentIds.filter((id) => !duplicateSet.has(id));

      if (studentIds.length === 0) {
        throw new Error(
          `All students in this group have already been promoted for academic year ${academicYear}.`
        );
      }
    }

    // ─── Target Grade & Graduation Rules ──────────────────────────────────────
    const sampleStudents = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: { grade: true },
    });

    // Check if any student is currently in Grade 12
    const hasGrade12 = sampleStudents.some((s) => /\b12\b/.test(s.grade.name));

    // Grade 12 graduates cannot be promoted to a nonexistent Grade 13
    if (hasGrade12 && toGradeId !== 'GRADUATE') {
      toGradeId = 'GRADUATE';
    }

    if (toGradeId && toGradeId !== 'GRADUATE') {
      const toGrade = await prisma.grade.findUnique({ where: { id: toGradeId } });
      if (!toGrade) {
        throw new Error(`Target grade "${toGradeId}" does not exist.`);
      }

      // Check if promoting to the exact same grade
      const sameGradeStudent = sampleStudents.find((s) => s.gradeId === toGradeId);
      if (sameGradeStudent) {
        throw new Error(
          `Invalid promotion: Cannot promote ${sameGradeStudent.fullName} to the same grade (${toGrade.name}).`
        );
      }

      const toGradeNum = parseInt((toGrade.name || '').replace(/[^\d]/g, '')) || 0;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (toStreamId && !uuidRegex.test(toStreamId)) {
        const streamRecord = await prisma.stream.upsert({
          where: { name: toStreamId },
          create: { name: toStreamId },
          update: {},
        });
        toStreamId = streamRecord.id;
      }

      if (toGradeNum >= 11 && !toStreamId) {
        const sampleStudent = sampleStudents.find((s) => s.streamId);
        if (!sampleStudent?.streamId) {
          throw new Error('Stream assignment (Natural Science or Social Science) is required when promoting to Grade 11 or 12');
        }
      }

      if (toGradeNum > 0 && toGradeNum <= 10) {
        toStreamId = null as any;
      }
    }

    return await prisma.$transaction(async (tx) => {
      let toGrade: { id: string; name: string } | null = null;
      if (toGradeId && toGradeId !== 'GRADUATE') {
        toGrade = await tx.grade.findUnique({ where: { id: toGradeId }, select: { id: true, name: true } });
      }

      const toGradeNum = toGrade ? parseInt((toGrade.name || '').replace(/[^\d]/g, '')) || 0 : 0;
      const isSecondary = toGradeNum >= 11;

      let globalTargetSectionId = toSectionId || null;
      if (!globalTargetSectionId && toSectionName && toGradeId && toGradeId !== 'GRADUATE') {
        const secName = toSectionName.trim();
        let section = await tx.section.findFirst({
          where: {
            gradeId: toGradeId,
            streamId: toStreamId || null,
            name: { equals: secName, mode: 'insensitive' },
          },
        });
        if (!section) {
          section = await tx.section.create({
            data: {
              name: secName,
              gradeId: toGradeId,
              streamId: toStreamId || null,
            },
          });
        }
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
          const secName = student.section.name.trim();
          let section = await tx.section.findFirst({
            where: {
              gradeId: toGradeId,
              streamId: toStreamId || null,
              name: { equals: secName, mode: 'insensitive' },
            },
          });
          if (!section) {
            section = await tx.section.create({
              data: {
                name: secName,
                gradeId: toGradeId,
                streamId: toStreamId || null,
              },
            });
          }
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
              data: { status: 'PROMOTED' },
            }).catch(() => {});
          }

          if (targetAcademicYearRecord) {
            await tx.studentAcademicYearRecord.upsert({
              where: {
                studentId_academicYearId: {
                  studentId: student.id,
                  academicYearId: targetAcademicYearRecord.id,
                },
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
              },
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
            },
          }).catch(() => {});
        } else {
          await tx.student.update({
            where: { id: student.id },
            data: {
              status: 'GRADUATED',
            },
          });

          if (sourceAcademicYearRecord) {
            await tx.studentAcademicYearRecord.updateMany({
              where: { studentId: student.id, academicYearId: sourceAcademicYearRecord.id },
              data: { status: 'GRADUATED' },
            }).catch(() => {});
          }

          await tx.parentNotification.create({
            data: {
              studentId: student.id,
              type: 'GRADUATION',
              category: 'ACADEMIC',
              priority: 'HIGH',
              title: '🎓 Student Graduated',
              message: `${student.fullName} has successfully graduated for academic year ${academicYear}!`,
            },
          }).catch(() => {});
        }

        results.push(promotion);
      }

      // Attach blocked student metadata to result for detailed UI reporting
      (results as any).blockedStudents = blockedStudents;
      (results as any).blockedCount = blockedStudents.length;
      (results as any).promotedCount = results.length;

      return results;
    }, {
      maxWait: 10000,
      timeout: 60000,
    });
  }

  /**
   * Get promotion history for a school
   */
  async getPromotionHistory(_schoolId?: string, academicYear?: string) {
    return await prisma.studentPromotion.findMany({
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
  async rollbackPromotion(promotionId: string, _schoolId?: string) {
    return await prisma.$transaction(async (tx) => {
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

export const promotionService = new PromotionService();

