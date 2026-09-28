import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/db';

export const getUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({ 
    where: { email }
  });
};

export const getUserById = async (id: string, _schoolId?: string) => {
  return await prisma.user.findUnique({ 
    where: { id },
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      phone: true,
      is_active: true,
      teacher_id: true,
      createdAt: true,
      updatedAt: true,
      experience_years: true,
      qualification: true,
      subject: true,
      profile_photo: true,
      address: true,
      lastActive: true,
      pushToken: true,
    }
  });
};

export const getUsers = async (_schoolId?: string) => {
  return await prisma.user.findMany({ 
    where: { 
      role: { notIn: ['parent', 'student', 'admin', 'school_admin'] }
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      phone: true,
      is_active: true,
      teacher_id: true,
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

export const getContacts = async (_schoolId?: string, currentUser?: any) => {
  const baseRoles = ['admin', 'school_admin', 'teacher', 'staff'];
  
  const staffAndAdmins = await prisma.user.findMany({
    where: {
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

  const linkedParents = await prisma.user.findMany({
    where: {
      role: 'parent',
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

  let allContacts = [...staffAndAdmins, ...linkedParents];
  const uniqueContacts = Array.from(new Map(allContacts.map(item => [item.id, item])).values());
  const finalContacts = uniqueContacts.filter(u => u.id !== currentUser?.id);

  if (currentUser?.role === 'parent') {
    return finalContacts.filter(u => ['admin', 'school_admin', 'teacher', 'staff'].includes(u.role));
  }

  return finalContacts.sort((a, b) => a.full_name.localeCompare(b.full_name));
};

export const createUser = async (data: any) => {
  let teacherId = data.teacher_id || null;

  if (data.role === 'teacher' && data.phone) {
    const cleanPhone = data.phone.trim();
    const existing = await prisma.user.findFirst({
      where: { phone: cleanPhone, role: 'teacher' }
    });
    if (existing) {
      throw new Error('Phone already registered for another teacher.');
    }
    data.phone = cleanPhone;
  }

  if (data.role === 'teacher' && !teacherId) {
    const teacher = await prisma.teacher.create({
      data: {
        name: data.full_name,
        email: data.email,
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

export const updateUser = async (id: string, data: any, _schoolId?: string) => {
  const currentUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id },
        { teacher_id: id },
      ],
    },
  });

  if (!currentUser) {
    throw new Error('User not found');
  }

  const targetUserId = currentUser.id;
  const updateData: any = {};
  if (data.full_name !== undefined) updateData.full_name = data.full_name;
  if (data.email !== undefined) updateData.email = data.email;
  
  if (data.phone !== undefined) {
    const cleanPhone = data.phone.trim();
    if (currentUser.role === 'teacher' && cleanPhone) {
      const existing = await prisma.user.findFirst({
        where: { phone: cleanPhone, role: 'teacher', id: { not: targetUserId } }
      });
      if (existing) {
        throw new Error('Phone already registered for another teacher.');
      }
    }
    updateData.phone = cleanPhone;
  }
  
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

  const user = await prisma.user.update({ 
    where: { id: targetUserId }, 
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

export const deleteUser = async (id: string, _schoolId?: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('User not found');

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

export const changePassword = async (userId: string, currentPassword?: string, newPassword?: string) => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: userId },
        { teacher_id: userId },
      ],
    },
  });
  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password against stored hash if provided
  if (currentPassword) {
    const isMatch = verifyPassword(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new Error('Current password is incorrect.');
    }
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }

  const hashedPassword = !newPassword.startsWith('$2')
    ? bcrypt.hashSync(newPassword, 10)
    : newPassword;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: hashedPassword,
    },
  });

  return { success: true };
};

