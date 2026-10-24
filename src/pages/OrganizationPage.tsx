/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Briefcase,
  CalendarOff,
  Calendar,
  Users,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Save,
  Shield,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { Department, Designation, LeaveType, CompanyHoliday, CompanySettings } from '../types/index.ts';

export function OrganizationPage() {
  const { user, company, refreshCompany } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'settings' | 'departments' | 'designations' | 'leave-types' | 'holidays' | 'users'>('settings');

  // Company Settings State
  const [settingsForm, setSettingsForm] = useState<Partial<CompanySettings>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Departments State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');

  // Designations State
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [desigName, setDesigName] = useState('');
  const [desigCode, setDesigCode] = useState('');
  const [desigDeptId, setDesigDeptId] = useState('');

  // Leave Types State
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [ltName, setLtName] = useState('');
  const [ltCode, setLtCode] = useState('');
  const [ltDays, setLtDays] = useState(14);
  const [ltIsPaid, setLtIsPaid] = useState(true);

  // Holidays State
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');

  // Users State (Admin)
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newHrEmail, setNewHrEmail] = useState('');
  const [newHrPassword, setNewHrPassword] = useState('Saylani@2026');
  const [newHrRole, setNewHrRole] = useState<'HR' | 'ADMIN'>('HR');
  const [creatingUser, setCreatingUser] = useState(false);

  // Notification banners
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [comp, depts, desigs, lts, hols] = await Promise.all([
        api.getCompany(),
        api.getDepartments(),
        api.getDesignations(),
        api.getLeaveTypes(),
        api.getHolidays()
      ]);
      setSettingsForm(comp);
      setDepartments(depts);
      setDesignations(desigs);
      setLeaveTypes(lts);
      setHolidays(hols);

      if (depts.length > 0 && !desigDeptId) {
        setDesigDeptId(depts[0].id);
      }

      if (isAdmin) {
        const u = await api.getUsers();
        setUsersList(u);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      setSavingSettings(true);
      setErrorMsg(null);
      await api.updateCompany(settingsForm);
      setSuccessMsg('Company parameters updated successfully.');
      await refreshCompany();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName || !deptCode) return;
    try {
      setErrorMsg(null);
      await api.createDepartment({ name: deptName, code: deptCode });
      setDeptName('');
      setDeptCode('');
      setSuccessMsg('Department created.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      setErrorMsg(null);
      await api.deleteDepartment(id);
      setSuccessMsg('Department deleted.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desigName || !desigCode || !desigDeptId) return;
    try {
      setErrorMsg(null);
      await api.createDesignation({ name: desigName, code: desigCode, department_id: desigDeptId });
      setDesigName('');
      setDesigCode('');
      setSuccessMsg('Designation created.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteDesignation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this designation?')) return;
    try {
      setErrorMsg(null);
      await api.deleteDesignation(id);
      setSuccessMsg('Designation deleted.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ltName || !ltCode) return;
    try {
      setErrorMsg(null);
      await api.createLeaveType({
        name: ltName,
        code: ltCode,
        days_allowed_per_year: Number(ltDays),
        is_paid: ltIsPaid
      });
      setLtName('');
      setLtCode('');
      setSuccessMsg('Leave category created.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) return;
    try {
      setErrorMsg(null);
      await api.createHoliday({ name: holidayName, holiday_date: holidayDate });
      setHolidayName('');
      setHolidayDate('');
      setSuccessMsg('Company holiday added.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await api.deleteHoliday(id);
      setSuccessMsg('Holiday removed.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHrEmail || !newHrPassword) return;
    try {
      setCreatingUser(true);
      setErrorMsg(null);
      await api.createUser({ email: newHrEmail, password: newHrPassword, role: newHrRole });
      setNewHrEmail('');
      setSuccessMsg(`User ${newHrRole} account created successfully.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentActive: boolean) => {
    try {
      await api.updateUserStatus(userId, !currentActive);
      setSuccessMsg(`User account status updated.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Building2 size={20} className="text-[#D6B46A]" />
          <span>Organization & Master Data</span>
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span>Enterprise Configuration</span>
          <span>·</span>
          <span>Roles, Departments & Policies</span>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}><X size={14} /></button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3.5 py-2 font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'settings'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Company Settings
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-3.5 py-2 font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'departments'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Departments ({departments.length})
        </button>
        <button
          onClick={() => setActiveTab('designations')}
          className={`px-3.5 py-2 font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'designations'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Designations ({designations.length})
        </button>
        <button
          onClick={() => setActiveTab('leave-types')}
          className={`px-3.5 py-2 font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'leave-types'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Leave Types ({leaveTypes.length})
        </button>
        <button
          onClick={() => setActiveTab('holidays')}
          className={`px-3.5 py-2 font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'holidays'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Company Holidays ({holidays.length})
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'users'
                ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            User Accounts ({usersList.length})
          </button>
        )}
      </div>

      {/* 1. SETTINGS TAB */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={settingsForm.company_name || ''}
                onChange={e => setSettingsForm({ ...settingsForm, company_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Company Code</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={settingsForm.company_code || ''}
                onChange={e => setSettingsForm({ ...settingsForm, company_code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg uppercase text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Contact Email</label>
              <input
                type="email"
                disabled={!isAdmin}
                value={settingsForm.contact_email || ''}
                onChange={e => setSettingsForm({ ...settingsForm, contact_email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={settingsForm.phone || ''}
                onChange={e => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Office Start Time</label>
              <input
                type="time"
                disabled={!isAdmin}
                value={settingsForm.office_start_time || '09:00'}
                onChange={e => setSettingsForm({ ...settingsForm, office_start_time: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Grace Period (Minutes)</label>
              <input
                type="number"
                disabled={!isAdmin}
                value={settingsForm.grace_period_minutes ?? 15}
                onChange={e => setSettingsForm({ ...settingsForm, grace_period_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Company Policy Document (Grounded by AI Assistant)</label>
              <textarea
                rows={3}
                disabled={!isAdmin}
                value={settingsForm.policy_document || ''}
                onChange={e => setSettingsForm({ ...settingsForm, policy_document: e.target.value })}
                className="w-full p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm transition-all"
              >
                <Save size={14} />
                <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* 2. DEPARTMENTS TAB */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateDepartment} className="p-4 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              required
              placeholder="Department Name (e.g. Engineering)"
              value={deptName}
              onChange={e => setDeptName(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
            />
            <input
              type="text"
              required
              placeholder="Code (e.g. ENG)"
              value={deptCode}
              onChange={e => setDeptCode(e.target.value.toUpperCase())}
              className="w-32 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-[#D6B46A] text-[#0B1120] rounded-lg shadow-sm"
            >
              Add Department
            </button>
          </form>

          <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4">Active Staff</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {departments.map(d => (
                  <tr key={d.id}>
                    <td className="py-3 px-4 font-mono font-bold text-[#D6B46A]">{d.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{d.name}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">{d.employee_count || 0}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteDepartment(d.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded"
                        title="Delete Department"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. DESIGNATIONS TAB */}
      {activeTab === 'designations' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateDesignation} className="p-4 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <select
              value={desigDeptId}
              onChange={e => setDesigDeptId(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Designation Title (e.g. Software Engineer)"
              value={desigName}
              onChange={e => setDesigName(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
            />
            <input
              type="text"
              required
              placeholder="Code (e.g. SWE)"
              value={desigCode}
              onChange={e => setDesigCode(e.target.value.toUpperCase())}
              className="w-28 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-[#D6B46A] text-[#0B1120] rounded-lg shadow-sm"
            >
              Add Designation
            </button>
          </form>

          <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Designation Title</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {designations.map(d => (
                  <tr key={d.id}>
                    <td className="py-3 px-4 font-mono font-bold text-[#D6B46A]">{d.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{d.name}</td>
                    <td className="py-3 px-4 text-slate-500">{d.department_name}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteDesignation(d.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded"
                        title="Delete Designation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LEAVE TYPES TAB */}
      {activeTab === 'leave-types' && (
        <div className="space-y-6">
          {isAdmin && (
            <form onSubmit={handleCreateLeaveType} className="p-4 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                required
                placeholder="Category Name (e.g. Parental Leave)"
                value={ltName}
                onChange={e => setLtName(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
              />
              <input
                type="text"
                required
                placeholder="Code (e.g. PL)"
                value={ltCode}
                onChange={e => setLtCode(e.target.value.toUpperCase())}
                className="w-24 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs uppercase"
              />
              <input
                type="number"
                min={0}
                required
                placeholder="Days Quota"
                value={ltDays}
                onChange={e => setLtDays(Number(e.target.value))}
                className="w-28 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={ltIsPaid}
                  onChange={e => setLtIsPaid(e.target.checked)}
                  className="rounded text-[#D6B46A]"
                />
                <span>Paid Leave</span>
              </label>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-[#D6B46A] text-[#0B1120] rounded-lg shadow-sm"
              >
                Add Category
              </button>
            </form>
          )}

          <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Leave Name</th>
                  <th className="py-3 px-4">Statutory Quota / Year</th>
                  <th className="py-3 px-4">Compensation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {leaveTypes.map(lt => (
                  <tr key={lt.id}>
                    <td className="py-3 px-4 font-mono font-bold text-[#D6B46A]">{lt.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{lt.name}</td>
                    <td className="py-3 px-4 font-mono tabular-nums">{lt.days_allowed_per_year} days</td>
                    <td className="py-3 px-4">
                      <span className={`text-[11px] font-semibold ${lt.is_paid ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {lt.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. HOLIDAYS TAB */}
      {activeTab === 'holidays' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateHoliday} className="p-4 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              required
              placeholder="Holiday Name (e.g. Pakistan Day)"
              value={holidayName}
              onChange={e => setHolidayName(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
            />
            <input
              type="date"
              required
              value={holidayDate}
              onChange={e => setHolidayDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-[#D6B46A] text-[#0B1120] rounded-lg shadow-sm"
            >
              Add Holiday
            </button>
          </form>

          <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Holiday Date</th>
                  <th className="py-3 px-4">Holiday Occasion</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">No company holidays scheduled.</td>
                  </tr>
                ) : (
                  holidays.map(h => (
                    <tr key={h.id}>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">{h.holiday_date}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{h.name}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded"
                          title="Delete Holiday"
                        >
                          <Trash2 size={14} />
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

      {/* 6. USERS TAB (ADMIN ONLY) */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-6">
          {/* Create HR / Admin Account Form */}
          <form onSubmit={handleCreateUser} className="p-4 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <input
              type="email"
              required
              placeholder="New Account Email"
              value={newHrEmail}
              onChange={e => setNewHrEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
            />
            <input
              type="text"
              required
              placeholder="Initial Password"
              value={newHrPassword}
              onChange={e => setNewHrPassword(e.target.value)}
              className="w-40 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono"
            />
            <select
              value={newHrRole}
              onChange={e => setNewHrRole(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold"
            >
              <option value="HR">HR Role</option>
              <option value="ADMIN">ADMIN Role</option>
            </select>
            <button
              type="submit"
              disabled={creatingUser}
              className="px-4 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm"
            >
              {creatingUser ? 'Creating...' : 'Provision User Account'}
            </button>
          </form>

          {/* Users Table */}
          <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">User Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Linked Employee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Lock / Unlock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {usersList.map(u => (
                  <tr key={u.id}>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white font-mono">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                        u.role === 'ADMIN' ? 'bg-[#D6B46A]/20 text-[#D6B46A]' :
                        u.role === 'HR' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {u.first_name ? `${u.first_name} ${u.last_name} (${u.employee_code})` : 'System Account'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[11px] font-medium ${u.is_active ? 'text-emerald-500' : 'text-red-400'}`}>
                        {u.is_active ? 'Active' : 'Locked'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.is_active === 1)}
                          className={`text-xs px-2.5 py-1 rounded ${
                            u.is_active
                              ? 'text-red-400 hover:bg-red-500/10'
                              : 'text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
