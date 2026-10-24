/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  CalendarCheck,
  CalendarOff,
  Banknote,
  FileText,
  Mail,
  Phone,
  Building2,
  Briefcase,
  ShieldCheck,
  Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { generatePayslipPdf } from '../utils/pdfGenerator.ts';

interface Employee360PageProps {
  employeeId: string;
  onBack: () => void;
}

export function Employee360Page({ employeeId, onBack }: Employee360PageProps) {
  const { user, company } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'leaves' | 'payroll'>('overview');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.getEmployee360(employeeId);
        setData(res);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
        Loading Employee 360 profile...
      </div>
    );
  }

  if (!data?.employee) {
    return (
      <div className="p-8 text-center text-xs text-red-400">
        Employee record not found.
        <button onClick={onBack} className="block mx-auto mt-3 text-[#D6B46A] underline">Go back</button>
      </div>
    );
  }

  const emp = data.employee;
  const balances = data.leaveBalances || [];
  const attendance = data.recentAttendance || [];
  const leaveRequests = data.leaveRequests || [];
  const payslips = data.payslips || [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-white dark:bg-[#131D31] hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>{emp.first_name} {emp.last_name}</span>
            <span className="text-xs font-mono font-normal text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded">
              {emp.employee_code}
            </span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>{emp.department_name || 'Department'}</span>
            <span>·</span>
            <span>{emp.designation_name || 'Designation'}</span>
            <span>·</span>
            <span className="text-emerald-500 font-medium">{emp.employment_status}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'overview'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Overview & Salary
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'attendance'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Attendance ({attendance.length})
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'leaves'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Leave History ({leaveRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'payroll'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Payslips ({payslips.length})
        </button>
      </div>

      {/* TAB CONTENT: 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal & Employment Details */}
          <div className="p-6 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Employment Details
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-400">Email:</span>
                <span className="font-medium text-slate-800 dark:text-white">{emp.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-400">Phone:</span>
                <span className="font-medium text-slate-800 dark:text-white">{emp.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-400">Joining Date:</span>
                <span className="font-mono text-slate-800 dark:text-white">{emp.join_date}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-400">Web App Login:</span>
                <span className="font-medium text-slate-800 dark:text-white">
                  {emp.user_id ? 'Active User Account' : 'No Account Created'}
                </span>
              </div>
            </div>
          </div>

          {/* Confidential Salary Structure (Only visible to privileged or self) */}
          <div className="p-6 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span>Salary Compensation Structure</span>
              <span className="text-[10px] text-[#D6B46A]">CONFIDENTIAL</span>
            </h4>

            {emp.basic_salary !== undefined ? (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-400">Basic Monthly:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                    PKR {emp.basic_salary.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-400">House Rent Allowance (HRA 40%):</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                    PKR {Math.round(emp.basic_salary * 0.4).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-400">Medical Allowance (10%):</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                    PKR {Math.round(emp.basic_salary * 0.1).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-2 bg-slate-50 dark:bg-white/[0.03] px-3 rounded-xl">
                  <span className="font-bold text-slate-900 dark:text-white">Gross Salary (1.5x Basic):</span>
                  <span className="font-mono font-bold text-[#D6B46A] tabular-nums">
                    PKR {Math.round(emp.basic_salary * 1.5).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Confidential compensation data is restricted by server authorization.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. ATTENDANCE HISTORY */}
      {activeTab === 'attendance' && (
        <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Check In</th>
                  <th className="py-3 px-4">Check Out</th>
                  <th className="py-3 px-4">Working Hours</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No attendance records logged yet.
                    </td>
                  </tr>
                ) : (
                  attendance.map((att: any) => (
                    <tr key={att.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono">{att.date}</td>
                      <td className="py-3 px-4 font-mono">{att.check_in_time || '—'}</td>
                      <td className="py-3 px-4 font-mono">{att.check_out_time || '—'}</td>
                      <td className="py-3 px-4 font-mono tabular-nums">{att.total_working_hours} hrs</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          att.status === 'PRESENT' ? 'text-emerald-500' :
                          att.status === 'LATE' ? 'text-amber-500' :
                          att.status === 'HALF_DAY' ? 'text-sky-500' : 'text-red-400'
                        }`}>
                          <span>·</span>
                          <span>{att.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{att.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 3. LEAVES */}
      {activeTab === 'leaves' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {balances.map((b: any) => (
              <div key={b.id} className="p-4 rounded-xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5">
                <div className="text-xs text-slate-400 font-medium">{b.leave_type_name}</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                  {b.is_paid === 0 ? 'Unlimited' : `${b.allocated_days - b.used_days} left`}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Used: {b.used_days}d · Quota: {b.allocated_days}d</div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Working Days</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">No leave requests found.</td>
                  </tr>
                ) : (
                  leaveRequests.map((lr: any) => (
                    <tr key={lr.id}>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">{lr.leave_type_name}</td>
                      <td className="py-3 px-4 font-mono">{lr.start_date} to {lr.end_date}</td>
                      <td className="py-3 px-4 font-mono tabular-nums">{lr.duration_days} days</td>
                      <td className="py-3 px-4 text-slate-400">{lr.reason}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[11px] font-medium ${
                          lr.status === 'APPROVED' ? 'text-emerald-500' :
                          lr.status === 'REJECTED' ? 'text-red-400' : 'text-amber-500'
                        }`}>
                          {lr.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 4. PAYSLIPS */}
      {activeTab === 'payroll' && (
        <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4 text-right">Gross Salary</th>
                <th className="py-3 px-4 text-right">Tax Deduction</th>
                <th className="py-3 px-4 text-right">Other Deductions</th>
                <th className="py-3 px-4 text-right">Net Payable</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {payslips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No finalized payslips available yet.</td>
                </tr>
              ) : (
                payslips.map((ps: any) => (
                  <tr key={ps.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white font-mono">
                      {ps.month}/{ps.year}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      PKR {ps.gross_salary.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-red-400 tabular-nums">
                      -PKR {ps.monthly_tax_deduction.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-500 tabular-nums">
                      -PKR {Math.round(ps.absence_deduction + ps.half_day_deduction + ps.late_deduction).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500 tabular-nums">
                      PKR {ps.net_salary.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => generatePayslipPdf(ps, ps.month, ps.year, company)}
                        className="p-1.5 text-xs text-[#D6B46A] hover:bg-[#D6B46A]/10 rounded"
                        title="Download PDF"
                      >
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
