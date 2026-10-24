/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { dbHelper } from '../db/database.ts';
import { logAudit } from './auditService.ts';
import type { AuthUser } from '../middleware/auth.ts';

export interface CompanySettings {
  id: string;
  company_name: string;
  company_code: string;
  contact_email: string;
  phone?: string | null;
  address?: string | null;
  currency: string;
  timezone: string;
  office_start_time: string;
  office_end_time: string;
  grace_period_minutes: number;
  half_day_threshold_hours: number;
  weekend_days: string;
  late_deduction_policy: string;
  office_latitude?: number | null;
  office_longitude?: number | null;
  geofence_radius_meters?: number | null;
  policy_document?: string | null;
}

export function getSetupStatus() {
  const adminCount = dbHelper.queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'"
  )?.count || 0;

  const company = dbHelper.queryOne<CompanySettings>(
    "SELECT * FROM company_settings WHERE id = 'default'"
  );

  return {
    isConfigured: adminCount > 0 && !!company,
    hasAdmin: adminCount > 0,
    company: company || null
  };
}

export async function setupInitialCompanyAndAdmin(data: {
  companyName: string;
  companyCode: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  adminEmail: string;
  adminPassword: string;
  officeStartTime?: string;
  officeEndTime?: string;
  gracePeriodMinutes?: number;
  weekendDays?: string;
}) {
  const status = getSetupStatus();
  if (status.isConfigured) {
    throw new Error('Initial system setup has already been completed. Unauthorized registration blocked.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.adminPassword, salt);
  const adminUserId = crypto.randomUUID();

  return dbHelper.transaction(() => {
    // 1. Create or replace default company settings
    dbHelper.run(
      `INSERT INTO company_settings (
        id, company_name, company_code, contact_email, phone, address, currency, timezone,
        office_start_time, office_end_time, grace_period_minutes, half_day_threshold_hours,
        weekend_days, late_deduction_policy, created_at, updated_at
      ) VALUES (
        'default', ?, ?, ?, ?, ?, 'PKR', 'Asia/Karachi',
        ?, ?, ?, 5.0,
        ?, '3_LATE_HALF_DAY', datetime('now'), datetime('now')
      ) ON CONFLICT(id) DO UPDATE SET
        company_name = excluded.company_name,
        company_code = excluded.company_code,
        contact_email = excluded.contact_email,
        phone = excluded.phone,
        address = excluded.address,
        office_start_time = excluded.office_start_time,
        office_end_time = excluded.office_end_time,
        grace_period_minutes = excluded.grace_period_minutes,
        weekend_days = excluded.weekend_days,
        updated_at = datetime('now')`,
      [
        data.companyName.trim(),
        data.companyCode.trim().toUpperCase(),
        data.contactEmail.trim(),
        data.phone?.trim() || null,
        data.address?.trim() || null,
        data.officeStartTime || '09:00',
        data.officeEndTime || '17:00',
        data.gracePeriodMinutes || 15,
        data.weekendDays || 'Saturday,Sunday'
      ]
    );

    // 2. Insert Admin User
    dbHelper.run(
      `INSERT INTO users (id, email, password_hash, role, is_active, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, 'ADMIN', 1, 0, datetime('now'), datetime('now'))`,
      [adminUserId, data.adminEmail.trim().toLowerCase(), passwordHash]
    );

    // 3. Configure default Leave Types (Annual=14, Sick=8, Casual=10, Unpaid=Unlimited)
    const defaultLeaves = [
      { id: crypto.randomUUID(), name: 'Annual Leave', code: 'AL', days: 14, paid: 1, desc: 'Statutory annual paid leave quota' },
      { id: crypto.randomUUID(), name: 'Sick Leave', code: 'SL', days: 8, paid: 1, desc: 'Medical and sickness leave' },
      { id: crypto.randomUUID(), name: 'Casual Leave', code: 'CL', days: 10, paid: 1, desc: 'Short-term urgent or personal matters' },
      { id: crypto.randomUUID(), name: 'Unpaid Leave', code: 'UL', days: 365, paid: 0, desc: 'Unpaid discretionary leave' }
    ];

    for (const lt of defaultLeaves) {
      const existing = dbHelper.queryOne('SELECT id FROM leave_types WHERE code = ?', [lt.code]);
      if (!existing) {
        dbHelper.run(
          `INSERT INTO leave_types (id, name, code, days_allowed_per_year, is_paid, description, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
          [lt.id, lt.name, lt.code, lt.days, lt.paid, lt.desc]
        );
      }
    }

    const adminUser: AuthUser = {
      id: adminUserId,
      email: data.adminEmail.trim().toLowerCase(),
      role: 'ADMIN'
    };

    logAudit({
      actor: adminUser,
      action: 'ORGANIZATION_INITIAL_SETUP',
      entityType: 'COMPANY',
      entityId: 'default',
      afterValue: { companyName: data.companyName, companyCode: data.companyCode, adminEmail: data.adminEmail }
    });

    return {
      adminUser,
      company: dbHelper.queryOne<CompanySettings>("SELECT * FROM company_settings WHERE id = 'default'")
    };
  });
}

export function getCompanySettings(): CompanySettings {
  const company = dbHelper.queryOne<CompanySettings>("SELECT * FROM company_settings WHERE id = 'default'");
  if (!company) {
    return {
      id: 'default',
      company_name: 'HCM Lite Enterprise',
      company_code: 'HCM',
      contact_email: 'admin@hcmlite.com',
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      office_start_time: '09:00',
      office_end_time: '17:00',
      grace_period_minutes: 15,
      half_day_threshold_hours: 5.0,
      weekend_days: 'Saturday,Sunday',
      late_deduction_policy: '3_LATE_HALF_DAY',
      policy_document: 'Standard company working hours are 09:00 to 17:00 Monday to Friday. Grace period is 15 minutes. Employees arriving after 09:15 are marked Late. Less than 5 hours work is marked as Half-day. Leaves must be approved by HR or Manager.'
    };
  }
  return company;
}

export function updateCompanySettings(actor: AuthUser, updates: Partial<CompanySettings>) {
  const current = getCompanySettings();

  dbHelper.run(
    `UPDATE company_settings SET
      company_name = COALESCE(?, company_name),
      company_code = COALESCE(?, company_code),
      contact_email = COALESCE(?, contact_email),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      office_start_time = COALESCE(?, office_start_time),
      office_end_time = COALESCE(?, office_end_time),
      grace_period_minutes = COALESCE(?, grace_period_minutes),
      half_day_threshold_hours = COALESCE(?, half_day_threshold_hours),
      weekend_days = COALESCE(?, weekend_days),
      late_deduction_policy = COALESCE(?, late_deduction_policy),
      office_latitude = COALESCE(?, office_latitude),
      office_longitude = COALESCE(?, office_longitude),
      geofence_radius_meters = COALESCE(?, geofence_radius_meters),
      policy_document = COALESCE(?, policy_document),
      updated_at = datetime('now')
    WHERE id = 'default'`,
    [
      updates.company_name,
      updates.company_code,
      updates.contact_email,
      updates.phone,
      updates.address,
      updates.office_start_time,
      updates.office_end_time,
      updates.grace_period_minutes,
      updates.half_day_threshold_hours,
      updates.weekend_days,
      updates.late_deduction_policy,
      updates.office_latitude,
      updates.office_longitude,
      updates.geofence_radius_meters,
      updates.policy_document
    ]
  );

  const updated = getCompanySettings();
  logAudit({
    actor,
    action: 'COMPANY_SETTINGS_UPDATE',
    entityType: 'COMPANY',
    entityId: 'default',
    beforeValue: current,
    afterValue: updated
  });

  return updated;
}

export function ensureDefaultOrgMasters() {
  const count = dbHelper.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM departments')?.count || 0;
  if (count === 0) {
    const defaultDepts = [
      {
        name: 'Engineering',
        code: 'ENG',
        description: 'Software engineering, infrastructure, and technology',
        designations: [
          { name: 'Software Engineer', code: 'SWE', description: 'Core software developer' },
          { name: 'Senior Software Engineer', code: 'SR_SWE', description: 'Senior developer' },
          { name: 'Engineering Manager', code: 'EM', description: 'Engineering team leader' }
        ]
      },
      {
        name: 'Human Resources',
        code: 'HR',
        description: 'Talent acquisition, employee relations, and HR operations',
        designations: [
          { name: 'HR Officer', code: 'HRO', description: 'HR operations officer' },
          { name: 'HR Manager', code: 'HRM', description: 'Human resources manager' }
        ]
      },
      {
        name: 'Finance & Accounts',
        code: 'FIN',
        description: 'Accounting, payroll, and fiscal management',
        designations: [
          { name: 'Financial Accountant', code: 'ACC', description: 'General accounting' },
          { name: 'Finance Manager', code: 'FM', description: 'Head of finance' }
        ]
      },
      {
        name: 'Operations',
        code: 'OPS',
        description: 'Business and workplace operations',
        designations: [
          { name: 'Operations Executive', code: 'OPEX', description: 'Operations specialist' },
          { name: 'Operations Manager', code: 'OPM', description: 'Operations manager' }
        ]
      },
      {
        name: 'Sales & Marketing',
        code: 'MKT',
        description: 'Brand growth, business development, and client sales',
        designations: [
          { name: 'Marketing Specialist', code: 'MKT_SPEC', description: 'Marketing specialist' },
          { name: 'Sales Executive', code: 'SALES_EXEC', description: 'Sales lead' }
        ]
      }
    ];

    for (const d of defaultDepts) {
      const deptId = crypto.randomUUID();
      dbHelper.run(
        `INSERT INTO departments (id, name, code, description, is_active, created_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'))`,
        [deptId, d.name, d.code, d.description]
      );
      for (const des of d.designations) {
        dbHelper.run(
          `INSERT INTO designations (id, name, code, department_id, description, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
          [crypto.randomUUID(), des.name, des.code, deptId, des.description]
        );
      }
    }
  }
}

// Departments CRUD
export function getDepartments() {
  ensureDefaultOrgMasters();
  return dbHelper.queryAll<any>('SELECT d.*, (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) as employee_count FROM departments d ORDER BY d.name ASC');
}

export function createDepartment(actor: AuthUser, name: string, code: string, description?: string) {
  const id = crypto.randomUUID();
  dbHelper.run(
    `INSERT INTO departments (id, name, code, description, is_active, created_at)
     VALUES (?, ?, ?, ?, 1, datetime('now'))`,
    [id, name.trim(), code.trim().toUpperCase(), description?.trim() || null]
  );

  const created = dbHelper.queryOne('SELECT * FROM departments WHERE id = ?', [id]);
  logAudit({
    actor,
    action: 'DEPARTMENT_CREATED',
    entityType: 'DEPARTMENT',
    entityId: id,
    afterValue: created
  });
  return created;
}

export function updateDepartment(actor: AuthUser, id: string, name: string, code: string, description?: string, isActive: boolean = true) {
  const before = dbHelper.queryOne('SELECT * FROM departments WHERE id = ?', [id]);
  if (!before) throw new Error('Department not found.');

  dbHelper.run(
    'UPDATE departments SET name = ?, code = ?, description = ?, is_active = ? WHERE id = ?',
    [name.trim(), code.trim().toUpperCase(), description?.trim() || null, isActive ? 1 : 0, id]
  );

  const after = dbHelper.queryOne('SELECT * FROM departments WHERE id = ?', [id]);
  logAudit({
    actor,
    action: 'DEPARTMENT_UPDATED',
    entityType: 'DEPARTMENT',
    entityId: id,
    beforeValue: before,
    afterValue: after
  });
  return after;
}

export function deleteDepartment(actor: AuthUser, id: string) {
  const empCount = dbHelper.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM employees WHERE department_id = ?', [id])?.count || 0;
  if (empCount > 0) {
    throw new Error(`Cannot delete department: it has ${empCount} active employee(s) assigned.`);
  }

  const desigCount = dbHelper.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM designations WHERE department_id = ?', [id])?.count || 0;
  if (desigCount > 0) {
    throw new Error(`Cannot delete department: it has ${desigCount} designation(s) associated with it.`);
  }

  const before = dbHelper.queryOne('SELECT * FROM departments WHERE id = ?', [id]);
  dbHelper.run('DELETE FROM departments WHERE id = ?', [id]);

  logAudit({
    actor,
    action: 'DEPARTMENT_DELETED',
    entityType: 'DEPARTMENT',
    entityId: id,
    beforeValue: before
  });
}

// Designations CRUD
export function getDesignations(departmentId?: string) {
  ensureDefaultOrgMasters();
  let sql = `
    SELECT d.*, dept.name as department_name,
    (SELECT COUNT(*) FROM employees e WHERE e.designation_id = d.id) as employee_count
    FROM designations d
    JOIN departments dept ON d.department_id = dept.id
  `;
  const params: any[] = [];
  if (departmentId) {
    sql += ' WHERE d.department_id = ?';
    params.push(departmentId);
  }
  sql += ' ORDER BY d.name ASC';
  return dbHelper.queryAll<any>(sql, params);
}

export function createDesignation(actor: AuthUser, name: string, code: string, departmentId: string, description?: string) {
  const dept = dbHelper.queryOne('SELECT id FROM departments WHERE id = ?', [departmentId]);
  if (!dept) throw new Error('Target department does not exist.');

  const id = crypto.randomUUID();
  dbHelper.run(
    `INSERT INTO designations (id, name, code, department_id, description, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
    [id, name.trim(), code.trim().toUpperCase(), departmentId, description?.trim() || null]
  );

  const created = dbHelper.queryOne('SELECT * FROM designations WHERE id = ?', [id]);
  logAudit({
    actor,
    action: 'DESIGNATION_CREATED',
    entityType: 'DESIGNATION',
    entityId: id,
    afterValue: created
  });
  return created;
}

export function updateDesignation(actor: AuthUser, id: string, name: string, code: string, departmentId: string, description?: string, isActive: boolean = true) {
  const before = dbHelper.queryOne('SELECT * FROM designations WHERE id = ?', [id]);
  if (!before) throw new Error('Designation not found.');

  dbHelper.run(
    'UPDATE designations SET name = ?, code = ?, department_id = ?, description = ?, is_active = ? WHERE id = ?',
    [name.trim(), code.trim().toUpperCase(), departmentId, description?.trim() || null, isActive ? 1 : 0, id]
  );

  const after = dbHelper.queryOne('SELECT * FROM designations WHERE id = ?', [id]);
  logAudit({
    actor,
    action: 'DESIGNATION_UPDATED',
    entityType: 'DESIGNATION',
    entityId: id,
    beforeValue: before,
    afterValue: after
  });
  return after;
}

export function deleteDesignation(actor: AuthUser, id: string) {
  const empCount = dbHelper.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM employees WHERE designation_id = ?', [id])?.count || 0;
  if (empCount > 0) {
    throw new Error(`Cannot delete designation: ${empCount} employee(s) hold this title.`);
  }

  const before = dbHelper.queryOne('SELECT * FROM designations WHERE id = ?', [id]);
  dbHelper.run('DELETE FROM designations WHERE id = ?', [id]);

  logAudit({
    actor,
    action: 'DESIGNATION_DELETED',
    entityType: 'DESIGNATION',
    entityId: id,
    beforeValue: before
  });
}

// Leave Types CRUD
export function getLeaveTypes() {
  return dbHelper.queryAll<any>('SELECT * FROM leave_types ORDER BY is_paid DESC, name ASC');
}

export function createLeaveType(actor: AuthUser, name: string, code: string, daysAllowed: number, isPaid: boolean, description?: string) {
  const id = crypto.randomUUID();
  dbHelper.run(
    `INSERT INTO leave_types (id, name, code, days_allowed_per_year, is_paid, description, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
    [id, name.trim(), code.trim().toUpperCase(), daysAllowed, isPaid ? 1 : 0, description?.trim() || null]
  );
  const created = dbHelper.queryOne('SELECT * FROM leave_types WHERE id = ?', [id]);
  logAudit({
    actor,
    action: 'LEAVE_TYPE_CREATED',
    entityType: 'LEAVE_TYPE',
    entityId: id,
    afterValue: created
  });
  return created;
}

// Holidays CRUD
export function getHolidays(year?: number) {
  let sql = 'SELECT * FROM company_holidays';
  const params: any[] = [];
  if (year) {
    sql += " WHERE strftime('%Y', holiday_date) = ?";
    params.push(String(year));
  }
  sql += ' ORDER BY holiday_date ASC';
  return dbHelper.queryAll<any>(sql, params);
}

export function createHoliday(actor: AuthUser, name: string, date: string, description?: string) {
  const id = crypto.randomUUID();
  dbHelper.run(
    `INSERT INTO company_holidays (id, name, holiday_date, description, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [id, name.trim(), date, description?.trim() || null]
  );
  const created = dbHelper.queryOne('SELECT * FROM company_holidays WHERE id = ?', [id]);
  logAudit({
    actor,
    action: 'HOLIDAY_CREATED',
    entityType: 'HOLIDAY',
    entityId: id,
    afterValue: created
  });
  return created;
}

export function deleteHoliday(actor: AuthUser, id: string) {
  const before = dbHelper.queryOne('SELECT * FROM company_holidays WHERE id = ?', [id]);
  dbHelper.run('DELETE FROM company_holidays WHERE id = ?', [id]);
  logAudit({
    actor,
    action: 'HOLIDAY_DELETED',
    entityType: 'HOLIDAY',
    entityId: id,
    beforeValue: before
  });
}
