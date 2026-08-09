import prisma from '../config/db';

export interface Membership {
  id: string; // matches schoolId
  name: string; // matches schoolName
  role: string;
  customSchoolId?: string;
  logo?: string;
}

/**
 * Resolves all schools and roles associated with a user.
 * Checks User (staff), Teacher, and ParentStudentLink models.
 */
export const getMemberships = async (userId: string): Promise<Membership[]> => {
  const memberships: Membership[] = [];

  // 1. Staff/Admin Memberships (via User table)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { school: { include: { settings: true } } }
  });

  if (user && user.schoolId && user.role && user.role !== 'parent') {
    memberships.push({
      id: user.schoolId,
      name: user.school?.name || 'My School',
      role: user.role,
      customSchoolId: user.school?.schoolId || '',
      logo: (user.school?.settings as any | null)?.school_logo || ''
    });
  }

  // 2. Teacher Memberships (via Teacher table)
  // Note: currently Teacher table has @unique on user_id, but we handle as potentially multiple for future-proofing
  const teacherRecords = await prisma.teacher.findMany({
    where: { user_id: userId },
    include: { school: { include: { settings: true } } }
  });

  for (const t of teacherRecords) {
    if (t.schoolId && !memberships.some(m => m.id === t.schoolId && m.role === 'teacher')) {
      memberships.push({
        id: t.schoolId,
        name: t.school?.name || 'My School',
        role: 'teacher',
        customSchoolId: t.school?.schoolId || '',
        logo: (t.school?.settings as any | null)?.school_logo || ''
      });
    }
  }

  // 3. Parent Memberships (via ParentStudentLink)
  const parentLinks = await prisma.parentStudentLink.findMany({
    where: { parentId: userId },
    include: { school: { include: { settings: true } } }
  });

  for (const l of parentLinks) {
    if (l.schoolId && !memberships.some(m => m.id === l.schoolId && m.role === 'parent')) {
      memberships.push({
        id: l.schoolId,
        name: l.school?.name || 'My School',
        role: 'parent',
        customSchoolId: l.school?.schoolId || '',
        logo: (l.school?.settings as any | null)?.school_logo || ''
      });
    }
  }
  
  return memberships;
};

/**
 * Determines the specific role a user has within a specific school.
 * If requestedRole is provided, it validates if the user actually has that role.
 * If not provided, it falls back to the highest available role in priority order (Staff > Teacher > Parent).
 */
export const resolveRoleInSchool = async (userId: string, schoolId: string, requestedRole?: string): Promise<string | null> => {
  if (!userId) return null;

  // 1. If a specific role is requested, validate it specifically
  if (requestedRole) {
    if (requestedRole === 'parent') {
      const parent = await prisma.parentStudentLink.findFirst({
        where: { parentId: userId }
      });
      if (parent) return 'parent';
    }

    if (requestedRole === 'teacher') {
      const teacher = await prisma.teacher.findFirst({
        where: { user_id: userId }
      });
      if (teacher) return 'teacher';
      
      // Also check if they are in the User table with teacher role
      const user = await prisma.user.findFirst({
        where: { id: userId, role: 'teacher' }
      });
      if (user) return 'teacher';
    }

    if (requestedRole === 'admin' || requestedRole === 'school_admin' || requestedRole === 'school-admin') {
      const user = await prisma.user.findFirst({
        where: { id: userId, role: { in: ['admin', 'school_admin', 'super_admin'] } }
      });
      if (user) return user.role;
    }

    // Staff / generic non-teacher school roles
    const staffRoles = ['staff', 'registrar', 'discipline_officer', 'call_center'];
    if (staffRoles.includes(requestedRole)) {
      const user = await prisma.user.findFirst({
        where: { id: userId, role: requestedRole }
      });
      if (user) return requestedRole;
    }
  }

  // 2. Fallback: Determine highest available role in priority order
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  if (user && user.role && !['parent', 'student'].includes(user.role)) return user.role;

  // Check Teacher table
  const teacher = await prisma.teacher.findFirst({
    where: { user_id: userId }
  });
  if (teacher) return 'teacher';

  // Check ParentStudentLink
  const parent = await prisma.parentStudentLink.findFirst({
    where: { parentId: userId }
  });
  if (parent) return 'parent';

  return user?.role || null;
};
