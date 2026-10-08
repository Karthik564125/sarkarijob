import React, { useState } from 'react';
import { Settings, Save, Database, BellRing, Info } from 'lucide-react';

interface SettingsPageProps {
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

export function SettingsPage({ onShowToast }: SettingsPageProps) {
  const [sscTracked, setSscTracked] = useState(true);
  const [rrbTracked, setRrbTracked] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    if (onShowToast) onShowToast('Preferences saved.', 'success');
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Page Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          <span>Settings & Preferences</span>
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure active recruitment sources and local notification preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tracked Portals */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Database className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Tracked Recruitment Sources</h3>
          </div>

          <p className="text-xs text-slate-500">
            Select official portals to monitor for notifications.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={`p-4 rounded-lg border flex items-start space-x-3 cursor-pointer transition-colors ${
                sscTracked ? 'bg-indigo-50/40 border-indigo-200' : 'bg-slate-50/50 border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                checked={sscTracked}
                onChange={(e) => setSscTracked(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">SSC (Staff Selection Commission)</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  CGL, CHSL, MTS, CPO, Selection Posts
                </span>
              </div>
            </label>

            <label
              className={`p-4 rounded-lg border flex items-start space-x-3 cursor-pointer transition-colors ${
                rrbTracked ? 'bg-indigo-50/40 border-indigo-200' : 'bg-slate-50/50 border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                checked={rrbTracked}
                onChange={(e) => setRrbTracked(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">RRB (Railway Recruitment Board)</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  NTPC, ALP, Technicians, Group D
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Local Notification Preferences */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <BellRing className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Notification Preferences</h3>
          </div>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-700 font-medium">Email digest for matching postings</span>
          </label>

          <div className="p-3 bg-slate-50 border border-slate-100 rounded text-xs text-slate-500 flex items-start space-x-2">
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>
              Background polling and automated email alerts will be activated once scraping services are connected.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {isSaved && <span className="text-xs font-semibold text-emerald-600">Preferences saved!</span>}
          <button
            type="submit"
            className="ml-auto inline-flex items-center space-x-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
}
