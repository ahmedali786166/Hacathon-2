/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DB_SCHEMA = `
PRAGMA foreign_keys = ON;

-- Company Settings (Single row for the organization)
CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  company_name TEXT NOT NULL,
  company_code TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  currency TEXT NOT NULL DEFAULT 'PKR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
  office_start_time TEXT NOT NULL DEFAULT '09:00',
  office_end_time TEXT NOT NULL DEFAULT '17:00',
  grace_period_minutes INTEGER NOT NULL DEFAULT 15,
  half_day_threshold_hours REAL NOT NULL DEFAULT 5.0,
  weekend_days TEXT NOT NULL DEFAULT 'Saturday,Sunday',
  late_deduction_policy TEXT NOT NULL DEFAULT '3_LATE_HALF_DAY',
  office_latitude REAL,
  office_longitude REAL,
  geofence_radius_meters INTEGER DEFAULT 200,
  policy_document TEXT DEFAULT 'Standard company working hours are 09:00 to 17:00 Monday to Friday. Grace period is 15 minutes. Employees arriving after 09:15 are marked Late. Less than 5 hours work is marked as Half-day. Leaves must be approved by HR or Manager.',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users (Admin, HR, Employee credentials)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'HR', 'EMPLOYEE')),
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Designations
CREATE TABLE IF NOT EXISTS designations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  department_id TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

-- Leave Types
CREATE TABLE IF NOT EXISTS leave_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  days_allowed_per_year INTEGER NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Company Holidays
CREATE TABLE IF NOT EXISTS company_holidays (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  holiday_date TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,
  user_id TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  department_id TEXT NOT NULL,
  designation_id TEXT NOT NULL,
  join_date TEXT NOT NULL,
  employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(employment_status IN ('ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE')),
  basic_salary REAL NOT NULL DEFAULT 0.0,
  bank_name TEXT,
  bank_account_number TEXT,
  national_id TEXT,
  emergency_contact TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE RESTRICT
);

-- Employee Leave Balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  leave_type_id TEXT NOT NULL,
  allocated_days REAL NOT NULL,
  used_days REAL NOT NULL DEFAULT 0,
  pending_days REAL NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, leave_type_id, year),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  leave_type_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  duration_days REAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  reviewer_comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Attendance Records
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  total_working_hours REAL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'MISSING_CHECKOUT', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND')),
  check_in_lat REAL,
  check_in_lng REAL,
  check_out_lat REAL,
  check_out_lng REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, date),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Attendance Corrections (Audit trail)
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id TEXT PRIMARY KEY,
  attendance_id TEXT NOT NULL,
  original_status TEXT,
  new_status TEXT NOT NULL,
  original_check_in TEXT,
  new_check_in TEXT,
  original_check_out TEXT,
  new_check_out TEXT,
  reason TEXT NOT NULL,
  corrected_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
  FOREIGN KEY (corrected_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Payroll Periods
CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_working_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'LOCKED')),
  total_gross REAL NOT NULL DEFAULT 0,
  total_deductions REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL DEFAULT 0,
  total_net REAL NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  locked_by TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(month, year),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Payroll Items (Individual Employee Payslip)
CREATE TABLE IF NOT EXISTS payroll_items (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  basic_salary REAL NOT NULL,
  gross_salary REAL NOT NULL,
  hra_allowance REAL NOT NULL,
  medical_allowance REAL NOT NULL,
  daily_gross_rate REAL NOT NULL,
  working_days_count INTEGER NOT NULL,
  days_present REAL NOT NULL,
  days_absent REAL NOT NULL,
  days_half_day REAL NOT NULL,
  days_unpaid_leave REAL NOT NULL,
  late_count INTEGER NOT NULL DEFAULT 0,
  absence_deduction REAL NOT NULL DEFAULT 0,
  half_day_deduction REAL NOT NULL DEFAULT 0,
  late_deduction REAL NOT NULL DEFAULT 0,
  annual_taxable_gross REAL NOT NULL DEFAULT 0,
  annual_calculated_tax REAL NOT NULL DEFAULT 0,
  monthly_tax_deduction REAL NOT NULL DEFAULT 0,
  net_salary REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(period_id, employee_id),
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'ALL' CHECK(target_audience IN ('ALL', 'HR', 'EMPLOYEE', 'DEPARTMENT')),
  target_department_id TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (target_department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO' CHECK(type IN ('INFO', 'SUCCESS', 'WARNING', 'ACTION_REQUIRED')),
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit Logs (Immutable security trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_value TEXT,
  after_value TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI Logs
CREATE TABLE IF NOT EXISTS ai_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL,
  prompt_summary TEXT NOT NULL,
  tools_called TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance(date, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status_dates ON leave_requests(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payroll_items_period ON payroll_items(period_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_created ON ai_logs(user_id, created_at);
`;
