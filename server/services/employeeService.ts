/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { dbHelper } from '../db/database.ts';
import { logAudit } from './auditService.ts';
import type { AuthUser } from '../middleware/auth.ts';

export interface EmployeeRecord {
  id: string;
  employee_code: string;
  user_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  department_id: string;
  department_name?: string;
  designation_id: string;
  designation_name?: string;
  join_date: string;
  employment_status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | 'ON_LEAVE';
  basic_salary: number;
  bank_name?: string | null;
  bank_account_number?: string | null;
  national_id?: string | null;
  emergency_contact?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeInput {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department_id: string;
  designation_id: string;
  join_date: string;
  employment_status?: 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | 'ON_LEAVE';
  basic_salary: number;
  bank_name?: string;
  bank_account_number?: string;
  national_id?: string;
  emergency_contact?: string;
  createUserAccount?: boolean;
  temporaryPassword?: string;
}

export function initializeEmployeeLeaveBalances(employeeId: string, year?: number) {
  const currentYear = year || new Date().getFullYear();
  const leaveTypes = dbHelper.queryAll<{ id: string; days_allowed_per_year: number }>('SELECT id, days_allowed_per_year FROM leave_types WHERE is_active = 1');

  for (const lt of leaveTypes) {
    const existing = dbHelper.queryOne('SELECT id FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?', [employeeId, lt.id, currentYear]);
    if (!existing) {
      dbHelper.run(
        `INSERT INTO leave_balances (id, employee_id, leave_type_id, allocated_days, used_days, pending_days, year, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, datetime('now'))`,
        [crypto.randomUUID(), employeeId, lt.id, lt.days_allowed_per_year, currentYear]
      );
    }
  }
}

export async function createEmployee(actor: AuthUser, input: CreateEmployeeInput) {
  // Check duplicates
  const existingCode = dbHelper.queryOne('SELECT id FROM employees WHERE employee_code = ?', [input.employee_code.trim()]);
  if (existingCode) {
    throw new Error(`Employee ID/Code '${input.employee_code}' already exists.`);
  }

  const existingEmail = dbHelper.queryOne('SELECT id FROM employees WHERE email = ?', [input.email.trim().toLowerCase()]);
  if (existingEmail) {
    throw new Error(`Employee with email '${input.email}' already exists.`);
  }

  // Validate department & designation
  const dept = dbHelper.queryOne('SELECT id FROM departments WHERE id = ?', [input.department_id]);
  if (!dept) throw new Error('Invalid department selected.');

  const desig = dbHelper.queryOne('SELECT id FROM designations WHERE id = ?', [input.designation_id]);
  if (!desig) throw new Error('Invalid designation selected.');

  return dbHelper.transaction(async () => {
    let userId: string | null = null;

    if (input.createUserAccount) {
      const existingUser = dbHelper.queryOne('SELECT id FROM users WHERE email = ?', [input.email.trim().toLowerCase()]);
      if (existingUser) {
        throw new Error(`A user login with email '${input.email}' already exists.`);
      }

      const tempPass = input.temporaryPassword || 'Saylani@2026';
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(tempPass, salt);
      userId = crypto.randomUUID();

      dbHelper.run(
        `INSERT INTO users (id, email, password_hash, role, is_active, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, 'EMPLOYEE', 1, 1, datetime('now'), datetime('now'))`,
        [userId, input.email.trim().toLowerCase(), passwordHash]
      );
    }

    const employeeId = crypto.randomUUID();
    dbHelper.run(
      `INSERT INTO employees (
        id, employee_code, user_id, first_name, last_name, email, phone,
        department_id, designation_id, join_date, employment_status, basic_salary,
        bank_name, bank_account_number, national_id, emergency_contact,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        employeeId,
        input.employee_code.trim().toUpperCase(),
        userId,
        input.first_name.trim(),
        input.last_name.trim(),
        input.email.trim().toLowerCase(),
        input.phone?.trim() || null,
        input.department_id,
        input.designation_id,
        input.join_date,
        input.employment_status || 'ACTIVE',
        Number(input.basic_salary) || 0,
        input.bank_name?.trim() || null,
        input.bank_account_number?.trim() || null,
        input.national_id?.trim() || null,
        input.emergency_contact?.trim() || null
      ]
    );

    // Initialize leave balances for this employee
    initializeEmployeeLeaveBalances(employeeId);

    const created = getEmployeeById(employeeId, actor);
    logAudit({
      actor,
      action: 'EMPLOYEE_CREATED',
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      afterValue: { employee_code: input.employee_code, name: `${input.first_name} ${input.last_name}`, email: input.email }
    });

    return created;
  });
}

export function getEmployees(viewer: AuthUser, filters?: {
  search?: string;
  department_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  const isPrivileged = viewer.role === 'ADMIN' || viewer.role === 'HR';

  let sql = `
    SELECT
      e.id, e.employee_code, e.user_id, e.first_name, e.last_name, e.email, e.phone,
      e.department_id, dept.name as department_name,
      e.designation_id, desig.name as designation_name,
      e.join_date, e.employment_status,
      ${isPrivileged ? 'e.basic_salary, e.bank_name, e.bank_account_number, e.national_id, e.emergency_contact,' : ''}
      e.created_at, e.updated_at
    FROM employees e
    LEFT JOIN departments dept ON e.department_id = dept.id
    LEFT JOIN designations desig ON e.designation_id = desig.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters?.search) {
    const s = `%${filters.search.trim()}%`;
    sql += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.employee_code LIKE ?)';
    params.push(s, s, s, s);
  }

  if (filters?.department_id) {
    sql += ' AND e.department_id = ?';
    params.push(filters.department_id);
  }

  if (filters?.status) {
    sql += ' AND e.employment_status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY e.first_name ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = dbHelper.queryAll<any>(sql, params);

  // Total count for pagination
  let countSql = 'SELECT COUNT(*) as count FROM employees e WHERE 1=1';
  const countParams: any[] = [];
  if (filters?.search) {
    const s = `%${filters.search.trim()}%`;
    countSql += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.employee_code LIKE ?)';
    countParams.push(s, s, s, s);
  }
  if (filters?.department_id) {
    countSql += ' AND e.department_id = ?';
    countParams.push(filters.department_id);
  }
  if (filters?.status) {
    countSql += ' AND e.employment_status = ?';
    countParams.push(filters.status);
  }
  const total = dbHelper.queryOne<{ count: number }>(countSql, countParams)?.count || 0;

  return { rows, total };
}

export function getEmployeeById(employeeId: string, viewer: AuthUser) {
  const isPrivileged = viewer.role === 'ADMIN' || viewer.role === 'HR';
  const isSelf = viewer.employeeId === employeeId;

  const emp = dbHelper.queryOne<any>(
    `SELECT
      e.*,
      dept.name as department_name,
      desig.name as designation_name,
      u.is_active as user_active,
      u.must_change_password
    FROM employees e
    LEFT JOIN departments dept ON e.department_id = dept.id
    LEFT JOIN designations desig ON e.designation_id = desig.id
    LEFT JOIN users u ON e.user_id = u.id
    WHERE e.id = ?`,
    [employeeId]
  );

  if (!emp) return null;

  // Mask confidential fields if not privileged and not self
  if (!isPrivileged && !isSelf) {
    delete emp.basic_salary;
    delete emp.bank_name;
    delete emp.bank_account_number;
    delete emp.national_id;
    delete emp.emergency_contact;
  }

  return emp;
}

export function getEmployee360(employeeId: string, viewer: AuthUser) {
  const employee = getEmployeeById(employeeId, viewer);
  if (!employee) throw new Error('Employee not found.');

  const isPrivileged = viewer.role === 'ADMIN' || viewer.role === 'HR';
  const isSelf = viewer.employeeId === employeeId;

  // Leave balances
  const leaveBalances = dbHelper.queryAll<any>(
    `SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.is_paid
     FROM leave_balances lb
     JOIN leave_types lt ON lb.leave_type_id = lt.id
     WHERE lb.employee_id = ? AND lb.year = ?`,
    [employeeId, new Date().getFullYear()]
  );

  // Recent attendance (last 30 records)
  const recentAttendance = dbHelper.queryAll<any>(
    'SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 30',
    [employeeId]
  );

  // Leave requests
  const leaveRequests = dbHelper.queryAll<any>(
    `SELECT lr.*, lt.name as leave_type_name
     FROM leave_requests lr
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.employee_id = ? ORDER BY lr.created_at DESC LIMIT 15`,
    [employeeId]
  );

  // Payslips (only for privileged or self)
  let payslips: any[] = [];
  if (isPrivileged || isSelf) {
    payslips = dbHelper.queryAll<any>(
      `SELECT pi.*, pp.month, pp.year, pp.status as period_status
       FROM payroll_items pi
       JOIN payroll_periods pp ON pi.period_id = pp.id
       WHERE pi.employee_id = ? ${!isPrivileged ? "AND pp.status = 'LOCKED'" : ''}
       ORDER BY pp.year DESC, pp.month DESC LIMIT 12`,
      [employeeId]
    );
  }

  return {
    employee,
    leaveBalances,
    recentAttendance,
    leaveRequests,
    payslips
  };
}

export function updateEmployee(actor: AuthUser, id: string, updates: Partial<EmployeeRecord>) {
  const before = dbHelper.queryOne('SELECT * FROM employees WHERE id = ?', [id]);
  if (!before) throw new Error('Employee not found.');

  dbHelper.run(
    `UPDATE employees SET
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      phone = COALESCE(?, phone),
      department_id = COALESCE(?, department_id),
      designation_id = COALESCE(?, designation_id),
      employment_status = COALESCE(?, employment_status),
      basic_salary = COALESCE(?, basic_salary),
      bank_name = COALESCE(?, bank_name),
      bank_account_number = COALESCE(?, bank_account_number),
      national_id = COALESCE(?, national_id),
      emergency_contact = COALESCE(?, emergency_contact),
      updated_at = datetime('now')
    WHERE id = ?`,
    [
      updates.first_name,
      updates.last_name,
      updates.phone,
      updates.department_id,
      updates.designation_id,
      updates.employment_status,
      updates.basic_salary !== undefined ? Number(updates.basic_salary) : null,
      updates.bank_name,
      updates.bank_account_number,
      updates.national_id,
      updates.emergency_contact,
      id
    ]
  );

  const after = dbHelper.queryOne('SELECT * FROM employees WHERE id = ?', [id]);
  logAudit({
    actor,
    action: 'EMPLOYEE_UPDATED',
    entityType: 'EMPLOYEE',
    entityId: id,
    beforeValue: before,
    afterValue: after
  });

  return getEmployeeById(id, actor);
}

export function createEmployeeUserAccount(actor: AuthUser, employeeId: string, initialPassword?: string) {
  const emp = dbHelper.queryOne<any>('SELECT * FROM employees WHERE id = ?', [employeeId]);
  if (!emp) throw new Error('Employee not found.');

  if (emp.user_id) {
    throw new Error('Employee already has an associated user account.');
  }

  const existingUser = dbHelper.queryOne('SELECT id FROM users WHERE email = ?', [emp.email.toLowerCase()]);
  if (existingUser) {
    throw new Error(`A user account already exists for ${emp.email}.`);
  }

  const password = initialPassword || 'Saylani@2026';
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  const userId = crypto.randomUUID();

  dbHelper.transaction(() => {
    dbHelper.run(
      `INSERT INTO users (id, email, password_hash, role, is_active, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, 'EMPLOYEE', 1, 1, datetime('now'), datetime('now'))`,
      [userId, emp.email.toLowerCase(), hash]
    );
    dbHelper.run('UPDATE employees SET user_id = ? WHERE id = ?', [userId, employeeId]);
  });

  logAudit({
    actor,
    action: 'USER_ACCOUNT_CREATED_FOR_EMPLOYEE',
    entityType: 'USER',
    entityId: userId,
    afterValue: { employeeId, email: emp.email }
  });

  return { userId, email: emp.email, temporaryPassword: password };
}

// CSV Import with Dry-Run validation
export interface CsvImportRow {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department_code: string;
  designation_code: string;
  join_date: string;
  basic_salary: number;
}

export function processEmployeeCsv(actor: AuthUser, rows: CsvImportRow[], dryRun: boolean = true) {
  const validationErrors: { row: number; field: string; error: string; raw: any }[] = [];
  const validRows: any[] = [];
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  const departments = dbHelper.queryAll<{ id: string; code: string }>('SELECT id, code FROM departments');
  const deptMap = new Map(departments.map(d => [d.code.toUpperCase(), d.id]));

  const designations = dbHelper.queryAll<{ id: string; code: string; department_id: string }>('SELECT id, code, department_id FROM designations');
  const desigMap = new Map(designations.map(d => [d.code.toUpperCase(), d]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    if (!row.employee_code?.trim()) {
      validationErrors.push({ row: rowNum, field: 'employee_code', error: 'Missing employee code', raw: row });
      continue;
    }
    const code = row.employee_code.trim().toUpperCase();
    if (seenCodes.has(code)) {
      validationErrors.push({ row: rowNum, field: 'employee_code', error: `Duplicate employee code '${code}' in CSV`, raw: row });
      continue;
    }
    seenCodes.add(code);

    if (!row.email?.trim() || !row.email.includes('@')) {
      validationErrors.push({ row: rowNum, field: 'email', error: 'Invalid or missing email', raw: row });
      continue;
    }
    const email = row.email.trim().toLowerCase();
    if (seenEmails.has(email)) {
      validationErrors.push({ row: rowNum, field: 'email', error: `Duplicate email '${email}' in CSV`, raw: row });
      continue;
    }
    seenEmails.add(email);

    // Check DB duplicates
    const dbCode = dbHelper.queryOne('SELECT id FROM employees WHERE employee_code = ?', [code]);
    if (dbCode) {
      validationErrors.push({ row: rowNum, field: 'employee_code', error: `Code '${code}' already exists in database`, raw: row });
      continue;
    }

    const dbEmail = dbHelper.queryOne('SELECT id FROM employees WHERE email = ?', [email]);
    if (dbEmail) {
      validationErrors.push({ row: rowNum, field: 'email', error: `Email '${email}' already exists in database`, raw: row });
      continue;
    }

    const deptId = deptMap.get(row.department_code?.trim().toUpperCase());
    if (!deptId) {
      validationErrors.push({ row: rowNum, field: 'department_code', error: `Department code '${row.department_code}' does not exist`, raw: row });
      continue;
    }

    const desig = desigMap.get(row.designation_code?.trim().toUpperCase());
    if (!desig) {
      validationErrors.push({ row: rowNum, field: 'designation_code', error: `Designation code '${row.designation_code}' does not exist`, raw: row });
      continue;
    }

    const salary = Number(row.basic_salary) || 0;
    if (salary < 0) {
      validationErrors.push({ row: rowNum, field: 'basic_salary', error: 'Basic salary cannot be negative', raw: row });
      continue;
    }

    validRows.push({
      employee_code: code,
      first_name: row.first_name?.trim() || '',
      last_name: row.last_name?.trim() || '',
      email,
      phone: row.phone?.trim() || null,
      department_id: deptId,
      designation_id: desig.id,
      join_date: row.join_date || new Date().toISOString().split('T')[0],
      basic_salary: salary
    });
  }

  if (dryRun) {
    return {
      dryRun: true,
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: validationErrors.length,
      errors: validationErrors,
      sampleValid: validRows.slice(0, 5)
    };
  }

  // Execute import
  let importedCount = 0;
  dbHelper.transaction(() => {
    for (const item of validRows) {
      const empId = crypto.randomUUID();
      dbHelper.run(
        `INSERT INTO employees (
          id, employee_code, first_name, last_name, email, phone,
          department_id, designation_id, join_date, employment_status, basic_salary,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, datetime('now'), datetime('now'))`,
        [empId, item.employee_code, item.first_name, item.last_name, item.email, item.phone, item.department_id, item.designation_id, item.join_date, item.basic_salary]
      );
      initializeEmployeeLeaveBalances(empId);
      importedCount++;
    }
  });

  logAudit({
    actor,
    action: 'EMPLOYEES_CSV_IMPORTED',
    entityType: 'EMPLOYEE',
    afterValue: { importedCount, invalidCount: validationErrors.length }
  });

  return {
    dryRun: false,
    importedCount,
    errors: validationErrors
  };
}

export function exportEmployeesCsv(viewer: AuthUser) {
  const isPrivileged = viewer.role === 'ADMIN' || viewer.role === 'HR';
  const employees = dbHelper.queryAll<any>(
    `SELECT e.employee_code, e.first_name, e.last_name, e.email, e.phone,
            dept.name as department, desig.name as designation, e.join_date, e.employment_status
            ${isPrivileged ? ', e.basic_salary' : ''}
     FROM employees e
     LEFT JOIN departments dept ON e.department_id = dept.id
     LEFT JOIN designations desig ON e.designation_id = desig.id
     ORDER BY e.employee_code ASC`
  );

  const headers = ['Employee Code', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Designation', 'Join Date', 'Status'];
  if (isPrivileged) headers.push('Basic Salary (PKR)');

  const csvLines = [headers.join(',')];
  for (const emp of employees) {
    const line = [
      `"${emp.employee_code}"`,
      `"${emp.first_name}"`,
      `"${emp.last_name}"`,
      `"${emp.email}"`,
      `"${emp.phone || ''}"`,
      `"${emp.department || ''}"`,
      `"${emp.designation || ''}"`,
      `"${emp.join_date}"`,
      `"${emp.employment_status}"`
    ];
    if (isPrivileged) {
      line.push(`"${emp.basic_salary || 0}"`);
    }
    csvLines.push(line.join(','));
  }

  return csvLines.join('\n');
}
