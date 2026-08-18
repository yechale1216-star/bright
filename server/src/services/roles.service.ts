import prisma from '../config/db';

// ─── System Default Roles (Global across all schools) ──────────────────────
export const SYSTEM_DEFAULT_ROLES = [
  {
    key: 'school_admin',
    name: 'School Administrator',
    description: 'Full administrative access to manage school operations, staff, students, and settings.',
    color: '#e11d48',
    isSystem: true,
    sortOrder: 1,
    permissions: {
      students:             { view: true,  create: true,  edit: true,  delete: true },
      teachers:             { view: true,  create: true,  edit: true,  delete: true },
      assignments:          { view: true,  assign: true,  remove: true },
      promotion:            { view: true,  promote: true, reverse: true },
      attendance:           { view: true,  mark: true,    export: true },
      attendance_analytics: { view: true,  export: true },
      discipline:           { view: true,  create: true,  resolve: true },
      calls:                { view: true,  make: true },
      communication:        { view: true,  send: true },
      reports:              { view: true,  export: true },
      announcements:        { view: true,  create: true },
      settings:             { view: true,  edit: true },
      profile:              { view: true,  edit: true },
      users:                { view: true,  create_user: true, edit_user: true, delete_user: true, manage_roles: true },
    },
  },
  {
    key: 'teacher',
    name: 'Teacher',
    description: 'Classroom and subject instructor with access to student attendance, assignments, and teaching tools.',
    color: '#3b82f6',
    isSystem: true,
    sortOrder: 2,
    permissions: {
      students:             { view: true,  create: false, edit: false, delete: false },
      teachers:             { view: true,  create: false, edit: false, delete: false },
      assignments:          { view: true,  assign: false, remove: false },
      promotion:            { view: false, promote: false, reverse: false },
      attendance:           { view: true,  mark: true,    export: false },
      attendance_analytics: { view: false, export: false },
      discipline:           { view: true,  create: true,  resolve: false },
      calls:                { view: true,  make: true },
      communication:        { view: true,  send: true },
      reports:              { view: false, export: false },
      announcements:        { view: true,  create: false },
      settings:             { view: false, edit: false },
      profile:              { view: true,  edit: true },
      users:                { view: false, create_user: false, edit_user: false, delete_user: false, manage_roles: false },
    },
  },
  {
    key: 'registrar',
    name: 'Student Registration Officer (Registrar)',
    description: 'Responsible for student intake, enrollment processing, and maintaining official student records.',
    color: '#6366f1',
    isSystem: true,
    sortOrder: 3,
    permissions: {
      students:             { view: true,  create: true,  edit: true,  delete: false },
      teachers:             { view: true,  create: false, edit: false, delete: false },
      assignments:          { view: true,  assign: false, remove: false },
      promotion:            { view: true,  promote: false, reverse: false },
      attendance:           { view: true,  mark: false, export: false },
      attendance_analytics: { view: true,  export: false },
      discipline:           { view: false, create: false, resolve: false },
      calls:                { view: false, make: false },
      communication:        { view: true,  send: false },
      reports:              { view: true,  export: true },
      announcements:        { view: true,  create: false },
      settings:             { view: false, edit: false },
      profile:              { view: true,  edit: true },
      users:                { view: false, create_user: false, edit_user: false, delete_user: false, manage_roles: false },
    },
  },
  {
    key: 'discipline_officer',
    name: 'Student Discipline & Conduct Officer',
    description: 'Manages student behavioral incidents, discipline cases, follow-ups, and conduct records.',
    color: '#f59e0b',
    isSystem: true,
    sortOrder: 4,
    permissions: {
      students:             { view: true,  create: false, edit: false, delete: false },
      teachers:             { view: true,  create: false, edit: false, delete: false },
      assignments:          { view: false, assign: false, remove: false },
      promotion:            { view: false, promote: false, reverse: false },
      attendance:           { view: true,  mark: false, export: false },
      attendance_analytics: { view: false, export: false },
      discipline:           { view: true,  create: true,  resolve: true },
      calls:                { view: false, make: false },
      communication:        { view: true,  send: true },
      reports:              { view: true,  export: true },
      announcements:        { view: true,  create: false },
      settings:             { view: false, edit: false },
      profile:              { view: true,  edit: true },
      users:                { view: false, create_user: false, edit_user: false, delete_user: false, manage_roles: false },
    },
  },
  {
    key: 'staff',
    name: 'General Staff',
    description: 'School operational and administrative staff member with self-service portal and attendance access.',
    color: '#10b981',
    isSystem: true,
    sortOrder: 5,
    permissions: {
      students:             { view: false, create: false, edit: false, delete: false },
      teachers:             { view: false, create: false, edit: false, delete: false },
      assignments:          { view: false, assign: false, remove: false },
      promotion:            { view: false, promote: false, reverse: false },
      attendance:           { view: false, mark: false, export: false },
      attendance_analytics: { view: false, export: false },
      discipline:           { view: false, create: false, resolve: false },
      calls:                { view: false, make: false },
      communication:        { view: true,  send: false },
      reports:              { view: false, export: false },
      announcements:        { view: true,  create: false },
      settings:             { view: false, edit: false },
      profile:              { view: true,  edit: true },
      users:                { view: false, create_user: false, edit_user: false, delete_user: false, manage_roles: false },
    },
  },
];

/**
 * Idempotent seeder — creates/updates global system default roles if they don't exist.
 */
export const seedDefaultRoles = async (): Promise<void> => {
  for (const role of SYSTEM_DEFAULT_ROLES) {
    const existing = await prisma.systemRole.findFirst({
      where: { key: role.key, schoolId: null, isSystem: true },
    });

    if (existing) {
      await prisma.systemRole.update({
        where: { id: existing.id },
        data: {
          name: role.name,
          description: role.description,
          color: role.color,
          permissions: role.permissions as any,
          sortOrder: role.sortOrder,
        },
      });
    } else {
      await prisma.systemRole.create({
        data: { ...role, schoolId: null },
      });
    }
  }
  console.log('[RolesService] Global system default roles seeded successfully.');
};

/**
 * Get system and custom roles available to a specific school.
 * Returns:
 * 1. Global system default roles (schoolId is null, isSystem is true)
 * 2. Custom roles created exclusively by this school (schoolId matches)
 * Includes real-time userCount for each role.
 */
export const getSystemRoles = async (schoolId?: string, includeInactive = false) => {
  const whereClause: any = {
    OR: [
      { isSystem: true, schoolId: null },
      ...(schoolId ? [{ schoolId: schoolId }] : []),
    ],
  };

  if (!includeInactive) {
    whereClause.isActive = true;
  }

  let roles = await prisma.systemRole.findMany({
    where: whereClause,
    orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });

  // If no system roles exist in DB yet, auto-seed them now
  if (roles.length === 0) {
    await seedDefaultRoles();
    roles = await prisma.systemRole.findMany({
      where: whereClause,
      orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // Calculate user count for each role if schoolId is provided
  if (schoolId) {
    const users = await prisma.user.findMany({
      where: { schoolId, role: { notIn: ['parent', 'student'] } },
      select: { role: true },
    });

    const counts: Record<string, number> = {};
    for (const u of users) {
      if (u.role) {
        counts[u.role] = (counts[u.role] || 0) + 1;
      }
    }

    return roles.map(r => ({
      ...r,
      userCount: counts[r.key] || 0,
    }));
  }

  return roles.map(r => ({
    ...r,
    userCount: 0,
  }));
};

/**
 * Get a single role by key within a school context.
 */
export const getRoleByKey = async (key: string, schoolId?: string) => {
  return await prisma.systemRole.findFirst({
    where: {
      key,
      OR: [
        { isSystem: true, schoolId: null },
        ...(schoolId ? [{ schoolId: schoolId }] : []),
      ],
    },
  });
};

/**
 * Create a new custom role isolated to a specific school.
 */
export const createRole = async (schoolId: string, data: {
  key?: string;
  name: string;
  description?: string;
  color?: string;
  permissions?: Record<string, any>;
}) => {
  if (!schoolId) {
    throw new Error('School ID is required to create a custom role.');
  }

  if (!data.name || !data.name.trim()) {
    throw new Error('Role name is required.');
  }

  // Auto-generate key if not explicitly given
  let roleKey = data.key?.trim();
  if (!roleKey) {
    roleKey = data.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  } else {
    roleKey = roleKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  if (!roleKey || roleKey.length < 2) {
    throw new Error('Invalid role key. Please provide a valid role name or key.');
  }

  // Prevent reserved global system role keys
  const reservedKeys = ['admin', 'school_admin', 'super_admin', 'teacher', 'parent', 'student'];
  if (reservedKeys.includes(roleKey)) {
    throw new Error(`The role key '${roleKey}' is reserved by the system.`);
  }

  // Enforce unique role key per school or global
  const existingInSchool = await prisma.systemRole.findFirst({
    where: {
      key: roleKey,
      OR: [
        { schoolId: null, isSystem: true },
        { schoolId: schoolId },
      ],
    },
  });
  if (existingInSchool) {
    throw new Error(`A role type with key/name '${data.name}' already exists.`);
  }

  // Check unique role name within the school
  const existingName = await prisma.systemRole.findFirst({
    where: {
      name: { equals: data.name.trim(), mode: 'insensitive' },
      OR: [
        { schoolId: null, isSystem: true },
        { schoolId: schoolId },
      ],
    },
  });
  if (existingName) {
    throw new Error(`A role type with name '${data.name}' already exists.`);
  }

  return await prisma.systemRole.create({
    data: {
      schoolId: schoolId,
      key: roleKey,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      color: data.color || '#6366f1',
      isSystem: false,
      isActive: true,
      permissions: (data.permissions || {}) as any,
    },
  });
};

/**
 * Update a role's permissions or metadata.
 * Custom roles can only be updated if they belong to the requesting school.
 */
export const updateRole = async (id: string, schoolId: string, data: {
  name?: string;
  description?: string;
  color?: string;
  permissions?: Record<string, any>;
  isActive?: boolean;
}) => {
  const role = await prisma.systemRole.findUnique({ where: { id } });
  if (!role) throw new Error('Role not found.');

  // If custom role, ensure it belongs to the caller's school
  if (!role.isSystem && role.schoolId !== schoolId) {
    throw new Error('Forbidden: You do not have permission to modify custom roles belonging to another school.');
  }

  const updateData: any = {};
  if (data.name !== undefined) {
    if (!data.name.trim()) throw new Error('Role name cannot be empty.');
    updateData.name = data.name.trim();
  }
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.permissions !== undefined) updateData.permissions = data.permissions;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return await prisma.systemRole.update({ where: { id }, data: updateData });
};

/**
 * Delete a role. Custom roles can only be deleted by their owning school.
 * Protects against deleting roles that are currently assigned to active staff members.
 */
export const deleteRole = async (id: string, schoolId: string) => {
  const role = await prisma.systemRole.findUnique({ where: { id } });
  if (!role) throw new Error('Role not found.');
  if (role.isSystem) {
    throw new Error('System default roles cannot be deleted. You can deactivate them instead.');
  }
  if (role.schoolId !== schoolId) {
    throw new Error('Forbidden: You cannot delete custom roles belonging to another school.');
  }

  // Check if any staff member in this school is currently assigned to this role
  const userCount = await prisma.user.count({
    where: { schoolId, role: role.key },
  });
  if (userCount > 0) {
    throw new Error(
      `Cannot delete role '${role.name}' because ${userCount} staff member(s) are currently assigned to it. Please deactivate the role instead, or reassign the staff members first.`
    );
  }

  return await prisma.systemRole.delete({ where: { id } });
};

/**
 * Returns the list of all valid staff role keys for a school.
 */
export const getAllValidStaffRoles = async (schoolId?: string): Promise<string[]> => {
  const roles = await getSystemRoles(schoolId, false);
  const baseRoles = ['admin', 'school_admin', 'teacher', 'staff'];
  return [...new Set([...baseRoles, ...roles.map(r => r.key)])];
};
