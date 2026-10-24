/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import { dbHelper } from '../db/database.ts';

export interface NotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION_REQUIRED';
  link?: string;
}

export function createNotification(params: NotificationParams) {
  try {
    const id = crypto.randomUUID();
    dbHelper.run(
      `INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
      [id, params.userId, params.title, params.message, params.type || 'INFO', params.link || null]
    );
    return id;
  } catch (err) {
    console.error('[NotificationService] Error creating notification:', err);
    return null;
  }
}

export function notifyRole(role: 'ADMIN' | 'HR', title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION_REQUIRED' = 'INFO', link?: string) {
  const users = dbHelper.queryAll<{ id: string }>('SELECT id FROM users WHERE role = ? AND is_active = 1', [role]);
  for (const u of users) {
    createNotification({
      userId: u.id,
      title,
      message,
      type,
      link
    });
  }
}

export function getUserNotifications(userId: string, unreadOnly: boolean = false) {
  let sql = 'SELECT * FROM notifications WHERE user_id = ?';
  const params: any[] = [userId];
  if (unreadOnly) {
    sql += ' AND is_read = 0';
  }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  return dbHelper.queryAll(sql, params);
}

export function markAsRead(notificationId: string, userId: string) {
  return dbHelper.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notificationId, userId]);
}

export function markAllAsRead(userId: string) {
  return dbHelper.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
}
