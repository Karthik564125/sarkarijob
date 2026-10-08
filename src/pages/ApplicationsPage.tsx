import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileText, Loader2, XCircle } from 'lucide-react';
import { recruitmentApi } from '../lib/api.js';
import type { ApplicationStatus, UserApplicationRecord } from '../types/recruitment.types.js';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ApplicationsPage() {
  const [applications, setApplications] = useState<UserApplicationRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus>('applied');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    recruitmentApi.getApplications()
      .then(({ data }) => setApplications((data.applications ?? []) as UserApplicationRecord[]))
      .catch((err) => setError(err?.response?.data?.message ?? 'Could not load applications. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const visibleApplications = applications.filter((application) => application.application_status === statusFilter);

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            My Application Tracker
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Review the application decisions you have recorded for recruitment notifications.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {(['applied', 'not_applied'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${statusFilter === status
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {status === 'applied' ? 'Applied' : 'Not Applied'}
            <span className="ml-2 text-xs text-slate-400">
              {applications.filter((application) => application.application_status === status).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading applications…</span>
        </div>
      ) : error ? (
        <div role="alert" className="bg-rose-50 border border-rose-200 rounded-lg p-5 flex items-start gap-2 text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : visibleApplications.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-10 text-center space-y-2">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            {statusFilter === 'applied' ? <FileText className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {statusFilter === 'applied' ? 'No applications recorded as applied.' : 'No not-applied decisions recorded.'}
          </h3>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">{statusFilter === 'applied' ? 'My Applications' : 'Not Applied'}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Organization</th>
                  <th className="px-4 py-3 font-semibold">Notification</th>
                  <th className="px-4 py-3 font-semibold min-w-64">Recruitment</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Deadline</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleApplications.map((application) => (
                  <tr key={application.id} className="text-slate-700">
                    <td className="px-4 py-3 font-semibold">{application.recruitments.organization}</td>
                    <td className="px-4 py-3">{application.recruitments.notification_number ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{application.recruitments.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${statusFilter === 'applied'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                        {statusFilter === 'applied' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {statusFilter === 'applied' ? 'Applied' : 'Not Applied'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(application.recruitments.application_end)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/recruitments/${application.recruitment_id}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
