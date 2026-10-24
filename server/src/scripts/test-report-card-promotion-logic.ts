import { evaluateStudentPromotion } from '../utils/report-card-promotion';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('\n--- 1. Testing INCOMPLETE Records ---');

  // Case 1A: Single Term - One subject missing mark (null)
  {
    const res = evaluateStudentPromotion({
      isSingleTerm: true,
      requiredPeriodIds: ['sem1'],
      subjectScores: [
        { subjectId: 'math', subjectName: 'Mathematics', scores: { sem1: 85 } },
        { subjectId: 'eng', subjectName: 'English', scores: { sem1: null } }, // MISSING
        { subjectId: 'sci', subjectName: 'General Science', scores: { sem1: 78 } },
      ],
    });

    assert(res.isIncomplete === true, 'Single term with missing mark is flagged isIncomplete = true');
    assert(res.remarkBadge === 'INCOMPLETE', 'Remark badge displays INCOMPLETE');
    assert(res.isOverallPassing === false, 'Student with incomplete mark cannot pass (isOverallPassing = false)');
    assert(res.canPromote === false, 'Student with incomplete mark cannot be promoted');
    assert(res.incompleteSubjectsCount === 1, 'Incomplete subjects count is 1');
    assert(res.subjectRows.find(r => r.subjectId === 'eng')?.gradeLetter === 'INC', 'Missing subject has INC grade letter');
  }

  // Case 1B: Annual Evaluation - Missing Term 2 (Sem 2 mark is null)
  {
    const res = evaluateStudentPromotion({
      isSingleTerm: false, // Annual
      requiredPeriodIds: ['sem1', 'sem2'],
      subjectScores: [
        { subjectId: 'math', subjectName: 'Mathematics', scores: { sem1: 90, sem2: 88 } },
        { subjectId: 'eng', subjectName: 'English', scores: { sem1: 80, sem2: null } }, // Missing Sem 2
        { subjectId: 'sci', subjectName: 'General Science', scores: { sem1: 85, sem2: 82 } },
      ],
    });

    assert(res.isIncomplete === true, 'Annual evaluation with missing term mark is flagged isIncomplete = true');
    assert(res.remarkBadge === 'INCOMPLETE', 'Annual remark badge displays INCOMPLETE, not Promoted');
    assert(res.canPromote === false, 'Student with missing term mark cannot be promoted');
    assert(res.isOverallPassing === false, 'isOverallPassing is false when annual marks are incomplete');
  }

  console.log('\n--- 2. Testing ZERO (0) Score Records ---');

  // Case 2A: Score of 0 in one subject (Valid recorded mark, passes other subjects)
  {
    const res = evaluateStudentPromotion({
      isSingleTerm: true,
      requiredPeriodIds: ['sem1'],
      subjectScores: [
        { subjectId: 'math', subjectName: 'Mathematics', scores: { sem1: 90 } },
        { subjectId: 'eng', subjectName: 'English', scores: { sem1: 0 } }, // RECORDED ZERO SCORE
        { subjectId: 'sci', subjectName: 'General Science', scores: { sem1: 80 } },
      ],
    });

    assert(res.isIncomplete === false, 'Zero score is a valid recorded score, NOT incomplete (isIncomplete = false)');
    assert(res.incompleteSubjectsCount === 0, 'Incomplete subjects count is 0');
    assert(res.failedSubjectsCount === 1, 'English with 0 score is counted as 1 failed subject');
    // Math 90 + Eng 0 + Sci 80 = 170 / 3 = 56.7%
    assert(res.overallAverage === 56.7, `Overall average calculates correctly including 0 (expected 56.7, got ${res.overallAverage})`);
    assert(res.isOverallPassing === true, 'Student with average 56.7% and 1 failed subject passes conditionally');
    assert(res.remarkBadge === 'Passed (Conditional)', `Remark is Passed (Conditional), got ${res.remarkBadge}`);
  }

  // Case 2B: Multiple Zero Scores leading to retention / failure
  {
    const res = evaluateStudentPromotion({
      isSingleTerm: false, // Annual
      requiredPeriodIds: ['sem1', 'sem2'],
      subjectScores: [
        { subjectId: 'math', subjectName: 'Mathematics', scores: { sem1: 0, sem2: 0 } }, // 0
        { subjectId: 'eng', subjectName: 'English', scores: { sem1: 0, sem2: 0 } },  // 0
        { subjectId: 'sci', subjectName: 'General Science', scores: { sem1: 0, sem2: 0 } }, // 0
        { subjectId: 'hist', subjectName: 'History', scores: { sem1: 70, sem2: 70 } },
      ],
    });

    assert(res.isIncomplete === false, 'Record with zeros is COMPLETE, not incomplete');
    assert(res.failedSubjectsCount === 3, '3 subjects with 0 score are counted as failed');
    assert(res.isOverallPassing === false, 'Student with 3 failing subjects does not pass');
    assert(res.canPromote === false, 'Student with failing marks cannot be promoted');
    assert(res.remarkBadge === 'Retained', `Remark badge is Retained (got ${res.remarkBadge}) - NOT INCOMPLETE`);
  }

  console.log('\n--- 3. Testing FULLY COMPLETED Records ---');

  // Case 3A: Clean Pass / Promotion
  {
    const res = evaluateStudentPromotion({
      isSingleTerm: false, // Annual
      requiredPeriodIds: ['sem1', 'sem2'],
      subjectScores: [
        { subjectId: 'math', subjectName: 'Mathematics', scores: { sem1: 85, sem2: 90 } },
        { subjectId: 'eng', subjectName: 'English', scores: { sem1: 78, sem2: 82 } },
        { subjectId: 'sci', subjectName: 'General Science', scores: { sem1: 88, sem2: 86 } },
      ],
    });

    assert(res.isIncomplete === false, 'Fully completed record is not incomplete');
    assert(res.failedSubjectsCount === 0, 'No failed subjects');
    assert(res.isOverallPassing === true, 'isOverallPassing is true');
    assert(res.canPromote === true, 'canPromote is true');
    assert(res.remarkBadge === 'Promoted', `Annual clean pass remark is Promoted (got ${res.remarkBadge})`);
  }

  // Case 3B: Conditional Promotion (1 failing subject)
  {
    const res = evaluateStudentPromotion({
      isSingleTerm: false, // Annual
      requiredPeriodIds: ['sem1', 'sem2'],
      subjectScores: [
        { subjectId: 'math', subjectName: 'Mathematics', scores: { sem1: 85, sem2: 90 } },
        { subjectId: 'eng', subjectName: 'English', scores: { sem1: 45, sem2: 45 } }, // Average 45 (Failing)
        { subjectId: 'sci', subjectName: 'General Science', scores: { sem1: 88, sem2: 86 } },
      ],
    });

    assert(res.isIncomplete === false, 'Record is complete');
    assert(res.failedSubjectsCount === 1, '1 failed subject');
    assert(res.isOverallPassing === true, 'Overall passing is true');
    assert(res.canPromote === true, 'canPromote is true');
    assert(res.remarkBadge === 'Promoted (Conditional)', `Remark is Promoted (Conditional), got ${res.remarkBadge}`);
  }

  console.log('\n🎉 ALL 12 VERIFICATION ASSERTIONS PASSED!\n');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
