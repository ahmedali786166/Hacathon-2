/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarOff,
  Banknote,
  Bot,
  BellRing,
  Building2,
  ShieldCheck,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ currentTab, onSelectTab, collapsed, onToggleCollapse }: SidebarProps) {
  const { user, company, logout } = useAuth();
  const role = user?.role || 'EMPLOYEE';

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'HR', 'EMPLOYEE']
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: Users,
      roles: ['ADMIN', 'HR']
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: CalendarCheck,
      roles: ['ADMIN', 'HR', 'EMPLOYEE']
    },
    {
      id: 'leaves',
      label: 'Leave Portal',
      icon: CalendarOff,
      roles: ['ADMIN', 'HR', 'EMPLOYEE']
    },
    {
      id: 'payroll',
      label: role === 'EMPLOYEE' ? 'My Payslips' : 'Payroll Engine',
      icon: Banknote,
      roles: ['ADMIN', 'HR', 'EMPLOYEE']
    },
    {
      id: 'ai-assistant',
      label: 'AI HR Assistant',
      icon: Bot,
      highlight: true,
      roles: ['ADMIN', 'HR', 'EMPLOYEE']
    },
    {
      id: 'organization',
      label: 'Organization',
      icon: Building2,
      roles: ['ADMIN', 'HR']
    },
    {
      id: 'communications',
      label: 'Announcements',
      icon: BellRing,
      roles: ['ADMIN', 'HR', 'EMPLOYEE']
    },
    {
      id: 'audit-logs',
      label: 'Audit Vault',
      icon: ShieldCheck,
      roles: ['ADMIN']
    },
    {
      id: 'profile',
      label: 'Profile & Security',
      icon: UserCheck,
      roles: ['ADMIN', 'HR', 'EMPLOYEE']
    }
  ];

  const allowedNav = navItems.filter(item => item.roles.includes(role));

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col transition-all duration-300 ease-in-out border-r ${
        collapsed ? 'w-20' : 'w-64'
      } bg-[#0B1120] text-slate-300 border-white/5 select-none`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
        {!collapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D6B46A] to-[#997732] flex items-center justify-center text-[#0B1120] font-extrabold text-base shadow-sm shrink-0">
              {company?.company_code?.slice(0, 2) || 'HC'}
            </div>
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold tracking-tight text-white whitespace-nowrap truncate">
                {company?.company_name || 'HCM Lite'}
              </h1>
              <p className="text-[11px] font-medium text-[#D6B46A] tracking-wider whitespace-nowrap truncate uppercase">
                Enterprise Cloud
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-9 h-9 rounded-lg bg-gradient-to-br from-[#D6B46A] to-[#997732] flex items-center justify-center text-[#0B1120] font-extrabold text-base shadow-sm shrink-0">
            {company?.company_code?.slice(0, 2) || 'HC'}
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Role Indicator Banner */}
      {!collapsed && (
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-xs">
          <span className="text-slate-400">Current Scope:</span>
          <span
            className={`font-semibold tracking-wide ${
              role === 'ADMIN'
                ? 'text-[#D6B46A]'
                : role === 'HR'
                ? 'text-emerald-400'
                : 'text-sky-400'
            }`}
          >
            {role}
          </span>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {allowedNav.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-white/10 to-white/5 text-white border-l-2 border-[#D6B46A] shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                size={18}
                className={`shrink-0 transition-colors ${
                  isActive
                    ? 'text-[#D6B46A]'
                    : item.highlight
                    ? 'text-[#D6B46A]'
                    : 'text-slate-400 group-hover:text-white'
                }`}
              />

              {!collapsed && (
                <span className="truncate whitespace-nowrap flex-1 text-left flex items-center justify-between">
                  <span>{item.label}</span>
                  {item.highlight && (
                    <Sparkles size={13} className="text-[#D6B46A] shrink-0" />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer User Info & Sign Out */}
      <div className="p-3 border-t border-white/5">
        {!collapsed ? (
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]">
            <div className="overflow-hidden mr-2">
              <p className="text-xs font-semibold text-white truncate">{user?.name || user?.email}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center p-2 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}
