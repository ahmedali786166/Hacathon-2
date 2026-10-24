/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Pin,
  Plus,
  Send,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { Announcement, NotificationItem, AuditLogItem } from '../types/index.ts';

export function CommunicationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'HR';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'announcements' | 'notifications' | 'audit'>('announcements');

  // New Announcement Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'HR' | 'EMPLOYEE'>('ALL');
  const [isPinned, setIsPinned] = useState(false);
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Audit filters
  const [auditFilterAction, setAuditFilterAction] = useState('');

  const loadData = async () => {
    try {
      const [anns, notifs] = await Promise.all([
        api.getAnnouncements(),
        api.getNotifications()
      ]);
      setAnnouncements(anns);
      setNotifications(notifs);

      if (isAdmin) {
        const logs = await api.getAuditLogs({ action: auditFilterAction || undefined });
        setAuditLogs(logs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, auditFilterAction]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    try {
      setCreating(true);
      await api.createAnnouncement({
        title,
        content,
        target_audience: audience,
        is_pinned: isPinned
      });
      setShowCreateModal(false);
      setTitle('');
      setContent('');
      setSuccessMsg('Announcement published successfully.');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BellRing size={20} className="text-[#D6B46A]" />
            <span>Communications & Bulletins</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Official Broadcast Channel</span>
            <span>·</span>
            <span>Audience Targeted Notices</span>
          </div>
        </div>

        {isPrivileged && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm transition-all"
          >
            <Plus size={15} />
            <span>New Announcement</span>
          </button>
        )}
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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-3.5 py-2 font-medium rounded-lg transition-colors ${
            activeTab === 'announcements'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Announcements ({announcements.length})
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-3.5 py-2 font-medium rounded-lg transition-colors ${
            activeTab === 'notifications'
              ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          My In-App Alerts ({notifications.length})
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 font-medium rounded-lg transition-colors ${
              activeTab === 'audit'
                ? 'bg-[#D6B46A] text-[#0B1120] font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Immutable Audit Trail ({auditLogs.length})
          </button>
        )}
      </div>

      {/* 1. ANNOUNCEMENTS TAB */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-[#131D31] rounded-2xl border border-slate-200 dark:border-white/5">
              No active bulletins published yet.
            </div>
          ) : (
            announcements.map(ann => (
              <div
                key={ann.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 shadow-sm space-y-2 relative"
              >
                {ann.is_pinned === 1 && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 text-[11px] font-semibold text-[#D6B46A]">
                    <Pin size={13} />
                    <span>PINNED</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Audience: {ann.target_audience}</span>
                  <span>·</span>
                  <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>By {ann.author_email || 'HR Management'}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ann.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {ann.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-white/5">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No notifications on record.
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{n.title}</div>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded font-mono ${
                  n.is_read ? 'text-slate-400 bg-slate-100 dark:bg-white/5' : 'text-[#D6B46A] bg-[#D6B46A]/10'
                }`}>
                  {n.is_read ? 'READ' : 'UNREAD'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. AUDIT LOGS TAB (ADMIN ONLY) */}
      {activeTab === 'audit' && isAdmin && (
        <div className="bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#D6B46A]" />
              <span>Immutable System Audit Log</span>
            </h3>
            <span className="text-xs text-slate-400">Total Entries: {auditLogs.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono text-[11px]">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                      {log.created_at}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-800 dark:text-white">{log.actor_email}</span>
                      <span className="text-[10px] text-[#D6B46A] ml-1">({log.actor_role})</span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {log.entity_type} {log.entity_id ? `· ${log.entity_id.slice(0, 8)}` : ''}
                    </td>
                    <td className="py-2.5 px-4 max-w-xs truncate text-slate-400 font-sans">
                      {log.after_value || log.before_value || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE ANNOUNCEMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BellRing size={16} className="text-[#D6B46A]" />
                <span>Publish Company Announcement</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Headline / Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Ramadan Working Hours & Payroll Cutoff"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Audience Targeting</label>
                <select
                  value={audience}
                  onChange={e => setAudience(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                >
                  <option value="ALL">All Company Employees & Staff</option>
                  <option value="EMPLOYEE">Employees Only</option>
                  <option value="HR">HR Team Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notice Content *</label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Detailed announcement prose..."
                  className="w-full p-3 bg-slate-50 dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={e => setIsPinned(e.target.checked)}
                  className="rounded text-[#D6B46A]"
                />
                <span>Pin this bulletin to the top of employee dashboards</span>
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-xs font-bold bg-[#D6B46A] hover:bg-[#E5C57E] text-[#0B1120] rounded-lg shadow-sm"
                >
                  {creating ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
