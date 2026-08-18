import prisma from '../config/db';

export async function cleanupAttendanceDuplicates() {
  console.log('🔍 Checking for duplicate attendance records in database...');

  // 1. Fetch all attendance records
  const allRecords = await prisma.attendance.findMany({
    orderBy: { updatedAt: 'desc' }
  });

  console.log(`Found ${allRecords.length} total attendance record(s).`);

  const seenKeys = new Map<string, string>(); // key -> id of the latest record
  const duplicateIds: string[] = [];

  for (const record of allRecords) {
    const dateStr = record.date ? record.date.toISOString().split('T')[0] : 'unknown';
    const sessStr = record.session ? record.session.trim().toLowerCase() : '__daily__';
    const key = `${record.studentId}::${dateStr}::${sessStr}`;

    if (seenKeys.has(key)) {
      // Duplicate record found (since records are ordered by updatedAt desc, this is an older duplicate)
      duplicateIds.push(record.id);
    } else {
      seenKeys.set(key, record.id);
    }
  }

  if (duplicateIds.length === 0) {
    console.log('✅ No duplicate attendance records found in database.');
    return { cleanedCount: 0 };
  }

  console.log(`⚠️ Found ${duplicateIds.length} duplicate attendance record(s). Cleaning up...`);

  // 2. Delete duplicates in batches
  const batchSize = 100;
  for (let i = 0; i < duplicateIds.length; i += batchSize) {
    const batch = duplicateIds.slice(i, i + batchSize);
    await prisma.attendance.deleteMany({
      where: { id: { in: batch } }
    });
  }

  console.log(`✅ Successfully removed ${duplicateIds.length} duplicate attendance record(s).`);
  return { cleanedCount: duplicateIds.length };
}

if (require.main === module) {
  cleanupAttendanceDuplicates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
}
