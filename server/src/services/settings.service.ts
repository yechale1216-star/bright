import prisma from '../config/db';

const DEFAULT_SETTINGS = {
  school_name: '',
  school_phone: '',
  school_address: '',
  academic_year: '2017/2018 E.C.',
  calendar_type: 'ETHIOPIAN',
  attendance_mode: 'session_based',
  attendance_ui_type: 'card_based',
  attendance_threshold: 75,
  allow_late_mark: true,
  email_notifications: true,
  sms_notifications: false,
  notification_time: '16:00',
  school_logo: '',
  allow_attendance_editing: true,
  restrict_location: false,
  school_latitude: null,
  school_longitude: null,
  allowed_radius_meters: 200,
  allow_outside_attendance: true,
};

export const getSettings = async (schoolId: string) => {
  let settings = await prisma.schoolSettings.findUnique({ where: { schoolId: schoolId } });
  if (!settings) {
    // Auto-create defaults on first access
    settings = await prisma.schoolSettings.create({
      data: { ...DEFAULT_SETTINGS, schoolId: schoolId },
    });
  }

  // Ensure settings.academic_year reflects the currently active AcademicYear record
  const activeAY = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    select: { name: true }
  });

  if (activeAY && activeAY.name) {
    settings.academic_year = activeAY.name;
  }

  return settings;
};

export const updateSettings = async (schoolId: string, data: any) => {
  const settings = await prisma.schoolSettings.upsert({
    where: { schoolId: schoolId },
    create: { ...DEFAULT_SETTINGS, ...data, schoolId: schoolId },
    update: data,
  });

  // Keep School table in sync if name changed
  if (data.school_name) {
    await prisma.school.update({
      where: { id: schoolId },
      data: { name: data.school_name }
    });
  }

  // Keep AcademicYear table in sync if academic_year changed
  if (data.academic_year) {
    const ayName = String(data.academic_year).trim();
    if (ayName) {
      await prisma.$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { schoolId },
          data: { isCurrent: false },
        });
        await tx.academicYear.upsert({
          where: { schoolId_name: { schoolId, name: ayName } },
          create: {
            schoolId,
            name: ayName,
            startDate: new Date(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            isCurrent: true,
          },
          update: { isCurrent: true },
        });
      });
    }
  }

  return settings;
};
