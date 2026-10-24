/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import { executeTool, withTimeout } from '../services/aiService.ts';
import type { AuthUser } from '../middleware/auth.ts';

async function runAiTests() {
  console.log('--- RUNNING AI ASSISTANT & TOOL CALLING TESTS ---');

  const adminUser: AuthUser = {
    id: 'test-admin',
    email: 'admin@hcmlite.test',
    role: 'ADMIN',
    employeeId: null,
    mustChangePassword: false
  };

  const employeeUser: AuthUser = {
    id: 'test-emp',
    email: 'emp@hcmlite.test',
    role: 'EMPLOYEE',
    employeeId: null,
    mustChangePassword: false
  };

  // 1. Role scoping test: Headcount tool restricted for EMPLOYEE
  const empHeadcountResult = await executeTool('get_headcount', {}, employeeUser);
  assert.ok(empHeadcountResult.error, 'EMPLOYEE should not have access to headcount');
  assert.match(empHeadcountResult.error, /Permission denied/i);
  console.log('[PASS] Tool role scoping: Employee cannot access headcount');

  // 2. Role scoping test: Attendance summary restricted for EMPLOYEE
  const empAttResult = await executeTool('get_attendance_summary', {}, employeeUser);
  assert.ok(empAttResult.error, 'EMPLOYEE should not have access to attendance summary');
  console.log('[PASS] Tool role scoping: Employee cannot access team attendance summary');

  // 3. Role scoping test: Payroll summary restricted for EMPLOYEE
  const empPayrollResult = await executeTool('get_payroll_summary', { month: 1, year: 2026 }, employeeUser);
  assert.ok(empPayrollResult.error, 'EMPLOYEE should not have access to payroll summary');
  console.log('[PASS] Tool role scoping: Employee cannot access payroll summary');

  // 4. Admin tool execution: Headcount succeeds
  const t0 = Date.now();
  const adminHeadcountResult = await executeTool('get_headcount', {}, adminUser);
  const headcountDuration = Date.now() - t0;
  assert.ok(typeof adminHeadcountResult.total === 'number');
  assert.ok(typeof adminHeadcountResult.active === 'number');
  assert.ok(headcountDuration < 50, `Headcount query took ${headcountDuration}ms, should be < 50ms`);
  console.log(`[PASS] Admin tool execution: Headcount successfully returns in ${headcountDuration}ms`);

  // 5. Admin tool execution: Attendance summary succeeds
  const t1 = Date.now();
  const adminAttResult = await executeTool('get_attendance_summary', {}, adminUser);
  const attDuration = Date.now() - t1;
  assert.ok(typeof adminAttResult.totalEmployees === 'number');
  assert.ok(attDuration < 50, `Attendance summary query took ${attDuration}ms, should be < 50ms`);
  console.log(`[PASS] Admin tool execution: Attendance summary executes cleanly in ${attDuration}ms`);

  // 6. Admin tool execution: Leave summary succeeds
  const t2 = Date.now();
  const adminLeaveResult = await executeTool('get_leave_summary', {}, adminUser);
  const leaveDuration = Date.now() - t2;
  assert.ok(typeof adminLeaveResult.onLeaveCount === 'number');
  assert.ok(Array.isArray(adminLeaveResult.employeesOnLeave));
  assert.ok(leaveDuration < 50, `Leave summary query took ${leaveDuration}ms, should be < 50ms`);
  console.log(`[PASS] Admin tool execution: Leave summary executes cleanly in ${leaveDuration}ms`);

  // 7. Admin tool execution: Late comers succeeds
  const adminLateResult = await executeTool('get_late_comers', {}, adminUser);
  assert.ok(typeof adminLateResult.lateCount === 'number');
  assert.ok(Array.isArray(adminLateResult.lateEmployees));
  console.log('[PASS] Admin tool execution: Late comers query executes cleanly');

  // 8. Fast-path intent matching tests
  const { tryFastPathToolMatch, askAssistant } = await import('../services/aiService.ts');
  assert.strictEqual(tryFastPathToolMatch('Who is on leave today?')?.tool, 'get_leave_summary');
  assert.strictEqual(tryFastPathToolMatch('Summarize today\'s attendance roster')?.tool, 'get_attendance_summary');
  assert.strictEqual(tryFastPathToolMatch('What is our headcount?')?.tool, 'get_headcount');
  assert.strictEqual(tryFastPathToolMatch('How many employees are late today?')?.tool, 'get_late_comers');
  assert.strictEqual(tryFastPathToolMatch('What is my remaining leave balance?')?.tool, 'get_my_leave_balance');
  console.log('[PASS] Fast-path matcher recognizes all standard prompts correctly');

  // 9. Instant response timing via askAssistant
  const tFast = Date.now();
  const fastRes = await askAssistant(adminUser, 'Who is on leave today?');
  const fastElapsed = Date.now() - tFast;
  assert.ok(fastRes.text.includes('Leave Summary'));
  assert.strictEqual(fastRes.toolsCalled[0], 'get_leave_summary');
  assert.ok(fastElapsed < 50, `Fast path took ${fastElapsed}ms, expected < 50ms`);
  console.log(`[PASS] Fast-path end-to-end response delivered in ${fastElapsed}ms (instant)`);

  // 10. Timeout utility test
  const fastPromise = new Promise(resolve => setTimeout(() => resolve('fast'), 50));
  const fastResult = await withTimeout(fastPromise, 500);
  assert.strictEqual(fastResult, 'fast');
  console.log('[PASS] withTimeout utility allows fast requests to succeed');

  let timeoutCaught = false;
  try {
    const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 300));
    await withTimeout(slowPromise, 50);
  } catch (err: any) {
    timeoutCaught = true;
    assert.ok(err.isTimeout);
  }
  assert.ok(timeoutCaught, 'Timeout should have been caught');
  console.log('[PASS] withTimeout utility cleanly rejects slow promises with isTimeout flag');

  console.log('ALL AI ASSISTANT TESTS PASSED!');
}

runAiTests().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
