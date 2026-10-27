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
exports.getStudentsByParentPhone = exports.deleteStudent = exports.updateStudent = exports.getStudentById = exports.bulkUpsertStudents = exports.generateStudentId = exports.createStudent = exports.bulkGenerateActivationCodes = exports.generateActivationCode = exports.getNextStudentId = exports.getStudentCount = exports.getAllStudents = void 0;
const db_1 = __importDefault(require("../config/db"));
const parentService = __importStar(require("./parent.service"));
const academic_year_service_1 = require("./academic-year.service");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Map database relational model to flat frontend model
const mapStudentToFlat = (student) => {
    if (!student)
        return null;
    const link = student.parentStudents && student.parentStudents.length > 0 ? student.parentStudents[0] : null;
    return {
        ...student,
        name: student.fullName,
        grade: student.grade?.name || '',
        section: student.section?.name || '',
        stream: student.stream?.name || null,
        relationshipType: link?.relationshipType || student.relationshipType || 'Guardian',
        lifecycleEffectiveDate: student.lifecycleEffectiveDate || null,
        suspensionEndDate: student.suspensionEndDate || null,
        destinationSchool: student.destinationSchool || null,
        statusReason: student.statusReason || null,
    };
};
const getAllStudents = async (_schoolId, search, status, gradeId, sectionId, streamId, academicYear, pagination) => {
    const page = pagination?.page ? Math.max(Number(pagination.page), 1) : 1;
    const limit = pagination?.limit ? Math.min(Math.max(Number(pagination.limit), 1), 500) : undefined;
    const skip = limit !== undefined ? (page - 1) * limit : undefined;
    const currentAY = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
    let targetAcademicYearName = academicYear?.trim();
    if (!targetAcademicYearName || targetAcademicYearName.toLowerCase() === 'current' || targetAcademicYearName.toLowerCase() === 'active') {
        targetAcademicYearName = currentAY?.name || '';
    }
    const targetAY = await db_1.default.academicYear.findUnique({
        where: { name: targetAcademicYearName }
    }) || currentAY;
    if (targetAY) {
        const enrollmentWhere = {
            academicYearId: targetAY.id,
        };
        if (status && status.trim()) {
            const s = status.trim().toUpperCase();
            if (s !== 'ALL') {
                enrollmentWhere.status = s;
            }
        }
        else {
            enrollmentWhere.status = 'ACTIVE';
        }
        if (gradeId && gradeId.trim() && gradeId.trim() !== 'all' && gradeId.trim() !== 'All Grades') {
            const gTerm = gradeId.trim();
            const gNum = gTerm.replace(/[^\d]/g, '');
            enrollmentWhere.grade = {
                OR: [
                    { id: gTerm },
                    { name: { equals: gTerm, mode: 'insensitive' } },
                    ...(gNum ? [{ name: { contains: gNum, mode: 'insensitive' } }] : [])
                ]
            };
        }
        if (sectionId && sectionId.trim() && sectionId.trim() !== 'all' && sectionId.trim() !== 'All Sections') {
            const secTerm = sectionId.trim();
            enrollmentWhere.section = {
                OR: [
                    { id: secTerm },
                    { name: { equals: secTerm, mode: 'insensitive' } }
                ]
            };
        }
        if (streamId && streamId.trim() && streamId.trim() !== 'all' && streamId.trim() !== 'All Streams' && streamId.trim() !== 'none') {
            const strTerm = streamId.trim();
            enrollmentWhere.stream = {
                OR: [
                    { id: strTerm },
                    { name: { equals: strTerm, mode: 'insensitive' } }
                ]
            };
        }
        if (search && search.trim()) {
            const term = search.trim();
            enrollmentWhere.student = {
                OR: [
                    { fullName: { contains: term, mode: 'insensitive' } },
                    { student_id: { contains: term, mode: 'insensitive' } }
                ]
            };
        }
        const [enrollments, total] = await Promise.all([
            db_1.default.studentAcademicYearRecord.findMany({
                where: enrollmentWhere,
                include: {
                    student: {
                        include: {
                            parentStudents: true
                        }
                    },
                    grade: true,
                    section: true,
                    stream: true,
                },
                orderBy: { student: { fullName: 'asc' } },
                ...(limit !== undefined ? { take: limit, skip } : {})
            }),
            limit !== undefined ? db_1.default.studentAcademicYearRecord.count({ where: enrollmentWhere }) : Promise.resolve(0)
        ]);
        const mapped = enrollments.map((enr) => {
            const relType = enr.student?.parentStudents?.[0]?.relationshipType;
            return {
                ...enr.student,
                name: enr.student?.fullName,
                grade: enr.grade?.name || '',
                section: enr.section?.name || '',
                stream: enr.stream?.name || null,
                gradeId: enr.gradeId,
                sectionId: enr.sectionId,
                streamId: enr.streamId,
                enrollmentStatus: enr.status,
                academicYearRecordId: enr.id,
                relationshipType: relType || 'Guardian',
            };
        });
        if (limit !== undefined) {
            return {
                items: mapped,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        }
        return mapped;
    }
    const where = {};
    if (status && status.trim()) {
        const s = status.trim().toUpperCase();
        if (s !== 'ALL')
            where.status = { equals: s, mode: 'insensitive' };
    }
    else {
        where.status = 'ACTIVE';
    }
    if (search && search.trim()) {
        const term = search.trim();
        where.AND = where.AND || [];
        where.AND.push({ OR: [{ fullName: { contains: term, mode: 'insensitive' } }, { student_id: { contains: term, mode: 'insensitive' } }] });
    }
    const [students, total] = await Promise.all([
        db_1.default.student.findMany({
            where,
            include: {
                grade: true,
                section: true,
                stream: true,
                parentStudents: true,
                promotions: { orderBy: { promotedAt: 'desc' }, take: 1 }
            },
            orderBy: { fullName: 'asc' },
            ...(limit !== undefined ? { take: limit, skip } : {})
        }),
        limit !== undefined ? db_1.default.student.count({ where }) : Promise.resolve(0)
    ]);
    const mapped = students.map(mapStudentToFlat);
    if (limit !== undefined) {
        return {
            items: mapped,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
    return mapped;
};
exports.getAllStudents = getAllStudents;
const getStudentCount = async (status = 'ACTIVE', academicYear) => {
    const currentAY = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
    let targetAcademicYearName = academicYear?.trim();
    if (!targetAcademicYearName || targetAcademicYearName.toLowerCase() === 'current' || targetAcademicYearName.toLowerCase() === 'active') {
        targetAcademicYearName = currentAY?.name || '';
    }
    const targetAY = await db_1.default.academicYear.findUnique({
        where: { name: targetAcademicYearName }
    }) || currentAY;
    if (targetAY) {
        return await db_1.default.studentAcademicYearRecord.count({
            where: {
                academicYearId: targetAY.id,
                ...(status && status !== 'ALL' ? { status: status.toUpperCase() } : {})
            }
        });
    }
    return await db_1.default.student.count({
        where: {
            ...(status && status !== 'ALL' ? { status: status.toUpperCase() } : {})
        }
    });
};
exports.getStudentCount = getStudentCount;
const getNextStudentId = async (_schoolId) => {
    const idPrefix = 'STU';
    const latestStudent = await db_1.default.student.findFirst({
        where: {
            student_id: { startsWith: idPrefix }
        },
        orderBy: { student_id: 'desc' },
        select: { student_id: true }
    });
    let nextSequence = 1;
    if (latestStudent && latestStudent.student_id) {
        const currentSequence = parseInt(latestStudent.student_id.substring(idPrefix.length), 10);
        if (!isNaN(currentSequence)) {
            nextSequence = currentSequence + 1;
        }
    }
    return `${idPrefix}${nextSequence.toString().padStart(6, '0')}`;
};
exports.getNextStudentId = getNextStudentId;
// ─── ACTIVATION CODE MANAGEMENT ───────────────────────────────────────────────
/**
 * Generate (or regenerate) a one-time activation code for a student.
 * Called by staff from the admin portal.
 * Returns all data needed to print an activation slip.
 */
const generateActivationCode = async (studentId) => {
    const student = await db_1.default.student.findUnique({
        where: { id: studentId },
        include: { grade: true, section: true, user: true },
    });
    if (!student)
        throw new Error('Student not found.');
    // Prevent regenerating code for already activated accounts
    if (student.accountStatus === 'ACTIVE') {
        throw new Error('This student account is already active. Activation codes cannot be regenerated for active accounts.');
    }
    // Generate a random 8-char uppercase alphanumeric code
    const { randomBytes } = await Promise.resolve().then(() => __importStar(require('crypto')));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable chars (0,O,1,I)
    const bytes = randomBytes(8);
    const code = Array.from(bytes).map((b) => chars[b % chars.length]).join('');
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const hashedCode = await bcryptjs_1.default.hash(code, 10);
    // Invalidate previous code and store new cryptographic hash securely
    await db_1.default.student.update({
        where: { id: studentId },
        data: {
            activation_code: hashedCode,
            activation_code_expires: expires,
            accountStatus: 'PENDING_ACTIVATION',
        },
    });
    return {
        student_id: student.student_id,
        fullName: student.fullName,
        grade: student.grade?.name || '',
        section: student.section?.name || '',
        activationCode: code,
        expiresAt: expires,
    };
};
exports.generateActivationCode = generateActivationCode;
/**
 * Bulk generate activation codes for all PENDING_ACTIVATION students in a grade/section.
 */
const bulkGenerateActivationCodes = async (gradeId, sectionId) => {
    const where = { accountStatus: 'PENDING_ACTIVATION' };
    if (gradeId)
        where.gradeId = gradeId;
    if (sectionId)
        where.sectionId = sectionId;
    const students = await db_1.default.student.findMany({
        where,
        include: { grade: true, section: true },
    });
    const results = [];
    for (const student of students) {
        const slip = await (0, exports.generateActivationCode)(student.id);
        results.push(slip);
    }
    return results;
};
exports.bulkGenerateActivationCodes = bulkGenerateActivationCodes;
const createStudent = async (data, _schoolId) => {
    let studentId = data.student_id;
    if (!studentId) {
        studentId = await (0, exports.getNextStudentId)();
    }
    // 1. Resolve Grade
    let gradeId = data.gradeId;
    let grade = null;
    if (gradeId) {
        grade = await db_1.default.grade.findUnique({ where: { id: gradeId } });
    }
    else if (data.grade) {
        const gName = String(data.grade).trim();
        grade = await db_1.default.grade.upsert({
            where: { name: gName },
            update: {},
            create: { name: gName },
        });
        gradeId = grade.id;
    }
    if (!grade) {
        throw new Error('Grade Level is required.');
    }
    const gradeName = (grade.name || '').toLowerCase();
    const isSeniorSecondary = gradeName.includes('11') || gradeName.includes('12');
    // 2. Resolve Stream
    let streamId = null;
    if (isSeniorSecondary) {
        if (data.streamId) {
            const st = await db_1.default.stream.findUnique({ where: { id: data.streamId } });
            if (!st)
                throw new Error('Selected academic stream not found.');
            streamId = st.id;
        }
        else if (data.stream) {
            const stName = String(data.stream).trim();
            const st = await db_1.default.stream.upsert({
                where: { name: stName },
                update: {},
                create: { name: stName },
            });
            streamId = st.id;
        }
        else {
            throw new Error(`Academic stream (Natural Science or Social Science) is mandatory for ${grade.name}.`);
        }
    }
    else {
        streamId = null;
    }
    // 3. Resolve Section
    let sectionId = data.sectionId;
    let section = null;
    if (sectionId) {
        section = await db_1.default.section.findUnique({ where: { id: sectionId } });
        if (!section)
            throw new Error('Selected section not found.');
        if (section.gradeId !== grade.id) {
            throw new Error(`Section "${section.name}" does not belong to ${grade.name}.`);
        }
        if (isSeniorSecondary && section.streamId && streamId && section.streamId !== streamId) {
            throw new Error('Section does not belong to the selected stream.');
        }
    }
    else if (data.section) {
        const secName = String(data.section).trim();
        section = await db_1.default.section.findFirst({
            where: {
                gradeId: grade.id,
                streamId,
                name: { equals: secName, mode: 'insensitive' },
            },
        });
        if (!section) {
            section = await db_1.default.section.create({
                data: {
                    name: secName,
                    gradeId: grade.id,
                    streamId,
                },
            });
        }
        sectionId = section.id;
    }
    if (!sectionId || !section) {
        throw new Error('Section is mandatory for student registration.');
    }
    // Prevent duplicate student ID registrations
    const existingStudent = await db_1.default.student.findUnique({
        where: { student_id: studentId },
    });
    if (existingStudent) {
        throw new Error(`A student with Student ID "${studentId}" already exists.`);
    }
    // Generate unique 8-char activation code
    const { randomBytes } = await Promise.resolve().then(() => __importStar(require('crypto')));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(8);
    const activationCode = Array.from(bytes).map((b) => chars[b % chars.length]).join('');
    const hashedActivationCode = await bcryptjs_1.default.hash(activationCode, 10);
    const activationExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    // Create student with PENDING_ACTIVATION and no usable login credential until activation
    const newStudent = await db_1.default.student.create({
        data: {
            fullName: data.name,
            student_id: studentId,
            parent_email: data.parent_email || "",
            parent_phone: data.parent_phone || "",
            parent_name: data.parent_name || "",
            gender: data.gender,
            date_of_birth: data.date_of_birth,
            address: data.address || null,
            gradeId: grade.id,
            sectionId: section.id,
            streamId: streamId,
            accountStatus: 'PENDING_ACTIVATION',
            activation_code: hashedActivationCode,
            activation_code_expires: activationExpires,
            user_id: null,
        },
        include: {
            grade: true,
            section: true,
            stream: true,
        },
    });
    try {
        const activeAY = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
        if (activeAY) {
            await db_1.default.studentAcademicYearRecord.upsert({
                where: { studentId_academicYearId: { studentId: newStudent.id, academicYearId: activeAY.id } },
                create: {
                    studentId: newStudent.id,
                    academicYearId: activeAY.id,
                    gradeId: newStudent.gradeId,
                    sectionId: newStudent.sectionId,
                    streamId: newStudent.streamId,
                    status: 'ACTIVE',
                },
                update: {
                    gradeId: newStudent.gradeId,
                    sectionId: newStudent.sectionId,
                    streamId: newStudent.streamId,
                    status: 'ACTIVE',
                }
            });
        }
    }
    catch (err) {
        console.error('[StudentService] Failed to create StudentAcademicYearRecord:', err);
    }
    let parent = null;
    if (data.existingParentId) {
        parent = await db_1.default.user.findUnique({ where: { id: data.existingParentId } });
    }
    if (!parent && data.parent_phone) {
        parent = await parentService.findOrCreateParentByPhone(data.parent_phone, {
            name: data.parent_name,
            email: data.parent_email,
            password: data.parent_password,
            address: data.parent_address,
        });
    }
    let linkRecord = null;
    if (parent) {
        linkRecord = await db_1.default.parentStudentLink.upsert({
            where: {
                parentId_studentId: {
                    parentId: parent.id,
                    studentId: newStudent.id
                }
            },
            update: {
                relationshipType: data.relationshipType || 'Guardian',
            },
            create: {
                parentId: parent.id,
                studentId: newStudent.id,
                relationshipType: data.relationshipType || 'Guardian'
            }
        });
    }
    try {
        const adminUsers = await db_1.default.user.findMany({
            where: { role: 'school_admin' },
            select: { id: true }
        });
        if (adminUsers.length > 0) {
            await db_1.default.userNotification.createMany({
                data: adminUsers.map((admin) => ({
                    userId: admin.id,
                    title: '🎓 New Student Registered',
                    message: `${newStudent.fullName} (${newStudent.student_id}) has been enrolled in ${newStudent.grade?.name || 'a grade'} by the registrar.`,
                    type: 'NEW_STUDENT',
                    isRead: false,
                })),
                skipDuplicates: true,
            });
        }
    }
    catch (notifErr) {
        console.error('[StudentService] Failed to send admin notification for new student:', notifErr);
    }
    const activationSlip = {
        student_id: newStudent.student_id,
        fullName: newStudent.fullName,
        grade: newStudent.grade?.name || '',
        section: newStudent.section?.name || '',
        activationCode,
        expiresAt: activationExpires,
    };
    return {
        ...mapStudentToFlat(newStudent),
        relationshipType: data.relationshipType || linkRecord?.relationshipType || 'Guardian',
        accountStatus: 'PENDING_ACTIVATION',
        activationCode,
        activation_code: activationCode,
        activation_code_expires: activationExpires,
        activationSlip,
    };
};
exports.createStudent = createStudent;
const generateStudentId = async (_schoolId) => {
    return await (0, exports.getNextStudentId)();
};
exports.generateStudentId = generateStudentId;
const bulkUpsertStudents = async (students, _schoolId) => {
    const results = { created: 0, updated: 0, errors: [] };
    let autoGenSequenceOffset = 0;
    const idPrefix = 'STU';
    const latestStudent = await db_1.default.student.findFirst({
        where: {
            student_id: { startsWith: idPrefix }
        },
        orderBy: { student_id: 'desc' },
        select: { student_id: true }
    });
    let nextBaseSequence = 1;
    if (latestStudent && latestStudent.student_id) {
        const currentSequence = parseInt(latestStudent.student_id.substring(idPrefix.length), 10);
        if (!isNaN(currentSequence)) {
            nextBaseSequence = currentSequence + 1;
        }
    }
    for (let i = 0; i < students.length; i++) {
        const data = students[i];
        try {
            let studentId = data.student_id ? String(data.student_id).trim() : null;
            if (!studentId) {
                studentId = `${idPrefix}${(nextBaseSequence + autoGenSequenceOffset).toString().padStart(6, '0')}`;
                autoGenSequenceOffset++;
            }
            const gradeName = String(data.grade).trim();
            const gradeNum = parseInt(gradeName);
            if (!isNaN(gradeNum)) {
                if (gradeNum >= 11 && !data.stream) {
                    throw new Error(`Stream selection (Natural/Social Science) is required for Grade ${gradeName}`);
                }
                if (gradeNum <= 10 && data.stream) {
                    data.stream = null;
                }
            }
            const grade = await db_1.default.grade.upsert({
                where: { name: data.grade },
                update: {},
                create: { name: data.grade }
            });
            let streamId = null;
            if (data.stream) {
                const stream = await db_1.default.stream.upsert({
                    where: { name: data.stream },
                    update: {},
                    create: { name: data.stream }
                });
                streamId = stream.id;
            }
            const secName = (data.section || 'A').trim();
            let section = await db_1.default.section.findFirst({
                where: {
                    gradeId: grade.id,
                    streamId: streamId,
                    name: { equals: secName, mode: 'insensitive' }
                }
            });
            if (!section) {
                section = await db_1.default.section.create({
                    data: {
                        name: secName,
                        gradeId: grade.id,
                        streamId: streamId
                    }
                });
            }
            const existingStudent = await db_1.default.student.findUnique({
                where: { student_id: studentId }
            });
            const student = await db_1.default.student.upsert({
                where: { student_id: studentId },
                update: {
                    fullName: data.name,
                    parent_email: data.parent_email || "",
                    parent_phone: data.parent_phone || "",
                    parent_name: data.parent_name || "",
                    gender: data.gender || null,
                    date_of_birth: data.date_of_birth || null,
                    address: data.address || null,
                    gradeId: grade.id,
                    sectionId: section.id,
                    streamId: streamId || null
                },
                create: {
                    student_id: studentId,
                    fullName: data.name,
                    parent_email: data.parent_email || "",
                    parent_phone: data.parent_phone || "",
                    parent_name: data.parent_name || "",
                    gender: data.gender || null,
                    date_of_birth: data.date_of_birth || null,
                    address: data.address || null,
                    gradeId: grade.id,
                    sectionId: section.id,
                    streamId: streamId || null
                }
            });
            if (existingStudent) {
                results.updated++;
            }
            else {
                results.created++;
                try {
                    const { randomBytes } = await Promise.resolve().then(() => __importStar(require('crypto')));
                    const bChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    const bBytes = randomBytes(8);
                    const bCode = Array.from(bBytes).map((b) => bChars[b % bChars.length]).join('');
                    const bHashedCode = await bcryptjs_1.default.hash(bCode, 10);
                    const bExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    await db_1.default.student.update({
                        where: { id: student.id },
                        data: {
                            accountStatus: 'PENDING_ACTIVATION',
                            activation_code: bHashedCode,
                            activation_code_expires: bExpires,
                            user_id: null,
                        },
                    });
                }
                catch (actErr) {
                    console.error(`[StudentService] Failed to auto-generate activation for bulk student ${student.id}:`, actErr);
                }
            }
            try {
                const activeAY = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
                if (activeAY) {
                    await db_1.default.studentAcademicYearRecord.upsert({
                        where: { studentId_academicYearId: { studentId: student.id, academicYearId: activeAY.id } },
                        create: {
                            studentId: student.id,
                            academicYearId: activeAY.id,
                            gradeId: grade.id,
                            sectionId: section.id,
                            streamId: streamId || null,
                            status: 'ACTIVE',
                        },
                        update: {
                            gradeId: grade.id,
                            sectionId: section.id,
                            streamId: streamId || null,
                            status: 'ACTIVE',
                        }
                    });
                }
            }
            catch (err) {
                console.error(`[StudentService] Failed to upsert StudentAcademicYearRecord for student ${student.id}:`, err);
            }
            if (data.parent_phone) {
                const parent = await parentService.findOrCreateParentByPhone(data.parent_phone, {
                    name: data.parent_name,
                    email: data.parent_email,
                    password: data.parent_password,
                    address: data.parent_address,
                });
                await db_1.default.parentStudentLink.upsert({
                    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
                    update: {
                        relationshipType: data.relationshipType || 'Guardian',
                    },
                    create: {
                        parentId: parent.id,
                        studentId: student.id,
                        relationshipType: data.relationshipType || 'Guardian'
                    }
                });
            }
        }
        catch (err) {
            results.errors.push(`Row ${i + 1} (${data.name}): ${err.message}`);
        }
    }
    if (results.created > 0) {
        try {
            const adminUsers = await db_1.default.user.findMany({
                where: { role: 'school_admin' },
                select: { id: true }
            });
            if (adminUsers.length > 0) {
                await db_1.default.userNotification.createMany({
                    data: adminUsers.map((admin) => ({
                        userId: admin.id,
                        title: '📋 Bulk Student Import Completed',
                        message: `${results.created} new student${results.created !== 1 ? 's' : ''} enrolled via bulk import${results.updated > 0 ? `, ${results.updated} updated` : ''}${results.errors.length > 0 ? `, ${results.errors.length} error${results.errors.length !== 1 ? 's' : ''}` : ''}.`,
                        type: 'NEW_STUDENT',
                        isRead: false,
                    })),
                    skipDuplicates: true,
                });
            }
        }
        catch (notifErr) {
            console.error('[StudentService] Failed to send admin notification for bulk import:', notifErr);
        }
    }
    return results;
};
exports.bulkUpsertStudents = bulkUpsertStudents;
const getStudentById = async (id, _schoolId) => {
    const student = await db_1.default.student.findFirst({
        where: { id },
        include: {
            attendance: true,
            grade: true,
            section: true,
            stream: true,
            parentStudents: true,
        },
    });
    return mapStudentToFlat(student);
};
exports.getStudentById = getStudentById;
const updateStudent = async (id, data, _schoolId) => {
    const updateData = {};
    if (data.name)
        updateData.fullName = data.name;
    if (data.student_id)
        updateData.student_id = data.student_id;
    if (data.parent_email)
        updateData.parent_email = data.parent_email;
    if (data.parent_phone)
        updateData.parent_phone = data.parent_phone;
    if (data.parent_name)
        updateData.parent_name = data.parent_name;
    if (data.gender)
        updateData.gender = data.gender;
    if (data.date_of_birth)
        updateData.date_of_birth = data.date_of_birth;
    if (data.address)
        updateData.address = data.address;
    const existingStudent = await db_1.default.student.findUnique({ where: { id }, select: { gradeId: true, streamId: true, sectionId: true } });
    if (!existingStudent)
        throw new Error('Student not found');
    let targetGradeId = data.gradeId || existingStudent.gradeId;
    let targetGrade = null;
    if (data.gradeId) {
        targetGrade = await db_1.default.grade.findUnique({ where: { id: data.gradeId } });
    }
    else if (data.grade) {
        targetGrade = await db_1.default.grade.upsert({
            where: { name: String(data.grade).trim() },
            update: {},
            create: { name: String(data.grade).trim() },
        });
        targetGradeId = targetGrade.id;
    }
    else {
        targetGrade = await db_1.default.grade.findUnique({ where: { id: targetGradeId } });
    }
    const gradeName = (targetGrade?.name || '').toLowerCase();
    const isSeniorSecondary = gradeName.includes('11') || gradeName.includes('12');
    let targetStreamId = existingStudent.streamId;
    if (isSeniorSecondary) {
        if (data.streamId) {
            targetStreamId = data.streamId;
        }
        else if (data.stream) {
            const st = await db_1.default.stream.upsert({
                where: { name: String(data.stream).trim() },
                update: {},
                create: { name: String(data.stream).trim() },
            });
            targetStreamId = st.id;
        }
        if (!targetStreamId) {
            throw new Error(`Stream selection is mandatory for Grade 11 and 12.`);
        }
    }
    else {
        targetStreamId = null;
    }
    let targetSectionId = data.sectionId || existingStudent.sectionId;
    if (data.sectionId) {
        const sec = await db_1.default.section.findUnique({ where: { id: data.sectionId } });
        if (!sec || sec.gradeId !== targetGradeId || (isSeniorSecondary && sec.streamId && sec.streamId !== targetStreamId)) {
            throw new Error('Selected section does not match the target grade and stream.');
        }
        targetSectionId = sec.id;
    }
    else if (data.section) {
        const secName = String(data.section).trim();
        let sec = await db_1.default.section.findFirst({
            where: {
                gradeId: targetGradeId,
                streamId: targetStreamId,
                name: { equals: secName, mode: 'insensitive' },
            },
        });
        if (!sec) {
            sec = await db_1.default.section.create({
                data: {
                    name: secName,
                    gradeId: targetGradeId,
                    streamId: targetStreamId,
                },
            });
        }
        targetSectionId = sec.id;
    }
    updateData.gradeId = targetGradeId;
    updateData.sectionId = targetSectionId;
    updateData.streamId = targetStreamId;
    const updatedStudent = await db_1.default.student.update({
        where: { id },
        data: updateData,
        include: {
            grade: true,
            section: true,
            stream: true,
            parentStudents: true,
        }
    });
    if (data.relationshipType || data.parent_phone || data.parent_name) {
        try {
            let parent = null;
            if (data.existingParentId) {
                parent = await db_1.default.user.findUnique({ where: { id: data.existingParentId } });
            }
            const phoneToUse = data.parent_phone || updatedStudent.parent_phone;
            if (!parent && phoneToUse) {
                parent = await parentService.findOrCreateParentByPhone(phoneToUse, {
                    name: data.parent_name || updatedStudent.parent_name,
                    email: data.parent_email || updatedStudent.parent_email,
                    password: data.parent_password,
                    address: data.parent_address,
                });
            }
            if (parent) {
                await db_1.default.parentStudentLink.upsert({
                    where: {
                        parentId_studentId: {
                            parentId: parent.id,
                            studentId: id
                        }
                    },
                    update: {
                        ...(data.relationshipType ? { relationshipType: data.relationshipType } : {})
                    },
                    create: {
                        parentId: parent.id,
                        studentId: id,
                        relationshipType: data.relationshipType || 'Guardian'
                    }
                });
            }
        }
        catch (parentErr) {
            console.error('[StudentService] Failed to sync parent link on update:', parentErr);
        }
    }
    if (data.grade || data.section || 'stream' in data) {
        try {
            const activeAY = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
            if (activeAY) {
                await db_1.default.studentAcademicYearRecord.upsert({
                    where: { studentId_academicYearId: { studentId: id, academicYearId: activeAY.id } },
                    create: {
                        studentId: id,
                        academicYearId: activeAY.id,
                        gradeId: updatedStudent.gradeId,
                        sectionId: updatedStudent.sectionId,
                        streamId: updatedStudent.streamId,
                        status: 'ACTIVE',
                    },
                    update: {
                        gradeId: updatedStudent.gradeId,
                        sectionId: updatedStudent.sectionId,
                        streamId: updatedStudent.streamId,
                    }
                });
            }
        }
        catch (err) {
            console.error('[StudentService] Failed to sync StudentAcademicYearRecord on update:', err);
        }
    }
    return {
        ...mapStudentToFlat(updatedStudent),
        ...(data.relationshipType ? { relationshipType: data.relationshipType } : {}),
    };
};
exports.updateStudent = updateStudent;
const deleteStudent = async (id, _schoolId) => {
    let result = await db_1.default.student.deleteMany({
        where: { id }
    });
    if (result.count === 0) {
        result = await db_1.default.student.deleteMany({
            where: {
                student_id: id,
            }
        });
    }
    if (result.count === 0) {
        throw new Error('Student not found.');
    }
    return result;
};
exports.deleteStudent = deleteStudent;
const getStudentsByParentPhone = async (parentPhone, _schoolId) => {
    const students = await db_1.default.student.findMany({
        where: { parent_phone: parentPhone },
        include: {
            grade: true,
            section: true,
            stream: true,
            parentStudents: true,
            attendance: {
                orderBy: { date: 'desc' },
                take: 90
            }
        }
    });
    return students.map((student) => ({
        ...mapStudentToFlat(student),
        attendance: student.attendance
    }));
};
exports.getStudentsByParentPhone = getStudentsByParentPhone;
