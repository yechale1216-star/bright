import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

async function main() {
  console.log('--- Initializing School & Admin Account ---');

  // 1. Create or update SchoolSettings singleton
  const settings = await prisma.schoolSettings.upsert({
    where: { id: 'singleton' },
    update: {
      school_name: 'Bright Path',
      school_address: 'Dire Dawa, Ethiopia',
      school_phone: '+251924919853',
      academic_year: '2018 E.C.',
      calendar_type: 'ETHIOPIAN',
      attendance_mode: 'session_based',
      attendance_ui_type: 'card_based',
      attendance_threshold: 75,
      allow_late_mark: true,
      allow_attendance_editing: true,
      allow_outside_attendance: true,
      staff_attendance_mode: 'session_based',
      staff_sessions: [
        {
          id: 'morning',
          name: 'Morning',
          startTime: '08:00',
          endTime: '12:30',
          lateGraceMinutes: 15,
          earlyDepartureToleranceMinutes: 10,
          absenceCutoffMinutes: 90,
          absenceCutoffTime: '09:30',
          earliestCheckinTime: '06:00',
          latestCheckoutTime: '13:30',
          isActive: true
        },
        {
          id: 'afternoon',
          name: 'Afternoon',
          startTime: '13:30',
          endTime: '17:00',
          lateGraceMinutes: 10,
          earlyDepartureToleranceMinutes: 10,
          absenceCutoffMinutes: 90,
          absenceCutoffTime: '15:00',
          earliestCheckinTime: '12:30',
          latestCheckoutTime: '18:30',
          isActive: true
        }
      ],
      staff_working_days: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY',
      staff_work_start_time: '08:00',
      staff_work_end_time: '17:00',
      staff_face_required: true,
      staff_geo_required: true,
    },
    create: {
      id: 'singleton',
      school_name: 'Bright Path',
      school_address: 'Dire Dawa, Ethiopia',
      school_phone: '+251924919853',
      academic_year: '2018 E.C.',
      calendar_type: 'ETHIOPIAN',
      attendance_mode: 'session_based',
      attendance_ui_type: 'card_based',
      attendance_threshold: 75,
      allow_late_mark: true,
      allow_attendance_editing: true,
      allow_outside_attendance: true,
      staff_attendance_mode: 'session_based',
      staff_sessions: [
        {
          id: 'morning',
          name: 'Morning',
          startTime: '08:00',
          endTime: '12:30',
          lateGraceMinutes: 15,
          earlyDepartureToleranceMinutes: 10,
          absenceCutoffMinutes: 90,
          absenceCutoffTime: '09:30',
          earliestCheckinTime: '06:00',
          latestCheckoutTime: '13:30',
          isActive: true
        },
        {
          id: 'afternoon',
          name: 'Afternoon',
          startTime: '13:30',
          endTime: '17:00',
          lateGraceMinutes: 10,
          earlyDepartureToleranceMinutes: 10,
          absenceCutoffMinutes: 90,
          absenceCutoffTime: '15:00',
          earliestCheckinTime: '12:30',
          latestCheckoutTime: '18:30',
          isActive: true
        }
      ],
      staff_working_days: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY',
      staff_work_start_time: '08:00',
      staff_work_end_time: '17:00',
      staff_face_required: true,
      staff_geo_required: true,
    }
  });
  console.log('✓ School Settings configured:', settings.school_name, `(${settings.school_address})`);

  // 2. Create or update Admin User
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@addishiwot.edu.et';
  const adminName = process.env.INITIAL_ADMIN_NAME || 'System Administrator';
  const rawPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123456';
  const adminPhone = process.env.INITIAL_ADMIN_PHONE || '+251911000000';
  const adminAddress = process.env.INITIAL_ADMIN_ADDRESS || 'Dire Dawa, Ethiopia';
  const hashedPassword = bcrypt.hashSync(rawPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      full_name: adminName,
      password_hash: hashedPassword,
      role: 'admin',
      phone: adminPhone,
      address: adminAddress,
      is_active: true,
      is_verified: true,
    },
    create: {
      email: adminEmail,
      full_name: adminName,
      password_hash: hashedPassword,
      role: 'admin',
      phone: adminPhone,
      address: adminAddress,
      is_active: true,
      is_verified: true,
    }
  });
  console.log('✓ Admin user created successfully:', admin.full_name, `(${admin.email})`);

  // 3. Ensure Default System Roles
  const defaultRoles = [
    { key: 'admin', name: 'School Admin', color: '#f43f5e', isSystem: true, sortOrder: 1 },
    { key: 'school_admin', name: 'School Admin', color: '#e11d48', isSystem: true, sortOrder: 2 },
    { key: 'academic_head', name: 'Academic Head / Coordinator', color: '#8b5cf6', isSystem: true, sortOrder: 3 },
    { key: 'teacher', name: 'Teacher', color: '#3b82f6', isSystem: true, sortOrder: 4 },
    { key: 'registrar', name: 'Registrar', color: '#6366f1', isSystem: true, sortOrder: 5 },
    { key: 'discipline_officer', name: 'Discipline Officer', color: '#f59e0b', isSystem: true, sortOrder: 6 },
    { key: 'librarian', name: 'Librarian', color: '#06b6d4', isSystem: true, sortOrder: 7 },
    { key: 'transport_manager', name: 'Transport Manager', color: '#f97316', isSystem: true, sortOrder: 8 },
    { key: 'staff_attendance_officer', name: 'Staff Attendance & HR Officer', color: '#14b8a6', isSystem: true, sortOrder: 9 },
    { key: 'staff', name: 'General Staff', color: '#10b981', isSystem: true, sortOrder: 10 },
    { key: 'parent', name: 'Parent / Guardian', color: '#8b5cf6', isSystem: true, sortOrder: 11 },
  ];

  for (const role of defaultRoles) {
    const existingRole = await prisma.systemRole.findFirst({ where: { key: role.key } });
    if (!existingRole) {
      await prisma.systemRole.create({ data: role });
    }
  }
  console.log('✓ Default system roles registered.');

  // 4. Create Default Academic Year (2018 E.C.)
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 8, 1); // Sept 1
  const yearEnd = new Date(now.getFullYear() + 1, 6, 30); // July 30

  let academicYear = await prisma.academicYear.findFirst({ where: { name: '2018 E.C.' } });
  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: {
        name: '2018 E.C.',
        startDate: yearStart,
        endDate: yearEnd,
        isCurrent: true,
      }
    });

    // Create Terms
    const term1End = new Date(now.getFullYear() + 1, 0, 31);
    const term2Start = new Date(now.getFullYear() + 1, 1, 1);

    await prisma.academicTerm.createMany({
      data: [
        {
          academicYearId: academicYear.id,
          name: 'Semester 1',
          startDate: yearStart,
          endDate: term1End,
          isCurrent: true,
        },
        {
          academicYearId: academicYear.id,
          name: 'Semester 2',
          startDate: term2Start,
          endDate: yearEnd,
          isCurrent: false,
        }
      ]
    });
  }
  console.log('✓ Academic year initialized:', academicYear.name);

  // 5. Default Discipline Categories
  const disciplineCategories = [
    { name: 'Attendance & Lateness', description: 'Tardiness and unexcused absence infractions', isDefault: true },
    { name: 'Disruptive Behavior', description: 'Classroom disturbance and non-compliance', isDefault: true },
    { name: 'Uniform & Dress Code', description: 'School uniform violations', isDefault: true },
    { name: 'Academic Integrity', description: 'Cheating or plagiarism', isDefault: true },
    { name: 'Property Damage', description: 'Misuse or damage to school facilities', isDefault: true },
  ];

  for (const cat of disciplineCategories) {
    const existing = await prisma.disciplineCategory.findUnique({ where: { name: cat.name } });
    if (!existing) {
      await prisma.disciplineCategory.create({ data: cat });
    }
  }
  console.log('✓ Discipline categories initialized.');

  console.log('==================================================');
  console.log('Setup complete! You can now log in:');
  console.log('  Email:    ', adminEmail);
  console.log('  Password: ', rawPassword);
  console.log('  Role:      admin');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('Error during initial setup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
