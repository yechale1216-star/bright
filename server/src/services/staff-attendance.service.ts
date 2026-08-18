import prisma from '../config/db';
import { validateGeofence } from './attendance.service';
import { isDateWorkingDay, addMinutesToTime } from './holiday.service';

/**
 * Normalizes date to UTC midnight for Africa/Addis_Ababa or standard date string
 */
export const normalizeStaffDate = (dateInput?: any): { dateStr: string; startDate: Date; endDate: Date } => {
  let dateStr: string;
  if (!dateInput) {
    dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
  } else if (typeof dateInput === 'string') {
    dateStr = dateInput.split('T')[0];
  } else if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().split('T')[0];
  } else {
    dateStr = new Date(dateInput).toISOString().split('T')[0];
  }
  const startDate = new Date(`${dateStr}T00:00:00.000Z`);
  const endDate = new Date(`${dateStr}T23:59:59.999Z`);
  return { dateStr, startDate, endDate };
};

/**
 * Helper to check if a time (HH:MM) is after another time (HH:MM)
 */
export function isTimeAfter(currentHHMM: string, targetHHMM: string): boolean {
  const [cH, cM] = currentHHMM.split(':').map(Number);
  const [tH, tM] = targetHHMM.split(':').map(Number);
  if (cH > tH) return true;
  if (cH === tH && cM > tM) return true;
  return false;
}

/**
 * Helper to check if a time (HH:MM) is before another time (HH:MM)
 */
export function isTimeBefore(currentHHMM: string, targetHHMM: string): boolean {
  const [cH, cM] = currentHHMM.split(':').map(Number);
  const [tH, tM] = targetHHMM.split(':').map(Number);
  if (cH < tH) return true;
  if (cH === tH && cM < tM) return true;
  return false;
}

/**
 * Dynamically computes staff working schedule cutoffs from school settings
 */
export function computeWorkingScheduleThresholds(settings?: any): {
  earliestCheckIn: string;
  expectedStartTime: string;
  lateCutoffTime: string;
  expectedEndTime: string;
  earlyDepartureCutoffTime: string;
  latestCheckOut: string;
  workingDays: string[];
} {
  const earliestCheckIn = settings?.staff_earliest_checkin_time || settings?.staff_checkin_start || '06:00';
  const expectedStartTime = settings?.staff_work_start_time || '08:00';
  const lateGrace = settings?.staff_late_grace_minutes ?? 15;
  const lateCutoffTime = settings?.staff_checkin_late || addMinutesToTime(expectedStartTime, lateGrace);

  const expectedEndTime = settings?.staff_work_end_time || '17:00';
  const earlyTolerance = settings?.staff_early_checkout_tolerance_minutes ?? 15;
  const earlyDepartureCutoffTime = settings?.staff_checkout_early || addMinutesToTime(expectedEndTime, -earlyTolerance);
  const latestCheckOut = settings?.staff_latest_checkout_time || '20:00';

  const workingDaysStr = settings?.staff_working_days || 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY';
  const workingDays = workingDaysStr.split(',').map((d: string) => d.trim().toUpperCase()).filter(Boolean);

  return {
    earliestCheckIn,
    expectedStartTime,
    lateCutoffTime,
    expectedEndTime,
    earlyDepartureCutoffTime,
    latestCheckOut,
    workingDays,
  };
}

/**
 * Check-in for a staff member (self or admin-assisted)
 */
export async function checkIn(userId: string, schoolId: string, data: {
  date?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
  locationDistance?: number | null;
  faceVerified?: boolean;
  faceConfidence?: number | null;
  remarks?: string;
}) {
  const user = await prisma.user.findFirst({
    where: { id: userId, schoolId, is_active: true }
  });
  if (!user) {
    throw new Error('Staff member not found or inactive in this school');
  }

  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  
  // 1. Geofence Verification (using shared validator)
  let locVerified = false;
  let locDistance: number | null = null;
  if (settings?.staff_geo_required !== false) {
    const geoResult = validateGeofence(data, settings);
    locVerified = geoResult.locVerified;
    locDistance = geoResult.locDistance;
  } else {
    locVerified = data.locationVerified ?? true;
    locDistance = data.locationDistance ?? null;
  }

  // 2. Face Verification Enforcement
  const isFaceRequired = settings?.staff_face_required ?? true;
  if (isFaceRequired && !data.faceVerified) {
    throw new Error('Face verification failed or is required for staff check-in.');
  }

  const { dateStr, startDate, endDate } = normalizeStaffDate(data.date);
  const schedule = computeWorkingScheduleThresholds(settings);
  const workingDayInfo = await isDateWorkingDay(schoolId, dateStr, settings);

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', { 
    timeZone: 'Africa/Addis_Ababa', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Earliest check-in check
  if (schedule.earliestCheckIn && isTimeBefore(currentTimeHHMM, schedule.earliestCheckIn)) {
    throw new Error(`Check-in is not allowed before ${schedule.earliestCheckIn}. Current time: ${currentTimeHHMM}`);
  }

  // Determine status & remarks based on working day calendar rules
  let status = 'PRESENT';
  let remarks = data.remarks || null;

  if (workingDayInfo.isWorkingDay) {
    if (isTimeAfter(currentTimeHHMM, schedule.lateCutoffTime)) {
      status = 'LATE';
    }
  } else {
    // Non-working day or holiday check-in (optional work / special shift)
    status = 'PRESENT';
    const nonWorkNote = workingDayInfo.isHoliday
      ? `Holiday Attendance (${workingDayInfo.holidayName})`
      : `Weekend/Non-Working Day Attendance (${workingDayInfo.dayOfWeek})`;
    remarks = remarks ? `${remarks} | ${nonWorkNote}` : nonWorkNote;
  }

  // Check existing attendance for today
  const existing = await prisma.staffAttendance.findFirst({
    where: {
      schoolId,
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      }
    }
  });

  if (existing && existing.checkInTime) {
    throw new Error(`Staff is already checked in for ${dateStr} at ${existing.checkInTime.toISOString()}`);
  }

  if (existing) {
    return await prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        status,
        checkInTime: now,
        checkInLatitude: data.latitude ?? null,
        checkInLongitude: data.longitude ?? null,
        geofenceVerified: locVerified,
        geofenceDistance: locDistance,
        faceVerified: data.faceVerified ?? false,
        faceConfidence: data.faceConfidence ?? null,
        remarks: remarks ?? existing.remarks,
      }
    });
  }

  return await prisma.staffAttendance.create({
    data: {
      schoolId,
      userId,
      date: startDate,
      status,
      checkInTime: now,
      checkInLatitude: data.latitude ?? null,
      checkInLongitude: data.longitude ?? null,
      geofenceVerified: locVerified,
      geofenceDistance: locDistance,
      faceVerified: data.faceVerified ?? false,
      faceConfidence: data.faceConfidence ?? null,
      remarks: remarks ?? null,
    }
  });
}

/**
 * Check-out for a staff member
 */
export async function checkOut(userId: string, schoolId: string, data: {
  date?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
  locationDistance?: number | null;
  faceVerified?: boolean;
  faceConfidence?: number | null;
  remarks?: string;
}) {
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  
  // Geofence
  let locVerified = false;
  let locDistance: number | null = null;
  if (settings?.staff_geo_required !== false) {
    const geoResult = validateGeofence(data, settings);
    locVerified = geoResult.locVerified;
    locDistance = geoResult.locDistance;
  } else {
    locVerified = data.locationVerified ?? true;
    locDistance = data.locationDistance ?? null;
  }

  // Face
  const isFaceRequired = settings?.staff_face_required ?? true;
  if (isFaceRequired && !data.faceVerified) {
    throw new Error('Face verification failed or is required for staff check-out.');
  }

  const { dateStr, startDate, endDate } = normalizeStaffDate(data.date);
  const schedule = computeWorkingScheduleThresholds(settings);
  const workingDayInfo = await isDateWorkingDay(schoolId, dateStr, settings);

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', { 
    timeZone: 'Africa/Addis_Ababa', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const existing = await prisma.staffAttendance.findFirst({
    where: {
      schoolId,
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      }
    }
  });

  if (!existing || !existing.checkInTime) {
    throw new Error(`Cannot check out without checking in first on ${dateStr}`);
  }

  if (existing.checkOutTime) {
    throw new Error(`Staff is already checked out for ${dateStr} at ${existing.checkOutTime.toISOString()}`);
  }

  // Check early departure only if it is a scheduled working day
  let status = existing.status;
  if (workingDayInfo.isWorkingDay) {
    if (isTimeBefore(currentTimeHHMM, schedule.earlyDepartureCutoffTime)) {
      if (status === 'PRESENT') {
        status = 'EARLY_DEPARTURE';
      }
    }
  }

  return await prisma.staffAttendance.update({
    where: { id: existing.id },
    data: {
      status,
      checkOutTime: now,
      checkOutLatitude: data.latitude ?? null,
      checkOutLongitude: data.longitude ?? null,
      remarks: data.remarks ? `${existing.remarks ? existing.remarks + ' | ' : ''}${data.remarks}` : existing.remarks,
    }
  });
}

/**
 * Face enrollment for a staff member (admin only)
 */
export async function enrollFace(adminUserId: string, targetUserId: string, schoolId: string, descriptor: number[]) {
  if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
    throw new Error('Valid face descriptor array is required for enrollment');
  }

  const staff = await prisma.user.findFirst({
    where: { id: targetUserId, schoolId }
  });
  if (!staff) {
    throw new Error('Staff member not found in this school');
  }

  const existing = await prisma.staffFaceEnrollment.findUnique({
    where: { userId: targetUserId }
  });

  if (existing) {
    return await prisma.staffFaceEnrollment.update({
      where: { userId: targetUserId },
      data: {
        descriptor,
        enrolledBy: adminUserId,
        updatedAt: new Date()
      }
    });
  }

  return await prisma.staffFaceEnrollment.create({
    data: {
      schoolId,
      userId: targetUserId,
      descriptor,
      enrolledBy: adminUserId,
    }
  });
}

/**
 * Retrieve face descriptor for client-side matching
 */
export async function getEnrolledDescriptor(userId: string, schoolId: string) {
  const enrollment = await prisma.staffFaceEnrollment.findFirst({
    where: { userId, schoolId }
  });
  return enrollment;
}

/**
 * Get staff attendance list (admin view)
 */
export async function getStaffAttendance(schoolId: string, filters: {
  date?: string;
  startDate?: string;
  endDate?: string;
  role?: string;
  userId?: string;
  status?: string;
  search?: string;
  geofenceVerified?: string | boolean;
  faceVerified?: string | boolean;
}) {
  const where: any = { schoolId };

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status.toUpperCase();
  }

  if (filters.date) {
    const { startDate, endDate } = normalizeStaffDate(filters.date);
    where.date = { gte: startDate, lte: endDate };
  } else if (filters.startDate && filters.endDate) {
    const { startDate } = normalizeStaffDate(filters.startDate);
    const { endDate } = normalizeStaffDate(filters.endDate);
    where.date = { gte: startDate, lte: endDate };
  }

  const userConditions: any = {};
  if (filters.role && filters.role !== 'all') {
    userConditions.role = filters.role;
  }

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    userConditions.OR = [
      { full_name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } }
    ];
  }

  if (Object.keys(userConditions).length > 0) {
    where.user = userConditions;
  }

  if (filters.geofenceVerified !== undefined && filters.geofenceVerified !== '') {
    where.geofenceVerified = filters.geofenceVerified === true || filters.geofenceVerified === 'true';
  }

  if (filters.faceVerified !== undefined && filters.faceVerified !== '') {
    where.faceVerified = filters.faceVerified === true || filters.faceVerified === 'true';
  }

  return await prisma.staffAttendance.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          phone: true,
          profile_photo: true,
          faceEnrollment: {
            select: { id: true, enrolledAt: true }
          }
        }
      }
    },
    orderBy: { date: 'desc' }
  });
}

/**
 * Get comprehensive daily or range summary stats for staff attendance
 */
export async function getStaffAttendanceStats(schoolId: string, date?: string) {
  const { dateStr, startDate, endDate } = normalizeStaffDate(date);

  // Fetch settings once, pass cache to both helpers
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const workingDayInfo = await isDateWorkingDay(schoolId, dateStr, settings);

  // Total active staff (all non-parent/student users registered in this school)
  const totalStaffCount = await prisma.user.count({
    where: {
      schoolId,
      is_active: true,
      role: { notIn: ['parent', 'student'] }
    }
  });

  const records = await prisma.staffAttendance.findMany({
    where: {
      schoolId,
      date: { gte: startDate, lte: endDate }
    },
    include: {
      user: {
        select: { id: true, full_name: true, role: true, profile_photo: true }
      }
    }
  });

  let present = 0;
  let late = 0;
  let absent = 0;
  let earlyDeparture = 0;
  let onLeave = 0;
  let permission = 0;
  let faceVerifiedCount = 0;
  let geoVerifiedCount = 0;
  let checkedInCount = 0;

  for (const r of records) {
    if (r.status === 'PRESENT') present++;
    else if (r.status === 'LATE') late++;
    else if (r.status === 'ABSENT') absent++;
    else if (r.status === 'EARLY_DEPARTURE') earlyDeparture++;
    else if (r.status === 'LEAVE') onLeave++;
    else if (r.status === 'PERMISSION') permission++;

    if (r.checkInTime) checkedInCount++;
    if (r.faceVerified) faceVerifiedCount++;
    if (r.geofenceVerified) geoVerifiedCount++;
  }

  const notCheckedIn = Math.max(0, totalStaffCount - records.length);

  return {
    date: dateStr,
    isWorkingDay: workingDayInfo.isWorkingDay,
    isHoliday: workingDayInfo.isHoliday,
    isWeekend: workingDayInfo.isWeekend,
    holidayName: workingDayInfo.holidayName,
    dayOfWeek: workingDayInfo.dayOfWeek,
    calendarNote: workingDayInfo.reason,
    totalStaff: totalStaffCount,
    present,
    late,
    absent,
    earlyDeparture,
    onLeave: onLeave + permission,
    leaveCount: onLeave,
    permissionCount: permission,
    checkedIn: checkedInCount,
    notCheckedIn,
    faceVerifiedCount,
    geoVerifiedCount,
    attendanceRate: totalStaffCount > 0 ? Math.round(((present + late + earlyDeparture) / totalStaffCount) * 100) : 0
  };
}

/**
 * Get current staff user's own attendance history
 */
export async function getMyAttendance(userId: string, schoolId: string, filters: {
  startDate?: string;
  endDate?: string;
  date?: string;
}) {
  const where: any = { schoolId, userId };

  if (filters.date) {
    const { startDate, endDate } = normalizeStaffDate(filters.date);
    where.date = { gte: startDate, lte: endDate };
  } else if (filters.startDate && filters.endDate) {
    const { startDate } = normalizeStaffDate(filters.startDate);
    const { endDate } = normalizeStaffDate(filters.endDate);
    where.date = { gte: startDate, lte: endDate };
  }

  return await prisma.staffAttendance.findMany({
    where,
    orderBy: { date: 'desc' }
  });
}

/**
 * Bulk sync staff check-in/out records from offline IndexedDB queue
 */
export async function bulkSyncStaffAttendance(records: Array<{
  userId: string;
  type: 'checkin' | 'checkout';
  date: string;
  timestamp?: number;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
  locationDistance?: number | null;
  faceVerified?: boolean;
  faceConfidence?: number | null;
  remarks?: string;
}>, schoolId: string) {
  const results: any[] = [];
  const errors: string[] = [];

  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const schedule = computeWorkingScheduleThresholds(settings);

  for (const item of records) {
    try {
      const { dateStr, startDate, endDate } = normalizeStaffDate(item.date);
      const recordTime = item.timestamp ? new Date(item.timestamp) : new Date();
      const timeHHMM = recordTime.toLocaleTimeString('en-US', {
        timeZone: 'Africa/Addis_Ababa',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      // Determine if this is a working day (reuse settings cache)
      const workingDayInfo = await isDateWorkingDay(schoolId, dateStr, settings);

      const existing = await prisma.staffAttendance.findFirst({
        where: {
          schoolId,
          userId: item.userId,
          date: { gte: startDate, lte: endDate }
        }
      });

      if (item.type === 'checkin') {
        let status = 'PRESENT';
        let remarks = item.remarks || null;

        if (workingDayInfo.isWorkingDay) {
          if (isTimeAfter(timeHHMM, schedule.lateCutoffTime)) {
            status = 'LATE';
          }
        } else {
          // Non-working day offline check-in — mark present but annotate
          const nonWorkNote = workingDayInfo.isHoliday
            ? `Holiday Attendance (${workingDayInfo.holidayName})`
            : `Weekend/Non-Working Day Attendance (${workingDayInfo.dayOfWeek})`;
          remarks = remarks ? `${remarks} | ${nonWorkNote}` : nonWorkNote;
        }

        if (existing) {
          if (!existing.checkInTime) {
            const updated = await prisma.staffAttendance.update({
              where: { id: existing.id },
              data: {
                status,
                checkInTime: recordTime,
                checkInLatitude: item.latitude ?? existing.checkInLatitude,
                checkInLongitude: item.longitude ?? existing.checkInLongitude,
                geofenceVerified: item.locationVerified ?? existing.geofenceVerified,
                geofenceDistance: item.locationDistance ?? existing.geofenceDistance,
                faceVerified: item.faceVerified ?? existing.faceVerified,
                faceConfidence: item.faceConfidence ?? existing.faceConfidence,
                remarks: remarks ?? existing.remarks,
              }
            });
            results.push(updated);
          } else {
            results.push(existing);
          }
        } else {
          const created = await prisma.staffAttendance.create({
            data: {
              schoolId,
              userId: item.userId,
              date: startDate,
              status,
              checkInTime: recordTime,
              checkInLatitude: item.latitude ?? null,
              checkInLongitude: item.longitude ?? null,
              geofenceVerified: item.locationVerified ?? false,
              geofenceDistance: item.locationDistance ?? null,
              faceVerified: item.faceVerified ?? false,
              faceConfidence: item.faceConfidence ?? null,
              remarks: remarks ?? null,
            }
          });
          results.push(created);
        }
      } else if (item.type === 'checkout') {
        if (existing) {
          let status = existing.status;
          // Apply early departure check only on scheduled working days
          if (workingDayInfo.isWorkingDay) {
            if (isTimeBefore(timeHHMM, schedule.earlyDepartureCutoffTime)) {
              if (status === 'PRESENT') status = 'EARLY_DEPARTURE';
            }
          }

          if (!existing.checkOutTime) {
            const updated = await prisma.staffAttendance.update({
              where: { id: existing.id },
              data: {
                status,
                checkOutTime: recordTime,
                checkOutLatitude: item.latitude ?? existing.checkOutLatitude,
                checkOutLongitude: item.longitude ?? existing.checkOutLongitude,
                remarks: item.remarks ? `${existing.remarks ? existing.remarks + ' | ' : ''}${item.remarks}` : existing.remarks,
              }
            });
            results.push(updated);
          } else {
            results.push(existing);
          }
        }
      }
    } catch (err: any) {
      errors.push(`Record ${item.userId} ${item.type} error: ${err.message}`);
    }
  }

  return { syncedCount: results.length, total: records.length, errors, results };
}

/**
 * Admin manual marking of absent staff for a given date
 */
export async function markAbsentStaff(adminUserId: string, schoolId: string, userIds: string[], date: string, remarks?: string) {
  const { startDate, endDate } = normalizeStaffDate(date);
  const results: any[] = [];

  for (const userId of userIds) {
    const existing = await prisma.staffAttendance.findFirst({
      where: {
        schoolId,
        userId,
        date: { gte: startDate, lte: endDate }
      }
    });

    if (existing) {
      const updated = await prisma.staffAttendance.update({
        where: { id: existing.id },
        data: {
          status: 'ABSENT',
          markedAbsentBy: adminUserId,
          remarks: remarks ?? existing.remarks,
        }
      });
      results.push(updated);
    } else {
      const created = await prisma.staffAttendance.create({
        data: {
          schoolId,
          userId,
          date: startDate,
          status: 'ABSENT',
          markedAbsentBy: adminUserId,
          remarks: remarks ?? null,
        }
      });
      results.push(created);
    }
  }

  return results;
}

/**
 * Admin manual attendance correction with full auditing
 */
export async function correctAttendance(
  adminUserId: string,
  recordId: string,
  schoolId: string,
  corrections: {
    status?: string;
    checkInTime?: string | Date | null;
    checkOutTime?: string | Date | null;
    remarks?: string;
    reason: string;
  }
) {
  if (!corrections.reason || !corrections.reason.trim()) {
    throw new Error('A mandatory correction reason is required for administrative audit trail.');
  }

  const existing = await prisma.staffAttendance.findFirst({
    where: { id: recordId, schoolId },
    include: { user: true }
  });

  if (!existing) {
    throw new Error('Staff attendance record not found in this school');
  }

  const updateData: any = {
    correctedBy: adminUserId,
    correctedAt: new Date(),
    previousStatus: existing.status,
    previousCheckIn: existing.checkInTime,
    correctionReason: corrections.reason.trim(),
  };

  if (corrections.status) {
    updateData.status = corrections.status.toUpperCase();
  }

  if (corrections.checkInTime !== undefined) {
    updateData.checkInTime = corrections.checkInTime ? new Date(corrections.checkInTime) : null;
  }

  if (corrections.checkOutTime !== undefined) {
    updateData.checkOutTime = corrections.checkOutTime ? new Date(corrections.checkOutTime) : null;
  }

  if (corrections.remarks !== undefined) {
    updateData.remarks = corrections.remarks;
  }

  return await prisma.staffAttendance.update({
    where: { id: recordId },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          phone: true,
          profile_photo: true
        }
      }
    }
  });
}

/**
 * Set Leave or Permission for a staff member
 */
export async function setLeaveOrPermission(
  adminUserId: string,
  userId: string,
  schoolId: string,
  data: {
    date: string;
    status: 'LEAVE' | 'PERMISSION';
    reason: string;
  }
) {
  const { startDate, endDate } = normalizeStaffDate(data.date);

  const existing = await prisma.staffAttendance.findFirst({
    where: {
      schoolId,
      userId,
      date: { gte: startDate, lte: endDate }
    }
  });

  if (existing) {
    return await prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        remarks: data.reason,
        correctedBy: adminUserId,
        correctedAt: new Date(),
        previousStatus: existing.status,
        correctionReason: `Marked as ${data.status}: ${data.reason}`,
      }
    });
  }

  return await prisma.staffAttendance.create({
    data: {
      schoolId,
      userId,
      date: startDate,
      status: data.status,
      remarks: data.reason,
      markedAbsentBy: adminUserId,
    }
  });
}

/**
 * Generate attendance report aggregated across a date range
 */
export async function getStaffAttendanceReport(
  schoolId: string,
  filters: {
    startDate: string;
    endDate: string;
    role?: string;
    userId?: string;
  }
) {
  const { startDate } = normalizeStaffDate(filters.startDate);
  const { endDate } = normalizeStaffDate(filters.endDate);

  const where: any = {
    schoolId,
    date: { gte: startDate, lte: endDate }
  };

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.role && filters.role !== 'all') {
    where.user = { role: filters.role };
  }

  const records = await prisma.staffAttendance.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          profile_photo: true
        }
      }
    },
    orderBy: { date: 'asc' }
  });

  // Aggregate by staff member
  const staffMap = new Map<string, any>();

  for (const r of records) {
    if (!staffMap.has(r.userId)) {
      staffMap.set(r.userId, {
        user: r.user,
        totalRecords: 0,
        present: 0,
        late: 0,
        absent: 0,
        earlyDeparture: 0,
        onLeave: 0,
        geoVerified: 0,
        faceVerified: 0,
        records: []
      });
    }

    const item = staffMap.get(r.userId);
    item.totalRecords++;
    if (r.status === 'PRESENT') item.present++;
    else if (r.status === 'LATE') item.late++;
    else if (r.status === 'ABSENT') item.absent++;
    else if (r.status === 'EARLY_DEPARTURE') item.earlyDeparture++;
    else if (r.status === 'LEAVE' || r.status === 'PERMISSION') item.onLeave++;

    if (r.geofenceVerified) item.geoVerified++;
    if (r.faceVerified) item.faceVerified++;
    item.records.push(r);
  }

  // Daily totals summary
  const dayMap = new Map<string, { date: string; present: number; late: number; absent: number; earlyDeparture: number; onLeave: number; total: number }>();
  for (const r of records) {
    const dStr = r.date.toISOString().split('T')[0];
    if (!dayMap.has(dStr)) {
      dayMap.set(dStr, { date: dStr, present: 0, late: 0, absent: 0, earlyDeparture: 0, onLeave: 0, total: 0 });
    }
    const d = dayMap.get(dStr)!;
    d.total++;
    if (r.status === 'PRESENT') d.present++;
    else if (r.status === 'LATE') d.late++;
    else if (r.status === 'ABSENT') d.absent++;
    else if (r.status === 'EARLY_DEPARTURE') d.earlyDeparture++;
    else if (r.status === 'LEAVE' || r.status === 'PERMISSION') d.onLeave++;
  }

  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    totalRecords: records.length,
    staffSummary: Array.from(staffMap.values()),
    dailyBreakdown: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  };
}

