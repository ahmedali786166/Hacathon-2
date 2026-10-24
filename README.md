# HCM Lite — Enterprise Human Capital Management Platform
**Built for the Saylani Hackathon**

HCM Lite is a production-grade, full-stack Human Capital Management (HCM/HRIS) SaaS platform. Built with deep luxury enterprise aesthetics, zero-pill metadata discipline, strict server-side Role-Based Access Control (RBAC), and Gemini-powered HR tooling.

---

## 🏛️ System Architecture & Tech Stack

- **Frontend**: React 19 + TypeScript + Vite, Tailwind CSS v4, Lucide Icons, jsPDF.
- **Backend**: Node.js + Express + TypeScript (`server.ts`) with custom Vite dev-server integration.
- **Database**: Built-in SQLite relational database with WAL journal mode, foreign key enforcement, and ACID transactions.
- **Authentication**: Salted bcrypt password hashing, cryptographically signed JSON Web Tokens (24h lifespan), mandatory temporary password resets, and role authorization middleware.
- **AI Engine**: Google Gemini API (`gemini-3.8-flash`) via the modern `@google/genai` SDK with server-side authenticated tool execution and zero client-key exposure.

---

## 🔒 Role-Based Access Control (RBAC) Matrix

| Capability / Module | ADMIN | HR | EMPLOYEE |
| :--- | :---: | :---: | :---: |
| **Initial Company Onboarding** | ✅ (First-run) | ❌ | ❌ |
| **System Settings & Timings** | ✅ | ❌ | ❌ |
| **Departments & Designations** | ✅ | ✅ | ❌ |
| **Employee Registration & Edit** | ✅ | ✅ | ❌ |
| **Employee 360 View** | ✅ (Full) | ✅ (Full) | ✅ (Self-only) |
| **Attendance Punch In/Out** | ✅ | ✅ | ✅ (Own) |
| **Attendance Daily Roster** | ✅ | ✅ | ❌ |
| **Attendance Audit Correction** | ✅ | ✅ | ❌ |
| **Leave Request Submission** | ✅ | ✅ | ✅ |
| **Smart Leave (Natural Language AI)** | ✅ | ✅ | ✅ |
| **Approve / Reject Leaves** | ✅ | ✅ | ❌ |
| **Generate Payroll Draft** | ✅ | ✅ | ❌ |
| **Finalize & Lock Payroll** | ✅ (Exclusive) | ❌ | ❌ |
| **Download PDF Payslip** | ✅ (All) | ✅ (All) | ✅ (Own Finalized Only) |
| **AI HR Assistant (Tool Queries)** | ✅ (Permitted Data) | ✅ (Permitted Data) | ✅ (Own Balances/Directory Only) |
| **Announcements (Publish)** | ✅ | ✅ | ❌ |
| **Immutable Audit Vault** | ✅ (Exclusive) | ❌ | ❌ |

---

## 🇵🇰 Statutory Pakistan Tax Slabs & Salary Breakdown

HCM Lite implements the exact Pakistan annual income tax slabs:
- **Gross Salary**: `1.5 × Basic Salary`
  - **Basic Salary**: `1.0 × Basic` (100%)
  - **House Rent Allowance (HRA)**: `0.4 × Basic` (40%)
  - **Medical Allowance**: `0.1 × Basic` (10%)
  - *Basic (100%) + HRA (40%) + Medical (10%) = 150% = 1.5 × Basic Salary.*
- **Daily Gross Rate**: `Gross Salary / Working Days in Payroll Month`
- **Attendance Deductions**:
  - `Absence Deduction = Days Absent × Daily Gross Rate`
  - `Half-Day Deduction = 0.5 × Daily Gross Rate × Half-Day Count`
  - `Late Deduction = floor(Late Count / 3) × 0.5 × Daily Gross Rate`
- **Annualized Income Tax Slabs**:
  - Up to PKR 600,000: `0%`
  - PKR 600,001 – 1,200,000: `5% of amount exceeding PKR 600,000`
  - PKR 1,200,001 – 2,400,000: `PKR 30,000 + 15% of amount exceeding PKR 1,200,000`
  - PKR 2,400,001 – 3,600,000: `PKR 210,000 + 25% of amount exceeding PKR 2,400,000`
  - Above PKR 3,600,000: `PKR 510,000 + 35% of amount exceeding PKR 3,600,000`
- **Monthly Tax Deduction**: `Annual Tax / 12`

---

## 🚀 Step-by-Step End-to-End Demo Journey

The database starts completely empty with zero fake seed records. Follow this exact flow:

1. **System Initialization**:
   - Open the web application. The initial onboarding screen appears automatically.
   - Enter your company name, short code, and primary Administrator email & password.
   - Click "Initialize Organization". You are now authenticated as System Admin.
2. **Configure Master Records & HR Account**:
   - Navigate to **Organization**.
   - Create a Department (e.g. Code: `ENG`, Name: `Engineering`) and Designation (e.g. Code: `SWE`, Title: `Software Engineer`).
   - Switch to **User Accounts** tab and click "Provision User Account" with role `HR` (e.g. `hr@saylanitech.com`).
3. **HR Registers Employees**:
   - Log out and log in with your newly created HR account.
   - Go to **Employees** -> click "Register Employee".
   - Enter Employee Code `EMP-001`, First Name `Ahmed`, Last Name `Ali`, Email `ahmed@saylanitech.com`, select Department, and enter basic salary (e.g. PKR `100,000`).
   - Leave "Create User Login Credentials" checked with temporary password `Saylani@2026`.
4. **Employee Check-In & Smart Leave**:
   - Log out and sign in as `ahmed@saylanitech.com` with password `Saylani@2026`.
   - On the Employee Dashboard, click **Clock In for Today**. The server validates the timestamp.
   - Navigate to **Leave Portal** -> click **Smart Leave (Natural Language)**.
   - Type: `"I need sick leave next Monday for two days due to fever."`
   - Gemini parses the intent and prefills the dates and leave category into the form. Review and submit the request.
5. **HR Approval & AI Assistance**:
   - Log in as HR. Go to **Leave Portal** and click **Approve** on Ahmed's pending leave.
   - Go to **AI HR Assistant** and ask:
     - *"Who is on leave today?"*
     - *"Summarize today's attendance roster"*
     - The AI executes authenticated backend tools and answers with real data.
6. **Payroll Draft & Admin Locking**:
   - As HR, go to **Payroll Engine** -> select Month & Year -> click **Generate Monthly Draft**.
   - Review the calculated gross, HRA, Medical, attendance deductions, and Pakistan tax deductions.
   - Log out and log in as **Admin**.
   - Go to **Payroll Engine** and click **Finalize & Lock Period (Admin)**.
7. **Download Payslip & Security Invariant Test**:
   - Sign back in as Employee `ahmed@saylanitech.com`.
   - Navigate to **My Payslips** and click **Download PDF**. A luxury enterprise PDF payslip is generated instantly.
   - Go to **AI HR Assistant** as an employee and ask: *"What is my colleague's salary?"*
   - Notice the AI assistant strictly refuses to disclose confidential salary data.
8. **Admin Audit Inspection**:
   - Sign in as Admin. Navigate to **Announcements** -> **Immutable Audit Trail**.
   - Inspect the cryptographic log of all administrative actions, employee registrations, and payroll locks.

---

## 🛠️ Local Development & Scripts

```bash
# Install dependencies
npm install

# Run full-stack dev server (Express + Vite on port 3000)
npm run dev

# Run business logic unit test suite
npx tsx server/tests/coreLogic.test.ts

# Build production bundle
npm run build

# Start production server
npm start
```
