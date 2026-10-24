/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export function LoginPage() {
  const { login, company } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please provide both your official email and password.');
      return;
    }

    try {
      setLoading(true);
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D1A] text-slate-100 flex items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Background subtle light cones */}
      <div className="absolute top-1/4 -left-40 w-96 h-96 bg-[#D6B46A]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0E1626] border border-white/10 rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative z-10">
        {/* Top Gold Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D6B46A] to-transparent" />

        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-[#D6B46A] to-[#8C6D29] flex items-center justify-center text-[#0B1120] font-black text-xl shadow-lg mb-3">
            {company?.company_code?.slice(0, 2) || 'HC'}
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            {company?.company_name || 'HCM Lite'}
            <Sparkles size={14} className="text-[#D6B46A]" />
          </h1>
          <p className="text-xs text-slate-400 mt-1">Enterprise Human Capital Management Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Official Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full pl-9 pr-3 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Account Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2 bg-[#131D31] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D6B46A]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-[#D6B46A] to-[#B39045] hover:from-[#E5C57E] hover:to-[#C5A059] text-[#0B1120] font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {/* Security Invariants Footer Note */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-[11px] text-slate-400 justify-center">
          <ShieldCheck size={14} className="text-[#D6B46A]" />
          <span>Role-Based Access Control & Encrypted JWT Session</span>
        </div>
      </div>
    </div>
  );
}
