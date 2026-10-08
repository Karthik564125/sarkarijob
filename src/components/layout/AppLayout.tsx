import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { ToastContainer } from '../common/Toast.js';
import type { ToastMessage } from '../common/Toast.js';

interface AppLayoutProps {
  children: React.ReactNode;
  toasts?: ToastMessage[];
  onDismissToast?: (id: string) => void;
}

export function AppLayout({ children, toasts = [], onDismissToast = () => {} }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lastChecked, setLastChecked] = useState('Monitoring standby');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();

  const getPageTitle = (path: string): string => {
    switch (path) {
      case '/dashboard':
        return 'Dashboard';
      case '/notifications':
        return 'Official Notifications';
      case '/eligibility':
        return 'My Eligibility';
      case '/applications':
        return 'Application Tracker';
      case '/profile':
        return 'Account Profile';
      case '/settings':
        return 'Settings & Preferences';
      default:
        return 'SarkariJob';
    }
  };

  const handleCheckNow = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      setLastChecked(`Checked at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      <ToastContainer toasts={toasts} onDismiss={onDismissToast} />

      <Sidebar
        isOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Header
          pageTitle={getPageTitle(location.pathname)}
          lastChecked={lastChecked}
          isRefreshing={isRefreshing}
          onCheckNow={handleCheckNow}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
