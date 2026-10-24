/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, CompanySettings } from '../types/index.ts';
import { api, getStoredToken, setStoredToken, clearStoredToken } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  company: CompanySettings | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSetupConfigured: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  setupInitialCompany: (data: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSetupConfigured, setIsSetupConfigured] = useState<boolean>(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Initialize theme
  useEffect(() => {
    const saved = localStorage.getItem('hcm_lite_theme') as 'dark' | 'light' | null;
    const initialTheme = saved || 'dark';
    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('hcm_lite_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const checkInitialState = async () => {
    try {
      setIsLoading(true);
      const setupStatus = await api.getSetupStatus();
      setIsSetupConfigured(setupStatus.isConfigured);
      if (setupStatus.company) {
        setCompany(setupStatus.company);
      }

      if (!setupStatus.isConfigured) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const token = getStoredToken();
      if (token) {
        try {
          const meData = await api.getMe();
          setUser(meData.user);
          const compData = await api.getCompany();
          setCompany(compData);
        } catch {
          clearStoredToken();
          setUser(null);
        }
      }
    } catch (err) {
      console.error('Failed to initialize app state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkInitialState();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const result = await api.login(credentials);
    setStoredToken(result.token);
    setUser(result.user);
    if (result.company) {
      setCompany(result.company);
    }
  };

  const setupInitialCompany = async (data: any) => {
    const result = await api.setupInitialCompany(data);
    setStoredToken(result.token);
    setUser(result.user);
    setCompany(result.company);
    setIsSetupConfigured(true);
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const meData = await api.getMe();
      setUser(meData.user);
    } catch {
      logout();
    }
  };

  const refreshCompany = async () => {
    try {
      const compData = await api.getCompany();
      setCompany(compData);
    } catch (err) {
      console.error('Failed to refresh company settings:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        isAuthenticated: !!user,
        isLoading,
        isSetupConfigured,
        theme,
        toggleTheme,
        login,
        setupInitialCompany,
        logout,
        refreshUser,
        refreshCompany
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
