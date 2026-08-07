import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import * as parentService from './parent.service';
import { getSchoolLimits } from './subscription.service';

// Map database relational model to flat frontend model
const mapStudentToFlat = (student: any) => {
  if (!student) return null;
  return {
    ...student,
    name: student.fullName, // map back to 'name' for frontend
    grade: student.grade?.name || '',
    section: student.section?.name || '',
    stream: student.stream?.name || null,
  };
};

export const getAllStudents = async (schoolId: string, search?: string) => {
  if (!schoolId) throw new Error('School ID is required');

  const where: any = { schoolId };

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { student_id: { contains: term, mode: 'insensitive' } },
    ];
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      grade: true,
      section: true,
      stream: true
    },
    orderBy: { fullName: 'asc' }
  });
  return students.map(mapStudentToFlat);
};


export const getNextStudentId = async (schoolId: string) => {
  const idPrefix = 'STU';
  const latestStudent = await prisma.student.findFirst({
    where: { 
      schoolId,
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

export const createStudent = async (data: any, schoolId: string) => {
  console.log(`[StudentService] createStudent called for schoolId: "${schoolId}"`);
  
  // Verify school exists
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    console.error(`[StudentService] School not found for ID: "${schoolId}"`);
    throw new Error('School context invalid - Please logout and login again (database was likely reset)');
  }

  // Enforce SaaS student limits
  const limits = await getSchoolLimits(schoolId);
  const currentCount = await prisma.student.count({ where: { schoolId } });

  if (limits.maxStudents !== -1 && currentCount >= limits.maxStudents) {
    throw new Error(`Student limit reached (${limits.maxStudents}). Please upgrade your Zetime plan to add more students.`);
  }

  let studentId = data.student_id;
  if (!studentId) {
    studentId = await getNextStudentId(schoolId);
  }

  // Stream Validation (Ethiopian Standards)
  const gradeName = String(data.grade || '').trim();
  const gradeNum = parseInt(gradeName.replace(/[^\d]/g, ''), 10);
  if (!isNaN(gradeNum)) {
    if (gradeNum >= 11 && !data.stream) {
      throw new Error(`Stream selection (Natural/Social Science) is required for ${gradeName}.`);
    }
    if (gradeNum <= 10) {
      data.stream = null; // Enforce no stream for Grades 1-10
    }
  }

  // Create or connect relations with schoolId scoping
  const newStudent = await prisma.student.create({
    data: {
      fullName: data.name,
      student_id: studentId,
      parent_email: data.parent_email || "",
      parent_phone: data.parent_phone || "",
      parent_name: data.parent_name || "",
      gender: data.gender,
      date_of_birth: data.date_of_birth,
      school: { connect: { id: schoolId } },
      grade: {
        connectOrCreate: {
          where: { schoolId_name: { schoolId, name: data.grade } },
          create: { name: data.grade, schoolId }
        }
      },
      section: {
        connectOrCreate: {
          where: { schoolId_name: { schoolId, name: data.section } },
          create: { name: data.section, schoolId }
        }
      },
      stream: data.stream ? {
        connectOrCreate: {
          where: { schoolId_name: { schoolId, name: data.stream } },
          create: { name: data.stream, schoolId }
        }
      } : undefined
    },
    include: {
      grade: true,
      section: true,
      stream: true
    }
  });

  // Handle Parent User Account creation or linking
  console.log(`[StudentService] Resolving parent for student enrollment (phone: "${data.parent_phone}")`);
  const parent = await parentService.findOrCreateParentByPhone(data.parent_phone, {
    name: data.parent_name,
    email: data.parent_email,
    password: data.parent_password,
    address: data.parent_address,
    schoolId: schoolId
  });

  console.log(`[StudentService] Linking student "${newStudent.fullName}" (${newStudent.id}) to parent "${parent.full_name}" (${parent.id}) with relationship: ${data.relationshipType || 'Guardian'}`);
  await prisma.parentStudentLink.upsert({
    where: {
      parentId_studentId: {
        parentId: parent.id,
        studentId: newStudent.id
      }
    },
    update: {
      relationshipType: data.relationshipType || 'Guardian',
      schoolId: schoolId
    },
    create: {
      parentId: parent.id,
      studentId: newStudent.id,
      schoolId: schoolId,
      relationshipType: data.relationshipType || 'Guardian'
    }
  });

  // Notify all school_admin users for this school about the new enrollment
  try {
    const adminUsers = await prisma.user.findMany({
      where: { schoolId, role: 'school_admin' },
      select: { id: true }
    });

    if (adminUsers.length > 0) {
      await prisma.userNotification.createMany({
        data: adminUsers.map((admin: { id: string }) => ({
          userId: admin.id,
          schoolId,
          title: '🎓 New Student Registered',
          message: `${newStudent.fullName} (${newStudent.student_id}) has been enrolled in ${newStudent.grade?.name || 'a grade'} by the registrar.`,
          type: 'NEW_STUDENT',
          isRead: false,
        })),
        skipDuplicates: true,
      });
      console.log(`[StudentService] Notified ${adminUsers.length} school admin(s) about new student enrollment: ${newStudent.fullName}`);
    }
  } catch (notifErr) {
    // Non-blocking — student was created successfully, notification failure should not roll back
    console.error('[StudentService] Failed to send admin notification for new student:', notifErr);
  }

  return mapStudentToFlat(newStudent);
};
export const generateStudentId = async (schoolId: string): Promise<string> => {
  return await getNextStudentId(schoolId);
};

export const bulkUpsertStudents = async (students: any[], schoolId: string) => {
  if (!schoolId) throw new Error('School ID is required');

  const results = { created: 0, updated: 0, errors: [] as string[] };

  // Generate a base sequence for auto-generated IDs to avoid collisions during the same bulk operation
  let autoGenSequenceOffset = 0;
  const idPrefix = 'STU';

  // Pre-calculate starting sequence if needed
  const latestStudent = await prisma.student.findFirst({
    where: {
      schoolId: schoolId,
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

  // Enforce SaaS student limits for bulk upload
  const { getSchoolLimits } = require('./subscription.service');
  const limits = await getSchoolLimits(schoolId);
  const initialCount = await prisma.student.count({ where: { schoolId } });
  let createdCountInThisBatch = 0;

  // Process in sequence to ensure stability and proper parent linking across siblings
  for (let i = 0; i < students.length; i++) {
    const data = students[i];
    try {
      let studentId = data.student_id ? String(data.student_id).trim() : null;

      // Auto-generate ID if missing
      if (!studentId) {
        studentId = `${idPrefix}${(nextBaseSequence + autoGenSequenceOffset).toString().padStart(6, '0')}`;
        autoGenSequenceOffset++;
      }

      // Stream Validation (Ethiopian Standards)
      const gradeName = String(data.grade).trim();
      const gradeNum = parseInt(gradeName);
      
      if (!isNaN(gradeNum)) {
        if (gradeNum >= 11 && !data.stream) {
          throw new Error(`Stream selection (Natural/Social Science) is required for Grade ${gradeName}`);
        }
        if (gradeNum <= 10 && data.stream) {
          data.stream = null; // Enforce no stream for Grades 1-10
        }
      }
      
      // 1. Handle Relations (Grade, Section, Stream)
      const grade = await prisma.grade.upsert({
        where: { schoolId_name: { schoolId, name: data.grade } },
        update: {},
        create: { name: data.grade, schoolId }
      });

      const section = await prisma.section.upsert({
        where: { schoolId_name: { schoolId, name: data.section } },
        update: {},
        create: { name: data.section, schoolId }
      });

      let streamId: string | undefined = undefined;
      if (data.stream) {
        const stream = await prisma.stream.upsert({
          where: { schoolId_name: { schoolId, name: data.stream } },
          update: {},
          create: { name: data.stream, schoolId }
        });
        streamId = stream.id;
      }

      const existingStudent = await prisma.student.findUnique({
        where: { student_id_schoolId: { student_id: studentId, schoolId } }
      });

      // Limit check before creation
      if (!existingStudent && limits.maxStudents !== -1) {
        if ((initialCount + createdCountInThisBatch) >= limits.maxStudents) {
          throw new Error(`Student limit reached (${limits.maxStudents}). Batch stopped at this row.`);
        }
      }

      // 2. Upsert Student
      const student = await prisma.student.upsert({
        where: { student_id_schoolId: { student_id: studentId, schoolId } },
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
          schoolId: schoolId,
          gradeId: grade.id,
          sectionId: section.id,
          streamId: streamId || null
        }
      });

      if (existingStudent) {
        results.updated++;
      } else {
        results.created++;
        createdCountInThisBatch++;
      }
      // 3. Handle Parent Linking
      if (data.parent_phone) {
        const parent = await parentService.findOrCreateParentByPhone(data.parent_phone, {
          name: data.parent_name,
          email: data.parent_email,
          password: data.parent_password,
          address: data.parent_address,
          schoolId: schoolId
        });

        await prisma.parentStudentLink.upsert({
          where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
          update: {
            relationshipType: data.relationshipType || 'Guardian',
            schoolId: schoolId
          },
          create: {
            parentId: parent.id,
            studentId: student.id,
            schoolId: schoolId,
            relationshipType: data.relationshipType || 'Guardian'
          }
        });
      }
    } catch (err: any) {
      results.errors.push(`Row ${i + 1} (${data.name}): ${err.message}`);
    }
  }

  // Notify school admins with a summary if any new students were created in this batch
  if (results.created > 0) {
    try {
      const adminUsers = await prisma.user.findMany({
        where: { schoolId, role: 'school_admin' },
        select: { id: true }
      });

      if (adminUsers.length > 0) {
        await prisma.userNotification.createMany({
          data: adminUsers.map((admin: { id: string }) => ({
            userId: admin.id,
            schoolId,
            title: '📋 Bulk Student Import Completed',
            message: `${results.created} new student${results.created !== 1 ? 's' : ''} enrolled via bulk import${results.updated > 0 ? `, ${results.updated} updated` : ''}${results.errors.length > 0 ? `, ${results.errors.length} error${results.errors.length !== 1 ? 's' : ''}` : ''}.`,
            type: 'NEW_STUDENT',
            isRead: false,
          })),
          skipDuplicates: true,
        });
        console.log(`[StudentService] Notified ${adminUsers.length} admin(s) about bulk import: ${results.created} created, ${results.updated} updated`);
      }
    } catch (notifErr) {
      console.error('[StudentService] Failed to send admin notification for bulk import:', notifErr);
    }
  }

  return results;
};

export const getStudentById = async (id: string, schoolId: string) => {
  const student = await prisma.student.findFirst({
    where: { id, schoolId },
    include: { 
      attendance: true,
      grade: true,
      section: true,
      stream: true
    },
  });
  return mapStudentToFlat(student);
};

export const updateStudent = async (id: string, data: any, schoolId: string) => {
  const updateData: any = {};
  if (data.name) updateData.fullName = data.name;
  if (data.student_id) updateData.student_id = data.student_id;
  if (data.parent_email) updateData.parent_email = data.parent_email;
  if (data.parent_phone) updateData.parent_phone = data.parent_phone;
  if (data.parent_name) updateData.parent_name = data.parent_name;
  if (data.gender) updateData.gender = data.gender;
  if (data.date_of_birth) updateData.date_of_birth = data.date_of_birth;

  if (data.grade) {
    updateData.grade = {
      connectOrCreate: {
        where: { schoolId_name: { schoolId, name: data.grade } },
        create: { name: data.grade, schoolId }
      }
    };
  }
  if (data.section) {
    updateData.section = {
      connectOrCreate: {
        where: { schoolId_name: { schoolId, name: data.section } },
        create: { name: data.section, schoolId }
      }
    };
  }

  // Stream: enforce grade-based rules
  //   - If grade is known and <= 10: always disconnect stream
  //   - If grade is >= 11 and stream is provided: connect/create
  //   - If stream is explicitly empty/null/"" and grade provided: disconnect
  const gradeName = String(data.grade || '').trim();
  const gradeNum = parseInt(gradeName.replace(/[^\d]/g, ''), 10);

  if (!isNaN(gradeNum) && gradeNum <= 10) {
    // Grades 1-10 must NOT have a stream
    updateData.stream = { disconnect: true };
  } else if (data.stream) {
    // Grade 11+ with explicit stream: connect or create
    updateData.stream = {
      connectOrCreate: {
        where: { schoolId_name: { schoolId, name: data.stream } },
        create: { name: data.stream, schoolId }
      }
    };
  } else if ('stream' in data && !data.stream) {
    // Explicit stream removal (stream sent as '' or null)
    updateData.stream = { disconnect: true };
  }

  const updatedStudent = await prisma.student.update({ 
    where: { id, schoolId }, 
    data: updateData,
    include: {
      grade: true,
      section: true,
      stream: true
    }
  });

  return mapStudentToFlat(updatedStudent);
};

export const deleteStudent = async (id: string, schoolId: string) => {
  console.log(`[StudentService] Attempting to delete student with identifier: ${id} for school: ${schoolId}`);
  
  // Try deleting by the primary UUID first
  let result = await prisma.student.deleteMany({ 
    where: { id, schoolId } 
  });
  
  // If no record was deleted, try deleting by the custom 'student_id' field (like STU000001)
  if (result.count === 0) {
    console.log(`[StudentService] UUID match failed, trying custom student_id field...`);
    result = await prisma.student.deleteMany({
      where: { 
        student_id: id,
        schoolId: schoolId 
      }
    });
  }
  
  console.log(`[StudentService] Final delete result:`, result);
  
  if (result.count === 0) {
    throw new Error('Student not found. Ensure the ID is correct and you have permission to delete this record.');
  }
  
  return result;
};

export const getStudentsByParentPhone = async (parentPhone: string, schoolId: string) => {
  const students = await prisma.student.findMany({
    where: { parent_phone: parentPhone, schoolId },
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
