/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { OnboardingPage } from './pages/OnboardingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { MainLayout } from './components/layout/MainLayout.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { EmployeesPage } from './pages/EmployeesPage.tsx';
import { Employee360Page } from './pages/Employee360Page.tsx';
import { AttendancePage } from './pages/AttendancePage.tsx';
import { LeavePage } from './pages/LeavePage.tsx';
import { PayrollPage } from './pages/PayrollPage.tsx';
import { AIAssistantPage } from './pages/AIAssistantPage.tsx';
import { OrganizationPage } from './pages/OrganizationPage.tsx';
import { CommunicationsPage } from './pages/CommunicationsPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';

function AppContent() {
  const { isAuthenticated, isSetupConfigured, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [employee360Id, setEmployee360Id] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080D1A] flex items-center justify-center text-xs text-[#D6B46A] select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D6B46A] to-[#8C6D29] flex items-center justify-center text-[#0B1120] font-black text-lg animate-pulse shadow-xl">
            HC
          </div>
          <span className="font-medium tracking-wider uppercase">Loading HCM Lite...</span>
        </div>
      </div>
    );
  }

  // 1. Fresh installation: Company setup flow
  if (!isSetupConfigured) {
    return <OnboardingPage />;
  }

  // 2. Authentication flow
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleNavigateTab = (tab: string) => {
    setCurrentTab(tab);
    setEmployee360Id(null);
  };

  const handleViewEmployee360 = (id: string) => {
    setEmployee360Id(id);
    setCurrentTab('employees');
  };

  return (
    <MainLayout currentTab={currentTab} onNavigateTab={handleNavigateTab}>
      {currentTab === 'dashboard' && (
        <DashboardPage onNavigateTab={handleNavigateTab} />
      )}

      {currentTab === 'employees' && (
        employee360Id ? (
          <Employee360Page employeeId={employee360Id} onBack={() => setEmployee360Id(null)} />
        ) : (
          <EmployeesPage onViewEmployee360={handleViewEmployee360} />
        )
      )}

      {currentTab === 'attendance' && (
        <AttendancePage />
      )}

      {currentTab === 'leaves' && (
        <LeavePage />
      )}

      {currentTab === 'payroll' && (
        <PayrollPage />
      )}

      {currentTab === 'ai-assistant' && (
        <AIAssistantPage />
      )}

      {currentTab === 'organization' && (
        <OrganizationPage />
      )}

      {currentTab === 'communications' && (
        <CommunicationsPage />
      )}

      {currentTab === 'audit-logs' && (
        <CommunicationsPage />
      )}

      {currentTab === 'profile' && (
        <ProfilePage />
      )}
    </MainLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
