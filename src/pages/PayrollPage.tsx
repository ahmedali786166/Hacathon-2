/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Lock,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Calculator,
  Calendar,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { generatePayslipPdf } from '../utils/pdfGenerator.ts';
import type { PayrollPeriod, PayrollItem } from '../types/index.ts';

export function PayrollPage() {
  const { user, company } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'HR';

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [currentPeriodDetails, setCurrentPeriodDetails] = useState<{ period: PayrollPeriod; items: PayrollItem[] } | null>(null);

  // Draft generator parameters
  const now = new Date();
  const [draftMonth, setDraftMonth] = useState<number>(now.getMonth() + 1);
  const [draftYear, setDraftYear] = useState<number>(now.getFullYear());
  const [generating, setGenerating] = useState(false);
  const [locking, setLocking] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Employee personal payslips
  const [myPayslips, setMyPayslips] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      if (isPrivileged) {
        const list = await api.getPayrollPeriods();
        setPeriods(list);
        if (list.length > 0 && !selectedPeriodId) {
          setSelectedPeriodId(list[0].id);
        }
      } else {
        const slips = await api.getMyPayslips();
        setMyPayslips(slips);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, [user]);

  useEffect(() => {
    if (selectedPeriodId && isPrivileged) {
      api.getPayrollPeriodDetails(selectedPeriodId).then(setCurrentPeriodDetails).catch(console.error);
    }
  }, [selectedPeriodId]);

  const handleGenerateDraft = async () => {
    try {
      setGenerating(true);
      setActionError(null);
      const res = await api.generatePayrollDraft(draftMonth, draftYear);
      setActionSuccess(`Payroll draft for ${draftMonth}/${draftYear} generated successfully.`);
      await fetchPeriods();
      setSelectedPeriodId(res.period.id);
      setCurrentPeriodDetails(res);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate payroll draft.');
    } finally {
      setGenerating(false);
    }
  };

  const handleLockPeriod = async () => {
    if (!isAdmin) {
      alert('Only the System Administrator is authorized to finalize and lock payroll.');
      return;
    }
    if (!selectedPeriodId) return;
    if (!confirm('Are you sure you want to finalize and lock this payroll period? Once locked, salary records cannot be modified.')) return;

    try {
      setLocking(true);
      setActionError(null);
      const res = await api.lockPayrollPeriod(selectedPeriodId);
      setActionSuccess(`Payroll for ${res.period.month}/${res.period.year} is now finalized and locked.`);
      await fetchPeriods();
      setCurrentPeriodDetails(res);
    } catch (err: any) {
      setActionError(err.message || 'Failed to lock payroll period.');
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Banknote size={20} className="text-[#D6B46A]" />
            <span>{isPrivileged ? 'Payroll & Salary Engine' : 'My Official Payslips'}</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Statutory Pakistan Income Tax Compliance</span>
            <span>·</span>
            <span>Gross: 1.5x Basic (Basic + 40% HRA + 10% Medical)</span>
          </div>
        </div>

        {/* Generate Draft Trigger (HR or Admin) */}
        {isPrivileged && (
          <div className="flex items-center gap-2">
            <select
              value={draftMonth}
              onChange={e => setDraftMonth(Number(e.target.value))}
              className="px-2.5 py-2 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-white"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>Month {m}</option>
              ))}
            </select>

            <select
              value={draftYear}
              onChange={e => setDraftYear(Number(e.target.value))}
              className="px-2.5 py-2 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-white"
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={handleGenerateDraft}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
              <span>{generating ? 'Calculating...' : 'Generate Monthly Draft'}</span>
            </button>
          </div>
        )}
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)}><X size={14} /></button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Tax Slabs Documentation Card */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <Calculator size={15} className="text-[#D6B46A]" />
          <span>Pakistan Annual Tax Slabs Formula Invariant</span>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
          Annual Gross is computed as Gross × 12. Monthly tax = Annual tax / 12. Slabs: Up to PKR 600K (0%) · 600K–1.2M (5% exceeding 600K) · 1.2M–2.4M (PKR 30K + 15% exceeding 1.2M) · 2.4M–3.6M (PKR 210K + 25% exceeding 2.4M) · Above 3.6M (PKR 510K + 35% exceeding 3.6M).
        </p>
      </div>

      {/* VIEW FOR REGULAR EMPLOYEES: Their own payslips */}
      {!isPrivileged && (
        <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              My Finalized Payslip Archive
            </h3>
            <span className="text-xs text-slate-400 font-mono">{myPayslips.length} Available</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Gross Salary</th>
                  <th className="py-3 px-4 text-right">Tax Deduction</th>
                  <th className="py-3 px-4 text-right">Attendance Deductions</th>
                  <th className="py-3 px-4 text-right">Net Salary</th>
                  <th className="py-3 px-4 text-right">Download PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {myPayslips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No finalized payslips available yet. Once Admin locks a monthly payroll, your payslip will be ready here.
                    </td>
                  </tr>
                ) : (
                  myPayslips.map(ps => (
                    <tr key={ps.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
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
                          onClick={() => generatePayslipPdf(ps, ps.month || 1, ps.year || new Date().getFullYear(), company)}
                          className="px-3 py-1 bg-slate-100 dark:bg-white/10 hover:bg-[#D6B46A]/20 text-[#D6B46A] rounded text-xs font-medium inline-flex items-center gap-1.5"
                        >
                          <Download size={13} />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW FOR HR / ADMIN: Payroll Periods & Draft Breakdown */}
      {isPrivileged && (
        <div className="space-y-6">
          {/* Period Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {periods.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                No payroll periods generated yet. Select a month above and click "Generate Monthly Draft".
              </p>
            ) : (
              periods.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriodId(p.id)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap flex items-center gap-2 ${
                    selectedPeriodId === p.id
                      ? 'bg-slate-900 dark:bg-white/10 text-white border-[#D6B46A] shadow-sm'
                      : 'bg-white dark:bg-[#131D31] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:text-white'
                  }`}
                >
                  <Calendar size={13} />
                  <span>Period {p.month}/{p.year}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      p.status === 'LOCKED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {p.status}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Selected Period Details Card */}
          {currentPeriodDetails && (
            <div className="space-y-6">
              {/* Period KPI Summary Banner */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Payroll Roster: {currentPeriodDetails.period.month}/{currentPeriodDetails.period.year}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded font-mono ${
                        currentPeriodDetails.period.status === 'LOCKED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {currentPeriodDetails.period.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                    <div>
                      <span className="text-slate-400">Total Gross:</span>
                      <div className="text-sm font-bold text-slate-800 dark:text-white font-mono tabular-nums">
                        PKR {currentPeriodDetails.period.total_gross.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Total Deductions:</span>
                      <div className="text-sm font-bold text-amber-500 font-mono tabular-nums">
                        PKR {Math.round(currentPeriodDetails.period.total_deductions).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Income Tax:</span>
                      <div className="text-sm font-bold text-red-400 font-mono tabular-nums">
                        PKR {currentPeriodDetails.period.total_tax.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Net Disbursement:</span>
                      <div className="text-sm font-extrabold text-[#D6B46A] font-mono tabular-nums">
                        PKR {currentPeriodDetails.period.total_net.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lock Action (Admin Only) */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {currentPeriodDetails.period.status === 'DRAFT' ? (
                    isAdmin ? (
                      <button
                        onClick={handleLockPeriod}
                        disabled={locking}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
                      >
                        <Lock size={14} />
                        <span>{locking ? 'Finalizing...' : 'Finalize & Lock Period (Admin)'}</span>
                      </button>
                    ) : (
                      <div className="text-xs text-amber-400 flex items-center gap-1.5 p-2 rounded-lg bg-amber-500/10">
                        <Lock size={14} />
                        <span>Draft status. Only Admin can finalize and lock.</span>
                      </div>
                    )
                  ) : (
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <ShieldCheck size={16} />
                      <span>Finalized & Locked on {currentPeriodDetails.period.locked_at?.slice(0, 10)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Individual Employee Payslip Line Items */}
              <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Employee Breakdown ({currentPeriodDetails.items.length} employees)
                  </h3>
                  <span className="text-xs text-slate-400">Attendance deductions & Tax calculations applied</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4 text-right">Basic</th>
                        <th className="py-3 px-4 text-right">Gross</th>
                        <th className="py-3 px-4 text-right">Days Pres/Abs</th>
                        <th className="py-3 px-4 text-right">Deductions</th>
                        <th className="py-3 px-4 text-right">Tax</th>
                        <th className="py-3 px-4 text-right">Net Pay</th>
                        <th className="py-3 px-4 text-right">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {currentPeriodDetails.items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {item.first_name} {item.last_name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {item.employee_code} · {item.department_name}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            PKR {item.basic_salary.toLocaleString()}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                            PKR {item.gross_salary.toLocaleString()}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-[11px] tabular-nums">
                            <span className="text-emerald-500 font-semibold">{item.days_present}P</span>
                            <span className="text-slate-400"> / </span>
                            <span className={item.days_absent > 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                              {item.days_absent}A
                            </span>
                            {item.late_count > 0 && (
                              <span className="text-amber-500 ml-1">({item.late_count}L)</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-amber-500 tabular-nums">
                            -PKR {Math.round(item.absence_deduction + item.half_day_deduction + item.late_deduction).toLocaleString()}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-red-400 tabular-nums">
                            -PKR {item.monthly_tax_deduction.toLocaleString()}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-extrabold text-[#D6B46A] tabular-nums">
                            PKR {item.net_salary.toLocaleString()}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => generatePayslipPdf(item, currentPeriodDetails.period.month, currentPeriodDetails.period.year, company)}
                              className="p-1.5 text-xs text-[#D6B46A] hover:bg-[#D6B46A]/10 rounded"
                              title="Download Payslip PDF"
                            >
                              <Download size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
