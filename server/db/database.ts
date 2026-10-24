/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { DB_SCHEMA } from './schema.ts';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'hcm_lite.db');
export const db = new DatabaseSync(DB_PATH);

// Initialize schema and pragmas
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(DB_SCHEMA);

console.log('[Database] SQLite initialized at', DB_PATH);

export interface QueryHelpers {
  queryAll<T = any>(sql: string, params?: (string | number | null | undefined)[]): T[];
  queryOne<T = any>(sql: string, params?: (string | number | null | undefined)[]): T | null;
  run(sql: string, params?: (string | number | null | undefined)[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  transaction<T>(fn: () => T): T;
}

export const dbHelper: QueryHelpers = {
  queryAll<T = any>(sql: string, params: (string | number | null | undefined)[] = []): T[] {
    const cleanParams = params.map(p => (p === undefined ? null : p));
    const stmt = db.prepare(sql);
    return stmt.all(...cleanParams) as T[];
  },

  queryOne<T = any>(sql: string, params: (string | number | null | undefined)[] = []): T | null {
    const cleanParams = params.map(p => (p === undefined ? null : p));
    const stmt = db.prepare(sql);
    const result = stmt.get(...cleanParams);
    return (result as T) || null;
  },

  run(sql: string, params: (string | number | null | undefined)[] = []) {
    const cleanParams = params.map(p => (p === undefined ? null : p));
    const stmt = db.prepare(sql);
    return stmt.run(...cleanParams);
  },

  transaction<T>(fn: () => T): T {
    db.exec('BEGIN TRANSACTION;');
    try {
      const res = fn();
      db.exec('COMMIT;');
      return res;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
};
