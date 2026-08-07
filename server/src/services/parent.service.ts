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

  // Ensure all legacy students are synced before listing schools
  await syncLegacyStudents(user.id, cleanPhone);

  const schools = await getParentSchools(user.id);
  return { success: true, data: schools };
};

/**
 * Get all schools a parent is linked to via their children.
 * Used by /me/schools — server-side validated only.
 */
export const getParentSchools = async (userId: string) => {
  console.log(`[getParentSchools] Fetching schools for userId: ${userId}`);
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: userId },
    include: {
      school: {
        include: { settings: true }
      },
      student: true
    }
  });

  console.log(`[getParentSchools] Found ${links.length} links in ParentStudentLink`);

  const schoolMap = new Map<string, any>();
  for (const l of links) {
    const schoolId = l.schoolId || l.student?.schoolId;
    if (schoolId && !schoolMap.has(schoolId)) {
      let schoolInfo = l.school;
      
      // Fallback: If school object missing from link, fetch it via schoolId
      if (!schoolInfo && schoolId) {
        schoolInfo = await prisma.school.findUnique({
          where: { id: schoolId },
          include: { settings: true }
        });
      }

      if (schoolInfo) {
        console.log(`[getParentSchools] Mapping school: ${schoolInfo.name} (${schoolId})`);
        schoolMap.set(schoolId, {
          id: schoolId,
          name: schoolInfo.name || 'My School',
          logo: (schoolInfo as any).settings?.school_logo || '',
          customSchoolId: schoolInfo.schoolId || '',
          role: 'parent'
        });
      } else {
        console.warn(`[getParentSchools] Could not find school metadata for schoolId: ${schoolId}`);
      }
    }
  }

  const schools = Array.from(schoolMap.values());
  console.log(`[getParentSchools] Final school count: ${schools.length}`);
  return schools;
};

/**
 * Validate that a parent has at least one child in the given school.
 * Security boundary — never skip this check.
 */
export const validateSchoolAccess = async (userId: string, schoolId: string): Promise<boolean> => {
  const link = await prisma.parentStudentLink.findFirst({
    where: { parentId: userId, schoolId }
  });
  return !!link;
};

/**
 * Get all students a parent has in a specific school.
 * Called after a school switch to refresh the student list.
 */
export const getParentStudentsForSchool = async (parentId: string, schoolId: string) => {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId, schoolId },
    include: {
      student: {
        include: { grade: true, section: true, stream: true }
      }
    }
  });

  return links
    .map((l: any) => l.student)
    .filter(Boolean)
    .map((s: any) => ({
      ...s,
      name: s.fullName,
      grade: s.grade?.name || '',
      section: s.section?.name || '',
      stream: s.stream?.name || null,
    }));
};

/**
 * Login Parent and establish session.
 * Syncs ParentStudent relation records.
 */
export const loginParent = async (phone: string, password: string, schoolId?: string) => {
  const cleanPhone = normalizePhoneNumber(phone);

  const user = await prisma.user.findUnique({
    where: { phone: cleanPhone },
    include: { school: true }
  });

  if (!user) {
    throw new Error("Invalid phone number or password.");
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error("Invalid phone number or password.");
  }

  // 1. Sync any legacy students (found via phone in Student table) into ParentStudentLink
  console.log(`[loginParent] Syncing legacy students for phone: ${cleanPhone}`);
  await syncLegacyStudents(user.id, cleanPhone);

  // 2. Retrieve ALL students via ParentStudentLink (global lookup)
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: user.id },
    include: {
      student: {
        include: { grade: true, section: true, stream: true }
      }
    }
  });

  const students: any[] = links.map(l => l.student).filter(Boolean);
  console.log(`[loginParent] Discovered ${students.length} linked students`);

  if (students.length === 0) {
    throw new Error("No children profiles found associated with this account.");
  }

  const mappedStudents = students.map((s: any) => ({
    ...s,
    name: s.fullName,
    grade: s.grade?.name || '',
    section: s.section?.name || '',
    stream: s.stream?.name || null,
  }));

  // Get all associated schools for context switching
  const availableSchools = await getParentSchools(user.id);
  console.log(`[loginParent] Total available schools: ${availableSchools.length}`);

  // Generate a token for the parent
  let customSchoolId = '';
  let schoolName = 'My School';
  let schoolLogo = '';
  const firstStudent = students[0];
  
  // For parents, prioritize a school they actually have a child in
  const availableSchoolIds = availableSchools.map(s => s.id);
  let resolvedSchoolId: string = user.schoolId || '';
  
  if (!resolvedSchoolId || !availableSchoolIds.includes(resolvedSchoolId)) {
    resolvedSchoolId = firstStudent?.schoolId || '';
  }

  if (resolvedSchoolId) {
    const school = await schoolService.getSchoolById(resolvedSchoolId);
    if (school) {
      customSchoolId = school.schoolId || '';
      schoolName = school.name || schoolName;
      schoolLogo = (school as any).settings?.school_logo || '';
    }
  }

  const token = generateToken({
    id: user.id,
    email: user.email || `parent-${cleanPhone}@zetime.com`,
    role: 'parent',
    schoolId: resolvedSchoolId,
    customSchoolId,
  });

  return {
    success: true,
    id: user.id,
    token,
    parentName: user.full_name || students[0]?.parent_name || "Parent",
    phone: cleanPhone,
    schoolId: resolvedSchoolId,
    schoolName,
    schoolLogo,
    students: mappedStudents,
    availableSchools,
  };
}

/**
 * Get Parent Portal notifications.
 */
export const getNotifications = async (phone: string, schoolId: string) => {
  const cleanPhone = normalizePhoneNumber(phone);

  const user = await prisma.user.findUnique({ 
    where: { phone: cleanPhone } 
  });
  
  if (!user) return [];

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: user.id, schoolId },
    select: { studentId: true }
  });
  const studentIds = links.map(l => l.studentId);

  const notifications = await prisma.parentNotification.findMany({
    where: {
      schoolId,
      OR: [
        { studentId: { in: studentIds } },
        { studentId: null }
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

export const markNotificationAsRead = async (id: string, schoolId: string) => {
  return await prisma.parentNotification.update({
    where: { id, schoolId },
    data: { isRead: true }
  });
};

export const deleteNotification = async (id: string, schoolId: string) => {
  return await prisma.parentNotification.deleteMany({
    where: { id, schoolId }
  });
};

export const markAllNotificationsAsRead = async (phone: string, schoolId: string) => {
  const cleanPhone = normalizePhoneNumber(phone);
  const user = await prisma.user.findUnique({ 
    where: { phone: cleanPhone } 
  });
  if (!user) return;

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: user.id, schoolId },
    select: { studentId: true }
  });
  const studentIds = links.map(l => l.studentId);

  return await prisma.parentNotification.updateMany({
    where: {
      schoolId,
      OR: [
        { studentId: { in: studentIds } },
        { studentId: null }
      ],
      isRead: false
    },
    data: { isRead: true }
  });
};

export const getPreferences = async (phone: string, schoolId: string) => {
  const cleanPhone = phone.replace(/\s+/g, '');
  return await prisma.parentPreferences.upsert({
    where: { parentPhone_schoolId: { parentPhone: cleanPhone, schoolId } },
    update: {},
    create: {
      parentPhone: cleanPhone,
      schoolId,
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true
    }
  });
};

export const updatePreferences = async (phone: string, schoolId: string, data: any) => {
  const cleanPhone = phone.replace(/\s+/g, '');
  return await prisma.parentPreferences.upsert({
    where: { parentPhone_schoolId: { parentPhone: cleanPhone, schoolId } },
    update: {
      emailNotifications: data.emailNotifications ?? true,
      smsNotifications: data.smsNotifications ?? false,
      pushNotifications: data.pushNotifications ?? true
    },
    create: {
      parentPhone: cleanPhone,
      schoolId,
      emailNotifications: data.emailNotifications ?? true,
      smsNotifications: data.smsNotifications ?? false,
      pushNotifications: data.pushNotifications ?? true
    }
  });
};

export const postAnnouncement = async (schoolId: string, data: any) => {
  const result = await prisma.parentNotification.create({
    data: {
      schoolId,
      studentId: data.studentId || null,
      type: data.type || "announcement",
      title: data.title,
      message: data.message,
      isRead: false
    }
  });

  try {
    const parentLinks = await prisma.parentStudentLink.findMany({
      where: {
        schoolId,
        ...(data.studentId ? { studentId: data.studentId } : {})
      },
      include: {
        parent: true
      }
    });

    const { sendCategoryNotification } = require('./notification.service');
    const uniqueParents = Array.from(
      new Map(
        parentLinks
          .filter(l => l.parent !== null)
          .map(l => [l.parentId, l.parent])
      ).values()
    );

    // Fetch school name once for all parent pushes
    const schoolRecord = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true }
    });
    const schoolName = schoolRecord?.name || 'ZeTime School';

    for (const parent of uniqueParents) {
      if (parent && parent.pushToken) {
        // Check parent preferences only if phone is set
        if (parent.phone) {
          const prefs = await prisma.parentPreferences.findUnique({
            where: { parentPhone_schoolId: { parentPhone: parent.phone, schoolId } }
          });
          if (prefs && !prefs.pushNotifications) {
            continue; // Guard: parent disabled push alerts
          }
        }

        await sendCategoryNotification(parent.pushToken, {
          type: 'new_announcement',
          title: schoolName,                                            // School name as title
          body: data.message || 'There is a new announcement from school.',
          route: '/parent/announcements',
          schoolId,
          schoolName,
          categoryLabel: 'Announcement',                               // Category subtext
          tag: 'announcements'
        }).catch((err: any) => {
          console.error(`Failed to send announcement push to parent ${parent.id}:`, err);
        });
      }
    }
  } catch (e) {
    console.error('Failed to dispatch announcement push notifications:', e);
  }

  return result;
};

export const updateAnnouncement = async (id: string, schoolId: string, data: any) => {
  return await prisma.parentNotification.update({
    where: { id, schoolId },
    data: {
      title: data.title,
      message: data.message,
      type: data.type || "announcement",
    }
  });
};

export const getSchoolAnnouncements = async (schoolId: string) => {
  return await prisma.parentNotification.findMany({
    where: { 
      schoolId,
      type: { in: ["announcement", "emergency"] },
      studentId: null // General announcements
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const updatePassword = async (phone: string, currentPassword: string, newPassword: string, schoolId: string) => {
  // Use global phone lookup — parents are global entities, not school-scoped in the User table
  const cleanPhone = normalizePhoneNumber(phone);
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: cleanPhone },
        { phone: phone.replace(/\s+/g, '') } // fallback: non-normalized input
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


/**
 * Normalizes phone numbers to E.164 format for Ethiopian numbers.
 * Removes spaces, dashes, and ensures +251 prefix.
 */
export const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return "";
  
  // Remove all non-numeric characters (except leading +)
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle various Ethiopian formats
  if (cleaned.startsWith('0')) {
    cleaned = '+251' + cleaned.substring(1);
  } else if (cleaned.startsWith('251') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+') && cleaned.length > 0) {
    cleaned = '+251' + cleaned;
  }
  
  // Handle leading zero after country code (e.g. +25109... -> +2519...)
  if (cleaned.startsWith('+2510')) {
    cleaned = '+251' + cleaned.substring(5);
  }
  
  // Final cleanup of extra pluses
  if (cleaned.lastIndexOf("+") > 0) {
    cleaned = "+" + cleaned.replace(/\+/g, "");
  }
  
  return cleaned;
};

/**
 * Synchronizes legacy student records (found by phone in Student table)
 * with the ParentStudentLink model for a specific user.
 * Uses multiple phone format variations.
 */
export const syncLegacyStudents = async (userId: string, phone: string) => {
  const cleanPhone = normalizePhoneNumber(phone);
  
  // Create variations of the phone number to search for (Ethiopian context)
  const variations = new Set<string>();
  variations.add(cleanPhone);
  
  const rawNoPlus = cleanPhone.replace('+', '');
  variations.add(rawNoPlus);

  let suffix = '';
  if (cleanPhone.startsWith('+251') && cleanPhone.length >= 13) {
    suffix = cleanPhone.substring(cleanPhone.length - 9); // e.g., 911223344
  } else if (cleanPhone.length >= 9) {
    suffix = cleanPhone.substring(cleanPhone.length - 9);
  }

  // 1. Direct match with common variations
  if (suffix) {
    variations.add(suffix);
    variations.add('0' + suffix);
    variations.add('251' + suffix);
  }

  // 2. Fetch students using these variations
  // We use multiple search strategies to find legacy records
  console.log(`[syncLegacyStudents] Searching variations:`, Array.from(variations));
  if (suffix) console.log(`[syncLegacyStudents] Suffix search: ${suffix}`);
  
  const legacyStudents = await prisma.student.findMany({
    where: { 
      OR: [
        { parent_phone: { in: Array.from(variations) } },
        // Aggressive suffix match to handle spaces (e.g. "09 11 22..." in DB)
        ...(suffix ? [{ parent_phone: { contains: suffix } }] : [])
      ]
    }
  });

  console.log(`[syncLegacyStudents] Found ${legacyStudents.length} potential students in DB`);

  // 3. Filter results in memory to ensure true phone match (cleaning DB phone numbers)
  const matchedStudents = legacyStudents.filter(s => {
    if (!s.parent_phone) return false;
    const dbPhoneCleaned = s.parent_phone.replace(/[^\d+]/g, '');
    const isMatch = variations.has(dbPhoneCleaned) || (suffix && dbPhoneCleaned.endsWith(suffix));
    if (isMatch) console.log(`[syncLegacyStudents] Matched student: ${s.id} (${s.fullName}) at school: ${s.schoolId}`);
    return isMatch;
  });

  console.log(`[syncLegacyStudents] Final matched count: ${matchedStudents.length}`);

  for (const student of matchedStudents) {
    await prisma.parentStudentLink.upsert({
      where: { parentId_studentId: { parentId: userId, studentId: student.id } },
      update: { schoolId: student.schoolId },
      create: { parentId: userId, studentId: student.id, schoolId: student.schoolId }
    });
  }
  
  return matchedStudents;
};

/**
 * Finds an existing parent by phone or creates a new one.
 * Atomic operation using upsert to prevent duplicates.
 */
export const findOrCreateParentByPhone = async (phone: string, data: any) => {
  const cleanPhone = normalizePhoneNumber(phone);
  console.log(`[ParentService] Lookup started for phone: "${phone}" (normalized: "${cleanPhone}")`);
  
  // 1. Try finding by normalized phone first
  let existingUser = await prisma.user.findUnique({
    where: { phone: cleanPhone }
  });

  // 2. If not found, try unnormalized variations (e.g. 09... instead of +251...)
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

    // If found by old format, update it to normalized format
    if (existingUser) {
      existingUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { phone: cleanPhone }
      });
    }
  }

  // 3. Fallback: Search by email if provided
  if (!existingUser && data.email) {
    existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    // If found by email, link the phone if it was missing
    if (existingUser && !existingUser.phone) {
      existingUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { phone: cleanPhone }
      });
    } else if (existingUser && existingUser.phone !== cleanPhone) {
      // Conflict: Email belongs to someone with a DIFFERENT phone
      throw new Error(`Email ${data.email} is already associated with another account.`);
    }
  }

  if (existingUser) {
    console.log(`[ParentService] Duplicate creation prevented: Existing parent returned (ID: ${existingUser.id}, Phone: ${existingUser.phone})`);
    return existingUser;
  }

  const hashedPassword = data.password 
    ? await bcrypt.hash(data.password, 10) 
    : await bcrypt.hash('zetime123', 10);

  const parentEmail = data.email || `parent-${cleanPhone.replace('+', '')}@zetime.com`;

  // 4. Creation with UNIQUE Constraint Violation (P2002) Error Handling & Recovery
  try {
    const newParent = await prisma.user.create({
      data: {
        phone: cleanPhone,
        email: parentEmail,
        password_hash: hashedPassword,
        full_name: data.name || 'Parent',
        role: 'parent',
        address: data.address || null,
        is_active: true,
        schoolId: data.schoolId || null
      }
    });
    console.log(`[ParentService] New parent account created successfully (ID: ${newParent.id}, Phone: ${newParent.phone})`);
    return newParent;
  } catch (error: any) {
    // Catch Unique Constraint Violation (Prisma Code P2002)
    if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
      console.warn(`[ParentService] UNIQUE constraint conflict detected during parent creation for phone "${cleanPhone}". Recovering existing record...`);
      const recoveredParent = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: cleanPhone },
            { email: parentEmail }
          ]
        }
      });
      if (recoveredParent) {
        console.log(`[ParentService] Existing parent returned after UNIQUE constraint conflict (ID: ${recoveredParent.id})`);
        return recoveredParent;
      }
    }
    console.error(`[ParentService] Failed to create parent for phone "${cleanPhone}":`, error);
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

export const searchParentByPhone = async (phone: string, schoolId: string) => {
  const cleanPhone = phone.replace(/\s+/g, '');
  console.log(`[ParentService] Search parent lookup started for phone: "${cleanPhone}" (schoolId: ${schoolId})`);
  
  // Create variations of the phone number to search for (Ethiopian context)
  const phoneVariations = [cleanPhone];
  if (cleanPhone.startsWith('+251')) {
    const suffix = cleanPhone.substring(4); // e.g., 911223344
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
    select: { id: true, full_name: true, email: true, phone: true, address: true, schoolId: true }
  });

  if (user) {
    console.log(`[ParentService] Lookup completed: Parent account found in User directory (ID: ${user.id})`);
    return { success: true, data: user };
  }

  // Fallback: Search Student table for legacy parent info within THIS school
  const legacyStudent = await prisma.student.findFirst({
    where: { 
      parent_phone: { in: phoneVariations },
      schoolId: schoolId 
    },
    select: { parent_name: true, parent_email: true, parent_phone: true, address: true }
  });

  if (legacyStudent) {
    console.log(`[ParentService] Lookup completed: Legacy parent info found in Student table`);
    return {
      success: true,
      data: {
        id: null, // No user account yet
        full_name: legacyStudent.parent_name,
        email: legacyStudent.parent_email,
        phone: legacyStudent.parent_phone,
        address: legacyStudent.address,
        isLegacy: true
      }
    };
  }

  console.log(`[ParentService] Lookup completed: No parent record found for phone "${cleanPhone}"`);
  return { success: false, message: "No parent found with this phone number." };
};

export const updateProfile = async (phone: string, schoolId: string, data: { name: string, email: string, address?: string, profile_photo?: string | null }) => {
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

  // Only update profile_photo if explicitly provided (allows null to remove)
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
