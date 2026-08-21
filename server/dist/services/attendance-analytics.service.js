"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDrillDownStats = exports.getAttendanceTrends = exports.getGradeStats = exports.getAttendanceSummary = void 0;
const db_1 = __importDefault(require("../config/db"));
const academic_year_service_1 = require("./academic-year.service");
const isP = (s) => s?.toLowerCase() === 'present';
const isL = (s) => s?.toLowerCase() === 'late';
const isE = (s) => s?.toLowerCase() === 'excused';
const isA = (s) => s?.toLowerCase() === 'absent';
const isAttendance = (s) => isP(s) || isL(s);
const getAttendanceSummary = async (_schoolId, filters) => {
    const { startDate, endDate, academicYear, session, grade, section, stream, mode } = filters;
    const isFullDay = !session || session === 'total';
    const isSessionMode = mode === 'session_based';
    const where = {};
    if (!academicYear || academicYear === 'current' || academicYear === 'active') {
        const activeAY = await academic_year_service_1.academicYearService.getCurrentAcademicYear();
        if (activeAY)
            where.academicYearId = activeAY.id;
    }
    else if (academicYear && academicYear !== 'all') {
        const targetAY = await db_1.default.academicYear.findUnique({
            where: { name: academicYear }
        });
        if (targetAY)
            where.academicYearId = targetAY.id;
    }
    if (startDate || endDate) {
        where.date = {};
        if (startDate)
            where.date.gte = new Date(startDate);
        if (endDate)
            where.date.lte = new Date(endDate);
    }
    if (!isFullDay) {
        where.session = { equals: session.trim().toLowerCase(), mode: 'insensitive' };
    }
    else if (mode === 'session_based') {
        where.session = { not: null };
    }
    else if (mode === 'daily') {
        where.session = null;
    }
    const studentWhere = {};
    if (grade && grade !== 'all')
        studentWhere.grade = { name: grade };
    if (section && section !== 'all')
        studentWhere.section = { name: section };
    if (stream && stream !== 'all')
        studentWhere.stream = { name: stream };
    if (grade || section || stream) {
        where.student = studentWhere;
    }
    const totalStudents = await db_1.default.student.count({ where: studentWhere });
    if (isFullDay) {
        const allRecords = await db_1.default.attendance.findMany({
            where,
            select: { studentId: true, date: true, session: true, status: true }
        });
        const byStudentDate = {};
        allRecords.forEach(rec => {
            const recHasSession = !!rec.session;
            if (isSessionMode && !recHasSession)
                return;
            if (!isSessionMode && recHasSession)
                return;
            const dateStr = rec.date.toISOString().split('T')[0];
            const key = `${rec.studentId}||${dateStr}`;
            if (!byStudentDate[key])
                byStudentDate[key] = {};
            const sess = rec.session?.toLowerCase();
            if (sess === 'morning')
                byStudentDate[key].morning = rec.status;
            else if (sess === 'afternoon')
                byStudentDate[key].afternoon = rec.status;
            else
                byStudentDate[key].daily = rec.status;
        });
        let present = 0;
        let late = 0;
        let excused = 0;
        let absent = 0;
        Object.values(byStudentDate).forEach(entry => {
            const { morning: m, afternoon: a, daily: d } = entry;
            if (m !== undefined || a !== undefined) {
                if (m !== undefined && a !== undefined) {
                    if (isP(m) && isP(a))
                        present++;
                    else if (isAttendance(m) && isAttendance(a))
                        late++;
                    else if (isE(m) && isE(a))
                        excused++;
                    else if (isA(m) && isA(a))
                        absent++;
                }
            }
            else if (d !== undefined) {
                if (isP(d))
                    present++;
                else if (isL(d))
                    late++;
                else if (isE(d))
                    excused++;
                else if (isA(d))
                    absent++;
            }
        });
        const totalRecorded = present + late + excused + absent;
        return {
            totalStudents,
            totalRecorded,
            present,
            late,
            excused,
            absent,
            attendanceRate: totalRecorded > 0
                ? Math.round(((present + late + excused) / totalRecorded) * 100)
                : 0
        };
    }
    else {
        const records = await db_1.default.attendance.findMany({
            where,
            select: { studentId: true, status: true, date: true }
        });
        const byDateStudent = {};
        records.forEach(r => {
            const dateStr = r.date.toISOString().split('T')[0];
            const key = `${r.studentId}||${dateStr}`;
            if (!byDateStudent[key]) {
                byDateStudent[key] = r.status.toLowerCase();
            }
        });
        const stats = {
            totalStudents,
            totalRecorded: Object.keys(byDateStudent).length,
            present: 0,
            late: 0,
            excused: 0,
            absent: 0,
            attendanceRate: 0
        };
        Object.values(byDateStudent).forEach(status => {
            if (status === 'present')
                stats.present++;
            else if (status === 'late')
                stats.late++;
            else if (status === 'excused')
                stats.excused++;
            else if (status === 'absent')
                stats.absent++;
        });
        const totalRecorded = stats.present + stats.late + stats.excused + stats.absent;
        stats.attendanceRate = totalRecorded > 0
            ? Math.round(((stats.present + stats.late + stats.excused) / totalRecorded) * 100)
            : 0;
        return stats;
    }
};
exports.getAttendanceSummary = getAttendanceSummary;
const getGradeStats = async (_schoolId, filters) => {
    const { startDate, endDate, session, grade, section, stream, mode } = filters;
    const isFullDay = !session || session === 'total';
    const isSessionMode = mode === 'session_based';
    const where = {};
    if (startDate || endDate) {
        where.date = {};
        if (startDate)
            where.date.gte = new Date(startDate);
        if (endDate)
            where.date.lte = new Date(endDate);
    }
    if (!isFullDay) {
        where.session = { equals: session.trim().toLowerCase(), mode: 'insensitive' };
    }
    else if (mode === 'session_based') {
        where.session = { not: null };
    }
    else if (mode === 'daily') {
        where.session = null;
    }
    const studentWhere = {};
    if (grade && grade !== 'all')
        studentWhere.grade = { name: grade };
    if (section && section !== 'all')
        studentWhere.section = { name: section };
    if (stream && stream !== 'all')
        studentWhere.stream = { name: stream };
    if (grade || section || stream) {
        where.student = studentWhere;
    }
    const students = await db_1.default.student.findMany({
        where: studentWhere,
        include: { grade: true, section: true, stream: true }
    });
    const attendance = await db_1.default.attendance.findMany({
        where,
        select: { studentId: true, status: true, date: true, session: true }
    });
    const attendanceMap = {};
    attendance.forEach(rec => {
        const recHasSession = !!rec.session;
        if (isSessionMode && !recHasSession)
            return;
        if (!isSessionMode && recHasSession)
            return;
        if (!attendanceMap[rec.studentId])
            attendanceMap[rec.studentId] = [];
        attendanceMap[rec.studentId].push(rec);
    });
    const groups = {};
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
                lastUpdated: null,
            };
        }
        groups[key].totalStudents++;
        const records = attendanceMap[student.id] || [];
        if (isFullDay) {
            const byDate = {};
            records.forEach(rec => {
                const dateStr = rec.date.toISOString().split('T')[0];
                if (!byDate[dateStr])
                    byDate[dateStr] = {};
                const s = rec.session?.toLowerCase();
                if (s === 'morning')
                    byDate[dateStr].morning = rec.status;
                else if (s === 'afternoon')
                    byDate[dateStr].afternoon = rec.status;
                else
                    byDate[dateStr].daily = rec.status;
                if (!groups[key].lastUpdated || rec.date > groups[key].lastUpdated) {
                    groups[key].lastUpdated = rec.date;
                }
            });
            Object.values(byDate).forEach(entry => {
                const { morning: m, afternoon: a, daily: d } = entry;
                if (m !== undefined || a !== undefined) {
                    if (m !== undefined && a !== undefined) {
                        if (isP(m) && isP(a))
                            groups[key].present++;
                        else if (isAttendance(m) && isAttendance(a))
                            groups[key].late++;
                        else if (isE(m) && isE(a))
                            groups[key].excused++;
                        else if (isA(m) && isA(a))
                            groups[key].absent++;
                    }
                }
                else if (d !== undefined) {
                    if (isP(d))
                        groups[key].present++;
                    else if (isL(d))
                        groups[key].late++;
                    else if (isE(d))
                        groups[key].excused++;
                    else if (isA(d))
                        groups[key].absent++;
                }
            });
        }
        else {
            const byDate = {};
            records.forEach(rec => {
                const dateStr = rec.date.toISOString().split('T')[0];
                if (!byDate[dateStr]) {
                    byDate[dateStr] = rec.status?.toLowerCase();
                }
            });
            Object.values(byDate).forEach(s => {
                if (s === 'present')
                    groups[key].present++;
                else if (s === 'late')
                    groups[key].late++;
                else if (s === 'excused')
                    groups[key].excused++;
                else if (s === 'absent')
                    groups[key].absent++;
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
exports.getGradeStats = getGradeStats;
const getAttendanceTrends = async (_schoolId, filters) => {
    const { startDate, endDate, grade, section, stream, session, mode } = filters;
    const isFullDay = !session || session === 'total';
    const isSessionMode = mode === 'session_based';
    const where = {};
    if (startDate || endDate) {
        where.date = {};
        if (startDate)
            where.date.gte = new Date(startDate);
        if (endDate)
            where.date.lte = new Date(endDate);
    }
    const studentWhere = {};
    if (grade && grade !== 'all')
        studentWhere.grade = { name: grade };
    if (section && section !== 'all')
        studentWhere.section = { name: section };
    if (stream && stream !== 'all')
        studentWhere.stream = { name: stream };
    if (grade || section || stream) {
        where.student = studentWhere;
    }
    if (!isFullDay) {
        where.session = { equals: session.trim().toLowerCase(), mode: 'insensitive' };
    }
    else if (mode === 'session_based') {
        where.session = { not: null };
    }
    else if (mode === 'daily') {
        where.session = null;
    }
    const allRecords = await db_1.default.attendance.findMany({
        where,
        select: { studentId: true, date: true, session: true, status: true },
        orderBy: { date: 'asc' }
    });
    const byDateStudent = {};
    allRecords.forEach(rec => {
        const recHasSession = !!rec.session;
        if (isSessionMode && !recHasSession)
            return;
        if (!isSessionMode && recHasSession)
            return;
        const dateStr = rec.date.toISOString().split('T')[0];
        if (!byDateStudent[dateStr])
            byDateStudent[dateStr] = {};
        if (!byDateStudent[dateStr][rec.studentId])
            byDateStudent[dateStr][rec.studentId] = {};
        const s = rec.session?.toLowerCase();
        if (s === 'morning')
            byDateStudent[dateStr][rec.studentId].morning = rec.status;
        else if (s === 'afternoon')
            byDateStudent[dateStr][rec.studentId].afternoon = rec.status;
        else
            byDateStudent[dateStr][rec.studentId].daily = rec.status;
    });
    return Object.entries(byDateStudent).map(([dateStr, studentMap]) => {
        let presentCount = 0;
        const total = Object.keys(studentMap).length;
        Object.values(studentMap).forEach(entry => {
            const { morning: m, afternoon: a, daily: d } = entry;
            if (isFullDay) {
                if (m !== undefined && a !== undefined) {
                    if (isAttendance(m) && isAttendance(a))
                        presentCount++;
                    else if (isE(m) && isE(a))
                        presentCount++;
                }
                else if (d !== undefined && (isAttendance(d) || isE(d))) {
                    presentCount++;
                }
            }
            else {
                const s = m || a || d;
                if (isAttendance(s) || isE(s))
                    presentCount++;
            }
        });
        return {
            date: dateStr,
            rate: total > 0 ? Math.round((presentCount / total) * 100) : 0
        };
    }).sort((a, b) => a.date.localeCompare(b.date));
};
exports.getAttendanceTrends = getAttendanceTrends;
const getDrillDownStats = async (_schoolId, gradeId, filters) => {
    const { startDate, endDate, sectionId, streamId, mode } = filters;
    const isSessionMode = mode === 'session_based';
    const where = {
        gradeId,
        ...(sectionId && sectionId !== 'all' ? { sectionId } : {}),
        ...(streamId && streamId !== 'all' ? { streamId } : {})
    };
    const students = await db_1.default.student.findMany({
        where,
        include: {
            section: true,
            stream: true,
            attendance: {
                where: {
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
        const byDate = {};
        student.attendance.forEach(rec => {
            const recHasSession = !!rec.session;
            if (isSessionMode && !recHasSession)
                return;
            if (!isSessionMode && recHasSession)
                return;
            const dStr = rec.date.toISOString().split('T')[0];
            if (!byDate[dStr])
                byDate[dStr] = {};
            const s = rec.session?.toLowerCase();
            if (s === 'morning')
                byDate[dStr].morning = rec.status;
            else if (s === 'afternoon')
                byDate[dStr].afternoon = rec.status;
            else
                byDate[dStr].daily = rec.status;
        });
        Object.values(byDate).forEach(entry => {
            const { morning: m, afternoon: a, daily: d } = entry;
            if (m !== undefined || a !== undefined) {
                if (m !== undefined && a !== undefined) {
                    if (isP(m) && isP(a))
                        stats.present++;
                    else if (isAttendance(m) && isAttendance(a))
                        stats.late++;
                    else if (isE(m) && isE(a))
                        stats.excused++;
                    else if (isA(m) && isA(a))
                        stats.absent++;
                }
            }
            else if (d !== undefined) {
                if (isP(d))
                    stats.present++;
                else if (isL(d))
                    stats.late++;
                else if (isE(d))
                    stats.excused++;
                else if (isA(d))
                    stats.absent++;
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
exports.getDrillDownStats = getDrillDownStats;
