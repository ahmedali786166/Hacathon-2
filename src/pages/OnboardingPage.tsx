/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Building2, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export function OnboardingPage() {
  const { setupInitialCompany } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: 'Saylani Tech Solutions',
    companyCode: 'STS',
    contactEmail: 'contact@saylanitech.com',
    phone: '+92 21 111 729 526',
    address: 'Saylani Head Office, Bahadurabad, Karachi, Pakistan',
    adminEmail: 'admin@saylanitech.com',
    adminPassword: '',
    confirmPassword: '',
    officeStartTime: '09:00',
    officeEndTime: '17:00',
    gracePeriodMinutes: 15,
    weekendDays: 'Saturday,Sunday'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.companyName || !formData.companyCode || !formData.adminEmail || !formData.adminPassword) {
      setError('Please fill in all required company and administrator fields.');
      return;
    }

    if (formData.adminPassword.length < 6) {
      setError('Administrator password must be at least 6 characters long.');
      return;
    }

    if (formData.adminPassword !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await setupInitialCompany(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to complete initial system setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D1A] text-slate-100 flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-2xl bg-[#0E1626] border border-white/10 rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative overflow-hidden">
        {/* Luxury Gold Ambient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#997732] via-[#D6B46A] to-[#997732]" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D6B46A] to-[#8C6D29] flex items-center justify-center text-[#0B1120] font-black text-xl shadow-lg">
            STS
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              HCM Lite System Initialization
              <Sparkles size={16} className="text-[#D6B46A]" />
            </h1>
            <p className="text-xs text-slate-400">
              Fresh Installation: Create your company organization and primary administrator account.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Company Profile */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#D6B46A] uppercase tracking-wider mb-3">
              <Building2 size={14} />
              <span>1. Organization & Working Timings</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Company Legal Name *</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="e.g. Saylani Tech Solutions"
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Company Code (Short ID) *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={formData.companyCode}
                  onChange={e => setFormData({ ...formData, companyCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. STS"
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Official Contact Email *</label>
                <input
                  type="email"
                  required
                  value={formData.contactEmail}
                  onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="contact@company.com"
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+92 21 111 729 526"
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Headquarters Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Bahadurabad, Karachi"
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Office Hours Start</label>
                <input
                  type="time"
                  value={formData.officeStartTime}
                  onChange={e => setFormData({ ...formData, officeStartTime: e.target.value })}
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-[#D6B46A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Grace Period (Minutes)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={formData.gracePeriodMinutes}
                  onChange={e => setFormData({ ...formData, gracePeriodMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-[#D6B46A]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Admin Account */}
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D6B46A] uppercase tracking-wider mb-3">
              <Shield size={14} />
              <span>2. Primary System Administrator</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Admin Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.adminEmail}
                  onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                  placeholder="admin@saylanitech.com"
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Secure Password *</label>
                <input
                  type="password"
                  required
                  value={formData.adminPassword}
                  onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password *</label>
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Re-type password"
                  className="w-full px-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Configures statutory Pakistan tax slabs and default leave quotas automatically.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#D6B46A] to-[#B39045] hover:from-[#E5C57E] hover:to-[#C5A059] text-[#0B1120] font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Initializing System...' : 'Initialize Organization'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
