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
exports.getStudentsByParentPhone = exports.deleteStudent = exports.updateStudent = exports.getStudentById = exports.bulkUpsertStudents = exports.generateStudentId = exports.createStudent = exports.getNextStudentId = exports.getAllStudents = void 0;
const db_1 = __importDefault(require("../config/db"));
const parentService = __importStar(require("./parent.service"));
const academic_year_service_1 = require("./academic-year.service");
// Map database relational model to flat frontend model
const mapStudentToFlat = (student) => {
    if (!student)
        return null;
    return {
        ...student,
        name: student.fullName,
        grade: student.grade?.name || '',
        section: student.section?.name || '',
        stream: student.stream?.name || null,
    };
};
const getAllStudents = async (_schoolId, search, status, gradeId, sectionId, streamId, academicYear) => {
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
        const enrollments = await db_1.default.studentAcademicYearRecord.findMany({
            where: enrollmentWhere,
            include: {
                student: true,
                grade: true,
                section: true,
                stream: true,
            },
            orderBy: { student: { fullName: 'asc' } }
        });
        return enrollments.map((enr) => ({
            ...enr.student,
            name: enr.student.fullName,
            grade: enr.grade?.name || '',
            section: enr.section?.name || '',
            stream: enr.stream?.name || null,
            gradeId: enr.gradeId,
            sectionId: enr.sectionId,
            streamId: enr.streamId,
            enrollmentStatus: enr.status,
            academicYearRecordId: enr.id,
        }));
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
    const students = await db_1.default.student.findMany({
        where,
        include: { grade: true, section: true, stream: true, promotions: { orderBy: { promotedAt: 'desc' }, take: 1 } },
        orderBy: { fullName: 'asc' }
    });
    return students.map(mapStudentToFlat);
};
exports.getAllStudents = getAllStudents;
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
const createStudent = async (data, _schoolId) => {
    let studentId = data.student_id;
    if (!studentId) {
        studentId = await (0, exports.getNextStudentId)();
    }
    const gradeName = String(data.grade || '').trim();
    const gradeNum = parseInt(gradeName.replace(/[^\d]/g, ''), 10);
    if (!isNaN(gradeNum)) {
        if (gradeNum >= 11 && !data.stream) {
            throw new Error(`Stream selection (Natural/Social Science) is required for ${gradeName}.`);
        }
        if (gradeNum <= 10) {
            data.stream = null;
        }
    }
    const newStudent = await db_1.default.student.create({
        data: {
            fullName: data.name,
            student_id: studentId,
            parent_email: data.parent_email || "",
            parent_phone: data.parent_phone || "",
            parent_name: data.parent_name || "",
            gender: data.gender,
            date_of_birth: data.date_of_birth,
            grade: {
                connectOrCreate: {
                    where: { name: data.grade },
                    create: { name: data.grade }
                }
            },
            section: {
                connectOrCreate: {
                    where: { name: data.section },
                    create: { name: data.section }
                }
            },
            stream: data.stream ? {
                connectOrCreate: {
                    where: { name: data.stream },
                    create: { name: data.stream }
                }
            } : undefined
        },
        include: {
            grade: true,
            section: true,
            stream: true
        }
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
    const parent = await parentService.findOrCreateParentByPhone(data.parent_phone, {
        name: data.parent_name,
        email: data.parent_email,
        password: data.parent_password,
        address: data.parent_address,
    });
    await db_1.default.parentStudentLink.upsert({
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
    return mapStudentToFlat(newStudent);
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
            const section = await db_1.default.section.upsert({
                where: { name: data.section },
                update: {},
                create: { name: data.section }
            });
            let streamId = undefined;
            if (data.stream) {
                const stream = await db_1.default.stream.upsert({
                    where: { name: data.stream },
                    update: {},
                    create: { name: data.stream }
                });
                streamId = stream.id;
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
            stream: true
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
    if (data.grade) {
        updateData.grade = {
            connectOrCreate: {
                where: { name: data.grade },
                create: { name: data.grade }
            }
        };
    }
    if (data.section) {
        updateData.section = {
            connectOrCreate: {
                where: { name: data.section },
                create: { name: data.section }
            }
        };
    }
    const gradeName = String(data.grade || '').trim();
    const gradeNum = parseInt(gradeName.replace(/[^\d]/g, ''), 10);
    if (!isNaN(gradeNum) && gradeNum <= 10) {
        updateData.stream = { disconnect: true };
    }
    else if (data.stream) {
        updateData.stream = {
            connectOrCreate: {
                where: { name: data.stream },
                create: { name: data.stream }
            }
        };
    }
    else if ('stream' in data && !data.stream) {
        updateData.stream = { disconnect: true };
    }
    const updatedStudent = await db_1.default.student.update({
        where: { id },
        data: updateData,
        include: {
            grade: true,
            section: true,
            stream: true
        }
    });
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
    return mapStudentToFlat(updatedStudent);
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
            attendance: {
                orderBy: { date: 'desc' }
            }
        }
    });
    return students.map((student) => ({
        ...mapStudentToFlat(student),
        attendance: student.attendance
    }));
};
exports.getStudentsByParentPhone = getStudentsByParentPhone;
