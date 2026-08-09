import prisma from '../config/db';

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
  schoolId: string;
  userId?: string;
  action: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId: params.schoolId,
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
  schoolId: string;
  studentId: string;
  title: string;
  message: string;
  type?: string;
}) {
  try {
    // 1. Create ParentNotification record
    await prisma.parentNotification.create({
      data: {
        schoolId: params.schoolId,
        studentId: params.studentId,
        title: params.title,
        message: params.message,
        type: params.type || 'DISCIPLINE'
      }
    });

    // 2. Find linked parents via ParentStudentLink
    const links = await prisma.parentStudentLink.findMany({
      where: { schoolId: params.schoolId, studentId: params.studentId },
      include: { parent: true }
    });

    for (const link of links) {
      if (link.parent) {
        await prisma.userNotification.create({
          data: {
            schoolId: params.schoolId,
            userId: link.parent.id,
            title: params.title,
            message: params.message,
            type: params.type || 'DISCIPLINE'
          }
        });
      }
    }
  } catch (err) {
    console.error('[DisciplineService] Parent Notification error:', err);
  }
}

/**
 * Helper to fetch teacher homeroom assignments for permission checks.
 */
async function getTeacherAssignments(userId: string, schoolId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { user_id: userId, schoolId }
  });
  if (!teacher) return [];
  return await prisma.teacherAssignment.findMany({
    where: { teacher_id: teacher.id, schoolId }
  });
}

/**
 * Helper to generate a unique human-readable case number: DC-2026-0001
 */
async function generateCaseNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.studentDiscipline.count({ where: { schoolId } });
  const seq = String(count + 1).padStart(4, '0');
  const candidate = `DC-${year}-${seq}`;

  const exists = await prisma.studentDiscipline.findFirst({
    where: { schoolId, caseNumber: candidate }
  });

  if (exists) {
    return `DC-${year}-${String(count + Math.floor(Math.random() * 900) + 100).padStart(4, '0')}`;
  }

  return candidate;
}

/**
 * Ensures incident has a display caseNumber if missing (historical record compatibility).
 */
function ensureCaseNumber(inc: any) {
  if (inc && !inc.caseNumber) {
    const yr = new Date(inc.createdAt || inc.date || Date.now()).getFullYear();
    const shortId = (inc.id || '').replace(/-/g, '').substring(0, 4).toUpperCase();
    inc.caseNumber = `DC-${yr}-${shortId}`;
  }
  return inc;
}

/**
 * Backend privacy sanitization to hide internal investigation and staff notes from Parents and Teachers.
 */
function sanitizeIncidentForRole(incident: any, role: string) {
  if (!incident) return incident;

  if (role === 'parent') {
    // Parents must only see official public information, NOT internal staff/investigation data
    const {
      investigationNotes,
      confidentialNotes,
      findings,
      meetingNotes,
      ...publicData
    } = incident;

    return {
      ...publicData,
      witnesses: undefined // Hide witness names from parent for privacy & protection
    };
  }

  if (role === 'teacher') {
    // Teachers see general info, but hide confidential notes unless they are assigned officer
    const { confidentialNotes, ...teacherData } = incident;
    return teacherData;
  }

  // Admins & Discipline Officers see full details
  return incident;
}

export class DisciplineService {
  /**
   * Seed default categories for a school if none exist.
   */
  static async ensureDefaultCategories(schoolId: string) {
    const existing = await prisma.disciplineCategory.findMany({
      where: { schoolId },
      select: { name: true }
    });

    const existingNames = new Set(existing.map(c => c.name));
    const missing = DEFAULT_DISCIPLINE_CATEGORIES.filter(name => !existingNames.has(name));

    if (missing.length > 0) {
      await prisma.disciplineCategory.createMany({
        data: missing.map(name => ({
          schoolId,
          name,
          isDefault: true
        })),
        skipDuplicates: true
      });
    }

    return prisma.disciplineCategory.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' }
    });
  }

  static async getCategories(schoolId: string) {
    return this.ensureDefaultCategories(schoolId);
  }

  static async createCategory(schoolId: string, name: string, description?: string) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Category name is required');

    const existing = await prisma.disciplineCategory.findFirst({
      where: {
        schoolId,
        name: { equals: trimmedName, mode: 'insensitive' }
      }
    });

    if (existing) {
      throw new Error(`Category "${trimmedName}" already exists`);
    }

    return prisma.disciplineCategory.create({
      data: {
        schoolId,
        name: trimmedName,
        description: description?.trim() || null,
        isDefault: false
      }
    });
  }

  static async deleteCategory(schoolId: string, categoryId: string) {
    return prisma.disciplineCategory.deleteMany({
      where: { id: categoryId, schoolId, isDefault: false }
    });
  }

  /**
   * Configurable Disciplinary Actions
   */
  static async ensureDefaultActions(schoolId: string) {
    const existing = await prisma.disciplineActionConfig.findMany({
      where: { schoolId },
      select: { name: true }
    });

    const existingNames = new Set(existing.map(a => a.name));
    const missing = DEFAULT_DISCIPLINE_ACTIONS.filter(name => !existingNames.has(name));

    if (missing.length > 0) {
      await prisma.disciplineActionConfig.createMany({
        data: missing.map(name => ({
          schoolId,
          name,
          isDefault: true
        })),
        skipDuplicates: true
      });
    }

    return prisma.disciplineActionConfig.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' }
    });
  }

  static async getActionsConfig(schoolId: string) {
    return this.ensureDefaultActions(schoolId);
  }

  static async createActionConfig(schoolId: string, name: string, description?: string) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Action name is required');

    const existing = await prisma.disciplineActionConfig.findFirst({
      where: {
        schoolId,
        name: { equals: trimmedName, mode: 'insensitive' }
      }
    });

    if (existing) {
      throw new Error(`Disciplinary Action "${trimmedName}" already exists`);
    }

    return prisma.disciplineActionConfig.create({
      data: {
        schoolId,
        name: trimmedName,
        description: description?.trim() || null,
        isDefault: false
      }
    });
  }

  static async deleteActionConfig(schoolId: string, actionId: string) {
    return prisma.disciplineActionConfig.deleteMany({
      where: { id: actionId, schoolId, isDefault: false }
    });
  }

  /**
   * Create a new student discipline incident.
   */
  static async createIncident(
    user: { id: string; role: string; schoolId: string; email: string },
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
    const schoolId = user.schoolId;

    const student = await prisma.student.findFirst({
      where: { id: data.studentId, schoolId },
      include: { grade: true, section: true, stream: true }
    });

    if (!student) {
      throw new Error('Student not found in this school');
    }

    if (user.role === 'teacher') {
      const assignments = await getTeacherAssignments(user.id, schoolId);
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
      const catById = await prisma.disciplineCategory.findFirst({
        where: { id: data.categoryId, schoolId }
      });
      if (catById) validCategoryId = catById.id;
    }
    if (!validCategoryId && data.categoryName) {
      const catByName = await prisma.disciplineCategory.findFirst({
        where: { name: data.categoryName, schoolId }
      });
      if (catByName) validCategoryId = catByName.id;
    }

    const caseNumber = await generateCaseNumber(schoolId);

    const incident = await prisma.studentDiscipline.create({
      data: {
        caseNumber,
        schoolId,
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
        parentNotified: Boolean(data.parentNotified),
        parentNotifiedAt: data.parentNotified ? new Date() : null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        status: data.assignedToId ? 'UNDER_REVIEW' : 'OPEN'
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
      schoolId,
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

    if (data.parentNotified) {
      const notifTitle = `Official Notice: Discipline Case #${caseNumber}`;
      const notifMsg = `Discipline record created for ${student.fullName} (${data.categoryName}, ${data.severity} severity). Tap to view details.`;
      await notifyParentForDiscipline({
        schoolId,
        studentId: student.id,
        title: notifTitle,
        message: notifMsg
      });
    }

    return ensureCaseNumber(incident);
  }

  /**
   * Get incidents with multi-role access control, searching, filtering, and server-side pagination.
   */
  static async getIncidents(
    user: { id: string; role: string; schoolId: string },
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
    const schoolId = user.schoolId;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { schoolId };

    if (user.role === 'teacher') {
      const assignments = await getTeacherAssignments(user.id, schoolId);
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
      const links = await prisma.parentStudentLink.findMany({
        where: { parentId: user.id, schoolId },
        select: { studentId: true }
      });
      const studentIds = links.map(l => l.studentId);
      if (studentIds.length === 0) {
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
      where.studentId = { in: studentIds };
    }

    if (query.studentId) where.studentId = query.studentId;
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

  /**
   * Get single incident detail with security checks and privacy sanitization.
   */
  static async getIncidentById(
    user: { id: string; role: string; schoolId: string },
    incidentId: string
  ) {
    const incident = await prisma.studentDiscipline.findFirst({
      where: { id: incidentId, schoolId: user.schoolId },
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
      const assignments = await getTeacherAssignments(user.id, user.schoolId);
      const isAssigned = assignments.some(
        a => a.gradeId === incident.gradeId && a.sectionId === incident.sectionId
      );
      if (!isAssigned && incident.reportedById !== user.id) {
        throw new Error('Forbidden: You do not have permission to view this discipline record');
      }
    } else if (user.role === 'parent') {
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: user.id, studentId: incident.studentId, schoolId: user.schoolId }
      });
      if (!link) {
        throw new Error('Forbidden: You can only view discipline records for your linked child');
      }

      await logDisciplineAudit({
        schoolId: user.schoolId,
        userId: user.id,
        action: 'DISCIPLINE_PARENT_VIEWED',
        entityId: incident.id
      });
    }

    let auditLogs: any[] = [];
    if (user.role === 'school_admin' || user.role === 'super_admin' || user.role === 'discipline_officer') {
      auditLogs = await prisma.auditLog.findMany({
        where: {
          schoolId: user.schoolId,
          entity_type: 'DISCIPLINE',
          entity_id: incidentId
        },
        orderBy: { created_at: 'desc' },
        take: 20
      });
    }

    const sanitized = sanitizeIncidentForRole(ensureCaseNumber(incident), user.role);

    return {
      ...sanitized,
      auditLogs
    };
  }

  /**
   * Assign or Reassign a discipline case to an Officer.
   */
  static async assignOfficer(
    user: { id: string; role: string; schoolId: string; email: string },
    incidentId: string,
    officerId: string,
    notes?: string
  ) {
    if (user.role !== 'school_admin' && user.role !== 'super_admin' && user.role !== 'discipline_officer') {
      throw new Error('Forbidden: Only authorized officers/admins can reassign cases');
    }

    const incident = await prisma.studentDiscipline.findFirst({
      where: { id: incidentId, schoolId: user.schoolId },
      include: { student: true }
    });

    if (!incident) throw new Error('Incident not found');

    const officer = await prisma.user.findFirst({
      where: { id: officerId, schoolId: user.schoolId }
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
        authorName: user.email,
        note: notes || `Case assigned to Discipline Officer ${officer.full_name}.`,
        statusBefore: incident.status,
        statusAfter: updated.status
      }
    });

    await logDisciplineAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: 'DISCIPLINE_OFFICER_ASSIGNED',
      entityId: incidentId,
      newValues: { officerId: officer.id, officerName: officer.full_name }
    });

    try {
      await prisma.userNotification.create({
        data: {
          schoolId: user.schoolId,
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

  /**
   * Update investigation findings and notes (Discipline Officer / Admin).
   */
  static async updateInvestigation(
    user: { id: string; role: string; schoolId: string; email: string },
    incidentId: string,
    data: {
      investigationNotes?: string;
      findings?: string;
      meetingNotes?: string;
      confidentialNotes?: string;
      status?: string;
    }
  ) {
    if (user.role !== 'school_admin' && user.role !== 'super_admin' && user.role !== 'discipline_officer') {
      throw new Error('Forbidden: Only authorized officers can record investigation notes');
    }

    const incident = await prisma.studentDiscipline.findFirst({
      where: { id: incidentId, schoolId: user.schoolId }
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
        authorName: user.email,
        note: `Investigation updated. Findings: ${data.findings || 'Notes updated'}.`,
        statusBefore: incident.status,
        statusAfter: updated.status
      }
    });

    await logDisciplineAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: 'DISCIPLINE_INVESTIGATION_UPDATED',
      entityId: incidentId,
      newValues: { status: updated.status, findings: data.findings }
    });

    return ensureCaseNumber(updated);
  }

  /**
   * Record or update Action Plan details.
   */
  static async updateAction(
    user: { id: string; role: string; schoolId: string; email: string },
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
    if (user.role !== 'school_admin' && user.role !== 'super_admin' && user.role !== 'discipline_officer') {
      throw new Error('Forbidden: Only authorized staff can update disciplinary actions');
    }

    const incident = await prisma.studentDiscipline.findFirst({
      where: { id: incidentId, schoolId: user.schoolId }
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
        authorName: user.email,
        note: data.notes || `Disciplinary Action set: ${data.approvedAction || data.recommendedAction || 'Action updated'}.`,
        actionTaken: data.approvedAction || data.recommendedAction || null,
        statusBefore: incident.status,
        statusAfter: updated.status
      }
    });

    await logDisciplineAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: 'DISCIPLINE_ACTION_UPDATED',
      entityId: incidentId,
      newValues: { action: data.approvedAction || data.recommendedAction, status: updated.status }
    });

    return ensureCaseNumber(updated);
  }

  /**
   * Upgrade Student Discipline Profile View (Requirement #3 & #4).
   */
  static async getStudentDisciplineProfile(
    user: { id: string; role: string; schoolId: string },
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
    const schoolId = user.schoolId;

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        grade: { select: { name: true } },
        section: { select: { name: true } },
        stream: { select: { name: true } }
      }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    if (user.role === 'teacher') {
      const assignments = await getTeacherAssignments(user.id, schoolId);
      const isAssigned = assignments.some(
        a => a.gradeId === student.gradeId && a.sectionId === student.sectionId
      );
      if (!isAssigned) {
        throw new Error('Forbidden: You can only view discipline profiles for your assigned homeroom students');
      }
    } else if (user.role === 'parent') {
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: user.id, studentId, schoolId }
      });
      if (!link) {
        throw new Error('Forbidden: You can only view discipline profile for your linked child');
      }
    }

    const allStudentCases = await prisma.studentDiscipline.findMany({
      where: { schoolId, studentId },
      select: {
        id: true,
        status: true,
        severity: true,
        followUpDate: true
      }
    });

    const totalCases = allStudentCases.length;
    const openCases = allStudentCases.filter(c => c.status === 'OPEN').length;
    const underReviewCases = allStudentCases.filter(c => c.status === 'UNDER_REVIEW' || c.status === 'INVESTIGATION').length;
    const resolvedCases = allStudentCases.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
    const followUpsDue = allStudentCases.filter(c => c.followUpDate && new Date(c.followUpDate) <= new Date() && c.status !== 'RESOLVED' && c.status !== 'CLOSED').length;

    const severityBreakdown = {
      LOW: allStudentCases.filter(c => c.severity === 'LOW').length,
      MEDIUM: allStudentCases.filter(c => c.severity === 'MEDIUM').length,
      HIGH: allStudentCases.filter(c => c.severity === 'HIGH').length,
      CRITICAL: allStudentCases.filter(c => c.severity === 'CRITICAL').length
    };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const skip = (page - 1) * limit;

    const where: any = { schoolId, studentId };
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
        parentEmail: student.parent_email
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

  /**
   * Update an existing discipline incident.
   */
  static async updateIncident(
    user: { id: string; role: string; schoolId: string; email: string },
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
    const authorName = reporterUser?.full_name || user.email;

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
      schoolId: user.schoolId,
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
        schoolId: user.schoolId,
        studentId: updated.studentId,
        title: notifTitle,
        message: notifMsg
      });
      await prisma.studentDiscipline.update({
        where: { id: incidentId },
        data: { parentNotified: true, parentNotifiedAt: new Date() }
      });
    }

    return ensureCaseNumber(updated);
  }

  static async deleteIncident(user: { id: string; role: string; schoolId: string }, incidentId: string) {
    if (user.role !== 'school_admin' && user.role !== 'super_admin') {
      throw new Error('Forbidden: Only School Admin can delete discipline records');
    }

    const existing = await prisma.studentDiscipline.findFirst({
      where: { id: incidentId, schoolId: user.schoolId }
    });

    if (!existing) {
      throw new Error('Incident not found');
    }

    await prisma.studentDiscipline.delete({
      where: { id: incidentId }
    });

    await logDisciplineAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: 'DISCIPLINE_DELETED',
      entityId: incidentId,
      oldValues: { title: existing.title, studentId: existing.studentId, caseNumber: existing.caseNumber }
    });

    return { success: true };
  }

  static async acknowledgeIncident(
    user: { id: string; role: string; schoolId: string },
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
      schoolId: user.schoolId,
      userId: user.id,
      action: 'DISCIPLINE_PARENT_ACKNOWLEDGED',
      entityId: incident.id,
      newValues: { notes }
    });

    return ensureCaseNumber(updated);
  }

  static async addFollowUp(
    user: { id: string; role: string; schoolId: string; email: string },
    incidentId: string,
    data: { note: string; actionTaken?: string; status?: string }
  ) {
    const incident = await this.getIncidentById(user, incidentId);

    const reporterUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { full_name: true }
    });
    const authorName = reporterUser?.full_name || user.email;

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
      schoolId: user.schoolId,
      userId: user.id,
      action: 'DISCIPLINE_FOLLOWUP_ADDED',
      entityId: incident.id,
      newValues: { note: data.note, statusAfter }
    });

    return followUp;
  }

  static async getAnalytics(user: { id: string; role: string; schoolId: string }) {
    const schoolId = user.schoolId;
    const where: any = { schoolId };

    if (user.role === 'teacher') {
      const assignments = await getTeacherAssignments(user.id, schoolId);
      if (assignments.length === 0) {
        return {
          total: 0, open: 0, openCases: 0, resolvedCases: 0, criticalCases: 0, thisMonth: 0,
          byCategory: [], bySeverity: [], byGrade: [], repeatOffenders: [], topReporters: []
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
    const reporterCounts: Record<string, number> = {};
    const monthlyMap: Record<string, number> = {};

    allIncidents.forEach(inc => {
      categoryCounts[inc.categoryName] = (categoryCounts[inc.categoryName] || 0) + 1;
      severityCounts[inc.severity] = (severityCounts[inc.severity] || 0) + 1;

      const gradeName = inc.grade?.name || 'Unknown';
      gradeCounts[gradeName] = (gradeCounts[gradeName] || 0) + 1;

      if (inc.student) {
        const sKey = inc.student.id;
        if (!studentCounts[sKey]) {
          studentCounts[sKey] = { student: inc.student, count: 0 };
        }
        studentCounts[sKey].count += 1;
      }

      const rName = inc.reportedByName || 'Unknown';
      reporterCounts[rName] = (reporterCounts[rName] || 0) + 1;

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
      .slice(0, 10);

    const topReporters = Object.entries(reporterCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

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
      topReporters,
      monthlyMap
    };
  }
}
