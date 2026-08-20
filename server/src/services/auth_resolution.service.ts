import prisma from '../config/db';

export interface Membership {
  id: string;
  name: string;
  role: string;
  customSchoolId?: string;
  logo?: string;
}

export const getMemberships = async (userId: string): Promise<Membership[]> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  const settings = await prisma.schoolSettings.findFirst();
  const schoolName = settings?.school_name || 'Addis Hiwot School';
  const logo = settings?.school_logo || '';

  if (!user) return [];

  return [{
    id: 'single-school',
    name: schoolName,
    role: user.role,
    customSchoolId: 'SCH-0001',
    logo,
  }];
};

export const resolveRoleInSchool = async (userId: string, _schoolId?: string, requestedRole?: string): Promise<string | null> => {
  if (!userId) return null;

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

    const staffRoles = ['staff', 'staff_member', 'registrar', 'discipline_officer'];
    if (staffRoles.includes(requestedRole)) {
      const user = await prisma.user.findFirst({
        where: { id: userId, role: { in: requestedRole === 'staff' ? ['staff', 'staff_member'] : [requestedRole] } }
      });
      if (user) return user.role;
    }

    const customUser = await prisma.user.findFirst({
      where: { id: userId, role: requestedRole, is_active: true }
    });
    if (customUser) return customUser.role;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  if (user && user.role && !['parent', 'student'].includes(user.role)) return user.role;

  const teacher = await prisma.teacher.findFirst({
    where: { user_id: userId }
  });
  if (teacher) return 'teacher';

  const parent = await prisma.parentStudentLink.findFirst({
    where: { parentId: userId }
  });
  if (parent) return 'parent';

  return user?.role || null;
};

