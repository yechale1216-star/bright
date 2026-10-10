import prisma from '../config/db';

export interface SubmissionFilterParams {
  academicYearId?: string;
  academicTermId?: string;
  gradeId?: string;
  sectionId?: string;
  subjectId?: string;
  teacherId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class AssessmentSubmissionService {
  /**
   * Sync and ensure AssessmentSubmissionRecords exist for all active teacher assignments / assessments
   */
  async syncSubmissions(academicYearId?: string, academicTermId?: string) {
    try {
      // 1. Resolve Academic Year & Term
      let targetYearId = academicYearId;
      if (!targetYearId) {
        const currentYear = await prisma.academicYear.findFirst({
          where: { isCurrent: true },
        }) || await prisma.academicYear.findFirst({
          orderBy: { startDate: 'desc' },
        });
        targetYearId = currentYear?.id;
      }

      if (!targetYearId) return 0;

      let targetTermId = academicTermId;
      if (!targetTermId) {
        const currentTerm = await prisma.academicTerm.findFirst({
          where: { academicYearId: targetYearId, isCurrent: true },
        }) || await prisma.academicTerm.findFirst({
          where: { academicYearId: targetYearId },
          orderBy: { startDate: 'asc' },
        });
        targetTermId = currentTerm?.id;
      }

      if (!targetTermId) return 0;

      // 2. Fetch Teacher Assignments for this context
      const assignments = await prisma.teacherAssignment.findMany({
        where: {
          subjectId: { not: null },
          role: 'SUBJECT_TEACHER',
        },
        include: {
          teacher: true,
          subjectRef: true,
          grade: true,
          section: true,
        },
      });

      let createdCount = 0;

      for (const assign of assignments) {
        if (!assign.subjectId) continue;

        // Check if submission record already exists
        const existing = await prisma.assessmentSubmissionRecord.findUnique({
          where: {
            academicYearId_academicTermId_gradeId_sectionId_subjectId: {
              academicYearId: targetYearId,
              academicTermId: targetTermId,
              gradeId: assign.gradeId,
              sectionId: assign.sectionId,
              subjectId: assign.subjectId,
            },
          },
        });

        if (!existing) {
          // Check if assessments exist for this combo
          const assessments = await prisma.assessment.findMany({
            where: {
              academicYearId: targetYearId,
              academicTermId: targetTermId,
              gradeId: assign.gradeId,
              sectionId: assign.sectionId,
              subjectId: assign.subjectId,
            },
            include: {
              marks: true,
            },
          });

          const totalMarksEntered = assessments.reduce((acc, a) => acc + a.marks.length, 0);

          let initialStatus = 'SUBMITTED';
          if (assessments.length === 0 || totalMarksEntered === 0) {
            initialStatus = 'DRAFT';
          } else if (assessments.some((a) => a.status === 'APPROVED')) {
            initialStatus = 'APPROVED';
          } else if (assessments.some((a) => a.status === 'PUBLISHED')) {
            initialStatus = 'PUBLISHED';
          }

          await prisma.assessmentSubmissionRecord.create({
            data: {
              academicYearId: targetYearId,
              academicTermId: targetTermId,
              gradeId: assign.gradeId,
              sectionId: assign.sectionId,
              subjectId: assign.subjectId,
              teacherId: assign.teacher_id,
              status: initialStatus,
              submittedAt: new Date(),
            },
          });
          createdCount++;
        }
      }

      // Also ensure any assessments without a direct teacherAssignment have a submission record
      const orphanAssessments = await prisma.assessment.findMany({
        where: {
          academicYearId: targetYearId,
          academicTermId: targetTermId,
          sectionId: { not: null },
          teacherId: { not: null },
        },
        select: {
          academicYearId: true,
          academicTermId: true,
          gradeId: true,
          sectionId: true,
          subjectId: true,
          teacherId: true,
          status: true,
        },
        distinct: ['academicYearId', 'academicTermId', 'gradeId', 'sectionId', 'subjectId'],
      });

      for (const a of orphanAssessments) {
        if (!a.academicTermId || !a.sectionId || !a.teacherId) continue;
        const exists = await prisma.assessmentSubmissionRecord.findUnique({
          where: {
            academicYearId_academicTermId_gradeId_sectionId_subjectId: {
              academicYearId: a.academicYearId,
              academicTermId: a.academicTermId,
              gradeId: a.gradeId,
              sectionId: a.sectionId,
              subjectId: a.subjectId,
            },
          },
        });

        if (!exists) {
          await prisma.assessmentSubmissionRecord.create({
            data: {
              academicYearId: a.academicYearId,
              academicTermId: a.academicTermId,
              gradeId: a.gradeId,
              sectionId: a.sectionId,
              subjectId: a.subjectId,
              teacherId: a.teacherId,
              status: a.status === 'APPROVED' ? 'APPROVED' : (a.status === 'PUBLISHED' ? 'PUBLISHED' : 'SUBMITTED'),
              submittedAt: new Date(),
            },
          });
          createdCount++;
        }
      }

      return createdCount;
    } catch (error) {
      console.error('Error syncing submissions:', error);
      return 0;
    }
  }

  /**
   * Get Dashboard Summary Metrics
   */
  async getDashboardMetrics(filters: SubmissionFilterParams) {
    await this.syncSubmissions(filters.academicYearId, filters.academicTermId);

    const where: any = {};
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.academicTermId) where.academicTermId = filters.academicTermId;
    if (filters.gradeId) where.gradeId = filters.gradeId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.teacherId) where.teacherId = filters.teacherId;

    const [total, submitted, pendingApproval, requiringAttention, approved, published] = await Promise.all([
      prisma.assessmentSubmissionRecord.count({ where }),
      prisma.assessmentSubmissionRecord.count({ where: { ...where, status: 'SUBMITTED' } }),
      prisma.assessmentSubmissionRecord.count({ where: { ...where, status: 'PENDING_APPROVAL' } }),
      prisma.assessmentSubmissionRecord.count({
        where: {
          ...where,
          status: { in: ['REQUIRES_ATTENTION', 'RETURNED'] },
        },
      }),
      prisma.assessmentSubmissionRecord.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.assessmentSubmissionRecord.count({ where: { ...where, status: 'PUBLISHED' } }),
    ]);

    return {
      total,
      submitted,
      pendingApproval,
      requiringAttention,
      approved,
      published,
    };
  }

  /**
   * List Submissions with Filters, Search, and Pagination
   */
  async getSubmissions(params: SubmissionFilterParams) {
    await this.syncSubmissions(params.academicYearId, params.academicTermId);

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    if (params.academicTermId) where.academicTermId = params.academicTermId;
    if (params.gradeId) where.gradeId = params.gradeId;
    if (params.sectionId) where.sectionId = params.sectionId;
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.teacherId) where.teacherId = params.teacherId;

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'REQUIRES_ATTENTION') {
        where.status = { in: ['REQUIRES_ATTENTION', 'RETURNED'] };
      } else {
        where.status = params.status;
      }
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { subject: { name: { contains: q, mode: 'insensitive' } } },
        { subject: { code: { contains: q, mode: 'insensitive' } } },
        { teacher: { name: { contains: q, mode: 'insensitive' } } },
        { grade: { name: { contains: q, mode: 'insensitive' } } },
        { section: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.assessmentSubmissionRecord.count({ where }),
      prisma.assessmentSubmissionRecord.findMany({
        where,
        include: {
          subject: true,
          grade: true,
          section: true,
          teacher: true,
          academicYear: true,
          academicTerm: true,
        },
        orderBy: [
          { submittedAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    // Enhance each record with student counts & completion percentage
    const enriched = await Promise.all(
      records.map(async (rec) => {
        // Enrolled active students in this grade & section
        const totalStudents = await prisma.student.count({
          where: {
            gradeId: rec.gradeId,
            sectionId: rec.sectionId,
            status: 'ACTIVE',
          },
        });

        // Assessments for this subject/term
        const assessments = await prisma.assessment.findMany({
          where: {
            academicYearId: rec.academicYearId,
            academicTermId: rec.academicTermId,
            gradeId: rec.gradeId,
            sectionId: rec.sectionId,
            subjectId: rec.subjectId,
          },
          include: {
            marks: true,
          },
        });

        let validMarksCount = 0;
        let absentCount = 0;
        let missingMarksCount = 0;
        let hasInvalidMark = false;

        const totalExpectedMarks = Math.max(1, totalStudents * Math.max(1, assessments.length));

        for (const assess of assessments) {
          const marks = assess.marks;
          for (const m of marks) {
            if (m.isAbsent || m.status === 'ABSENT' || m.status === 'EXCUSED') {
              absentCount++;
            } else if (m.score !== null && m.score !== undefined) {
              if (m.score < 0 || m.score > assess.maxScore) {
                hasInvalidMark = true;
              }
              validMarksCount++;
            }
          }
        }

        // If total students > 0 and assessments exist
        if (assessments.length > 0 && totalStudents > 0) {
          const totalEntered = validMarksCount + absentCount;
          missingMarksCount = Math.max(0, (totalStudents * assessments.length) - totalEntered);
        } else {
          missingMarksCount = totalStudents;
        }

        const completionPercentage = totalStudents > 0
          ? Math.min(100, Math.round(((validMarksCount + absentCount) / totalExpectedMarks) * 100))
          : 0;

        return {
          id: rec.id,
          academicYearId: rec.academicYearId,
          academicTermId: rec.academicTermId,
          gradeId: rec.gradeId,
          sectionId: rec.sectionId,
          subjectId: rec.subjectId,
          teacherId: rec.teacherId,
          status: rec.status,
          submittedAt: rec.submittedAt,
          reviewedAt: rec.reviewedAt,
          reviewedById: rec.reviewedById,
          rejectionReason: rec.rejectionReason,
          publishedAt: rec.publishedAt,
          reopenedAt: rec.reopenedAt,
          reopenReason: rec.reopenReason,
          notes: rec.notes,
          subject: {
            id: rec.subject.id,
            name: rec.subject.name,
            code: rec.subject.code,
            color: rec.subject.color || '#3b82f6',
          },
          grade: {
            id: rec.grade.id,
            name: rec.grade.name,
          },
          section: {
            id: rec.section.id,
            name: rec.section.name,
          },
          teacher: {
            id: rec.teacher.id,
            name: rec.teacher.name,
            email: rec.teacher.email,
            profile_photo: rec.teacher.profile_photo,
          },
          academicYear: {
            id: rec.academicYear.id,
            name: rec.academicYear.name,
          },
          academicTerm: {
            id: rec.academicTerm.id,
            name: rec.academicTerm.name,
          },
          metrics: {
            totalStudents,
            validMarksCount: Math.min(totalStudents, validMarksCount),
            missingMarksCount,
            absentCount,
            completionPercentage,
            assessmentsCount: assessments.length,
            hasInvalidMark,
          },
        };
      })
    );

    return {
      submissions: enriched,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Detailed Submission view including all student marks and audit logs
   */
  async getSubmissionDetails(id: string) {
    const record = await prisma.assessmentSubmissionRecord.findUnique({
      where: { id },
      include: {
        subject: true,
        grade: true,
        section: true,
        teacher: true,
        academicYear: true,
        academicTerm: true,
      },
    });

    if (!record) {
      throw new Error('Submission record not found');
    }

    // 1. Fetch all students in grade & section
    const students = await prisma.student.findMany({
      where: {
        gradeId: record.gradeId,
        sectionId: record.sectionId,
        status: 'ACTIVE',
      },
      orderBy: { fullName: 'asc' },
    });

    // 2. Fetch assessments in this context
    const assessments = await prisma.assessment.findMany({
      where: {
        academicYearId: record.academicYearId,
        academicTermId: record.academicTermId,
        gradeId: record.gradeId,
        sectionId: record.sectionId,
        subjectId: record.subjectId,
      },
      include: {
        category: true,
        assessmentType: true,
        marks: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Total possible weight
    const totalWeight = assessments.reduce((acc, a) => acc + (a.weightage || 100), 0);

    // 3. Build Student Marks Matrix
    let completedCount = 0;
    let missingCount = 0;
    let absentCount = 0;

    const studentRows = students.map((student) => {
      const markEntries: any[] = [];
      let studentWeightedScore = 0;
      let studentTotalWeight = 0;
      let hasMissing = false;
      let isStudentAbsent = false;
      let hasInvalid = false;
      const issues: string[] = [];

      assessments.forEach((assess) => {
        const mark = assess.marks.find((m) => m.studentId === student.id);
        const weight = assess.weightage || 100;

        if (mark) {
          const isAbs = mark.isAbsent || mark.status === 'ABSENT';
          const isExc = mark.status === 'EXCUSED';

          if (isAbs) {
            isStudentAbsent = true;
          }

          if (mark.score !== null && mark.score !== undefined && !isAbs) {
            if (mark.score < 0) {
              hasInvalid = true;
              issues.push(`${assess.title}: Negative mark (${mark.score})`);
            } else if (mark.score > assess.maxScore) {
              hasInvalid = true;
              issues.push(`${assess.title}: Mark (${mark.score}) exceeds maximum (${assess.maxScore})`);
            } else {
              const normalized = (mark.score / assess.maxScore) * weight;
              studentWeightedScore += normalized;
              studentTotalWeight += weight;
            }
          } else if (!isAbs && !isExc) {
            hasMissing = true;
            issues.push(`${assess.title}: Mark missing`);
          }

          markEntries.push({
            assessmentId: assess.id,
            assessmentTitle: assess.title,
            maxScore: assess.maxScore,
            weightage: assess.weightage,
            score: mark.score,
            status: mark.status,
            isAbsent: isAbs,
            excuseReason: mark.excuseReason,
            remarks: mark.remarks,
          });
        } else {
          hasMissing = true;
          issues.push(`${assess.title}: No entry recorded`);
          markEntries.push({
            assessmentId: assess.id,
            assessmentTitle: assess.title,
            maxScore: assess.maxScore,
            weightage: assess.weightage,
            score: null,
            status: 'PENDING',
            isAbsent: false,
            remarks: null,
          });
        }
      });

      const finalPercentage = studentTotalWeight > 0
        ? Math.round((studentWeightedScore / studentTotalWeight) * 100 * 10) / 10
        : null;

      let status = 'COMPLETE';
      if (hasInvalid) {
        status = 'INVALID';
      } else if (isStudentAbsent) {
        status = 'ABSENT';
        absentCount++;
      } else if (hasMissing || assessments.length === 0) {
        status = 'MISSING';
        missingCount++;
      } else {
        completedCount++;
      }

      return {
        studentId: student.id,
        studentNumber: student.student_id,
        fullName: student.fullName,
        gender: student.gender,
        marks: markEntries,
        finalScore: studentWeightedScore,
        finalPercentage,
        status,
        issues,
      };
    });

    const completionPercentage = students.length > 0
      ? Math.round(((completedCount + absentCount) / students.length) * 100)
      : 0;

    // 4. Build Activity & Audit Timeline
    const activities: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      author: string;
      timestamp: Date;
    }> = [];

    // Submission timestamp
    if (record.submittedAt) {
      activities.push({
        id: 'sub-' + record.id,
        type: 'SUBMISSION',
        title: 'Teacher submitted marks',
        description: `Assessment marks for ${record.subject.name} were submitted for administrative review.`,
        author: record.teacher.name,
        timestamp: record.submittedAt,
      });
    }

    // Created / Draft timestamp
    activities.push({
      id: 'draft-' + record.id,
      type: 'DRAFT',
      title: 'Draft saved',
      description: `Marks entry initialized for Grade ${record.grade.name} - Section ${record.section.name}.`,
      author: record.teacher.name,
      timestamp: record.createdAt,
    });

    // Review / Approved timestamp
    if (record.reviewedAt) {
      if (record.status === 'APPROVED') {
        activities.push({
          id: 'app-' + record.id,
          type: 'APPROVAL',
          title: 'Marks Approved',
          description: 'Submission was reviewed and approved by School Administrator.',
          author: 'Administrator',
          timestamp: record.reviewedAt,
        });
      } else if (record.status === 'RETURNED') {
        activities.push({
          id: 'ret-' + record.id,
          type: 'RETURNED',
          title: 'Returned for Correction',
          description: `Reason: ${record.rejectionReason || 'Issues identified in marks submission.'}`,
          author: 'Administrator',
          timestamp: record.reviewedAt,
        });
      }
    }

    // Published timestamp
    if (record.publishedAt) {
      activities.push({
        id: 'pub-' + record.id,
        type: 'PUBLISHED',
        title: 'Results Published',
        description: 'Approved marks were released for official report card generation.',
        author: 'Administrator',
        timestamp: record.publishedAt,
      });
    }

    // Reopened timestamp
    if (record.reopenedAt) {
      activities.push({
        id: 'reopen-' + record.id,
        type: 'REOPENED',
        title: 'Submission Reopened',
        description: `Reason: ${record.reopenReason || 'Reopened for corrections.'}`,
        author: 'Administrator',
        timestamp: record.reopenedAt,
      });
    }

    // Sort activities descending
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      submission: {
        id: record.id,
        status: record.status,
        submittedAt: record.submittedAt,
        reviewedAt: record.reviewedAt,
        rejectionReason: record.rejectionReason,
        publishedAt: record.publishedAt,
        reopenedAt: record.reopenedAt,
        reopenReason: record.reopenReason,
        notes: record.notes,
        subject: record.subject,
        grade: record.grade,
        section: record.section,
        teacher: record.teacher,
        academicYear: record.academicYear,
        academicTerm: record.academicTerm,
      },
      assessments: assessments.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        maxScore: a.maxScore,
        weightage: a.weightage,
        categoryName: a.category?.name,
      })),
      students: studentRows,
      stats: {
        totalStudents: students.length,
        completedStudents: completedCount,
        missingStudents: missingCount,
        absentStudents: absentCount,
        completionPercentage,
        hasValidationErrors: studentRows.some((s) => s.issues.length > 0),
      },
      activities,
    };
  }

  /**
   * Approve a single submission
   */
  async approveSubmission(id: string, reviewerId?: string) {
    const record = await prisma.assessmentSubmissionRecord.findUnique({
      where: { id },
      include: {
        grade: true,
        section: true,
        subject: true,
      },
    });

    if (!record) {
      throw new Error('Submission record not found');
    }

    // Validate marks within range
    const assessments = await prisma.assessment.findMany({
      where: {
        academicYearId: record.academicYearId,
        academicTermId: record.academicTermId,
        gradeId: record.gradeId,
        sectionId: record.sectionId,
        subjectId: record.subjectId,
      },
      include: { marks: true },
    });

    for (const assess of assessments) {
      for (const m of assess.marks) {
        if (!m.isAbsent && m.score !== null) {
          if (m.score < 0 || m.score > assess.maxScore) {
            throw new Error(
              `Validation Error: Found invalid score (${m.score}) in assessment "${assess.title}". Maximum allowed is ${assess.maxScore}.`
            );
          }
        }
      }
    }

    const now = new Date();

    // Atomic update
    return prisma.$transaction(async (tx) => {
      const updated = await tx.assessmentSubmissionRecord.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId || null,
          reviewedAt: now,
          rejectionReason: null,
        },
      });

      // Update assessments status
      await tx.assessment.updateMany({
        where: {
          academicYearId: record.academicYearId,
          academicTermId: record.academicTermId,
          gradeId: record.gradeId,
          sectionId: record.sectionId,
          subjectId: record.subjectId,
        },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          approvedById: reviewerId || null,
        },
      });

      return updated;
    });
  }

  /**
   * Return a submission for correction
   */
  async returnSubmission(id: string, reason: string, reviewerId?: string) {
    if (!reason || !reason.trim()) {
      throw new Error('A correction reason is required when returning a submission.');
    }

    const record = await prisma.assessmentSubmissionRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new Error('Submission record not found');
    }

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.assessmentSubmissionRecord.update({
        where: { id },
        data: {
          status: 'RETURNED',
          rejectionReason: reason.trim(),
          reviewedById: reviewerId || null,
          reviewedAt: now,
        },
      });

      // Unlock assessments so teacher can edit
      await tx.assessment.updateMany({
        where: {
          academicYearId: record.academicYearId,
          academicTermId: record.academicTermId,
          gradeId: record.gradeId,
          sectionId: record.sectionId,
          subjectId: record.subjectId,
        },
        data: {
          status: 'OPEN',
        },
      });

      return updated;
    });
  }

  /**
   * Reopen an approved/published submission for editing
   */
  async reopenSubmission(id: string, reason: string, reviewerId?: string) {
    if (!reason || !reason.trim()) {
      throw new Error('A reason is required to reopen an approved submission.');
    }

    const record = await prisma.assessmentSubmissionRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new Error('Submission record not found');
    }

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.assessmentSubmissionRecord.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          reopenedAt: now,
          reopenReason: reason.trim(),
        },
      });

      await tx.assessment.updateMany({
        where: {
          academicYearId: record.academicYearId,
          academicTermId: record.academicTermId,
          gradeId: record.gradeId,
          sectionId: record.sectionId,
          subjectId: record.subjectId,
        },
        data: {
          status: 'OPEN',
        },
      });

      return updated;
    });
  }

  /**
   * Publish results for report card generation
   */
  async publishSubmission(id: string, publisherId?: string) {
    const record = await prisma.assessmentSubmissionRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new Error('Submission record not found');
    }

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.assessmentSubmissionRecord.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });

      await tx.assessment.updateMany({
        where: {
          academicYearId: record.academicYearId,
          academicTermId: record.academicTermId,
          gradeId: record.gradeId,
          sectionId: record.sectionId,
          subjectId: record.subjectId,
        },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });

      return updated;
    });
  }

  /**
   * Bulk Approve Multiple Submissions
   */
  async bulkApproveSubmissions(ids: string[], reviewerId?: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No submission IDs provided for bulk approval');
    }

    const successful: string[] = [];
    const failed: Array<{ id: string; subject?: string; reason: string }> = [];

    for (const id of ids) {
      try {
        const submission = await prisma.assessmentSubmissionRecord.findUnique({
          where: { id },
          include: { subject: true },
        });

        if (!submission) {
          failed.push({ id, reason: 'Submission not found' });
          continue;
        }

        if (submission.status === 'APPROVED' || submission.status === 'PUBLISHED') {
          // Already approved
          successful.push(id);
          continue;
        }

        await this.approveSubmission(id, reviewerId);
        successful.push(id);
      } catch (err: any) {
        failed.push({
          id,
          reason: err?.message || 'Approval validation failed',
        });
      }
    }

    return {
      successful,
      failed,
      totalApproved: successful.length,
      totalFailed: failed.length,
    };
  }

  /**
   * Teacher submits marks for approval
   */
  async teacherSubmitMarks(params: {
    academicYearId: string;
    academicTermId: string;
    gradeId: string;
    sectionId: string;
    subjectId: string;
    teacherId: string;
    notes?: string;
  }) {
    const { academicYearId, academicTermId, gradeId, sectionId, subjectId, teacherId, notes } = params;

    const record = await prisma.assessmentSubmissionRecord.upsert({
      where: {
        academicYearId_academicTermId_gradeId_sectionId_subjectId: {
          academicYearId,
          academicTermId,
          gradeId,
          sectionId,
          subjectId,
        },
      },
      update: {
        teacherId,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        notes: notes || undefined,
        rejectionReason: null,
      },
      create: {
        academicYearId,
        academicTermId,
        gradeId,
        sectionId,
        subjectId,
        teacherId,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        notes: notes || undefined,
      },
    });

    // Update assessments to SUBMITTED
    await prisma.assessment.updateMany({
      where: {
        academicYearId,
        academicTermId,
        gradeId,
        sectionId,
        subjectId,
      },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    return record;
  }
}

export const assessmentSubmissionService = new AssessmentSubmissionService();
