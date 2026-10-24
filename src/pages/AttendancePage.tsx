/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Filter,
  Edit,
  MapPin,
  X,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { AttendanceRecord, Department } from '../types/index.ts';

export function AttendancePage() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'HR';

  const [activeView, setActiveView] = useState<'my' | 'roster'>(isPrivileged ? 'roster' : 'my');
  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Roster state
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDept, setSelectedDept] = useState('');
  const [dailyReport, setDailyReport] = useState<any>(null);

  // Correction Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<any>(null);
  const [correctionForm, setCorrectionForm] = useState({
    newStatus: 'PRESENT',
    checkInTime: '09:00:00',
    checkOutTime: '17:00:00',
    totalWorkingHours: 8.0,
    reason: ''
  });
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Check In/Out Action
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const fetchTodayStatus = async () => {
    try {
      if (user?.employeeId) {
        const res = await api.getTodayAttendance();
        setTodayStatus(res);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      if (user?.employeeId) {
        const res = await api.getAttendanceHistory(user.employeeId);
        setHistory(res);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDailyReport = async () => {
    try {
      const res = await api.getDailyAttendanceReport(reportDate, selectedDept || undefined);
      setDailyReport(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTodayStatus();
    fetchHistory();
    api.getDepartments().then(setDepartments).catch(console.error);
    if (isPrivileged) {
      fetchDailyReport();
    }
  }, [user, reportDate, selectedDept]);

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      setMessage(null);
      await api.checkIn();
      setMessage({ text: 'Clocked in successfully!' });
      await fetchTodayStatus();
      await fetchHistory();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      setMessage(null);
      await api.checkOut();
      setMessage({ text: 'Clocked out successfully!' });
      await fetchTodayStatus();
      await fetchHistory();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenCorrection = (row: any) => {
    setCorrectionTarget(row);
    setCorrectionForm({
      newStatus: row.status === 'ABSENT' ? 'PRESENT' : row.status,
      checkInTime: row.check_in_time || '09:00:00',
      checkOutTime: row.check_out_time || '17:00:00',
      totalWorkingHours: row.total_working_hours || 8.0,
      reason: ''
    });
    setCorrectionError(null);
    setShowCorrectionModal(true);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionForm.reason.trim()) {
      setCorrectionError('Mandatory reason must be provided for audit logging.');
      return;
    }

    try {
      await api.submitAttendanceCorrection({
        employeeId: correctionTarget.employee_id,
        date: reportDate,
        newStatus: correctionForm.newStatus,
        checkInTime: correctionForm.checkInTime,
        checkOutTime: correctionForm.checkOutTime,
        totalWorkingHours: Number(correctionForm.totalWorkingHours),
        reason: correctionForm.reason
      });
      setShowCorrectionModal(false);
      setMessage({ text: `Attendance corrected for ${correctionTarget.name}.` });
      fetchDailyReport();
    } catch (err: any) {
      setCorrectionError(err.message || 'Failed to submit correction.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck size={20} className="text-[#D6B46A]" />
            <span>Attendance & Time Tracking</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Automated 15-Minute Grace Period</span>
            <span>·</span>
            <span>Half-Day Threshold: 5.0h</span>
          </div>
        </div>

        {/* View Switcher if Privileged */}
        {isPrivileged && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-lg border border-slate-200 dark:border-white/5">
            <button
              onClick={() => setActiveView('roster')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'roster'
                  ? 'bg-white dark:bg-[#131D31] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Company Roster
            </button>
            <button
              onClick={() => setActiveView('my')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'my'
                  ? 'bg-white dark:bg-[#131D31] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              My Punch Clock
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${
          message.isError
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}><X size={14} /></button>
        </div>
      )}

      {/* VIEW 1: MY PUNCH CLOCK & HISTORY */}
      {activeView === 'my' && (
        <div className="space-y-6">
          {/* Punch Card Banner */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#D6B46A] uppercase tracking-wider">
                Today's Web Clock · {todayStatus?.date}
              </span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {todayStatus?.checkedOut
                  ? `Completed workday (${todayStatus.record?.total_working_hours} hours)`
                  : todayStatus?.checkedIn
                  ? `Checked in at ${todayStatus.record?.check_in_time} · Status: ${todayStatus.record?.status}`
                  : 'You have not checked in for today'}
              </div>
              <p className="text-xs text-slate-400">
                Timestamps are captured and validated strictly by the server. Grace period ends at 09:15.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {todayStatus?.checkedOut ? (
                <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Clock Out Finished</span>
                </div>
              ) : todayStatus?.checkedIn ? (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {actionLoading ? 'Clocking Out...' : 'Clock Out Now'}
                </button>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#D6B46A] to-[#B39045] hover:from-[#E5C57E] hover:to-[#C5A059] text-[#0B1120] font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {actionLoading ? 'Clocking In...' : 'Clock In Now'}
                </button>
              )}
            </div>
          </div>

          {/* Monthly Attendance Records */}
          <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                My Attendance History
              </h3>
              <span className="text-xs text-slate-400 font-mono">{history.length} Entries Logged</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
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
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No attendance history logged yet. Clock in to record your attendance.
                      </td>
                    </tr>
                  ) : (
                    history.map(att => (
                      <tr key={att.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-mono">{att.date}</td>
                        <td className="py-3 px-4 font-mono">{att.check_in_time || '—'}</td>
                        <td className="py-3 px-4 font-mono">{att.check_out_time || '—'}</td>
                        <td className="py-3 px-4 font-mono tabular-nums">{att.total_working_hours}h</td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-semibold ${
                            att.status === 'PRESENT' ? 'text-emerald-500' :
                            att.status === 'LATE' ? 'text-amber-500' :
                            att.status === 'HALF_DAY' ? 'text-sky-400' : 'text-red-400'
                          }`}>
                            {att.status}
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
        </div>
      )}

      {/* VIEW 2: HR / ADMIN COMPANY ATTENDANCE ROSTER */}
      {activeView === 'roster' && (
        <div className="space-y-6">
          {/* Controls: Date Picker & Department Filter */}
          <div className="p-4 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium">Select Date:</span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono text-slate-800 dark:text-white"
                />
              </div>

              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-white"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Quick KPI Count */}
            {dailyReport && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-500 font-semibold">{dailyReport.presentCount} Present</span>
                <span>·</span>
                <span className="text-amber-500 font-semibold">{dailyReport.lateCount} Late</span>
                <span>·</span>
                <span className="text-red-400 font-semibold">{dailyReport.absentCount} Absent</span>
                <span>·</span>
                <span className="text-indigo-400 font-semibold">{dailyReport.onLeaveCount} On Leave</span>
              </div>
            )}
          </div>

          {/* Roster Table */}
          <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Check In</th>
                    <th className="py-3 px-4">Check Out</th>
                    <th className="py-3 px-4">Working Hours</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">HR Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {!dailyReport || dailyReport.rows?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No employees registered yet. Go to Employees to register team members.
                      </td>
                    </tr>
                  ) : (
                    dailyReport.rows.map((row: any) => (
                      <tr key={row.employee_id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{row.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{row.employee_code}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {row.department_name || 'N/A'}
                        </td>
                        <td className="py-3 px-4 font-mono">{row.check_in_time || '—'}</td>
                        <td className="py-3 px-4 font-mono">{row.check_out_time || '—'}</td>
                        <td className="py-3 px-4 font-mono tabular-nums">{row.total_working_hours}h</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            row.status === 'PRESENT' ? 'text-emerald-500' :
                            row.status === 'LATE' ? 'text-amber-500' :
                            row.status === 'HALF_DAY' ? 'text-sky-400' :
                            row.status === 'ON_LEAVE' ? 'text-indigo-400' :
                            row.status === 'HOLIDAY' || row.status === 'WEEKEND' ? 'text-slate-400' : 'text-red-400'
                          }`}>
                            <span>·</span>
                            <span>{row.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenCorrection(row)}
                            className="p-1.5 rounded hover:bg-[#D6B46A]/20 text-[#D6B46A] text-xs font-medium inline-flex items-center gap-1"
                            title="Correct Attendance with Audit Reason"
                          >
                            <Edit size={13} />
                            <span>Correct</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE CORRECTION MODAL WITH MANDATORY REASON */}
      {showCorrectionModal && correctionTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit size={15} className="text-[#D6B46A]" />
                <span>Correct Attendance: {correctionTarget.name}</span>
              </h3>
              <button onClick={() => setShowCorrectionModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {correctionError && (
              <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{correctionError}</span>
              </div>
            )}

            <form onSubmit={handleCorrectionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New Status</label>
                <select
                  value={correctionForm.newStatus}
                  onChange={e => setCorrectionForm({ ...correctionForm, newStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="HALF_DAY">HALF_DAY</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Check In Time</label>
                  <input
                    type="time"
                    step="1"
                    value={correctionForm.checkInTime}
                    onChange={e => setCorrectionForm({ ...correctionForm, checkInTime: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Check Out Time</label>
                  <input
                    type="time"
                    step="1"
                    value={correctionForm.checkOutTime}
                    onChange={e => setCorrectionForm({ ...correctionForm, checkOutTime: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Total Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={correctionForm.totalWorkingHours}
                  onChange={e => setCorrectionForm({ ...correctionForm, totalWorkingHours: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  value={correctionForm.reason}
                  onChange={e => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  placeholder="e.g. Card scanner glitch reported by manager; confirmed via biometric log."
                  className="w-full p-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg"
                >
                  Log & Apply Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
