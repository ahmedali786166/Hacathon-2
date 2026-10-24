/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { dbHelper } from '../db/database.ts';
import { authenticate, requireRole, generateToken, type AuthUser } from '../middleware/auth.ts';
import {
  getSetupStatus,
  setupInitialCompanyAndAdmin,
  getCompanySettings,
  updateCompanySettings,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  getLeaveTypes,
  createLeaveType,
  getHolidays,
  createHoliday,
  deleteHoliday
} from '../services/organizationService.ts';
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  getEmployee360,
  updateEmployee,
  createEmployeeUserAccount,
  processEmployeeCsv,
  exportEmployeesCsv
} from '../services/employeeService.ts';
import {
  checkIn,
  checkOut,
  getTodayStatus,
  getEmployeeAttendanceHistory,
  getAttendanceDailyReport,
  correctAttendance,
  getServerDateTime
} from '../services/attendanceService.ts';
import {
  getLeaveBalances,
  submitLeaveRequest,
  cancelLeaveRequest,
  reviewLeaveRequest,
  getLeaveRequests
} from '../services/leaveService.ts';
import {
  generatePayrollDraft,
  finalizeAndLockPayroll,
  getPayrollPeriods,
  getPayrollPeriodById,
  getEmployeePayslips
} from '../services/payrollService.ts';
import { askAssistant, parseSmartLeaveRequest } from '../services/aiService.ts';
import { getAuditLogs, logAudit } from '../services/auditService.ts';
import { getUserNotifications, markAsRead, markAllAsRead, createNotification } from '../services/notificationService.ts';

export const apiRouter = Router();

// ==========================================
// 1. AUTH & SETUP ROUTES
// ==========================================
apiRouter.get('/auth/status', (req: Request, res: Response) => {
  try {
    const status = getSetupStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/auth/setup', async (req: Request, res: Response) => {
  try {
    const { companyName, companyCode, contactEmail, phone, address, adminEmail, adminPassword } = req.body;
    if (!companyName || !companyCode || !contactEmail || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'Missing required company setup fields.' });
    }
    if (adminPassword.length < 6) {
      return res.status(400).json({ error: 'Admin password must be at least 6 characters long.' });
    }

    const result = await setupInitialCompanyAndAdmin({
      companyName,
      companyCode,
      contactEmail,
      phone,
      address,
      adminEmail,
      adminPassword
    });

    const token = generateToken(result.adminUser);
    res.status(201).json({
      message: 'System successfully initialized.',
      token,
      user: result.adminUser,
      company: result.company
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = dbHelper.queryOne<any>('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Your account is deactivated. Please contact HR or System Admin.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Resolve employee id if any
    const emp = dbHelper.queryOne<any>('SELECT id, first_name, last_name, employee_code FROM employees WHERE user_id = ?', [user.id]);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: emp?.id || null,
      mustChangePassword: user.must_change_password === 1
    };

    // Update last login
    dbHelper.run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", [user.id]);

    const token = generateToken(authUser);
    const company = dbHelper.queryOne("SELECT * FROM company_settings WHERE id = 'default'");

    res.json({
      token,
      user: {
        ...authUser,
        employeeCode: emp?.employee_code || null,
        name: emp ? `${emp.first_name} ${emp.last_name}` : user.role === 'ADMIN' ? 'System Administrator' : 'HR Manager'
      },
      company
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/auth/me', authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const emp = user.employeeId
      ? dbHelper.queryOne<any>('SELECT id, first_name, last_name, employee_code, email, department_id, designation_id FROM employees WHERE id = ?', [user.employeeId])
      : null;

    res.json({
      user: {
        ...user,
        employeeCode: emp?.employee_code || null,
        name: emp ? `${emp.first_name} ${emp.last_name}` : user.role === 'ADMIN' ? 'System Administrator' : 'HR Manager'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/auth/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = dbHelper.queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // If not first time, check old password
    if (user.must_change_password !== 1) {
      if (!oldPassword) return res.status(400).json({ error: 'Current password is required.' });
      const valid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    dbHelper.run(
      "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?",
      [newHash, user.id]
    );

    logAudit({
      actor: req.user!,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: user.id
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin-only user management
apiRouter.get('/auth/users', authenticate, requireRole(['ADMIN']), (req: Request, res: Response) => {
  const users = dbHelper.queryAll<any>(`
    SELECT u.id, u.email, u.role, u.is_active, u.must_change_password, u.last_login_at, u.created_at,
           e.first_name, e.last_name, e.employee_code
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    ORDER BY u.created_at DESC
  `);
  res.json(users);
});

apiRouter.post('/auth/create-user', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password and role are required.' });
    }
    if (!['ADMIN', 'HR', 'EMPLOYEE'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const existing = dbHelper.queryOne('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: `User with email '${email}' already exists.` });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const id = crypto.randomUUID();

    dbHelper.run(
      `INSERT INTO users (id, email, password_hash, role, is_active, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'))`,
      [id, email.trim().toLowerCase(), hash, role]
    );

    logAudit({
      actor: req.user!,
      action: 'USER_ACCOUNT_CREATED',
      entityType: 'USER',
      entityId: id,
      afterValue: { email, role }
    });

    res.status(201).json({ message: 'User account created successfully.', userId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/auth/users/:id/status', authenticate, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    dbHelper.run(
      "UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?",
      [isActive ? 1 : 0, id]
    );

    logAudit({
      actor: req.user!,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: id
    });

    res.json({ success: true, isActive: !!isActive });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. ORGANIZATION SETTINGS & MASTERS
// ==========================================
apiRouter.get('/org/company', authenticate, (req: Request, res: Response) => {
  try {
    const settings = getCompanySettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/org/company', authenticate, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const updated = updateCompanySettings(req.user!, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Departments
apiRouter.get('/org/departments', authenticate, (req: Request, res: Response) => {
  res.json(getDepartments());
});

apiRouter.post('/org/departments', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Department name and code are required.' });
    const dept = createDepartment(req.user!, name, code, description);
    res.status(201).json(dept);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/org/departments/:id', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { name, code, description, is_active } = req.body;
    const dept = updateDepartment(req.user!, req.params.id, name, code, description, is_active);
    res.json(dept);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/org/departments/:id', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    deleteDepartment(req.user!, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Designations
apiRouter.get('/org/designations', authenticate, (req: Request, res: Response) => {
  const { departmentId } = req.query;
  res.json(getDesignations(departmentId as string));
});

apiRouter.post('/org/designations', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { name, code, department_id, description } = req.body;
    if (!name || !code || !department_id) return res.status(400).json({ error: 'Name, code, and department are required.' });
    const desig = createDesignation(req.user!, name, code, department_id, description);
    res.status(201).json(desig);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/org/designations/:id', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { name, code, department_id, description, is_active } = req.body;
    const desig = updateDesignation(req.user!, req.params.id, name, code, department_id, description, is_active);
    res.json(desig);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/org/designations/:id', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    deleteDesignation(req.user!, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Leave Types
apiRouter.get('/org/leave-types', authenticate, (req: Request, res: Response) => {
  res.json(getLeaveTypes());
});

apiRouter.post('/org/leave-types', authenticate, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { name, code, days_allowed_per_year, is_paid, description } = req.body;
    if (!name || !code || days_allowed_per_year === undefined) {
      return res.status(400).json({ error: 'Name, code, and days allowed are required.' });
    }
    const lt = createLeaveType(req.user!, name, code, Number(days_allowed_per_year), !!is_paid, description);
    res.status(201).json(lt);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Holidays
apiRouter.get('/org/holidays', authenticate, (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  res.json(getHolidays(year));
});

apiRouter.post('/org/holidays', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { name, holiday_date, description } = req.body;
    if (!name || !holiday_date) return res.status(400).json({ error: 'Holiday name and date are required.' });
    const h = createHoliday(req.user!, name, holiday_date, description);
    res.status(201).json(h);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/org/holidays/:id', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    deleteHoliday(req.user!, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 3. EMPLOYEE MANAGEMENT
// ==========================================
apiRouter.get('/employees', authenticate, (req: Request, res: Response) => {
  try {
    const { search, department_id, status, limit, offset } = req.query;
    const result = getEmployees(req.user!, {
      search: search as string,
      department_id: department_id as string,
      status: status as string,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/employees', authenticate, requireRole(['ADMIN', 'HR']), async (req: Request, res: Response) => {
  try {
    const created = await createEmployee(req.user!, req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/employees/:id', authenticate, (req: Request, res: Response) => {
  try {
    const emp = getEmployeeById(req.params.id, req.user!);
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });
    res.json(emp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/employees/:id', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const updated = updateEmployee(req.user!, req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/employees/:id/360', authenticate, (req: Request, res: Response) => {
  try {
    const profile = getEmployee360(req.params.id, req.user!);
    res.json(profile);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.post('/employees/:id/create-account', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const result = createEmployeeUserAccount(req.user!, req.params.id, req.body.initialPassword);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/employees/csv/import', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { rows, dryRun } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Rows array is required.' });
    }
    const result = processEmployeeCsv(req.user!, rows, dryRun !== false);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/employees/csv/export', authenticate, (req: Request, res: Response) => {
  try {
    const csvData = exportEmployeesCsv(req.user!);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="hcm_employees.csv"');
    res.send(csvData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. ATTENDANCE
// ==========================================
apiRouter.get('/attendance/today', authenticate, (req: Request, res: Response) => {
  try {
    if (!req.user!.employeeId) {
      return res.json({ date: getServerDateTime().dateStr, checkedIn: false, checkedOut: false, record: null });
    }
    const status = getTodayStatus(req.user!.employeeId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/attendance/check-in', authenticate, (req: Request, res: Response) => {
  try {
    if (!req.user!.employeeId) {
      return res.status(400).json({ error: 'Your account is not linked to an employee profile. Only employees can check in.' });
    }
    const record = checkIn(req.user!.employeeId, req.body.coords);
    res.json(record);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

apiRouter.post('/attendance/check-out', authenticate, (req: Request, res: Response) => {
  try {
    if (!req.user!.employeeId) {
      return res.status(400).json({ error: 'Your account is not linked to an employee profile. Only employees can check out.' });
    }
    const record = checkOut(req.user!.employeeId, req.body.coords);
    res.json(record);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

apiRouter.get('/attendance/history', authenticate, (req: Request, res: Response) => {
  try {
    const { employeeId, month, year } = req.query;
    const isPrivileged = req.user!.role === 'ADMIN' || req.user!.role === 'HR';
    const targetEmpId = isPrivileged && employeeId ? String(employeeId) : req.user!.employeeId;

    if (!targetEmpId) {
      return res.json([]);
    }

    const history = getEmployeeAttendanceHistory(
      targetEmpId,
      month ? Number(month) : undefined,
      year ? Number(year) : undefined
    );
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/attendance/daily-report', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || getServerDateTime().dateStr;
    const departmentId = req.query.departmentId as string;
    const report = getAttendanceDailyReport(date, departmentId);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/attendance/correction', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const record = correctAttendance(req.user!, req.body);
    res.json(record);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 5. LEAVES & SMART LEAVE
// ==========================================
apiRouter.get('/leaves/balances', authenticate, (req: Request, res: Response) => {
  try {
    const { employeeId, year } = req.query;
    const isPrivileged = req.user!.role === 'ADMIN' || req.user!.role === 'HR';
    const targetEmpId = isPrivileged && employeeId ? String(employeeId) : req.user!.employeeId;

    if (!targetEmpId) return res.json([]);
    const balances = getLeaveBalances(targetEmpId, year ? Number(year) : undefined);
    res.json(balances);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/leaves/requests', authenticate, (req: Request, res: Response) => {
  try {
    const { employeeId, status, year } = req.query;
    const requests = getLeaveRequests(req.user!, {
      employeeId: employeeId as string,
      status: status as string,
      year: year ? Number(year) : undefined
    });
    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/leaves/requests', authenticate, (req: Request, res: Response) => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, reason } = req.body;
    const targetEmpId = employeeId || req.user!.employeeId;
    if (!targetEmpId) return res.status(400).json({ error: 'Employee ID is required.' });

    const created = submitLeaveRequest(req.user!, {
      employeeId: targetEmpId,
      leaveTypeId,
      startDate,
      endDate,
      reason
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

apiRouter.post('/leaves/requests/:id/cancel', authenticate, (req: Request, res: Response) => {
  try {
    const result = cancelLeaveRequest(req.user!, req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/leaves/requests/:id/review', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { decision, comments } = req.body;
    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: "Decision must be 'APPROVED' or 'REJECTED'." });
    }
    const updated = reviewLeaveRequest(req.user!, req.params.id, decision, comments);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/leaves/smart-leave/parse', authenticate, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Natural language prompt is required.' });
    }
    const prefill = await parseSmartLeaveRequest(prompt.trim());
    res.json(prefill);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. PAYROLL
// ==========================================
apiRouter.get('/payroll/periods', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const periods = getPayrollPeriods();
    res.json(periods);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/payroll/periods/:id', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const details = getPayrollPeriodById(req.params.id);
    if (!details) return res.status(404).json({ error: 'Payroll period not found.' });
    res.json(details);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/payroll/generate-draft', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ error: 'Month and year are required.' });
    const period = generatePayrollDraft(req.user!, Number(month), Number(year));
    res.status(201).json(period);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/payroll/periods/:id/lock', authenticate, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const finalized = finalizeAndLockPayroll(req.user!, req.params.id);
    res.json(finalized);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

apiRouter.get('/payroll/my-payslips', authenticate, (req: Request, res: Response) => {
  try {
    if (!req.user!.employeeId) {
      return res.json([]);
    }
    const payslips = getEmployeePayslips(req.user!.employeeId, req.user!);
    res.json(payslips);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/payroll/employee/:id/payslips', authenticate, (req: Request, res: Response) => {
  try {
    const payslips = getEmployeePayslips(req.params.id, req.user!);
    res.json(payslips);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// ==========================================
// 7. AI HR ASSISTANT
// ==========================================
apiRouter.post('/ai/chat', authenticate, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }
    const response = await askAssistant(req.user!, prompt.trim());
    res.json(response);
  } catch (err: any) {
    res.status(429).json({ error: err.message });
  }
});

apiRouter.get('/ai/status', authenticate, (req: Request, res: Response) => {
  res.json({
    hasApiKey: !!process.env.GEMINI_API_KEY,
    model: 'gemini-3.8-flash'
  });
});

// ==========================================
// 8. COMMUNICATIONS & NOTIFICATIONS
// ==========================================
apiRouter.get('/communications/announcements', authenticate, (req: Request, res: Response) => {
  try {
    const userRole = req.user!.role;
    let sql = `
      SELECT a.*, u.email as author_email, dept.name as department_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN departments dept ON a.target_department_id = dept.id
      WHERE a.target_audience = 'ALL' OR a.target_audience = ?
    `;
    const params: any[] = [userRole];

    if (userRole === 'ADMIN' || userRole === 'HR') {
      sql = `
        SELECT a.*, u.email as author_email, dept.name as department_name
        FROM announcements a
        LEFT JOIN users u ON a.author_id = u.id
        LEFT JOIN departments dept ON a.target_department_id = dept.id
      `;
      params.length = 0;
    }

    sql += ' ORDER BY a.is_pinned DESC, a.created_at DESC LIMIT 30';
    const announcements = dbHelper.queryAll<any>(sql, params);
    res.json(announcements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/communications/announcements', authenticate, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { title, content, target_audience, target_department_id, is_pinned } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const id = crypto.randomUUID();
    dbHelper.run(
      `INSERT INTO announcements (
        id, title, content, target_audience, target_department_id, is_pinned, author_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        title.trim(),
        content.trim(),
        target_audience || 'ALL',
        target_department_id || null,
        is_pinned ? 1 : 0,
        req.user!.id
      ]
    );

    logAudit({
      actor: req.user!,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      afterValue: { title, target_audience }
    });

    res.status(201).json(dbHelper.queryOne('SELECT * FROM announcements WHERE id = ?', [id]));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/communications/notifications', authenticate, (req: Request, res: Response) => {
  try {
    const list = getUserNotifications(req.user!.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/communications/notifications/:id/read', authenticate, (req: Request, res: Response) => {
  try {
    markAsRead(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/communications/notifications/read-all', authenticate, (req: Request, res: Response) => {
  try {
    markAllAsRead(req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 9. AUDIT LOGS (ADMIN ONLY)
// ==========================================
apiRouter.get('/audit', authenticate, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { entityType, action, limit, offset } = req.query;
    const logs = getAuditLogs({
      entityType: entityType as string,
      action: action as string,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0
    });
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. REAL DATABASE STATS & DASHBOARDS
// ==========================================
apiRouter.get('/stats/dashboard', authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { dateStr } = getServerDateTime();

    if (user.role === 'EMPLOYEE' && user.employeeId) {
      // Employee personal dashboard stats
      const todayAtt = dbHelper.queryOne<any>('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [user.employeeId, dateStr]);
      const balances = getLeaveBalances(user.employeeId);
      const pendingLeaves = dbHelper.queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM leave_requests WHERE employee_id = ? AND status = 'PENDING'",
        [user.employeeId]
      )?.count || 0;
      const latestPayslip = dbHelper.queryOne<any>(
        `SELECT pi.*, pp.month, pp.year
         FROM payroll_items pi
         JOIN payroll_periods pp ON pi.period_id = pp.id
         WHERE pi.employee_id = ? AND pp.status = 'LOCKED'
         ORDER BY pp.year DESC, pp.month DESC LIMIT 1`,
        [user.employeeId]
      );

      return res.json({
        role: 'EMPLOYEE',
        todayAttendance: todayAtt,
        leaveBalances: balances,
        pendingLeavesCount: pendingLeaves,
        latestPayslip
      });
    }

    // HR and Admin aggregated dashboard metrics derived directly from real database
    const headcount = dbHelper.queryOne<{ total: number; active: number }>(
      "SELECT COUNT(*) as total, SUM(CASE WHEN employment_status = 'ACTIVE' THEN 1 ELSE 0 END) as active FROM employees"
    );

    const todayReport = getAttendanceDailyReport(dateStr);

    const pendingLeaveCount = dbHelper.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM leave_requests WHERE status = 'PENDING'"
    )?.count || 0;

    const approvedLeaveThisMonth = dbHelper.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM leave_requests
       WHERE status = 'APPROVED' AND strftime('%Y-%m', start_date) = strftime('%Y-%m', 'now')`
    )?.count || 0;

    const departmentStats = dbHelper.queryAll<any>(
      `SELECT d.name, COUNT(e.id) as employee_count
       FROM departments d
       LEFT JOIN employees e ON e.department_id = d.id AND e.employment_status = 'ACTIVE'
       GROUP BY d.id ORDER BY employee_count DESC`
    );

    let payrollSummary = null;
    if (user.role === 'ADMIN' || user.role === 'HR') {
      payrollSummary = dbHelper.queryOne<any>(
        `SELECT * FROM payroll_periods ORDER BY year DESC, month DESC LIMIT 1`
      );
    }

    res.json({
      role: user.role,
      date: dateStr,
      headcount: {
        total: headcount?.total || 0,
        active: headcount?.active || 0
      },
      attendanceToday: {
        total: todayReport.totalEmployees,
        present: todayReport.presentCount,
        late: todayReport.lateCount,
        halfDay: todayReport.halfDayCount,
        absent: todayReport.absentCount,
        onLeave: todayReport.onLeaveCount,
        missingCheckout: todayReport.missingCheckoutCount
      },
      pendingLeavesCount: pendingLeaveCount,
      approvedLeavesThisMonth: approvedLeaveThisMonth,
      departmentStats,
      payrollSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
