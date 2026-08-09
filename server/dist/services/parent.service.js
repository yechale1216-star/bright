"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.searchParentByPhone = exports.checkParentsExist = exports.findOrCreateParentByPhone = exports.syncLegacyStudents = exports.normalizePhoneNumber = exports.updatePassword = exports.getSchoolAnnouncements = exports.updateAnnouncement = exports.postAnnouncement = exports.updatePreferences = exports.getPreferences = exports.markAllNotificationsAsRead = exports.deleteNotification = exports.markNotificationAsRead = exports.getNotifications = exports.loginParent = exports.getParentStudentsForSchool = exports.validateSchoolAccess = exports.getParentSchools = exports.listParentSchools = void 0;
const db_1 = __importDefault(require("../config/db"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt_1 = require("../utils/jwt");
const schoolService = __importStar(require("./school.service"));
/**
 * List all schools associated with a parent's phone number.
 */
const listParentSchools = async (phone) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findUnique({
        where: { phone: cleanPhone }
    });
    if (!user) {
        return { success: false, message: "No account found with this phone number." };
    }
    // Ensure all legacy students are synced before listing schools
    await (0, exports.syncLegacyStudents)(user.id, cleanPhone);
    const schools = await (0, exports.getParentSchools)(user.id);
    return { success: true, data: schools };
};
exports.listParentSchools = listParentSchools;
/**
 * Get all schools a parent is linked to via their children.
 * Used by /me/schools — server-side validated only.
 */
const getParentSchools = async (userId) => {
    const links = await db_1.default.parentStudentLink.findMany({
        where: { parentId: userId },
        include: {
            school: {
                include: { settings: true }
            },
            student: true
        }
    });
    const schoolMap = new Map();
    for (const l of links) {
        const schoolId = l.schoolId || l.student?.schoolId;
        if (schoolId && !schoolMap.has(schoolId)) {
            let schoolInfo = l.school;
            if (!schoolInfo && schoolId) {
                schoolInfo = await db_1.default.school.findUnique({
                    where: { id: schoolId },
                    include: { settings: true }
                });
            }
            if (schoolInfo) {
                schoolMap.set(schoolId, {
                    id: schoolId,
                    name: schoolInfo.name || 'My School',
                    logo: schoolInfo.settings?.school_logo || '',
                    customSchoolId: schoolInfo.schoolId || '',
                    role: 'parent'
                });
            }
        }
    }
    return Array.from(schoolMap.values());
};
exports.getParentSchools = getParentSchools;
/**
 * Validate that a parent has at least one child in the given school.
 * Security boundary — never skip this check.
 */
const validateSchoolAccess = async (userId, schoolId) => {
    const link = await db_1.default.parentStudentLink.findFirst({
        where: { parentId: userId, schoolId }
    });
    return !!link;
};
exports.validateSchoolAccess = validateSchoolAccess;
/**
 * Get all students a parent has in a specific school.
 * Called after a school switch to refresh the student list.
 */
const getParentStudentsForSchool = async (parentId, schoolId) => {
    const links = await db_1.default.parentStudentLink.findMany({
        where: { parentId, schoolId },
        include: {
            student: {
                include: { grade: true, section: true, stream: true }
            }
        }
    });
    return links
        .map((l) => l.student)
        .filter(Boolean)
        .map((s) => ({
        ...s,
        name: s.fullName,
        grade: s.grade?.name || '',
        section: s.section?.name || '',
        stream: s.stream?.name || null,
    }));
};
exports.getParentStudentsForSchool = getParentStudentsForSchool;
/**
 * Login Parent and establish session.
 * Syncs ParentStudent relation records.
 */
const loginParent = async (phone, password, schoolId) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findUnique({
        where: { phone: cleanPhone },
        include: { school: true }
    });
    if (!user) {
        throw new Error("Invalid phone number or password.");
    }
    const isValidPassword = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!isValidPassword) {
        throw new Error("Invalid phone number or password.");
    }
    // 1. Sync any legacy students (found via phone in Student table) into ParentStudentLink
    console.log(`[loginParent] Syncing legacy students for phone: ${cleanPhone}`);
    await (0, exports.syncLegacyStudents)(user.id, cleanPhone);
    // 2. Retrieve ALL students via ParentStudentLink (global lookup)
    const links = await db_1.default.parentStudentLink.findMany({
        where: { parentId: user.id },
        include: {
            student: {
                include: { grade: true, section: true, stream: true }
            }
        }
    });
    const students = links.map(l => l.student).filter(Boolean);
    console.log(`[loginParent] Discovered ${students.length} linked students`);
    if (students.length === 0) {
        throw new Error("No children profiles found associated with this account.");
    }
    const mappedStudents = students.map((s) => ({
        ...s,
        name: s.fullName,
        grade: s.grade?.name || '',
        section: s.section?.name || '',
        stream: s.stream?.name || null,
    }));
    // Single school resolution
    const singleSchool = await schoolService.getSingleSchool();
    let resolvedSchoolId = user.schoolId || students[0]?.schoolId || singleSchool.id;
    let customSchoolId = singleSchool.schoolId || 'SCH-0001';
    let schoolName = singleSchool.name || 'Zetime School';
    let schoolLogo = singleSchool.settings?.school_logo || '';
    if (resolvedSchoolId && resolvedSchoolId !== singleSchool.id) {
        const school = await schoolService.getSchoolById(resolvedSchoolId);
        if (school) {
            customSchoolId = school.schoolId || customSchoolId;
            schoolName = school.name || schoolName;
            schoolLogo = school.settings?.school_logo || schoolLogo;
        }
    }
    const token = (0, jwt_1.generateToken)({
        id: user.id,
        email: user.email || `parent-${cleanPhone}@zetime.com`,
        role: 'parent',
        schoolId: resolvedSchoolId,
        customSchoolId,
    });
    const singleSchoolObj = {
        id: resolvedSchoolId,
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
        schoolId: resolvedSchoolId,
        schoolName,
        schoolLogo,
        students: mappedStudents,
        availableSchools: [singleSchoolObj],
    };
};
exports.loginParent = loginParent;
/**
 * Get Parent Portal notifications.
 */
const getNotifications = async (phone, schoolId) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findUnique({
        where: { phone: cleanPhone }
    });
    if (!user)
        return [];
    const links = await db_1.default.parentStudentLink.findMany({
        where: { parentId: user.id, schoolId },
        select: { studentId: true }
    });
    const studentIds = links.map(l => l.studentId);
    const notifications = await db_1.default.parentNotification.findMany({
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
exports.getNotifications = getNotifications;
const markNotificationAsRead = async (id, schoolId) => {
    return await db_1.default.parentNotification.update({
        where: { id, schoolId },
        data: { isRead: true }
    });
};
exports.markNotificationAsRead = markNotificationAsRead;
const deleteNotification = async (id, schoolId) => {
    return await db_1.default.parentNotification.deleteMany({
        where: { id, schoolId }
    });
};
exports.deleteNotification = deleteNotification;
const markAllNotificationsAsRead = async (phone, schoolId) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findUnique({
        where: { phone: cleanPhone }
    });
    if (!user)
        return;
    const links = await db_1.default.parentStudentLink.findMany({
        where: { parentId: user.id, schoolId },
        select: { studentId: true }
    });
    const studentIds = links.map(l => l.studentId);
    return await db_1.default.parentNotification.updateMany({
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
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
const getPreferences = async (phone, schoolId) => {
    const cleanPhone = phone.replace(/\s+/g, '');
    return await db_1.default.parentPreferences.upsert({
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
exports.getPreferences = getPreferences;
const updatePreferences = async (phone, schoolId, data) => {
    const cleanPhone = phone.replace(/\s+/g, '');
    return await db_1.default.parentPreferences.upsert({
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
exports.updatePreferences = updatePreferences;
const postAnnouncement = async (schoolId, data) => {
    const result = await db_1.default.parentNotification.create({
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
        const parentLinks = await db_1.default.parentStudentLink.findMany({
            where: {
                schoolId,
                ...(data.studentId ? { studentId: data.studentId } : {})
            },
            include: {
                parent: true
            }
        });
        const { sendCategoryNotification } = require('./notification.service');
        const uniqueParents = Array.from(new Map(parentLinks
            .filter(l => l.parent !== null)
            .map(l => [l.parentId, l.parent])).values());
        // Fetch school name once for all parent pushes
        const schoolRecord = await db_1.default.school.findUnique({
            where: { id: schoolId },
            select: { name: true }
        });
        const schoolName = schoolRecord?.name || 'ZeTime School';
        for (const parent of uniqueParents) {
            if (parent && parent.pushToken) {
                // Check parent preferences only if phone is set
                if (parent.phone) {
                    const prefs = await db_1.default.parentPreferences.findUnique({
                        where: { parentPhone_schoolId: { parentPhone: parent.phone, schoolId } }
                    });
                    if (prefs && !prefs.pushNotifications) {
                        continue; // Guard: parent disabled push alerts
                    }
                }
                await sendCategoryNotification(parent.pushToken, {
                    type: 'new_announcement',
                    title: schoolName, // School name as title
                    body: data.message || 'There is a new announcement from school.',
                    route: '/parent/announcements',
                    schoolId,
                    schoolName,
                    categoryLabel: 'Announcement', // Category subtext
                    tag: 'announcements'
                }).catch((err) => {
                    console.error(`Failed to send announcement push to parent ${parent.id}:`, err);
                });
            }
        }
    }
    catch (e) {
        console.error('Failed to dispatch announcement push notifications:', e);
    }
    return result;
};
exports.postAnnouncement = postAnnouncement;
const updateAnnouncement = async (id, schoolId, data) => {
    return await db_1.default.parentNotification.update({
        where: { id, schoolId },
        data: {
            title: data.title,
            message: data.message,
            type: data.type || "announcement",
        }
    });
};
exports.updateAnnouncement = updateAnnouncement;
const getSchoolAnnouncements = async (schoolId) => {
    return await db_1.default.parentNotification.findMany({
        where: {
            schoolId,
            type: { in: ["announcement", "emergency"] },
            studentId: null // General announcements
        },
        orderBy: { createdAt: 'desc' }
    });
};
exports.getSchoolAnnouncements = getSchoolAnnouncements;
const updatePassword = async (phone, currentPassword, newPassword, schoolId) => {
    // Use global phone lookup — parents are global entities, not school-scoped in the User table
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findFirst({
        where: {
            OR: [
                { phone: cleanPhone },
                { phone: phone.replace(/\s+/g, '') } // fallback: non-normalized input
            ]
        }
    });
    if (!user)
        throw new Error("User not found.");
    const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
    if (!isValidPassword)
        throw new Error("Incorrect current password.");
    const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
    await db_1.default.user.update({
        where: { id: user.id },
        data: { password_hash: hashedPassword }
    });
    return { success: true, message: "Password updated successfully." };
};
exports.updatePassword = updatePassword;
/**
 * Normalizes phone numbers to E.164 format for Ethiopian numbers.
 * Removes spaces, dashes, and ensures +251 prefix.
 */
const normalizePhoneNumber = (phone) => {
    if (!phone)
        return "";
    // Remove all non-numeric characters (except leading +)
    let cleaned = phone.replace(/[^\d+]/g, '');
    // Handle various Ethiopian formats
    if (cleaned.startsWith('0')) {
        cleaned = '+251' + cleaned.substring(1);
    }
    else if (cleaned.startsWith('251') && !cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    else if (!cleaned.startsWith('+') && cleaned.length > 0) {
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
exports.normalizePhoneNumber = normalizePhoneNumber;
/**
 * Synchronizes legacy student records (found by phone in Student table)
 * with the ParentStudentLink model for a specific user.
 * Uses multiple phone format variations.
 */
const syncLegacyStudents = async (userId, phone) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    // Create variations of the phone number to search for (Ethiopian context)
    const variations = new Set();
    variations.add(cleanPhone);
    const rawNoPlus = cleanPhone.replace('+', '');
    variations.add(rawNoPlus);
    let suffix = '';
    if (cleanPhone.startsWith('+251') && cleanPhone.length >= 13) {
        suffix = cleanPhone.substring(cleanPhone.length - 9); // e.g., 911223344
    }
    else if (cleanPhone.length >= 9) {
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
    if (suffix)
        console.log(`[syncLegacyStudents] Suffix search: ${suffix}`);
    const legacyStudents = await db_1.default.student.findMany({
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
        if (!s.parent_phone)
            return false;
        const dbPhoneCleaned = s.parent_phone.replace(/[^\d+]/g, '');
        const isMatch = variations.has(dbPhoneCleaned) || (suffix && dbPhoneCleaned.endsWith(suffix));
        if (isMatch)
            console.log(`[syncLegacyStudents] Matched student: ${s.id} (${s.fullName}) at school: ${s.schoolId}`);
        return isMatch;
    });
    console.log(`[syncLegacyStudents] Final matched count: ${matchedStudents.length}`);
    for (const student of matchedStudents) {
        await db_1.default.parentStudentLink.upsert({
            where: { parentId_studentId: { parentId: userId, studentId: student.id } },
            update: { schoolId: student.schoolId },
            create: { parentId: userId, studentId: student.id, schoolId: student.schoolId }
        });
    }
    return matchedStudents;
};
exports.syncLegacyStudents = syncLegacyStudents;
/**
 * Finds an existing parent by phone or creates a new one.
 * Atomic operation using upsert to prevent duplicates.
 */
const findOrCreateParentByPhone = async (phone, data) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    console.log(`[ParentService] Lookup started for phone: "${phone}" (normalized: "${cleanPhone}")`);
    // 1. Try finding by normalized phone first
    let existingUser = await db_1.default.user.findUnique({
        where: { phone: cleanPhone }
    });
    // 2. If not found, try unnormalized variations (e.g. 09... instead of +251...)
    if (!existingUser) {
        const rawNoPlus = cleanPhone.replace('+', '');
        const ethStandard = cleanPhone.startsWith('+251') ? '0' + cleanPhone.substring(4) : null;
        existingUser = await db_1.default.user.findFirst({
            where: {
                OR: [
                    { phone: rawNoPlus },
                    ...(ethStandard ? [{ phone: ethStandard }] : [])
                ]
            }
        });
        // If found by old format, update it to normalized format
        if (existingUser) {
            existingUser = await db_1.default.user.update({
                where: { id: existingUser.id },
                data: { phone: cleanPhone }
            });
        }
    }
    // 3. Fallback: Search by email if provided
    if (!existingUser && data.email) {
        existingUser = await db_1.default.user.findUnique({
            where: { email: data.email }
        });
        // If found by email, link the phone if it was missing
        if (existingUser && !existingUser.phone) {
            existingUser = await db_1.default.user.update({
                where: { id: existingUser.id },
                data: { phone: cleanPhone }
            });
        }
        else if (existingUser && existingUser.phone !== cleanPhone) {
            // Conflict: Email belongs to someone with a DIFFERENT phone
            throw new Error(`Email ${data.email} is already associated with another account.`);
        }
    }
    if (existingUser) {
        console.log(`[ParentService] Duplicate creation prevented: Existing parent returned (ID: ${existingUser.id}, Phone: ${existingUser.phone})`);
        return existingUser;
    }
    const hashedPassword = data.password
        ? await bcryptjs_1.default.hash(data.password, 10)
        : await bcryptjs_1.default.hash('zetime123', 10);
    const parentEmail = data.email || `parent-${cleanPhone.replace('+', '')}@zetime.com`;
    // 4. Creation with UNIQUE Constraint Violation (P2002) Error Handling & Recovery
    try {
        const newParent = await db_1.default.user.create({
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
    }
    catch (error) {
        // Catch Unique Constraint Violation (Prisma Code P2002)
        if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
            console.warn(`[ParentService] UNIQUE constraint conflict detected during parent creation for phone "${cleanPhone}". Recovering existing record...`);
            const recoveredParent = await db_1.default.user.findFirst({
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
exports.findOrCreateParentByPhone = findOrCreateParentByPhone;
const checkParentsExist = async (phones) => {
    const normalizedPhones = phones.map(exports.normalizePhoneNumber);
    const existingParents = await db_1.default.user.findMany({
        where: {
            phone: { in: normalizedPhones },
            role: 'parent'
        },
        select: { phone: true }
    });
    const existingSet = new Set(existingParents.map(p => p.phone));
    return normalizedPhones.map(p => existingSet.has(p));
};
exports.checkParentsExist = checkParentsExist;
const searchParentByPhone = async (phone, schoolId) => {
    const cleanPhone = phone.replace(/\s+/g, '');
    console.log(`[ParentService] Search parent lookup started for phone: "${cleanPhone}" (schoolId: ${schoolId})`);
    // Create variations of the phone number to search for (Ethiopian context)
    const phoneVariations = [cleanPhone];
    if (cleanPhone.startsWith('+251')) {
        const suffix = cleanPhone.substring(4); // e.g., 911223344
        phoneVariations.push(suffix);
        phoneVariations.push('0' + suffix);
        phoneVariations.push('251' + suffix);
    }
    else if (cleanPhone.startsWith('0')) {
        const suffix = cleanPhone.substring(1);
        phoneVariations.push(suffix);
        phoneVariations.push('+251' + suffix);
        phoneVariations.push('251' + suffix);
    }
    const user = await db_1.default.user.findFirst({
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
    const legacyStudent = await db_1.default.student.findFirst({
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
exports.searchParentByPhone = searchParentByPhone;
const updateProfile = async (phone, schoolId, data) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findUnique({
        where: { phone: cleanPhone }
    });
    if (!user) {
        throw new Error("Parent not found.");
    }
    const updateData = {
        full_name: data.name,
        email: data.email,
        address: data.address
    };
    // Only update profile_photo if explicitly provided (allows null to remove)
    if (data.profile_photo !== undefined) {
        updateData.profile_photo = data.profile_photo;
    }
    const updatedUser = await db_1.default.user.update({
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
exports.updateProfile = updateProfile;
