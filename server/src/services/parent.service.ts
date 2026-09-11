import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt';
import * as schoolService from './school.service';

/**
 * List all schools associated with a parent's phone number.
 */
export const listParentSchools = async (phone: string) => {
  const cleanPhone = normalizePhoneNumber(phone);
  
  const user = await prisma.user.findUnique({
    where: { phone: cleanPhone }
  });

  if (!user) {
    return { success: false, message: "No account found with this phone number." };
  }

  await syncLegacyStudents(user.id, cleanPhone);

  const schools = await getParentSchools(user.id);
  return { success: true, data: schools };
};

/**
 * Get all schools a parent is linked to via their children.
 */
export const getParentSchools = async (_userId?: string) => {
  const singleSchool = await schoolService.getSingleSchool();
  return [{
    id: singleSchool.id,
    name: singleSchool.name || 'Addis Hiwot School',
    logo: (singleSchool as any).settings?.school_logo || '',
    customSchoolId: singleSchool.schoolId || 'SCH-0001',
    role: 'parent'
  }];
};

/**
 * Validate that a parent has access.
 */
export const validateSchoolAccess = async (_userId?: string, _schoolId?: string): Promise<boolean> => {
  return true;
};

/**
 * Get all students a parent has.
 */
export const getParentStudentsForSchool = async (parentId: string, _schoolId?: string) => {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId },
    include: {
      student: {
        include: { grade: true, section: true, stream: true }
      }
    }
  });

  return links
    .filter((l: any) => Boolean(l.student))
    .map((l: any) => ({
      ...l.student,
      name: l.student.fullName,
      grade: l.student.grade?.name || '',
      section: l.student.section?.name || '',
      stream: l.student.stream?.name || null,
      relationshipType: l.relationshipType || 'Guardian',
    }));
};

/**
 * Login Parent and establish session.
 */
export const loginParent = async (phone: string, password: string, _schoolId?: string) => {
  const cleanPhone = normalizePhoneNumber(phone);

  const user = await prisma.user.findUnique({
    where: { phone: cleanPhone }
  });

  if (!user) {
    throw new Error("Invalid phone number or password.");
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error("Invalid phone number or password.");
  }

  await syncLegacyStudents(user.id, cleanPhone);

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: user.id },
    include: {
      student: {
        include: { grade: true, section: true, stream: true }
      }
    }
  });

  const students: any[] = links.map(l => l.student).filter(Boolean);

  if (students.length === 0) {
    throw new Error("No children profiles found associated with this account.");
  }

  const mappedStudents = links
    .filter((l: any) => Boolean(l.student))
    .map((l: any) => ({
      ...l.student,
      name: l.student.fullName,
      grade: l.student.grade?.name || '',
      section: l.student.section?.name || '',
      stream: l.student.stream?.name || null,
      relationshipType: l.relationshipType || 'Guardian',
    }));

  const singleSchool = await schoolService.getSingleSchool();
  const schoolName = singleSchool.name || 'Addis Hiwot School';
  const schoolLogo = (singleSchool as any).settings?.school_logo || '';
  const customSchoolId = singleSchool.schoolId || 'SCH-0001';

  const token = generateToken({
    id: user.id,
    email: user.email || `parent-${cleanPhone}@addishiwot.edu.et`,
    role: 'parent',
    schoolId: singleSchool.id,
    customSchoolId,
  });

  const singleSchoolObj = {
    id: singleSchool.id,
    name: schoolName,
    logo: schoolLogo,
    customSchoolId,
    role: 'parent'
  };

  return {
    success: true,
    id: user.id,
    token,
    parentName: user.full_name || students[0]?.parent_name || "Parent",
    phone: cleanPhone,
    schoolId: singleSchool.id,
    schoolName,
    schoolLogo,
    students: mappedStudents,
    availableSchools: [singleSchoolObj],
  };
};

/**
 * Get Parent Portal notifications.
 */
export const getNotifications = async (phone: string, _schoolId?: string) => {
  const cleanPhone = normalizePhoneNumber(phone);

  const user = await prisma.user.findUnique({ 
    where: { phone: cleanPhone } 
  });
  
  if (!user) return [];

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: user.id },
    select: { studentId: true }
  });
  const studentIds = links.map(l => l.studentId);

  const notifications = await prisma.parentNotification.findMany({
    where: {
      OR: [
        { studentId: { in: studentIds } },
        {
          studentId: null,
          OR: [
            { targetAudience: { in: ["GENERAL", "PARENTS", "general", "parents"] } },
            { targetAudience: null }
          ]
        }
      ]
    },
    orderBy: { createdAt: 'desc' },
    include: {
      student: {
        select: { id: true, fullName: true, gender: true }
      }
    }
  });

  return notifications;
};

export const markNotificationAsRead = async (id: string, _schoolId?: string) => {
  return await prisma.parentNotification.update({
    where: { id },
    data: { isRead: true }
  });
};

export const deleteNotification = async (id: string, _schoolId?: string) => {
  return await prisma.parentNotification.deleteMany({
    where: { id }
  });
};

export const markAllNotificationsAsRead = async (phone: string, _schoolId?: string) => {
  const cleanPhone = normalizePhoneNumber(phone);
  const user = await prisma.user.findUnique({ 
    where: { phone: cleanPhone } 
  });
  if (!user) return;

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: user.id },
    select: { studentId: true }
  });
  const studentIds = links.map(l => l.studentId);

  return await prisma.parentNotification.updateMany({
    where: {
      OR: [
        { studentId: { in: studentIds } },
        {
          studentId: null,
          OR: [
            { targetAudience: { in: ["GENERAL", "PARENTS", "general", "parents"] } },
            { targetAudience: null }
          ]
        }
      ],
      isRead: false
    },
    data: { isRead: true }
  });
};

export const getPreferences = async (phone: string, _schoolId?: string) => {
  const cleanPhone = phone.replace(/\s+/g, '');
  return await prisma.parentPreferences.upsert({
    where: { parentPhone: cleanPhone },
    update: {},
    create: {
      parentPhone: cleanPhone,
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true
    }
  });
};

export const updatePreferences = async (phone: string, _schoolId: string | undefined, data: any) => {
  const cleanPhone = phone.replace(/\s+/g, '');
  return await prisma.parentPreferences.upsert({
    where: { parentPhone: cleanPhone },
    update: {
      emailNotifications: data.emailNotifications ?? true,
      smsNotifications: data.smsNotifications ?? false,
      pushNotifications: data.pushNotifications ?? true
    },
    create: {
      parentPhone: cleanPhone,
      emailNotifications: data.emailNotifications ?? true,
      smsNotifications: data.smsNotifications ?? false,
      pushNotifications: data.pushNotifications ?? true
    }
  });
};

export const postAnnouncement = async (_schoolId: string | undefined, data: any) => {
  const rawAudience = (data.targetAudience || 'GENERAL').toUpperCase();
  const validAudience = ['GENERAL', 'PARENTS', 'STAFF'].includes(rawAudience) ? rawAudience : 'GENERAL';

  const result = await prisma.parentNotification.create({
    data: {
      studentId: data.studentId || null,
      type: data.type || "announcement",
      category: "ANNOUNCEMENT",
      targetAudience: validAudience,
      title: data.title,
      message: data.message,
      isRead: false
    }
  });

  try {
    const { sendCategoryNotification } = require('./notification.service');
    const { getIO } = require('../socket');
    const io = getIO ? getIO() : null;

    const singleSchool = await schoolService.getSingleSchool();
    const schoolName = singleSchool.name || 'Addis Hiwot School';

    if (validAudience === 'PARENTS' || validAudience === 'GENERAL') {
      const parentLinks = await prisma.parentStudentLink.findMany({
        where: {
          ...(data.studentId ? { studentId: data.studentId } : {})
        },
        include: {
          parent: true
        }
      });

      const uniqueParents = Array.from(
        new Map(
          parentLinks
            .filter(l => l.parent !== null)
            .map(l => [l.parentId, l.parent])
        ).values()
      );

      for (const parent of uniqueParents) {
        if (parent && parent.pushToken) {
          if (parent.phone) {
            const prefs = await prisma.parentPreferences.findUnique({
              where: { parentPhone: parent.phone }
            });
            if (prefs && !prefs.pushNotifications) {
              continue;
            }
          }

          await sendCategoryNotification(parent.pushToken, {
            type: 'new_announcement',
            title: schoolName,
            body: data.message || 'There is a new announcement from school.',
            route: '/parent/announcements',
            schoolName,
            categoryLabel: 'Announcement',
            tag: 'announcements'
          }).catch((err: any) => {
            console.error(`Failed to send announcement push to parent ${parent.id}:`, err);
          });
        }
      }

      if (io) {
        io.emit('new_notification', result);
      }
    }

    if (validAudience === 'STAFF' || validAudience === 'GENERAL') {
      const staffUsers = await prisma.user.findMany({
        where: {
          role: { not: 'parent' }
        },
        select: { id: true, pushToken: true, role: true }
      });

      if (staffUsers.length > 0) {
        await (prisma as any).userNotification.createMany({
          data: staffUsers.map(u => ({
            userId: u.id,
            type: data.type === 'emergency' ? 'ALERT' : 'INFO',
            category: 'ANNOUNCEMENT',
            priority: data.type === 'emergency' ? 'HIGH' : 'NORMAL',
            title: data.title,
            message: data.message,
            targetRole: 'ALL_STAFF',
            metadata: JSON.stringify({ announcementId: result.id, targetAudience: validAudience }),
            isRead: false
          }))
        });

        for (const staff of staffUsers) {
          if (staff.pushToken) {
            await sendCategoryNotification(staff.pushToken, {
              type: 'new_announcement',
              title: schoolName,
              body: data.message || 'There is a new staff announcement.',
              route: '/school/staff/announcements',
              schoolName,
              categoryLabel: 'Staff Announcement',
              tag: 'announcements'
            }).catch((err: any) => {
              console.error(`Failed to send announcement push to staff ${staff.id}:`, err);
            });
          }

          if (io) {
            io.to(`user_${staff.id}`).emit('new_notification', {
              ...result,
              category: 'ANNOUNCEMENT',
              targetAudience: validAudience
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to dispatch announcement push notifications:', e);
  }

  return result;
};

export const updateAnnouncement = async (id: string, _schoolId: string | undefined, data: any) => {
  const updateData: any = {
    title: data.title,
    message: data.message,
    type: data.type || "announcement",
  };

  if (data.targetAudience) {
    const rawAudience = data.targetAudience.toUpperCase();
    if (['GENERAL', 'PARENTS', 'STAFF'].includes(rawAudience)) {
      updateData.targetAudience = rawAudience;
    }
  }

  return await prisma.parentNotification.update({
    where: { id },
    data: updateData
  });
};

export const getSchoolAnnouncements = async (_schoolId?: string, userRole?: string, limit?: number | string) => {
  let audienceCondition: any = undefined;

  if (userRole === 'parent') {
    audienceCondition = {
      OR: [
        { targetAudience: { in: ['GENERAL', 'PARENTS', 'general', 'parents'] } },
        { targetAudience: null }
      ]
    };
  } else if (['admin', 'school_admin', 'super_admin'].includes(userRole || '')) {
    audienceCondition = undefined;
  } else {
    audienceCondition = {
      OR: [
        { targetAudience: { in: ['GENERAL', 'STAFF', 'general', 'staff'] } },
        { targetAudience: null }
      ]
    };
  }

  const whereClause: any = {
    type: { in: ["announcement", "emergency", "info"] },
    studentId: null,
    ...(audienceCondition ? audienceCondition : {})
  };

  return await prisma.parentNotification.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    ...(limit ? { take: Number(limit) } : {})
  });
};

export const updatePassword = async (phone: string, currentPassword: string, newPassword: string, _schoolId?: string) => {
  const cleanPhone = normalizePhoneNumber(phone);
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: cleanPhone },
        { phone: phone.replace(/\s+/g, '') }
      ]
    }
  });

  if (!user) throw new Error("User not found.");
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValidPassword) throw new Error("Incorrect current password.");

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash: hashedPassword }
  });

  return { success: true, message: "Password updated successfully." };
};

export const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return "";
  
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = '+251' + cleaned.substring(1);
  } else if (cleaned.startsWith('251') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+') && cleaned.length > 0) {
    cleaned = '+251' + cleaned;
  }
  
  if (cleaned.startsWith('+2510')) {
    cleaned = '+251' + cleaned.substring(5);
  }
  
  if (cleaned.lastIndexOf("+") > 0) {
    cleaned = "+" + cleaned.replace(/\+/g, "");
  }
  
  return cleaned;
};

export const syncLegacyStudents = async (userId: string, phone: string) => {
  const cleanPhone = normalizePhoneNumber(phone);
  
  const variations = new Set<string>();
  variations.add(cleanPhone);
  
  const rawNoPlus = cleanPhone.replace('+', '');
  variations.add(rawNoPlus);

  let suffix = '';
  if (cleanPhone.startsWith('+251') && cleanPhone.length >= 13) {
    suffix = cleanPhone.substring(cleanPhone.length - 9);
  } else if (cleanPhone.length >= 9) {
    suffix = cleanPhone.substring(cleanPhone.length - 9);
  }

  if (suffix) {
    variations.add(suffix);
    variations.add('0' + suffix);
    variations.add('251' + suffix);
  }

  const legacyStudents = await prisma.student.findMany({
    where: { 
      OR: [
        { parent_phone: { in: Array.from(variations) } },
        ...(suffix ? [{ parent_phone: { contains: suffix } }] : [])
      ]
    }
  });

  const matchedStudents = legacyStudents.filter(s => {
    if (!s.parent_phone) return false;
    const dbPhoneCleaned = s.parent_phone.replace(/[^\d+]/g, '');
    return variations.has(dbPhoneCleaned) || Boolean(suffix && dbPhoneCleaned.endsWith(suffix));
  });

  for (const student of matchedStudents) {
    await prisma.parentStudentLink.upsert({
      where: { parentId_studentId: { parentId: userId, studentId: student.id } },
      update: {},
      create: { parentId: userId, studentId: student.id }
    });
  }
  
  return matchedStudents;
};

export const findOrCreateParentByPhone = async (phone: string, data: { name?: string; email?: string; password?: string; address?: string; schoolId?: string }) => {
  const cleanPhone = normalizePhoneNumber(phone);
  
  let existingUser = await prisma.user.findUnique({
    where: { phone: cleanPhone }
  });

  if (!existingUser) {
    const rawNoPlus = cleanPhone.replace('+', '');
    const ethStandard = cleanPhone.startsWith('+251') ? '0' + cleanPhone.substring(4) : null;
    
    existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: rawNoPlus },
          ...(ethStandard ? [{ phone: ethStandard }] : [])
        ]
      }
    });

    if (existingUser) {
      existingUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { phone: cleanPhone }
      });
    }
  }

  if (!existingUser && data.email) {
    existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser && !existingUser.phone) {
      existingUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { phone: cleanPhone }
      });
    } else if (existingUser && existingUser.phone !== cleanPhone) {
      throw new Error(`Email ${data.email} is already associated with another account.`);
    }
  }

  if (existingUser) {
    return existingUser;
  }

  const hashedPassword = data.password 
    ? await bcrypt.hash(data.password, 10) 
    : await bcrypt.hash('addishiwot123', 10);

  const parentEmail = data.email || `parent-${cleanPhone.replace('+', '')}@addishiwot.edu.et`;

  try {
    const newParent = await prisma.user.create({
      data: {
        phone: cleanPhone,
        email: parentEmail,
        password_hash: hashedPassword,
        full_name: data.name || 'Parent',
        role: 'parent',
        address: data.address || null,
        is_active: true
      }
    });
    return newParent;
  } catch (error: any) {
    if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
      const recoveredParent = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: cleanPhone },
            { email: parentEmail }
          ]
        }
      });
      if (recoveredParent) {
        return recoveredParent;
      }
    }
    throw error;
  }
};

export const checkParentsExist = async (phones: string[]) => {
  const normalizedPhones = phones.map(normalizePhoneNumber);
  const existingParents = await prisma.user.findMany({
    where: { 
      phone: { in: normalizedPhones },
      role: 'parent'
    },
    select: { phone: true }
  });
  
  const existingSet = new Set(existingParents.map(p => p.phone));
  return normalizedPhones.map(p => existingSet.has(p));
};

export const searchParentByPhone = async (phone: string, _schoolId?: string) => {
  const cleanPhone = phone.replace(/\s+/g, '');
  
  const phoneVariations = [cleanPhone];
  if (cleanPhone.startsWith('+251')) {
    const suffix = cleanPhone.substring(4);
    phoneVariations.push(suffix);
    phoneVariations.push('0' + suffix);
    phoneVariations.push('251' + suffix);
  } else if (cleanPhone.startsWith('0')) {
    const suffix = cleanPhone.substring(1);
    phoneVariations.push(suffix);
    phoneVariations.push('+251' + suffix);
    phoneVariations.push('251' + suffix);
  }

  const user = await prisma.user.findFirst({
    where: { 
      phone: { in: phoneVariations }
    },
    select: { id: true, full_name: true, email: true, phone: true, address: true }
  });

  if (user) {
    return { success: true, data: user };
  }

  const legacyStudent = await prisma.student.findFirst({
    where: { 
      parent_phone: { in: phoneVariations }
    },
    select: { parent_name: true, parent_email: true, parent_phone: true, address: true }
  });

  if (legacyStudent) {
    return {
      success: true,
      data: {
        id: null,
        full_name: legacyStudent.parent_name,
        email: legacyStudent.parent_email,
        phone: legacyStudent.parent_phone,
        address: legacyStudent.address,
        isLegacy: true
      }
    };
  }

  return { success: false, message: "No parent found with this phone number." };
};

export const updateProfile = async (phone: string, _schoolId: string | undefined, data: { name: string, email: string, address?: string, profile_photo?: string | null }) => {
  const cleanPhone = normalizePhoneNumber(phone);
  const user = await prisma.user.findUnique({
    where: { phone: cleanPhone }
  });

  if (!user) {
    throw new Error("Parent not found.");
  }

  const updateData: any = {
    full_name: data.name,
    email: data.email,
    address: data.address
  };

  if (data.profile_photo !== undefined) {
    updateData.profile_photo = data.profile_photo;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateData
  });

  return { 
    success: true, 
    message: "Profile updated successfully.",
    data: {
      id: updatedUser.id,
      name: updatedUser.full_name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      address: updatedUser.address,
      profile_photo: updatedUser.profile_photo
    }
  };
};
