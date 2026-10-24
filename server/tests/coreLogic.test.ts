/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { calculateAnnualTax, calculateSalaryStructure } from '../services/payrollService.ts';
import { calculateWorkingDays } from '../services/leaveService.ts';

function runTests() {
  console.log('--- RUNNING HCM LITE CORE LOGIC TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Tax Slabs
  assert(calculateAnnualTax(500000) === 0, 'Slab 1: PKR 500,000 tax is 0');
  assert(calculateAnnualTax(600000) === 0, 'Slab 1 upper limit: PKR 600,000 tax is 0');
  assert(calculateAnnualTax(900000) === 15000, 'Slab 2: PKR 900,000 tax is 15,000');
  assert(calculateAnnualTax(1800000) === 120000, 'Slab 3: PKR 1,800,000 tax is 120,000');
  assert(calculateAnnualTax(3000000) === 360000, 'Slab 4: PKR 3,000,000 tax is 360,000');
  assert(calculateAnnualTax(4000000) === 650000, 'Slab 5: PKR 4,000,000 tax is 650,000');

  // 2. Salary Breakdown (1.5x basic, 40% HRA, 10% Medical)
  const salary = calculateSalaryStructure(100000);
  assert(salary.basic === 100000, 'Basic salary is 100,000');
  assert(salary.hra === 40000, 'HRA is 40% (40,000)');
  assert(salary.medical === 10000, 'Medical allowance is 10% (10,000)');
  assert(salary.gross === 150000, 'Gross salary is 1.5x basic (150,000)');
  assert(salary.basic + salary.hra + salary.medical === salary.gross, 'Components sum exactly to gross salary');

  // 3. Working Days Calculation
  // 2026-10-19 (Monday) to 2026-10-23 (Friday) is 5 working days
  const workDays = calculateWorkingDays('2026-10-19', '2026-10-23');
  assert(workDays.workingDays === 5, 'Monday to Friday is 5 working days');

  // 2026-10-19 (Monday) to 2026-10-25 (Sunday) is 5 working days (Saturday & Sunday excluded)
  const weekDays = calculateWorkingDays('2026-10-19', '2026-10-25');
  assert(weekDays.workingDays === 5, 'Full week excluding weekend is 5 working days');

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runTests();
