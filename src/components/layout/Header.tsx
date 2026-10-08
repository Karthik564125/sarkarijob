import React from 'react';
import { RefreshCw, Menu, Clock } from 'lucide-react';

interface HeaderProps {
  pageTitle: string;
  lastChecked: string;
  isRefreshing: boolean;
  onCheckNow: () => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  lastChecked,
  isRefreshing,
  onCheckNow,
  onToggleMobileMenu
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
      {/* Left side: Mobile menu toggle & Page Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right side: Last checked time & Check Now Button */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <div className="hidden sm:flex items-center text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
          <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
          <span>Last checked: <strong className="font-medium text-slate-700">{lastChecked}</strong></span>
        </div>

        <button
          onClick={onCheckNow}
          disabled={isRefreshing}
          className={`
            inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
            bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800
            transition-colors shadow-xs disabled:opacity-75 cursor-pointer
          `}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Checking...' : 'Check Now'}</span>
        </button>
      </div>
    </header>
  );
};
