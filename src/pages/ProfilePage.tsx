/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Building2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';

export function ProfilePage() {
  const { user, company, refreshUser } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      setLoading(true);
      await api.changePassword({ oldPassword, newPassword });
      setSuccess('Your password has been changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <User size={20} className="text-[#D6B46A]" />
          <span>Profile & Security Credentials</span>
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span>Active Role: {user?.role}</span>
          <span>·</span>
          <span>Company: {company?.company_name}</span>
        </div>
      </div>

      {user?.mustChangePassword && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-500 flex items-start gap-3">
          <KeyRound size={18} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Temporary Password Detected:</span>
            <p className="mt-0.5 text-slate-400">
              Your account was assigned a temporary password. Please change your password now to secure your account.
            </p>
          </div>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}><X size={14} /></button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Account Info Card */}
      <div className="p-6 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Account Profile
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400">Official Email:</span>
            <div className="font-semibold text-slate-800 dark:text-white mt-0.5 font-mono">{user?.email}</div>
          </div>
          <div>
            <span className="text-slate-400">System Role:</span>
            <div className="font-semibold text-[#D6B46A] mt-0.5 font-mono">{user?.role}</div>
          </div>
          {user?.employeeCode && (
            <div>
              <span className="text-slate-400">Employee ID:</span>
              <div className="font-semibold text-slate-800 dark:text-white mt-0.5 font-mono">{user.employeeCode}</div>
            </div>
          )}
          <div>
            <span className="text-slate-400">Organization:</span>
            <div className="font-semibold text-slate-800 dark:text-white mt-0.5">{company?.company_name}</div>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="p-6 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Lock size={15} className="text-[#D6B46A]" />
          <span>Update Account Password</span>
        </h3>

        <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs max-w-md">
          {!user?.mustChangePassword && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Current Password *</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">New Password *</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-type new password"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? 'Updating Password...' : 'Save Password'}
          </button>
        </form>
      </div>

      {/* Security Architecture Invariants */}
      <div className="p-6 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl space-y-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
          <ShieldCheck size={16} className="text-[#D6B46A]" />
          <span>Security & Audit Invariants</span>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Passwords hashed with bcrypt with 10 salt rounds.</li>
          <li>Cryptographically signed JWT with 24-hour expiration.</li>
          <li>Server-side authorization enforced in every route; employee salary data redacted from regular employee tokens.</li>
          <li>All payroll finalization and system settings changes logged to the immutable audit vault.</li>
        </ul>
      </div>
    </div>
  );
}
