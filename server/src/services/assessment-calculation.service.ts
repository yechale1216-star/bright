/**
 * Assessment Calculation Engine
 * 
 * Implements authoritative percentage-weighted calculation rules for Bright Path:
 * - Normalizes individual assessment percentages: (score / maxMarks) * 100
 * - Aggregates category percentages using Combined-Marks (default) or Average-Percentage
 * - Applies configured category weights (must total 100%)
 * - Calculates final subject mark out of 100
 * - Strictly handles missing marks, absent, and excused statuses
 * - Distinguishes between provisional totals and finalized results
 */

export type MarkStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'NOT_ENTERED';

export interface StudentAssessmentScore {
  assessmentId: string;
  categoryId: string;
  categoryName?: string;
  title: string;
  maxScore: number;
  score: number | null;
  status: MarkStatus;
  isAbsent?: boolean;
}

export interface ConfiguredCategory {
  id: string;
  name: string;
  weight: number; // percentage, e.g. 10.0, 30.0, 40.0
  aggregationMethod?: 'COMBINED_MARKS' | 'AVERAGE_PERCENTAGE';
  dropLowest?: number;
}

export interface CategoryResult {
  categoryId: string;
  categoryName: string;
  weight: number;
  earnedMarks: number;
  maxMarks: number;
  percentage: number | null; // null if no assessments or no valid marks
  weightedContribution: number; // contribution to 100
  assessmentCount: number;
  assessedCount: number;
  isComplete: boolean;
  missingCount: number;
}

export interface SubjectFinalResult {
  studentId: string;
  categories: CategoryResult[];
  totalWeight: number; // sum of category weights, should be 100
  provisionalScore: number; // calculated from current available marks
  finalScore: number | null; // official final mark out of 100, null if incomplete
  isComplete: boolean;
  missingAssessmentsCount: number;
  unenteredMarksCount: number;
  letterGrade?: string;
  gpaPoint?: number;
}

export class AssessmentCalculationEngine {
  /**
   * Round to decimal places safely without floating-point errors
   */
  static round(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  /**
   * Calculate a student's percentage on an individual assessment
   */
  static calculateAssessmentPercentage(score: number | null, maxScore: number, status: MarkStatus): number | null {
    if (status === 'EXCUSED' || status === 'NOT_ENTERED' || score === null) {
      return null;
    }
    if (status === 'ABSENT') {
      return 0;
    }
    if (maxScore <= 0) return 0;
    return this.round((score / maxScore) * 100, 2);
  }

  /**
   * Calculate student results for a single category
   */
  static calculateCategoryResult(
    category: ConfiguredCategory,
    assessments: StudentAssessmentScore[]
  ): CategoryResult {
    const method = category.aggregationMethod || 'COMBINED_MARKS';
    let totalEarned = 0;
    let totalMax = 0;
    let assessedCount = 0;
    let missingCount = 0;

    const validScores: { earned: number; max: number; pct: number }[] = [];

    for (const item of assessments) {
      const status: MarkStatus = item.status || (item.isAbsent ? 'ABSENT' : item.score !== null ? 'PRESENT' : 'NOT_ENTERED');

      if (status === 'EXCUSED') {
        // Excused assessments are completely omitted from calculation
        continue;
      }

      if (status === 'NOT_ENTERED' || item.score === null) {
        missingCount++;
        continue;
      }

      // Present or Absent
      const earned = status === 'ABSENT' ? 0 : Math.max(0, item.score);
      const max = Math.max(0, item.maxScore);

      if (max > 0) {
        totalEarned += earned;
        totalMax += max;
        assessedCount++;
        validScores.push({ earned, max, pct: (earned / max) * 100 });
      }
    }

    let categoryPct: number | null = null;

    if (method === 'AVERAGE_PERCENTAGE') {
      if (validScores.length > 0) {
        const sumPct = validScores.reduce((acc, curr) => acc + curr.pct, 0);
        categoryPct = this.round(sumPct / validScores.length, 2);
      }
    } else {
      // Default: COMBINED_MARKS
      // Category percentage = (Sum of earned marks ÷ Sum of maximum marks) × 100
      if (totalMax > 0) {
        categoryPct = this.round((totalEarned / totalMax) * 100, 2);
      }
    }

    const isComplete = assessments.length > 0 && missingCount === 0;

    // Weighted contribution = Category percentage × Category weight ÷ 100
    const weightedContribution = categoryPct !== null
      ? this.round((categoryPct * category.weight) / 100, 2)
      : 0;

    return {
      categoryId: category.id,
      categoryName: category.name,
      weight: category.weight,
      earnedMarks: this.round(totalEarned, 2),
      maxMarks: this.round(totalMax, 2),
      percentage: categoryPct,
      weightedContribution,
      assessmentCount: assessments.length,
      assessedCount,
      isComplete,
      missingCount,
    };
  }

  /**
   * Calculate final subject mark out of 100 across all categories
   */
  static calculateSubjectResult(
    studentId: string,
    categories: ConfiguredCategory[],
    assessments: StudentAssessmentScore[]
  ): SubjectFinalResult {
    const totalWeight = this.round(
      categories.reduce((acc, c) => acc + c.weight, 0),
      2
    );

    const categoryResults: CategoryResult[] = [];
    let unenteredMarksCount = 0;
    let missingAssessmentsCount = 0;
    let sumWeightedContribution = 0;
    let allCategoriesComplete = true;

    for (const cat of categories) {
      const catAssessments = assessments.filter(a => a.categoryId === cat.id);
      if (catAssessments.length === 0) {
        missingAssessmentsCount++;
        allCategoriesComplete = false;
      }

      const catRes = this.calculateCategoryResult(cat, catAssessments);
      categoryResults.push(catRes);

      unenteredMarksCount += catRes.missingCount;
      if (!catRes.isComplete) {
        allCategoriesComplete = false;
      }

      sumWeightedContribution += catRes.weightedContribution;
    }

    const provisionalScore = this.round(sumWeightedContribution, 2);
    const isComplete = allCategoriesComplete && totalWeight === 100;
    const finalScore = isComplete ? provisionalScore : null;

    return {
      studentId,
      categories: categoryResults,
      totalWeight,
      provisionalScore,
      finalScore,
      isComplete,
      missingAssessmentsCount,
      unenteredMarksCount,
    };
  }
}
