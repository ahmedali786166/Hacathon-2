/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import { dbHelper } from '../db/database.ts';
import type { AuthUser } from '../middleware/auth.ts';

export interface AuditParams {
  actor: AuthUser;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeValue?: any;
  afterValue?: any;
  ipAddress?: string;
}

export function logAudit(params: AuditParams): void {
  try {
    const id = crypto.randomUUID();
    const beforeStr = params.beforeValue !== undefined ? JSON.stringify(params.beforeValue) : null;
    const afterStr = params.afterValue !== undefined ? JSON.stringify(params.afterValue) : null;

    dbHelper.run(
      `INSERT INTO audit_logs (id, actor_id, actor_email, actor_role, action, entity_type, entity_id, before_value, after_value, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        params.actor.id,
        params.actor.email,
        params.actor.role,
        params.action,
        params.entityType,
        params.entityId || null,
        beforeStr,
        afterStr,
        params.ipAddress || null
      ]
    );
  } catch (err) {
    console.error('[AuditService] Failed to record audit log:', err);
  }
}

export function getAuditLogs(filters?: { entityType?: string; action?: string; limit?: number; offset?: number }) {
  const limit = filters?.limit || 100;
  const offset = filters?.offset || 0;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];

  if (filters?.entityType) {
    sql += ' AND entity_type = ?';
    params.push(filters.entityType);
  }

  if (filters?.action) {
    sql += ' AND action = ?';
    params.push(filters.action);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return dbHelper.queryAll(sql, params);
}
