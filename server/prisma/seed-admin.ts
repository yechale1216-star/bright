import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding School Administrator credentials...');

  const email = 'abinet21x@gmail.com';
  const plainPassword = 'q123456';
  const hashedPassword = bcrypt.hashSync(plainPassword, 10);

  // 1. Ensure at least one school exists
  let school = await prisma.school.findFirst();
  if (!school) {
    console.log('Creating default school...');
    school = await prisma.school.create({
      data: {
        name: 'Zetime School',
        schoolEmail: 'contact@zetime.school',
        schoolId: 'SCH-0001',
        settings: {
          create: {
            school_name: 'Zetime School',
            attendance_mode: 'session_based',
            attendance_ui_type: 'card_based'
          }
        }
      }
    });
    console.log(`✓ Created school: ${school.name} (${school.id})`);
  } else {
    console.log(`✓ Using existing school: ${school.name} (${school.id})`);
  }

  // 2. Create or update the School Administrator user
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password_hash: hashedPassword,
        role: 'admin',
        is_active: true,
        is_verified: true,
        schoolId: school.id,
        full_name: existingUser.full_name || 'School Administrator'
      }
    });
    console.log(`✓ Updated existing admin account: ${updated.email}`);
  } else {
    const created = await prisma.user.create({
      data: {
        email: email,
        password_hash: hashedPassword,
        full_name: 'School Administrator',
        role: 'admin',
        is_active: true,
        is_verified: true,
        schoolId: school.id
      }
    });
    console.log(`✓ Created new admin account: ${created.email}`);
  }

  console.log('\n✅ Admin Seeding Completed Successfully!');
  console.log('-----------------------------------------');
  console.log(`Email    : ${email}`);
  console.log(`Password : ${plainPassword}`);
  console.log(`Role     : admin`);
  console.log(`School ID: ${school.id}`);
  console.log('-----------------------------------------\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
