/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ADMIN' | 'HR' | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string | null;
  employeeCode?: string | null;
  name?: string;
  mustChangePassword?: boolean;
}

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
  policy_document?: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  is_active: number;
  employee_count?: number;
}

export interface Designation {
  id: string;
  name: string;
  code: string;
  department_id: string;
  department_name?: string;
  description?: string | null;
  is_active: number;
  employee_count?: number;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  days_allowed_per_year: number;
  is_paid: number;
  description?: string | null;
  is_active: number;
}

export interface CompanyHoliday {
  id: string;
  name: string;
  holiday_date: string;
  description?: string | null;
}

export interface Employee {
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
  basic_salary?: number;
  bank_name?: string | null;
  bank_account_number?: string | null;
  national_id?: string | null;
  emergency_contact?: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_working_hours: number;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'MISSING_CHECKOUT' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND';
  notes?: string | null;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  is_paid: number;
  allocated_days: number;
  used_days: number;
  pending_days: number;
  year: number;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  first_name?: string;
  last_name?: string;
  employee_code?: string;
  employee_email?: string;
  department_name?: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  is_paid: number;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewed_by?: string | null;
  reviewer_email?: string | null;
  reviewed_at?: string | null;
  reviewer_comments?: string | null;
  created_at: string;
}

export interface PayrollPeriod {
  id: string;
  month: number;
  year: number;
  total_working_days: number;
  status: 'DRAFT' | 'LOCKED';
  total_gross: number;
  total_deductions: number;
  total_tax: number;
  total_net: number;
  creator_email?: string;
  locker_email?: string;
  locked_at?: string | null;
  employee_count?: number;
  created_at: string;
}

export interface PayrollItem {
  id: string;
  period_id: string;
  month?: number;
  year?: number;
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  department_name?: string;
  designation_name?: string;
  basic_salary: number;
  gross_salary: number;
  hra_allowance: number;
  medical_allowance: number;
  daily_gross_rate: number;
  working_days_count: number;
  days_present: number;
  days_absent: number;
  days_half_day: number;
  days_unpaid_leave: number;
  late_count: number;
  absence_deduction: number;
  half_day_deduction: number;
  late_deduction: number;
  annual_taxable_gross: number;
  annual_calculated_tax: number;
  monthly_tax_deduction: number;
  net_salary: number;
  notes?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  national_id?: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_audience: 'ALL' | 'HR' | 'EMPLOYEE' | 'DEPARTMENT';
  target_department_id?: string | null;
  department_name?: string | null;
  is_pinned: number;
  author_id: string;
  author_email?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION_REQUIRED';
  link?: string | null;
  is_read: number;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  before_value?: string | null;
  after_value?: string | null;
  ip_address?: string | null;
  created_at: string;
}
