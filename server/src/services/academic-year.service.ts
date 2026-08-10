import prisma from '../config/db';

export interface CreateAcademicYearInput {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  isCurrent?: boolean;
}

export interface UpdateAcademicYearInput {
  name?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  isCurrent?: boolean;
}

export class AcademicYearService {
  /**
   * Get all academic years for a school sorted by startDate descending
   */
  async getAcademicYears(schoolId: string) {
    let academicYears = await prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
    });

    // Auto-create initial default academic years if school has none
    if (academicYears.length === 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      
      // Default initial records (e.g. 2017 E.C. and 2018 E.C.)
      await prisma.$transaction([
        prisma.academicYear.create({
          data: {
            schoolId,
            name: `${currentYear - 1}/${currentYear} E.C.`,
            startDate: new Date(`${currentYear - 1}-09-11`),
            endDate: new Date(`${currentYear}-07-07`),
            isCurrent: false,
          },
        }),
        prisma.academicYear.create({
          data: {
            schoolId,
            name: `${currentYear}/${currentYear + 1} E.C.`,
            startDate: new Date(`${currentYear}-09-11`),
            endDate: new Date(`${currentYear + 1}-07-07`),
            isCurrent: true,
          },
        }),
      ]);

      academicYears = await prisma.academicYear.findMany({
        where: { schoolId },
        orderBy: { startDate: 'desc' },
      });
    }

    return academicYears;
  }

  /**
   * Get the current active academic year for a school
   */
  async getCurrentAcademicYear(schoolId: string) {
    let current = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });

    if (!current) {
      const allYears = await this.getAcademicYears(schoolId);
      current = allYears.find(y => y.isCurrent) || allYears[0] || null;
    }

    return current;
  }

  /**
   * Create a new academic year
   */
  async createAcademicYear(schoolId: string, data: CreateAcademicYearInput) {
    const { name, startDate, endDate, isCurrent } = data;

    if (!name || !name.trim()) throw new Error('Academic year name is required');
    if (!startDate || !endDate) throw new Error('Start date and End date are required');

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new Error('Start date must be before End date');
    }

    const trimmedName = name.trim();

    // Check duplicate name for school
    const existing = await prisma.academicYear.findUnique({
      where: { schoolId_name: { schoolId, name: trimmedName } },
    });
    if (existing) {
      throw new Error(`Academic year "${trimmedName}" already exists for this school`);
    }

    return await prisma.$transaction(async (tx) => {
      // If setting as current, reset other academic years' isCurrent to false
      if (isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId },
          data: { isCurrent: false },
        });
      }

      const newYear = await tx.academicYear.create({
        data: {
          schoolId,
          name: trimmedName,
          startDate: start,
          endDate: end,
          isCurrent: isCurrent ?? false,
        },
      });

      // Update school settings if active
      if (isCurrent) {
        await tx.schoolSettings.upsert({
          where: { schoolId },
          create: { schoolId, academic_year: trimmedName },
          update: { academic_year: trimmedName },
        });
      }

      return newYear;
    });
  }

  /**
   * Update an existing academic year
   */
  async updateAcademicYear(schoolId: string, id: string, data: UpdateAcademicYearInput) {
    const yearRecord = await prisma.academicYear.findFirst({
      where: { id, schoolId },
    });
    if (!yearRecord) throw new Error('Academic year record not found');

    const updatePayload: any = {};
    if (data.name) updatePayload.name = data.name.trim();
    if (data.startDate) updatePayload.startDate = new Date(data.startDate);
    if (data.endDate) updatePayload.endDate = new Date(data.endDate);

    if (updatePayload.startDate && updatePayload.endDate && updatePayload.startDate >= updatePayload.endDate) {
      throw new Error('Start date must be before End date');
    }

    return await prisma.$transaction(async (tx) => {
      if (data.isCurrent === true) {
        await tx.academicYear.updateMany({
          where: { schoolId },
          data: { isCurrent: false },
        });
        updatePayload.isCurrent = true;
      } else if (data.isCurrent === false && yearRecord.isCurrent) {
        // Don't allow deactivating if it's the only one, or allow it
        updatePayload.isCurrent = false;
      }

      const updated = await tx.academicYear.update({
        where: { id },
        data: updatePayload,
      });

      if (updated.isCurrent) {
        await tx.schoolSettings.upsert({
          where: { schoolId },
          create: { schoolId, academic_year: updated.name },
          update: { academic_year: updated.name },
        });
      }

      return updated;
    });
  }

  /**
   * Set a specific academic year as the single active year for the school
   */
  async activateAcademicYear(schoolId: string, id: string) {
    const target = await prisma.academicYear.findFirst({
      where: { id, schoolId },
    });
    if (!target) throw new Error('Academic year not found');

    return await prisma.$transaction(async (tx) => {
      // 1. Set all to false
      await tx.academicYear.updateMany({
        where: { schoolId },
        data: { isCurrent: false },
      });

      // 2. Set target to true
      const activeYear = await tx.academicYear.update({
        where: { id },
        data: { isCurrent: true },
      });

      // 3. Keep SchoolSettings in sync
      await tx.schoolSettings.upsert({
        where: { schoolId },
        create: { schoolId, academic_year: activeYear.name },
        update: { academic_year: activeYear.name },
      });

      return activeYear;
    });
  }

  /**
   * Delete an academic year record
   */
  async deleteAcademicYear(schoolId: string, id: string) {
    const target = await prisma.academicYear.findFirst({
      where: { id, schoolId },
    });
    if (!target) throw new Error('Academic year not found');
    if (target.isCurrent) throw new Error('Cannot delete the currently active academic year. Activate another academic year first.');

    return await prisma.academicYear.delete({
      where: { id },
    });
  }
}

export const academicYearService = new AcademicYearService();
