import prisma from '../config/db';

// ─── System Default Roles (Global across all schools) ──────────────────────
const SYSTEM_DEFAULT_ROLES = [
  {
    key: 'registrar',
    name: 'Student Registration Officer (Registrar)',
    description: 'Responsible for student intake, enrollment processing, and maintaining official student records.',
    color: '#6366f1',
    isSystem: true,
    sortOrder: 1,
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
      subscription:         { view: false, manage: false },
      support:              { view: true,  create_ticket: true },
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
    sortOrder: 2,
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
      subscription:         { view: false, manage: false },
      support:              { view: true,  create_ticket: true },
      profile:              { view: true,  edit: true },
      users:                { view: false, create_user: false, edit_user: false, delete_user: false, manage_roles: false },
    },
  },
];

/**
 * Idempotent seeder — creates global system default roles if they don't exist.
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
 * Get active system roles available to a specific school.
 * Returns:
 * 1. Global system default roles (schoolId is null, isSystem is true)
 * 2. Custom roles created exclusively by this school (schoolId matches)
 */
export const getSystemRoles = async (schoolId?: string) => {
  let roles = await prisma.systemRole.findMany({
    where: {
      isActive: true,
      OR: [
        { isSystem: true, schoolId: null },
        ...(schoolId ? [{ schoolId: schoolId }] : []),
      ],
    },
    orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });

  // If no system roles exist in DB yet, auto-seed them now
  if (roles.length === 0) {
    await seedDefaultRoles();
    roles = await prisma.systemRole.findMany({
      where: {
        isActive: true,
        OR: [
          { isSystem: true, schoolId: null },
          ...(schoolId ? [{ schoolId: schoolId }] : []),
        ],
      },
      orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  return roles;
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
  key: string;
  name: string;
  description?: string;
  color?: string;
  permissions?: Record<string, any>;
}) => {
  if (!schoolId) {
    throw new Error('School ID is required to create a custom role.');
  }

  // Validate key format
  const keyRegex = /^[a-z0-9_]+$/;
  if (!keyRegex.test(data.key)) {
    throw new Error('Role key must be lowercase alphanumeric with underscores only.');
  }

  // Prevent reserved global system role keys
  const reservedKeys = SYSTEM_DEFAULT_ROLES.map(r => r.key);
  if (reservedKeys.includes(data.key)) {
    throw new Error(`The role key '${data.key}' is reserved for a system default role.`);
  }

  // Enforce unique role key per school
  const existingInSchool = await prisma.systemRole.findFirst({
    where: { key: data.key, schoolId: schoolId },
  });
  if (existingInSchool) {
    throw new Error(`A custom role with key '${data.key}' already exists in your school.`);
  }

  return await prisma.systemRole.create({
    data: {
      schoolId: schoolId,
      key: data.key,
      name: data.name,
      description: data.description,
      color: data.color || '#6366f1',
      isSystem: false,
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
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.permissions !== undefined) updateData.permissions = data.permissions;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return await prisma.systemRole.update({ where: { id }, data: updateData });
};

/**
 * Delete a role. Custom roles can only be deleted by their owning school.
 */
export const deleteRole = async (id: string, schoolId: string) => {
  const role = await prisma.systemRole.findUnique({ where: { id } });
  if (!role) throw new Error('Role not found.');
  if (role.isSystem) {
    throw new Error('System default roles cannot be deleted.');
  }
  if (role.schoolId !== schoolId) {
    throw new Error('Forbidden: You cannot delete custom roles belonging to another school.');
  }

  return await prisma.systemRole.delete({ where: { id } });
};

/**
 * Returns the list of all valid staff role keys for a school.
 */
export const getAllValidStaffRoles = async (schoolId?: string): Promise<string[]> => {
  const roles = await getSystemRoles(schoolId);
  const baseRoles = ['admin', 'school_admin', 'teacher', 'staff'];
  return [...new Set([...baseRoles, ...roles.map(r => r.key)])];
};
