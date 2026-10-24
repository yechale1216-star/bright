import { assessmentReportService, normalizeReportCategory } from '../services/assessment-report.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('\n============================================================');
  console.log('--- 1. Testing Standard Report Category Normalization ---');
  console.log('============================================================');

  assert(normalizeReportCategory('STUDENT_ACADEMIC') === 'STUDENT_ACADEMIC', 'STUDENT_ACADEMIC category normalized');
  assert(normalizeReportCategory('CLASS_PERFORMANCE') === 'CLASS_PERFORMANCE', 'CLASS_PERFORMANCE category normalized');
  assert(normalizeReportCategory('PARENT_REPORT') === 'CLASS_PERFORMANCE', 'Legacy PARENT_REPORT maps to CLASS_PERFORMANCE');
  assert(normalizeReportCategory('SUBJECT_PERFORMANCE') === 'SUBJECT_PERFORMANCE', 'SUBJECT_PERFORMANCE category normalized');
  assert(normalizeReportCategory('SUBJECT_COMPARISON') === 'SUBJECT_PERFORMANCE', 'Legacy SUBJECT_COMPARISON maps to SUBJECT_PERFORMANCE');
  assert(normalizeReportCategory('GRADE_LEVEL') === 'GRADE_LEVEL', 'GRADE_LEVEL category normalized');
  assert(normalizeReportCategory('GRADE_REPORT') === 'GRADE_LEVEL', 'Legacy GRADE_REPORT maps to GRADE_LEVEL');
  assert(normalizeReportCategory('PERFORMANCE_ANALYSIS') === 'PERFORMANCE_ANALYSIS', 'PERFORMANCE_ANALYSIS category normalized');
  assert(normalizeReportCategory('ANNUAL_ACADEMIC') === 'ANNUAL_ACADEMIC', 'ANNUAL_ACADEMIC category normalized');
  assert(normalizeReportCategory('ANNUAL_REPORT') === 'ANNUAL_ACADEMIC', 'Legacy ANNUAL_REPORT maps to ANNUAL_ACADEMIC');
  assert(normalizeReportCategory('SCHOOL_SUMMARY') === 'SCHOOL_SUMMARY', 'SCHOOL_SUMMARY category normalized');
  assert(normalizeReportCategory(undefined) === 'CLASS_PERFORMANCE', 'Default category falls back to CLASS_PERFORMANCE');

  console.log('\n============================================================');
  console.log('--- 2. Testing Analytics Generation for All Categories ---');
  console.log('============================================================');

  const categories = [
    'CLASS_PERFORMANCE',
    'STUDENT_ACADEMIC',
    'SUBJECT_PERFORMANCE',
    'GRADE_LEVEL',
    'PERFORMANCE_ANALYSIS',
    'ANNUAL_ACADEMIC',
    'SCHOOL_SUMMARY',
  ];

  for (const cat of categories) {
    const analytics = await assessmentReportService.getAnalytics({ reportType: cat });
    assert(analytics !== null && typeof analytics === 'object', `${cat}: Returns analytics object`);
    assert(analytics.summary !== undefined, `${cat}: Has summary object`);
    assert(analytics.summary.card1Title !== undefined, `${cat}: card1Title defined (${analytics.summary.card1Title})`);
    assert(analytics.summary.card2Title !== undefined, `${cat}: card2Title defined (${analytics.summary.card2Title})`);
    assert(analytics.summary.card3Title !== undefined, `${cat}: card3Title defined (${analytics.summary.card3Title})`);
    assert(analytics.summary.card4Title !== undefined, `${cat}: card4Title defined (${analytics.summary.card4Title})`);
    assert(Array.isArray(analytics.availableReports), `${cat}: availableReports is an array`);
    assert(Array.isArray(analytics.distribution.bands), `${cat}: distribution bands is an array`);
    assert(Array.isArray(analytics.recommendations), `${cat}: recommendations is an array`);

    // Verify no synthetic NaN or undefined in summary cards
    assert(analytics.summary.card1Val !== undefined && analytics.summary.card1Val !== 'NaN', `${cat}: card1Val is valid`);
    assert(analytics.summary.card2Val !== undefined && analytics.summary.card2Val !== 'NaN%', `${cat}: card2Val is valid`);
    assert(analytics.summary.card3Val !== undefined && analytics.summary.card3Val !== 'NaN%', `${cat}: card3Val is valid`);
    assert(analytics.summary.card4Val !== undefined && analytics.summary.card4Val !== 'NaN', `${cat}: card4Val is valid`);
  }

  console.log('\n============================================================');
  console.log('--- 3. Testing Detailed Report Generation & Print Data ---');
  console.log('============================================================');

  // Test detailed report for Class Performance
  const classAnalytics = await assessmentReportService.getAnalytics({ reportType: 'CLASS_PERFORMANCE' });
  const sampleReportId = classAnalytics.availableReports[0]?.id || 'class_grade_sec';
  const detail = await assessmentReportService.getDetailedReport(sampleReportId, { reportType: 'CLASS_PERFORMANCE' });

  assert(detail !== null, 'Detailed report returned successfully');
  assert(detail.report !== undefined, 'Detail has report metadata');
  assert(detail.schoolInfo !== undefined, 'Detail has schoolInfo');
  assert(Array.isArray(detail.studentRows), 'Detail has studentRows array');
  assert(Array.isArray(detail.recommendations), 'Detail has recommendations array');
  assert(detail.generatedAt !== undefined, 'Detail has generatedAt timestamp');

  // Verify that student rows (if any) have proper calculated properties
  if (detail.studentRows.length > 0) {
    const firstRow = detail.studentRows[0];
    assert(firstRow.studentId !== undefined, 'Row has studentId');
    assert(firstRow.fullName !== undefined, 'Row has fullName');
    assert(firstRow.status === 'Passed' || firstRow.status === 'Failed' || firstRow.status === 'Incomplete', `Row status is valid: ${firstRow.status}`);
  }

  console.log('\n============================================================');
  console.log('--- 4. Testing Annual Academic Single Consolidated Row ---');
  console.log('============================================================');

  const annualAnalytics = await assessmentReportService.getAnalytics({ reportType: 'ANNUAL_ACADEMIC' });
  assert(annualAnalytics.summary.card3Title === 'Promotion Eligible', 'Annual summary has Promotion Eligible card');
  assert(annualAnalytics.summary.card4Title === 'Retained / Incomplete', 'Annual summary has Retained/Incomplete card');

  const annualReportId = annualAnalytics.availableReports[0]?.id || 'annual_all';
  const annualDetail = await assessmentReportService.getDetailedReport(annualReportId, { reportType: 'ANNUAL_ACADEMIC' });

  assert(Array.isArray(annualDetail.studentRows), 'Annual report studentRows is an array');

  // Verify uniqueness: one consolidated row per student ID
  const studentIds = annualDetail.studentRows.map((r: any) => r.id);
  const uniqueIds = new Set(studentIds);
  assert(studentIds.length === uniqueIds.size, `Annual report has 1 consolidated record per student (${studentIds.length} rows, ${uniqueIds.size} unique students)`);

  console.log('\n🎉 ALL 17 STANDARDIZED ACADEMIC REPORT TESTS PASSED PERFECTLY!\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
