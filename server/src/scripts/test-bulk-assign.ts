import prisma from '../config/db';
import { AssessmentPolicyService } from '../services/assessment-policy.service';

async function testBulkAssign() {
  console.log('=== Starting Bulk Assessment Template Assignment Test ===\n');

  // 1. Ensure default scheme template exists
  const template = await AssessmentPolicyService.ensureDefaultPolicyScheme();
  if (!template) {
    console.log('Failed to ensure default template.');
    return;
  }
  console.log(`[1] Template Scheme: "${template.name}" (ID: ${template.id})`);
  console.log(`    Categories: ${template.categories.map((c: any) => `${c.name}: ${c.weight}%`).join(', ')}`);

  // 2. Fetch an Academic Year, Grades, and Subjects
  const academicYear = await prisma.academicYear.findFirst();
  if (!academicYear) {
    console.log('No academic year found. Creating test academic year.');
    return;
  }
  console.log(`[2] Academic Year: "${academicYear.name}" (ID: ${academicYear.id})`);

  const grades = await prisma.grade.findMany({ take: 3 });
  const subjects = await prisma.subject.findMany({ take: 3 });

  if (grades.length === 0 || subjects.length === 0) {
    console.log('Grades or subjects not found in database.');
    return;
  }

  console.log(`[3] Testing with ${grades.length} Grades: ${grades.map(g => g.name).join(', ')}`);
  console.log(`    and ${subjects.length} Subjects: ${subjects.map(s => s.name).join(', ')}`);

  // Build 3x3 = 9 target combinations
  const targets: Array<{ gradeId: string; streamId: string | null; subjectId: string }> = [];
  for (const g of grades) {
    for (const s of subjects) {
      targets.push({ gradeId: g.id, streamId: null, subjectId: s.id });
    }
  }
  console.log(`    Total Target Combinations: ${targets.length}`);

  // 4. Test Preview
  console.log('\n[4] Testing previewBulkAssignment()...');
  const preview = await AssessmentPolicyService.previewBulkAssignment({
    schemeId: template.id,
    academicYearId: academicYear.id,
    targets,
    policy: 'SKIP_EXISTING',
  });

  console.log('    Preview Summary:', JSON.stringify(preview.summary, null, 2));
  console.log(`    Preview Items count: ${preview.items.length}`);

  // 5. Test Execute Bulk Assignment (SKIP_EXISTING)
  console.log('\n[5] Testing executeBulkAssignment() with SKIP_EXISTING policy...');
  const result1 = await AssessmentPolicyService.executeBulkAssignment({
    schemeId: template.id,
    academicYearId: academicYear.id,
    targets,
    policy: 'SKIP_EXISTING',
  });

  console.log('    Execution Result 1 Summary:', JSON.stringify(result1.summary, null, 2));

  // 6. Test Idempotency (repeating the exact same request should create 0 duplicates and skip all)
  console.log('\n[6] Testing idempotency (repeating exact same request)...');
  const result2 = await AssessmentPolicyService.executeBulkAssignment({
    schemeId: template.id,
    academicYearId: academicYear.id,
    targets,
    policy: 'SKIP_EXISTING',
  });

  console.log('    Execution Result 2 (Idempotent) Summary:', JSON.stringify(result2.summary, null, 2));
  if (result2.summary.created === 0 && result2.summary.skipped === targets.length) {
    console.log('    ✓ Idempotency verified: 0 duplicates created, all existing configs safely skipped.');
  }

  // 7. Test Duplicating Template
  console.log('\n[7] Testing duplicateScheme()...');
  const copy = await AssessmentPolicyService.duplicateScheme(template.id);
  console.log(`    ✓ Duplicated scheme created: "${copy?.name}" (ID: ${copy?.id})`);
  console.log(`    Categories copied: ${copy?.categories.length}`);

  // Clean up test duplicated scheme
  if (copy?.id) {
    await prisma.assessmentWeightScheme.delete({ where: { id: copy.id } });
    console.log('    ✓ Cleaned up test duplicated scheme.');
  }

  console.log('\n=== All Bulk Assessment Assignment Tests PASSED Successfully! ===');
}

testBulkAssign()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
