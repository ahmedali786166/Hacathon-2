/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  CalendarCheck,
  CalendarOff,
  Banknote,
  Clock,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { generatePayslipPdf } from '../utils/pdfGenerator.ts';

interface DashboardPageProps {
  onNavigateTab: (tab: string) => void;
}

export function DashboardPage({ onNavigateTab }: DashboardPageProps) {
  const { user, company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [checkingInOut, setCheckingInOut] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  const handleQuickCheckIn = async () => {
    try {
      setCheckingInOut(true);
      setActionMessage(null);
      await api.checkIn();
      setActionMessage({ text: 'Checked in successfully!' });
      await fetchStats();
    } catch (err: any) {
      setActionMessage({ text: err.message, isError: true });
    } finally {
      setCheckingInOut(false);
    }
  };

  const handleQuickCheckOut = async () => {
    try {
      setCheckingInOut(true);
      setActionMessage(null);
      await api.checkOut();
      setActionMessage({ text: 'Checked out successfully!' });
      await fetchStats();
    } catch (err: any) {
      setActionMessage({ text: err.message, isError: true });
    } finally {
      setCheckingInOut(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-white/5 rounded-lg w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-white/5 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-white/5 rounded-2xl" />
      </div>
    );
  }

  // 1. EMPLOYEE PERSONAL DASHBOARD VIEW
  if (user?.role === 'EMPLOYEE') {
    const todayAtt = stats?.todayAttendance;
    const balances = stats?.leaveBalances || [];
    const latestPayslip = stats?.latestPayslip;

    return (
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0B1120] to-[#15233D] text-white border border-white/10 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#D6B46A] tracking-wider uppercase mb-1">
                <span>Personal Employee Workspace</span>
                <span>·</span>
                <span>ID: {user?.employeeCode || 'N/A'}</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">
                Welcome back, {user?.name || user?.email}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Review your daily time tracking, leave balances, and verified payslips.
              </p>
            </div>

            {/* Attendance Action Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {actionMessage && (
                <span className={`text-xs ${actionMessage.isError ? 'text-red-400' : 'text-emerald-400'}`}>
                  {actionMessage.text}
                </span>
              )}

              {todayAtt?.check_out_time ? (
                <div className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Completed Today ({todayAtt.total_working_hours} hrs)</span>
                </div>
              ) : todayAtt?.check_in_time ? (
                <button
                  onClick={handleQuickCheckOut}
                  disabled={checkingInOut}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {checkingInOut ? 'Processing...' : `Check Out (In at ${todayAtt.check_in_time.slice(0, 5)})`}
                </button>
              ) : (
                <button
                  onClick={handleQuickCheckIn}
                  disabled={checkingInOut}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#D6B46A] to-[#B39045] hover:from-[#E5C57E] hover:to-[#C5A059] text-[#0B1120] font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {checkingInOut ? 'Processing...' : 'Clock In for Today'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Leave Balances Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CalendarOff size={16} className="text-[#D6B46A]" />
              <span>Your Statutory Leave Quotas ({new Date().getFullYear()})</span>
            </h3>
            <button
              onClick={() => onNavigateTab('leaves')}
              className="text-xs text-[#D6B46A] hover:underline flex items-center gap-1 font-medium"
            >
              <span>Leave Portal & Smart Request</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {balances.length === 0 ? (
              <div className="col-span-4 p-8 text-center text-xs text-slate-400 bg-white dark:bg-[#131D31] rounded-xl border border-slate-200 dark:border-white/5">
                No leave quota balances configured yet.
              </div>
            ) : (
              balances.map((b: any) => {
                const remaining = b.allocated_days - b.used_days;
                return (
                  <div
                    key={b.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200/80 dark:border-white/5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-semibold">{b.leave_type_name}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                        {b.leave_type_code}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-3">
                      <div>
                        <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {b.is_paid === 0 ? '∞' : remaining}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">days left</span>
                      </div>
                      <div className="text-right text-[11px] text-slate-400 tabular-nums">
                        <div>Quota: {b.allocated_days}d</div>
                        <div>Used: {b.used_days}d</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Latest Payslip Card */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Banknote size={16} className="text-[#D6B46A]" />
              <span>Official Salary & Payslips</span>
            </h3>
            <button
              onClick={() => onNavigateTab('payroll')}
              className="text-xs text-[#D6B46A] hover:underline flex items-center gap-1 font-medium"
            >
              <span>View All Payslips</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {latestPayslip ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold text-[#D6B46A] uppercase tracking-wider">
                  Latest Finalized Salary · {latestPayslip.month}/{latestPayslip.year}
                </span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                  PKR {latestPayslip.net_salary.toLocaleString()}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                  <span>Gross: PKR {latestPayslip.gross_salary.toLocaleString()}</span>
                  <span>·</span>
                  <span>Tax: PKR {latestPayslip.monthly_tax_deduction.toLocaleString()}</span>
                  <span>·</span>
                  <span>Deductions: PKR {Math.round(latestPayslip.absence_deduction + latestPayslip.half_day_deduction + latestPayslip.late_deduction).toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => generatePayslipPdf(latestPayslip, latestPayslip.month, latestPayslip.year, company)}
                className="px-4 py-2.5 bg-slate-900 dark:bg-white/10 hover:bg-slate-800 dark:hover:bg-white/20 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition-all shrink-0"
              >
                <FileText size={15} />
                <span>Download PDF Payslip</span>
              </button>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-[#131D31] rounded-2xl border border-slate-200 dark:border-white/5">
              No finalized payslip available yet. When HR prepares and Admin locks the monthly payroll, your payslip and PDF will appear here.
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. ADMIN & HR MANAGEMENT DASHBOARD VIEW
  const hc = stats?.headcount || { total: 0, active: 0 };
  const att = stats?.attendanceToday || { total: 0, present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0 };
  const deptStats = stats?.departmentStats || [];
  const payroll = stats?.payrollSummary;

  return (
    <div className="space-y-8">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Workforce Headcount</span>
            <Users size={16} className="text-[#D6B46A]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {hc.total}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-emerald-500 font-medium">
            <span>{hc.active} Active Employees</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Present Today</span>
            <CalendarCheck size={16} className="text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {att.present}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-amber-500 font-medium">
            <span>{att.late} Late Arrivals</span>
          </div>
        </div>

        {/* Pending Leaves */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Pending Approvals</span>
            <CalendarOff size={16} className="text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {stats?.pendingLeavesCount || 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span>{att.onLeave} on approved leave today</span>
          </div>
        </div>

        {/* Latest Payroll */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Payroll Status</span>
            <Banknote size={16} className="text-[#D6B46A]" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
            {payroll ? `PKR ${payroll.total_net.toLocaleString()}` : 'No Payroll'}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span
              className={`font-medium ${
                payroll?.status === 'LOCKED' ? 'text-emerald-500' : 'text-amber-500'
              }`}
            >
              {payroll ? `${payroll.month}/${payroll.year} (${payroll.status})` : 'Draft ready to run'}
            </span>
          </div>
        </div>
      </div>

      {/* Empty State Banner if no employees exist yet */}
      {hc.total === 0 && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-[#131D31] text-white border border-[#D6B46A]/20 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#D6B46A]/20 text-[#D6B46A] flex items-center justify-center shrink-0">
              <UserCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Initial Setup Complete: Ready to Register Employees</h4>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                The database starts completely empty with zero dummy records. To test the complete end-to-end hackathon flow, create departments and designations in Organization, register your real test employees, and enable their login credentials.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => onNavigateTab('employees')}
                  className="px-4 py-2 bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>Register First Employee</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  onClick={() => onNavigateTab('organization')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-lg transition-colors"
                >
                  <span>Configure Departments</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Section: Attendance Today Summary + Department Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real Attendance Status Today */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Clock size={15} className="text-[#D6B46A]" />
              <span>Today's Attendance Breakdown</span>
            </h4>
            <button
              onClick={() => onNavigateTab('attendance')}
              className="text-xs text-[#D6B46A] hover:underline font-medium"
            >
              Full Roster
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
              <span className="text-[11px] text-slate-400">Present</span>
              <div className="text-lg font-bold text-emerald-500 tabular-nums">{att.present}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
              <span className="text-[11px] text-slate-400">Late</span>
              <div className="text-lg font-bold text-amber-500 tabular-nums">{att.late}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
              <span className="text-[11px] text-slate-400">Half-Day</span>
              <div className="text-lg font-bold text-sky-500 tabular-nums">{att.halfDay}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
              <span className="text-[11px] text-slate-400">Absent</span>
              <div className="text-lg font-bold text-red-400 tabular-nums">{att.absent}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
              <span className="text-[11px] text-slate-400">On Leave</span>
              <div className="text-lg font-bold text-indigo-400 tabular-nums">{att.onLeave}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
              <span className="text-[11px] text-slate-400">Missing Out</span>
              <div className="text-lg font-bold text-slate-400 tabular-nums">{att.missingCheckout || 0}</div>
            </div>
          </div>
        </div>

        {/* Department Workforce Chart / Distribution */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Users size={15} className="text-[#D6B46A]" />
              <span>Headcount by Department</span>
            </h4>
            <button
              onClick={() => onNavigateTab('organization')}
              className="text-xs text-[#D6B46A] hover:underline font-medium"
            >
              Manage
            </button>
          </div>

          <div className="space-y-3">
            {deptStats.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No departments configured yet. Go to Organization to create departments.
              </p>
            ) : (
              deptStats.map((d: any) => {
                const pct = hc.total > 0 ? Math.round((d.employee_count / hc.total) * 100) : 0;
                return (
                  <div key={d.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{d.name}</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {d.employee_count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D6B46A] to-[#B39045] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick Action Hub */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sparkles size={15} className="text-[#D6B46A]" />
          <span>Executive Actions & Short-cuts</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => onNavigateTab('employees')}
            className="p-3 text-left rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/60 dark:border-white/5 transition-colors group"
          >
            <Users size={16} className="text-[#D6B46A] mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-semibold text-slate-800 dark:text-white">Directory</div>
            <div className="text-[11px] text-slate-400">Add / View Employees</div>
          </button>

          <button
            onClick={() => onNavigateTab('attendance')}
            className="p-3 text-left rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/60 dark:border-white/5 transition-colors group"
          >
            <CalendarCheck size={16} className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-semibold text-slate-800 dark:text-white">Attendance</div>
            <div className="text-[11px] text-slate-400">Review Daily Log</div>
          </button>

          <button
            onClick={() => onNavigateTab('leaves')}
            className="p-3 text-left rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/60 dark:border-white/5 transition-colors group"
          >
            <CalendarOff size={16} className="text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-semibold text-slate-800 dark:text-white">Leave Requests</div>
            <div className="text-[11px] text-slate-400">Approve / Reject</div>
          </button>

          <button
            onClick={() => onNavigateTab('payroll')}
            className="p-3 text-left rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/60 dark:border-white/5 transition-colors group"
          >
            <Banknote size={16} className="text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-semibold text-slate-800 dark:text-white">Payroll Engine</div>
            <div className="text-[11px] text-slate-400">Draft & Tax Slabs</div>
          </button>

          <button
            onClick={() => onNavigateTab('ai-assistant')}
            className="p-3 text-left rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/60 dark:border-white/5 transition-colors group"
          >
            <Sparkles size={16} className="text-[#D6B46A] mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-semibold text-slate-800 dark:text-white">AI HR Assistant</div>
            <div className="text-[11px] text-slate-400">Query Roster via LLM</div>
          </button>
        </div>
      </div>
    </div>
  );
}
