"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.getUserByResetToken = exports.resetPasswordByToken = exports.createPasswordResetToken = exports.verifyPassword = exports.deleteUser = exports.updateUser = exports.createUser = exports.getContacts = exports.getUsers = exports.getUserById = exports.getUserByEmailWithPassword = exports.getUserByEmail = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = __importDefault(require("../config/db"));
const password_validator_1 = require("../utils/password-validator");
const getUserByEmail = async (email) => {
    // Intentionally excludes password_hash to prevent accidental serialization
    return await db_1.default.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            full_name: true,
            role: true,
            is_active: true,
            is_verified: true,
            profile_photo: true,
            phone: true,
            teacher_id: true,
            pushToken: true,
        }
    });
};
exports.getUserByEmail = getUserByEmail;
/** Fetch full user record including password_hash (internal auth use only) */
const getUserByEmailWithPassword = async (email) => {
    return await db_1.default.user.findUnique({ where: { email } });
};
exports.getUserByEmailWithPassword = getUserByEmailWithPassword;
const getUserById = async (id, _schoolId) => {
    return await db_1.default.user.findUnique({
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
exports.getUserById = getUserById;
const getUsers = async (_schoolId) => {
    return await db_1.default.user.findMany({
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
exports.getUsers = getUsers;
const getContacts = async (_schoolId, currentUser) => {
    const baseRoles = ['admin', 'school_admin', 'teacher', 'staff'];
    const staffAndAdmins = await db_1.default.user.findMany({
        where: {
            role: { in: baseRoles },
            is_active: true
        },
        select: {
            id: true,
            full_name: true,
            profile_photo: true,
            role: true,
            phone: true,
            email: true,
            is_active: true
        },
        orderBy: { full_name: 'asc' }
    });
    // If the user is a parent, they only need to reach staff and admins (avoid querying all parents in DB)
    if (currentUser?.role === 'parent') {
        return staffAndAdmins
            .filter(u => u.id !== currentUser?.id)
            .sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    // For staff/admin users, fetch active parents with a safe limit
    const linkedParents = await db_1.default.user.findMany({
        where: {
            role: 'parent',
            is_active: true
        },
        select: {
            id: true,
            full_name: true,
            profile_photo: true,
            role: true,
            phone: true,
            email: true,
            is_active: true
        },
        take: 500,
        orderBy: { full_name: 'asc' }
    });
    const allContacts = [...staffAndAdmins, ...linkedParents];
    const uniqueContacts = Array.from(new Map(allContacts.map(item => [item.id, item])).values());
    const finalContacts = uniqueContacts.filter(u => u.id !== currentUser?.id);
    return finalContacts.sort((a, b) => a.full_name.localeCompare(b.full_name));
};
exports.getContacts = getContacts;
const createUser = async (data) => {
    let teacherId = data.teacher_id || null;
    if (data.role === 'teacher' && data.phone) {
        const cleanPhone = data.phone.trim();
        const existing = await db_1.default.user.findFirst({
            where: { phone: cleanPhone, role: 'teacher' }
        });
        if (existing) {
            throw new Error('Phone already registered for another teacher.');
        }
        data.phone = cleanPhone;
    }
    if (data.role === 'teacher' && !teacherId) {
        const teacher = await db_1.default.teacher.create({
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
    // Generate a cryptographically random temporary password if none supplied.
    // This prevents all auto-created accounts from sharing a well-known default.
    let rawPassword = data.password_hash || data.password;
    if (rawPassword) {
        if (!rawPassword.startsWith('$2')) {
            const val = (0, password_validator_1.validatePassword)(rawPassword);
            if (!val.isValid) {
                throw new Error(val.error);
            }
        }
    }
    else {
        rawPassword = (0, password_validator_1.generateCompliantPassword)();
    }
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
const updateUser = async (id, data, _schoolId) => {
    const currentUser = await db_1.default.user.findFirst({
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
    const updateData = {};
    if (data.full_name !== undefined)
        updateData.full_name = data.full_name;
    if (data.email !== undefined)
        updateData.email = data.email;
    if (data.phone !== undefined) {
        const cleanPhone = data.phone.trim();
        if (currentUser.role === 'teacher' && cleanPhone) {
            const existing = await db_1.default.user.findFirst({
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
        if (!passToUpdate.startsWith('$2')) {
            const val = (0, password_validator_1.validatePassword)(passToUpdate);
            if (!val.isValid) {
                throw new Error(val.error);
            }
        }
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
    const user = await db_1.default.user.update({
        where: { id: targetUserId },
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
const deleteUser = async (id, _schoolId) => {
    const user = await db_1.default.user.findUnique({ where: { id } });
    if (!user)
        throw new Error('User not found');
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
    const val = (0, password_validator_1.validatePassword)(newPassword);
    if (!val.isValid) {
        throw new Error(val.error);
    }
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
const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await db_1.default.user.findFirst({
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
    // Verify current password against stored hash
    if (!currentPassword) {
        throw new Error('Current password is required.');
    }
    const isMatch = (0, exports.verifyPassword)(currentPassword, user.password_hash);
    if (!isMatch) {
        throw new Error('Current password is incorrect.');
    }
    const val = (0, password_validator_1.validatePassword)(newPassword);
    if (!val.isValid) {
        throw new Error(val.error);
    }
    if (!newPassword) {
        throw new Error('New password is required.');
    }
    const hashedPassword = !newPassword.startsWith('$2')
        ? bcryptjs_1.default.hashSync(newPassword, 10)
        : newPassword;
    await db_1.default.user.update({
        where: { id: user.id },
        data: {
            password_hash: hashedPassword,
        },
    });
    return { success: true };
};
exports.changePassword = changePassword;
