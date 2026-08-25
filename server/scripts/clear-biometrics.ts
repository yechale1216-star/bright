import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking biometric records...');
  const countBefore = await prisma.staffFaceEnrollment.count();
  console.log(`Found ${countBefore} biometric face enrollment record(s).`);

  if (countBefore > 0) {
    const deleted = await prisma.staffFaceEnrollment.deleteMany({});
    console.log(`Successfully cleared ${deleted.count} biometric face enrollment record(s).`);
  } else {
    console.log('No biometric face enrollment records to clear.');
  }

  const countAfter = await prisma.staffFaceEnrollment.count();
  console.log(`Remaining biometric face enrollment records: ${countAfter}`);
}

main()
  .catch((err) => {
    console.error('Error clearing biometric records:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
