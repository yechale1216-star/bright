import { describe, test, expect } from '@jest/globals';

const isValidAcademicYear = (year: string): boolean => {
  if (!year || typeof year !== 'string') return false;
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

const sortCohortsDescending = (cohorts: Array<{ id: string; gradeName: string }>) => {
  return [...cohorts].sort((a, b) => {
    const gradeA = parseInt(a.gradeName.replace(/[^\d]/g, '') || '0') || 0;
    const gradeB = parseInt(b.gradeName.replace(/[^\d]/g, '') || '0') || 0;
    return gradeB - gradeA;
  });
};

describe("Normalized Academic Year Validation & Promotion Helpers", () => {
  test("Validates standard range academic years (e.g. 2026/2027, 2026-2027)", () => {
    expect(isValidAcademicYear("2026/2027")).toBe(true);
    expect(isValidAcademicYear("2026-2027")).toBe(true);
    expect(isValidAcademicYear("2016/2017")).toBe(true);
  });

  test("Validates Ethiopian Calendar formats (e.g. 2017 E.C., 2016/2017 E.C., 2017 EC)", () => {
    expect(isValidAcademicYear("2017 E.C.")).toBe(true);
    expect(isValidAcademicYear("2017 EC")).toBe(true);
    expect(isValidAcademicYear("2016/2017 E.C.")).toBe(true);
    expect(isValidAcademicYear("2017")).toBe(true);
  });

  test("Rejects invalid academic year formats", () => {
    expect(isValidAcademicYear("2026/2028")).toBe(false);
    expect(isValidAcademicYear("invalid")).toBe(false);
    expect(isValidAcademicYear("")).toBe(false);
  });

  test("Sorts cohorts in descending grade order (Grade 12 -> Grade 11 -> Grade 10)", () => {
    const cohorts = [
      { id: "10-a", gradeName: "Grade 10" },
      { id: "12-a", gradeName: "Grade 12" },
      { id: "11-a", gradeName: "Grade 11" },
    ];
    const sorted = sortCohortsDescending(cohorts);
    expect(sorted.map(c => c.gradeName)).toEqual(["Grade 12", "Grade 11", "Grade 10"]);
  });
});
