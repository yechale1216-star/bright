import prisma from '../config/db';
import { academicYearService } from './academic-year.service';

// Helpers for the rules
const isP = (s: string | undefined): boolean => s?.toLowerCase() === 'present';
const isL = (s: string | undefined): boolean => s?.toLowerCase() === 'late';
const isE = (s: string | undefined): boolean => s?.toLowerCase() === 'excused';
const isA = (s: string | undefined): boolean => s?.toLowerCase() === 'absent';
const isAttendance = (s: string | undefined): boolean => isP(s) || isL(s);

export const getAttendanceSummary = async (schoolId: string, filters: any) => {
  const { startDate, endDate, academicYear, session, grade, section, stream, mode } = filters;
  const isFullDay = !session || session === 'total';
  const isSessionMode = mode === 'session_based';

  const where: any = { schoolId };

  // Scope to active academic year unless academicYear filter is 'all'
  if (!academicYear || academicYear === 'current' || academicYear === 'active') {
    const activeAY = await academicYearService.getCurrentAcademicYear(schoolId);
    if (activeAY) where.academicYearId = activeAY.id;
  } else if (academicYear && academicYear !== 'all') {
    const targetAY = await prisma.academicYear.findUnique({
      where: { schoolId_name: { schoolId, name: academicYear } }
    });
    if (targetAY) where.academicYearId = targetAY.id;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  if (!isFullDay) {
    where.session = { equals: session.trim().toLowerCase(), mode: 'insensitive' };
  } else if (mode === 'session_based') {
    where.session = { not: null };
  } else if (mode === 'daily') {
    where.session = null;
  }

  // Filter attendance by student attributes if provided
  const studentWhere: any = { schoolId };
  if (grade && grade !== 'all') studentWhere.grade = { name: grade };
  if (section && section !== 'all') studentWhere.section = { name: section };
  if (stream && stream !== 'all') studentWhere.stream = { name: stream };

  if (grade || section || stream) {
    where.student = studentWhere;
  }

  const totalStudents = await prisma.student.count({ where: studentWhere });

  if (isFullDay) {
    const allRecords = await prisma.attendance.findMany({
      where,
      select: { studentId: true, date: true, session: true, status: true }
    });

    const byStudentDate: Record<string, { morning?: string; afternoon?: string; daily?: string }> = {};
    allRecords.forEach(rec => {
      const recHasSession = !!rec.session;
      
      // Strict mode isolation
      if (isSessionMode && !recHasSession) return;
      if (!isSessionMode && recHasSession) return;

      const dateStr = rec.date.toISOString().split('T')[0];
      const key = `${rec.studentId}||${dateStr}`;
      if (!byStudentDate[key]) byStudentDate[key] = {};
      const sess = rec.session?.toLowerCase();
      if (sess === 'morning') byStudentDate[key].morning = rec.status;
      else if (sess === 'afternoon') byStudentDate[key].afternoon = rec.status;
      else byStudentDate[key].daily = rec.status;
    });

    let present = 0;
    let late = 0;
    let excused = 0;
    let absent = 0;

    Object.values(byStudentDate).forEach(entry => {
      const { morning: m, afternoon: a, daily: d } = entry;

      if (m !== undefined || a !== undefined) {
        if (m !== undefined && a !== undefined) {
          // Both sessions recorded
          if (isP(m) && isP(a)) present++;
          else if (isAttendance(m) && isAttendance(a)) late++;
          else if (isE(m) && isE(a)) excused++;
          else if (isA(m) && isA(a)) absent++;
        }
      } else if (d !== undefined) {
        if (isP(d)) present++;
        else if (isL(d)) late++;
        else if (isE(d)) excused++;
        else if (isA(d)) absent++;
      }
    });

    const totalEntries = present + late + excused + absent;
    const attendanceRate = totalEntries > 0
      ? Math.round(((present + late + excused) / totalEntries) * 100)
      : 0;

    return {
      totalStudents,
      present,
      late,
      excused,
      absent,
      attendanceRate
    };
  } else {
    // Single session view — fetch records and deduplicate by studentId + date to guarantee unique counts
    const stats = {
      totalStudents,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendanceRate: 0
    };

    const allRecords = await prisma.attendance.findMany({
      where,
      select: { studentId: true, date: true, status: true },
      orderBy: { updatedAt: 'desc' }
    });

    const uniqueStudentDate = new Map<string, string>(); // `${studentId}||${dateStr}` -> status
    allRecords.forEach(rec => {
      const dateStr = rec.date.toISOString().split('T')[0];
      const key = `${rec.studentId}||${dateStr}`;
      if (!uniqueStudentDate.has(key)) {
        uniqueStudentDate.set(key, rec.status.toLowerCase());
      }
    });

    uniqueStudentDate.forEach(s => {
      if (s === 'present') stats.present++;
      else if (s === 'absent') stats.absent++;
      else if (s === 'late') stats.late++;
      else if (s === 'excused') stats.excused++;
    });

    const totalRecorded = stats.present + stats.absent + stats.late + stats.excused;
    stats.attendanceRate = totalRecorded > 0
      ? Math.round(((stats.present + stats.late + stats.excused) / totalRecorded) * 100)
      : 0;

    return stats;
  }
};

export const getGradeStats = async (schoolId: string, filters: any) => {
  const { startDate, endDate, session, grade, section, stream, mode } = filters;
  const isFullDay = !session || session === 'total';
  const isSessionMode = mode === 'session_based';

  const where: any = { schoolId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  if (!isFullDay) {
    where.session = { equals: session.trim().toLowerCase(), mode: 'insensitive' };
  } else if (mode === 'session_based') {
    where.session = { not: null };
  } else if (mode === 'daily') {
    where.session = null;
  }

  // Filter by student attributes if provided
  const studentWhere: any = { schoolId };
  if (grade && grade !== 'all') studentWhere.grade = { name: grade };
  if (section && section !== 'all') studentWhere.section = { name: section };
  if (stream && stream !== 'all') studentWhere.stream = { name: stream };

  if (grade || section || stream) {
    where.student = studentWhere;
  }

  const students = await prisma.student.findMany({
    where: studentWhere,
    include: { grade: true, section: true, stream: true }
  });

  const attendance = await prisma.attendance.findMany({
    where,
    select: { studentId: true, status: true, date: true, session: true }
  });

  const attendanceMap: Record<string, any[]> = {};
  attendance.forEach(rec => {
    const recHasSession = !!rec.session;
    if (isSessionMode && !recHasSession) return;
    if (!isSessionMode && recHasSession) return;
    if (!attendanceMap[rec.studentId]) attendanceMap[rec.studentId] = [];
    attendanceMap[rec.studentId].push(rec);
  });

  const groups: Record<string, any> = {};

  students.forEach(student => {
    const key = `${student.gradeId}-${student.sectionId}-${student.streamId || 'none'}`;
    if (!groups[key]) {
      groups[key] = {
        gradeId: student.gradeId,
        sectionId: student.sectionId,
        streamId: student.streamId || null,
        grade: student.grade.name,
        section: student.section.name,
        stream: student.stream?.name || null,
        totalStudents: 0,
        present: 0,
        late: 0,
        excused: 0,
        absent: 0,
        lastUpdated: null as Date | null,
      };
    }

    groups[key].totalStudents++;
    const records = attendanceMap[student.id] || [];

    if (isFullDay) {
      const byDate: Record<string, { morning?: string; afternoon?: string; daily?: string }> = {};
      records.forEach(rec => {
        const dateStr = rec.date.toISOString().split('T')[0];
        if (!byDate[dateStr]) byDate[dateStr] = {};
        const s = rec.session?.toLowerCase();
        if (s === 'morning') byDate[dateStr].morning = rec.status;
        else if (s === 'afternoon') byDate[dateStr].afternoon = rec.status;
        else byDate[dateStr].daily = rec.status;

        if (!groups[key].lastUpdated || rec.date > groups[key].lastUpdated) {
          groups[key].lastUpdated = rec.date;
        }
      });

      Object.values(byDate).forEach(entry => {
        const { morning: m, afternoon: a, daily: d } = entry;
        if (m !== undefined || a !== undefined) {
          if (m !== undefined && a !== undefined) {
             if (isP(m) && isP(a)) groups[key].present++;
             else if (isAttendance(m) && isAttendance(a)) groups[key].late++;
             else if (isE(m) && isE(a)) groups[key].excused++;
             else if (isA(m) && isA(a)) groups[key].absent++;
          }
        } else if (d !== undefined) {
          if (isP(d)) groups[key].present++;
          else if (isL(d)) groups[key].late++;
          else if (isE(d)) groups[key].excused++;
          else if (isA(d)) groups[key].absent++;
        }
      });
    } else {
      const byDate: Record<string, string> = {};
      records.forEach(rec => {
        const dateStr = rec.date.toISOString().split('T')[0];
        if (!byDate[dateStr]) {
          byDate[dateStr] = rec.status?.toLowerCase();
        }
      });
      Object.values(byDate).forEach(s => {
        if (s === 'present') groups[key].present++;
        else if (s === 'late') groups[key].late++;
        else if (s === 'excused') groups[key].excused++;
        else if (s === 'absent') groups[key].absent++;
      });
    }
  });

  return Object.values(groups).map(group => {
    const total = group.present + group.late + group.excused + group.absent;
    return {
      ...group,
      attendanceRate: total > 0
        ? Math.round(((group.present + group.late + group.excused) / total) * 100)
        : 0
    };
  });
};

export const getAttendanceTrends = async (schoolId: string, filters: any) => {
  const { startDate, endDate, grade, section, stream, session, mode } = filters;
  const isFullDay = !session || session === 'total';
  const isSessionMode = mode === 'session_based';

  const where: any = { schoolId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  // Filter records by student attributes if provided
  const studentWhere: any = { schoolId };
  if (grade && grade !== 'all') studentWhere.grade = { name: grade };
  if (section && section !== 'all') studentWhere.section = { name: section };
  if (stream && stream !== 'all') studentWhere.stream = { name: stream };

  if (grade || section || stream) {
    where.student = studentWhere;
  }

  if (!isFullDay) {
    where.session = { equals: session.trim().toLowerCase(), mode: 'insensitive' };
  } else if (mode === 'session_based') {
    where.session = { not: null };
  } else if (mode === 'daily') {
    where.session = null;
  }

  const allRecords = await prisma.attendance.findMany({
    where,
    select: { studentId: true, date: true, session: true, status: true },
    orderBy: { date: 'asc' }
  });

  const byDateStudent: Record<string, Record<string, { morning?: string; afternoon?: string; daily?: string }>> = {};
  allRecords.forEach(rec => {
    const recHasSession = !!rec.session;
    if (isSessionMode && !recHasSession) return;
    if (!isSessionMode && recHasSession) return;

    const dateStr = rec.date.toISOString().split('T')[0];
    if (!byDateStudent[dateStr]) byDateStudent[dateStr] = {};
    if (!byDateStudent[dateStr][rec.studentId]) byDateStudent[dateStr][rec.studentId] = {};
    const s = rec.session?.toLowerCase();
    if (s === 'morning') byDateStudent[dateStr][rec.studentId].morning = rec.status;
    else if (s === 'afternoon') byDateStudent[dateStr][rec.studentId].afternoon = rec.status;
    else byDateStudent[dateStr][rec.studentId].daily = rec.status;
  });

  return Object.entries(byDateStudent).map(([dateStr, studentMap]) => {
    let presentCount = 0;
    const total = Object.keys(studentMap).length;

    Object.values(studentMap).forEach(entry => {
      const { morning: m, afternoon: a, daily: d } = entry;
      if (isFullDay) {
        if (m !== undefined && a !== undefined) {
          if (isAttendance(m) && isAttendance(a)) presentCount++;
          else if (isE(m) && isE(a)) presentCount++; 
        } else if (d !== undefined && (isAttendance(d) || isE(d))) {
          presentCount++;
        }
      } else {
        const s = m || a || d;
        if (isAttendance(s) || isE(s)) presentCount++;
      }
    });

    return {
      date: dateStr,
      rate: total > 0 ? Math.round((presentCount / total) * 100) : 0
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
};

export const getDrillDownStats = async (schoolId: string, gradeId: string, filters: any) => {
  const { startDate, endDate, sectionId, streamId, mode } = filters;
  const isSessionMode = mode === 'session_based';
  
  const where: any = { 
    schoolId, 
    gradeId, 
    ...(sectionId && sectionId !== 'all' ? { sectionId } : {}), 
    ...(streamId && streamId !== 'all' ? { streamId } : {}) 
  };

  const students = await prisma.student.findMany({
    where,
    include: {
      section: true,
      stream: true,
      attendance: {
        where: { 
          schoolId, 
          ...(startDate || endDate ? { 
            date: { 
              ...(startDate ? { gte: new Date(startDate) } : {}), 
              ...(endDate ? { lte: new Date(endDate) } : {}) 
            } 
          } : {}) 
        },
        orderBy: { date: 'desc' }
      }
    }
  });

  return students.map(student => {
    const stats = {
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
    };

    const byDate: Record<string, { morning?: string; afternoon?: string; daily?: string }> = {};

    student.attendance.forEach(rec => {
      const recHasSession = !!rec.session;
      if (isSessionMode && !recHasSession) return;
      if (!isSessionMode && recHasSession) return;

      const dStr = rec.date.toISOString().split('T')[0];
      if (!byDate[dStr]) byDate[dStr] = {};
      const s = rec.session?.toLowerCase();
      if (s === 'morning') byDate[dStr].morning = rec.status;
      else if (s === 'afternoon') byDate[dStr].afternoon = rec.status;
      else byDate[dStr].daily = rec.status;
    });

    Object.values(byDate).forEach(entry => {
      const { morning: m, afternoon: a, daily: d } = entry;
      if (m !== undefined || a !== undefined) {
        if (m !== undefined && a !== undefined) {
          if (isP(m) && isP(a)) stats.present++;
          else if (isAttendance(m) && isAttendance(a)) stats.late++;
          else if (isE(m) && isE(a)) stats.excused++;
          else if (isA(m) && isA(a)) stats.absent++;
        }
      } else if (d !== undefined) {
        if (isP(d)) stats.present++;
        else if (isL(d)) stats.late++;
        else if (isE(d)) stats.excused++;
        else if (isA(d)) stats.absent++;
      }
    });

    const total = stats.present + stats.late + stats.excused + stats.absent;
    return {
      id: student.id,
      studentId: student.student_id,
      fullName: student.fullName,
      section: student.section.name,
      stream: student.stream?.name || null,
      ...stats,
      attendanceRate: total > 0 ? Math.round(((stats.present + stats.late + stats.excused) / total) * 100) : 0,
      recentAttendance: student.attendance.slice(0, 5)
    };
  });
};
