import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/db';

export const getUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({ 
    where: { email },
    include: { school: true }
  });
};

export const getUserById = async (id: string, schoolId?: string) => {
  const where: any = { id };
  if (schoolId) where.schoolId = schoolId;
  return await prisma.user.findFirst({ 
    where,
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      phone: true,
      is_active: true,
      teacher_id: true,
      schoolId: true,
      createdAt: true,
      updatedAt: true,
      experience_years: true,
      qualification: true,
      subject: true,
      profile_photo: true,
      address: true,
      lastActive: true,
      pushToken: true,
      school: { include: { settings: true } }
    }
  });
};

export const getUsers = async (schoolId: string) => {
  if (!schoolId) throw new Error('School ID is required');
  return await prisma.user.findMany({ 
    where: { 
      schoolId,
      role: { notIn: ['parent', 'student'] }
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      phone: true,
      is_active: true,
      teacher_id: true,
      schoolId: true,
      createdAt: true,
      updatedAt: true,
      experience_years: true,
      qualification: true,
      subject: true,
      profile_photo: true,
      address: true,
      lastActive: true,
      faceEnrollment: {
        select: {
          id: true,
          enrolledAt: true,
        }
      }
    },
    orderBy: { full_name: 'asc' }
  });
};

export const getContacts = async (schoolId: string, currentUser?: any) => {
  if (!schoolId) throw new Error('School ID is required');

  const allowedRoles = ['admin', 'school_admin', 'teacher', 'parent', 'staff'];
  const baseRoles = ['admin', 'school_admin', 'teacher', 'staff'];
  
  // 1. Fetch Users directly belonging to this school (Admins/Teachers)
  const staffAndAdmins = await prisma.user.findMany({
    where: {
      schoolId: schoolId,
      role: { in: baseRoles }
    },
    select: {
      id: true,
      full_name: true,
      profile_photo: true,
      role: true,
      phone: true,
      email: true,
      is_active: true
    }
  });

  // 2. Fetch Parents linked to this school via ParentStudentLink
  // This ensures a parent is found in every school where they have children
  const linkedParents = await prisma.user.findMany({
    where: {
      role: 'parent',
      parentStudents: {
        some: {
          schoolId: schoolId
        }
      }
    },
    select: {
      id: true,
      full_name: true,
      profile_photo: true,
      role: true,
      phone: true,
      email: true,
      is_active: true
    }
  });

  // 3. Combine and Filter (Remove self)
  let allContacts = [...staffAndAdmins, ...linkedParents];
  
  // Remove duplicates (in case a parent also has a schoolId set)
  const uniqueContacts = Array.from(new Map(allContacts.map(item => [item.id, item])).values());
  
  // Filter out the current user
  const finalContacts = uniqueContacts.filter(u => u.id !== currentUser?.id);

  // If the requesting user is a parent, they should only see staff/admins
  if (currentUser?.role === 'parent') {
    return finalContacts.filter(u => ['admin', 'school_admin', 'teacher', 'staff'].includes(u.role));
  }

  return finalContacts.sort((a, b) => a.full_name.localeCompare(b.full_name));
};

export const createUser = async (data: any) => {
  let teacherId = data.teacher_id || null;
  const schoolId = data.schoolId || null;


  // Prevent duplicate phone for teachers within the same school (or globally if required)
  if (data.role === 'teacher' && data.phone) {
    const cleanPhone = data.phone.trim();
    const existing = await prisma.user.findFirst({
      where: { phone: cleanPhone, role: 'teacher', schoolId }
    });
    if (existing) {
      throw new Error('Phone already registered for another teacher in this school.');
    }
    data.phone = cleanPhone;
  }

  // Automatically create a corresponding Teacher record if role is 'teacher'
  if (data.role === 'teacher' && !teacherId && schoolId) {
    const teacher = await prisma.teacher.create({
      data: {
        name: data.full_name,
        email: data.email,
        schoolId: schoolId,
        phone: data.phone || null,
        subject: data.subject || null,
        qualification: data.qualification || null,
        experience_years: data.experience_years !== undefined && data.experience_years !== null ? Number(data.experience_years) : null,
        is_active: data.is_active !== false,
        profile_photo: data.profile_photo || null,
      }
    });
    teacherId = teacher.id;
  }

  const rawPassword = data.password_hash || data.password || "12345678";
  const hashedPassword = rawPassword.startsWith('$2')
    ? rawPassword
    : bcrypt.hashSync(rawPassword, 10);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password_hash: hashedPassword,
      full_name: data.full_name,
      role: data.role || 'teacher',
      phone: data.phone || null,
      is_active: data.is_active !== false,
      teacher_id: teacherId,
      schoolId: schoolId,
      subject: data.subject || null,
      qualification: data.qualification || null,
      experience_years: data.experience_years !== undefined && data.experience_years !== null ? Number(data.experience_years) : null,
      profile_photo: data.profile_photo || null,
    },
  });

  if (data.role === 'teacher' && teacherId) {
    try {
      await prisma.teacher.update({
        where: { id: teacherId },
        data: { user_id: user.id }
      });
    } catch (e) {
      console.error("Failed to link user_id on teacher record:", e);
    }
  }

  return user;
};

export const updateUser = async (id: string, data: any, schoolId?: string) => {
  const updateData: any = {};
  if (data.full_name !== undefined) updateData.full_name = data.full_name;
  if (data.email !== undefined) updateData.email = data.email;
  // ... (rest of update logic)
  
  if (data.phone !== undefined) {
    const cleanPhone = data.phone.trim();
    const currentUser = await prisma.user.findUnique({ where: { id } });
    if (currentUser?.role === 'teacher' && cleanPhone) {
      const existing = await prisma.user.findFirst({
        where: { phone: cleanPhone, role: 'teacher', id: { not: id }, schoolId: currentUser.schoolId }
      });
      if (existing) {
        throw new Error('Phone already registered for another teacher.');
      }
    }
    updateData.phone = cleanPhone;
  }
  
  // (Adding necessary fields for update)
  const passToUpdate = data.password_hash !== undefined ? data.password_hash : data.password;
  if (passToUpdate !== undefined && passToUpdate !== null && passToUpdate !== "") {
    updateData.password_hash = passToUpdate.startsWith('$2')
      ? passToUpdate
      : bcrypt.hashSync(passToUpdate, 10);
  }
  if (data.is_active !== undefined) updateData.is_active = data.is_active;
  if (data.subject !== undefined) updateData.subject = data.subject;
  if (data.qualification !== undefined) updateData.qualification = data.qualification;
  if (data.experience_years !== undefined) updateData.experience_years = data.experience_years !== null ? Number(data.experience_years) : null;
  if (data.profile_photo !== undefined) updateData.profile_photo = data.profile_photo;

  // Enforce schoolId if provided
  const user = await prisma.user.update({ 
    where: { id, ...(schoolId && { schoolId }) }, 
    data: updateData 
  });

  if (user.teacher_id && (data.full_name !== undefined || data.email !== undefined || data.phone !== undefined || data.subject !== undefined || data.qualification !== undefined || data.experience_years !== undefined || data.is_active !== undefined || data.profile_photo !== undefined)) {
    try {
      await prisma.teacher.update({
        where: { id: user.teacher_id },
        data: {
          ...(data.full_name !== undefined && { name: data.full_name }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.subject !== undefined && { subject: data.subject }),
          ...(data.qualification !== undefined && { qualification: data.qualification }),
          ...(data.experience_years !== undefined && { experience_years: data.experience_years !== null ? Number(data.experience_years) : null }),
          ...(data.is_active !== undefined && { is_active: data.is_active }),
          ...(data.profile_photo !== undefined && { profile_photo: data.profile_photo }),
        }
      });
    } catch (e) {
      console.error("Failed to update linked teacher record:", e);
    }
  }

  return user;
};

export const deleteUser = async (id: string, schoolId: string) => {
  const user = await prisma.user.findFirst({ where: { id, schoolId } });
  if (!user) throw new Error('User not found in this school');

  if (user.teacher_id) {
    try {
      await prisma.teacherAssignment.deleteMany({ where: { teacher_id: user.teacher_id } });
      await prisma.teacher.delete({ where: { id: user.teacher_id } });
    } catch (e) {
      console.error("Failed to delete linked teacher:", e);
    }
  }
  return await prisma.user.delete({ where: { id } });
};

export const verifyPassword = (plain: string, hash: string): boolean => {
  if (!hash || !hash.startsWith('$2')) {
    // Reject non-hashed passwords — all passwords must be bcrypt hashed
    return false;
  }
  try { return bcrypt.compareSync(plain, hash); } catch { return false; }
};

export const createPasswordResetToken = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.user.update({
    where: { id: user.id },
    data: {
      reset_password_token: token,
      reset_password_expires: expires,
    },
  });

  return token;
};

export const resetPasswordByToken = async (token: string, newPassword: any) => {
  const user = await prisma.user.findFirst({
    where: {
      reset_password_token: token,
      reset_password_expires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  const hashedPassword = !newPassword.startsWith('$2')
    ? bcrypt.hashSync(newPassword, 10)
    : newPassword;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: hashedPassword,
      reset_password_token: null,
      reset_password_expires: null,
    },
  });

  return user;
};

export const getUserByResetToken = async (token: string) => {
  return await prisma.user.findFirst({
    where: {
      reset_password_token: token,
      reset_password_expires: { gt: new Date() },
    },
  });
};
