import prisma from '../config/db';

// ─── System Default Roles ──────────────────────────────────────────────────
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
 * Idempotent seeder — creates/updates system default roles if they don't exist.
 */
export const seedDefaultRoles = async (): Promise<void> => {
  for (const role of SYSTEM_DEFAULT_ROLES) {
    const existing = await prisma.systemRole.findFirst({
      where: { key: role.key, isSystem: true },
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
        data: { ...role },
      });
    }
  }
  console.log('[RolesService] System default roles seeded successfully.');
};

/**
 * Get system and custom roles.
 */
export const getSystemRoles = async (_schoolId?: string, includeInactive = false) => {
  const whereClause: any = {};

  if (!includeInactive) {
    whereClause.isActive = true;
  }

  let roles = await prisma.systemRole.findMany({
    where: whereClause,
    orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });

  if (roles.length === 0) {
    await seedDefaultRoles();
    roles = await prisma.systemRole.findMany({
      where: whereClause,
      orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  const users = await prisma.user.findMany({
    where: { role: { notIn: ['parent', 'student'] } },
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
};

/**
 * Get a single role by key.
 */
export const getRoleByKey = async (key: string, _schoolId?: string) => {
  return await prisma.systemRole.findFirst({
    where: { key },
  });
};

/**
 * Create a new custom role.
 */
export const createRole = async (_schoolId: string | undefined, data: {
  key?: string;
  name: string;
  description?: string;
  color?: string;
  permissions?: Record<string, any>;
}) => {
  if (!data.name || !data.name.trim()) {
    throw new Error('Role name is required.');
  }

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

  const reservedKeys = ['admin', 'school_admin', 'super_admin', 'teacher', 'parent', 'student'];
  if (reservedKeys.includes(roleKey)) {
    throw new Error(`The role key '${roleKey}' is reserved by the system.`);
  }

  const existingKey = await prisma.systemRole.findFirst({
    where: { key: roleKey },
  });
  if (existingKey) {
    throw new Error(`A role type with key/name '${data.name}' already exists.`);
  }

  const existingName = await prisma.systemRole.findFirst({
    where: {
      name: { equals: data.name.trim(), mode: 'insensitive' },
    },
  });
  if (existingName) {
    throw new Error(`A role type with name '${data.name}' already exists.`);
  }

  return await prisma.systemRole.create({
    data: {
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
 */
export const updateRole = async (id: string, _schoolId: string | undefined, data: {
  name?: string;
  description?: string;
  color?: string;
  permissions?: Record<string, any>;
  isActive?: boolean;
}) => {
  const role = await prisma.systemRole.findUnique({ where: { id } });
  if (!role) throw new Error('Role not found.');

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
 * Delete a role. System roles cannot be deleted.
 */
export const deleteRole = async (id: string, _schoolId?: string) => {
  const role = await prisma.systemRole.findUnique({ where: { id } });
  if (!role) throw new Error('Role not found.');
  if (role.isSystem) {
    throw new Error('System default roles cannot be deleted. You can deactivate them instead.');
  }

  const userCount = await prisma.user.count({
    where: { role: role.key },
  });
  if (userCount > 0) {
    throw new Error(
      `Cannot delete role '${role.name}' because ${userCount} staff member(s) are currently assigned to it. Please deactivate the role instead, or reassign the staff members first.`
    );
  }

  return await prisma.systemRole.delete({ where: { id } });
};

/**
 * Returns the list of all valid staff role keys.
 */
export const getAllValidStaffRoles = async (_schoolId?: string): Promise<string[]> => {
  const roles = await getSystemRoles(undefined, false);
  const baseRoles = ['admin', 'school_admin', 'teacher', 'staff'];
  return [...new Set([...baseRoles, ...roles.map(r => r.key)])];
};
