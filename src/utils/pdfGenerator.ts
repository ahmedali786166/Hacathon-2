/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import type { PayrollItem, CompanySettings } from '../types/index.ts';

export function generatePayslipPdf(item: PayrollItem, periodMonth: number, periodYear: number, company?: CompanySettings | null) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // 1. Header Banner - Deep Midnight Navy (#0B1120)
  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Champagne Gold Accent Line (#D6B46A)
  doc.setFillColor(214, 180, 106);
  doc.rect(0, 42, pageWidth, 2.5, 'F');

  // Company Name & Subtitle
  const companyTitle = company?.company_name || 'HCM LITE ENTERPRISE';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(248, 250, 252);
  doc.text(companyTitle.toUpperCase(), margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(214, 180, 106);
  doc.text(`ORGANIZATION CODE: ${company?.company_code || 'HCM'}  ·  OFFICIAL SALARY DISBURSEMENT`, margin, 26);

  // Payslip Period (Right-aligned in header)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const periodText = `${monthNames[periodMonth - 1]} ${periodYear}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(248, 250, 252);
  doc.text('PAYSLIP', pageWidth - margin, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.text(periodText, pageWidth - margin, 26, { align: 'right' });

  // 2. Employee Details Card (Clean bordered card)
  let y = 52;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('EMPLOYEE CREDENTIALS', margin + 6, y + 8);

  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 6, y + 11, margin + contentWidth - 6, y + 11);

  // Left column
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Employee ID:', margin + 6, y + 18);
  doc.text('Full Name:', margin + 6, y + 25);
  doc.text('Official Email:', margin + 6, y + 32);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(item.employee_code, margin + 32, y + 18);
  doc.text(`${item.first_name} ${item.last_name}`, margin + 32, y + 25);
  doc.text(item.email, margin + 32, y + 32);

  // Right column
  const col2X = margin + (contentWidth / 2) + 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Department:', col2X, y + 18);
  doc.text('Designation:', col2X, y + 25);
  doc.text('Bank Account:', col2X, y + 32);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(item.department_name || 'N/A', col2X + 28, y + 18);
  doc.text(item.designation_name || 'N/A', col2X + 28, y + 25);
  doc.text(item.bank_account_number ? `${item.bank_name || 'Bank'}: ${item.bank_account_number}` : 'Direct Account', col2X + 28, y + 32);

  // 3. Attendance & Working Days Metrics
  y = 96;
  const statBoxWidth = (contentWidth - 12) / 4;
  const stats = [
    { label: 'Working Days', value: String(item.working_days_count) },
    { label: 'Days Present', value: String(item.days_present) },
    { label: 'Days Absent', value: String(item.days_absent) },
    { label: 'Late Count', value: String(item.late_count) }
  ];

  stats.forEach((s, i) => {
    const bx = margin + i * (statBoxWidth + 4);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, statBoxWidth, 18, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(s.label.toUpperCase(), bx + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(s.value, bx + 4, y + 14);
  });

  // 4. Two-Column Table: Earnings & Allowances vs Deductions & Tax
  y = 120;
  const halfWidth = (contentWidth - 6) / 2;

  // Earnings Header
  doc.setFillColor(11, 17, 32);
  doc.rect(margin, y, halfWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(248, 250, 252);
  doc.text('EARNINGS & ALLOWANCES', margin + 4, y + 5.5);
  doc.text('PKR', margin + halfWidth - 4, y + 5.5, { align: 'right' });

  // Deductions Header
  doc.setFillColor(11, 17, 32);
  doc.rect(margin + halfWidth + 6, y, halfWidth, 8, 'F');
  doc.text('DEDUCTIONS & TAX', margin + halfWidth + 10, y + 5.5);
  doc.text('PKR', margin + contentWidth - 4, y + 5.5, { align: 'right' });

  // Earnings Rows
  const earnings = [
    { label: 'Basic Salary', amount: item.basic_salary },
    { label: 'House Rent Allowance (HRA 40%)', amount: item.hra_allowance },
    { label: 'Medical Allowance (10%)', amount: item.medical_allowance }
  ];

  let ey = y + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  earnings.forEach(e => {
    doc.text(e.label, margin + 4, ey);
    doc.text(e.amount.toLocaleString(), margin + halfWidth - 4, ey, { align: 'right' });
    ey += 7;
  });

  // Deductions Rows
  const deductions = [
    { label: `Absence (${item.days_absent} days)`, amount: item.absence_deduction },
    { label: `Half-Day (${item.days_half_day} days)`, amount: item.half_day_deduction },
    { label: `Late Arrivals Policy`, amount: item.late_deduction },
    { label: `Income Tax (Annualized Slab)`, amount: item.monthly_tax_deduction }
  ];

  let dy = y + 14;
  deductions.forEach(d => {
    doc.text(d.label, margin + halfWidth + 10, dy);
    doc.text(d.amount.toLocaleString(), margin + contentWidth - 4, dy, { align: 'right' });
    dy += 7;
  });

  // Gross & Total Deductions Subtotals
  const subtotalY = Math.max(ey, dy) + 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, subtotalY, margin + halfWidth, subtotalY);
  doc.line(margin + halfWidth + 6, subtotalY, margin + contentWidth, subtotalY);

  doc.setFont('helvetica', 'bold');
  doc.text('Gross Salary:', margin + 4, subtotalY + 6);
  doc.text(`PKR ${item.gross_salary.toLocaleString()}`, margin + halfWidth - 4, subtotalY + 6, { align: 'right' });

  const totalDeductions = item.absence_deduction + item.half_day_deduction + item.late_deduction + item.monthly_tax_deduction;
  doc.text('Total Deductions:', margin + halfWidth + 10, subtotalY + 6);
  doc.text(`PKR ${Math.round(totalDeductions).toLocaleString()}`, margin + contentWidth - 4, subtotalY + 6, { align: 'right' });

  // 5. Net Payable Highlight Box
  const netY = subtotalY + 16;
  doc.setFillColor(11, 17, 32);
  doc.roundedRect(margin, netY, contentWidth, 24, 2, 2, 'F');

  // Gold accent inner strip
  doc.setFillColor(214, 180, 106);
  doc.rect(margin, netY, 4, 24, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(214, 180, 106);
  doc.text('FINAL NET SALARY PAYABLE', margin + 10, netY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(`PKR ${item.net_salary.toLocaleString()}`, margin + 10, netY + 18);

  // Daily gross rate note on the right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Daily Gross Rate: PKR ${item.daily_gross_rate.toLocaleString()}`, margin + contentWidth - 8, netY + 10, { align: 'right' });
  doc.text(`Annual Taxable Base: PKR ${item.annual_taxable_gross.toLocaleString()}`, margin + contentWidth - 8, netY + 17, { align: 'right' });

  // 6. Signatures & Footer
  const footerY = 250;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 15, footerY, margin + 70, footerY);
  doc.line(margin + contentWidth - 70, footerY, margin + contentWidth - 15, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Employee Signature', margin + 42.5, footerY + 5, { align: 'center' });
  doc.text('Authorized HR Signatory', margin + contentWidth - 42.5, footerY + 5, { align: 'center' });

  // System generation watermark & verification footnote
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'This is a computer-generated salary slip from HCM Lite. All income tax calculations follow the statutory Pakistan Tax Slabs.',
    pageWidth / 2,
    280,
    { align: 'center' }
  );

  doc.save(`Payslip_${item.employee_code}_${periodMonth}_${periodYear}.pdf`);
}
