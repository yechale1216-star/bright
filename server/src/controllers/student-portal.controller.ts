import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/db';
import { generateToken } from '../utils/jwt';
import * as smsService from '../services/sms.service';
import * as userService from '../services/user.service';
import { validatePassword } from '../utils/password-validator';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const getStudentByUserId = async (userId: string) => {
  return prisma.student.findFirst({
    where: { user_id: userId },
    include: { grade: true, section: true, stream: true },
  });
};

const getActiveAcademicYear = async () => {
  return prisma.academicYear.findFirst({
    where: { isCurrent: true },
    include: { terms: { where: { isCurrent: true }, take: 1 } },
  });
};

function computeGrade(score: number, maxScore: number): string {
  if (maxScore === 0) return 'N/A';
  const pct = (score / maxScore) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 85) return 'A';
  if (pct >= 80) return 'B+';
  if (pct >= 75) return 'B';
  if (pct >= 70) return 'C+';
  if (pct >= 65) return 'C';
  if (pct >= 60) return 'D+';
  if (pct >= 50) return 'D';
  return 'F';
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, password } = req.body;
    if (!studentId || !password) {
      return res.status(400).json({ success: false, message: 'Student ID and password are required.' });
    }
    const student = await prisma.student.findUnique({
      where: { student_id: studentId.trim() },
      include: { grade: true, section: true, stream: true },
    }) as any;
    if (!student) {
      return res.status(401).json({ success: false, message: 'Invalid Student ID or password.' });
    }

    // Block pending-activation accounts — they must complete account activation first
    if (student.accountStatus === 'PENDING_ACTIVATION') {
      return res.status(403).json({
        success: false,
        requiresActivation: true,
        message: 'Your account is pending activation. Please activate your account using your activation code.',
      });
    }

    if (student.accountStatus !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact your school administrator.',
      });
    }

    if (!student.user_id) {
      return res.status(401).json({
        success: false,
        requiresActivation: true,
        message: 'Your account has not been activated yet. Please activate your account first.',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: student.user_id } });
    if (!user || !user.password_hash) {
      return res.status(401).json({ success: false, message: 'Invalid Student ID or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid Student ID or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact the school.' });
    }

    const school = await prisma.schoolSettings.findFirst();
    const token = generateToken({
      id: user.id,
      email: user.email || `student-${studentId}@brightpath.edu.et`,
      role: 'student',
      schoolId: 'single-school',
    });
    return res.status(200).json({
      success: true,
      token,
      student: {
        id: student.id,
        student_id: student.student_id,
        fullName: student.fullName,
        grade: student.grade?.name || '',
        section: student.section?.name || '',
        stream: student.stream?.name || null,
        photo: user.profile_photo || null,
      },
      school: { id: 'single-school', name: school?.school_name || 'Bright Path', logo: school?.school_logo || '' },
    });
  } catch (err) { next(err); }
};

// ─── ACTIVATION ────────────────────────────────────────────────────────────────

// Step 1: Verify the one-time activation code printed on the school slip
export const verifyActivationCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, activationCode } = req.body;
    if (!studentId || !activationCode) {
      return res.status(400).json({ success: false, message: 'Student ID and activation code are required.' });
    }
    const student = await prisma.student.findUnique({ where: { student_id: studentId.trim() } }) as any;
    if (!student) {
      return res.status(400).json({ success: false, message: 'Invalid Student ID or activation code.' });
    }
    if (student.accountStatus === 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'This account has already been activated. Please sign in normally.' });
    }
    if (student.accountStatus !== 'PENDING_ACTIVATION') {
      return res.status(400).json({ success: false, message: 'This account is not pending activation. Please contact the school.' });
    }
    if (!student.activation_code) {
      return res.status(400).json({ success: false, message: 'Invalid activation code.' });
    }
    if (student.activation_code_expires && new Date(student.activation_code_expires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Activation code has expired. Please ask your school to regenerate it.' });
    }

    const cleanedCode = activationCode.trim().toUpperCase();
    const isMatch = student.activation_code.startsWith('$2')
      ? await bcrypt.compare(cleanedCode, student.activation_code)
      : student.activation_code === cleanedCode;

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid activation code. Check your school-issued slip.' });
    }

    return res.status(200).json({ success: true, studentName: student.fullName, message: 'Code verified. Please set your password.' });
  } catch (err) { next(err); }
};

// Step 2: Set password and activate the account atomically
export const activateAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, activationCode, newPassword, confirmPassword } = req.body;
    if (!studentId || !activationCode || !newPassword) {
      return res.status(400).json({ success: false, message: 'Student ID, activation code, and new password are required.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const trimmedStudentId = studentId.trim();
    const cleanedCode = activationCode.trim().toUpperCase();

    if (newPassword.trim().toLowerCase() === trimmedStudentId.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Your password cannot be the same as your Student ID.' });
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    // Atomic activation transaction
    const activationResult = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { student_id: trimmedStudentId },
        include: { grade: true, section: true, stream: true },
      }) as any;

      if (!student) {
        const err: any = new Error('Invalid Student ID or activation code.');
        err.statusCode = 400;
        throw err;
      }

      if (student.accountStatus === 'ACTIVE') {
        const err: any = new Error('This account has already been activated. Please sign in with your password.');
        err.statusCode = 400;
        throw err;
      }

      if (student.accountStatus !== 'PENDING_ACTIVATION') {
        const err: any = new Error('Account is not in a valid state for activation. Please contact the school.');
        err.statusCode = 400;
        throw err;
      }

      if (!student.activation_code) {
        const err: any = new Error('Invalid activation code.');
        err.statusCode = 400;
        throw err;
      }

      if (student.activation_code_expires && new Date(student.activation_code_expires) < new Date()) {
        const err: any = new Error('Activation code has expired. Please contact your school to issue a replacement.');
        err.statusCode = 400;
        throw err;
      }

      const isMatch = student.activation_code.startsWith('$2')
        ? await bcrypt.compare(cleanedCode, student.activation_code)
        : student.activation_code === cleanedCode;

      if (!isMatch) {
        const err: any = new Error('Invalid activation code. Please check your school-issued slip.');
        err.statusCode = 400;
        throw err;
      }

      // Atomic single-use consumption of activation code and state transition
      const updateCount = await tx.student.updateMany({
        where: {
          id: student.id,
          accountStatus: 'PENDING_ACTIVATION',
          activation_code: student.activation_code,
        },
        data: {
          accountStatus: 'ACTIVE',
          activation_code: null,
          activation_code_expires: null,
        },
      });

      if (updateCount.count === 0) {
        const err: any = new Error('This account is already being activated or has already been activated.');
        err.statusCode = 409;
        throw err;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const portalEmail = `student-${trimmedStudentId.toLowerCase().replace(/[^a-z0-9]/g, '')}@brightpath.edu.et`;

      let user = await tx.user.findUnique({ where: { email: portalEmail } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: portalEmail,
            password_hash: hashedPassword,
            full_name: student.fullName,
            role: 'student',
            is_active: true,
            is_verified: true,
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            password_hash: hashedPassword,
            full_name: student.fullName,
            role: 'student',
            is_active: true,
            is_verified: true,
          },
        });
      }

      await tx.student.update({
        where: { id: student.id },
        data: { user_id: user.id },
      });

      return { student, user };
    });

    const school = await prisma.schoolSettings.findFirst();
    const token = generateToken({
      id: activationResult.user.id,
      email: activationResult.user.email,
      role: 'student',
      schoolId: 'single-school',
    });

    return res.status(200).json({
      success: true,
      message: 'Account activated successfully! Welcome to Bright Path.',
      token,
      student: {
        id: activationResult.student.id,
        student_id: activationResult.student.student_id,
        fullName: activationResult.student.fullName,
        grade: activationResult.student.grade?.name || '',
        section: activationResult.student.section?.name || '',
        stream: activationResult.student.stream?.name || null,
        photo: activationResult.user.profile_photo || null,
      },
      school: { id: 'single-school', name: school?.school_name || 'Bright Path', logo: school?.school_logo || '' },
    });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required.' });
    }
    const student = await prisma.student.findUnique({ where: { student_id: studentId.trim() } }) as any;
    if (!student || !student.user_id) {
      await new Promise((r) => setTimeout(r, 120));
      return res.status(200).json({ success: true, maskedPhone: null, message: 'If this student ID exists, an OTP was sent to the registered phone.' });
    }
    if (student.accountStatus === 'PENDING_ACTIVATION') {
      return res.status(400).json({ success: false, message: 'Your account is not yet activated. Please use your activation code from your school slip.' });
    }
    const user = await prisma.user.findUnique({ where: { id: student.user_id } });
    if (!user) return res.status(200).json({ success: true, maskedPhone: null });
    const phone = student.parent_phone;
    if (!phone) {
      return res.status(200).json({ success: true, maskedPhone: null, message: 'No phone number is linked to this account. Contact the school.' });
    }
    const code = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { verification_token: code, verification_token_expires: expires } });
    const maskedPhone = phone.length >= 4 ? phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4) : '****';
    const smsText = `Your Bright Path Student Portal password reset code is: ${code}. Valid for 15 minutes. Do not share this code.`;
    const smsSent = await smsService.sendSMS(phone, smsText);
    const debugCode = process.env.NODE_ENV !== 'production' ? code : undefined;
    return res.status(200).json({
      success: true, maskedPhone, smsSent: smsSent.success,
      message: smsSent.success ? `OTP sent to ${maskedPhone}` : `SMS delivery failed (${smsSent.error || 'Unknown error'}). Contact your school if this persists.`,
      ...(debugCode ? { debugCode } : {}),
    });
  } catch (err) { next(err); }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, code } = req.body;
    if (!studentId || !code) {
      return res.status(400).json({ success: false, message: 'Student ID and OTP code are required.' });
    }
    const student = await prisma.student.findUnique({ where: { student_id: studentId.trim() } });
    if (!student?.user_id) return res.status(400).json({ success: false, message: 'Invalid student or OTP.' });
    const user = await prisma.user.findUnique({ where: { id: student.user_id } });
    if (!user || user.verification_token !== code || !user.verification_token_expires || user.verification_token_expires < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }
    return res.status(200).json({ success: true, message: 'OTP verified successfully.' });
  } catch (err) { next(err); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, code, newPassword } = req.body;
    if (!studentId || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Student ID, OTP code, and new password are required.' });
    }
    const student = await prisma.student.findUnique({ where: { student_id: studentId.trim() } });
    if (!student?.user_id) return res.status(400).json({ success: false, message: 'Invalid student or OTP.' });
    const user = await prisma.user.findUnique({ where: { id: student.user_id } });
    if (!user || user.verification_token !== code || !user.verification_token_expires || user.verification_token_expires < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }
    const validation = validatePassword(newPassword);
    if (!validation.isValid) return res.status(400).json({ success: false, message: validation.error });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: hashedPassword, verification_token: null, verification_token_expires: null },
    });
    return res.status(200).json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (err) { next(err); }
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export const getDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const student = await getStudentByUserId(userId);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    const academicYear = await getActiveAcademicYear();

    const attendanceRecords = await prisma.attendance.findMany({
      where: { studentId: student.id, ...(academicYear ? { academicYearId: academicYear.id } : {}) },
      select: { status: true },
    });
    const presentDays = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    const absentDays = attendanceRecords.filter((a) => a.status === 'ABSENT').length;
    const lateDays = attendanceRecords.filter((a) => a.status === 'LATE').length;
    const totalDays = attendanceRecords.length;
    const attendancePercentage = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 0;

    const recentMarksRaw = await prisma.studentMark.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { assessment: { include: { subject: true } } },
    });
    const recentMarks = recentMarksRaw.map((m) => ({
      id: m.id, subject: m.assessment.subject.name, assessment: m.assessment.title,
      score: `${m.score ?? 0}/${m.assessment.maxScore}`, grade: computeGrade(m.score ?? 0, m.assessment.maxScore), date: m.createdAt,
    }));

    const allMarks = await prisma.studentMark.findMany({
      where: { studentId: student.id, ...(academicYear ? { assessment: { academicYearId: academicYear.id } } : {}) },
      include: { assessment: { select: { maxScore: true } } },
    });
    const overallAverage = allMarks.length > 0
      ? Math.round((allMarks.reduce((sum, m) => sum + ((m.score ?? 0) / m.assessment.maxScore) * 100, 0) / allMarks.length) * 10) / 10
      : 0;

    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const todayDay = dayNames[new Date().getDay()];
    const todaySlots = await prisma.timetableSlot.findMany({
      where: { gradeId: student.gradeId, sectionId: student.sectionId, dayOfWeek: todayDay, isCancelled: false, timetable: { status: 'PUBLISHED' } },
      orderBy: { periodNumber: 'asc' },
      include: { subject: true, teacher: true, classroom: true },
    });
    const todayTimetable = todaySlots.map((slot) => ({
      id: slot.id, time: `${slot.startTime} - ${slot.endTime}`, subject: slot.subject.name,
      teacher: slot.teacher?.name || 'TBA', room: slot.classroom?.name || 'TBA', periodNumber: slot.periodNumber,
    }));

    const announcementsRaw = await prisma.parentNotification.findMany({
      where: {
        type: { in: ['announcement', 'emergency', 'info'] }, studentId: null,
        OR: [{ targetAudience: { in: ['GENERAL', 'PARENTS', 'general', 'parents'] } }, { targetAudience: null }],
      },
      orderBy: { createdAt: 'desc' }, take: 5,
    });
    const announcements = announcementsRaw.map((a) => ({ id: a.id, title: a.title, message: a.message, date: a.createdAt, category: a.type || 'announcement' }));

    return res.status(200).json({
      success: true,
      data: {
        student: { id: student.id, student_id: student.student_id, name: student.fullName, grade: student.grade?.name || '', section: student.section?.name || '', stream: student.stream?.name || null, photo: null },
        academicYear: academicYear?.name || '',
        stats: { overallAverage, averageTrend: '', attendancePercentage, attendanceStatus: attendancePercentage >= 90 ? 'Excellent' : attendancePercentage >= 75 ? 'Good' : 'Needs Improvement', presentDays, absentDays, lateDays },
        todayTimetable, recentMarks, announcements,
      },
    });
  } catch (err) { next(err); }
};

// ─── PROFILE ──────────────────────────────────────────────────────────────────

export const getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const student = await prisma.student.findFirst({
      where: { user_id: userId },
      include: {
        grade: true,
        section: true,
        stream: true,
        academicRecords: {
          include: {
            academicYear: true,
            grade: true,
            section: true,
            stream: true,
          },
          orderBy: { enrolledAt: 'desc' },
        },
      },
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, profile_photo: true },
    });

    const activeRecord = student.academicRecords[0];

    const basicInfo = {
      fullName: student.fullName,
      studentId: student.student_id,
      grade: student.grade?.name || '',
      section: student.section?.name || '',
      stream: student.stream?.name || null,
      academicYear: activeRecord?.academicYear?.name || '',
      dateOfBirth: student.date_of_birth,
      gender: student.gender,
      phone: user?.phone || student.parent_phone || '',
      address: student.address || '',
      status: student.status,
      photo: user?.profile_photo || null,
      email: user?.email || null,
    };

    const academicHistory = student.academicRecords.length > 0
      ? student.academicRecords.map((r, idx) => ({
          id: r.id || `h-${idx}`,
          year: r.academicYear?.name || 'Academic Year',
          grade: r.grade?.name ? `Grade ${r.grade.name}` : student.grade?.name ? `Grade ${student.grade.name}` : '',
          section: r.section?.name ? `Section ${r.section.name}` : student.section?.name ? `Section ${student.section.name}` : '',
          stream: r.stream?.name || student.stream?.name || 'General',
          status: r.status || (idx === 0 ? 'CURRENT' : 'PROMOTED'),
        }))
      : [
          {
            id: 'current-rec',
            year: activeRecord?.academicYear?.name || 'Current Year',
            grade: student.grade?.name ? `Grade ${student.grade.name}` : 'Grade 12',
            section: student.section?.name ? `Section ${student.section.name}` : 'Section A',
            stream: student.stream?.name || 'General',
            status: 'CURRENT',
          },
        ];

    const contactInfo = {
      parentName: student.parent_name,
      parentPhone: student.parent_phone,
      parentEmail: student.parent_email,
      address: student.address || '',
    };

    return res.status(200).json({
      success: true,
      data: {
        id: student.id,
        student_id: student.student_id,
        fullName: student.fullName,
        gender: student.gender,
        date_of_birth: student.date_of_birth,
        address: student.address,
        grade: student.grade?.name || '',
        section: student.section?.name || '',
        stream: student.stream?.name || null,
        parent_name: student.parent_name,
        parent_phone: student.parent_phone,
        parent_email: student.parent_email,
        photo: user?.profile_photo || null,
        email: user?.email || null,
        phone: user?.phone || null,
        status: student.status,
        academicYear: activeRecord?.academicYear?.name || '',
        enrolledAt: activeRecord?.enrolledAt || student.createdAt,
        basicInfo,
        academicHistory,
        contactInfo,
      },
    });
  } catch (err) { next(err); }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const student = await getStudentByUserId(userId);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    const { address, photo, phone } = req.body;

    if (address !== undefined) {
      await prisma.student.update({
        where: { id: student.id },
        data: { address: address ? String(address).trim() : null },
      });
    }

    const userUpdates: any = {};
    if (photo !== undefined) userUpdates.profile_photo = photo;
    if (phone !== undefined) userUpdates.phone = phone ? String(phone).trim() : null;

    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdates,
      });
    }

    return res.status(200).json({ success: true, message: 'Profile updated successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err?.message || 'Failed to update profile.' });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    const val = validatePassword(newPassword);
    if (!val.isValid) {
      return res.status(400).json({ success: false, message: val.error || 'Password does not meet security requirements.' });
    }

    await userService.changePassword(userId, currentPassword, newPassword);
    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err?.message || 'Failed to update password.' });
  }
};

// ─── CLASSES ─────────────────────────────────────────────────────────────────

export const getClasses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const student = await getStudentByUserId(userId);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const academicYear = await getActiveAcademicYear();
    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        gradeId: student.gradeId, sectionId: student.sectionId,
        ...(student.streamId ? { OR: [{ streamId: student.streamId }, { streamId: null }] } : {}),
        ...(academicYear ? { academicYearId: academicYear.id } : {}),
      },
      include: { teacher: true, subjectRef: true },
      distinct: ['subjectId'],
    });
    const classes = assignments.map((a) => ({
      id: a.id, subject: a.subjectRef?.name || a.subject || 'Unknown Subject', subjectId: a.subjectId,
      subjectCode: a.subjectRef?.code || '', subjectColor: a.subjectRef?.color || '#6366f1',
      teacher: a.teacher?.name || 'TBA', teacherPhoto: a.teacher?.profile_photo || null, role: a.role,
    }));
    return res.status(200).json({ success: true, data: classes });
  } catch (err) { next(err); }
};

// ─── MARKS ───────────────────────────────────────────────────────────────────

export const getMarks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const student = await getStudentByUserId(userId);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const { academicYearId, termId, subjectId } = req.query as any;
    const academicYear = await getActiveAcademicYear();
    const effectiveYearId = academicYearId || academicYear?.id;
    const marks = await prisma.studentMark.findMany({
      where: {
        studentId: student.id,
        assessment: {
          ...(effectiveYearId ? { academicYearId: effectiveYearId } : {}),
          ...(termId ? { academicTermId: termId } : {}),
          ...(subjectId ? { subjectId } : {}),
        },
      },
      include: { assessment: { include: { subject: true, academicYear: true, academicTerm: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const bySubject: Record<string, any> = {};
    for (const m of marks) {
      const sn = m.assessment.subject.name;
      if (!bySubject[sn]) {
        bySubject[sn] = { subjectId: m.assessment.subjectId, subjectName: sn, subjectColor: m.assessment.subject.color, assessments: [], totalScore: 0, maxPossible: 0 };
      }
      bySubject[sn].assessments.push({
        id: m.id, assessmentId: m.assessmentId, title: m.assessment.title, type: m.assessment.type,
        score: m.score, maxScore: m.assessment.maxScore, percentage: Math.round(((m.score ?? 0) / m.assessment.maxScore) * 100),
        grade: computeGrade(m.score ?? 0, m.assessment.maxScore), isAbsent: m.isAbsent, remarks: m.remarks,
        term: m.assessment.academicTerm?.name || '', date: m.assessment.date || m.createdAt,
      });
      bySubject[sn].totalScore += m.score ?? 0;
      bySubject[sn].maxPossible += m.assessment.maxScore;
    }
    const subjects = Object.values(bySubject).map((s: any) => ({ ...s, averageScore: s.assessments.length > 0 ? Math.round((s.totalScore / s.maxPossible) * 1000) / 10 : 0 }));
    const reportCards = await prisma.reportCard.findMany({
      where: { studentId: student.id, ...(effectiveYearId ? { academicYearId: effectiveYearId } : {}), status: 'PUBLISHED' },
      include: { academicTerm: true, subjectScores: { include: { subject: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({
      success: true,
      data: {
        student: { id: student.id, name: student.fullName, grade: student.grade?.name },
        academicYear: academicYear?.name || '', subjects,
        reportCards: reportCards.map((rc) => ({
          id: rc.id, term: rc.academicTerm?.name || '', averageScore: rc.averageScore, totalScore: rc.totalScore,
          rank: rc.rank, totalStudents: rc.totalStudentsInClass, conduct: rc.conduct,
          teacherComment: rc.homeroomTeacherComment, principalComment: rc.principalComment,
          status: rc.status, publishedAt: rc.publishedAt,
          subjectScores: rc.subjectScores.map((ss) => ({
            subjectId: ss.subjectId, subjectName: ss.subject?.name || '', score: ss.score, maxScore: ss.maxScore,
            gradeLetter: ss.gradeLetter, gpaPoint: ss.gpaPoint, rank: ss.rank, remarks: ss.teacherRemarks,
          })),
        })),
      },
    });
  } catch (err) { next(err); }
};

// ─── ATTENDANCE ──────────────────────────────────────────────────────────────

export const getAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const student = await getStudentByUserId(userId);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const { month, year } = req.query as any;
    const academicYear = await getActiveAcademicYear();
    const filterMonth = month ? parseInt(month) : null;
    const filterYear = year ? parseInt(year) : null;
    let dateFilter: any = {};
    if (filterMonth && filterYear) {
      const start = new Date(filterYear, filterMonth - 1, 1);
      const end = new Date(filterYear, filterMonth, 0, 23, 59, 59);
      dateFilter = { date: { gte: start, lte: end } };
    } else if (academicYear) {
      dateFilter = { date: { gte: academicYear.startDate, lte: academicYear.endDate } };
    }
    const records = await prisma.attendance.findMany({
      where: { studentId: student.id, ...dateFilter },
      orderBy: { date: 'desc' },
      select: { id: true, date: true, status: true, session: true, remarks: true },
    });
    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;
    const totalCount = records.length;
    const percentage = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0;
    return res.status(200).json({
      success: true,
      data: {
        records, summary: { present: presentCount, absent: absentCount, late: lateCount, total: totalCount, percentage, status: percentage >= 90 ? 'Excellent' : percentage >= 75 ? 'Good' : 'Needs Improvement' },
      },
    });
  } catch (err) { next(err); }
};

// ─── TIMETABLE ───────────────────────────────────────────────────────────────

export const getTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const student = await getStudentByUserId(userId);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    // Find the single active published timetable for this student's class
    const activeTimetable = await prisma.timetable.findFirst({
      where: {
        gradeId: student.gradeId,
        sectionId: student.sectionId,
        status: 'PUBLISHED',
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true },
    });

    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const grouped: Record<string, any[]> = {};
    for (const day of dayOrder) grouped[day] = [];

    if (!activeTimetable) {
      return res.status(200).json({ success: true, data: { grade: student.grade?.name, section: student.section?.name, schedule: grouped } });
    }

    const slots = await prisma.timetableSlot.findMany({
      where: { timetableId: activeTimetable.id, isCancelled: false },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
      include: { subject: true, teacher: true, classroom: true },
    });

    for (const slot of slots) {
      const day = slot.dayOfWeek.toUpperCase();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({ id: slot.id, periodNumber: slot.periodNumber, startTime: slot.startTime, endTime: slot.endTime, subject: slot.subject.name, subjectColor: slot.subject.color, teacher: slot.teacher?.name || 'TBA', room: slot.classroom?.name || 'TBA' });
    }
    return res.status(200).json({ success: true, data: { grade: student.grade?.name, section: student.section?.name, schedule: grouped } });
  } catch (err) { next(err); }
};

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────

export const getAnnouncements = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { category } = req.query as any;
    const where: any = {
      type: { in: ['announcement', 'emergency', 'info'] }, studentId: null,
      OR: [{ targetAudience: { in: ['GENERAL', 'PARENTS', 'general', 'parents'] } }, { targetAudience: null }],
    };
    if (category && category !== 'all') where.type = category;
    const announcements = await prisma.parentNotification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.status(200).json({ success: true, data: announcements.map((a) => ({ id: a.id, title: a.title, message: a.message, type: a.type, category: a.type, date: a.createdAt, targetAudience: a.targetAudience })) });
  } catch (err) { next(err); }
};

// ─── DISCIPLINE ──────────────────────────────────────────────────────────────

export const getDiscipline = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const student = await getStudentByUserId(userId);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const records = await prisma.studentDiscipline.findMany({
      where: { studentId: student.id }, orderBy: { date: 'desc' },
      select: { id: true, caseNumber: true, date: true, time: true, categoryName: true, severity: true, title: true, description: true, location: true, status: true, actionStatus: true, approvedAction: true, immediateAction: true, resolutionNotes: true, parentNotified: true, createdAt: true },
    });
    return res.status(200).json({
      success: true,
      data: records.map((r) => ({ id: r.id, caseNumber: r.caseNumber, date: r.date, type: r.categoryName, severity: r.severity, title: r.title, description: r.description, location: r.location, status: r.status, actionStatus: r.actionStatus, action: r.approvedAction || r.immediateAction, resolution: r.resolutionNotes, parentNotified: r.parentNotified })),
    });
  } catch (err) { next(err); }
};

// ─── LEARNING MATERIALS ───────────────────────────────────────────────────────

export const getMaterials = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const student = await getStudentByUserId(userId);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const { subjectId, type } = req.query as any;

    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        gradeId: student.gradeId,
        ...(student.sectionId ? { sectionId: student.sectionId } : {}),
      },
      include: { teacher: true },
    });
    const teacherMap = new Map<string, string>();
    for (const a of assignments) {
      if (a.subjectId && a.teacher?.name) {
        teacherMap.set(a.subjectId, a.teacher.name);
      }
    }

    const materials = await prisma.learningMaterial.findMany({
      where: {
        gradeId: student.gradeId,
        ...(subjectId && subjectId !== 'all' ? { subjectId } : {}),
        ...(type && type !== 'all' ? { fileType: { contains: type, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { subject: true },
    });

    const publishedMaterials = materials.filter((m) => !m.description?.includes('"status":"DRAFT"'));

    return res.status(200).json({
      success: true,
      data: publishedMaterials.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        subjectId: m.subjectId,
        subjectName: m.subject?.name || '',
        subjectColor: m.subject?.color || '#6366f1',
        teacherName: teacherMap.get(m.subjectId) || null,
        fileUrl: m.fileUrl,
        fileType: m.fileType,
        fileSize: m.fileSize,
        viewCount: m.viewCount ?? 0,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) { next(err); }
};