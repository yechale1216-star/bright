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
exports.resetParentPasswordWithOTP = exports.verifyParentPasswordResetOTP = exports.initiateParentPasswordReset = exports.updateProfile = exports.searchParentByPhone = exports.checkParentsExist = exports.findOrCreateParentByPhone = exports.syncLegacyStudents = exports.normalizePhoneNumber = exports.updatePassword = exports.getSchoolAnnouncements = exports.updateAnnouncement = exports.postAnnouncement = exports.updatePreferences = exports.getPreferences = exports.markAllNotificationsAsRead = exports.deleteNotification = exports.markNotificationAsRead = exports.getNotifications = exports.loginParent = exports.getParentStudentsForSchool = exports.validateSchoolAccess = exports.getParentSchools = exports.listParentSchools = void 0;
const db_1 = __importDefault(require("../config/db"));
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt_1 = require("../utils/jwt");
const schoolService = __importStar(require("./school.service"));
const smsService = __importStar(require("./sms.service"));
const password_validator_1 = require("../utils/password-validator");
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
    await (0, exports.syncLegacyStudents)(user.id, cleanPhone);
    const schools = await (0, exports.getParentSchools)(user.id);
    return { success: true, data: schools };
};
exports.listParentSchools = listParentSchools;
/**
 * Get all schools a parent is linked to via their children.
 */
const getParentSchools = async (_userId) => {
    const singleSchool = await schoolService.getSingleSchool();
    return [{
            id: singleSchool.id,
            name: singleSchool.name || 'Addis Hiwot School',
            logo: singleSchool.settings?.school_logo || '',
            customSchoolId: singleSchool.schoolId || 'SCH-0001',
            role: 'parent'
        }];
};
exports.getParentSchools = getParentSchools;
/**
 * Validate that a parent has access.
 */
const validateSchoolAccess = async (_userId, _schoolId) => {
    return true;
};
exports.validateSchoolAccess = validateSchoolAccess;
/**
 * Get all students a parent has.
 */
const getParentStudentsForSchool = async (parentId, _schoolId) => {
    const links = await db_1.default.parentStudentLink.findMany({
        where: { parentId },
        include: {
            student: {
                include: { grade: true, section: true, stream: true }
            }
        }
    });
    return links
        .filter((l) => Boolean(l.student))
        .map((l) => ({
        ...l.student,
        name: l.student.fullName,
        grade: l.student.grade?.name || '',
        section: l.student.section?.name || '',
        stream: l.student.stream?.name || null,
        relationshipType: l.relationshipType || 'Guardian',
    }));
};
exports.getParentStudentsForSchool = getParentStudentsForSchool;
/**
 * Login Parent and establish session.
 */
const loginParent = async (phone, password, _schoolId) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findUnique({
        where: { phone: cleanPhone }
    });
    if (!user) {
        throw new Error("Invalid phone number or password.");
    }
    const isValidPassword = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!isValidPassword) {
        throw new Error("Invalid phone number or password.");
    }
    await (0, exports.syncLegacyStudents)(user.id, cleanPhone);
    const links = await db_1.default.parentStudentLink.findMany({
        where: { parentId: user.id },
        include: {
            student: {
                include: { grade: true, section: true, stream: true }
            }
        }
    });
    const students = links.map(l => l.student).filter(Boolean);
    if (students.length === 0) {
        throw new Error("No children profiles found associated with this account.");
    }
    const mappedStudents = links
        .filter((l) => Boolean(l.student))
        .map((l) => ({
        ...l.student,
        name: l.student.fullName,
        grade: l.student.grade?.name || '',
        section: l.student.section?.name || '',
        stream: l.student.stream?.name || null,
        relationshipType: l.relationshipType || 'Guardian',
    }));
    const singleSchool = await schoolService.getSingleSchool();
    const schoolName = singleSchool.name || 'Addis Hiwot School';
    const schoolLogo = singleSchool.settings?.school_logo || '';
    const customSchoolId = singleSchool.schoolId || 'SCH-0001';
    const token = (0, jwt_1.generateToken)({
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
exports.loginParent = loginParent;
/**
 * Get Parent Portal notifications.
 */
const getNotifications = async (phone, _schoolId, limit = 50) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findUnique({
        where: { phone: cleanPhone }
    });
    if (!user)
        return [];
    const links = await db_1.default.parentStudentLink.findMany({
        where: { parentId: user.id },
        select: { studentId: true }
    });
    const studentIds = links.map(l => l.studentId);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
    const notifications = await db_1.default.parentNotification.findMany({
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
        take: safeLimit,
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
const markNotificationAsRead = async (id, _schoolId) => {
    return await db_1.default.parentNotification.update({
        where: { id },
        data: { isRead: true }
    });
};
exports.markNotificationAsRead = markNotificationAsRead;
const deleteNotification = async (id, _schoolId) => {
    return await db_1.default.parentNotification.deleteMany({
        where: { id }
    });
};
exports.deleteNotification = deleteNotification;
const markAllNotificationsAsRead = async (phone, _schoolId) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findUnique({
        where: { phone: cleanPhone }
    });
    if (!user)
        return;
    const links = await db_1.default.parentStudentLink.findMany({
        where: { parentId: user.id },
        select: { studentId: true }
    });
    const studentIds = links.map(l => l.studentId);
    return await db_1.default.parentNotification.updateMany({
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
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
const getPreferences = async (phone, _schoolId) => {
    const cleanPhone = phone.replace(/\s+/g, '');
    return await db_1.default.parentPreferences.upsert({
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
exports.getPreferences = getPreferences;
const updatePreferences = async (phone, _schoolId, data) => {
    const cleanPhone = phone.replace(/\s+/g, '');
    return await db_1.default.parentPreferences.upsert({
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
exports.updatePreferences = updatePreferences;
const postAnnouncement = async (_schoolId, data) => {
    const rawAudience = (data.targetAudience || 'GENERAL').toUpperCase();
    const validAudience = ['GENERAL', 'PARENTS', 'STAFF'].includes(rawAudience) ? rawAudience : 'GENERAL';
    const result = await db_1.default.parentNotification.create({
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
        // Determine FCM type: emergency announcements use account_security for high-priority channel
        const fcmType = data.type === 'emergency' ? 'account_security' : 'new_announcement';
        const categoryLabel = data.type === 'emergency' ? 'Emergency Alert' : data.type === 'info' ? 'School Info' : 'Announcement';
        // ─── PARENTS ─────────────────────────────────────────────────────────────
        if (validAudience === 'PARENTS' || validAudience === 'GENERAL') {
            // Fetch all parents directly — not filtered by studentId (that's only for per-student posts)
            const parentUsers = data.studentId
                ? await db_1.default.parentStudentLink.findMany({
                    where: { studentId: data.studentId },
                    include: {
                        parent: {
                            select: { id: true, full_name: true, phone: true, pushToken: true }
                        }
                    }
                }).then(links => Array.from(new Map(links.filter(l => l.parent !== null).map(l => [l.parentId, l.parent])).values()))
                : await db_1.default.user.findMany({
                    where: { role: 'parent', is_active: true },
                    select: { id: true, full_name: true, phone: true, pushToken: true }
                });
            if (parentUsers.length > 0) {
                // Create in-app notification records for all parents
                await db_1.default.userNotification.createMany({
                    data: parentUsers.map((u) => ({
                        userId: u.id,
                        type: data.type === 'emergency' ? 'ALERT' : 'INFO',
                        category: 'ANNOUNCEMENT',
                        priority: data.type === 'emergency' ? 'HIGH' : 'NORMAL',
                        title: data.title,
                        message: data.message,
                        targetRole: 'PARENTS',
                        metadata: JSON.stringify({ announcementId: result.id, targetAudience: validAudience }),
                        isRead: false
                    })),
                    skipDuplicates: true
                });
                // Send FCM push to each parent with a valid token
                for (const parent of parentUsers) {
                    if (!parent || !parent.pushToken)
                        continue;
                    if (parent.phone) {
                        const prefs = await db_1.default.parentPreferences.findUnique({
                            where: { parentPhone: parent.phone }
                        });
                        if (prefs && !prefs.pushNotifications) {
                            console.log(`[AnnouncementService] Parent ${parent.id} has push disabled.`);
                            continue;
                        }
                    }
                    console.log(`[AnnouncementService] Sending announcement push to parent ${parent.id}`);
                    await sendCategoryNotification(parent.pushToken, {
                        type: fcmType,
                        title: schoolName,
                        body: `${data.title}: ${data.message}`,
                        route: '/parent/announcements',
                        schoolName,
                        categoryLabel,
                        tag: `announcement-${result.id}`
                    }).catch((err) => {
                        console.error(`Failed to send announcement push to parent ${parent.id}:`, err);
                    });
                }
            }
            if (io) {
                io.emit('new_notification', result);
            }
        }
        // ─── STAFF ────────────────────────────────────────────────────────────────
        if (validAudience === 'STAFF' || validAudience === 'GENERAL') {
            const staffUsers = await db_1.default.user.findMany({
                where: {
                    role: { not: 'parent' },
                    is_active: true
                },
                select: { id: true, pushToken: true, role: true }
            });
            if (staffUsers.length > 0) {
                await db_1.default.userNotification.createMany({
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
                    })),
                    skipDuplicates: true
                });
                for (const staff of staffUsers) {
                    if (staff.pushToken) {
                        console.log(`[AnnouncementService] Sending announcement push to staff ${staff.id}`);
                        await sendCategoryNotification(staff.pushToken, {
                            type: fcmType,
                            title: schoolName,
                            body: `${data.title}: ${data.message}`,
                            route: '/school/staff/announcements',
                            schoolName,
                            categoryLabel: data.type === 'emergency' ? 'Emergency Alert' : 'Staff Announcement',
                            tag: `announcement-${result.id}`
                        }).catch((err) => {
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
    }
    catch (e) {
        console.error('Failed to dispatch announcement push notifications:', e);
    }
    return result;
};
exports.postAnnouncement = postAnnouncement;
const updateAnnouncement = async (id, _schoolId, data) => {
    const updateData = {
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
    return await db_1.default.parentNotification.update({
        where: { id },
        data: updateData
    });
};
exports.updateAnnouncement = updateAnnouncement;
const getSchoolAnnouncements = async (_schoolId, userRole, limit) => {
    let audienceCondition = undefined;
    if (userRole === 'parent') {
        audienceCondition = {
            OR: [
                { targetAudience: { in: ['GENERAL', 'PARENTS', 'general', 'parents'] } },
                { targetAudience: null }
            ]
        };
    }
    else if (['admin', 'school_admin', 'super_admin'].includes(userRole || '')) {
        audienceCondition = undefined;
    }
    else {
        audienceCondition = {
            OR: [
                { targetAudience: { in: ['GENERAL', 'STAFF', 'general', 'staff'] } },
                { targetAudience: null }
            ]
        };
    }
    const whereClause = {
        type: { in: ["announcement", "emergency", "info"] },
        studentId: null,
        ...(audienceCondition ? audienceCondition : {})
    };
    return await db_1.default.parentNotification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        ...(limit ? { take: Number(limit) } : {})
    });
};
exports.getSchoolAnnouncements = getSchoolAnnouncements;
const updatePassword = async (phone, currentPassword, newPassword, _schoolId) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findFirst({
        where: {
            OR: [
                { phone: cleanPhone },
                { phone: phone.replace(/\s+/g, '') }
            ]
        }
    });
    if (!user)
        throw new Error("User not found.");
    const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
    if (!isValidPassword)
        throw new Error("Incorrect current password.");
    const val = (0, password_validator_1.validatePassword)(newPassword);
    if (!val.isValid)
        throw new Error(val.error);
    const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
    await db_1.default.user.update({
        where: { id: user.id },
        data: { password_hash: hashedPassword }
    });
    return { success: true, message: "Password updated successfully." };
};
exports.updatePassword = updatePassword;
const normalizePhoneNumber = (phone) => {
    if (!phone)
        return "";
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '+251' + cleaned.substring(1);
    }
    else if (cleaned.startsWith('251') && !cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    else if (!cleaned.startsWith('+') && cleaned.length > 0) {
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
exports.normalizePhoneNumber = normalizePhoneNumber;
const syncLegacyStudents = async (userId, phone) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const variations = new Set();
    variations.add(cleanPhone);
    const rawNoPlus = cleanPhone.replace('+', '');
    variations.add(rawNoPlus);
    let suffix = '';
    if (cleanPhone.startsWith('+251') && cleanPhone.length >= 13) {
        suffix = cleanPhone.substring(cleanPhone.length - 9);
    }
    else if (cleanPhone.length >= 9) {
        suffix = cleanPhone.substring(cleanPhone.length - 9);
    }
    if (suffix) {
        variations.add(suffix);
        variations.add('0' + suffix);
        variations.add('251' + suffix);
    }
    const legacyStudents = await db_1.default.student.findMany({
        where: {
            OR: [
                { parent_phone: { in: Array.from(variations) } },
                ...(suffix ? [{ parent_phone: { contains: suffix } }] : [])
            ]
        }
    });
    const matchedStudents = legacyStudents.filter(s => {
        if (!s.parent_phone)
            return false;
        const dbPhoneCleaned = s.parent_phone.replace(/[^\d+]/g, '');
        return variations.has(dbPhoneCleaned) || Boolean(suffix && dbPhoneCleaned.endsWith(suffix));
    });
    for (const student of matchedStudents) {
        await db_1.default.parentStudentLink.upsert({
            where: { parentId_studentId: { parentId: userId, studentId: student.id } },
            update: {},
            create: { parentId: userId, studentId: student.id }
        });
    }
    return matchedStudents;
};
exports.syncLegacyStudents = syncLegacyStudents;
const findOrCreateParentByPhone = async (phone, data) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    let existingUser = await db_1.default.user.findUnique({
        where: { phone: cleanPhone }
    });
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
        if (existingUser) {
            existingUser = await db_1.default.user.update({
                where: { id: existingUser.id },
                data: { phone: cleanPhone }
            });
        }
    }
    if (!existingUser && data.email) {
        existingUser = await db_1.default.user.findUnique({
            where: { email: data.email }
        });
        if (existingUser && !existingUser.phone) {
            existingUser = await db_1.default.user.update({
                where: { id: existingUser.id },
                data: { phone: cleanPhone }
            });
        }
        else if (existingUser && existingUser.phone !== cleanPhone) {
            throw new Error(`Email ${data.email} is already associated with another account.`);
        }
    }
    if (existingUser) {
        return existingUser;
    }
    // Generate a cryptographically random temporary password.
    // Parents who need to log in must use the SMS OTP password reset flow
    // to set their own password — there is no shared well-known default.
    const randomTemp = crypto_1.default.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
    const hashedPassword = data.password
        ? await bcryptjs_1.default.hash(data.password, 10)
        : await bcryptjs_1.default.hash(randomTemp, 10);
    const parentEmail = data.email || `parent-${cleanPhone.replace('+', '')}@addishiwot.edu.et`;
    try {
        const newParent = await db_1.default.user.create({
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
    }
    catch (error) {
        if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
            const recoveredParent = await db_1.default.user.findFirst({
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
const searchParentByPhone = async (phone, _schoolId) => {
    const cleanPhone = phone.replace(/\s+/g, '');
    const phoneVariations = [cleanPhone];
    if (cleanPhone.startsWith('+251')) {
        const suffix = cleanPhone.substring(4);
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
        select: { id: true, full_name: true, email: true, phone: true, address: true }
    });
    if (user) {
        return { success: true, data: user };
    }
    const legacyStudent = await db_1.default.student.findFirst({
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
exports.searchParentByPhone = searchParentByPhone;
const updateProfile = async (phone, _schoolId, data) => {
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
/**
 * Initiate password reset for parent via phone OTP.
 * Returns true regardless of existence to prevent enumeration.
 */
const initiateParentPasswordReset = async (phone) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findUnique({ where: { phone: cleanPhone } });
    // Always succeed to avoid leaking existence
    if (!user) {
        // Simulate delay
        await new Promise(res => setTimeout(res, 100));
        return { success: true };
    }
    const verificationCode = crypto_1.default.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await db_1.default.user.update({
        where: { id: user.id },
        data: {
            reset_password_token: verificationCode,
            reset_password_expires: expires,
        },
    });
    // Dispatch real SMS via SMSEthiopia
    const smsResult = await smsService.sendParentPasswordResetOTP(cleanPhone, verificationCode);
    console.log(`[ParentPasswordReset] SMSEthiopia dispatch to ${cleanPhone}:`, smsResult.success ? 'Success' : `Failed (${smsResult.error})`);
    return { success: true };
};
exports.initiateParentPasswordReset = initiateParentPasswordReset;
/**
 * Verify OTP for parent password reset.
 */
const verifyParentPasswordResetOTP = async (phone, code) => {
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findFirst({
        where: {
            phone: cleanPhone,
            reset_password_token: code,
            reset_password_expires: { gt: new Date() },
        },
    });
    if (!user)
        return false;
    // OTP is intentionally NOT cleared here because the client calls this endpoint
    // to confirm the code, then immediately calls resetParentPasswordWithOTP.
    // The OTP is cleared unconditionally in resetParentPasswordWithOTP after the
    // password is successfully changed, preventing reuse.
    return true;
};
exports.verifyParentPasswordResetOTP = verifyParentPasswordResetOTP;
/**
 * Reset the parent's password using verified OTP.
 */
const resetParentPasswordWithOTP = async (phone, code, newPassword) => {
    const val = (0, password_validator_1.validatePassword)(newPassword);
    if (!val.isValid) {
        throw new Error(val.error);
    }
    const cleanPhone = (0, exports.normalizePhoneNumber)(phone);
    const user = await db_1.default.user.findFirst({
        where: {
            phone: cleanPhone,
            reset_password_token: code,
            reset_password_expires: { gt: new Date() },
        },
    });
    if (!user) {
        throw new Error('Invalid or expired verification code.');
    }
    const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
    await db_1.default.user.update({
        where: { id: user.id },
        data: {
            password_hash: hashedPassword,
            // Always clear the OTP after a successful reset to prevent reuse
            reset_password_token: null,
            reset_password_expires: null,
        },
    });
    return { success: true, message: 'Password reset successfully.' };
};
exports.resetParentPasswordWithOTP = resetParentPasswordWithOTP;
