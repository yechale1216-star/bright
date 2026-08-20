import prisma from '../config/db';

export const getAssignments = async (_schoolId?: string, teacherId?: string) => {
  const where: any = {};
  if (teacherId) {
    let resolvedTeacherId = teacherId;
    const user = await prisma.user.findUnique({ 
      where: { id: teacherId } 
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

export const createAssignment = async (data: any, _schoolId?: string) => {
  let teacherId = data.teacher_id;

  const user = await prisma.user.findUnique({ 
    where: { id: teacherId } 
  });
  
  if (user) {
    if (user.teacher_id) {
      teacherId = user.teacher_id;
    } else if (user.role === 'teacher') {
      const newTeacher = await prisma.teacher.create({
        data: {
          name: user.full_name,
          email: user.email,
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

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId }
  });
  if (!teacher) {
    throw new Error("Teacher does not exist.");
  }

  const grade = await prisma.grade.findUnique({
    where: { id: data.gradeId }
  });
  if (!grade) {
    throw new Error("Grade does not exist.");
  }

  const section = await prisma.section.findUnique({
    where: { id: data.sectionId }
  });
  if (!section) {
    throw new Error("Section does not exist.");
  }

  if (data.streamId) {
    const stream = await prisma.stream.findUnique({
      where: { id: data.streamId }
    });
    if (!stream) {
      throw new Error("Stream does not exist.");
    }
  }

  const existingClassAssignment = await prisma.teacherAssignment.findFirst({
    where: {
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
      gradeId: data.gradeId,
      sectionId: data.sectionId,
      subject: data.subject || null,
      streamId: data.streamId || null,
    },
    include: { teacher: true, grade: true, section: true, stream: true },
  });
};

export const deleteAssignment = async (id: string, _schoolId?: string) => {
  return await prisma.teacherAssignment.delete({ 
    where: { id } 
  });
};

export const updateAssignment = async (id: string, data: any, _schoolId?: string) => {
  let teacherId = data.teacher_id;

  const user = await prisma.user.findUnique({ 
    where: { id: teacherId } 
  });
  if (user && user.teacher_id) {
    teacherId = user.teacher_id;
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId }
  });
  if (!teacher) {
    throw new Error("Teacher does not exist.");
  }

  const grade = await prisma.grade.findUnique({
    where: { id: data.gradeId }
  });
  if (!grade) {
    throw new Error("Grade does not exist.");
  }

  const section = await prisma.section.findUnique({
    where: { id: data.sectionId }
  });
  if (!section) {
    throw new Error("Section does not exist.");
  }

  if (data.streamId) {
    const stream = await prisma.stream.findUnique({
      where: { id: data.streamId }
    });
    if (!stream) {
      throw new Error("Stream does not exist.");
    }
  }

  const conflictingAssignment = await prisma.teacherAssignment.findFirst({
    where: {
      id: { not: id },
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
    where: { id },
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
