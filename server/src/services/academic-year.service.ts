import prisma from '../config/db';

export interface CreateAcademicYearInput {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  isCurrent?: boolean;
  status?: 'FUTURE' | 'ACTIVE' | 'CLOSED';
}

export interface ActiveTermValidationResult {
  allowed: boolean;
  code?: 'NO_ACTIVE_YEAR' | 'NO_ACTIVE_TERM' | 'TERM_INACTIVE' | 'TERM_NOT_STARTED' | 'TERM_ENDED';
  message?: string;
  currentYear?: any;
  activeTerm?: any;
}

export interface UpdateAcademicYearInput {
  name?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  isCurrent?: boolean;
  status?: 'FUTURE' | 'ACTIVE' | 'CLOSED';
}

let cachedActiveAY: { data: any; expiry: number } | null = null;

export class AcademicYearService {
  /**
   * Get all academic years sorted by startDate descending (with terms included)
   */
  async getAcademicYears(_schoolId?: string) {
    let academicYears = await prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        terms: {
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (academicYears.length === 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      
      const prevYearStart = new Date(`${currentYear - 1}-09-11`);
      const prevYearEnd = new Date(`${currentYear}-07-07`);
      const prevMid = new Date(prevYearStart.getTime() + (prevYearEnd.getTime() - prevYearStart.getTime()) / 2);

      const curYearStart = new Date(`${currentYear}-09-11`);
      const curYearEnd = new Date(`${currentYear + 1}-07-07`);
      const curMid = new Date(curYearStart.getTime() + (curYearEnd.getTime() - curYearStart.getTime()) / 2);

      await prisma.$transaction(async (tx) => {
        const y1 = await tx.academicYear.create({
          data: {
            name: `${currentYear - 1}/${currentYear} E.C.`,
            startDate: prevYearStart,
            endDate: prevYearEnd,
            isCurrent: false,
          },
        });
        await tx.academicTerm.createMany({
          data: [
            { academicYearId: y1.id, name: 'Semester 1', startDate: prevYearStart, endDate: prevMid, isCurrent: false },
            { academicYearId: y1.id, name: 'Semester 2', startDate: new Date(prevMid.getTime() + 86400000), endDate: prevYearEnd, isCurrent: false },
          ],
        });

        const y2 = await tx.academicYear.create({
          data: {
            name: `${currentYear}/${currentYear + 1} E.C.`,
            startDate: curYearStart,
            endDate: curYearEnd,
            isCurrent: true,
          },
        });
        await tx.academicTerm.createMany({
          data: [
            { academicYearId: y2.id, name: 'Semester 1', startDate: curYearStart, endDate: curMid, isCurrent: true },
            { academicYearId: y2.id, name: 'Semester 2', startDate: new Date(curMid.getTime() + 86400000), endDate: curYearEnd, isCurrent: false },
          ],
        });
      });

      academicYears = await prisma.academicYear.findMany({
        orderBy: { startDate: 'desc' },
        include: {
          terms: {
            orderBy: { startDate: 'asc' },
          },
        },
      });
    }

    // Ensure any existing academic years without terms get default terms seeded
    let seededAny = false;
    for (const year of academicYears) {
      if (!year.terms || year.terms.length === 0) {
        const start = new Date(year.startDate);
        const end = new Date(year.endDate);
        const midPoint = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
        
        await prisma.academicTerm.createMany({
          data: [
            {
              academicYearId: year.id,
              name: 'Semester 1',
              startDate: start,
              endDate: midPoint,
              isCurrent: year.isCurrent,
            },
            {
              academicYearId: year.id,
              name: 'Semester 2',
              startDate: new Date(midPoint.getTime() + 86400000),
              endDate: end,
              isCurrent: false,
            },
          ],
        }).catch(() => {});
        seededAny = true;
      }
    }

    if (seededAny) {
      academicYears = await prisma.academicYear.findMany({
        orderBy: { startDate: 'desc' },
        include: {
          terms: {
            orderBy: { startDate: 'asc' },
          },
        },
      });
    }

    return academicYears;
  }

  public invalidateCurrentCache() {
    cachedActiveAY = null;
  }

  /**
   * Get the current active academic year (cached in-memory for 5 minutes, with terms included)
   */
  async getCurrentAcademicYear(_schoolId?: string) {
    const now = Date.now();
    if (cachedActiveAY && cachedActiveAY.expiry > now) {
      return cachedActiveAY.data;
    }

    let current = await prisma.academicYear.findFirst({
      where: { isCurrent: true },
      include: {
        terms: {
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!current) {
      const allYears = await this.getAcademicYears();
      current = allYears.find(y => y.isCurrent) || allYears[0] || null;
    }

    cachedActiveAY = { data: current, expiry: now + 5 * 60 * 1000 };
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
        // Deactivate all existing active years (both isCurrent and orphaned status='ACTIVE')
        await tx.academicYear.updateMany({
          where: { NOT: { status: 'CLOSED' as any } },
          data: { isCurrent: false, status: 'FUTURE' as any },
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

      // Automatically create Semester 1 & Semester 2 for the academic year
      const midPoint = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
      await tx.academicTerm.createMany({
        data: [
          {
            academicYearId: newYear.id,
            name: 'Semester 1',
            startDate: start,
            endDate: midPoint,
            isCurrent: isCurrent ?? false,
          },
          {
            academicYearId: newYear.id,
            name: 'Semester 2',
            startDate: new Date(midPoint.getTime() + 86400000),
            endDate: end,
            isCurrent: false,
          },
        ],
      });

      if (isCurrent) {
        await tx.schoolSettings.upsert({
          where: { id: 'singleton' },
          create: { id: 'singleton', academic_year: trimmedName },
          update: { academic_year: trimmedName },
        });
      }

      this.invalidateCurrentCache();
      return await tx.academicYear.findUnique({
        where: { id: newYear.id },
        include: {
          terms: {
            orderBy: { startDate: 'asc' },
          },
        },
      });
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
    if ((yearRecord as any).status === 'CLOSED') {
      throw new Error('Cannot edit a closed academic year. Historical records are read-only.');
    }

    const updatePayload: any = {};
    if (data.name) updatePayload.name = data.name.trim();
    if (data.status && data.status !== 'CLOSED') {
      // Direct status update (except CLOSED, which should use closeAcademicYear)
      updatePayload.status = data.status;
    }
    if (data.startDate) updatePayload.startDate = new Date(data.startDate);
    if (data.endDate) updatePayload.endDate = new Date(data.endDate);

    if (updatePayload.startDate && updatePayload.endDate && updatePayload.startDate >= updatePayload.endDate) {
      throw new Error('Start date must be before End date');
    }

    return await prisma.$transaction(async (tx) => {
      if (data.isCurrent === true) {
        // Deactivate all other years (both isCurrent and orphaned status='ACTIVE')
        await tx.academicYear.updateMany({
          where: { NOT: [{ id }, { status: 'CLOSED' as any }] },
          data: { isCurrent: false, status: 'FUTURE' as any },
        });
        updatePayload.isCurrent = true;
        updatePayload.status = 'ACTIVE';
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
      return await tx.academicYear.findUnique({
        where: { id: updated.id },
        include: {
          terms: {
            orderBy: { startDate: 'asc' },
          },
        },
      });
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
    if ((target as any).status === 'CLOSED') {
      throw new Error('Cannot reactivate a closed academic year.');
    }

    return await prisma.$transaction(async (tx) => {
      // Revert ALL currently active years to FUTURE (both isCurrent=true AND orphaned status='ACTIVE'), preserving CLOSED years
      await tx.academicYear.updateMany({
        where: { OR: [{ isCurrent: true }, { status: 'ACTIVE' as any }], NOT: { status: 'CLOSED' as any } },
        data: { isCurrent: false, status: 'FUTURE' as any },
      });

      const activeYear = await tx.academicYear.update({
        where: { id },
        data: { isCurrent: true, status: 'ACTIVE' as any },
      });

      await tx.schoolSettings.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', academic_year: activeYear.name },
        update: { academic_year: activeYear.name },
      });

      this.invalidateCurrentCache();
      return await tx.academicYear.findUnique({
        where: { id: activeYear.id },
        include: {
          terms: {
            orderBy: { startDate: 'asc' },
          },
        },
      });
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
  /**
   * Close an academic year — marks it as read-only historical record.
   */
  async closeAcademicYear(_schoolId: string | undefined, id: string) {
    const target = await prisma.academicYear.findUnique({
      where: { id },
    });
    if (!target) throw new Error('Academic year not found');
    if ((target as any).status === 'CLOSED') {
      throw new Error('This academic year is already closed.');
    }

    return await prisma.$transaction(async (tx) => {
      const closed = await tx.academicYear.update({
        where: { id },
        data: {
          status: 'CLOSED' as any,
          isCurrent: false,
        },
      });

      if (target.isCurrent) {
        await tx.schoolSettings.upsert({
          where: { id: 'singleton' },
          create: { id: 'singleton', academic_year: '' },
          update: { academic_year: '' },
        }).catch(() => {});
      }

      this.invalidateCurrentCache();
      return await tx.academicYear.findUnique({
        where: { id: closed.id },
        include: {
          terms: {
            orderBy: { startDate: 'asc' },
          },
        },
      });
    });
  }

  async deleteAcademicYear(_schoolId: string | undefined, id: string) {
    const target = await prisma.academicYear.findUnique({
      where: { id },
    });
    if (!target) throw new Error('Academic year not found');
    if (target.isCurrent) throw new Error('Cannot delete the currently active academic year. Activate another academic year first.');
    if ((target as any).status === 'CLOSED') {
      throw new Error('Cannot delete a closed academic year. Historical records are preserved.');
    }

    return await prisma.academicYear.delete({
      where: { id },
    });
  }


  /**
   * Get the active academic term (from current year or specified year)
   */
  async getActiveAcademicTerm(academicYearId?: string) {
    let year = null;
    if (academicYearId) {
      year = await prisma.academicYear.findUnique({
        where: { id: academicYearId },
        include: {
          terms: { orderBy: { startDate: 'asc' } },
        },
      });
    } else {
      year = await this.getCurrentAcademicYear();
    }
    if (!year) return null;
    return year.terms?.find((t: any) => t.isCurrent) || null;
  }

  /**
   * Validate if mark entry is allowed for the target academic year and term
   */
  async validateMarkEntryWindow(
    targetTermId?: string,
    targetYearId?: string,
    now: Date = new Date()
  ): Promise<ActiveTermValidationResult> {
    const currentYear = await this.getCurrentAcademicYear();
    if (!currentYear) {
      return {
        allowed: false,
        code: 'NO_ACTIVE_YEAR',
        message: 'No active academic year is configured. Please contact the school administrator.',
      };
    }

    if (targetYearId && targetYearId !== currentYear.id) {
      return {
        allowed: false,
        code: 'TERM_INACTIVE',
        message: 'Marks can only be entered or modified for the currently active academic term.',
        currentYear,
      };
    }

    const activeTerm = currentYear.terms?.find((t: any) => t.isCurrent);
    if (!activeTerm) {
      return {
        allowed: false,
        code: 'NO_ACTIVE_TERM',
        message: 'No active academic term is configured. Please contact the school administrator.',
        currentYear,
      };
    }

    if (targetTermId && targetTermId !== activeTerm.id) {
      return {
        allowed: false,
        code: 'TERM_INACTIVE',
        message: 'Marks can only be entered or modified for the currently active academic term.',
        currentYear,
        activeTerm,
      };
    }

    // Check term start date
    const startDate = new Date(activeTerm.startDate);
    if (now.getTime() < startDate.getTime()) {
      return {
        allowed: false,
        code: 'TERM_NOT_STARTED',
        message: 'The academic term has not started yet. Mark entry is not available.',
        currentYear,
        activeTerm,
      };
    }

    // Check term end date (inclusive through the end of the day if set at 00:00:00.000Z)
    const endDate = new Date(activeTerm.endDate);
    let endTimestamp = endDate.getTime();
    if (
      endDate.getUTCHours() === 0 &&
      endDate.getUTCMinutes() === 0 &&
      endDate.getUTCSeconds() === 0 &&
      endDate.getUTCMilliseconds() === 0
    ) {
      endTimestamp += 24 * 60 * 60 * 1000 - 1; // 23:59:59.999
    }

    if (now.getTime() > endTimestamp) {
      return {
        allowed: false,
        code: 'TERM_ENDED',
        message: 'The academic term has ended. Mark entry is no longer available.',
        currentYear,
        activeTerm,
      };
    }

    return {
      allowed: true,
      currentYear,
      activeTerm,
    };
  }

  // ─── Academic Term Management ─────────────────────────────────────────────

  async getTerms(academicYearId: string) {
    return await prisma.academicTerm.findMany({
      where: { academicYearId },
      orderBy: { startDate: 'asc' },
    });
  }

  async createTerm(academicYearId: string, data: { name: string; startDate: string | Date; endDate: string | Date; isCurrent?: boolean }) {
    const parentYear = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
    if (!parentYear) throw new Error('Academic year not found');
    if ((parentYear as any).status === 'CLOSED') {
      throw new Error('Cannot add terms to a closed academic year.');
    }
    const { name, startDate, endDate, isCurrent } = data;
    if (!name || !name.trim()) throw new Error('Term name is required');
    if (!startDate || !endDate) throw new Error('Start date and End date are required');

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) throw new Error('Start date must be before End date');

    const trimmedName = name.trim();
    const existing = await prisma.academicTerm.findFirst({
      where: { academicYearId, name: trimmedName },
    });
    if (existing) {
      throw new Error(`A term named "${trimmedName}" already exists in this academic year`);
    }

    return await prisma.$transaction(async (tx) => {
      if (isCurrent) {
        await tx.academicTerm.updateMany({
          where: { academicYearId },
          data: { isCurrent: false },
        });
      }

      this.invalidateCurrentCache();
      return await tx.academicTerm.create({
        data: {
          academicYearId,
          name: trimmedName,
          startDate: start,
          endDate: end,
          isCurrent: isCurrent ?? false,
        },
      });
    });
  }

  async updateTerm(id: string, data: { name?: string; startDate?: string | Date; endDate?: string | Date; isCurrent?: boolean }) {
    const term = await prisma.academicTerm.findUnique({ where: { id }, include: { academicYear: true } });
    if (!term) throw new Error('Academic term not found');
    if ((term.academicYear as any).status === 'CLOSED') {
      throw new Error('Cannot modify terms of a closed academic year.');
    }

    const updatePayload: any = {};
    if (data.name) updatePayload.name = data.name.trim();
    if (data.startDate) updatePayload.startDate = new Date(data.startDate);
    if (data.endDate) updatePayload.endDate = new Date(data.endDate);

    if (updatePayload.startDate && updatePayload.endDate && updatePayload.startDate >= updatePayload.endDate) {
      throw new Error('Start date must be before End date');
    }

    return await prisma.$transaction(async (tx) => {
      if (data.isCurrent === true) {
        await tx.academicTerm.updateMany({
          where: { academicYearId: term.academicYearId },
          data: { isCurrent: false },
        });
        updatePayload.isCurrent = true;
      } else if (data.isCurrent === false) {
        updatePayload.isCurrent = false;
      }

      this.invalidateCurrentCache();
      return await tx.academicTerm.update({
        where: { id },
        data: updatePayload,
      });
    });
  }

  async deleteTerm(id: string) {
    const term = await prisma.academicTerm.findUnique({ where: { id }, include: { academicYear: true } });
    if (!term) throw new Error('Academic term not found');
    if ((term.academicYear as any).status === 'CLOSED') {
      throw new Error('Cannot delete terms of a closed academic year.');
    }

    this.invalidateCurrentCache();
    return await prisma.academicTerm.delete({
      where: { id },
    });
  }
}

export const academicYearService = new AcademicYearService();
