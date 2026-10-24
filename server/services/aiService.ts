/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import { dbHelper } from '../db/database.ts';
import { getCompanySettings } from './organizationService.ts';
import { getServerDateTime, getAttendanceDailyReport } from './attendanceService.ts';
import { getLeaveBalances } from './leaveService.ts';
import type { AuthUser } from '../middleware/auth.ts';

// Server-side initialization with recommended User-Agent
let cachedApiKey: string | null = null;
let aiClient: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    aiClient = null;
    cachedApiKey = null;
    return null;
  }
  if (aiClient && cachedApiKey === apiKey) {
    return aiClient;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    cachedApiKey = apiKey;
    return aiClient;
  } catch (err) {
    console.error('[AI Service] Failed to initialize GoogleGenAI client:', err);
    return null;
  }
}

// Timeout utility (15 seconds max)
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000,
  errorMsg: string = 'The AI assistant request timed out after 15 seconds.'
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(errorMsg);
      err.isTimeout = true;
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// User Rate limiting: ~25 calls per user per hour
export function checkRateLimit(userId: string): boolean {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const count = dbHelper.queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM ai_logs WHERE user_id = ? AND created_at > ?",
    [userId, oneHourAgo]
  )?.count || 0;
  return count < 30;
}

// Strict allowlist function declarations
const declarations: FunctionDeclaration[] = [
  {
    name: 'get_headcount',
    description: 'Get total and active employee headcount broken down by department. Available to HR and Admin roles.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'get_attendance_summary',
    description: 'Get overall attendance statistics for a given date (defaults to today) including present, late, absent, and on-leave counts. Available to HR and Admin roles.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: 'Date in YYYY-MM-DD format (optional, defaults to current date)'
        }
      }
    }
  },
  {
    name: 'get_late_comers',
    description: 'Get a list of employees who checked in late today or on a specific date. Available to HR and Admin roles.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: 'Date in YYYY-MM-DD format (optional)'
        }
      }
    }
  },
  {
    name: 'get_leave_summary',
    description: 'Get list of employees currently on approved leave today or pending leave approvals. Available to HR and Admin roles.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'get_my_leave_balance',
    description: 'Get the currently logged-in employee personal leave balance (Annual, Sick, Casual, etc.). Available to any authenticated user.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'get_payroll_summary',
    description: 'Get payroll summary (gross, deductions, tax, net) for a specified month/year. Strictly RESTRICTED to Admin and HR roles only.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: { type: Type.INTEGER, description: 'Month number (1-12)' },
        year: { type: Type.INTEGER, description: 'Year e.g. 2026' }
      }
    }
  },
  {
    name: 'search_employees',
    description: 'Search employees by name, department, or job title. Returns public directory details only. Available to all authenticated users. Never reveals confidential salary or banking information.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search term for name or title' }
      },
      required: ['query']
    }
  }
];

// Authenticated Tool Executor enforcing strict RBAC & data scope
export async function executeTool(name: string, args: any, user: AuthUser): Promise<any> {
  const isPrivileged = user.role === 'ADMIN' || user.role === 'HR';
  const { dateStr } = getServerDateTime();

  switch (name) {
    case 'get_headcount': {
      if (!isPrivileged) {
        return { error: 'Permission denied: headcount analytics are restricted to HR and Admin.' };
      }
      const total = dbHelper.queryOne<any>(
        `SELECT COUNT(*) as total,
                COALESCE(SUM(CASE WHEN employment_status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as active
         FROM employees`
      );
      const byDept = dbHelper.queryAll<any>(
        `SELECT dept.name as department, COUNT(e.id) as count
         FROM departments dept
         LEFT JOIN employees e ON e.department_id = dept.id AND e.employment_status = 'ACTIVE'
         GROUP BY dept.id ORDER BY count DESC`
      );
      return { total: total?.total || 0, active: total?.active || 0, byDepartment: byDept };
    }

    case 'get_attendance_summary': {
      if (!isPrivileged) {
        return { error: 'Permission denied: overall attendance reports are restricted to HR and Admin.' };
      }
      const targetDate = args?.date || dateStr;
      const totalActive = dbHelper.queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM employees WHERE employment_status = 'ACTIVE'"
      )?.count || 0;

      const statusRows = dbHelper.queryAll<{ status: string; count: number }>(
        "SELECT status, COUNT(*) as count FROM attendance WHERE date = ? GROUP BY status",
        [targetDate]
      );
      const counts: Record<string, number> = {};
      for (const row of statusRows) {
        counts[row.status] = row.count;
      }

      const onLeaveCount = dbHelper.queryOne<{ count: number }>(
        "SELECT COUNT(DISTINCT employee_id) as count FROM leave_requests WHERE status = 'APPROVED' AND ? BETWEEN start_date AND end_date",
        [targetDate]
      )?.count || 0;

      const present = counts['PRESENT'] || 0;
      const late = counts['LATE'] || 0;
      const halfDay = counts['HALF_DAY'] || 0;
      const missingCheckout = counts['MISSING_CHECKOUT'] || 0;
      const recorded = present + late + halfDay + missingCheckout;
      const absent = Math.max(0, totalActive - recorded - onLeaveCount);

      return {
        date: targetDate,
        totalEmployees: totalActive,
        present,
        late,
        halfDay,
        absent,
        onLeave: onLeaveCount,
        missingCheckout
      };
    }

    case 'get_late_comers': {
      if (!isPrivileged) {
        return { error: 'Permission denied: viewing other employees late records is restricted to HR and Admin.' };
      }
      const targetDate = args?.date || dateStr;
      const lateEmployees = dbHelper.queryAll<any>(
        `SELECT e.first_name || ' ' || e.last_name as name,
                e.employee_code as code,
                COALESCE(dept.name, 'Unassigned') as department,
                a.check_in_time as checkInTime
         FROM attendance a
         JOIN employees e ON a.employee_id = e.id
         LEFT JOIN departments dept ON e.department_id = dept.id
         WHERE a.date = ? AND a.status = 'LATE'
         ORDER BY a.check_in_time ASC
         LIMIT 30`,
        [targetDate]
      );
      return { date: targetDate, lateCount: lateEmployees.length, lateEmployees };
    }

    case 'get_leave_summary': {
      if (!isPrivileged) {
        return { error: 'Permission denied: viewing team leave summary is restricted to HR and Admin.' };
      }
      const onLeaveToday = dbHelper.queryAll<any>(
        `SELECT e.first_name, e.last_name, e.employee_code, COALESCE(dept.name, 'Unassigned') as department_name, lr.start_date, lr.end_date, lt.name as leave_type
         FROM leave_requests lr
         JOIN employees e ON lr.employee_id = e.id
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         LEFT JOIN departments dept ON e.department_id = dept.id
         WHERE lr.status = 'APPROVED' AND ? BETWEEN lr.start_date AND lr.end_date
         ORDER BY e.first_name ASC
         LIMIT 30`,
        [dateStr]
      );
      const pendingRequests = dbHelper.queryAll<any>(
        `SELECT e.first_name, e.last_name, e.employee_code, lr.duration_days, lr.start_date, lr.end_date, lt.name as leave_type
         FROM leave_requests lr
         JOIN employees e ON lr.employee_id = e.id
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.status = 'PENDING'
         ORDER BY lr.created_at DESC
         LIMIT 20`
      );
      return {
        date: dateStr,
        onLeaveCount: onLeaveToday.length,
        employeesOnLeave: onLeaveToday,
        pendingApprovalsCount: pendingRequests.length,
        pendingRequests
      };
    }

    case 'get_my_leave_balance': {
      if (!user.employeeId) {
        return { message: 'No associated employee profile found for this account (System Admin/HR without linked employee record).' };
      }
      const balances = getLeaveBalances(user.employeeId);
      return {
        balances: balances.map((b: any) => ({
          leaveType: b.leave_type_name,
          allocated: b.allocated_days,
          used: b.used_days,
          pending: b.pending_days,
          remaining: b.allocated_days - b.used_days
        }))
      };
    }

    case 'get_payroll_summary': {
      if (!isPrivileged) {
        return { error: 'Permission denied: Payroll information is strictly confidential and restricted to HR and Admin.' };
      }
      const month = args?.month || new Date().getMonth() + 1;
      const year = args?.year || new Date().getFullYear();
      const period = dbHelper.queryOne<any>(
        'SELECT * FROM payroll_periods WHERE month = ? AND year = ?',
        [month, year]
      );
      if (!period) {
        return { message: `No payroll generated yet for ${month}/${year}.` };
      }
      return {
        month: period.month,
        year: period.year,
        status: period.status,
        totalGross: `PKR ${period.total_gross.toLocaleString()}`,
        totalDeductions: `PKR ${period.total_deductions.toLocaleString()}`,
        totalTax: `PKR ${period.total_tax.toLocaleString()}`,
        totalNet: `PKR ${period.total_net.toLocaleString()}`
      };
    }

    case 'search_employees': {
      const q = `%${(args?.query || '').trim()}%`;
      const matches = dbHelper.queryAll<any>(
        `SELECT e.employee_code, e.first_name, e.last_name, e.email, dept.name as department, desig.name as designation
         FROM employees e
         LEFT JOIN departments dept ON e.department_id = dept.id
         LEFT JOIN designations desig ON e.designation_id = desig.id
         WHERE (e.first_name LIKE ? OR e.last_name LIKE ? OR dept.name LIKE ? OR desig.name LIKE ?)
           AND e.employment_status = 'ACTIVE' LIMIT 10`,
        [q, q, q, q]
      );
      return { query: args?.query, count: matches.length, employees: matches };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// Format structured fallback text directly from executed tool results in case LLM second turn is unavailable
function formatToolFallbackText(toolResults: { tool: string; result: any }[]): string {
  const parts: string[] = [];

  for (const tr of toolResults) {
    if (tr.result?.error) {
      parts.push(`⚠️ ${tr.result.error}`);
      continue;
    }

    switch (tr.tool) {
      case 'get_leave_summary': {
        const res = tr.result;
        let text = `📅 **Leave Summary (${res.date})**:\n• Employees on approved leave today: ${res.onLeaveCount}\n• Pending leave approvals: ${res.pendingApprovalsCount}`;
        if (res.employeesOnLeave?.length > 0) {
          text += `\n\n**On Leave Today:**\n` + res.employeesOnLeave.map((e: any) => `• ${e.first_name} ${e.last_name} (${e.leave_type}, ${e.department_name})`).join('\n');
        } else {
          text += `\n\nNo employees are scheduled on leave for ${res.date}.`;
        }
        if (res.pendingRequests?.length > 0) {
          text += `\n\n**Pending Approvals:**\n` + res.pendingRequests.map((r: any) => `• ${r.first_name} ${r.last_name}: ${r.duration_days} day(s) of ${r.leave_type} (${r.start_date} to ${r.end_date})`).join('\n');
        } else {
          text += `\nAll leave requests have been reviewed — zero pending approvals.`;
        }
        parts.push(text);
        break;
      }

      case 'get_attendance_summary': {
        const res = tr.result;
        parts.push(
          `📊 **Attendance Roster (${res.date})**:\n` +
          `• Total Workforce: ${res.totalEmployees}\n` +
          `• Present: ${res.present}\n` +
          `• Late Arrivals: ${res.late}\n` +
          `• Half-Day: ${res.halfDay}\n` +
          `• Absent: ${res.absent}\n` +
          `• Approved Leave: ${res.onLeave}\n` +
          `• Missing Checkout: ${res.missingCheckout}`
        );
        break;
      }

      case 'get_late_comers': {
        const res = tr.result;
        if (res.lateCount === 0) {
          parts.push(`Great news! No employees arrived late on ${res.date}.`);
        } else {
          parts.push(
            `⏰ **Late Comers on ${res.date} (${res.lateCount} employee${res.lateCount > 1 ? 's' : ''}):**\n` +
            res.lateEmployees.map((e: any) => `• ${e.name} (${e.code}, ${e.department}) checked in at ${e.checkInTime}`).join('\n')
          );
        }
        break;
      }

      case 'get_my_leave_balance': {
        const res = tr.result;
        if (res.balances) {
          parts.push(
            `🌴 **Your Current Leave Quotas (${new Date().getFullYear()}):**\n` +
            res.balances.map((b: any) => `• **${b.leaveType}**: ${b.remaining} day(s) left (Allocated: ${b.allocated}, Used: ${b.used}, Pending: ${b.pending})`).join('\n')
          );
        } else {
          parts.push(res.message || 'No personal leave record linked.');
        }
        break;
      }

      case 'get_headcount': {
        const res = tr.result;
        let text = `👥 **Company Headcount**:\n- Total Employees: ${res.total}\n- Active Staff: ${res.active}`;
        if (res.byDepartment?.length > 0) {
          text += `\n\n**By Department:**\n` + res.byDepartment.map((d: any) => `• ${d.department}: ${d.count} employee(s)`).join('\n');
        }
        parts.push(text);
        break;
      }

      case 'get_payroll_summary': {
        const res = tr.result;
        if (res.totalNet) {
          parts.push(
            `💰 **Payroll Summary for ${res.month}/${res.year} (${res.status})**:\n` +
            `• Gross Total: ${res.totalGross}\n` +
            `• Total Deductions: ${res.totalDeductions}\n` +
            `• Income Tax: ${res.totalTax}\n` +
            `• Net Salary Disbursed: ${res.totalNet}`
          );
        } else {
          parts.push(res.message || 'No payroll data available.');
        }
        break;
      }

      case 'search_employees': {
        const res = tr.result;
        if (res.count === 0) {
          parts.push(`No employees found matching "${res.query}".`);
        } else {
          parts.push(
            `🔍 Found ${res.count} employee(s) matching "${res.query}":\n` +
            res.employees.map((e: any) => `• ${e.first_name} ${e.last_name} (${e.employee_code}) · ${e.designation}, ${e.department}`).join('\n')
          );
        }
        break;
      }

      default:
        parts.push(JSON.stringify(tr.result, null, 2));
    }
  }

  return parts.join('\n\n');
}

// Fast-path intent matcher for immediate sub-10ms tool execution
export function tryFastPathToolMatch(prompt: string): { tool: string; args: any } | null {
  const p = prompt.trim().toLowerCase().replace(/[?!.,;]/g, '').trim();

  // 1. Leave summary
  if (
    p === 'who is on leave today' ||
    p === 'who is on leave' ||
    p === 'who on leave' ||
    p === 'on leave today' ||
    p === 'leave summary' ||
    p === 'pending leaves' ||
    p === 'pending leave approvals' ||
    p === 'check leaves' ||
    p === 'any leaves today' ||
    p === 'who is on approved leave today' ||
    p.includes('who is on leave') ||
    p.includes('leave summary')
  ) {
    return { tool: 'get_leave_summary', args: {} };
  }

  // 2. Attendance summary
  if (
    p === 'summarize todays attendance roster' ||
    p === 'summarize today attendance roster' ||
    p === 'attendance summary' ||
    p === 'todays attendance' ||
    p === 'today attendance' ||
    p === 'attendance report' ||
    p === 'attendance roster' ||
    p === 'how many employees are present today' ||
    p === 'how many present today' ||
    p === 'present employees today' ||
    p.includes('attendance summary') ||
    p.includes('attendance roster')
  ) {
    return { tool: 'get_attendance_summary', args: {} };
  }

  // 3. Late comers
  if (
    p === 'how many employees are late today' ||
    p === 'who is late today' ||
    p === 'who came late today' ||
    p === 'who arrived late today' ||
    p === 'who checked in late' ||
    p === 'late comers' ||
    p === 'late arrivals' ||
    p.includes('who is late') ||
    p.includes('who came late') ||
    p.includes('late comers')
  ) {
    return { tool: 'get_late_comers', args: {} };
  }

  // 4. Headcount
  if (
    p === 'what is our headcount' ||
    p === 'what is the headcount' ||
    p === 'headcount' ||
    p === 'headcount summary' ||
    p === 'company headcount' ||
    p === 'total headcount' ||
    p === 'total employees' ||
    p === 'how many employees' ||
    p === 'how many staff' ||
    p === 'active employees' ||
    p.includes('what is our headcount') ||
    p.includes('total headcount')
  ) {
    return { tool: 'get_headcount', args: {} };
  }

  // 5. Personal leave balance
  if (
    p === 'what is my remaining leave balance' ||
    p === 'what is my leave balance' ||
    p === 'my leave balance' ||
    p === 'leave balance' ||
    p === 'remaining leaves' ||
    p === 'check my leaves' ||
    p === 'how many leaves do i have' ||
    p.includes('my leave balance') ||
    p.includes('remaining leave balance')
  ) {
    return { tool: 'get_my_leave_balance', args: {} };
  }

  return null;
}

// Safe AI interaction logging
function safeLogAi(userId: string, role: string, summary: string, tools: string, status: string) {
  try {
    const userExists = dbHelper.queryOne('SELECT id FROM users WHERE id = ?', [userId]);
    if (userExists) {
      dbHelper.run(
        `INSERT INTO ai_logs (id, user_id, user_role, prompt_summary, tools_called, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [crypto.randomUUID(), userId, role, summary.slice(0, 150), tools || 'none', status]
      );
    }
  } catch (err) {
    console.warn('[AI Logger Warning]:', err);
  }
}

export async function askAssistant(user: AuthUser, prompt: string) {
  if (!checkRateLimit(user.id)) {
    return {
      text: 'You have reached the hourly AI question limit (30 requests/hour). Please try again shortly.',
      toolsCalled: [],
      isAiGenerated: true
    };
  }

  // Fast-path intent matching: delivers instant sub-10ms responses for common operational queries
  const fastMatch = tryFastPathToolMatch(prompt);
  if (fastMatch) {
    const t0 = Date.now();
    const result = await executeTool(fastMatch.tool, fastMatch.args, user);
    const text = formatToolFallbackText([{ tool: fastMatch.tool, result }]);
    const duration = Date.now() - t0;
    console.log(`[AI Assistant Fast-Path] Executed "${fastMatch.tool}" in ${duration}ms`);

    safeLogAi(user.id, user.role, prompt, fastMatch.tool, 'SUCCESS (FAST_PATH)');

    return {
      text,
      toolsCalled: [fastMatch.tool],
      isAiGenerated: true
    };
  }

  const settings = getCompanySettings();
  const companyPolicy = settings.policy_document || 'Standard company working hours are 09:00 to 17:00 Monday to Friday. Grace period is 15 minutes. Employees arriving after 09:15 are marked Late. Less than 5 hours work is marked as Half-day. Leaves must be approved by HR or Manager.';

  const client = getAiClient();

  // If no Gemini API key configured
  if (!process.env.GEMINI_API_KEY || !client) {
    safeLogAi(user.id, user.role, prompt, 'none', 'API_KEY_NOT_CONFIGURED');

    return {
      text: "The Gemini AI Assistant requires a configured `GEMINI_API_KEY` in the environment (.env). Please attach your API key in the Secrets panel to activate live model querying with function calling.",
      toolsCalled: [],
      isAiGenerated: true
    };
  }

  const systemInstruction = `
You are the executive AI HR Assistant for "HCM Lite", an enterprise human capital management platform.
Current local time is: ${new Date().toISOString()} (${settings.timezone}).
The authenticated user making this request is:
- Email: ${user.email}
- Role: ${user.role}
- Employee ID: ${user.employeeId || 'N/A'}

COMPANY POLICY KNOWLEDGE BASE:
${companyPolicy}

CRITICAL SECURITY AND ETHICAL INVARIANTS:
1. STRICT ROLE-BASED ACCESS CONTROL:
   - If an unauthorized user (e.g., an EMPLOYEE) asks for confidential data such as another colleague's salary ("What is Ali's salary?", "Tell me what my coworker earns", "Show everyone's pay"), you MUST POLITELY REFUSE.
   - Say: "I cannot fulfill this request as salary and confidential payroll records are strictly restricted to authorized HR and Administrators."
   - Under NO circumstances reveal another employee's salary, banking details, or national ID to an employee.
2. ZERO HALLUCINATION:
   - For all questions regarding attendance, headcount, who is on leave, payroll figures, or leave balances, you MUST CALL the appropriate tool.
   - Ground all policy answers strictly in the company policy knowledge base above. If the policy does not state a rule, say: "Our company policy does not specify this rule. Please consult your HR department."
3. AUTONOMOUS ACTION BAN:
   - You must never autonomously submit leave, alter attendance, or finalize payroll.
4. TONE:
   - Professional, warm, enterprise executive tone. Keep answers clear, well-structured, and helpful.
`;

  const toolsCalled: string[] = [];

  const runAssistantWorkflow = async (): Promise<{ text: string; toolsCalled: string[] }> => {
    // 1. Model Turn with tool definitions and 6-second timeout
    let response;
    try {
      response = await withTimeout(
        client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: declarations }]
          }
        }),
        6000,
        'Model response timed out after 6 seconds.'
      );
    } catch (initialErr: any) {
      console.error('[AI Assistant Model Error - Turn 1 Initial Request]:', {
        turn: 'initial',
        status: initialErr?.status,
        code: initialErr?.code,
        message: initialErr?.message,
        stack: initialErr?.stack,
        cause: initialErr?.cause || null
      });
      throw initialErr;
    }

    let finalText = response.text || '';
    const functionCalls = response.functionCalls;

    // 2. Handle Tool Calling Execution
    if (functionCalls && functionCalls.length > 0) {
      const toolResults: { tool: string; result: any }[] = [];
      const functionResponseParts: any[] = [];

      for (const call of functionCalls) {
        const toolName = call.name || 'unknown_tool';
        toolsCalled.push(toolName);
        let result: any;
        try {
          result = await executeTool(toolName, call.args || {}, user);
        } catch (toolErr: any) {
          console.error(`[AI Assistant Tool Error]: Tool "${toolName}" failed:`, {
            tool: toolName,
            message: toolErr?.message,
            stack: toolErr?.stack
          });
          result = {
            error: `Unable to retrieve ${toolName.replace(/_/g, ' ')}: ${toolErr?.message || 'Database query error'}`
          };
        }
        toolResults.push({ tool: toolName, result });
        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: result
          }
        });
      }

      // Return tool response turn back to Gemini so it does not end on a model turn
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        try {
          const turn2 = await withTimeout(
            client.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: [
                { role: 'user', parts: [{ text: prompt }] },
                modelContent,
                { role: 'tool', parts: functionResponseParts }
              ],
              config: {
                systemInstruction
              }
            }),
            4500,
            'Model Turn 2 synthesis timed out after 4.5 seconds.'
          );
          if (turn2.text?.trim()) {
            finalText = turn2.text.trim();
          } else {
            finalText = formatToolFallbackText(toolResults);
          }
        } catch (turn2Err: any) {
          console.warn('[AI Assistant Turn 2 synthesis fallback]:', turn2Err?.message);
          finalText = formatToolFallbackText(toolResults);
        }
      } else {
        finalText = formatToolFallbackText(toolResults);
      }
    }

    return { text: finalText, toolsCalled };
  };

  try {
    // Enforce 12-second total safety timeout before hitting any hard browser limits
    const result = await withTimeout(
      runAssistantWorkflow(),
      12000,
      'The AI assistant request timed out.'
    );

    // Log AI activity
    safeLogAi(user.id, user.role, prompt, result.toolsCalled.join(',') || 'none', 'SUCCESS');

    return {
      text: result.text || 'I processed your request, but no additional details were returned.',
      toolsCalled: result.toolsCalled,
      isAiGenerated: true
    };
  } catch (err: any) {
    console.error('[AI Assistant Overall Catch Error]:', {
      status: err?.status,
      statusCode: err?.statusCode,
      code: err?.code,
      message: err?.message,
      isTimeout: !!err?.isTimeout,
      stack: err?.stack,
      cause: err?.cause || null
    });

    const statusDetail = err.isTimeout
      ? 'TIMEOUT: Request exceeded threshold'
      : `ERROR: [${err?.status || 'FAIL'}] ${err?.message || 'Unknown error'}`.slice(0, 100);

    safeLogAi(user.id, user.role, prompt, toolsCalled.join(',') || 'none', statusDetail);

    // Formulate a user-friendly error message
    let friendlyMessage = 'I am temporarily unable to complete this query. Please try again shortly or check the relevant module in the sidebar.';

    if (err.isTimeout || err.message?.includes('timed out') || err.message?.includes('timeout')) {
      friendlyMessage = 'The AI request took longer than expected to process. If you asked for team records, please navigate directly to Attendance, Leaves, or Organization to view real-time data.';
    } else if (
      err.status === 503 ||
      err.message?.includes('503') ||
      err.message?.includes('high demand') ||
      err.message?.includes('overloaded') ||
      err.message?.includes('UNAVAILABLE')
    ) {
      friendlyMessage = 'The AI service is currently experiencing high demand. Please wait a moment and try your request again.';
    } else if (err.status === 429 || err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('rate limit')) {
      friendlyMessage = 'The AI request quota or rate limit has been reached. Please wait a moment before sending another prompt.';
    }

    return {
      text: friendlyMessage,
      toolsCalled,
      isAiGenerated: true
    };
  }
}

// Smart Leave: natural-language intent parser with 15-second timeout and heuristic fallback
export async function parseSmartLeaveRequest(prompt: string): Promise<{
  leaveTypeCode?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  rawExplanation?: string;
}> {
  const today = new Date().toISOString().split('T')[0];
  const leaveTypes = dbHelper.queryAll<any>('SELECT name, code FROM leave_types WHERE is_active = 1');
  const availableTypesStr = leaveTypes.map(lt => `${lt.name} (code: ${lt.code})`).join(', ');

  const systemInstruction = `
You are a Smart Leave parser for an HR system.
Current reference date is ${today}.
Available Leave Types: ${availableTypesStr}.

Given an employee's natural-language leave request, extract:
1. leaveTypeCode: Match to best available leave type code (e.g. SL for Sick, AL for Annual, CL for Casual, UL for Unpaid).
2. startDate: Target start date in YYYY-MM-DD format.
3. endDate: Target end date in YYYY-MM-DD format.
4. reason: Clean descriptive reason for the request.
5. rawExplanation: Brief 1-sentence summary of what was parsed.

Respond strictly in valid JSON matching this schema:
{
  "leaveTypeCode": "SL",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "reason": "text",
  "rawExplanation": "text"
}
`;

  const fallbackResult = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.toISOString().split('T')[0];
    return {
      leaveTypeCode: 'CL',
      startDate: tomStr,
      endDate: tomStr,
      reason: prompt,
      rawExplanation: 'Prefilled using local date heuristic.'
    };
  };

  const client = getAiClient();
  if (!process.env.GEMINI_API_KEY || !client) {
    return fallbackResult();
  }

  try {
    const parsePromise = client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    const response = await withTimeout(parsePromise, 6000, 'Smart Leave parser timed out after 6 seconds.');
    const parsed = JSON.parse(response.text?.trim() || '{}');
    return parsed;
  } catch (err: any) {
    console.error('[Smart Leave Parser Error]:', {
      message: err?.message,
      status: err?.status,
      code: err?.code,
      stack: err?.stack
    });
    return fallbackResult();
  }
}
