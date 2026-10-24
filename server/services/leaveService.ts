/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import { dbHelper } from '../db/database.ts';
import { getCompanySettings } from './organizationService.ts';
import { logAudit } from './auditService.ts';
import { createNotification } from './notificationService.ts';
import type { AuthUser } from '../middleware/auth.ts';

export function calculateWorkingDays(startDateStr: string, endDateStr: string): { workingDays: number; dates: string[] } {
  const start = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T00:00:00Z');

  if (start > end) {
    throw new Error('Start date cannot be after end date.');
  }

  const settings = getCompanySettings();
  const weekends = settings.weekend_days.split(',').map(d => d.trim().toLowerCase());

  // Get holidays in date range
  const holidays = dbHelper.queryAll<{ holiday_date: string }>(
    'SELECT holiday_date FROM company_holidays WHERE holiday_date BETWEEN ? AND ?',
    [startDateStr, endDateStr]
  );
  const holidaySet = new Set(holidays.map(h => h.holiday_date));

  let workingDays = 0;
  const validDates: string[] = [];
  const curr = new Date(start);

  while (curr <= end) {
    const dateStr = curr.toISOString().split('T')[0];
    const dayName = curr.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();

    const isWeekend = weekends.includes(dayName);
    const isHoliday = holidaySet.has(dateStr);

    if (!isWeekend && !isHoliday) {
      workingDays++;
      validDates.push(dateStr);
    }

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return { workingDays, dates: validDates };
}

export function getLeaveBalances(employeeId: string, year?: number) {
  const targetYear = year || new Date().getFullYear();
  return dbHelper.queryAll<any>(
    `SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.is_paid, lt.description as leave_type_description
     FROM leave_balances lb
     JOIN leave_types lt ON lb.leave_type_id = lt.id
     WHERE lb.employee_id = ? AND lb.year = ?
     ORDER BY lt.is_paid DESC, lt.name ASC`,
    [employeeId, targetYear]
  );
}

export function submitLeaveRequest(actor: AuthUser, params: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  const isPrivileged = actor.role === 'ADMIN' || actor.role === 'HR';
  if (!isPrivileged && actor.employeeId !== params.employeeId) {
    throw new Error('Unauthorized. You can only submit leave requests for yourself.');
  }

  if (!params.reason?.trim()) {
    const error: any = new Error('A reason for the leave request is required.');
    error.status = 422;
    throw error;
  }

  // 1. Calculate working days
  const { workingDays } = calculateWorkingDays(params.startDate, params.endDate);
  if (workingDays <= 0) {
    const error: any = new Error('The selected date range contains 0 working days (all days are weekends or holidays).');
    error.status = 422;
    throw error;
  }

  // 2. Check for overlapping requests
  const overlap = dbHelper.queryOne<any>(
    `SELECT id, start_date, end_date, status FROM leave_requests
     WHERE employee_id = ?
       AND status IN ('PENDING', 'APPROVED')
       AND start_date <= ? AND end_date >= ?`,
    [params.employeeId, params.endDate, params.startDate]
  );

  if (overlap) {
    const error: any = new Error(
      `Overlapping leave conflict: you already have a ${overlap.status.toLowerCase()} request from ${overlap.start_date} to ${overlap.end_date}.`
    );
    error.status = 422;
    throw error;
  }

  // 3. Verify Leave Type & Balances
  const leaveType = dbHelper.queryOne<any>('SELECT * FROM leave_types WHERE id = ?', [params.leaveTypeId]);
  if (!leaveType) {
    const error: any = new Error('Invalid leave type selected.');
    error.status = 422;
    throw error;
  }

  const currentYear = new Date(params.startDate).getFullYear();
  let balance = dbHelper.queryOne<any>(
    'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
    [params.employeeId, params.leaveTypeId, currentYear]
  );

  // If no balance row exists yet, initialize it
  if (!balance) {
    const balId = crypto.randomUUID();
    dbHelper.run(
      `INSERT INTO leave_balances (id, employee_id, leave_type_id, allocated_days, used_days, pending_days, year, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, datetime('now'))`,
      [balId, params.employeeId, params.leaveTypeId, leaveType.days_allowed_per_year, currentYear]
    );
    balance = dbHelper.queryOne('SELECT * FROM leave_balances WHERE id = ?', [balId]);
  }

  // If paid leave, check remaining quota
  if (leaveType.is_paid === 1) {
    const remaining = balance.allocated_days - balance.used_days;
    if (workingDays > remaining) {
      const error: any = new Error(
        `Insufficient leave balance. You requested ${workingDays} working days, but only have ${remaining} days remaining for ${leaveType.name}.`
      );
      error.status = 422;
      throw error;
    }
  }

  return dbHelper.transaction(() => {
    const requestId = crypto.randomUUID();

    dbHelper.run(
      `INSERT INTO leave_requests (
        id, employee_id, leave_type_id, start_date, end_date,
        duration_days, reason, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'), datetime('now'))`,
      [
        requestId,
        params.employeeId,
        params.leaveTypeId,
        params.startDate,
        params.endDate,
        workingDays,
        params.reason.trim()
      ]
    );

    // Track pending usage
    dbHelper.run(
      `UPDATE leave_balances SET
        pending_days = pending_days + ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      [workingDays, balance.id]
    );

    // Notify HR
    const emp = dbHelper.queryOne<any>('SELECT first_name, last_name FROM employees WHERE id = ?', [params.employeeId]);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'An employee';
    const hrUsers = dbHelper.queryAll<any>("SELECT id FROM users WHERE role IN ('HR', 'ADMIN') AND is_active = 1");
    for (const hr of hrUsers) {
      createNotification({
        userId: hr.id,
        title: 'New Leave Request',
        message: `${empName} requested ${workingDays} day(s) of ${leaveType.name} (${params.startDate} to ${params.endDate}).`,
        type: 'ACTION_REQUIRED',
        link: '/leaves'
      });
    }

    logAudit({
      actor,
      action: 'LEAVE_REQUEST_SUBMITTED',
      entityType: 'LEAVE_REQUEST',
      entityId: requestId,
      afterValue: {
        employeeId: params.employeeId,
        leaveType: leaveType.name,
        startDate: params.startDate,
        endDate: params.endDate,
        workingDays
      }
    });

    return dbHelper.queryOne('SELECT * FROM leave_requests WHERE id = ?', [requestId]);
  });
}

export function cancelLeaveRequest(actor: AuthUser, requestId: string) {
  const req = dbHelper.queryOne<any>('SELECT * FROM leave_requests WHERE id = ?', [requestId]);
  if (!req) throw new Error('Leave request not found.');

  const isPrivileged = actor.role === 'ADMIN' || actor.role === 'HR';
  if (!isPrivileged && actor.employeeId !== req.employee_id) {
    throw new Error('Unauthorized. You can only cancel your own requests.');
  }

  if (req.status !== 'PENDING') {
    throw new Error(`Cannot cancel request with status '${req.status}'. Only PENDING requests may be cancelled.`);
  }

  const currentYear = new Date(req.start_date).getFullYear();

  return dbHelper.transaction(() => {
    dbHelper.run(
      "UPDATE leave_requests SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?",
      [requestId]
    );

    // Revert pending days
    dbHelper.run(
      `UPDATE leave_balances SET
        pending_days = MAX(0, pending_days - ?),
        updated_at = datetime('now')
      WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
      [req.duration_days, req.employee_id, req.leave_type_id, currentYear]
    );

    logAudit({
      actor,
      action: 'LEAVE_REQUEST_CANCELLED',
      entityType: 'LEAVE_REQUEST',
      entityId: requestId,
      beforeValue: req,
      afterValue: { status: 'CANCELLED' }
    });

    return { success: true };
  });
}

export function reviewLeaveRequest(actor: AuthUser, requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
  const req = dbHelper.queryOne<any>('SELECT * FROM leave_requests WHERE id = ?', [requestId]);
  if (!req) throw new Error('Leave request not found.');

  if (req.status !== 'PENDING') {
    throw new Error(`Cannot review request: it is already ${req.status}.`);
  }

  const currentYear = new Date(req.start_date).getFullYear();

  return dbHelper.transaction(() => {
    dbHelper.run(
      `UPDATE leave_requests SET
        status = ?,
        reviewed_by = ?,
        reviewed_at = datetime('now'),
        reviewer_comments = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      [decision, actor.id, comments?.trim() || null, requestId]
    );

    if (decision === 'APPROVED') {
      // Deduct from pending and add to used
      dbHelper.run(
        `UPDATE leave_balances SET
          pending_days = MAX(0, pending_days - ?),
          used_days = used_days + ?,
          updated_at = datetime('now')
        WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
        [req.duration_days, req.duration_days, req.employee_id, req.leave_type_id, currentYear]
      );
    } else {
      // Revert pending days
      dbHelper.run(
        `UPDATE leave_balances SET
          pending_days = MAX(0, pending_days - ?),
          updated_at = datetime('now')
        WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
        [req.duration_days, req.employee_id, req.leave_type_id, currentYear]
      );
    }

    // Send notification to employee
    const empUser = dbHelper.queryOne<any>('SELECT user_id FROM employees WHERE id = ?', [req.employee_id]);
    if (empUser?.user_id) {
      createNotification({
        userId: empUser.user_id,
        title: `Leave Request ${decision}`,
        message: `Your leave request for ${req.duration_days} day(s) starting ${req.start_date} was ${decision.toLowerCase()}.${comments ? ` Note: "${comments}"` : ''}`,
        type: decision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
        link: '/leaves'
      });
    }

    logAudit({
      actor,
      action: `LEAVE_REQUEST_${decision}`,
      entityType: 'LEAVE_REQUEST',
      entityId: requestId,
      beforeValue: req,
      afterValue: { status: decision, reviewedBy: actor.email, comments }
    });

    return dbHelper.queryOne('SELECT * FROM leave_requests WHERE id = ?', [requestId]);
  });
}

export function getLeaveRequests(viewer: AuthUser, filters?: {
  employeeId?: string;
  status?: string;
  year?: number;
}) {
  const isPrivileged = viewer.role === 'ADMIN' || viewer.role === 'HR';

  let sql = `
    SELECT lr.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.is_paid,
           e.first_name, e.last_name, e.employee_code, e.email as employee_email,
           dept.name as department_name,
           u.email as reviewer_email
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    JOIN employees e ON lr.employee_id = e.id
    LEFT JOIN departments dept ON e.department_id = dept.id
    LEFT JOIN users u ON lr.reviewed_by = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Enforce access control: regular employees can ONLY see their own requests
  if (!isPrivileged) {
    sql += ' AND lr.employee_id = ?';
    params.push(viewer.employeeId || 'none');
  } else if (filters?.employeeId) {
    sql += ' AND lr.employee_id = ?';
    params.push(filters.employeeId);
  }

  if (filters?.status) {
    sql += ' AND lr.status = ?';
    params.push(filters.status);
  }

  if (filters?.year) {
    sql += " AND (strftime('%Y', lr.start_date) = ? OR strftime('%Y', lr.end_date) = ?)";
    params.push(String(filters.year), String(filters.year));
  }

  sql += ' ORDER BY lr.created_at DESC';
  return dbHelper.queryAll<any>(sql, params);
}
