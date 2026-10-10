import prisma from '../config/db';

export interface AssessmentTypeInput {
  name: string;
  code?: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface CategoryInput {
  id?: string;
  name: string;
  weight: number;
  typeId?: string | null;
  aggregationMethod?: string;
  orderIndex?: number;
}

export interface SchemeInput {
  name: string;
  description?: string;
  academicYearId?: string | null;
  isTemplate?: boolean;
  isDefault?: boolean;
  categories: CategoryInput[];
}

export interface SchemeAssignmentInput {
  schemeId: string;
  academicYearId: string;
  academicTermId?: string | null;
  gradeId?: string | null;
  streamId?: string | null;
  subjectId?: string | null;
}

export class AssessmentPolicyService {
  // ─── Assessment Types ──────────────────────────────────────────────────────

  static async seedDefaultTypes() {
    const defaults = [
      { name: 'Quiz', code: 'QUIZ', orderIndex: 1, isSystem: true },
      { name: 'Assignment / Homework', code: 'ASSIGNMENT', orderIndex: 2, isSystem: true },
      { name: 'Classwork', code: 'CLASSWORK', orderIndex: 3, isSystem: true },
      { name: 'Test', code: 'TEST', orderIndex: 4, isSystem: true },
      { name: 'Midterm Examination', code: 'MIDTERM', orderIndex: 5, isSystem: true },
      { name: 'Project / Practical', code: 'PROJECT', orderIndex: 6, isSystem: true },
      { name: 'Final Examination', code: 'FINAL', orderIndex: 7, isSystem: true },
    ];

    for (const item of defaults) {
      await prisma.assessmentType.upsert({
        where: { code: item.code },
        update: { name: item.name, orderIndex: item.orderIndex },
        create: item,
      });
    }

    return prisma.assessmentType.findMany({
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    });
  }

  static async getAssessmentTypes(includeInactive: boolean = false) {
    const count = await prisma.assessmentType.count();
    if (count === 0) {
      await this.seedDefaultTypes();
    }

    return prisma.assessmentType.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        _count: {
          select: { assessments: true, categories: true },
        },
      },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    });
  }

  static async createAssessmentType(data: AssessmentTypeInput) {
    const trimmedName = data.name?.trim();
    if (!trimmedName) throw new Error('Assessment type name is required');

    const code = (data.code?.trim() || trimmedName.toUpperCase().replace(/[^A-Z0-9]/g, '_')).slice(0, 30);
    const existing = await prisma.assessmentType.findUnique({ where: { code } });
    if (existing) {
      throw new Error(`Assessment type with code "${code}" already exists.`);
    }

    return prisma.assessmentType.create({
      data: {
        name: trimmedName,
        code,
        description: data.description?.trim() || null,
        orderIndex: data.orderIndex ?? 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  static async updateAssessmentType(id: string, data: Partial<AssessmentTypeInput>) {
    const type = await prisma.assessmentType.findUnique({ where: { id } });
    if (!type) throw new Error('Assessment type not found');

    return prisma.assessmentType.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.orderIndex !== undefined ? { orderIndex: Number(data.orderIndex) } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      },
    });
  }

  static async deleteAssessmentType(id: string) {
    const [assessmentCount, categoryCount] = await Promise.all([
      prisma.assessment.count({ where: { typeId: id } }),
      prisma.assessmentCategory.count({ where: { typeId: id } }),
    ]);

    if (assessmentCount > 0 || categoryCount > 0) {
      // Historical safety: soft deactivate instead of deleting
      await prisma.assessmentType.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        deactivated: true,
        message: `Assessment type is used in ${assessmentCount} assessment(s) and has been deactivated rather than permanently deleted.`,
      };
    }

    await prisma.assessmentType.delete({ where: { id } });
    return { deactivated: false, message: 'Assessment type removed successfully.' };
  }

  // ─── Assessment Weight Schemes / Policies ──────────────────────────────────

  static validateCategoryWeights(categories: Array<{ name?: string; weight: number | string; [key: string]: any }>) {
    if (!categories || categories.length === 0) {
      throw new Error('At least one assessment category is required');
    }

    let totalWeight = 0;
    for (const cat of categories) {
      const weight = Number(cat.weight);
      if (isNaN(weight) || weight <= 0) {
        throw new Error(`Category "${cat.name}" must have a positive weight.`);
      }
      totalWeight += weight;
    }

    // Floating-point safe check for 100%
    const roundedTotal = Math.round(totalWeight * 100) / 100;
    if (Math.abs(roundedTotal - 100) > 0.01) {
      throw new Error(
        `Category weights must total exactly 100%. Current total: ${roundedTotal}%.`
      );
    }
  }

  static async getSchemes(filters?: { academicYearId?: string; isTemplate?: boolean }) {
    const where: any = {};
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.isTemplate !== undefined) where.isTemplate = filters.isTemplate;

    return prisma.assessmentWeightScheme.findMany({
      where,
      include: {
        academicYear: { select: { id: true, name: true } },
        categories: {
          include: { type: { select: { id: true, name: true, code: true } } },
          orderBy: { orderIndex: 'asc' },
        },
        assignments: {
          include: {
            academicYear: { select: { id: true, name: true } },
            academicTerm: { select: { id: true, name: true } },
            grade: { select: { id: true, name: true } },
            stream: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
        },
        _count: { select: { assessments: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  static async getSchemeById(id: string) {
    const scheme = await prisma.assessmentWeightScheme.findUnique({
      where: { id },
      include: {
        academicYear: { select: { id: true, name: true } },
        categories: {
          include: { type: { select: { id: true, name: true, code: true } } },
          orderBy: { orderIndex: 'asc' },
        },
        assignments: {
          include: {
            academicYear: { select: { id: true, name: true } },
            academicTerm: { select: { id: true, name: true } },
            grade: { select: { id: true, name: true } },
            stream: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
        },
        _count: { select: { assessments: true } },
      },
    });

    if (!scheme) throw new Error('Assessment policy scheme not found');
    return scheme;
  }

  static async createScheme(data: SchemeInput) {
    const trimmedName = data.name?.trim();
    if (!trimmedName) throw new Error('Scheme name is required');

    this.validateCategoryWeights(data.categories);

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.assessmentWeightScheme.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const scheme = await tx.assessmentWeightScheme.create({
        data: {
          name: trimmedName,
          description: data.description?.trim() || null,
          academicYearId: data.academicYearId || null,
          isTemplate: data.isTemplate ?? false,
          isDefault: data.isDefault ?? false,
        },
      });

      for (let i = 0; i < data.categories.length; i++) {
        const cat = data.categories[i];
        await tx.assessmentCategory.create({
          data: {
            schemeId: scheme.id,
            name: cat.name.trim(),
            weight: Number(cat.weight),
            typeId: cat.typeId || null,
            aggregationMethod: cat.aggregationMethod || 'COMBINED_MARKS',
            orderIndex: cat.orderIndex ?? i,
          },
        });
      }

      return tx.assessmentWeightScheme.findUnique({
        where: { id: scheme.id },
        include: {
          categories: {
            include: { type: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
    });
  }

  static async updateScheme(id: string, data: Partial<SchemeInput>) {
    const existing = await prisma.assessmentWeightScheme.findUnique({
      where: { id },
      include: { categories: true },
    });
    if (!existing) throw new Error('Assessment policy scheme not found');

    if (existing.isLocked) {
      throw new Error('This assessment policy is locked because official published results depend on it.');
    }

    if (data.categories) {
      this.validateCategoryWeights(data.categories);
    }

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.assessmentWeightScheme.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      await tx.assessmentWeightScheme.update({
        where: { id },
        data: {
          ...(data.name ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
          ...(data.academicYearId !== undefined ? { academicYearId: data.academicYearId || null } : {}),
          ...(data.isTemplate !== undefined ? { isTemplate: Boolean(data.isTemplate) } : {}),
          ...(data.isDefault !== undefined ? { isDefault: Boolean(data.isDefault) } : {}),
        },
      });

      if (data.categories) {
        // Replace categories safely
        await tx.assessmentCategory.deleteMany({ where: { schemeId: id } });
        for (let i = 0; i < data.categories.length; i++) {
          const cat = data.categories[i];
          await tx.assessmentCategory.create({
            data: {
              schemeId: id,
              name: cat.name.trim(),
              weight: Number(cat.weight),
              typeId: cat.typeId || null,
              aggregationMethod: cat.aggregationMethod || 'COMBINED_MARKS',
              orderIndex: cat.orderIndex ?? i,
            },
          });
        }
      }

      return tx.assessmentWeightScheme.findUnique({
        where: { id },
        include: {
          categories: {
            include: { type: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
    });
  }

  static async deleteScheme(id: string) {
    const scheme = await prisma.assessmentWeightScheme.findUnique({
      where: { id },
      include: {
        _count: { select: { assessments: true, assignments: true } },
      },
    });
    if (!scheme) throw new Error('Scheme not found');

    if (scheme.isLocked) {
      throw new Error('Cannot delete locked assessment scheme used in published records.');
    }

    if (scheme._count.assessments > 0) {
      throw new Error(`Cannot delete scheme: ${scheme._count.assessments} active assessment(s) are linked to it.`);
    }

    return prisma.assessmentWeightScheme.delete({ where: { id } });
  }

  // ─── Scheme Assignments ───────────────────────────────────────────────────

  static async assignScheme(data: SchemeAssignmentInput) {
    const { schemeId, academicYearId, academicTermId, gradeId, streamId, subjectId } = data;

    const scheme = await prisma.assessmentWeightScheme.findUnique({ where: { id: schemeId } });
    if (!scheme) throw new Error('Assessment scheme not found');

    // Prevent duplicate configuration
    const existing = await prisma.assessmentSchemeAssignment.findFirst({
      where: {
        academicYearId,
        academicTermId: academicTermId || null,
        gradeId: gradeId || null,
        streamId: streamId || null,
        subjectId: subjectId || null,
      },
    });

    if (existing) {
      return prisma.assessmentSchemeAssignment.update({
        where: { id: existing.id },
        data: { schemeId },
        include: {
          scheme: { include: { categories: true } },
          grade: true,
          subject: true,
        },
      });
    }

    return prisma.assessmentSchemeAssignment.create({
      data: {
        schemeId,
        academicYearId,
        academicTermId: academicTermId || null,
        gradeId: gradeId || null,
        streamId: streamId || null,
        subjectId: subjectId || null,
      },
      include: {
        scheme: { include: { categories: true } },
        grade: true,
        subject: true,
      },
    });
  }

  static async deleteSchemeAssignment(id: string) {
    return prisma.assessmentSchemeAssignment.delete({ where: { id } });
  }

  /**
   * Resolve authoritative assessment policy scheme for a given classroom context
   * Hierarchical matching:
   * 1. Specific Grade + Subject + Stream + Term
   * 2. Specific Grade + Subject + Term
   * 3. Specific Grade + Subject
   * 4. Specific Grade + Term
   * 5. Specific Grade
   * 6. Academic Year default
   * 7. System default template
   */
  static async resolveSchemeForContext(params: {
    academicYearId: string;
    academicTermId?: string;
    gradeId?: string;
    streamId?: string;
    subjectId?: string;
  }) {
    const { academicYearId, academicTermId, gradeId, streamId, subjectId } = params;

    const allAssignments = await prisma.assessmentSchemeAssignment.findMany({
      where: { academicYearId },
      include: {
        scheme: {
          include: {
            categories: {
              include: { type: true },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    // Score and match
    let bestMatch: any = null;
    let highestScore = -1;

    for (const a of allAssignments) {
      let score = 0;
      let matches = true;

      if (a.subjectId) {
        if (a.subjectId === subjectId) score += 10;
        else matches = false;
      }
      if (a.streamId) {
        if (a.streamId === streamId) score += 5;
        else matches = false;
      }
      if (a.gradeId) {
        if (a.gradeId === gradeId) score += 4;
        else matches = false;
      }
      if (a.academicTermId) {
        if (a.academicTermId === academicTermId) score += 2;
        else matches = false;
      }

      if (matches && score > highestScore) {
        highestScore = score;
        bestMatch = a.scheme;
      }
    }

    if (bestMatch && bestMatch.categories?.length > 0) {
      return bestMatch;
    }

    // Fallback: look for year-level scheme or default template
    const defaultScheme = await prisma.assessmentWeightScheme.findFirst({
      where: {
        OR: [
          { academicYearId, isDefault: true },
          { isDefault: true },
          { isTemplate: true },
        ],
      },
      include: {
        categories: {
          include: { type: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    if (defaultScheme && defaultScheme.categories?.length > 0) {
      return defaultScheme;
    }

    // Auto-create a default 100% policy template if completely empty
    return this.ensureDefaultPolicyScheme(academicYearId);
  }

  static async duplicateScheme(id: string) {
    const original = await prisma.assessmentWeightScheme.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!original) throw new Error('Source assessment scheme not found');

    const copyName = `${original.name} (Copy)`;

    return prisma.$transaction(async (tx) => {
      const copy = await tx.assessmentWeightScheme.create({
        data: {
          name: copyName,
          description: original.description ? `Copy of ${original.description}` : null,
          academicYearId: original.academicYearId,
          isTemplate: true,
          isDefault: false,
          isLocked: false,
        },
      });

      for (const cat of original.categories) {
        await tx.assessmentCategory.create({
          data: {
            schemeId: copy.id,
            name: cat.name,
            weight: cat.weight,
            typeId: cat.typeId,
            aggregationMethod: cat.aggregationMethod,
            orderIndex: cat.orderIndex,
          },
        });
      }

      return tx.assessmentWeightScheme.findUnique({
        where: { id: copy.id },
        include: {
          categories: {
            include: { type: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
    });
  }

  // ─── Bulk Template Assignment ─────────────────────────────────────────────

  static async previewBulkAssignment(data: {
    schemeId: string;
    academicYearId: string;
    academicTermId?: string | null;
    targets: { gradeId: string; streamId?: string | null; subjectId: string }[];
    policy?: 'SKIP_EXISTING' | 'UPDATE_EXISTING';
  }) {
    const { schemeId, academicYearId, academicTermId, targets, policy = 'SKIP_EXISTING' } = data;

    const template = await prisma.assessmentWeightScheme.findUnique({
      where: { id: schemeId },
      include: {
        categories: {
          include: { type: { select: { id: true, name: true, code: true } } },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!template) throw new Error('Assessment template scheme not found');
    this.validateCategoryWeights(template.categories);

    if (!targets || targets.length === 0) {
      throw new Error('At least one grade-subject target is required');
    }

    // Collect IDs for batch querying
    const gradeIds = Array.from(new Set(targets.map((t) => t.gradeId).filter(Boolean)));
    const streamIds = Array.from(new Set(targets.map((t) => t.streamId).filter(Boolean) as string[]));
    const subjectIds = Array.from(new Set(targets.map((t) => t.subjectId).filter(Boolean)));

    const [grades, streams, subjects, academicYear, academicTerm, existingAssignments] = await Promise.all([
      prisma.grade.findMany({ where: { id: { in: gradeIds } }, select: { id: true, name: true } }),
      streamIds.length > 0 ? prisma.stream.findMany({ where: { id: { in: streamIds } }, select: { id: true, name: true } }) : [],
      prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, code: true } }),
      prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true, name: true } }),
      academicTermId ? prisma.academicTerm.findUnique({ where: { id: academicTermId }, select: { id: true, name: true } }) : null,
      prisma.assessmentSchemeAssignment.findMany({
        where: {
          academicYearId,
          ...(academicTermId ? { academicTermId } : {}),
          gradeId: { in: gradeIds },
          subjectId: { in: subjectIds },
        },
        include: {
          scheme: {
            include: {
              categories: {
                include: { type: true },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
          grade: { select: { id: true, name: true } },
          stream: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      }),
    ]);

    const gradeMap = new Map(grades.map((g) => [g.id, g.name]));
    const streamMap = new Map(streams.map((s) => [s.id, s.name]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

    let toCreate = 0;
    let toSkip = 0;
    let toUpdate = 0;
    let alreadyAssigned = 0;
    let lockedCount = 0;

    const items = targets.map((t) => {
      const gradeName = gradeMap.get(t.gradeId) || 'Unknown Grade';
      const streamName = t.streamId ? (streamMap.get(t.streamId) || 'Stream') : null;
      const subjectName = subjectMap.get(t.subjectId) || 'Unknown Subject';

      // Match existing assignment
      const existing = existingAssignments.find(
        (ea) =>
          ea.gradeId === t.gradeId &&
          (ea.streamId || null) === (t.streamId || null) &&
          ea.subjectId === t.subjectId &&
          (academicTermId ? ea.academicTermId === academicTermId : true)
      );

      let status: 'NEW' | 'EXISTS' | 'SAME_TEMPLATE' | 'LOCKED' = 'NEW';
      let proposedAction: 'CREATE' | 'SKIP' | 'UPDATE' | 'LOCKED' = 'CREATE';
      let currentSchemeData: any = null;

      if (existing) {
        currentSchemeData = {
          id: existing.scheme.id,
          name: existing.scheme.name,
          isLocked: existing.scheme.isLocked,
          categories: existing.scheme.categories.map((c) => ({
            name: c.name,
            weight: c.weight,
            type: c.type?.name,
          })),
        };

        if (existing.schemeId === schemeId) {
          status = 'SAME_TEMPLATE';
          proposedAction = 'SKIP';
          alreadyAssigned++;
          toSkip++;
        } else if (existing.scheme.isLocked) {
          status = 'LOCKED';
          proposedAction = 'LOCKED';
          lockedCount++;
          toSkip++;
        } else {
          status = 'EXISTS';
          if (policy === 'UPDATE_EXISTING') {
            proposedAction = 'UPDATE';
            toUpdate++;
          } else {
            proposedAction = 'SKIP';
            toSkip++;
          }
        }
      } else {
        status = 'NEW';
        proposedAction = 'CREATE';
        toCreate++;
      }

      return {
        gradeId: t.gradeId,
        gradeName,
        streamId: t.streamId || null,
        streamName,
        subjectId: t.subjectId,
        subjectName,
        termId: academicTermId || null,
        termName: academicTerm?.name || 'All Terms / Annual',
        status,
        proposedAction,
        currentScheme: currentSchemeData,
      };
    });

    return {
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        categories: template.categories,
        totalWeight: 100,
      },
      academicYear: academicYear?.name || 'Academic Year',
      academicTerm: academicTerm?.name || 'All Terms',
      policy,
      summary: {
        total: targets.length,
        toCreate,
        toUpdate,
        toSkip,
        alreadyAssigned,
        lockedCount,
      },
      items,
    };
  }

  static async executeBulkAssignment(data: {
    schemeId: string;
    academicYearId: string;
    academicTermId?: string | null;
    targets: { gradeId: string; streamId?: string | null; subjectId: string }[];
    policy: 'SKIP_EXISTING' | 'UPDATE_EXISTING';
    confirmUpdate?: boolean;
  }) {
    const { schemeId, academicYearId, academicTermId, targets, policy, confirmUpdate } = data;

    const template = await prisma.assessmentWeightScheme.findUnique({
      where: { id: schemeId },
      include: { categories: true },
    });

    if (!template) throw new Error('Assessment template scheme not found');
    this.validateCategoryWeights(template.categories);

    if (!targets || targets.length === 0) {
      throw new Error('At least one grade-subject combination is required');
    }

    if (policy === 'UPDATE_EXISTING' && !confirmUpdate) {
      throw new Error('Explicit confirmation is required to update existing configurations.');
    }

    const results: Array<{
      gradeId: string;
      streamId: string | null;
      subjectId: string;
      status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
      reason: string;
    }> = [];

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const target of targets) {
      try {
        const existing = await prisma.assessmentSchemeAssignment.findFirst({
          where: {
            academicYearId,
            academicTermId: academicTermId || null,
            gradeId: target.gradeId,
            streamId: target.streamId || null,
            subjectId: target.subjectId,
          },
          include: { scheme: true },
        });

        if (!existing) {
          await prisma.assessmentSchemeAssignment.create({
            data: {
              schemeId,
              academicYearId,
              academicTermId: academicTermId || null,
              gradeId: target.gradeId,
              streamId: target.streamId || null,
              subjectId: target.subjectId,
            },
          });
          created++;
          results.push({
            gradeId: target.gradeId,
            streamId: target.streamId || null,
            subjectId: target.subjectId,
            status: 'CREATED',
            reason: 'Created new policy assignment configuration',
          });
        } else if (existing.schemeId === schemeId) {
          skipped++;
          results.push({
            gradeId: target.gradeId,
            streamId: target.streamId || null,
            subjectId: target.subjectId,
            status: 'SKIPPED',
            reason: 'Already configured with this exact template',
          });
        } else if (policy === 'SKIP_EXISTING') {
          skipped++;
          results.push({
            gradeId: target.gradeId,
            streamId: target.streamId || null,
            subjectId: target.subjectId,
            status: 'SKIPPED',
            reason: `Existing configuration found (${existing.scheme.name}). Skipped per policy.`,
          });
        } else if (policy === 'UPDATE_EXISTING') {
          if (existing.scheme.isLocked) {
            skipped++;
            results.push({
              gradeId: target.gradeId,
              streamId: target.streamId || null,
              subjectId: target.subjectId,
              status: 'SKIPPED',
              reason: `Existing scheme (${existing.scheme.name}) is locked due to published report records. Cannot overwrite.`,
            });
          } else {
            await prisma.assessmentSchemeAssignment.update({
              where: { id: existing.id },
              data: { schemeId },
            });
            updated++;
            results.push({
              gradeId: target.gradeId,
              streamId: target.streamId || null,
              subjectId: target.subjectId,
              status: 'UPDATED',
              reason: `Updated from "${existing.scheme.name}" to "${template.name}"`,
            });
          }
        }
      } catch (err: any) {
        failed++;
        results.push({
          gradeId: target.gradeId,
          streamId: target.streamId || null,
          subjectId: target.subjectId,
          status: 'FAILED',
          reason: err.message || 'Database error occurred during assignment',
        });
      }
    }

    return {
      success: true,
      template: { id: template.id, name: template.name },
      summary: {
        total: targets.length,
        created,
        updated,
        skipped,
        failed,
      },
      results,
    };
  }

  static async ensureDefaultPolicyScheme(academicYearId?: string) {
    let scheme = await prisma.assessmentWeightScheme.findFirst({
      where: { isDefault: true },
      include: {
        categories: {
          include: { type: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!scheme) {
      const types = await this.getAssessmentTypes();
      const quizType = types.find((t) => t.code === 'QUIZ');
      const asgnType = types.find((t) => t.code === 'ASSIGNMENT');
      const testType = types.find((t) => t.code === 'TEST');
      const projType = types.find((t) => t.code === 'PROJECT');
      const finalType = types.find((t) => t.code === 'FINAL');

      scheme = await this.createScheme({
        name: 'Standard Ethiopian Assessment Policy (100%)',
        description: 'Default percentage-weighted grading policy: Quizzes (10%), Assignments (10%), Tests (30%), Projects (10%), Final Exam (40%)',
        academicYearId: academicYearId || null,
        isTemplate: true,
        isDefault: true,
        categories: [
          { name: 'Quizzes', weight: 10, typeId: quizType?.id, orderIndex: 1 },
          { name: 'Assignments', weight: 10, typeId: asgnType?.id, orderIndex: 2 },
          { name: 'Tests', weight: 30, typeId: testType?.id, orderIndex: 3 },
          { name: 'Projects', weight: 10, typeId: projType?.id, orderIndex: 4 },
          { name: 'Final Examination', weight: 40, typeId: finalType?.id, orderIndex: 5 },
        ],
      });
    }

    return scheme;
  }
}

