import prisma from '../config/db';
import { academicYearService } from './academic-year.service';
import { sendCategoryNotification } from './notification.service';

export const DEFAULT_DISCIPLINE_CATEGORIES = [
  'Late Arrival',
  'Unexcused Absence',
  'Uniform Violation',
  'Classroom Misbehavior',
  'Disrespect',
  'Bullying',
  'Fighting',
  'Cheating',
  'Phone Misuse',
  'Property Damage',
  'Theft',
  'Smoking',
  'Violence',
  'Other'
];

export const DEFAULT_DISCIPLINE_ACTIONS = [
  'Verbal Warning',
  'Written Warning',
  'Parent Conference',
  'Counseling Session',
  'Restorative Task',
  'Behavioral Plan',
  'Detention',
  'In-School Suspension',
  'Out-of-School Suspension',
  'Behavior Contract',
  'Other Action'
];

/**
 * Creates an audit log entry for discipline actions.
 */
async function logDisciplineAudit(params: {
  userId?: string;
  action: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: params.userId || null,
        action: params.action,
        entity_type: 'DISCIPLINE',
        entity_id: params.entityId,
        old_values: params.oldValues || undefined,
        new_values: params.newValues || undefined
      }
    });
  } catch (err) {
    console.error('[DisciplineService] AuditLog error:', err);
  }
}

/**
 * Sends notifications to parents for a student discipline record.
 */
async function notifyParentForDiscipline(params: {
  studentId: string;
  title: string;
  message: string;
  type?: string;
  caseNumber?: string;
}) {
  try {
    await prisma.parentNotification.create({
      data: {
        studentId: params.studentId,
        title: params.title,
        message: params.message,
        type: params.type || 'DISCIPLINE'
      }
    });

    const links = await prisma.parentStudentLink.findMany({
      where: { studentId: params.studentId },
      include: {
        parent: {
          select: {
            id: true,
            full_name: true,
            phone: true,
            pushToken: true
          }
        }
      }
    });

    const settings = await prisma.schoolSettings.findFirst({
      select: { school_name: true }
    });
    const schoolName = settings?.school_name || 'Addis Hiwot School';

    for (const link of links) {
      if (link.parent) {
        await prisma.userNotification.create({
          data: {
            userId: link.parent.id,
            title: params.title,
            message: params.message,
            type: params.type || 'DISCIPLINE'
          }
        });

        if (link.parent.pushToken) {
          if (link.parent.phone) {
            const prefs = await prisma.parentPreferences.findUnique({
              where: { parentPhone: link.parent.phone }
            });
            if (prefs && !prefs.pushNotifications) {
              console.log(`[DisciplineService] Parent ${link.parent.id} disabled push notifications`);
              continue;
            }
          }

          console.log(`[DisciplineService] Dispatching discipline push notification to parent ${link.parent.id} for student ${params.studentId}`);
          await sendCategoryNotification(link.parent.pushToken, {
            type: 'student_discipline',
            title: schoolName,
            body: params.message,
            route: '/parent/discipline',
            studentId: params.studentId,
            schoolName,
            categoryLabel: 'Discipline Notice',
            tag: `discipline-${params.studentId}-${params.caseNumber || 'alert'}`
          }).catch((pushErr: any) => {
            console.error(`[DisciplineService] Failed to dispatch push to parent ${link.parent.id}:`, pushErr);
          });
        }
      }
    }
  } catch (err) {
    console.error('[DisciplineService] Parent Notification error:', err);
  }
}

/**
 * Helper to fetch teacher homeroom assignments for permission checks.
 */
async function getTeacherAssignments(userId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { user_id: userId }
  });
  if (!teacher) return [];
  return await prisma.teacherAssignment.findMany({
    where: { teacher_id: teacher.id }
  });
}

/**
 * Helper to generate a unique human-readable case number: DC-2026-0001
 */
async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();

  // Retry loop: handles concurrent submissions that would collide on count()-based numbering.
  // On collision, add a random suffix to make the candidate unique.
  const MAX_RETRIES = 10;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const count = await prisma.studentDiscipline.count();
    const base = count + 1 + attempt;
    const seq = attempt === 0
      ? String(base).padStart(4, '0')
      : String(base) + String(Math.floor(Math.random() * 900) + 100);

    const candidate = `DC-${year}-${seq}`;

    const exists = await prisma.studentDiscipline.findFirst({
      where: { caseNumber: candidate }
    });

    if (!exists) {
      return candidate;
    }
    // Collision — try again with a randomized suffix
  }

  // Fallback: use timestamp to guarantee uniqueness
  return `DC-${year}-T${Date.now().toString(36).toUpperCase()}`;
}

function ensureCaseNumber(inc: any) {
  if (inc && !inc.caseNumber) {
    const yr = new Date(inc.createdAt || inc.date || Date.now()).getFullYear();
    const shortId = (inc.id || '').replace(/-/g, '').substring(0, 4).toUpperCase();
    inc.caseNumber = `DC-${yr}-${shortId}`;
  }
  return inc;
}

function sanitizeIncidentForRole(incident: any, role: string) {
  if (!incident) return incident;

  if (role === 'parent') {
    const {
      investigationNotes,
      confidentialNotes,
      findings,
      meetingNotes,
      witnesses,
      ...publicData
    } = incident;

    return publicData;
  }

  if (role === 'teacher') {
    const { confidentialNotes, ...teacherData } = incident;
    return teacherData;
  }

  return incident;
}

export class DisciplineService {
  static async ensureDefaultCategories(_schoolId?: string) {
    const existing = await prisma.disciplineCategory.findMany({
      select: { name: true }
    });

    const existingNames = new Set(existing.map(c => c.name));
    const missing = DEFAULT_DISCIPLINE_CATEGORIES.filter(name => !existingNames.has(name));

    if (missing.length > 0) {
      await prisma.disciplineCategory.createMany({
        data: missing.map(name => ({
          name,
          isDefault: true
        })),
        skipDuplicates: true
      });
    }

    return prisma.disciplineCategory.findMany({
      orderBy: { name: 'asc' }
    });
  }

  static async getCategories(_schoolId?: string) {
    return this.ensureDefaultCategories();
  }

  static async createCategory(_schoolId: string | undefined, name: string, description?: string) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Category name is required');

    const existing = await prisma.disciplineCategory.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' }
      }
    });

    if (existing) {
      throw new Error(`Category "${trimmedName}" already exists`);
    }

    return prisma.disciplineCategory.create({
      data: {
        name: trimmedName,
        description: description?.trim() || null,
        isDefault: false
      }
    });
  }

  static async deleteCategory(_schoolId: string | undefined, categoryId: string) {
    return prisma.disciplineCategory.deleteMany({
      where: { id: categoryId, isDefault: false }
    });
  }

  static async ensureDefaultActions(_schoolId?: string) {
    const existing = await prisma.disciplineActionConfig.findMany({
      select: { name: true }
    });

    const existingNames = new Set(existing.map(a => a.name));
    const missing = DEFAULT_DISCIPLINE_ACTIONS.filter(name => !existingNames.has(name));

    if (missing.length > 0) {
      await prisma.disciplineActionConfig.createMany({
        data: missing.map(name => ({
          name,
          isDefault: true
        })),
        skipDuplicates: true
      });
    }

    return prisma.disciplineActionConfig.findMany({
      orderBy: { name: 'asc' }
    });
  }

  static async getActionsConfig(_schoolId?: string) {
    return this.ensureDefaultActions();
  }

  static async createActionConfig(_schoolId: string | undefined, name: string, description?: string) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Action name is required');

    const existing = await prisma.disciplineActionConfig.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' }
      }
    });

    if (existing) {
      throw new Error(`Disciplinary Action "${trimmedName}" already exists`);
    }

    return prisma.disciplineActionConfig.create({
      data: {
        name: trimmedName,
        description: description?.trim() || null,
        isDefault: false
      }
    });
  }

  static async deleteActionConfig(_schoolId: string | undefined, actionId: string) {
    return prisma.disciplineActionConfig.deleteMany({
      where: { id: actionId, isDefault: false }
    });
  }

  static async createIncident(
    user: { id: string; role: string; email?: string; schoolId?: string },
    data: {
      studentId: string;
      date?: string | Date;
      time?: string;
      categoryId?: string;
      categoryName: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      title: string;
      description: string;
      location?: string;
      witnesses?: string[];
      evidence?: any[];
      immediateAction?: string;
      parentNotified?: boolean;
      followUpDate?: string | Date;
      assignedToId?: string;
      assignedToName?: string;
    }
  ) {
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      include: { grade: true, section: true, stream: true }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    if (student.status === 'GRADUATED') {
      throw new Error('Cannot report discipline incident for a graduated student');
    }

    if (user.role === 'teacher') {
      const assignments = await getTeacherAssignments(user.id);
      const isAssigned = assignments.some(
        a => a.gradeId === student.gradeId && a.sectionId === student.sectionId
      );
      if (!isAssigned) {
        throw new Error('Forbidden: You can only report discipline incidents for your assigned homeroom students');
      }
    }

    const reporterUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, full_name: true }
    });
    const reportedById = reporterUser ? reporterUser.id : null;
    const reportedByName = reporterUser?.full_name || user.email || 'Staff';

    let validCategoryId: string | null = null;
    if (data.categoryId) {
      const catById = await prisma.disciplineCategory.findUnique({
        where: { id: data.categoryId }
      });
      if (catById) validCategoryId = catById.id;
    }
    if (!validCategoryId && data.categoryName) {
      const catByName = await prisma.disciplineCategory.findFirst({
        where: { name: data.categoryName }
      });
      if (catByName) validCategoryId = catByName.id;
    }

    const caseNumber = await generateCaseNumber();

    const activeAY = await academicYearService.getCurrentAcademicYear();
    const disciplineAcademicYearId = activeAY?.id || null;
    let disciplineAcademicYearRecordId: string | null = null;
    if (activeAY) {
      const enrRecord = await prisma.studentAcademicYearRecord.findUnique({
        where: { studentId_academicYearId: { studentId: student.id, academicYearId: activeAY.id } },
        select: { id: true }
      });
      disciplineAcademicYearRecordId = enrRecord?.id || null;
    }

    const incident = await prisma.studentDiscipline.create({
      data: {
        caseNumber,
        studentId: student.id,
        gradeId: student.gradeId,
        sectionId: student.sectionId,
        streamId: student.streamId,
        date: data.date ? new Date(data.date) : new Date(),
        time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        categoryId: validCategoryId,
        categoryName: data.categoryName || 'General Incident',
        severity: data.severity || 'LOW',
        title: data.title,
        description: data.description,
        location: data.location || null,
        reportedById,
        reportedByName,
        assignedToId: data.assignedToId || null,
        assignedToName: data.assignedToName || null,
        witnesses: data.witnesses ? (data.witnesses as any) : undefined,
        evidence: data.evidence ? (data.evidence as any) : undefined,
        immediateAction: data.immediateAction || null,
        parentNotified: data.parentNotified !== false && (data.parentNotified as any) !== 'false',
        parentNotifiedAt: (data.parentNotified !== false && (data.parentNotified as any) !== 'false') ? new Date() : null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        status: data.assignedToId ? 'UNDER_REVIEW' : 'OPEN',
        academicYearId: disciplineAcademicYearId,
        academicYearRecordId: disciplineAcademicYearRecordId,
      },
      include: {
        student: true,
        grade: true,
        section: true,
        stream: true,
        assignedTo: { select: { id: true, full_name: true, email: true } }
      }
    });

    await prisma.disciplineFollowUp.create({
      data: {
        disciplineId: incident.id,
        authorId: reportedById,
        authorName: reportedByName,
        note: `Case #${caseNumber} created with status ${incident.status} and severity ${data.severity || 'LOW'}.`,
        actionTaken: data.immediateAction || 'Incident reported',
        statusBefore: null,
        statusAfter: incident.status
      }
    });

    await logDisciplineAudit({
      userId: user.id,
      action: 'DISCIPLINE_CREATED',
      entityId: incident.id,
      newValues: {
        caseNumber,
        student: student.fullName,
        title: data.title,
        severity: data.severity,
        category: data.categoryName
      }
    });

    const shouldNotify = data.parentNotified !== false && (data.parentNotified as any) !== 'false';
    if (shouldNotify) {
      const notifTitle = `Official Notice: Discipline Case #${caseNumber}`;
      const notifMsg = `Discipline record created for ${student.fullName} (${data.categoryName || 'Incident'}, ${data.severity || 'LOW'} severity). Tap to view details.`;
      await notifyParentForDiscipline({
        studentId: student.id,
        title: notifTitle,
        message: notifMsg,
        caseNumber
      });
    }

    return ensureCaseNumber(incident);
  }

  static async getIncidents(
    user: { id: string; role: string; schoolId?: string },
    query: {
      page?: number;
      limit?: number;
      search?: string;
      studentId?: string;
      gradeId?: string;
      sectionId?: string;
      streamId?: string;
      categoryId?: string;
      categoryName?: string;
      severity?: string;
      status?: string;
      assignedToId?: string;
      assignedToMe?: boolean | string;
      startDate?: string;
      endDate?: string;
      reporterId?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if ((query as any).academicYearId && (query as any).academicYearId !== 'all') {
      where.academicYearId = (query as any).academicYearId;
    } else if (!(query as any).academicYearId && user.role !== 'parent') {
      // Default to active academic year only for school staff / discipline officers to prevent overloading
      const activeAY = await academicYearService.getCurrentAcademicYear();
      if (activeAY) {
        where.academicYearId = activeAY.id;
      }
    }

    if (user.role === 'teacher') {
      const assignments = await getTeacherAssignments(user.id);
      if (assignments.length === 0) {
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
      const OR = assignments.map(a => ({
        gradeId: a.gradeId,
        sectionId: a.sectionId,
        ...(a.streamId ? { streamId: a.streamId } : {})
      }));
      where.OR = OR;
    } else if (user.role === 'parent') {
      if (query.studentId) {
        // Fast-path: Check indexed single link for this parent and requested student
        const link = await prisma.parentStudentLink.findFirst({
          where: { parentId: user.id, studentId: query.studentId },
          select: { id: true }
        });
        if (!link) {
          return { items: [], total: 0, page, limit, totalPages: 0 };
        }
        where.studentId = query.studentId;
      } else {
        const links = await prisma.parentStudentLink.findMany({
          where: { parentId: user.id },
          select: { studentId: true }
        });
        const studentIds = links.map(l => l.studentId);
        if (studentIds.length === 0) {
          return { items: [], total: 0, page, limit, totalPages: 0 };
        }
        where.studentId = { in: studentIds };
      }
    } else if (query.studentId) {
      where.studentId = query.studentId;
    }
    if (query.gradeId) where.gradeId = query.gradeId;
    if (query.sectionId) where.sectionId = query.sectionId;
    if (query.streamId) where.streamId = query.streamId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.categoryName) where.categoryName = { equals: query.categoryName, mode: 'insensitive' };
    if (query.severity) where.severity = query.severity.toUpperCase();
    if (query.status) where.status = query.status.toUpperCase();
    if (query.reporterId) where.reportedById = query.reporterId;

    if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    } else if (query.assignedToMe === true || query.assignedToMe === 'true') {
      where.assignedToId = user.id;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = new Date(query.startDate);
      if (query.endDate) where.date.lte = new Date(query.endDate);
    }

    if (query.search) {
      const s = query.search.trim();
      if (!where.AND) where.AND = [];
      where.AND.push({
        OR: [
          { caseNumber: { contains: s, mode: 'insensitive' } },
          { title: { contains: s, mode: 'insensitive' } },
          { description: { contains: s, mode: 'insensitive' } },
          { categoryName: { contains: s, mode: 'insensitive' } },
          { reportedByName: { contains: s, mode: 'insensitive' } },
          { assignedToName: { contains: s, mode: 'insensitive' } },
          { student: { fullName: { contains: s, mode: 'insensitive' } } },
          { student: { student_id: { contains: s, mode: 'insensitive' } } }
        ]
      });
    }

    const orderByField = query.sortBy || 'createdAt';
    const orderDirection = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      prisma.studentDiscipline.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderDirection },
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              fullName: true,
              grade: { select: { name: true } },
              section: { select: { name: true } },
              stream: { select: { name: true } }
            }
          },
          grade: true,
          section: true,
          stream: true,
          assignedTo: { select: { id: true, full_name: true, email: true } },
          followUps: {
            orderBy: { createdAt: 'desc' },
            take: 3
          }
        }
      }),
      prisma.studentDiscipline.count({ where })
    ]);

    const sanitizedItems = items.map(item => sanitizeIncidentForRole(ensureCaseNumber(item), user.role));

    return {
      items: sanitizedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getIncidentById(
    user: { id: string; role: string; schoolId?: string },
    incidentId: string
  ) {
    const incident = await prisma.studentDiscipline.findUnique({
      where: { id: incidentId },
      include: {
        student: true,
        grade: true,
        section: true,
        stream: true,
        reportedBy: { select: { id: true, full_name: true, email: true, role: true } },
        assignedTo: { select: { id: true, full_name: true, email: true, role: true } },
        followUps: { orderBy: { createdAt: 'asc' } },
        category: true
      }
    });

    if (!incident) {
      throw new Error('Incident not found');
    }

    if (user.role === 'teacher') {
      const assignments = await getTeacherAssignments(user.id);
      const isAssigned = assignments.some(
        a => a.gradeId === incident.gradeId && a.sectionId === incident.sectionId
      );
      if (!isAssigned && incident.reportedById !== user.id) {
        throw new Error('Forbidden: You do not have permission to view this discipline record');
      }
    } else if (user.role === 'parent') {
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: user.id, studentId: incident.studentId }
      });
      if (!link) {
        throw new Error('Forbidden: You can only view discipline records for your linked child');
      }

      await logDisciplineAudit({
        userId: user.id,
        action: 'DISCIPLINE_PARENT_VIEWED',
        entityId: incident.id
      });
    }

    let auditLogs: any[] = [];
    const isStaffOrAdmin = user.role === 'admin' || user.role === 'school_admin' || user.role === 'super_admin' || user.role === 'discipline_officer';
    if (isStaffOrAdmin) {
      const rawLogs = await prisma.auditLog.findMany({
        where: {
          entity_type: 'DISCIPLINE',
          entity_id: incidentId
        },
        orderBy: { created_at: 'desc' },
        take: 30
      });

      const userIds = Array.from(new Set(rawLogs.map(l => l.user_id).filter(Boolean))) as string[];
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, full_name: true }
        });
        userMap = Object.fromEntries(users.map(u => [u.id, u.full_name]));
      }

      auditLogs = rawLogs.map(log => ({
        ...log,
        authorName: log.user_id ? (userMap[log.user_id] || 'Staff Member') : 'System'
      }));
    }

    const sanitized = sanitizeIncidentForRole(ensureCaseNumber(incident), user.role);

    return {
      ...sanitized,
      auditLogs
    };
  }

  static async assignOfficer(
    user: { id: string; role: string; email?: string; schoolId?: string },
    incidentId: string,
    officerId: string,
    notes?: string
  ) {
    if (user.role !== 'admin' && user.role !== 'school_admin' && user.role !== 'super_admin' && user.role !== 'discipline_officer') {
      throw new Error('Forbidden: Only authorized officers/admins can reassign cases');
    }

    const incident = await prisma.studentDiscipline.findUnique({
      where: { id: incidentId },
      include: { student: true }
    });

    if (!incident) throw new Error('Incident not found');

    const officer = await prisma.user.findUnique({
      where: { id: officerId }
    });

    if (!officer) throw new Error('Discipline officer not found');

    const updated = await prisma.studentDiscipline.update({
      where: { id: incidentId },
      data: {
        assignedToId: officer.id,
        assignedToName: officer.full_name,
        status: incident.status === 'OPEN' ? 'UNDER_REVIEW' : incident.status
      },
      include: {
        student: true,
        assignedTo: { select: { id: true, full_name: true, email: true } }
      }
    });

    await prisma.disciplineFollowUp.create({
      data: {
        disciplineId: incidentId,
        authorId: user.id,
        authorName: user.email || 'Staff',
        note: notes || `Case assigned to Discipline Officer ${officer.full_name}.`,
        statusBefore: incident.status,
        statusAfter: updated.status
      }
    });

    await logDisciplineAudit({
      userId: user.id,
      action: 'DISCIPLINE_OFFICER_ASSIGNED',
      entityId: incidentId,
      newValues: { officerId: officer.id, officerName: officer.full_name }
    });

    try {
      await prisma.userNotification.create({
        data: {
          userId: officer.id,
          title: `Discipline Case Assigned: #${updated.caseNumber || incidentId.slice(0, 6)}`,
          message: `You have been assigned to investigate discipline case for ${updated.student.fullName}.`,
          type: 'DISCIPLINE'
        }
      });
    } catch (err) {
      console.error('Failed to notify officer:', err);
    }

    return ensureCaseNumber(updated);
  }

  static async updateInvestigation(
    user: { id: string; role: string; email?: string; schoolId?: string },
    incidentId: string,
    data: {
      investigationNotes?: string;
      findings?: string;
      meetingNotes?: string;
      confidentialNotes?: string;
      status?: string;
    }
  ) {
    if (user.role !== 'admin' && user.role !== 'school_admin' && user.role !== 'super_admin' && user.role !== 'discipline_officer') {
      throw new Error('Forbidden: Only authorized officers can record investigation notes');
    }

    const incident = await prisma.studentDiscipline.findUnique({
      where: { id: incidentId }
    });

    if (!incident) throw new Error('Incident not found');

    const updated = await prisma.studentDiscipline.update({
      where: { id: incidentId },
      data: {
        investigationNotes: data.investigationNotes ?? incident.investigationNotes,
        findings: data.findings ?? incident.findings,
        meetingNotes: data.meetingNotes ?? incident.meetingNotes,
        confidentialNotes: data.confidentialNotes ?? incident.confidentialNotes,
        status: data.status ? data.status.toUpperCase() : (incident.status === 'OPEN' ? 'UNDER_REVIEW' : incident.status)
      },
      include: {
        student: true,
        assignedTo: { select: { id: true, full_name: true } }
      }
    });

    await prisma.disciplineFollowUp.create({
      data: {
        disciplineId: incidentId,
        authorId: user.id,
        authorName: user.email || 'Staff',
        note: `Investigation updated. Findings: ${data.findings || 'Notes updated'}.`,
        statusBefore: incident.status,
        statusAfter: updated.status
      }
    });

    await logDisciplineAudit({
      userId: user.id,
      action: 'DISCIPLINE_INVESTIGATION_UPDATED',
      entityId: incidentId,
      newValues: { status: updated.status, findings: data.findings }
    });

    return ensureCaseNumber(updated);
  }

  static async updateAction(
    user: { id: string; role: string; email?: string; schoolId?: string },
    incidentId: string,
    data: {
      recommendedAction?: string;
      approvedAction?: string;
      actionDate?: string | Date;
      responsibleStaffName?: string;
      actionStatus?: string;
      status?: string;
      notes?: string;
    }
  ) {
    if (user.role !== 'admin' && user.role !== 'school_admin' && user.role !== 'super_admin' && user.role !== 'discipline_officer') {
      throw new Error('Forbidden: Only authorized staff can update disciplinary actions');
    }

    const incident = await prisma.studentDiscipline.findUnique({
      where: { id: incidentId }
    });

    if (!incident) throw new Error('Incident not found');

    const updated = await prisma.studentDiscipline.update({
      where: { id: incidentId },
      data: {
        recommendedAction: data.recommendedAction ?? incident.recommendedAction,
        approvedAction: data.approvedAction ?? incident.approvedAction,
        actionDate: data.actionDate ? new Date(data.actionDate) : incident.actionDate,
        responsibleStaffName: data.responsibleStaffName ?? incident.responsibleStaffName,
        actionStatus: data.actionStatus ?? incident.actionStatus,
        status: data.status ? data.status.toUpperCase() : (data.approvedAction ? 'ACTION_REQUIRED' : incident.status)
      },
      include: {
        student: true,
        assignedTo: { select: { id: true, full_name: true } }
      }
    });

    await prisma.disciplineFollowUp.create({
      data: {
        disciplineId: incidentId,
        authorId: user.id,
        authorName: user.email || 'Staff',
        note: data.notes || `Disciplinary Action set: ${data.approvedAction || data.recommendedAction || 'Action updated'}.`,
        actionTaken: data.approvedAction || data.recommendedAction || null,
        statusBefore: incident.status,
        statusAfter: updated.status
      }
    });

    await logDisciplineAudit({
      userId: user.id,
      action: 'DISCIPLINE_ACTION_UPDATED',
      entityId: incidentId,
      newValues: { action: data.approvedAction || data.recommendedAction, status: updated.status }
    });

    if (data.approvedAction && data.approvedAction !== incident.approvedAction) {
      const studentName = (updated as any).student?.fullName || 'Student';
      const notifTitle = `Disciplinary Action Notice: #${updated.caseNumber || incidentId.slice(0, 6)}`;
      const notifMsg = `Disciplinary action (${data.approvedAction}) has been assigned for ${studentName}. Tap to view details.`;
      await notifyParentForDiscipline({
        studentId: updated.studentId,
        title: notifTitle,
        message: notifMsg,
        caseNumber: updated.caseNumber || undefined
      });
    }

    return ensureCaseNumber(updated);
  }

  static async getStudentDisciplineProfile(
    user: { id: string; role: string; schoolId?: string },
    studentId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      severity?: string;
      status?: string;
      categoryName?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        grade: { select: { name: true } },
        section: { select: { name: true } },
        stream: { select: { name: true } },
        parentStudents: { select: { relationshipType: true } }
      }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    if (user.role === 'teacher') {
      const assignments = await getTeacherAssignments(user.id);
      const isAssigned = assignments.some(
        a => a.gradeId === student.gradeId && a.sectionId === student.sectionId
      );
      if (!isAssigned) {
        throw new Error('Forbidden: You can only view discipline profiles for your assigned homeroom students');
      }
    } else if (user.role === 'parent') {
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: user.id, studentId }
      });
      if (!link) {
        throw new Error('Forbidden: You can only view discipline profile for your linked child');
      }
    }

    const [
      totalCases,
      openCases,
      underReviewCases,
      resolvedCases,
      followUpsDue
    ] = await Promise.all([
      prisma.studentDiscipline.count({ where: { studentId } }),
      prisma.studentDiscipline.count({ where: { studentId, status: 'OPEN' } }),
      prisma.studentDiscipline.count({ where: { studentId, status: { in: ['UNDER_REVIEW', 'INVESTIGATION'] } } }),
      prisma.studentDiscipline.count({ where: { studentId, status: { in: ['RESOLVED', 'CLOSED'] } } }),
      prisma.studentDiscipline.count({
        where: {
          studentId,
          followUpDate: { lte: new Date() },
          status: { notIn: ['RESOLVED', 'CLOSED'] }
        }
      }),
    ]);

    const severityBreakdown = {
      LOW:      await prisma.studentDiscipline.count({ where: { studentId, severity: 'LOW' } }),
      MEDIUM:   await prisma.studentDiscipline.count({ where: { studentId, severity: 'MEDIUM' } }),
      HIGH:     await prisma.studentDiscipline.count({ where: { studentId, severity: 'HIGH' } }),
      CRITICAL: await prisma.studentDiscipline.count({ where: { studentId, severity: 'CRITICAL' } }),
    };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const skip = (page - 1) * limit;

    const where: any = { studentId };
    if (query.severity) where.severity = query.severity.toUpperCase();
    if (query.status) where.status = query.status.toUpperCase();
    if (query.categoryName) where.categoryName = { equals: query.categoryName, mode: 'insensitive' };

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = new Date(query.startDate);
      if (query.endDate) where.date.lte = new Date(query.endDate);
    }

    if (query.search) {
      const s = query.search.trim();
      where.AND = [
        {
          OR: [
            { caseNumber: { contains: s, mode: 'insensitive' } },
            { title: { contains: s, mode: 'insensitive' } },
            { description: { contains: s, mode: 'insensitive' } },
            { categoryName: { contains: s, mode: 'insensitive' } }
          ]
        }
      ];
    }

    const [rawHistory, historyTotal] = await Promise.all([
      prisma.studentDiscipline.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          assignedTo: { select: { id: true, full_name: true, email: true } },
          reportedBy: { select: { id: true, full_name: true, email: true } },
          followUps: { orderBy: { createdAt: 'desc' }, take: 5 }
        }
      }),
      prisma.studentDiscipline.count({ where })
    ]);

    const sanitizedHistory = rawHistory.map(inc => sanitizeIncidentForRole(ensureCaseNumber(inc), user.role));

    return {
      student: {
        id: student.id,
        student_id: student.student_id,
        fullName: student.fullName,
        gender: student.gender,
        grade: student.grade?.name || '',
        section: student.section?.name || '',
        stream: student.stream?.name || '',
        parentName: student.parent_name,
        parentPhone: student.parent_phone,
        parentEmail: student.parent_email,
        relationshipType: student.parentStudents?.[0]?.relationshipType || 'Guardian',
      },
      summaryStats: {
        title: 'Recorded Discipline Cases',
        totalCases,
        openCases,
        underReviewCases,
        resolvedCases,
        followUpsDue,
        severityBreakdown
      },
      history: sanitizedHistory,
      pagination: {
        total: historyTotal,
        page,
        limit,
        totalPages: Math.ceil(historyTotal / limit)
      }
    };
  }

  static async updateIncident(
    user: { id: string; role: string; email?: string; schoolId?: string },
    incidentId: string,
    data: {
      title?: string;
      description?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      status?: 'OPEN' | 'UNDER_REVIEW' | 'INVESTIGATION' | 'ACTION_REQUIRED' | 'RESOLVED' | 'CLOSED';
      categoryName?: string;
      categoryId?: string;
      location?: string;
      witnesses?: string[];
      evidence?: any[];
      immediateAction?: string;
      resolutionNotes?: string;
      followUpDate?: string | Date;
      notifyParent?: boolean;
      assignedToId?: string;
      assignedToName?: string;
    }
  ) {
    const existing = await this.getIncidentById(user, incidentId);

    const reporterUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { full_name: true }
    });
    const authorName = reporterUser?.full_name || user.email || 'Staff';

    const oldSeverity = existing.severity;
    const oldStatus = existing.status;

    const updated = await prisma.studentDiscipline.update({
      where: { id: incidentId },
      data: {
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        severity: data.severity ?? existing.severity,
        status: data.status ?? existing.status,
        categoryName: data.categoryName ?? existing.categoryName,
        categoryId: data.categoryId ?? existing.categoryId,
        location: data.location ?? existing.location,
        witnesses: data.witnesses !== undefined ? (data.witnesses as any) : (existing.witnesses as any),
        evidence: data.evidence !== undefined ? (data.evidence as any) : (existing.evidence as any),
        immediateAction: data.immediateAction ?? existing.immediateAction,
        resolutionNotes: data.resolutionNotes ?? existing.resolutionNotes,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : existing.followUpDate,
        assignedToId: data.assignedToId ?? existing.assignedToId,
        assignedToName: data.assignedToName ?? existing.assignedToName
      },
      include: {
        student: true,
        grade: true,
        section: true,
        assignedTo: { select: { id: true, full_name: true, email: true } }
      }
    });

    if (data.status !== oldStatus || data.severity !== oldSeverity || data.resolutionNotes) {
      await prisma.disciplineFollowUp.create({
        data: {
          disciplineId: updated.id,
          authorId: user.id,
          authorName,
          note: data.resolutionNotes || `Updated incident status to ${updated.status} and severity to ${updated.severity}.`,
          actionTaken: data.immediateAction || null,
          statusBefore: oldStatus,
          statusAfter: updated.status
        }
      });
    }

    await logDisciplineAudit({
      userId: user.id,
      action: updated.status === 'RESOLVED' ? 'DISCIPLINE_RESOLVED' : updated.status === 'CLOSED' ? 'DISCIPLINE_CLOSED' : 'DISCIPLINE_EDITED',
      entityId: updated.id,
      oldValues: { severity: oldSeverity, status: oldStatus },
      newValues: { severity: updated.severity, status: updated.status }
    });

    if (data.notifyParent || oldSeverity !== updated.severity || oldStatus !== updated.status) {
      const studentName = (updated as any).student?.fullName || 'Student';
      const notifTitle = `Discipline Update: #${updated.caseNumber || incidentId.slice(0, 6)}`;
      const notifMsg = `Incident "${updated.title}" for ${studentName} updated. Status: ${updated.status}, Severity: ${updated.severity}.`;
      await notifyParentForDiscipline({
        studentId: updated.studentId,
        title: notifTitle,
        message: notifMsg,
        caseNumber: updated.caseNumber || undefined
      });
      await prisma.studentDiscipline.update({
        where: { id: incidentId },
        data: { parentNotified: true, parentNotifiedAt: new Date() }
      });
    }

    return ensureCaseNumber(updated);
  }

  static async deleteIncident(user: { id: string; role: string; schoolId?: string }, incidentId: string) {
    if (user.role !== 'admin' && user.role !== 'school_admin' && user.role !== 'super_admin') {
      throw new Error('Forbidden: Only School Admin can delete discipline records');
    }

    const existing = await prisma.studentDiscipline.findUnique({
      where: { id: incidentId }
    });

    if (!existing) {
      throw new Error('Incident not found');
    }

    await prisma.studentDiscipline.delete({
      where: { id: incidentId }
    });

    await logDisciplineAudit({
      userId: user.id,
      action: 'DISCIPLINE_DELETED',
      entityId: incidentId,
      oldValues: { title: existing.title, studentId: existing.studentId, caseNumber: existing.caseNumber }
    });

    return { success: true };
  }

  static async acknowledgeIncident(
    user: { id: string; role: string; schoolId?: string },
    incidentId: string,
    notes?: string
  ) {
    if (user.role !== 'parent') {
      throw new Error('Only parents can acknowledge discipline reports');
    }

    const incident = await this.getIncidentById(user, incidentId);

    const updated = await prisma.studentDiscipline.update({
      where: { id: incident.id },
      data: {
        parentAcknowledged: true,
        parentAcknowledgedAt: new Date(),
        parentAcknowledgementNotes: notes || null
      }
    });

    await logDisciplineAudit({
      userId: user.id,
      action: 'DISCIPLINE_PARENT_ACKNOWLEDGED',
      entityId: incident.id,
      newValues: { notes }
    });

    return ensureCaseNumber(updated);
  }

  static async addFollowUp(
    user: { id: string; role: string; email?: string; schoolId?: string },
    incidentId: string,
    data: { note: string; actionTaken?: string; status?: string }
  ) {
    const incident = await this.getIncidentById(user, incidentId);

    const reporterUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { full_name: true }
    });
    const authorName = reporterUser?.full_name || user.email || 'Staff';

    const statusBefore = incident.status;
    let statusAfter = incident.status;

    if (data.status && data.status !== incident.status) {
      await prisma.studentDiscipline.update({
        where: { id: incidentId },
        data: { status: data.status }
      });
      statusAfter = data.status;
    }

    const followUp = await prisma.disciplineFollowUp.create({
      data: {
        disciplineId: incident.id,
        authorId: user.id,
        authorName,
        note: data.note,
        actionTaken: data.actionTaken || null,
        statusBefore,
        statusAfter
      }
    });

    await logDisciplineAudit({
      userId: user.id,
      action: 'DISCIPLINE_FOLLOWUP_ADDED',
      entityId: incident.id,
      newValues: { note: data.note, statusAfter }
    });

    return followUp;
  }

  static async getAnalytics(user: { id: string; role: string; schoolId?: string }) {
    const where: any = {};

    if (user.role === 'teacher') {
      const assignments = await getTeacherAssignments(user.id);
      if (assignments.length === 0) {
        return {
          total: 0, open: 0, openCases: 0, resolvedCases: 0, criticalCases: 0, thisMonth: 0,
          byCategory: [], bySeverity: [], byGrade: [], repeatOffenders: [], monthlyMap: {}
        };
      }
      where.OR = assignments.map(a => ({
        gradeId: a.gradeId,
        sectionId: a.sectionId
      }));
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total,
      open,
      underReview,
      investigation,
      actionRequired,
      resolved,
      closed,
      critical,
      thisMonthCount,
      allIncidents
    ] = await Promise.all([
      prisma.studentDiscipline.count({ where }),
      prisma.studentDiscipline.count({ where: { ...where, status: 'OPEN' } }),
      prisma.studentDiscipline.count({ where: { ...where, status: 'UNDER_REVIEW' } }),
      prisma.studentDiscipline.count({ where: { ...where, status: 'INVESTIGATION' } }),
      prisma.studentDiscipline.count({ where: { ...where, status: 'ACTION_REQUIRED' } }),
      prisma.studentDiscipline.count({ where: { ...where, status: 'RESOLVED' } }),
      prisma.studentDiscipline.count({ where: { ...where, status: 'CLOSED' } }),
      prisma.studentDiscipline.count({ where: { ...where, severity: 'CRITICAL' } }),
      prisma.studentDiscipline.count({ where: { ...where, createdAt: { gte: firstDayOfMonth } } }),
      prisma.studentDiscipline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: {
          id: true,
          caseNumber: true,
          severity: true,
          status: true,
          categoryName: true,
          createdAt: true,
          date: true,
          reportedByName: true,
          student: { select: { id: true, fullName: true, student_id: true } },
          grade: { select: { name: true } },
          section: { select: { name: true } }
        }
      })
    ]);

    const categoryCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const gradeCounts: Record<string, number> = {};
    const studentCounts: Record<string, { student: any; count: number }> = {};
    const monthlyMap: Record<string, number> = {};

    allIncidents.forEach(inc => {
      categoryCounts[inc.categoryName] = (categoryCounts[inc.categoryName] || 0) + 1;
      severityCounts[inc.severity] = (severityCounts[inc.severity] || 0) + 1;

      const gradeName = inc.grade?.name || 'Unknown';
      gradeCounts[gradeName] = (gradeCounts[gradeName] || 0) + 1;

      if (inc.student) {
        const sKey = inc.student.id;
        if (!studentCounts[sKey]) {
          studentCounts[sKey] = {
            student: {
              ...inc.student,
              grade: inc.grade?.name,
              section: inc.section?.name
            },
            count: 0
          };
        }
        studentCounts[sKey].count += 1;
      }

      const d = new Date(inc.date || inc.createdAt);
      const mKey = d.toLocaleString('default', { month: 'short' });
      monthlyMap[mKey] = (monthlyMap[mKey] || 0) + 1;
    });

    const byCategory = Object.entries(categoryCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const bySeverity = Object.entries(severityCounts).map(([name, value]) => ({ name, value }));

    const byGrade = Object.entries(gradeCounts).map(([name, value]) => ({ name, value }));

    const repeatOffenders = Object.values(studentCounts)
      .filter(s => s.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return {
      total,
      open,
      openCases: open + underReview + investigation + actionRequired,
      underReviewCases: underReview + investigation,
      actionRequiredCases: actionRequired,
      resolvedCases: resolved + closed,
      criticalCases: critical,
      thisMonth: thisMonthCount,
      byCategory,
      bySeverity,
      byGrade,
      repeatOffenders,
      monthlyMap
    };
  }
}
