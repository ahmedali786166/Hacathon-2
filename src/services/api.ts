/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  User,
  CompanySettings,
  Department,
  Designation,
  LeaveType,
  CompanyHoliday,
  Employee,
  AttendanceRecord,
  LeaveBalance,
  LeaveRequest,
  PayrollPeriod,
  PayrollItem,
  Announcement,
  NotificationItem,
  AuditLogItem
} from '../types/index.ts';

const TOKEN_KEY = 'hcm_lite_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearStoredToken();
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/setup')) {
      window.location.href = '/login';
    }
  }

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || (typeof data === 'string' ? data : `Request failed with status ${response.status}`);
    const error: any = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth & System Setup
  getSetupStatus: () => apiRequest<{ isConfigured: boolean; hasAdmin: boolean; company: CompanySettings | null }>('/auth/status'),
  setupInitialCompany: (data: any) => apiRequest<{ token: string; user: User; company: CompanySettings }>('/auth/setup', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  login: (credentials: { email: string; password: string }) => apiRequest<{ token: string; user: User; company: CompanySettings }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  }),
  getMe: () => apiRequest<{ user: User }>('/auth/me'),
  changePassword: (data: { oldPassword?: string; newPassword: string }) => apiRequest<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getUsers: () => apiRequest<any[]>('/auth/users'),
  createUser: (data: { email: string; password: string; role: string }) => apiRequest('/auth/create-user', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateUserStatus: (userId: string, isActive: boolean) => apiRequest(`/auth/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  }),

  // Organization Settings & Master Data
  getCompany: () => apiRequest<CompanySettings>('/org/company'),
  updateCompany: (data: Partial<CompanySettings>) => apiRequest<CompanySettings>('/org/company', {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  getDepartments: () => apiRequest<Department[]>('/org/departments'),
  createDepartment: (data: { name: string; code: string; description?: string }) => apiRequest<Department>('/org/departments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateDepartment: (id: string, data: any) => apiRequest<Department>(`/org/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteDepartment: (id: string) => apiRequest(`/org/departments/${id}`, { method: 'DELETE' }),

  getDesignations: (departmentId?: string) => apiRequest<Designation[]>(`/org/designations${departmentId ? `?departmentId=${departmentId}` : ''}`),
  createDesignation: (data: { name: string; code: string; department_id: string; description?: string }) => apiRequest<Designation>('/org/designations', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateDesignation: (id: string, data: any) => apiRequest<Designation>(`/org/designations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteDesignation: (id: string) => apiRequest(`/org/designations/${id}`, { method: 'DELETE' }),

  getLeaveTypes: () => apiRequest<LeaveType[]>('/org/leave-types'),
  createLeaveType: (data: { name: string; code: string; days_allowed_per_year: number; is_paid: boolean; description?: string }) => apiRequest<LeaveType>('/org/leave-types', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getHolidays: (year?: number) => apiRequest<CompanyHoliday[]>(`/org/holidays${year ? `?year=${year}` : ''}`),
  createHoliday: (data: { name: string; holiday_date: string; description?: string }) => apiRequest<CompanyHoliday>('/org/holidays', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteHoliday: (id: string) => apiRequest(`/org/holidays/${id}`, { method: 'DELETE' }),

  // Employees
  getEmployees: (params?: { search?: string; department_id?: string; status?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.department_id) query.append('department_id', params.department_id);
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    return apiRequest<{ rows: Employee[]; total: number }>(`/employees?${query.toString()}`);
  },
  createEmployee: (data: any) => apiRequest<Employee>('/employees', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getEmployeeById: (id: string) => apiRequest<Employee>(`/employees/${id}`),
  updateEmployee: (id: string, data: any) => apiRequest<Employee>(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  getEmployee360: (id: string) => apiRequest<{
    employee: Employee;
    leaveBalances: LeaveBalance[];
    recentAttendance: AttendanceRecord[];
    leaveRequests: LeaveRequest[];
    payslips: PayrollItem[];
  }>(`/employees/${id}/360`),
  createEmployeeAccount: (employeeId: string, initialPassword?: string) => apiRequest<{ userId: string; email: string; temporaryPassword?: string }>(`/employees/${employeeId}/create-account`, {
    method: 'POST',
    body: JSON.stringify({ initialPassword })
  }),
  importEmployeesCsv: (rows: any[], dryRun: boolean = true) => apiRequest('/employees/csv/import', {
    method: 'POST',
    body: JSON.stringify({ rows, dryRun })
  }),

  // Attendance
  getTodayAttendance: () => apiRequest<{ date: string; checkedIn: boolean; checkedOut: boolean; record: AttendanceRecord | null }>('/attendance/today'),
  checkIn: (coords?: { latitude?: number; longitude?: number }) => apiRequest<AttendanceRecord>('/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify({ coords })
  }),
  checkOut: (coords?: { latitude?: number; longitude?: number }) => apiRequest<AttendanceRecord>('/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify({ coords })
  }),
  getAttendanceHistory: (employeeId?: string, month?: number, year?: number) => {
    const query = new URLSearchParams();
    if (employeeId) query.append('employeeId', employeeId);
    if (month) query.append('month', String(month));
    if (year) query.append('year', String(year));
    return apiRequest<AttendanceRecord[]>(`/attendance/history?${query.toString()}`);
  },
  getDailyAttendanceReport: (date?: string, departmentId?: string) => {
    const query = new URLSearchParams();
    if (date) query.append('date', date);
    if (departmentId) query.append('departmentId', departmentId);
    return apiRequest<any>(`/attendance/daily-report?${query.toString()}`);
  },
  submitAttendanceCorrection: (data: {
    employeeId: string;
    date: string;
    newStatus: string;
    checkInTime?: string;
    checkOutTime?: string;
    totalWorkingHours?: number;
    reason: string;
  }) => apiRequest<AttendanceRecord>('/attendance/correction', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Leaves
  getLeaveBalances: (employeeId?: string, year?: number) => {
    const query = new URLSearchParams();
    if (employeeId) query.append('employeeId', employeeId);
    if (year) query.append('year', String(year));
    return apiRequest<LeaveBalance[]>(`/leaves/balances?${query.toString()}`);
  },
  getLeaveRequests: (params?: { employeeId?: string; status?: string; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    if (params?.status) query.append('status', params.status);
    if (params?.year) query.append('year', String(params.year));
    return apiRequest<LeaveRequest[]>(`/leaves/requests?${query.toString()}`);
  },
  submitLeaveRequest: (data: { employeeId?: string; leaveTypeId: string; startDate: string; endDate: string; reason: string }) => apiRequest<LeaveRequest>('/leaves/requests', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  cancelLeaveRequest: (requestId: string) => apiRequest(`/leaves/requests/${requestId}/cancel`, { method: 'POST' }),
  reviewLeaveRequest: (requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) => apiRequest<LeaveRequest>(`/leaves/requests/${requestId}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, comments })
  }),
  parseSmartLeave: (prompt: string) => apiRequest<{
    leaveTypeCode?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
    rawExplanation?: string;
  }>('/leaves/smart-leave/parse', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  }),

  // Payroll
  getPayrollPeriods: () => apiRequest<PayrollPeriod[]>('/payroll/periods'),
  getPayrollPeriodDetails: (id: string) => apiRequest<{ period: PayrollPeriod; items: PayrollItem[] }>(`/payroll/periods/${id}`),
  generatePayrollDraft: (month: number, year: number) => apiRequest<{ period: PayrollPeriod; items: PayrollItem[] }>('/payroll/generate-draft', {
    method: 'POST',
    body: JSON.stringify({ month, year })
  }),
  lockPayrollPeriod: (periodId: string) => apiRequest<{ period: PayrollPeriod; items: PayrollItem[] }>(`/payroll/periods/${periodId}/lock`, {
    method: 'POST'
  }),
  getMyPayslips: () => apiRequest<PayrollItem[]>('/payroll/my-payslips'),
  getEmployeePayslips: (employeeId: string) => apiRequest<PayrollItem[]>(`/payroll/employee/${employeeId}/payslips`),

  // AI Assistant
  askAiAssistant: (prompt: string) => apiRequest<{ text: string; toolsCalled: string[]; isAiGenerated: boolean }>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  }),
  getAiStatus: () => apiRequest<{ hasApiKey: boolean; model: string }>('/ai/status'),

  // Communications & Notifications
  getAnnouncements: () => apiRequest<Announcement[]>('/communications/announcements'),
  createAnnouncement: (data: { title: string; content: string; target_audience: string; target_department_id?: string; is_pinned?: boolean }) => apiRequest<Announcement>('/communications/announcements', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getNotifications: () => apiRequest<NotificationItem[]>('/communications/notifications'),
  markNotificationRead: (id: string) => apiRequest(`/communications/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => apiRequest('/communications/notifications/read-all', { method: 'POST' }),

  // Audit Logs (Admin only)
  getAuditLogs: (params?: { entityType?: string; action?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.entityType) query.append('entityType', params.entityType);
    if (params?.action) query.append('action', params.action);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    return apiRequest<AuditLogItem[]>(`/audit?${query.toString()}`);
  },

  // Dashboard Stats
  getDashboardStats: () => apiRequest<any>('/stats/dashboard')
};
