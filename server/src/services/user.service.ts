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

// ─── Secure Password Reset (PasswordResetToken model) ─────────────────────────

/**
 * Request a password reset. Accepts a normalized email OR phone number.
 * - Email → generates a 64-char secure hex token, sends a reset link via email.
 * - Phone → generates a 6-digit cryptographic OTP, sends via SMS.
 * Always returns void (anti-enumeration: caller always sends generic success).
 */
export const requestPasswordReset = async (
  identifier: string,
  method?: 'email' | 'phone'
): Promise<void> => {
  const { sendResetPasswordEmail } = await import('../utils/email');
  const { sendPasswordResetOTP } = await import('../utils/sms');
  const { normalizePhoneNumber } = await import('./parent.service');

  // Determine method from identifier if not specified
  const isPhone = method === 'phone' || (method !== 'email' && /^\+?[\d\s\-()]{7,15}$/.test(identifier));

  let normalizedIdentifier: string;
  let user: any;

  if (isPhone) {
    normalizedIdentifier = normalizePhoneNumber(identifier);
    user = await prisma.user.findUnique({ where: { phone: normalizedIdentifier } });
  } else {
    normalizedIdentifier = identifier.trim().toLowerCase();
    user = await prisma.user.findUnique({ where: { email: normalizedIdentifier } });
  }

  if (!user) {
    // Anti-enumeration: silently return — do not reveal whether account exists
    return;
  }

  // Invalidate all prior active (unused, unexpired) tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() }, // mark as "used" to invalidate without deleting audit trail
  });

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  if (isPhone) {
    // Cryptographically random 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        identifier: normalizedIdentifier,
        tokenHash,
        type: 'PHONE_OTP',
        expiresAt,
        maxAttempts: 5,
      },
    });

    await sendPasswordResetOTP(normalizedIdentifier, otp);
  } else {
    // Cryptographically strong 64-char hex token for email link
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        identifier: normalizedIdentifier,
        tokenHash,
        type: 'EMAIL_LINK',
        expiresAt,
        maxAttempts: 3,
      },
    });

    await sendResetPasswordEmail(normalizedIdentifier, rawToken);
  }
};

/**
 * Verify an email reset token (from URL) or phone OTP.
 * Returns { valid, userId, tokenId } on success, throws on failure.
 */
export const verifyResetTokenOrCode = async (params: {
  token?: string;
  phone?: string;
  otp?: string;
}): Promise<{ valid: boolean; userId: string; tokenId: string; email: string }> => {
  const { normalizePhoneNumber } = await import('./parent.service');
  const { token, phone, otp } = params;

  let tokenHash: string;
  let tokenRecord: any;

  if (token) {
    // Email link flow
    tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, type: 'EMAIL_LINK' },
      include: { user: { select: { id: true, email: true } } },
    });
  } else if (phone && otp) {
    // Phone OTP flow
    const normalizedPhone = normalizePhoneNumber(phone);
    tokenHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { identifier: normalizedPhone, type: 'PHONE_OTP', usedAt: null },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  } else {
    throw new Error('Provide either a reset token or phone + OTP.');
  }

  if (!tokenRecord) {
    throw new Error('Invalid or expired reset token.');
  }

  // Check already used
  if (tokenRecord.usedAt) {
    throw new Error('This reset token has already been used. Please request a new one.');
  }

  // Check expiry
  if (new Date() > tokenRecord.expiresAt) {
    throw new Error('This reset token has expired. Please request a new one.');
  }

  // For OTP: verify hash (for email, hash already matched via DB query)
  if (otp) {
    const otpHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (otpHash !== tokenRecord.tokenHash) {
      // Increment attempt counter
      await prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = tokenRecord.maxAttempts - tokenRecord.attempts - 1;
      if (remaining <= 0) {
        await prisma.passwordResetToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: new Date() }, // Invalidate after max attempts
        });
        throw new Error('Too many incorrect attempts. Please request a new OTP.');
      }
      throw new Error(`Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    }
  }

  // Check max attempts
  if (tokenRecord.attempts >= tokenRecord.maxAttempts) {
    throw new Error('Too many incorrect attempts. Please request a new reset token.');
  }

  return {
    valid: true,
    userId: tokenRecord.userId,
    tokenId: tokenRecord.id,
    email: tokenRecord.user.email,
  };
};

/**
 * Reset a user's password using a verified email token or phone OTP.
 * Atomically updates the password hash and marks the token as used.
 */
export const resetPasswordWithTokenOrCode = async (params: {
  token?: string;
  phone?: string;
  otp?: string;
  password: string;
}): Promise<void> => {
  const { password } = params;

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  // Verify token / OTP first
  const { userId, tokenId } = await verifyResetTokenOrCode(params);

  const newHash = bcrypt.hashSync(password, 12);

  await prisma.$transaction(async (tx) => {
    // Update the user's password
    await tx.user.update({
      where: { id: userId },
      data: { password_hash: newHash },
    });

    // Mark this specific token as used
    await tx.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });

    // Invalidate all other active tokens for this user (clean up)
    await tx.passwordResetToken.updateMany({
      where: {
        userId,
        id: { not: tokenId },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
  });
};

/**
 * @deprecated Use requestPasswordReset / resetPasswordWithTokenOrCode instead.
 * Retained for backward compatibility with existing auth.routes.ts calls.
 */
export const createPasswordResetToken = async (email: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Invalidate prior tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      identifier: email.toLowerCase(),
      tokenHash,
      type: 'EMAIL_LINK',
      expiresAt,
      maxAttempts: 3,
    },
  });

  return rawToken;
};

/**
 * @deprecated Use verifyResetTokenOrCode instead.
 */
export const getUserByResetToken = async (token: string) => {
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      type: 'EMAIL_LINK',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
  return record?.user ?? null;
};

/**
 * @deprecated Use resetPasswordWithTokenOrCode instead.
 */
export const resetPasswordByToken = async (token: string, newPassword: string): Promise<any> => {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      type: 'EMAIL_LINK',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!record) {
    throw new Error('Invalid or expired reset token');
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { password_hash: hashedPassword },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, id: { not: record.id }, usedAt: null },
      data: { usedAt: new Date() },
    });
  });

  return record.user;
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

