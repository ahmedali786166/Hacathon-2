/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from './Sidebar.tsx';
import { TopHeader } from './TopHeader.tsx';

interface MainLayoutProps {
  currentTab: string;
  onNavigateTab: (tab: string) => void;
  children: React.ReactNode;
}

export function MainLayout({ currentTab, onNavigateTab, children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080D1A] text-slate-900 dark:text-slate-100 flex">
      {/* Collapsible Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onNavigateTab}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      {/* Main Content Viewport */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? 'pl-20' : 'pl-64'
        }`}
      >
        {/* Top Header */}
        <TopHeader
          currentTab={currentTab}
          onNavigateTab={onNavigateTab}
          collapsed={collapsed}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 mt-16 p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
