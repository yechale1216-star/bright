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
   * Get all academic years sorted by startDate descending
   */
  async getAcademicYears(_schoolId?: string) {
    let academicYears = await prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
    });

    if (academicYears.length === 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      
      await prisma.$transaction([
        prisma.academicYear.create({
          data: {
            name: `${currentYear - 1}/${currentYear} E.C.`,
            startDate: new Date(`${currentYear - 1}-09-11`),
            endDate: new Date(`${currentYear}-07-07`),
            isCurrent: false,
          },
        }),
        prisma.academicYear.create({
          data: {
            name: `${currentYear}/${currentYear + 1} E.C.`,
            startDate: new Date(`${currentYear}-09-11`),
            endDate: new Date(`${currentYear + 1}-07-07`),
            isCurrent: true,
          },
        }),
      ]);

      academicYears = await prisma.academicYear.findMany({
        orderBy: { startDate: 'desc' },
      });
    }

    return academicYears;
  }

  private cachedActiveAY: { data: any; expiry: number } | null = null;

  public invalidateCurrentCache() {
    this.cachedActiveAY = null;
  }

  /**
   * Get the current active academic year (cached in-memory for 5 minutes)
   */
  async getCurrentAcademicYear(_schoolId?: string) {
    const now = Date.now();
    if (this.cachedActiveAY && this.cachedActiveAY.expiry > now) {
      return this.cachedActiveAY.data;
    }

    let current = await prisma.academicYear.findFirst({
      where: { isCurrent: true },
    });

    if (!current) {
      const allYears = await this.getAcademicYears();
      current = allYears.find(y => y.isCurrent) || allYears[0] || null;
    }

    this.cachedActiveAY = { data: current, expiry: now + 5 * 60 * 1000 };
    return current;
  }

  /**
   * Create a new academic year
   */
  async createAcademicYear(_schoolId?: string, data?: any) {
    const input: CreateAcademicYearInput = data;
    const { name, startDate, endDate, isCurrent } = input;

    if (!name || !name.trim()) throw new Error('Academic year name is required');
    if (!startDate || !endDate) throw new Error('Start date and End date are required');

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new Error('Start date must be before End date');
    }

    const trimmedName = name.trim();

    const existing = await prisma.academicYear.findUnique({
      where: { name: trimmedName },
    });
    if (existing) {
      throw new Error(`Academic year "${trimmedName}" already exists`);
    }

    return await prisma.$transaction(async (tx) => {
      if (isCurrent) {
        await tx.academicYear.updateMany({
          data: { isCurrent: false },
        });
      }

      const newYear = await tx.academicYear.create({
        data: {
          name: trimmedName,
          startDate: start,
          endDate: end,
          isCurrent: isCurrent ?? false,
        },
      });

      if (isCurrent) {
        await tx.schoolSettings.upsert({
          where: { id: 'singleton' },
          create: { id: 'singleton', academic_year: trimmedName },
          update: { academic_year: trimmedName },
        });
      }

      this.invalidateCurrentCache();
      return newYear;
    });
  }

  /**
   * Update an existing academic year
   */
  async updateAcademicYear(_schoolId: string | undefined, id: string, data: UpdateAcademicYearInput) {
    const yearRecord = await prisma.academicYear.findUnique({
      where: { id },
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
          data: { isCurrent: false },
        });
        updatePayload.isCurrent = true;
      } else if (data.isCurrent === false && yearRecord.isCurrent) {
        updatePayload.isCurrent = false;
      }

      const updated = await tx.academicYear.update({
        where: { id },
        data: updatePayload,
      });

      if (updated.isCurrent) {
        await tx.schoolSettings.upsert({
          where: { id: 'singleton' },
          create: { id: 'singleton', academic_year: updated.name },
          update: { academic_year: updated.name },
        });
      }

      this.invalidateCurrentCache();
      return updated;
    });
  }

  /**
   * Set a specific academic year as the single active year
   */
  async activateAcademicYear(_schoolId: string | undefined, id: string) {
    const target = await prisma.academicYear.findUnique({
      where: { id },
    });
    if (!target) throw new Error('Academic year not found');

    return await prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        data: { isCurrent: false },
      });

      const activeYear = await tx.academicYear.update({
        where: { id },
        data: { isCurrent: true },
      });

      await tx.schoolSettings.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', academic_year: activeYear.name },
        update: { academic_year: activeYear.name },
      });

      this.invalidateCurrentCache();
      return activeYear;
    });
  }

  /**
   * Ensure there is an active academic year; throws if none found.
   */
  async ensureActiveAcademicYear(_schoolId?: string) {
    const active = await this.getCurrentAcademicYear();
    if (!active) {
      throw new Error(
        'No active academic year is configured. Please activate an academic year before performing this operation.'
      );
    }
    return active;
  }

  /**
   * Delete an academic year record
   */
  async deleteAcademicYear(_schoolId: string | undefined, id: string) {
    const target = await prisma.academicYear.findUnique({
      where: { id },
    });
    if (!target) throw new Error('Academic year not found');
    if (target.isCurrent) throw new Error('Cannot delete the currently active academic year. Activate another academic year first.');

    return await prisma.academicYear.delete({
      where: { id },
    });
  }
}

export const academicYearService = new AcademicYearService();
