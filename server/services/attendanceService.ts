/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import { dbHelper } from '../db/database.ts';
import { getCompanySettings } from './organizationService.ts';
import { logAudit } from './auditService.ts';
import type { AuthUser } from '../middleware/auth.ts';

export function getServerDateTime() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
  return { now, dateStr, timeStr };
}

export function checkIn(employeeId: string, coords?: { latitude?: number; longitude?: number }) {
  const { dateStr, timeStr } = getServerDateTime();
  const settings = getCompanySettings();

  // Check existing attendance for today
  const existing = dbHelper.queryOne<any>(
    'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
    [employeeId, dateStr]
  );

  if (existing && existing.check_in_time) {
    const error: any = new Error(`Already checked in today at ${existing.check_in_time}`);
    error.status = 409;
    throw error;
  }

  // Parse start time and grace period
  const [startHour, startMin] = settings.office_start_time.split(':').map(Number);
  const graceMinutes = settings.grace_period_minutes || 15;
  const graceLimitMinutes = startHour * 60 + startMin + graceMinutes;

  const [inHour, inMin] = timeStr.split(':').map(Number);
  const currentMinutes = inHour * 60 + inMin;

  const isLate = currentMinutes > graceLimitMinutes;
  const initialStatus = isLate ? 'LATE' : 'PRESENT';

  const attendanceId = existing?.id || crypto.randomUUID();

  if (existing) {
    dbHelper.run(
      `UPDATE attendance SET
        check_in_time = ?,
        status = ?,
        check_in_lat = ?,
        check_in_lng = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      [timeStr, initialStatus, coords?.latitude || null, coords?.longitude || null, attendanceId]
    );
  } else {
    dbHelper.run(
      `INSERT INTO attendance (
        id, employee_id, date, check_in_time, status,
        check_in_lat, check_in_lng, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        attendanceId,
        employeeId,
        dateStr,
        timeStr,
        initialStatus,
        coords?.latitude || null,
        coords?.longitude || null
      ]
    );
  }

  return dbHelper.queryOne('SELECT * FROM attendance WHERE id = ?', [attendanceId]);
}

export function checkOut(employeeId: string, coords?: { latitude?: number; longitude?: number }) {
  const { dateStr, timeStr, now } = getServerDateTime();
  const settings = getCompanySettings();

  const existing = dbHelper.queryOne<any>(
    'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
    [employeeId, dateStr]
  );

  if (!existing || !existing.check_in_time) {
    const error: any = new Error('Cannot check out without a valid check-in record for today.');
    error.status = 400;
    throw error;
  }

  if (existing.check_out_time) {
    const error: any = new Error(`Already checked out today at ${existing.check_out_time}`);
    error.status = 400;
    throw error;
  }

  // Calculate working hours
  const checkInDate = new Date(`${dateStr}T${existing.check_in_time}`);
  const durationMs = Math.max(0, now.getTime() - checkInDate.getTime());
  const hoursWorked = Number((durationMs / (1000 * 60 * 60)).toFixed(2));

  let finalStatus = existing.status;
  if (hoursWorked < (settings.half_day_threshold_hours || 5.0)) {
    finalStatus = 'HALF_DAY';
  }

  dbHelper.run(
    `UPDATE attendance SET
      check_out_time = ?,
      total_working_hours = ?,
      status = ?,
      check_out_lat = ?,
      check_out_lng = ?,
      updated_at = datetime('now')
    WHERE id = ?`,
    [
      timeStr,
      hoursWorked,
      finalStatus,
      coords?.latitude || null,
      coords?.longitude || null,
      existing.id
    ]
  );

  return dbHelper.queryOne('SELECT * FROM attendance WHERE id = ?', [existing.id]);
}

export function getTodayStatus(employeeId: string) {
  const { dateStr } = getServerDateTime();
  const attendance = dbHelper.queryOne<any>(
    'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
    [employeeId, dateStr]
  );

  return {
    date: dateStr,
    record: attendance || null,
    checkedIn: !!attendance?.check_in_time,
    checkedOut: !!attendance?.check_out_time
  };
}

export function getEmployeeAttendanceHistory(employeeId: string, month?: number, year?: number) {
  let sql = 'SELECT * FROM attendance WHERE employee_id = ?';
  const params: any[] = [employeeId];

  if (month && year) {
    const monthStr = String(month).padStart(2, '0');
    sql += " AND strftime('%Y-%m', date) = ?";
    params.push(`${year}-${monthStr}`);
  }

  sql += ' ORDER BY date DESC';
  return dbHelper.queryAll<any>(sql, params);
}

export function getAttendanceDailyReport(date: string, departmentId?: string) {
  const settings = getCompanySettings();
  const weekends = settings.weekend_days.split(',').map(d => d.trim().toLowerCase());

  // Determine if target date is weekend
  const d = new Date(date + 'T12:00:00Z');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
  const isWeekend = weekends.includes(dayName);

  // Check if target date is holiday
  const holiday = dbHelper.queryOne<any>('SELECT name FROM company_holidays WHERE holiday_date = ?', [date]);

  // Query all active employees
  let empSql = `
    SELECT e.id as employee_id, e.employee_code, e.first_name, e.last_name, e.email,
           e.department_id, dept.name as department_name, desig.name as designation_name
    FROM employees e
    LEFT JOIN departments dept ON e.department_id = dept.id
    LEFT JOIN designations desig ON e.designation_id = desig.id
    WHERE e.employment_status = 'ACTIVE'
  `;
  const empParams: any[] = [];
  if (departmentId) {
    empSql += ' AND e.department_id = ?';
    empParams.push(departmentId);
  }
  empSql += ' ORDER BY e.first_name ASC';
  const employees = dbHelper.queryAll<any>(empSql, empParams);

  // Query actual attendance for date
  const records = dbHelper.queryAll<any>('SELECT * FROM attendance WHERE date = ?', [date]);
  const recordMap = new Map(records.map(r => [r.employee_id, r]));

  // Query approved leaves covering date
  const leaves = dbHelper.queryAll<any>(
    "SELECT employee_id, reason FROM leave_requests WHERE status = 'APPROVED' AND ? BETWEEN start_date AND end_date",
    [date]
  );
  const leaveMap = new Map(leaves.map(l => [l.employee_id, l]));

  const rows = employees.map(emp => {
    const att = recordMap.get(emp.employee_id);
    const leave = leaveMap.get(emp.employee_id);

    let status = 'ABSENT';
    let checkIn = null;
    let checkOut = null;
    let hours = 0;
    let notes = null;

    if (att) {
      status = att.status;
      checkIn = att.check_in_time;
      checkOut = att.check_out_time;
      hours = att.total_working_hours || 0;
      notes = att.notes;

      // Detect missing checkout if day has passed
      const todayStr = getServerDateTime().dateStr;
      if (date < todayStr && checkIn && !checkOut) {
        status = 'MISSING_CHECKOUT';
      }
    } else if (leave) {
      status = 'ON_LEAVE';
      notes = leave.reason;
    } else if (holiday) {
      status = 'HOLIDAY';
      notes = holiday.name;
    } else if (isWeekend) {
      status = 'WEEKEND';
    }

    return {
      attendance_id: att?.id || null,
      employee_id: emp.employee_id,
      employee_code: emp.employee_code,
      name: `${emp.first_name} ${emp.last_name}`,
      email: emp.email,
      department_name: emp.department_name,
      designation_name: emp.designation_name,
      date,
      status,
      check_in_time: checkIn,
      check_out_time: checkOut,
      total_working_hours: hours,
      notes
    };
  });

  return {
    date,
    isWeekend,
    holiday: holiday?.name || null,
    totalEmployees: employees.length,
    presentCount: rows.filter(r => r.status === 'PRESENT').length,
    lateCount: rows.filter(r => r.status === 'LATE').length,
    halfDayCount: rows.filter(r => r.status === 'HALF_DAY').length,
    absentCount: rows.filter(r => r.status === 'ABSENT').length,
    onLeaveCount: rows.filter(r => r.status === 'ON_LEAVE').length,
    missingCheckoutCount: rows.filter(r => r.status === 'MISSING_CHECKOUT').length,
    rows
  };
}

export function correctAttendance(actor: AuthUser, params: {
  employeeId: string;
  date: string;
  newStatus: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalWorkingHours?: number;
  reason: string;
}) {
  if (!params.reason?.trim()) {
    throw new Error('Mandatory correction reason must be provided.');
  }

  const existing = dbHelper.queryOne<any>(
    'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
    [params.employeeId, params.date]
  );

  return dbHelper.transaction(() => {
    let attendanceId = existing?.id;

    if (!existing) {
      attendanceId = crypto.randomUUID();
      dbHelper.run(
        `INSERT INTO attendance (
          id, employee_id, date, check_in_time, check_out_time,
          total_working_hours, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          attendanceId,
          params.employeeId,
          params.date,
          params.checkInTime || null,
          params.checkOutTime || null,
          params.totalWorkingHours || 0,
          params.newStatus,
          `Corrected by HR: ${params.reason.trim()}`
        ]
      );
    } else {
      dbHelper.run(
        `UPDATE attendance SET
          check_in_time = ?,
          check_out_time = ?,
          total_working_hours = ?,
          status = ?,
          notes = ?,
          updated_at = datetime('now')
        WHERE id = ?`,
        [
          params.checkInTime || existing.check_in_time,
          params.checkOutTime || existing.check_out_time,
          params.totalWorkingHours !== undefined ? params.totalWorkingHours : existing.total_working_hours,
          params.newStatus,
          `Corrected by HR: ${params.reason.trim()}`,
          attendanceId
        ]
      );
    }

    // Insert correction audit record
    const correctionId = crypto.randomUUID();
    dbHelper.run(
      `INSERT INTO attendance_corrections (
        id, attendance_id, original_status, new_status,
        original_check_in, new_check_in, original_check_out, new_check_out,
        reason, corrected_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        correctionId,
        attendanceId,
        existing?.status || 'ABSENT',
        params.newStatus,
        existing?.check_in_time || null,
        params.checkInTime || existing?.check_in_time || null,
        existing?.check_out_time || null,
        params.checkOutTime || existing?.check_out_time || null,
        params.reason.trim(),
        actor.id
      ]
    );

    logAudit({
      actor,
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'ATTENDANCE',
      entityId: attendanceId,
      beforeValue: existing,
      afterValue: { status: params.newStatus, checkIn: params.checkInTime, checkOut: params.checkOutTime, reason: params.reason }
    });

    return dbHelper.queryOne('SELECT * FROM attendance WHERE id = ?', [attendanceId]);
  });
}
