/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Sun,
  Moon,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import type { NotificationItem } from '../../types/index.ts';

interface TopHeaderProps {
  currentTab: string;
  onNavigateTab: (tab: string) => void;
  collapsed: boolean;
}

export function TopHeader({ currentTab, onNavigateTab, collapsed }: TopHeaderProps) {
  const { user, theme, toggleTheme } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [todayAttendance, setTodayAttendance] = useState<{ checkedIn: boolean; checkedOut: boolean; record: any } | null>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch notifications and attendance status
  const loadHeaderData = async () => {
    try {
      const notifs = await api.getNotifications();
      setNotifications(notifs);

      if (user?.role === 'EMPLOYEE' || user?.employeeId) {
        const att = await api.getTodayAttendance();
        setTodayAttendance(att);
      }
    } catch {
      // Quiet fallback
    }
  };

  useEffect(() => {
    loadHeaderData();
    const interval = setInterval(loadHeaderData, 20000);
    return () => clearInterval(interval);
  }, [user]);

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  const getBreadcrumbTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Executive Overview';
      case 'employees': return 'Employee Directory & 360 Profiles';
      case 'attendance': return 'Automated Attendance & Time Tracking';
      case 'leaves': return 'Leave Management & Smart Leave AI';
      case 'payroll': return user?.role === 'EMPLOYEE' ? 'My Official Payslips' : 'Salary Engine & Pakistan Tax Compliance';
      case 'ai-assistant': return 'AI HR Executive Assistant';
      case 'organization': return 'Organization Settings & Master Configuration';
      case 'communications': return 'Company Bulletins & Announcements';
      case 'audit-logs': return 'Immutable Security Audit Vault';
      case 'profile': return 'User Profile & Security Invariants';
      default: return 'Human Capital Management';
    }
  };

  return (
    <header
      className={`fixed top-0 right-0 z-20 h-16 transition-all duration-300 border-b flex items-center justify-between px-6 ${
        collapsed ? 'left-20' : 'left-64'
      } bg-white dark:bg-[#0B1120] border-slate-200 dark:border-white/5 backdrop-blur-md`}
    >
      {/* Zone 1: Contextual Breadcrumb Trail */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">HCM Lite</span>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <span className="font-medium text-slate-800 dark:text-slate-200">
          {getBreadcrumbTitle(currentTab)}
        </span>
      </div>

      {/* Zone 2: Live Server Time & Quick Attendance Status */}
      <div className="hidden lg:flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.03] px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-white/5 tabular-nums">
          <Clock size={14} className="text-[#D6B46A]" />
          <span>{currentTime}</span>
        </div>

        {user?.role === 'EMPLOYEE' && (
          <button
            onClick={() => onNavigateTab('attendance')}
            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
              todayAttendance?.checkedOut
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : todayAttendance?.checkedIn
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                : 'bg-[#D6B46A]/10 text-[#D6B46A] border-[#D6B46A]/30 hover:bg-[#D6B46A]/20'
            }`}
          >
            <CheckCircle size={14} />
            <span>
              {todayAttendance?.checkedOut
                ? 'Checked Out'
                : todayAttendance?.checkedIn
                ? `Checked In (${todayAttendance.record?.check_in_time?.slice(0, 5)})`
                : 'Check In Required'}
            </span>
          </button>
        )}
      </div>

      {/* Zone 3: Controls - Notifications, Theme Toggle, Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#D6B46A] text-[#0B1120] text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-[#D6B46A] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02] ${
                        n.is_read === 0 ? 'bg-slate-50/50 dark:bg-white/[0.03]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{n.title}</p>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                      {n.link && (
                        <button
                          onClick={() => {
                            setShowNotifications(false);
                            onNavigateTab(n.link!.replace('/', ''));
                          }}
                          className="mt-1.5 flex items-center gap-1 text-[11px] text-[#D6B46A] font-medium"
                        >
                          <span>View Details</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} className="text-[#D6B46A]" /> : <Moon size={18} />}
        </button>

        {/* User Avatar & Role */}
        <button
          onClick={() => onNavigateTab('profile')}
          className="flex items-center gap-2.5 pl-2 py-1 pr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0B1120] to-[#1E293B] border border-[#D6B46A]/40 flex items-center justify-center text-xs font-bold text-[#D6B46A]">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="hidden sm:block text-left text-xs">
            <p className="font-medium text-slate-800 dark:text-white leading-tight truncate max-w-[120px]">
              {user?.name || user?.email}
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{user?.role}</p>
          </div>
        </button>
      </div>
    </header>
  );
}
