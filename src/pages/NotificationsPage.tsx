import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { recruitmentApi } from '../lib/api.js';
import type { RecruitmentEvent } from '../types/recruitment.types.js';
import type { ApplicationStatus } from '../types/recruitment.types.js';
import {
  Bell,
  CalendarDays,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  CheckCircle2,
  FileCheck,
  ScrollText,
  BookOpen,
  XOctagon,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const ts = new Date(dateStr).getTime();
  const diff = Math.floor((now - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

interface EventConfig {
  label: string;
  icon: React.ReactNode;
  colorCls: string;
}

function eventConfig(type: string): EventConfig {
  const map: Record<string, EventConfig> = {
    NEW_RECRUITMENT: {
      label: 'New Recruitment',
      icon: <FileText className="w-3.5 h-3.5" />,
      colorCls: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    },
    DEADLINE_CHANGED: {
      label: 'Deadline Changed',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      colorCls: 'bg-amber-50 text-amber-600 border-amber-200',
    },
    APPLICATION_EXTENDED: {
      label: 'Application Extended',
      icon: <CalendarDays className="w-3.5 h-3.5" />,
      colorCls: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    EXAM_DATE_CHANGED: {
      label: 'Exam Date Changed',
      icon: <CalendarDays className="w-3.5 h-3.5" />,
      colorCls: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    CORRIGENDUM: {
      label: 'Corrigendum',
      icon: <ScrollText className="w-3.5 h-3.5" />,
      colorCls: 'bg-violet-50 text-violet-600 border-violet-200',
    },
    ADMIT_CARD: {
      label: 'Admit Card',
      icon: <FileCheck className="w-3.5 h-3.5" />,
      colorCls: 'bg-sky-50 text-sky-600 border-sky-200',
    },
    ANSWER_KEY: {
      label: 'Answer Key',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      colorCls: 'bg-teal-50 text-teal-600 border-teal-200',
    },
    RESULT: {
      label: 'Result',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      colorCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    CANCELLATION: {
      label: 'Cancellation',
      icon: <XOctagon className="w-3.5 h-3.5" />,
      colorCls: 'bg-rose-50 text-rose-600 border-rose-200',
    },
    VACANCY_CHANGED: {
      label: 'Vacancy Changed',
      icon: <Info className="w-3.5 h-3.5" />,
      colorCls: 'bg-slate-100 text-slate-600 border-slate-200',
    },
  };
  return (
    map[type] ?? {
      label: type.replace(/_/g, ' '),
      icon: <Bell className="w-3.5 h-3.5" />,
      colorCls: 'bg-slate-100 text-slate-600 border-slate-200',
    }
  );
}

function orgColorCls(org: string): string {
  const map: Record<string, string> = {
    SSC: 'bg-blue-50 text-blue-700 border-blue-200',
    APPSC: 'bg-violet-50 text-violet-700 border-violet-200',
    RRB: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return map[org] ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

/* ─── EventCard ──────────────────────────────────────────────────────────── */

function EventCard({
  event,
  navigate,
  onApplicationChange,
  saving,
}: {
  event: RecruitmentEvent;
  navigate: ReturnType<typeof useNavigate>;
  onApplicationChange: (recruitmentId: string, status: ApplicationStatus) => void;
  saving: boolean;
}) {
  const cfg = eventConfig(event.event_type);
  const org = event.recruitments?.organization ?? '';
  const applicationStatus = event.application?.status ?? null;
  const eligibilityStatus = event.eligibility?.status ?? null;

  const applicationButtonClass = (status: ApplicationStatus) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait ${
      applicationStatus === status
        ? status === 'applied'
          ? 'bg-emerald-600 text-white border-emerald-600'
          : 'bg-rose-600 text-white border-rose-600'
        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Event type badge */}
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${cfg.colorCls}`}>
            {cfg.icon}
            {cfg.label}
          </span>
          {/* Org badge */}
          {org && (
            <span className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded border ${orgColorCls(org)}`}>
              {org}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">
          {formatRelative(event.event_date || event.recruitments?.notification_date || event.created_at)}
        </span>
      </div>

      {/* Recruitment title */}
      <button
        className="text-left"
        onClick={() => navigate(`/recruitments/${event.recruitment_id}`)}
      >
        <p className="text-[11px] text-slate-400 mb-0.5">
          {event.recruitments?.notification_number
            ? `Notification ${event.recruitments.notification_number}`
            : event.recruitments?.title}
        </p>
        <h4 className="text-sm font-semibold text-slate-900 leading-snug hover:text-indigo-700 transition-colors">
          {event.title}
        </h4>
      </button>

      {event.description && (
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{event.description}</p>
      )}

      <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-semibold text-slate-600">Eligibility:</span>
          {eligibilityStatus === 'eligible' ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Eligible</span>
          ) : eligibilityStatus === 'not_eligible' ? (
            <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><XCircle className="w-3.5 h-3.5" /> Not Eligible</span>
          ) : eligibilityStatus === 'verify' ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><AlertCircle className="w-3.5 h-3.5" /> Needs Verification</span>
          ) : (
            <span className="text-slate-500">Not evaluated</span>
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            Application: {applicationStatus === 'applied' ? 'Applied' : applicationStatus === 'not_applied' ? 'Not Applied' : 'Not recorded'}
          </span>
        </div>
        <p className="text-[11px] font-semibold text-slate-500 mt-2 mb-1.5">Application decision</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            aria-pressed={applicationStatus === 'applied'}
            className={applicationButtonClass('applied')}
            onClick={() => onApplicationChange(event.recruitment_id, 'applied')}
          >
            {applicationStatus === 'applied' && <CheckCircle2 className="w-3.5 h-3.5" />}
            Eligible / Applied
          </button>
          <button
            type="button"
            disabled={saving}
            aria-pressed={applicationStatus === 'not_applied'}
            className={applicationButtonClass('not_applied')}
            onClick={() => onApplicationChange(event.recruitment_id, 'not_applied')}
          >
            {applicationStatus === 'not_applied' && <CheckCircle2 className="w-3.5 h-3.5" />}
            Not Eligible / Not Applied
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-100">
        {event.event_date && (
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <CalendarDays className="w-3 h-3" />
            {formatDate(event.event_date)}
          </span>
        )}
        {event.official_url && (
          <a
            href={event.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
            onClick={(e) => e.stopPropagation()}
          >
            Official source <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <button
          onClick={() => navigate(`/recruitments/${event.recruitment_id}`)}
          className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          View job →
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export function NotificationsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<RecruitmentEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [orgFilter, setOrgFilter] = useState<'ALL' | 'SSC' | 'APPSC' | 'RRB'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [savingApplicationIds, setSavingApplicationIds] = useState<Set<string>>(new Set());

  const LIMIT = 15;

  const fetchEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    recruitmentApi
      .getMyEvents({
        page,
        limit: LIMIT,
        organization: orgFilter !== 'ALL' ? orgFilter : undefined,
      })
      .then(({ data }) => {
        const res = data as {
          events: RecruitmentEvent[];
          total: number;
          totalPages: number;
        };
        setEvents(res.events ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 0);
      })
      .catch(() => {
        setError('Could not load events. Please try again.');
        setEvents([]);
      })
      .finally(() => setLoading(false));
  }, [page, orgFilter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleApplicationChange = async (recruitmentId: string, status: ApplicationStatus) => {
    const previousStatus = events.find((event) => event.recruitment_id === recruitmentId)?.application?.status ?? null;
    setApplicationError(null);
    setEvents((current) => current.map((event) => event.recruitment_id === recruitmentId
      ? { ...event, application: { status } }
      : event));
    setSavingApplicationIds((current) => new Set(current).add(recruitmentId));

    try {
      await recruitmentApi.setApplicationStatus(recruitmentId, status);
    } catch {
      setEvents((current) => current.map((event) => event.recruitment_id === recruitmentId
        ? { ...event, application: { status: previousStatus } }
        : event));
      setApplicationError('Could not save your application decision. Please try again.');
    } finally {
      setSavingApplicationIds((current) => {
        const next = new Set(current);
        next.delete(recruitmentId);
        return next;
      });
    }
  };

  const handleOrgChange = (org: 'ALL' | 'SSC' | 'APPSC' | 'RRB') => {
    setOrgFilter(org);
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            Official Notifications
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Current & recent government recruitment updates sourced directly from SSC, APPSC & RRB.
          </p>
        </div>
        {total > 0 && (
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-100 text-xs font-semibold text-indigo-700 flex-shrink-0">
            {total} event{total !== 1 ? 's' : ''} total
          </div>
        )}
      </div>

      {/* ── Source Filter Toolbar ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(['ALL', 'SSC', 'APPSC', 'RRB'] as const).map((org) => (
            <button
              key={org}
              onClick={() => handleOrgChange(org)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                orgFilter === org
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {org === 'ALL' ? 'All Sources' : org}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 font-medium px-1">
          Sort: <span className="font-semibold text-slate-800">Newest First</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading events…</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button
            onClick={fetchEvents}
            className="mt-3 text-xs font-semibold text-rose-600 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No events yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Events will appear here when official updates are detected for recruitments matched to your profile — such as admit cards, results, deadline changes, and corrigenda.
          </p>
          <div className="pt-2 inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
            <Info className="w-3.5 h-3.5" />
            <span>SSC, APPSC & RRB are polled automatically.</span>
          </div>
        </div>
      ) : (
        <>
          {applicationError && (
            <div role="alert" className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-xs font-medium text-rose-700">
              {applicationError}
            </div>
          )}
          {/* Events timeline */}
          <div className="space-y-3">
            {events.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                navigate={navigate}
                onApplicationChange={handleApplicationChange}
                saving={savingApplicationIds.has(ev.recruitment_id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
