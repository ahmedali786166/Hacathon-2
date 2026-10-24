/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import { dbHelper } from '../db/database.ts';
import { getCompanySettings } from './organizationService.ts';
import { calculateWorkingDays } from './leaveService.ts';
import { logAudit } from './auditService.ts';
import { createNotification } from './notificationService.ts';
import type { AuthUser } from '../middleware/auth.ts';

/**
 * Calculates annual income tax under Pakistan Tax Slabs:
 * - Up to PKR 600,000: 0%
 * - PKR 600,001 – 1,200,000: 5% of the amount exceeding PKR 600,000
 * - PKR 1,200,001 – 2,400,000: PKR 30,000 + 15% of the amount exceeding PKR 1,200,000
 * - PKR 2,400,001 – 3,600,000: PKR 210,000 + 25% of the amount exceeding PKR 2,400,000
 * - Above PKR 3,600,000: PKR 510,000 + 35% of the amount exceeding PKR 3,600,000
 */
export function calculateAnnualTax(annualGross: number): number {
  if (annualGross <= 600000) {
    return 0;
  }
  if (annualGross <= 1200000) {
    return (annualGross - 600000) * 0.05;
  }
  if (annualGross <= 2400000) {
    return 30000 + (annualGross - 1200000) * 0.15;
  }
  if (annualGross <= 3600000) {
    return 210000 + (annualGross - 2400000) * 0.25;
  }
  return 510000 + (annualGross - 3600000) * 0.35;
}

export function calculateSalaryStructure(basicSalary: number) {
  const basic = Math.max(0, Number(basicSalary) || 0);
  const hra = Math.round(basic * 0.40); // 40%
  const medical = Math.round(basic * 0.10); // 10%
  const gross = Math.round(basic * 1.50); // 1.5 x basic (basic + hra + medical)
  return { basic, hra, medical, gross };
}

export function getMonthWorkingDays(year: number, month: number): { workingDays: number; startDate: string; endDate: string } {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));

  const startDateStr = firstDay.toISOString().split('T')[0];
  const endDateStr = lastDay.toISOString().split('T')[0];

  const { workingDays } = calculateWorkingDays(startDateStr, endDateStr);
  return {
    workingDays: Math.max(1, workingDays),
    startDate: startDateStr,
    endDate: endDateStr
  };
}

export function generatePayrollDraft(actor: AuthUser, month: number, year: number) {
  // Check if period already exists and is locked
  const existingPeriod = dbHelper.queryOne<any>(
    'SELECT * FROM payroll_periods WHERE month = ? AND year = ?',
    [month, year]
  );

  if (existingPeriod && existingPeriod.status === 'LOCKED') {
    throw new Error(`Payroll for ${month}/${year} is finalized and locked. Locked payroll cannot be recalculated.`);
  }

  const { workingDays: totalWorkingDays, startDate: monthStart, endDate: monthEnd } = getMonthWorkingDays(year, month);
  const activeEmployees = dbHelper.queryAll<any>(
    "SELECT * FROM employees WHERE employment_status IN ('ACTIVE', 'ON_LEAVE')"
  );

  if (activeEmployees.length === 0) {
    throw new Error('No active employees found to generate payroll.');
  }

  return dbHelper.transaction(() => {
    const periodId = existingPeriod?.id || crypto.randomUUID();

    if (existingPeriod) {
      // Clear existing draft items
      dbHelper.run('DELETE FROM payroll_items WHERE period_id = ?', [periodId]);
    } else {
      dbHelper.run(
        `INSERT INTO payroll_periods (
          id, month, year, total_working_days, status,
          total_gross, total_deductions, total_tax, total_net,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'DRAFT', 0, 0, 0, 0, ?, datetime('now'), datetime('now'))`,
        [periodId, month, year, totalWorkingDays, actor.id]
      );
    }

    let periodGross = 0;
    let periodDeductions = 0;
    let periodTax = 0;
    let periodNet = 0;

    for (const emp of activeEmployees) {
      const basic = Number(emp.basic_salary) || 0;
      const { hra, medical, gross: standardGross } = calculateSalaryStructure(basic);

      // Proration check: joined during this payroll month?
      let proratedGross = standardGross;
      let effectiveWorkingDays = totalWorkingDays;
      if (emp.join_date && emp.join_date > monthStart && emp.join_date <= monthEnd) {
        const { workingDays: activeDays } = calculateWorkingDays(emp.join_date, monthEnd);
        effectiveWorkingDays = activeDays;
        proratedGross = Math.round((standardGross / totalWorkingDays) * activeDays);
      }

      const dailyGrossRate = effectiveWorkingDays > 0 ? Number((proratedGross / effectiveWorkingDays).toFixed(2)) : 0;

      // Count actual attendance for month
      const attendanceRecords = dbHelper.queryAll<any>(
        "SELECT * FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?",
        [emp.id, monthStart, monthEnd]
      );

      let presentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;

      for (const att of attendanceRecords) {
        if (att.status === 'PRESENT') presentCount++;
        else if (att.status === 'LATE') {
          presentCount++;
          lateCount++;
        } else if (att.status === 'HALF_DAY') {
          halfDayCount++;
        }
      }

      // Count approved paid and unpaid leaves for month
      const approvedLeaves = dbHelper.queryAll<any>(
        `SELECT lr.*, lt.is_paid
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = ? AND lr.status = 'APPROVED'
           AND lr.start_date <= ? AND lr.end_date >= ?`,
        [emp.id, monthEnd, monthStart]
      );

      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;

      for (const leave of approvedLeaves) {
        // Calculate overlapping working days strictly inside the month
        const overlapStart = leave.start_date < monthStart ? monthStart : leave.start_date;
        const overlapEnd = leave.end_date > monthEnd ? monthEnd : leave.end_date;
        const { workingDays: lDays } = calculateWorkingDays(overlapStart, overlapEnd);
        if (leave.is_paid === 1) {
          paidLeaveDays += lDays;
        } else {
          unpaidLeaveDays += lDays;
        }
      }

      // Absences = total working days - (present + half_day + approved paid leave + approved unpaid leave)
      const recordedDays = presentCount + halfDayCount + paidLeaveDays + unpaidLeaveDays;
      const absentDays = Math.max(0, effectiveWorkingDays - recordedDays);

      // Deductions
      const absenceDeduction = Number((absentDays * dailyGrossRate).toFixed(2));
      const halfDayDeduction = Number((halfDayCount * 0.5 * dailyGrossRate).toFixed(2));
      const unpaidLeaveDeduction = Number((unpaidLeaveDays * dailyGrossRate).toFixed(2));

      // Late policy deduction: 3 late arrivals = 0.5 day deduction
      let lateDeduction = 0;
      if (lateCount >= 3) {
        const latePenalties = Math.floor(lateCount / 3);
        lateDeduction = Number((latePenalties * 0.5 * dailyGrossRate).toFixed(2));
      }

      const totalDeductions = Number((absenceDeduction + halfDayDeduction + unpaidLeaveDeduction + lateDeduction).toFixed(2));

      // Annualize gross for tax
      const annualTaxableGross = Math.round(proratedGross * 12);
      const annualCalculatedTax = Math.round(calculateAnnualTax(annualTaxableGross));
      const monthlyTaxDeduction = Math.round(annualCalculatedTax / 12);

      const netSalary = Math.max(0, Math.round(proratedGross - totalDeductions - monthlyTaxDeduction));

      const itemId = crypto.randomUUID();
      dbHelper.run(
        `INSERT INTO payroll_items (
          id, period_id, employee_id, basic_salary, gross_salary,
          hra_allowance, medical_allowance, daily_gross_rate, working_days_count,
          days_present, days_absent, days_half_day, days_unpaid_leave, late_count,
          absence_deduction, half_day_deduction, late_deduction,
          annual_taxable_gross, annual_calculated_tax, monthly_tax_deduction,
          net_salary, notes, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, datetime('now')
        )`,
        [
          itemId, periodId, emp.id, basic, proratedGross,
          hra, medical, dailyGrossRate, effectiveWorkingDays,
          presentCount, absentDays, halfDayCount, unpaidLeaveDays, lateCount,
          absenceDeduction, halfDayDeduction, lateDeduction,
          annualTaxableGross, annualCalculatedTax, monthlyTaxDeduction,
          netSalary,
          emp.join_date > monthStart ? `Prorated from join date ${emp.join_date}` : null
        ]
      );

      periodGross += proratedGross;
      periodDeductions += totalDeductions;
      periodTax += monthlyTaxDeduction;
      periodNet += netSalary;
    }

    // Update totals on period
    dbHelper.run(
      `UPDATE payroll_periods SET
        total_gross = ?,
        total_deductions = ?,
        total_tax = ?,
        total_net = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      [periodGross, periodDeductions, periodTax, periodNet, periodId]
    );

    logAudit({
      actor,
      action: existingPeriod ? 'PAYROLL_DRAFT_REGENERATED' : 'PAYROLL_DRAFT_GENERATED',
      entityType: 'PAYROLL',
      entityId: periodId,
      afterValue: { month, year, totalEmployees: activeEmployees.length, periodGross, periodNet }
    });

    return getPayrollPeriodById(periodId);
  });
}

export function finalizeAndLockPayroll(adminActor: AuthUser, periodId: string) {
  if (adminActor.role !== 'ADMIN') {
    throw new Error('Forbidden. ONLY the System Admin is authorized to finalize and lock payroll.');
  }

  const period = dbHelper.queryOne<any>('SELECT * FROM payroll_periods WHERE id = ?', [periodId]);
  if (!period) throw new Error('Payroll period not found.');

  if (period.status === 'LOCKED') {
    throw new Error('Payroll is already finalized and locked.');
  }

  return dbHelper.transaction(() => {
    dbHelper.run(
      `UPDATE payroll_periods SET
        status = 'LOCKED',
        locked_by = ?,
        locked_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?`,
      [adminActor.id, periodId]
    );

    // Notify all employees that their payslip is available
    const items = dbHelper.queryAll<any>(
      `SELECT pi.employee_id, e.user_id, e.first_name
       FROM payroll_items pi
       JOIN employees e ON pi.employee_id = e.id
       WHERE pi.period_id = ?`,
      [periodId]
    );

    for (const item of items) {
      if (item.user_id) {
        createNotification({
          userId: item.user_id,
          title: 'Payslip Finalized',
          message: `Your payslip for ${period.month}/${period.year} has been finalized and is now available for download.`,
          type: 'SUCCESS',
          link: '/payroll'
        });
      }
    }

    logAudit({
      actor: adminActor,
      action: 'PAYROLL_FINALIZED_AND_LOCKED',
      entityType: 'PAYROLL',
      entityId: periodId,
      afterValue: { month: period.month, year: period.year, lockedBy: adminActor.email }
    });

    return getPayrollPeriodById(periodId);
  });
}

export function getPayrollPeriods() {
  return dbHelper.queryAll<any>(`
    SELECT pp.*,
           u1.email as creator_email,
           u2.email as locker_email,
           (SELECT COUNT(*) FROM payroll_items pi WHERE pi.period_id = pp.id) as employee_count
    FROM payroll_periods pp
    LEFT JOIN users u1 ON pp.created_by = u1.id
    LEFT JOIN users u2 ON pp.locked_by = u2.id
    ORDER BY pp.year DESC, pp.month DESC
  `);
}

export function getPayrollPeriodById(periodId: string) {
  const period = dbHelper.queryOne<any>(`
    SELECT pp.*,
           u1.email as creator_email,
           u2.email as locker_email
    FROM payroll_periods pp
    LEFT JOIN users u1 ON pp.created_by = u1.id
    LEFT JOIN users u2 ON pp.locked_by = u2.id
    WHERE pp.id = ?
  `, [periodId]);

  if (!period) return null;

  const items = dbHelper.queryAll<any>(`
    SELECT pi.*,
           e.employee_code, e.first_name, e.last_name, e.email,
           dept.name as department_name, desig.name as designation_name,
           e.bank_name, e.bank_account_number, e.national_id
    FROM payroll_items pi
    JOIN employees e ON pi.employee_id = e.id
    LEFT JOIN departments dept ON e.department_id = dept.id
    LEFT JOIN designations desig ON e.designation_id = desig.id
    WHERE pi.period_id = ?
    ORDER BY e.employee_code ASC
  `, [periodId]);

  return { period, items };
}

export function getEmployeePayslips(employeeId: string, viewer: AuthUser) {
  const isPrivileged = viewer.role === 'ADMIN' || viewer.role === 'HR';
  const isSelf = viewer.employeeId === employeeId;

  if (!isPrivileged && !isSelf) {
    throw new Error('Forbidden. You can only view your own payslips.');
  }

  return dbHelper.queryAll<any>(`
    SELECT pi.*,
           pp.month, pp.year, pp.status as period_status, pp.locked_at,
           e.employee_code, e.first_name, e.last_name, e.email,
           dept.name as department_name, desig.name as designation_name,
           e.bank_name, e.bank_account_number, e.national_id
    FROM payroll_items pi
    JOIN payroll_periods pp ON pi.period_id = pp.id
    JOIN employees e ON pi.employee_id = e.id
    LEFT JOIN departments dept ON e.department_id = dept.id
    LEFT JOIN designations desig ON e.designation_id = desig.id
    WHERE pi.employee_id = ? ${!isPrivileged ? "AND pp.status = 'LOCKED'" : ''}
    ORDER BY pp.year DESC, pp.month DESC
  `, [employeeId]);
}
