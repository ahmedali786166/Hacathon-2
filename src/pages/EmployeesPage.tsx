/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Eye,
  Edit2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { Employee, Department, Designation } from '../types/index.ts';

interface EmployeesPageProps {
  onViewEmployee360: (employeeId: string) => void;
}

export function EmployeesPage({ onViewEmployee360 }: EmployeesPageProps) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    designation_id: '',
    join_date: new Date().toISOString().split('T')[0],
    basic_salary: 100000,
    createUserAccount: true,
    temporaryPassword: 'Saylani@2026'
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.getEmployees({
        search: search || undefined,
        department_id: selectedDept || undefined,
        status: selectedStatus || undefined
      });
      setEmployees(res.rows);
      setTotal(res.total);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = async () => {
    try {
      const [depts, desigs] = await Promise.all([
        api.getDepartments(),
        api.getDesignations()
      ]);
      const activeDepts = (depts || []).filter(d => d.is_active !== 0);
      const activeDesigs = (desigs || []).filter(d => d.is_active !== 0);
      setDepartments(activeDepts);
      setDesignations(activeDesigs);

      if (activeDepts.length > 0) {
        setFormData(prev => {
          const currentDeptValid = activeDepts.some(d => d.id === prev.department_id);
          const deptId = currentDeptValid ? prev.department_id : activeDepts[0].id;
          const matchingDesigs = activeDesigs.filter(d => d.department_id === deptId);
          const desigId = matchingDesigs.some(d => d.id === prev.designation_id)
            ? prev.designation_id
            : (matchingDesigs[0]?.id || activeDesigs[0]?.id || '');

          return {
            ...prev,
            department_id: deptId,
            designation_id: desigId
          };
        });
      }
    } catch (err) {
      console.error('[EmployeesPage] Failed to load organization masters:', err);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedDept, selectedStatus]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.createEmployee(formData);
      setShowAddModal(false);
      setActionSuccess(`Employee ${formData.employee_code} registered successfully.`);
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create employee.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    setFormError(null);
    try {
      await api.updateEmployee(editingEmp.id, editingEmp);
      setShowEditModal(false);
      setActionSuccess(`Employee updated successfully.`);
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update employee.');
    }
  };

  const handleCreateAccount = async (empId: string) => {
    try {
      const res = await api.createEmployeeAccount(empId);
      setActionSuccess(`Account created for ${res.email}. Temporary password: ${res.temporaryPassword}`);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // CSV Import Handlers
  const handleParseCsv = (rawText: string) => {
    const lines = rawText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const currentline = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (currentline.length < 5) continue;
      const obj: any = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j].toLowerCase().replace(/\s+/g, '_');
        obj[key] = currentline[j];
      }
      rows.push(obj);
    }
    return rows;
  };

  const handleRunDryRun = async () => {
    const parsed = handleParseCsv(csvText);
    if (parsed.length === 0) {
      alert('Please provide valid CSV content with a header row.');
      return;
    }
    try {
      setImporting(true);
      const res = await api.importEmployeesCsv(parsed, true);
      setDryRunResult(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    const parsed = handleParseCsv(csvText);
    try {
      setImporting(true);
      const res = await api.importEmployeesCsv(parsed, false);
      setShowImportModal(false);
      setActionSuccess(`Successfully imported ${res.importedCount} employee records.`);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const deptDesignations = designations.filter(d => !formData.department_id || d.department_id === formData.department_id);
  const filteredDesignations = deptDesignations.length > 0 ? deptDesignations : designations;

  return (
    <div className="space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users size={20} className="text-[#D6B46A]" />
            <span>Employee Directory</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Total Records: {total}</span>
            <span>·</span>
            <span>Active Roster</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <a
            href="/api/employees/csv/export"
            download
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-[#131D31] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-lg transition-colors"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => {
              setDryRunResult(null);
              setCsvText(
                'employee_code,first_name,last_name,email,phone,department_code,designation_code,join_date,basic_salary\n' +
                'EMP-101,Ahmed,Ali,ahmed.ali@example.com,03001234567,ENG,SWE,2026-01-15,120000\n' +
                'EMP-102,Sara,Khan,sara.khan@example.com,03219876543,HR,HRM,2026-02-01,150000'
              );
              setShowImportModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-[#131D31] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-lg transition-colors"
          >
            <FileSpreadsheet size={14} />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => {
              setFormError(null);
              loadMasters();
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gradient-to-r from-[#D6B46A] to-[#B39045] hover:from-[#E5C57E] hover:to-[#C5A059] text-[#0B1120] rounded-lg shadow-sm transition-all"
          >
            <UserPlus size={15} />
            <span>Register Employee</span>
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

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee name, ID, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#D6B46A]"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#D6B46A]"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>
      </div>

      {/* Employees Directory Table */}
      <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
            Loading employee records...
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <Users size={32} className="mx-auto text-slate-400/50 mb-3" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No employee records found.</p>
            <p className="mt-1">Click "Register Employee" to add the first real team member.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4">Status</th>
                  {(user?.role === 'ADMIN' || user?.role === 'HR') && (
                    <th className="py-3 px-4 text-right">Basic Salary</th>
                  )}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-slate-700 dark:text-[#D6B46A]">
                          {emp.first_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {emp.first_name} {emp.last_name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                            <span>{emp.employee_code}</span>
                            <span>·</span>
                            <span>{emp.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {emp.department_name || 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {emp.designation_name || 'Staff'}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {emp.join_date}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        emp.employment_status === 'ACTIVE'
                          ? 'text-emerald-500'
                          : 'text-slate-400'
                      }`}>
                        <span>·</span>
                        <span>{emp.employment_status}</span>
                      </span>
                    </td>

                    {(user?.role === 'ADMIN' || user?.role === 'HR') && (
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        PKR {Number(emp.basic_salary || 0).toLocaleString()}
                      </td>
                    )}

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewEmployee360(emp.id)}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-white"
                          title="View 360 Profile"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          onClick={() => {
                            setEditingEmp(emp);
                            setFormError(null);
                            loadMasters();
                            setShowEditModal(true);
                          }}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-white"
                          title="Edit Details"
                        >
                          <Edit2 size={15} />
                        </button>

                        {!emp.user_id && (
                          <button
                            onClick={() => handleCreateAccount(emp.id)}
                            className="p-1.5 rounded hover:bg-[#D6B46A]/20 text-[#D6B46A]"
                            title="Generate User Login Credentials"
                          >
                            <KeyRound size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus size={16} className="text-[#D6B46A]" />
                <span>Register New Employee</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Employee Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.employee_code}
                    onChange={e => setFormData({ ...formData, employee_code: e.target.value.toUpperCase() })}
                    placeholder="e.g. EMP-001"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="employee@company.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="First Name"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Last Name"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Department *</label>
                    {departments.length === 0 && (
                      <span className="text-[10px] text-amber-500 font-medium">No departments found</span>
                    )}
                  </div>
                  <select
                    required
                    value={formData.department_id}
                    onChange={e => {
                      const newDeptId = e.target.value;
                      const matchingDesigs = designations.filter(d => d.department_id === newDeptId);
                      setFormData({
                        ...formData,
                        department_id: newDeptId,
                        designation_id: matchingDesigs.length > 0 ? matchingDesigs[0].id : (designations[0]?.id || '')
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Designation *</label>
                    {filteredDesignations.length === 0 && (
                      <span className="text-[10px] text-amber-500 font-medium">No designations found</span>
                    )}
                  </div>
                  <select
                    required
                    value={formData.designation_id}
                    onChange={e => setFormData({ ...formData, designation_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  >
                    <option value="">Select Designation</option>
                    {filteredDesignations.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.department_name ? `(${d.department_name})` : `(${d.code})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={formData.join_date}
                    onChange={e => setFormData({ ...formData, join_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Basic Monthly Salary (PKR) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.basic_salary}
                    onChange={e => setFormData({ ...formData, basic_salary: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  />
                  <span className="text-[10px] text-slate-400">Gross: PKR {Math.round(formData.basic_salary * 1.5).toLocaleString()}</span>
                </div>
              </div>

              {/* User Account Login Generation Checkbox */}
              <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-900 dark:text-white">
                  <input
                    type="checkbox"
                    checked={formData.createUserAccount}
                    onChange={e => setFormData({ ...formData, createUserAccount: e.target.checked })}
                    className="rounded text-[#D6B46A] focus:ring-[#D6B46A]"
                  />
                  <span>Create User Login Credentials for Web App Access</span>
                </label>
                {formData.createUserAccount && (
                  <div className="pl-6">
                    <label className="block text-[11px] text-slate-400 mb-1">Temporary Initial Password</label>
                    <input
                      type="text"
                      value={formData.temporaryPassword}
                      onChange={e => setFormData({ ...formData, temporaryPassword: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded text-xs text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      User will be required to change their temporary password at first sign-in.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm transition-all"
                >
                  Register Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {showEditModal && editingEmp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Employee: {editingEmp.employee_code}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">First Name</label>
                  <input
                    type="text"
                    value={editingEmp.first_name}
                    onChange={e => setEditingEmp({ ...editingEmp, first_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editingEmp.last_name}
                    onChange={e => setEditingEmp({ ...editingEmp, last_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={editingEmp.employment_status}
                    onChange={e => setEditingEmp({ ...editingEmp, employment_status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select
                    value={editingEmp.department_id || ''}
                    onChange={e => {
                      const newDeptId = e.target.value;
                      const matchingDesigs = designations.filter(d => d.department_id === newDeptId);
                      setEditingEmp({
                        ...editingEmp,
                        department_id: newDeptId,
                        designation_id: matchingDesigs.length > 0 ? matchingDesigs[0].id : editingEmp.designation_id
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                  <select
                    value={editingEmp.designation_id || ''}
                    onChange={e => setEditingEmp({ ...editingEmp, designation_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D6B46A]"
                  >
                    <option value="">Select Designation</option>
                    {(designations.filter(d => !editingEmp.department_id || d.department_id === editingEmp.department_id).length > 0
                      ? designations.filter(d => !editingEmp.department_id || d.department_id === editingEmp.department_id)
                      : designations
                    ).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.department_name ? `(${d.department_name})` : `(${d.code})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Basic Monthly Salary (PKR)</label>
                  <input
                    type="number"
                    value={editingEmp.basic_salary || 0}
                    onChange={e => setEditingEmp({ ...editingEmp, basic_salary: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-[#D6B46A] text-[#0B1120] rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL WITH DRY-RUN PREVIEW */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-[#D6B46A]" />
                <span>Bulk Employee CSV Import & Dry-Run Validation</span>
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Paste your CSV content below. You can run a dry-run validation to preview duplicate checks and row errors before final confirmation.
            </p>

            <textarea
              rows={6}
              value={csvText}
              onChange={e => {
                setCsvText(e.target.value);
                setDryRunResult(null);
              }}
              className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#D6B46A]"
            />

            {/* Dry Run Preview Section */}
            {dryRunResult && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">Dry-Run Audit Summary:</span>
                  <div className="flex gap-3">
                    <span className="text-emerald-500 font-semibold">{dryRunResult.validCount} Valid Rows</span>
                    <span className="text-red-400 font-semibold">{dryRunResult.invalidCount} Error Rows</span>
                  </div>
                </div>

                {dryRunResult.errors?.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-red-400">
                    {dryRunResult.errors.map((err: any, idx: number) => (
                      <div key={idx}>Row {err.row}: {err.error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-between items-center">
              <button
                type="button"
                onClick={handleRunDryRun}
                disabled={importing}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-lg transition-colors"
              >
                {importing ? 'Validating...' : 'Run Dry-Run Audit'}
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importing || (dryRunResult && dryRunResult.validCount === 0)}
                  className="px-5 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  Confirm & Import Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
