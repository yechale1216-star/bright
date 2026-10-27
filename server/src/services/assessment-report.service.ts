import prisma from '../config/db';
import { evaluateStudentPromotion, findGradeScale, GradingScaleItem, SubjectPeriodScores } from '../utils/report-card-promotion';

export type StandardReportCategory =
  | 'STUDENT_ACADEMIC'
  | 'CLASS_PERFORMANCE'
  | 'SUBJECT_PERFORMANCE'
  | 'GRADE_LEVEL'
  | 'PERFORMANCE_ANALYSIS'
  | 'SCHOOL_SUMMARY';

export interface AssessmentReportFilters {
  academicYearId?: string;
  academicTermId?: string;
  gradeId?: string;
  sectionId?: string;
  subjectId?: string;
  streamId?: string;
  studentId?: string;
  reportType?: string;
}

// Map legacy report type strings to standard categories
export function normalizeReportCategory(type?: string): StandardReportCategory {
  if (!type) return 'CLASS_PERFORMANCE';
  const upper = type.toUpperCase();
  if (upper === 'STUDENT_ACADEMIC') return 'STUDENT_ACADEMIC';
  if (upper === 'CLASS_PERFORMANCE' || upper === 'PARENT_REPORT') return 'CLASS_PERFORMANCE';
  if (upper === 'SUBJECT_PERFORMANCE' || upper === 'SUBJECT_COMPARISON') return 'SUBJECT_PERFORMANCE';
  if (upper === 'GRADE_LEVEL' || upper === 'GRADE_REPORT') return 'GRADE_LEVEL';
  if (upper === 'PERFORMANCE_ANALYSIS') return 'PERFORMANCE_ANALYSIS';

  if (upper === 'SCHOOL_SUMMARY') return 'SCHOOL_SUMMARY';
  return 'CLASS_PERFORMANCE';
}

export function getGradeScaleColor(grade: string, isPassing: boolean = true): string {
  if (!isPassing) return '#ef4444'; // Red is strictly for failed students
  const g = (grade || '').trim().toUpperCase();
  if (g.startsWith('F') || g.startsWith('E') || g.includes('FAIL') || g.includes('BELOW')) {
    return '#ef4444'; // Red is strictly for failed students
  }
  if (g === 'A+' || g === '90–100' || g === '90-100') return '#10b981'; // Emerald
  if (g.startsWith('A')) return '#22c55e'; // Green
  if (g === 'B+' || g === '80–89' || g === '80-89') return '#2563eb'; // Royal Blue
  if (g.startsWith('B')) return '#3b82f6'; // Sky Blue
  if (g === 'C+' || g === '70–79' || g === '70-79') return '#f59e0b'; // Amber
  if (g.startsWith('C') || g === '60–69' || g === '60-69') return '#eab308'; // Warm Yellow
  if (g.startsWith('D') || g === '50–59' || g === '50-59') return '#8b5cf6'; // Purple
  return '#06b6d4'; // Cyan
}

export class AssessmentReportService {
  /**
   * Aggregate assessment analytics and available reports for the filtered scope and standard category
   */
  async getAnalytics(filters: AssessmentReportFilters) {
    const {
      academicYearId,
      academicTermId,
      gradeId,
      sectionId,
      subjectId,
      streamId,
      studentId,
    } = filters;

    const category = normalizeReportCategory(filters.reportType);

    // 1. Fetch School Settings for Official Report Heading
    const schoolSettings = await prisma.schoolSettings.findFirst().catch(() => null);
    const schoolName = schoolSettings?.school_name || 'Bright Path School';

    // 2. Resolve Academic Year and Terms dynamically
    let targetYear = null;
    if (academicYearId && academicYearId !== 'all') {
      targetYear = await prisma.academicYear.findUnique({
        where: { id: academicYearId },
        include: { terms: { orderBy: { startDate: 'asc' } } },
      });
    }
    if (!targetYear) {
      targetYear =
        (await prisma.academicYear.findFirst({
          where: { isCurrent: true },
          include: { terms: { orderBy: { startDate: 'asc' } } },
        })) ||
        (await prisma.academicYear.findFirst({
          orderBy: { startDate: 'desc' },
          include: { terms: { orderBy: { startDate: 'asc' } } },
        }));
    }

    if (!targetYear) {
      return this.emptyAnalytics(schoolName);
    }
    const yearId = targetYear.id;
    const yearTerms = targetYear.terms || [];

    // For single-term reports, resolve selected term or default to first/current
    let selectedTerm = null;
    if (academicTermId && academicTermId !== 'all') {
      selectedTerm = yearTerms.find((t) => t.id === academicTermId) || null;
    }
    if (!selectedTerm && yearTerms.length > 0) {
      selectedTerm = yearTerms[0];
    }
    const termId = selectedTerm?.id || undefined;
    const termLabel = selectedTerm?.name || (yearTerms.length > 0 ? yearTerms[0].name : 'Term');

    // 3. Load School's Configured Grading Scales
    const dbGradingScales = await prisma.gradingScale.findMany({
      orderBy: { minScore: 'desc' },
    });

    const gradingScales: GradingScaleItem[] =
      dbGradingScales.length > 0
        ? dbGradingScales.map((gs) => ({
          grade: gs.grade,
          minScore: gs.minScore,
          maxScore: gs.maxScore,
          gpaPoint: gs.gpaPoint,
          description: gs.description,
          isPassing: gs.isPassing,
        }))
        : [
          { grade: 'A+', minScore: 90, maxScore: 100, gpaPoint: 4.0, description: 'Outstanding', isPassing: true },
          { grade: 'A', minScore: 85, maxScore: 89.99, gpaPoint: 4.0, description: 'Excellent', isPassing: true },
          { grade: 'B+', minScore: 80, maxScore: 84.99, gpaPoint: 3.5, description: 'Very Good', isPassing: true },
          { grade: 'B', minScore: 75, maxScore: 79.99, gpaPoint: 3.0, description: 'Good', isPassing: true },
          { grade: 'C+', minScore: 65, maxScore: 74.99, gpaPoint: 2.5, description: 'Satisfactory', isPassing: true },
          { grade: 'C', minScore: 60, maxScore: 64.99, gpaPoint: 2.0, description: 'Average', isPassing: true },
          { grade: 'D', minScore: 50, maxScore: 59.99, gpaPoint: 1.0, description: 'Passing', isPassing: true },
          { grade: 'F', minScore: 0, maxScore: 49.99, gpaPoint: 0.0, description: 'Failing', isPassing: false },
        ];

    const passingScaleItem = [...gradingScales].filter((s) => s.isPassing).sort((a, b) => a.minScore - b.minScore)[0];
    const policyPassingMinScore = passingScaleItem ? passingScaleItem.minScore : 50;

    // Distribution bands
    const distributionBandsConfig = gradingScales.map((gs) => ({
      name: `${gs.grade} (${gs.description || ''})`.trim(),
      rangeLabel: `${gs.minScore}–${gs.maxScore}`,
      minScore: gs.minScore,
      maxScore: gs.maxScore,
      color: getGradeScaleColor(gs.grade, gs.isPassing),
      isPassing: gs.isPassing,
    }));

    // 4. Query Active Students in Scope
    const studentWhere: any = {
      status: 'ACTIVE',
      ...(gradeId && gradeId !== 'all' ? { gradeId } : {}),
      ...(sectionId && sectionId !== 'all' ? { sectionId } : {}),
      ...(streamId && streamId !== 'all' ? { streamId } : {}),
      ...(studentId && studentId !== 'all' ? { id: studentId } : {}),
    };

    const activeStudents = await prisma.student.findMany({
      where: studentWhere,
      include: {
        grade: true,
        section: {
          include: { stream: true },
        },
        stream: true,
      },
      orderBy: [{ grade: { name: 'asc' } }, { section: { name: 'asc' } }, { fullName: 'asc' }],
    });

    const activeStudentIds = new Set(activeStudents.map((s) => s.id));

    // 5. Query Real Report Cards in Scope
    const reportCardWhere: any = {
      academicYearId: yearId,
      ...(termId ? { academicTermId: termId } : {}),
      ...(gradeId && gradeId !== 'all' ? { gradeId } : {}),
      ...(sectionId && sectionId !== 'all' ? { sectionId } : {}),
      ...(studentId && studentId !== 'all' ? { studentId } : {}),
      ...(activeStudentIds.size > 0 ? { studentId: { in: Array.from(activeStudentIds) } } : {}),
    };

    const reportCards = await prisma.reportCard.findMany({
      where: reportCardWhere,
      include: {
        subjectScores: {
          include: { subject: true },
        },
        student: {
          include: { grade: true, section: true, stream: true },
        },
        grade: true,
        section: true,
        academicTerm: true,
      },
    });

    // 6. Query Subjects in Scope
    const allSubjects = await prisma.subject.findMany({
      where: {
        isActive: true,
        ...(subjectId && subjectId !== 'all' ? { id: subjectId } : {}),
      },
      orderBy: { name: 'asc' },
    });

    // 7. Core Calculations & Evaluation per Student
    // Evaluate student completion and pass/fail accurately
    interface EvaluatedStudentRecord {
      student: any;
      termId: string;
      termName: string;
      subjectScores: Array<{
        subjectId: string;
        subjectName: string;
        code: string;
        score: number | null;
        maxScore: number;
        percentage: number | null;
        gradeLetter: string;
        isPassing: boolean;
        isAbsent?: boolean;
      }>;
      overallAverage: number | null;
      validAverage: number | null;
      gradeLetter: string;
      status: 'Passed' | 'Failed' | 'Incomplete';
      isComplete: boolean;
      missingSubjectsCount: number;
      failedSubjectsCount: number;
      rank?: number;
      conduct?: string;
      homeroomTeacherComment?: string;
    }

    const evaluatedStudentsMap = new Map<string, EvaluatedStudentRecord[]>();

    for (const s of activeStudents) {
      evaluatedStudentsMap.set(s.id, []);
    }

    // Process report cards into evaluated records
    for (const rc of reportCards) {
      const student = rc.student;
      if (!student) continue;

      const scoredSubjects: Array<{
        subjectId: string;
        subjectName: string;
        code: string;
        score: number | null;
        maxScore: number;
        percentage: number | null;
        gradeLetter: string;
        isPassing: boolean;
        isAbsent?: boolean;
      }> = [];

      let hasIncomplete = false;
      let missingCount = 0;
      let failedCount = 0;
      const validPercentages: number[] = [];

      for (const sc of rc.subjectScores) {
        if (subjectId && subjectId !== 'all' && sc.subjectId !== subjectId) continue;

        // Check if score is valid number (0 is valid!)
        const isScorePresent = sc.score !== null && sc.score !== undefined && typeof sc.score === 'number' && !isNaN(sc.score);

        if (!isScorePresent || sc.status === 'MISSING') {
          hasIncomplete = true;
          missingCount++;
          scoredSubjects.push({
            subjectId: sc.subjectId,
            subjectName: sc.subject?.name || 'Subject',
            code: sc.subject?.code || '',
            score: null,
            maxScore: sc.maxScore || 100,
            percentage: null,
            gradeLetter: 'INC',
            isPassing: false,
          });
        } else {
          const max = sc.maxScore > 0 ? sc.maxScore : 100;
          const pct = Math.round((sc.score / max) * 1000) / 10;
          validPercentages.push(pct);

          const scale = findGradeScale(pct, gradingScales, policyPassingMinScore);
          if (!scale.isPassing) {
            failedCount++;
          }

          scoredSubjects.push({
            subjectId: sc.subjectId,
            subjectName: sc.subject?.name || 'Subject',
            code: sc.subject?.code || '',
            score: sc.score,
            maxScore: max,
            percentage: pct,
            gradeLetter: scale.grade,
            isPassing: scale.isPassing,
          });
        }
      }

      // If student has no recorded subject scores in the report card, marked incomplete
      if (scoredSubjects.length === 0) {
        hasIncomplete = true;
      }

      let overallAvg: number | null = null;
      let gradeLetter = 'INC';
      let studentStatus: 'Passed' | 'Failed' | 'Incomplete' = 'Incomplete';

      const validAvg = validPercentages.length > 0
        ? Math.round((validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length) * 10) / 10
        : null;

      if (!hasIncomplete && validPercentages.length > 0) {
        overallAvg = validAvg;
        const finalScale = findGradeScale(overallAvg!, gradingScales, policyPassingMinScore);
        gradeLetter = finalScale.grade;
        studentStatus = finalScale.isPassing && failedCount === 0 ? 'Passed' : 'Failed';
      } else {
        studentStatus = 'Incomplete';
        gradeLetter = 'INC';
      }

      const evalRecord: EvaluatedStudentRecord = {
        student,
        termId: rc.academicTermId,
        termName: rc.academicTerm?.name || 'Term',
        subjectScores: scoredSubjects,
        overallAverage: overallAvg,
        validAverage: validAvg,
        gradeLetter,
        status: studentStatus,
        isComplete: !hasIncomplete,
        missingSubjectsCount: missingCount,
        failedSubjectsCount: failedCount,
        rank: rc.rank || undefined,
        conduct: rc.conduct || 'Good',
        homeroomTeacherComment: rc.homeroomTeacherComment || undefined,
      };

      if (!evaluatedStudentsMap.has(student.id)) {
        evaluatedStudentsMap.set(student.id, []);
      }
      evaluatedStudentsMap.get(student.id)!.push(evalRecord);
    }

    // 8. Build Aggregates for All 7 Categories

    // Helper: Completed students in current term
    const allRecordsForTerm = Array.from(evaluatedStudentsMap.values())
      .map((records) => records.find((r) => !termId || r.termId === termId) || null)
      .filter((r): r is EvaluatedStudentRecord => r !== null);

    const totalActiveCount = activeStudents.length;
    const completedRecords = allRecordsForTerm.filter((r) => r.isComplete && r.overallAverage !== null);
    const completeCount = completedRecords.length;
    const incompleteCount = totalActiveCount - completeCount;

    const completedAverages = completedRecords.map((r) => r.overallAverage!);
    const cohortAverage = completedAverages.length > 0
      ? Math.round((completedAverages.reduce((a, b) => a + b, 0) / completedAverages.length) * 10) / 10
      : 0;

    const passedCount = completedRecords.filter((r) => r.status === 'Passed').length;
    const failedCount = completedRecords.filter((r) => r.status === 'Failed').length;

    // Denominators strictly defined:
    // Pass/Fail percentages among students with completed results
    const passRate = completeCount > 0 ? Math.round((passedCount / completeCount) * 1000) / 10 : 0;
    const failRate = completeCount > 0 ? Math.round((failedCount / completeCount) * 1000) / 10 : 0;
    const completionRate = totalActiveCount > 0 ? Math.round((completeCount / totalActiveCount) * 1000) / 10 : 0;

    // Calculate Subject-level stats across all completed assessments
    const subjectStatsMap = new Map<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectCode: string;
        validScores: number[];
        passCount: number;
        failCount: number;
        incompleteCount: number;
        assessedStudents: Set<string>;
      }
    >();

    for (const sub of allSubjects) {
      subjectStatsMap.set(sub.id, {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code || sub.name.substring(0, 4).toUpperCase(),
        validScores: [],
        passCount: 0,
        failCount: 0,
        incompleteCount: 0,
        assessedStudents: new Set(),
      });
    }

    for (const rec of allRecordsForTerm) {
      for (const ss of rec.subjectScores) {
        if (!subjectStatsMap.has(ss.subjectId)) {
          subjectStatsMap.set(ss.subjectId, {
            subjectId: ss.subjectId,
            subjectName: ss.subjectName,
            subjectCode: ss.code || ss.subjectName.substring(0, 4).toUpperCase(),
            validScores: [],
            passCount: 0,
            failCount: 0,
            incompleteCount: 0,
            assessedStudents: new Set(),
          });
        }
        const sEntry = subjectStatsMap.get(ss.subjectId)!;
        sEntry.assessedStudents.add(rec.student.id);

        if (ss.percentage !== null) {
          sEntry.validScores.push(ss.percentage);
          if (ss.isPassing) sEntry.passCount++;
          else sEntry.failCount++;
        } else {
          sEntry.incompleteCount++;
        }
      }
    }

    const subjectPerformanceArray = Array.from(subjectStatsMap.values())
      .filter((s) => s.validScores.length > 0 || subjectId === s.subjectId || !subjectId || subjectId === 'all')
      .map((s) => {
        const avg = s.validScores.length > 0
          ? Math.round((s.validScores.reduce((a, b) => a + b, 0) / s.validScores.length) * 10) / 10
          : 0;
        const max = s.validScores.length > 0 ? Math.round(Math.max(...s.validScores)) : 0;
        const min = s.validScores.length > 0 ? Math.round(Math.min(...s.validScores)) : 0;
        const subPassRate = s.validScores.length > 0 ? Math.round((s.passCount / s.validScores.length) * 100) : 0;
        return {
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          subjectCode: s.subjectCode,
          averageScore: avg,
          studentCount: s.assessedStudents.size,
          highestScore: max,
          lowestScore: min,
          passRate: subPassRate,
          incompleteCount: s.incompleteCount,
          gradeName: 'Active Scope',
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);

    // Distribution of student averages across grading scale bands
    const distributionBands = distributionBandsConfig.map((band) => {
      const count = completedAverages.filter((avg) => avg >= band.minScore && avg <= band.maxScore).length;
      const percentage = completeCount > 0 ? Math.round((count / completeCount) * 100) : 0;
      return {
        ...band,
        count,
        percentage,
      };
    });

    // ─── Build Tailored Analytics Structure per Category ───────────────────────
    let summary: any;
    let chartPerformance: any[] = subjectPerformanceArray;
    let distribution: any = {
      totalResults: completeCount,
      bands: distributionBands,
    };
    let recommendations: string[] = [];
    let longitudinalTrends: any[] = [];

    switch (category) {
      case 'STUDENT_ACADEMIC': {
        const studentRecord = completedRecords[0] || allRecordsForTerm[0] || null;
        const studentAvg = studentRecord?.overallAverage ?? 0;
        const studentPassStatus = studentRecord?.status || 'Incomplete';

        summary = {
          card1Title: 'Student Status',
          card1Val: studentPassStatus,
          card1Sub: studentRecord?.isComplete ? 'All subjects assessed' : `${studentRecord?.missingSubjectsCount || 1} incomplete subjects`,
          card2Title: 'Overall Average',
          card2Val: studentRecord?.overallAverage !== null ? `${studentRecord?.overallAverage}%` : 'N/A',
          card2Sub: `Letter Grade: ${studentRecord?.gradeLetter || 'INC'}`,
          card3Title: 'Assessed Subjects',
          card3Val: studentRecord?.subjectScores?.length || 0,
          card3Sub: `${studentRecord?.failedSubjectsCount || 0} failing subjects`,
          card4Title: 'Class Rank',
          card4Val: studentRecord?.rank ? `#${studentRecord.rank}` : 'N/A',
          card4Sub: `Conduct: ${studentRecord?.conduct || 'Good'}`,
          chartTitle: 'Student Subject Marks Breakdown',
          chartSub: 'Percentage achievement in each curriculum subject',
        };

        if (studentRecord) {
          chartPerformance = studentRecord.subjectScores.map((ss) => ({
            subjectId: ss.subjectId,
            subjectName: ss.subjectName,
            subjectCode: ss.code,
            averageScore: ss.percentage ?? 0,
            studentCount: 1,
            highestScore: ss.percentage ?? 0,
            lowestScore: ss.percentage ?? 0,
            gradeName: ss.gradeLetter,
          }));
        }

        recommendations = studentRecord?.status === 'Passed'
          ? ['Student demonstrates sound mastery across evaluated subjects.', 'Recommended to maintain consistent study habits and participate in academic enrichment.']
          : studentRecord?.status === 'Failed'
            ? ['Provide targeted tutorial sessions in underperforming subjects.', 'Schedule an academic review meeting with parents to align on homework monitoring.']
            : ['Immediate priority: coordinate with teachers to administer missing assessment components to resolve Incomplete status.'];
        break;
      }

      case 'CLASS_PERFORMANCE': {
        const rangesConfig = [
          { code: '90–100', name: '90–100', min: 90, max: 100, color: '#22c55e' },
          { code: '80–89', name: '80–89', min: 80, max: 89.999, color: '#3b82f6' },
          { code: '70–79', name: '70–79', min: 70, max: 79.999, color: '#8b5cf6' },
          { code: '60–69', name: '60–69', min: 60, max: 69.999, color: '#fbbf24' },
          { code: '50–59', name: '50–59', min: 50, max: 59.999, color: '#f97316' },
          { code: 'Below 50', name: 'Below 50', min: 0, max: 49.999, color: '#ef4444' },
        ];

        const scoreRangePerformance = rangesConfig.map((rg) => {
          const matchingScores = completedAverages.filter((avg) => avg >= rg.min && avg <= rg.max);
          const count = matchingScores.length;
          const percentage = completeCount > 0 ? Math.round((count / completeCount) * 1000) / 10 : 0;
          return {
            subjectId: rg.code,
            subjectName: rg.name,
            subjectCode: rg.code,
            averageScore: percentage,
            studentCount: count,
            highestScore: matchingScores.length > 0 ? Math.round(Math.max(...matchingScores)) : 0,
            lowestScore: matchingScores.length > 0 ? Math.round(Math.min(...matchingScores)) : 0,
            passRate: rg.min >= policyPassingMinScore ? 100 : 0,
            color: rg.color,
            gradeName: 'Score Range',
          };
        });

        summary = {
          card1Title: 'Active Enrolled',
          card1Val: totalActiveCount,
          card1Sub: `${completeCount} completed results (${completionRate}%)`,
          card2Title: 'Class Average',
          card2Val: `${cohortAverage}%`,
          card2Sub: `Pass threshold: ${policyPassingMinScore}%`,
          card3Title: 'Passed Students',
          card3Val: `${passedCount} (${passRate}%)`,
          card3Sub: `${failedCount} Failed (${failRate}%)`,
          card4Title: 'Support Required',
          card4Val: `${failedCount + incompleteCount}`,
          card4Sub: `${failedCount} academic fail, ${incompleteCount} missing marks`,
          chartTitle: 'Student Performance by Score Range',
          chartSub: 'Number of students across performance score ranges',
        };

        chartPerformance = scoreRangePerformance;

        const atRiskRange = scoreRangePerformance.find((r) => r.subjectCode === 'Below 50');
        const topRange = scoreRangePerformance.find((r) => r.subjectCode === '90–100');
        recommendations = [
          topRange && topRange.studentCount > 0
            ? `${topRange.studentCount} student${topRange.studentCount > 1 ? 's' : ''} achieved excellence (90–100 range).`
            : 'Distribution of students across score ranges calculated from overall class performance.',
          atRiskRange && atRiskRange.studentCount > 0
            ? `${atRiskRange.studentCount} student${atRiskRange.studentCount > 1 ? 's' : ''} scored below 50% and require academic intervention.`
            : 'No students currently fall below the 50% passing threshold.',
        ];
        break;
      }

      case 'SUBJECT_PERFORMANCE': {
        // Compute per-student subject scores for the selected subject (or all subjects aggregated)
        const subjectScoresForDist: number[] = [];
        let subTotalValidStudents = 0;
        let subPassedCount = 0;
        let subFailedCount = 0;
        let subScoreSum = 0;
        let subHighestScore = 0;
        let subHighestGrade = '';

        for (const rec of allRecordsForTerm) {
          const relevantScores = rec.subjectScores.filter((ss) =>
            (!subjectId || subjectId === 'all' || ss.subjectId === subjectId) &&
            ss.percentage !== null
          );
          if (relevantScores.length === 0) continue;
          // Use average across relevant subject scores for this student
          const avg = relevantScores.reduce((a, b) => a + (b.percentage ?? 0), 0) / relevantScores.length;
          subjectScoresForDist.push(avg);
          subTotalValidStudents++;
          subScoreSum += avg;
          if (avg > subHighestScore) {
            subHighestScore = avg;
            const hs = findGradeScale(avg, gradingScales, policyPassingMinScore);
            subHighestGrade = hs.grade;
          }
          const scaleItem = findGradeScale(avg, gradingScales, policyPassingMinScore);
          if (scaleItem.isPassing) subPassedCount++;
          else subFailedCount++;
        }

        const subAvgScore = subTotalValidStudents > 0
          ? Math.round((subScoreSum / subTotalValidStudents) * 10) / 10
          : 0;
        const subPassRatePct = subTotalValidStudents > 0
          ? Math.round((subPassedCount / subTotalValidStudents) * 1000) / 10
          : 0;

        // Build grade-distribution chart: colors based on academic grade (red strictly for failing)
        const gradeDist = gradingScales.map((gs) => {
          const count = subjectScoresForDist.filter(
            (avg) => avg >= gs.minScore && avg <= gs.maxScore
          ).length;
          const pct = subTotalValidStudents > 0
            ? Math.round((count / subTotalValidStudents) * 1000) / 10
            : 0;
          const formattedRange = gs.minScore <= 0
            ? `Below ${Math.round(gs.maxScore + 1)}`
            : gs.maxScore >= 100
              ? `${Math.round(gs.minScore)} – 100`
              : `${Math.round(gs.minScore)} – ${Math.round(gs.maxScore)}`;

          return {
            subjectId: gs.grade,
            subjectName: gs.grade,
            subjectCode: gs.grade,
            scoreRange: formattedRange,
            averageScore: pct,   // re-used as "percentage" for bar height calc
            studentCount: count,
            highestScore: pct,
            lowestScore: pct,
            passRate: gs.isPassing ? 100 : 0,
            color: getGradeScaleColor(gs.grade, gs.isPassing),
            gradeName: gs.description || gs.grade,
            isPassing: gs.isPassing,
          };
        });

        let subjectName = 'All Subjects';
        if (subjectId && subjectId !== 'all') {
          const matchFromAll = allSubjects.find((s: any) => s.id === subjectId);
          const matchFromPerf = subjectPerformanceArray.find((s) => s.subjectId === subjectId);
          if (matchFromAll?.name) {
            subjectName = matchFromAll.name;
          } else if (matchFromPerf?.subjectName) {
            subjectName = matchFromPerf.subjectName;
          } else {
            subjectName = 'Selected Subject';
          }
        }

        const scaleRangeLabel = gradingScales.length > 0
          ? `(${gradingScales[0].grade}–${gradingScales[gradingScales.length - 1].grade})`
          : '(A–F)';

        summary = {
          card1Title: 'Total Students',
          card1Val: subTotalValidStudents,
          card1Sub: 'with valid results',
          card2Title: 'Subject Average',
          card2Val: `${subAvgScore}`,
          card2Sub: 'out of 100',
          card3Title: 'Highest Grade',
          card3Val: subHighestGrade || (subTotalValidStudents > 0 ? gradingScales[0]?.grade || 'N/A' : 'N/A'),
          card3Sub: subHighestGrade ? `(${gradeDist.find(g => g.subjectName === subHighestGrade)?.scoreRange || ''})` : 'No results',
          card4Title: 'Pass Rate',
          card4Val: `${subPassRatePct}%`,
          card4Sub: `(${subPassedCount} of ${subTotalValidStudents})`,
          // Extra fields for 6-card UI
          card5Title: 'Passed',
          card5Val: subPassedCount,
          card5Sub: 'students',
          card6Title: 'Failed',
          card6Val: subFailedCount,
          card6Sub: 'students',
          chartTitle: `Student Grade Distribution — ${subjectName}`,
          chartSub: `Based on school grading policy ${scaleRangeLabel}.`,
        };

        chartPerformance = gradeDist;
        recommendations = [
          `Subject pass rate: ${subPassRatePct}% (${subPassedCount} of ${subTotalValidStudents} students passed).`,
          subPassRatePct < 70
            ? 'Curriculum review and remedial sessions are recommended for underperforming students.'
            : 'Students demonstrate satisfactory mastery of evaluated learning objectives.',
        ];
        break;
      }

      case 'GRADE_LEVEL': {
        const isAllGrades = !gradeId || gradeId === 'all';

        if (isAllGrades) {
          // Scope: All Grades -> Group by Grade (e.g., Grade 9, Grade 10, Grade 11, Grade 12)
          const allSchoolGrades = await prisma.grade.findMany({
            orderBy: { name: 'asc' },
            include: {
              sections: {
                include: { stream: true },
              },
            },
          });

          // Sort naturally (Grade 1, Grade 2, ... Grade 9, Grade 10, Grade 11, Grade 12)
          const sortedGrades = [...allSchoolGrades].sort((a, b) => {
            const numA = parseInt(a.name.replace(/\D/g, ''), 10);
            const numB = parseInt(b.name.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
          });

          const gradeComparisonList = sortedGrades.map((g) => {
            // Find students in this grade (respecting streamId if stream filter was provided)
            const gStudents = activeStudents.filter((s) => s.gradeId === g.id);
            const gStudentScores: number[] = [];

            for (const s of gStudents) {
              const records = evaluatedStudentsMap.get(s.id) || [];
              const termRec = records.find((r) => !termId || r.termId === termId);
              // Handle missing/incomplete results correctly without treating them as zero
              const score = termRec?.validAverage ?? null;
              if (score !== null && typeof score === 'number' && !isNaN(score)) {
                gStudentScores.push(score);
              }
            }

            const avg = gStudentScores.length > 0
              ? Math.round((gStudentScores.reduce((a, b) => a + b, 0) / gStudentScores.length) * 10) / 10
              : 0;
            const highest = gStudentScores.length > 0 ? Math.round(Math.max(...gStudentScores)) : 0;
            const lowest = gStudentScores.length > 0 ? Math.round(Math.min(...gStudentScores)) : 0;

            return {
              subjectId: g.id,
              subjectName: g.name,
              subjectCode: g.name,
              averageScore: avg,
              studentCount: gStudentScores.length,
              highestScore: highest,
              lowestScore: lowest,
              gradeName: 'Grade Level',
            };
          });

          // Summary metrics: Essential comparison information only
          const evaluatedGrades = gradeComparisonList.filter((g) => g.studentCount > 0 && g.averageScore > 0);
          let highestGrade = null;
          let lowestGrade = null;
          let overallAverage = 0;

          if (evaluatedGrades.length > 0) {
            const sortedByScore = [...evaluatedGrades].sort((a, b) => b.averageScore - a.averageScore);
            highestGrade = sortedByScore[0];
            lowestGrade = sortedByScore[sortedByScore.length - 1];
            overallAverage = Math.round((sortedByScore.reduce((acc, it) => acc + it.averageScore, 0) / sortedByScore.length) * 10) / 10;
          }

          summary = {
            card1Title: 'Average Academic Performance',
            card1Val: `${overallAverage}%`,
            card1Sub: `Mean across ${evaluatedGrades.length} evaluated grades`,
            card2Title: 'Highest-Performing Grade',
            card2Val: highestGrade ? highestGrade.subjectName : 'N/A',
            card2Sub: highestGrade ? `${highestGrade.averageScore}% benchmark average` : 'No valid data',
            card3Title: 'Lowest-Performing Grade',
            card3Val: lowestGrade ? lowestGrade.subjectName : 'N/A',
            card3Sub: lowestGrade ? `${lowestGrade.averageScore}% benchmark average` : 'No valid data',
            card4Title: 'Overall Average',
            card4Val: `${overallAverage}%`,
            card4Sub: highestGrade && lowestGrade
              ? `Performance range: ${lowestGrade.averageScore}% – ${highestGrade.averageScore}%`
              : 'School-wide grade comparison',
            chartTitle: 'Grade-Level Academic Performance Comparison',
            chartSub: 'Average academic performance percentage across all grades',
          };

          chartPerformance = gradeComparisonList;
          recommendations = highestGrade && lowestGrade
            ? [
                `${highestGrade.subjectName} is the highest-performing grade at ${highestGrade.averageScore}%, while ${lowestGrade.subjectName} is lowest at ${lowestGrade.averageScore}%.`,
                `Overall academic performance average across evaluated grades stands at ${overallAverage}%.`,
              ]
            : [
                'High-level visual comparison of academic performance across grades.',
                'No published assessment marks recorded in the selected scope.',
              ];
        } else {
          // Scope: Specific Grade -> Group by sections within that grade
          const selectedGradeObj = await prisma.grade.findUnique({
            where: { id: gradeId },
            include: {
              sections: {
                where: streamId && streamId !== 'all' ? { streamId } : {},
                include: { stream: true },
                orderBy: { name: 'asc' },
              },
            },
          });

          const targetGradeName = selectedGradeObj?.name || 'Grade';
          const isSenior = targetGradeName.toLowerCase().includes('11') || targetGradeName.toLowerCase().includes('12');

          const streamObj = streamId && streamId !== 'all'
            ? await prisma.stream.findUnique({ where: { id: streamId } }).catch(() => null)
            : null;

          const gradeSections = selectedGradeObj?.sections || [];
          const sortedSections = [...gradeSections].sort((a: any, b: any) =>
            (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
          );

          const sectionComparisonList = sortedSections.map((sec: any) => {
            const secStudents = activeStudents.filter((s) => s.sectionId === sec.id);
            const secStudentScores: number[] = [];

            for (const s of secStudents) {
              const records = evaluatedStudentsMap.get(s.id) || [];
              const termRec = records.find((r) => !termId || r.termId === termId);
              // Handle missing/incomplete results correctly without treating them as zero
              const score = termRec?.validAverage ?? null;
              if (score !== null && typeof score === 'number' && !isNaN(score)) {
                secStudentScores.push(score);
              }
            }

            const avg = secStudentScores.length > 0
              ? Math.round((secStudentScores.reduce((a, b) => a + b, 0) / secStudentScores.length) * 10) / 10
              : 0;
            const highest = secStudentScores.length > 0 ? Math.round(Math.max(...secStudentScores)) : 0;
            const lowest = secStudentScores.length > 0 ? Math.round(Math.min(...secStudentScores)) : 0;

            const streamName = sec.stream?.name || (secStudents.find((s) => s.stream?.name)?.stream?.name);
            let displayName = `Section ${sec.name}`;
            let displayCode = `Sec ${sec.name}`;

            if (isSenior && streamName) {
              displayName = `Section ${sec.name} (${streamName})`;
              const streamShort = streamName.includes('Natural') ? 'Nat' : streamName.includes('Social') ? 'Soc' : streamName.split(' ')[0];
              displayCode = `Sec ${sec.name} (${streamShort})`;
            }

            return {
              subjectId: sec.id,
              subjectName: displayName,
              subjectCode: displayCode,
              averageScore: avg,
              studentCount: secStudentScores.length,
              highestScore: highest,
              lowestScore: lowest,
              gradeName: targetGradeName,
            };
          });

          // Summary metrics: Essential comparison information only
          const evaluatedSections = sectionComparisonList.filter((s) => s.studentCount > 0 && s.averageScore > 0);
          let highestSection = null;
          let lowestSection = null;
          let overallAverage = 0;

          if (evaluatedSections.length > 0) {
            const sortedByScore = [...evaluatedSections].sort((a, b) => b.averageScore - a.averageScore);
            highestSection = sortedByScore[0];
            lowestSection = sortedByScore[sortedByScore.length - 1];
            overallAverage = Math.round((sortedByScore.reduce((acc, it) => acc + it.averageScore, 0) / sortedByScore.length) * 10) / 10;
          }

          const streamScopeLabel = streamObj?.name ? ` (${streamObj.name})` : '';

          summary = {
            card1Title: 'Average Academic Performance',
            card1Val: `${overallAverage}%`,
            card1Sub: `Mean across ${evaluatedSections.length} evaluated sections`,
            card2Title: 'Highest-Performing Section',
            card2Val: highestSection ? highestSection.subjectName : 'N/A',
            card2Sub: highestSection ? `${highestSection.averageScore}% benchmark average` : 'No valid data',
            card3Title: 'Lowest-Performing Section',
            card3Val: lowestSection ? lowestSection.subjectName : 'N/A',
            card3Sub: lowestSection ? `${lowestSection.averageScore}% benchmark average` : 'No valid data',
            card4Title: 'Overall Average',
            card4Val: `${overallAverage}%`,
            card4Sub: highestSection && lowestSection
              ? `Performance range: ${lowestSection.averageScore}% – ${highestSection.averageScore}%`
              : `${targetGradeName} sections comparison`,
            chartTitle: `${targetGradeName} Section Performance Comparison`,
            chartSub: `Comparing average academic performance of sections within ${targetGradeName}${streamScopeLabel}`,
          };

          chartPerformance = sectionComparisonList;
          recommendations = highestSection && lowestSection
            ? [
                `${highestSection.subjectName} is the highest-performing section at ${highestSection.averageScore}%, while ${lowestSection.subjectName} is lowest at ${lowestSection.averageScore}%.`,
                `Overall academic performance average across evaluated sections in ${targetGradeName} stands at ${overallAverage}%.`,
              ]
            : [
                `High-level visual comparison of section performance in ${targetGradeName}.`,
                'No published assessment marks recorded in the selected scope.',
              ];
        }
        break;
      }

      case 'PERFORMANCE_ANALYSIS': {
        const masteryCount = completedAverages.filter((avg) => avg >= 80).length;
        const atRiskCount = completedAverages.filter((avg) => avg < policyPassingMinScore).length;
        const masteryRate = completeCount > 0 ? Math.round((masteryCount / completeCount) * 100) : 0;

        summary = {
          card1Title: 'Evaluated Students',
          card1Val: completeCount,
          card1Sub: `Out of ${totalActiveCount} active enrolled`,
          card2Title: 'Cohort Mean',
          card2Val: `${cohortAverage}%`,
          card2Sub: 'Standard academic index',
          card3Title: 'Mastery Level (≥80%)',
          card3Val: `${masteryCount} (${masteryRate}%)`,
          card3Sub: 'High achievement tier',
          card4Title: 'At-Risk (<50%)',
          card4Val: `${atRiskCount}`,
          card4Sub: 'Academic intervention candidates',
          chartTitle: 'Academic Mastery & Competency Tiers',
          chartSub: 'Student distribution across achievement grade bands',
        };

        chartPerformance = distributionBands.map((band) => ({
          subjectId: band.name,
          subjectName: band.name,
          subjectCode: band.rangeLabel,
          averageScore: band.percentage,
          studentCount: band.count,
          highestScore: Math.round(band.maxScore),
          lowestScore: Math.round(band.minScore),
          gradeName: 'School-Wide',
        }));

        recommendations = [
          `${masteryCount} students (${masteryRate}%) demonstrate advanced mastery and are candidates for academic honours.`,
          `${atRiskCount} students scored below passing threshold; differentiated teaching plans and parent conferences are advised.`,
        ];
        break;
      }


      case 'SCHOOL_SUMMARY':
      default: {
        // High-level school-wide academic executive summary
        summary = {
          card1Title: 'Total Active Students',
          card1Val: totalActiveCount,
          card1Sub: `${completeCount} complete academic records`,
          card2Title: 'School Academic Average',
          card2Val: `${cohortAverage}%`,
          card2Sub: 'Institutional benchmark index',
          card3Title: 'School Pass Rate',
          card3Val: `${passRate}%`,
          card3Sub: `Among complete records`,
          card4Title: 'Incomplete Rate',
          card4Val: `${totalActiveCount > 0 ? Math.round((incompleteCount / totalActiveCount) * 100) : 0}%`,
          card4Sub: `${incompleteCount} active students with pending marks`,
          chartTitle: 'Institutional Subject Performance',
          chartSub: 'School-wide curriculum averages across active subjects',
        };

        chartPerformance = subjectPerformanceArray;
        recommendations = [
          `Institutional academic performance benchmark stands at ${cohortAverage}%.`,
          'Executive oversight: maintain monitoring of incomplete assessment submissions across grade heads.',
        ];
        break;
      }
    }

    // 9. Generate Catalog of Available Reports Matching the Selected Category
    const availableReports = await this.generateAvailableReportsCatalog({
      schoolName,
      yearName: targetYear.name,
      yearId: targetYear.id,
      termId,
      termName: termLabel,
      gradeId,
      sectionId,
      subjectId,
      streamId,
      studentId,
      category,
      activeStudents,
      completedRecords,
      subjectPerformanceArray,
      cohortAverage,
    });

    return {
      schoolInfo: {
        name: schoolName,
        academicYear: targetYear.name,
        term: termLabel,
      },
      summary,
      subjectPerformance: chartPerformance,
      distribution,
      recommendations,
      availableReports,
    };
  }

  /**
   * Catalog generator for reports matching the standard category
   */
  private async generateAvailableReportsCatalog(params: {
    schoolName: string;
    yearName: string;
    yearId: string;
    termId?: string;
    termName: string;
    gradeId?: string;
    sectionId?: string;
    subjectId?: string;
    streamId?: string;
    studentId?: string;
    category: StandardReportCategory;
    activeStudents: any[];
    completedRecords: any[];
    subjectPerformanceArray: any[];
    cohortAverage: number;
  }) {
    const {
      yearName,
      termName,
      gradeId,
      sectionId,
      subjectId,
      category,
      activeStudents,
      completedRecords,
      subjectPerformanceArray,
      cohortAverage,
    } = params;

    const grades = await prisma.grade.findMany({
      where: gradeId && gradeId !== 'all' ? { id: gradeId } : {},
      include: {
        sections: sectionId && sectionId !== 'all' ? { where: { id: sectionId } } : true,
      },
      orderBy: { name: 'asc' },
    });

    const nowFormatted = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const catalog: any[] = [];

    // Category A: STUDENT_ACADEMIC
    if (category === 'STUDENT_ACADEMIC') {
      const targetList = params.studentId && params.studentId !== 'all'
        ? activeStudents.filter((s) => s.id === params.studentId)
        : activeStudents.slice(0, 50);

      for (const s of targetList) {
        const matchingRecord = completedRecords.find((r) => r.student.id === s.id);
        const avg = matchingRecord?.overallAverage ?? 0;
        catalog.push({
          id: `stud_${s.id}`,
          reportName: `${s.fullName} - Student Academic Report`,
          type: 'Student Academic Report',
          typeKey: 'STUDENT_ACADEMIC',
          academicYear: yearName,
          term: termName,
          grade: s.grade?.name || 'Grade',
          subjectOrStream: s.stream?.name || (s.section?.name ? `Section ${s.section.name}` : 'General'),
          generatedOn: nowFormatted,
          averageScore: avg,
          studentCount: 1,
        });
      }
      return catalog;
    }

    // Category B: CLASS_PERFORMANCE
    if (category === 'CLASS_PERFORMANCE') {
      for (const g of grades) {
        for (const s of g.sections) {
          const sectionStudents = activeStudents.filter((st) => st.sectionId === s.id);
          const sectionCompleted = completedRecords.filter((r) => r.student.sectionId === s.id);
          const avg = sectionCompleted.length > 0
            ? Math.round((sectionCompleted.reduce((acc, r) => acc + (r.overallAverage || 0), 0) / sectionCompleted.length) * 10) / 10
            : 0;

          catalog.push({
            id: `class_${g.id}_${s.id}`,
            reportName: `${g.name} (Section ${s.name}) - Class Academic Performance Report`,
            type: 'Class Academic Performance',
            typeKey: 'CLASS_PERFORMANCE',
            academicYear: yearName,
            term: termName,
            grade: g.name,
            subjectOrStream: `Section ${s.name}`,
            generatedOn: nowFormatted,
            averageScore: avg,
            studentCount: sectionStudents.length,
          });
        }
      }
      return catalog;
    }

    // Category C: SUBJECT_PERFORMANCE
    if (category === 'SUBJECT_PERFORMANCE') {
      for (const sp of subjectPerformanceArray) {
        if (subjectId && subjectId !== 'all' && sp.subjectId !== subjectId) continue;
        catalog.push({
          id: `subj_${sp.subjectId}_${gradeId || 'all'}_${sectionId || 'all'}`,
          reportName: `${sp.subjectName} (${sp.subjectCode}) - Subject Performance Report`,
          type: 'Subject Performance',
          typeKey: 'SUBJECT_PERFORMANCE',
          academicYear: yearName,
          term: termName,
          grade: gradeId && gradeId !== 'all' ? (grades.find((g) => g.id === gradeId)?.name || 'Grade') : 'All Grades',
          subjectOrStream: `${sp.subjectName} (${sp.subjectCode})`,
          generatedOn: nowFormatted,
          averageScore: sp.averageScore,
          studentCount: sp.studentCount,
        });
      }
      return catalog;
    }

    // Category D: GRADE_LEVEL
    if (category === 'GRADE_LEVEL') {
      // Grade-Level is a generalized comparison report with visual charts and summary insights only.
      // It does not produce individual student-level reports or detail drill-down tables.
      return [];
    }

    // Category E: PERFORMANCE_ANALYSIS
    if (category === 'PERFORMANCE_ANALYSIS') {
      for (const g of grades) {
        catalog.push({
          id: `perf_${g.id}`,
          reportName: `${g.name} - Academic Performance Analysis & Trend Review`,
          type: 'Academic Performance Analysis',
          typeKey: 'PERFORMANCE_ANALYSIS',
          academicYear: yearName,
          term: termName,
          grade: g.name,
          subjectOrStream: 'Curriculum Trends & Support Priorities',
          generatedOn: nowFormatted,
          averageScore: cohortAverage,
          studentCount: activeStudents.filter((s) => s.gradeId === g.id).length,
        });
      }
      return catalog;
    }


    // Category G: SCHOOL_SUMMARY
    catalog.push({
      id: `school_summary_${yearName.replace(/\s+/g, '_')}`,
      reportName: `${yearName} - School Academic Summary`,
      type: 'School Academic Summary',
      typeKey: 'SCHOOL_SUMMARY',
      academicYear: yearName,
      term: termName,
      grade: 'All Grades (K-12)',
      subjectOrStream: 'Institution-Wide Academic Standing',
      generatedOn: nowFormatted,
      averageScore: cohortAverage,
      studentCount: activeStudents.length,
    });

    return catalog;
  }

  /**
   * Detailed breakdown for modal inspection, print view, and CSV export
   */
  async getDetailedReport(reportId: string, filters: AssessmentReportFilters) {
    const analytics = await this.getAnalytics(filters);
    const reportItem =
      analytics.availableReports.find((r) => r.id === reportId) ||
      analytics.availableReports[0] || {
        id: reportId,
        reportName: 'Academic Report Details',
        type: 'Academic Report',
        academicYear: analytics.schoolInfo.academicYear,
        term: analytics.schoolInfo.term,
        grade: 'All Grades',
        subjectOrStream: 'General',
        averageScore: 0,
        studentCount: 0,
      };

    const parts = reportId.split('_');
    const prefix = parts[0]; // stud | class | subj | grade | perf | annual | school

    let targetGradeId = filters.gradeId && filters.gradeId !== 'all' ? filters.gradeId : undefined;
    let targetSectionId = filters.sectionId && filters.sectionId !== 'all' ? filters.sectionId : undefined;
    let targetSubjectId = filters.subjectId && filters.subjectId !== 'all' ? filters.subjectId : undefined;
    let targetStudentId = filters.studentId && filters.studentId !== 'all' ? filters.studentId : undefined;

    if (prefix === 'stud') {
      targetStudentId = parts[1] || targetStudentId;
    } else if (prefix === 'class') {
      targetGradeId = parts[1] || targetGradeId;
      targetSectionId = parts[2] || targetSectionId;
    } else if (prefix === 'subj') {
      targetSubjectId = parts[1] || targetSubjectId;
      if (parts[2] && parts[2] !== 'all') targetGradeId = parts[2];
      if (parts[3] && parts[3] !== 'all') targetSectionId = parts[3];
    } else if (prefix === 'grade' || prefix === 'perf' || prefix === 'annual') {
      targetGradeId = parts[1] || targetGradeId;
    }

    // Query Students
    const enrolledStudents = await prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        ...(targetGradeId ? { gradeId: targetGradeId } : {}),
        ...(targetSectionId ? { sectionId: targetSectionId } : {}),
        ...(targetStudentId ? { id: targetStudentId } : {}),
      },
      include: { grade: true, section: true, stream: true },
      orderBy: [{ grade: { name: 'asc' } }, { section: { name: 'asc' } }, { fullName: 'asc' }],
    });

    const enrolledIds = enrolledStudents.map((s) => s.id);

    // Query Real Report Cards
    const reportCards = await prisma.reportCard.findMany({
      where: {
        academicYearId: filters.academicYearId && filters.academicYearId !== 'all' ? filters.academicYearId : undefined,
        ...(filters.academicTermId && filters.academicTermId !== 'all' && prefix !== 'annual' ? { academicTermId: filters.academicTermId } : {}),
        ...(targetGradeId ? { gradeId: targetGradeId } : {}),
        ...(targetSectionId ? { sectionId: targetSectionId } : {}),
        ...(enrolledIds.length > 0 ? { studentId: { in: enrolledIds } } : {}),
      },
      include: {
        subjectScores: { include: { subject: true } },
        student: { include: { grade: true, section: true, stream: true } },
        grade: true,
        section: true,
        academicTerm: true,
      },
      orderBy: { averageScore: 'desc' },
    });

    // Load Grading Scale
    const dbScales = await prisma.gradingScale.findMany({ orderBy: { minScore: 'desc' } });
    const gradingScales: GradingScaleItem[] = dbScales.length > 0
      ? dbScales.map((s) => ({ grade: s.grade, minScore: s.minScore, maxScore: s.maxScore, gpaPoint: s.gpaPoint, isPassing: s.isPassing, description: s.description }))
      : [
        { grade: 'A+', minScore: 90, maxScore: 100, isPassing: true },
        { grade: 'A', minScore: 85, maxScore: 89.99, isPassing: true },
        { grade: 'B', minScore: 75, maxScore: 84.99, isPassing: true },
        { grade: 'C', minScore: 60, maxScore: 74.99, isPassing: true },
        { grade: 'D', minScore: 50, maxScore: 59.99, isPassing: true },
        { grade: 'F', minScore: 0, maxScore: 49.99, isPassing: false },
      ];
    const passThreshold = gradingScales.find((s) => s.isPassing)?.minScore ?? 50;

    let studentRows: any[] = [];

    // ─── Case 1: STUDENT_ACADEMIC ───────────────────────────────────────────
    if (prefix === 'stud') {
      const student = enrolledStudents[0];
      const rc = reportCards.find((r) => r.studentId === student?.id);

      if (student && rc) {
        studentRows = rc.subjectScores.map((sc, idx) => {
          const max = sc.maxScore > 0 ? sc.maxScore : 100;
          const score = sc.score;
          const pct = Math.round((score / max) * 1000) / 10;
          const scale = findGradeScale(pct, gradingScales, passThreshold);

          return {
            id: sc.id || `${student.id}_${sc.subjectId}`,
            studentId: student.student_id,
            fullName: student.fullName,
            gender: student.gender || 'M',
            grade: rc.grade?.name || student.grade?.name,
            section: rc.section?.name || student.section?.name,
            stream: student.stream?.name || 'N/A',
            subjectName: sc.subject?.name || 'Subject',
            subjectCode: sc.subject?.code || '',
            score,
            maxScore: max,
            percentage: pct,
            gradeLetter: scale.grade,
            status: scale.isPassing ? 'Passed' : 'Failed',
            teacherRemarks: sc.teacherRemarks || 'Satisfactory work',
            rank: idx + 1,
          };
        });
      }
    }

    // ─── Case 3: SUBJECT_PERFORMANCE ────────────────────────────────────────
    else if (prefix === 'subj' && targetSubjectId) {
      studentRows = reportCards.map((rc) => {
        const sc = rc.subjectScores.find((s) => s.subjectId === targetSubjectId);
        const max = sc?.maxScore && sc.maxScore > 0 ? sc.maxScore : 100;
        const isPresent = sc && sc.score !== null && sc.score !== undefined && sc.status !== 'MISSING';
        const score = isPresent ? sc!.score : 0;
        const pct = isPresent ? Math.round((score / max) * 1000) / 10 : 0;
        const scale = findGradeScale(pct, gradingScales, passThreshold);

        return {
          id: rc.student.id,
          studentId: rc.student.student_id,
          fullName: rc.student.fullName,
          gender: rc.student.gender || 'M',
          grade: rc.grade?.name || rc.student.grade?.name || 'Grade',
          section: rc.section?.name || rc.student.section?.name || 'A',
          stream: rc.student.stream?.name || 'General',
          score: isPresent ? score : null,
          maxScore: max,
          percentage: isPresent ? pct : null,
          gradeLetter: isPresent ? scale.grade : 'INC',
          status: !isPresent ? 'Incomplete' : (scale.isPassing ? 'Passed' : 'Failed'),
          supportNeeded: !isPresent || !scale.isPassing,
        };
      }).sort((a, b) => (b.percentage || 0) - (a.percentage || 0)).map((r, i) => ({ ...r, rank: i + 1 }));
    }
    // ─── Case 4: GRADE_LEVEL (Generalized High-Level Scope, No Student Rows) ──
    else if (prefix === 'grade' || filters.reportType === 'GRADE_LEVEL') {
      studentRows = [];
    }
    // ─── Case 5: CLASS_PERFORMANCE ──────────────────────────────────────────
    else {
      studentRows = reportCards.map((rc, idx) => {
        const avg = Number(rc.averageScore || 0);
        const scale = findGradeScale(avg, gradingScales, passThreshold);
        const hasMissing = rc.subjectScores.some((s) => s.score === null || s.status === 'MISSING') || rc.subjectScores.length === 0;

        return {
          id: rc.student.id,
          studentId: rc.student.student_id,
          fullName: rc.student.fullName,
          gender: rc.student.gender || 'M',
          grade: rc.grade?.name || rc.student.grade?.name || 'Grade',
          section: rc.section?.name || rc.student.section?.name || 'A',
          stream: rc.student.stream?.name || 'General',
          score: avg,
          maxScore: 100,
          percentage: avg,
          gradeLetter: hasMissing ? 'INC' : scale.grade,
          status: hasMissing ? 'Incomplete' : (scale.isPassing ? 'Passed' : 'Failed'),
          conduct: rc.conduct || 'Good',
          rank: rc.rank || idx + 1,
          recommendation: hasMissing
            ? 'Complete missing assessment papers'
            : scale.isPassing
              ? 'Maintain commendable standard'
              : 'Targeted tutorial support needed',
        };
      }).sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
    }

    return {
      schoolInfo: analytics.schoolInfo,
      report: reportItem,
      analyticsSummary: analytics.summary,
      subjectPerformance: analytics.subjectPerformance,
      distribution: analytics.distribution,
      studentRows,
      recommendations: analytics.recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  private emptyAnalytics(schoolName: string) {
    return {
      schoolInfo: {
        name: schoolName,
        academicYear: 'Current Academic Year',
        term: 'All Terms',
      },
      summary: {
        card1Title: 'Total Active Students',
        card1Val: 0,
        card1Sub: 'No records found',
        card2Title: 'Cohort Average',
        card2Val: '0%',
        card2Sub: 'Benchmark',
        card3Title: 'Passed Students',
        card3Val: 0,
        card3Sub: '0% Pass Rate',
        card4Title: 'Support Required',
        card4Val: 0,
        card4Sub: '0 Incomplete / At-risk',
        chartTitle: 'Performance Overview',
        chartSub: 'No assessment data recorded for this scope',
      },
      subjectPerformance: [],
      distribution: {
        totalResults: 0,
        bands: [],
      },
      recommendations: ['No assessment records found for the selected scope.'],
      availableReports: [],
    };
  }
}

export const assessmentReportService = new AssessmentReportService();
