/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CalendarOff,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Calendar,
  Send,
  X,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { LeaveBalance, LeaveRequest, LeaveType } from '../types/index.ts';

export function LeavePage() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'HR';

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  // Leave Form
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Smart Leave AI Modal
  const [showSmartAiModal, setShowSmartAiModal] = useState(false);
  const [smartPrompt, setSmartPrompt] = useState('I need sick leave next Monday for two days because of fever.');
  const [parsingAi, setParsingAi] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  // Review Modal (HR / Admin)
  const [reviewTarget, setReviewTarget] = useState<LeaveRequest | null>(null);
  const [reviewComments, setReviewComments] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bals, reqs, types] = await Promise.all([
        user?.employeeId ? api.getLeaveBalances(user.employeeId) : Promise.resolve([]),
        api.getLeaveRequests(),
        api.getLeaveTypes()
      ]);
      setBalances(bals);
      setRequests(reqs);
      setLeaveTypes(types);
      if (types.length > 0 && !form.leaveTypeId) {
        setForm(prev => ({ ...prev, leaveTypeId: types[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.reason.trim()) {
      setFormError('Please enter a clear reason for your leave request.');
      return;
    }

    try {
      setSubmitting(true);
      await api.submitLeaveRequest(form);
      setShowApplyModal(false);
      setActionSuccess('Leave request submitted successfully. Awaiting HR review.');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSmartLeaveParse = async () => {
    if (!smartPrompt.trim()) return;
    try {
      setParsingAi(true);
      setAiExplanation(null);
      const result = await api.parseSmartLeave(smartPrompt);

      // Match leave type by code
      const matchedType = leaveTypes.find(lt => lt.code.toUpperCase() === (result.leaveTypeCode || '').toUpperCase());

      setForm(prev => ({
        ...prev,
        leaveTypeId: matchedType ? matchedType.id : prev.leaveTypeId,
        startDate: result.startDate || prev.startDate,
        endDate: result.endDate || prev.endDate,
        reason: result.reason || smartPrompt
      }));

      setAiExplanation(result.rawExplanation || 'AI extracted the dates, leave category, and reason.');
      setShowSmartAiModal(false);
      setShowApplyModal(true);
    } catch (err: any) {
      alert(err.message || 'Smart Leave extraction failed.');
    } finally {
      setParsingAi(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
      await api.cancelLeaveRequest(requestId);
      setActionSuccess('Leave request cancelled.');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!reviewTarget) return;
    try {
      setReviewing(true);
      await api.reviewLeaveRequest(reviewTarget.id, decision, reviewComments);
      setReviewTarget(null);
      setActionSuccess(`Leave request for ${reviewTarget.first_name} ${decision.toLowerCase()} successfully.`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReviewing(false);
    }
  };

  const pendingApprovals = requests.filter(r => r.status === 'PENDING');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarOff size={20} className="text-[#D6B46A]" />
            <span>Leave Management & Smart Leave</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Automated Working Day Calculation</span>
            <span>·</span>
            <span>Weekends & Holidays Excluded</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAiExplanation(null);
              setShowSmartAiModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-[#131D31] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-[#D6B46A] border border-[#D6B46A]/30 rounded-lg shadow-sm transition-colors"
          >
            <Sparkles size={14} className="text-[#D6B46A]" />
            <span>Smart Leave (Natural Language)</span>
          </button>

          <button
            onClick={() => {
              setFormError(null);
              setShowApplyModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gradient-to-r from-[#D6B46A] to-[#B39045] hover:from-[#E5C57E] hover:to-[#C5A059] text-[#0B1120] rounded-lg shadow-sm transition-all"
          >
            <CalendarOff size={15} />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Leave Balances Grid */}
      {balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {balances.map(b => {
            const remaining = b.allocated_days - b.used_days;
            return (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{b.leave_type_name}</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5">
                    {b.leave_type_code}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <div>
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {b.is_paid === 0 ? '∞' : remaining}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">days left</span>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 tabular-nums">
                    <div>Used: {b.used_days}d</div>
                    {b.pending_days > 0 && <div className="text-amber-500">Pending: {b.pending_days}d</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HR / Admin Approval Queue (If any pending) */}
      {isPrivileged && (
        <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Clock size={15} className="text-amber-500" />
              <span>Pending Review Queue ({pendingApprovals.length})</span>
            </h3>
            <span className="text-xs text-slate-400">Strict Server-side Approval & Balance Deduction</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {pendingApprovals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No pending leave requests awaiting approval.
                    </td>
                  </tr>
                ) : (
                  pendingApprovals.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {req.first_name} {req.last_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{req.employee_code}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {req.leave_type_name}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {req.duration_days} working days
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {req.start_date} to {req.end_date}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {req.reason}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setReviewTarget(req);
                              setReviewComments('');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Requests History Table */}
      <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {isPrivileged ? 'All Company Leave Requests' : 'My Leave Request History'}
          </h3>
          <span className="text-xs text-slate-400 font-mono">{requests.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
              <tr>
                {isPrivileged && <th className="py-3 px-4">Employee</th>}
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Working Days</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={isPrivileged ? 7 : 6} className="py-8 text-center text-slate-400">
                    No leave requests found. Click "Apply for Leave" or try "Smart Leave AI".
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    {isPrivileged && (
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {req.first_name} {req.last_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono ml-1">({req.employee_code})</span>
                      </td>
                    )}
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {req.leave_type_name}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {req.start_date} to {req.end_date}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold tabular-nums">
                      {req.duration_days}d
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {req.reason}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        req.status === 'APPROVED' ? 'text-emerald-500' :
                        req.status === 'REJECTED' ? 'text-red-400' :
                        req.status === 'CANCELLED' ? 'text-slate-400' : 'text-amber-500'
                      }`}>
                        <span>·</span>
                        <span>{req.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {req.status === 'PENDING' && (user?.role === 'EMPLOYEE' || req.employee_id === user?.employeeId) && (
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          className="text-[11px] text-red-400 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SMART LEAVE AI MODAL */}
      {showSmartAiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles size={16} className="text-[#D6B46A]" />
                <span>Smart Leave Natural Language Parser</span>
              </h3>
              <button onClick={() => setShowSmartAiModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Type your leave request in natural language. The AI will extract the dates, leave category, and reason into a prefilled form for your review.
            </p>

            <textarea
              rows={3}
              value={smartPrompt}
              onChange={e => setSmartPrompt(e.target.value)}
              placeholder="e.g. I need sick leave next Monday for two days due to food poisoning."
              className="w-full p-3 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Requires explicit submission after prefill.</span>
              </span>

              <button
                type="button"
                onClick={handleSmartLeaveParse}
                disabled={parsingAi}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <Sparkles size={14} />
                <span>{parsingAi ? 'Extracting with Gemini...' : 'Prefill Form'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPLY LEAVE FORM MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarOff size={16} className="text-[#D6B46A]" />
                <span>Submit Leave Request</span>
              </h3>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {aiExplanation && (
              <div className="mb-4 p-3 bg-[#D6B46A]/10 border border-[#D6B46A]/30 rounded-xl text-[11px] text-[#D6B46A] flex items-center gap-2">
                <Sparkles size={14} className="shrink-0" />
                <span>{aiExplanation}</span>
              </div>
            )}

            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Leave Type Category *
                </label>
                <select
                  required
                  value={form.leaveTypeId}
                  onChange={e => setForm({ ...form, leaveTypeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.is_paid ? `${lt.days_allowed_per_year}d quota` : 'Unpaid'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Request *
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="Provide context for management approval..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Validating...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HR REVIEW & DECISION MODAL */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Review Leave: {reviewTarget.first_name} {reviewTarget.last_name}
              </h3>
              <button onClick={() => setReviewTarget(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 space-y-1">
                <div><span className="text-slate-400">Type:</span> <span className="font-semibold">{reviewTarget.leave_type_name}</span></div>
                <div><span className="text-slate-400">Dates:</span> <span className="font-mono">{reviewTarget.start_date} to {reviewTarget.end_date}</span> ({reviewTarget.duration_days} working days)</div>
                <div><span className="text-slate-400">Reason:</span> "{reviewTarget.reason}"</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Optional Reviewer Comments
                </label>
                <textarea
                  rows={2}
                  value={reviewComments}
                  onChange={e => setReviewComments(e.target.value)}
                  placeholder="e.g. Approved. Please ensure handover to team lead."
                  className="w-full p-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => handleDecision('REJECTED')}
                disabled={reviewing}
                className="px-4 py-2 text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors"
              >
                Reject Request
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewTarget(null)}
                  className="px-3 py-2 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision('APPROVED')}
                  disabled={reviewing}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition-all"
                >
                  Approve Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
