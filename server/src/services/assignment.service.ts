import prisma from '../config/db';

export const getAssignments = async (schoolId: string, teacherId?: string) => {
  if (!schoolId) throw new Error('School ID is required');
  const where: any = { schoolId };
  if (teacherId) {
    let resolvedTeacherId = teacherId;
    const user = await prisma.user.findFirst({ 
      where: { id: teacherId, schoolId } 
    });
    if (user && user.teacher_id) {
      resolvedTeacherId = user.teacher_id;
    }
    where.teacher_id = resolvedTeacherId;
  }
  return await prisma.teacherAssignment.findMany({
    where,
    include: { 
      teacher: true,
      grade: true,
      section: true,
      stream: true
    },
  });
};

export const createAssignment = async (data: any, schoolId: string) => {
  if (!schoolId) throw new Error('School ID is required');
  let teacherId = data.teacher_id;

  // Resolve User.id -> Teacher.id if a User ID was passed
  const user = await prisma.user.findFirst({ 
    where: { id: teacherId, schoolId } 
  });
  
  if (user) {
    if (user.teacher_id) {
      teacherId = user.teacher_id;
    } else if (user.role === 'teacher') {
      // Lazy-create missing Teacher record for this user
      const newTeacher = await prisma.teacher.create({
        data: {
          name: user.full_name,
          email: user.email,
          schoolId: schoolId,
          user_id: user.id,
          phone: user.phone || null,
          profile_photo: user.profile_photo || null,
        }
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { teacher_id: newTeacher.id }
      });
      teacherId = newTeacher.id;
    }
  }

  // VALIDATION: Ensure Teacher, Grade, Section, and Stream belong to this school
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId }
  });
  if (!teacher) {
    throw new Error("Teacher does not exist in this school context.");
  }

  const grade = await prisma.grade.findFirst({
    where: { id: data.gradeId, schoolId }
  });
  if (!grade) {
    throw new Error("Grade does not exist in this school context.");
  }

  const section = await prisma.section.findFirst({
    where: { id: data.sectionId, schoolId }
  });
  if (!section) {
    throw new Error("Section does not exist in this school context.");
  }

  if (data.streamId) {
    const stream = await prisma.stream.findFirst({
      where: { id: data.streamId, schoolId }
    });
    if (!stream) {
      throw new Error("Stream does not exist in this school context.");
    }
  }

  // HOMEROOM RULE: Check if this class/section already has ANY active homeroom teacher.
  // One class = max one homeroom teacher. The same teacher MAY manage multiple classes.
  const existingClassAssignment = await prisma.teacherAssignment.findFirst({
    where: {
      schoolId,
      gradeId: data.gradeId,
      sectionId: data.sectionId,
      streamId: data.streamId || null,
    },
    include: { teacher: true }
  });

  if (existingClassAssignment) {
    const teacherName = existingClassAssignment.teacher?.name || 'another teacher';
    throw new Error(`This class already has a homeroom teacher assigned (${teacherName}). Remove or edit the existing assignment first.`);
  }

  return await prisma.teacherAssignment.create({
    data: {
      teacher_id: teacherId,
      schoolId: schoolId,
      gradeId: data.gradeId,
      sectionId: data.sectionId,
      subject: data.subject || null,
      streamId: data.streamId || null,
    },
    include: { teacher: true, grade: true, section: true, stream: true },
  });
};

export const deleteAssignment = async (id: string, schoolId: string) => {
  return await prisma.teacherAssignment.delete({ 
    where: { id, schoolId } 
  });
};

export const updateAssignment = async (id: string, data: any, schoolId: string) => {
  let teacherId = data.teacher_id;

  // Resolve User.id -> Teacher.id if a User ID was passed
  const user = await prisma.user.findFirst({ 
    where: { id: teacherId, schoolId } 
  });
  if (user && user.teacher_id) {
    teacherId = user.teacher_id;
  }

  // VALIDATION: Ensure Teacher, Grade, Section, and Stream belong to this school
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId }
  });
  if (!teacher) {
    throw new Error("Teacher does not exist in this school context.");
  }

  const grade = await prisma.grade.findFirst({
    where: { id: data.gradeId, schoolId }
  });
  if (!grade) {
    throw new Error("Grade does not exist in this school context.");
  }

  const section = await prisma.section.findFirst({
    where: { id: data.sectionId, schoolId }
  });
  if (!section) {
    throw new Error("Section does not exist in this school context.");
  }

  if (data.streamId) {
    const stream = await prisma.stream.findFirst({
      where: { id: data.streamId, schoolId }
    });
    if (!stream) {
      throw new Error("Stream does not exist in this school context.");
    }
  }

  // HOMEROOM RULE: Check if the target class already has a DIFFERENT active homeroom teacher.
  // Excludes the current assignment being edited so editing the same class is allowed.
  const conflictingAssignment = await prisma.teacherAssignment.findFirst({
    where: {
      id: { not: id },
      schoolId,
      gradeId: data.gradeId,
      sectionId: data.sectionId,
      streamId: data.streamId || null,
    },
    include: { teacher: true }
  });

  if (conflictingAssignment) {
    const teacherName = conflictingAssignment.teacher?.name || 'another teacher';
    throw new Error(`This class already has an active homeroom teacher (${teacherName}). Remove or edit the existing assignment first.`);
  }

  return await prisma.teacherAssignment.update({
    where: { id, schoolId },
    data: {
      teacher_id: teacherId,
      gradeId: data.gradeId,
      sectionId: data.sectionId,
      streamId: data.streamId || null,
      subject: data.subject || null,
    },
    include: { teacher: true, grade: true, section: true, stream: true },
  });
};
