"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserByResetToken = exports.resetPasswordByToken = exports.createPasswordResetToken = exports.verifyPassword = exports.deleteUser = exports.updateUser = exports.createUser = exports.getContacts = exports.getUsers = exports.getUserById = exports.getUserByEmail = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = __importDefault(require("../config/db"));
const getUserByEmail = async (email) => {
    return await db_1.default.user.findUnique({
        where: { email },
        include: { school: true }
    });
};
exports.getUserByEmail = getUserByEmail;
const getUserById = async (id, schoolId) => {
    const where = { id };
    if (schoolId)
        where.schoolId = schoolId;
    return await db_1.default.user.findFirst({
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
exports.getUserById = getUserById;
const getUsers = async (schoolId) => {
    if (!schoolId)
        throw new Error('School ID is required');
    return await db_1.default.user.findMany({
        where: { schoolId },
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
            lastActive: true
        },
        orderBy: { full_name: 'asc' }
    });
};
exports.getUsers = getUsers;
const getContacts = async (schoolId, currentUser) => {
    if (!schoolId)
        throw new Error('School ID is required');
    const allowedRoles = ['admin', 'school_admin', 'teacher', 'parent', 'staff'];
    const baseRoles = ['admin', 'school_admin', 'teacher', 'staff'];
    // 1. Fetch Users directly belonging to this school (Admins/Teachers)
    const staffAndAdmins = await db_1.default.user.findMany({
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
    const linkedParents = await db_1.default.user.findMany({
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
exports.getContacts = getContacts;
const createUser = async (data) => {
    let teacherId = data.teacher_id || null;
    const schoolId = data.schoolId || null;
    // Prevent duplicate phone for teachers within the same school (or globally if required)
    if (data.role === 'teacher' && data.phone) {
        const cleanPhone = data.phone.trim();
        const existing = await db_1.default.user.findFirst({
            where: { phone: cleanPhone, role: 'teacher', schoolId }
        });
        if (existing) {
            throw new Error('Phone already registered for another teacher in this school.');
        }
        data.phone = cleanPhone;
    }
    // Automatically create a corresponding Teacher record if role is 'teacher'
    if (data.role === 'teacher' && !teacherId && schoolId) {
        const teacher = await db_1.default.teacher.create({
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
        : bcryptjs_1.default.hashSync(rawPassword, 10);
    const user = await db_1.default.user.create({
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
            await db_1.default.teacher.update({
                where: { id: teacherId },
                data: { user_id: user.id }
            });
        }
        catch (e) {
            console.error("Failed to link user_id on teacher record:", e);
        }
    }
    return user;
};
exports.createUser = createUser;
const updateUser = async (id, data, schoolId) => {
    const updateData = {};
    if (data.full_name !== undefined)
        updateData.full_name = data.full_name;
    if (data.email !== undefined)
        updateData.email = data.email;
    // ... (rest of update logic)
    if (data.phone !== undefined) {
        const cleanPhone = data.phone.trim();
        const currentUser = await db_1.default.user.findUnique({ where: { id } });
        if (currentUser?.role === 'teacher' && cleanPhone) {
            const existing = await db_1.default.user.findFirst({
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
            : bcryptjs_1.default.hashSync(passToUpdate, 10);
    }
    if (data.is_active !== undefined)
        updateData.is_active = data.is_active;
    if (data.subject !== undefined)
        updateData.subject = data.subject;
    if (data.qualification !== undefined)
        updateData.qualification = data.qualification;
    if (data.experience_years !== undefined)
        updateData.experience_years = data.experience_years !== null ? Number(data.experience_years) : null;
    if (data.profile_photo !== undefined)
        updateData.profile_photo = data.profile_photo;
    // Enforce schoolId if provided
    const user = await db_1.default.user.update({
        where: { id, ...(schoolId && { schoolId }) },
        data: updateData
    });
    if (user.teacher_id && (data.full_name !== undefined || data.email !== undefined || data.phone !== undefined || data.subject !== undefined || data.qualification !== undefined || data.experience_years !== undefined || data.is_active !== undefined || data.profile_photo !== undefined)) {
        try {
            await db_1.default.teacher.update({
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
        }
        catch (e) {
            console.error("Failed to update linked teacher record:", e);
        }
    }
    return user;
};
exports.updateUser = updateUser;
const deleteUser = async (id, schoolId) => {
    const user = await db_1.default.user.findFirst({ where: { id, schoolId } });
    if (!user)
        throw new Error('User not found in this school');
    if (user.teacher_id) {
        try {
            await db_1.default.teacherAssignment.deleteMany({ where: { teacher_id: user.teacher_id } });
            await db_1.default.teacher.delete({ where: { id: user.teacher_id } });
        }
        catch (e) {
            console.error("Failed to delete linked teacher:", e);
        }
    }
    return await db_1.default.user.delete({ where: { id } });
};
exports.deleteUser = deleteUser;
const verifyPassword = (plain, hash) => {
    if (!hash || !hash.startsWith('$2')) {
        // Reject non-hashed passwords — all passwords must be bcrypt hashed
        return false;
    }
    try {
        return bcryptjs_1.default.compareSync(plain, hash);
    }
    catch {
        return false;
    }
};
exports.verifyPassword = verifyPassword;
const createPasswordResetToken = async (email) => {
    const user = await db_1.default.user.findUnique({ where: { email } });
    if (!user)
        return null;
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await db_1.default.user.update({
        where: { id: user.id },
        data: {
            reset_password_token: token,
            reset_password_expires: expires,
        },
    });
    return token;
};
exports.createPasswordResetToken = createPasswordResetToken;
const resetPasswordByToken = async (token, newPassword) => {
    const user = await db_1.default.user.findFirst({
        where: {
            reset_password_token: token,
            reset_password_expires: { gt: new Date() },
        },
    });
    if (!user) {
        throw new Error('Invalid or expired reset token');
    }
    const hashedPassword = !newPassword.startsWith('$2')
        ? bcryptjs_1.default.hashSync(newPassword, 10)
        : newPassword;
    await db_1.default.user.update({
        where: { id: user.id },
        data: {
            password_hash: hashedPassword,
            reset_password_token: null,
            reset_password_expires: null,
        },
    });
    return user;
};
exports.resetPasswordByToken = resetPasswordByToken;
const getUserByResetToken = async (token) => {
    return await db_1.default.user.findFirst({
        where: {
            reset_password_token: token,
            reset_password_expires: { gt: new Date() },
        },
    });
};
exports.getUserByResetToken = getUserByResetToken;
