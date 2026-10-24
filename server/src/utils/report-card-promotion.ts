/**
 * Authoritative Report Card Promotion & Pass/Fail Evaluation Engine
 * 
 * Rules:
 * - Incomplete: If any required assessment or term mark is missing (null/undefined), 
 *   flag as INCOMPLETE and do not allow the student to pass or be promoted.
 * - Zero (0): Valid recorded mark (number 0), NOT missing. 
 *   Calculate the result normally; the student passes or fails according to school rules.
 * - Complete: Only determine PASS/FAIL and promotion status after all required marks are recorded.
 */

export interface GradingScaleItem {
  grade: string;
  minScore: number;
  maxScore: number;
  gpaPoint?: number | null;
  isPassing: boolean;
  description?: string | null;
}

export interface SubjectPeriodScores {
  subjectId: string;
  subjectName: string;
  code?: string;
  // periodId -> score. A score of 0 is a valid number! null/undefined means MISSING.
  scores: Record<string, number | null | undefined>;
}

export interface PromotionEvaluationParams {
  subjectScores: SubjectPeriodScores[];
  requiredPeriodIds: string[]; // e.g. ['sem1', 'sem2'] for Annual, or ['sem1'] for Semester 1
  isSingleTerm: boolean; // true for single term (Passed/Failed), false for Annual (Promoted/Retained)
  policyPassingMinScore?: number; // default 50
  maxAllowedFailedSubjects?: number; // default 2
  gradingScales?: GradingScaleItem[];
}

export interface EvaluatedSubjectRow {
  subjectId: string;
  subjectName: string;
  code?: string;
  weight: number;
  scores: Record<string, number | null>;
  total: number | null;
  average: number | null;
  isComplete: boolean;
  missingPeriods: string[];
  isPassing: boolean;
  gradeLetter: string;
  gpaPoint: number;
}

export interface PromotionEvaluationResult {
  isIncomplete: boolean;
  missingReasons: string[];
  incompleteSubjectsCount: number;
  failedSubjectsCount: number;
  totalPointsSum: number | null;
  overallAverage: number | null;
  isOverallPassing: boolean;
  canPromote: boolean;
  remarkBadge: 'INCOMPLETE' | 'Passed' | 'Passed (Conditional)' | 'Failed' | 'Promoted' | 'Promoted (Conditional)' | 'Retained';
  subjectRows: EvaluatedSubjectRow[];
}

export const DEFAULT_GRADING_SCALES: GradingScaleItem[] = [
  { grade: 'A+', minScore: 90, maxScore: 100, gpaPoint: 4.0, description: 'Outstanding', isPassing: true },
  { grade: 'A', minScore: 85, maxScore: 89.99, gpaPoint: 4.0, description: 'Excellent', isPassing: true },
  { grade: 'B+', minScore: 80, maxScore: 84.99, gpaPoint: 3.5, description: 'Very Good', isPassing: true },
  { grade: 'B', minScore: 75, maxScore: 79.99, gpaPoint: 3.0, description: 'Good', isPassing: true },
  { grade: 'C+', minScore: 65, maxScore: 74.99, gpaPoint: 2.5, description: 'Satisfactory', isPassing: true },
  { grade: 'C', minScore: 60, maxScore: 64.99, gpaPoint: 2.0, description: 'Average', isPassing: true },
  { grade: 'D', minScore: 50, maxScore: 59.99, gpaPoint: 1.0, description: 'Passing', isPassing: true },
  { grade: 'F', minScore: 0, maxScore: 49.99, gpaPoint: 0.0, description: 'Failing', isPassing: false },
];

export function findGradeScale(score: number, scales: GradingScaleItem[] = DEFAULT_GRADING_SCALES, policyPassingMinScore = 50) {
  for (const s of scales) {
    if (score >= s.minScore && (score <= s.maxScore || s.maxScore >= 100)) {
      return s;
    }
  }
  const isPass = score >= policyPassingMinScore;
  return {
    grade: isPass ? 'D' : 'F',
    minScore: isPass ? policyPassingMinScore : 0,
    maxScore: isPass ? 100 : policyPassingMinScore - 0.01,
    gpaPoint: isPass ? 1.0 : 0.0,
    isPassing: isPass,
    description: isPass ? 'Passing' : 'Failing',
  };
}

/**
 * Authoritative evaluation of student marks for Promotion and Pass/Fail
 */
export function evaluateStudentPromotion(params: PromotionEvaluationParams): PromotionEvaluationResult {
  const {
    subjectScores,
    requiredPeriodIds,
    isSingleTerm,
    policyPassingMinScore = 50,
    maxAllowedFailedSubjects = 2,
    gradingScales = DEFAULT_GRADING_SCALES,
  } = params;

  const missingReasons: string[] = [];
  let incompleteSubjectsCount = 0;
  let failedSubjectsCount = 0;

  const evaluatedSubjectRows: EvaluatedSubjectRow[] = [];

  for (const item of subjectScores) {
    const missingPeriods: string[] = [];
    const normalizedScores: Record<string, number | null> = {};
    const recordedPeriodScores: number[] = [];

    for (const periodId of requiredPeriodIds) {
      const rawScore = item.scores[periodId];
      // CRITICAL: 0 is a valid number, not missing!
      // Only null, undefined, or NaN are missing!
      const isValidScore = typeof rawScore === 'number' && !isNaN(rawScore);

      if (isValidScore) {
        normalizedScores[periodId] = rawScore;
        recordedPeriodScores.push(rawScore);
      } else {
        normalizedScores[periodId] = null;
        missingPeriods.push(periodId);
      }
    }

    const isSubjectComplete = missingPeriods.length === 0;

    if (!isSubjectComplete) {
      incompleteSubjectsCount++;
      missingReasons.push(`Subject "${item.subjectName}" is missing marks for: ${missingPeriods.join(', ')}`);
    }

    let rowTotal: number | null = null;
    let rowAverage: number | null = null;
    let isPassing = false;
    let gradeLetter = 'INC';
    let gpaPoint = 0;

    if (isSubjectComplete && recordedPeriodScores.length > 0) {
      const sum = recordedPeriodScores.reduce((a, b) => a + b, 0);
      rowTotal = Math.round(sum * 10) / 10;
      rowAverage = Math.round((sum / recordedPeriodScores.length) * 10) / 10;

      const scale = findGradeScale(rowAverage, gradingScales, policyPassingMinScore);
      gradeLetter = scale.grade;
      gpaPoint = scale.gpaPoint ?? 0;
      isPassing = scale.isPassing;

      if (!isPassing) {
        failedSubjectsCount++;
      }
    } else {
      // Incomplete subject: cannot be deemed passing
      isPassing = false;
      gradeLetter = 'INC';
      gpaPoint = 0;
    }

    evaluatedSubjectRows.push({
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      code: item.code,
      weight: 100,
      scores: normalizedScores,
      total: rowTotal,
      average: rowAverage,
      isComplete: isSubjectComplete,
      missingPeriods,
      isPassing,
      gradeLetter,
      gpaPoint,
    });
  }

  // If there are no subjects configured at all, that is also incomplete
  if (subjectScores.length === 0) {
    missingReasons.push('No subjects evaluated for this student');
  }

  const isIncomplete = incompleteSubjectsCount > 0 || subjectScores.length === 0;

  // Calculate totals across complete rows
  const completeRows = evaluatedSubjectRows.filter(r => r.isComplete && r.average !== null);
  const totalPointsSum = completeRows.length > 0
    ? Math.round(completeRows.reduce((acc, r) => acc + (r.total || 0), 0) * 10) / 10
    : null;

  const overallAverage = (!isIncomplete && completeRows.length === evaluatedSubjectRows.length && evaluatedSubjectRows.length > 0)
    ? Math.round((completeRows.reduce((acc, r) => acc + (r.average || 0), 0) / completeRows.length) * 10) / 10
    : null;

  // Pass/Fail & Promotion Eligibility
  let isOverallPassing = false;
  let canPromote = false;
  let remarkBadge: PromotionEvaluationResult['remarkBadge'] = 'INCOMPLETE';

  if (isIncomplete) {
    // RULE 1: Incomplete marks -> display INCOMPLETE and do NOT allow passing or promotion
    isOverallPassing = false;
    canPromote = false;
    remarkBadge = 'INCOMPLETE';
  } else {
    // RULE 2 & 3: Complete marks (including scores of 0) -> determine Pass/Fail and Promotion status
    const isAveragePassing = overallAverage !== null && overallAverage >= policyPassingMinScore;
    const isSubjectCountAcceptable = failedSubjectsCount <= maxAllowedFailedSubjects;

    isOverallPassing = isAveragePassing && isSubjectCountAcceptable;
    canPromote = isOverallPassing;

    if (isSingleTerm) {
      if (!isOverallPassing) {
        remarkBadge = 'Failed';
      } else if (failedSubjectsCount > 0) {
        remarkBadge = 'Passed (Conditional)';
      } else {
        remarkBadge = 'Passed';
      }
    } else {
      // Annual / Full Academic Year
      if (!isOverallPassing) {
        remarkBadge = 'Retained';
      } else if (failedSubjectsCount > 0) {
        remarkBadge = 'Promoted (Conditional)';
      } else {
        remarkBadge = 'Promoted';
      }
    }
  }

  return {
    isIncomplete,
    missingReasons,
    incompleteSubjectsCount,
    failedSubjectsCount,
    totalPointsSum,
    overallAverage,
    isOverallPassing,
    canPromote,
    remarkBadge,
    subjectRows: evaluatedSubjectRows,
  };
}
