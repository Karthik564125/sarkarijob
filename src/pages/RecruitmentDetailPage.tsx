import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { recruitmentApi } from '../lib/api.js';
import type {
  RecruitmentDetailResponse,
  EligibilityStatus,
  ApplicationStatus,
  UserApplicationRecord,
} from '../types/recruitment.types.js';
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  XCircle,
  CalendarDays,
  Briefcase,
  Building2,
  ScrollText,
  FileCheck,
  BookOpen,
  CheckCircle2,
  XOctagon,
  FileText,
  Loader2,
  AlertCircle,
  Info,
  Clock,
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

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function eligibilityConfig(status: EligibilityStatus) {
  const map = {
    eligible: {
      label: 'Eligible',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-300',
      icon: <CheckCircle className="w-4 h-4" />,
      desc: 'Your profile meets the stated eligibility criteria for this recruitment.',
    },
    verify: {
      label: 'Needs Verification',
      cls: 'bg-amber-50 text-amber-700 border-amber-300',
      icon: <AlertTriangle className="w-4 h-4" />,
      desc: 'Some criteria could not be automatically verified. Please review the official notification.',
    },
    not_eligible: {
      label: 'Not Eligible',
      cls: 'bg-rose-50 text-rose-700 border-rose-300',
      icon: <XCircle className="w-4 h-4" />,
      desc: 'Your profile does not meet one or more eligibility criteria.',
    },
  };
  return map[status];
}

export function shouldShowQualificationMismatchDisclaimer(match?: {
  eligibility_status?: EligibilityStatus | null;
  unmet_criteria?: string[] | null;
  reasons?: string[] | null;
} | null): boolean {
  if (!match || match.eligibility_status !== 'not_eligible') return false;

  const text = [...(match.unmet_criteria ?? []), ...(match.reasons ?? [])].join(' ').toLowerCase();
  if (!text) return false;

  const qualificationPatterns = [
    /\bbranch\b/,
    /\bdegree\b/,
    /\bqualification\b/,
    /\bstream\b/,
    /\bsubject\b/,
    /\beducation\b/,
    /allowed branches/i,
    /allowed list/i,
  ];

  return qualificationPatterns.some((pattern) => pattern.test(text));
}

function recruitmentStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    closing_soon: { label: 'Closing Soon', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    upcoming: { label: 'Upcoming', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    closed: { label: 'Closed', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  };
  return map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function orgColorCls(org: string) {
  const map: Record<string, string> = {
    SSC: 'bg-blue-50 text-blue-700 border-blue-200',
    APPSC: 'bg-violet-50 text-violet-700 border-violet-200',
    RRB: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return map[org] ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

function eventIcon(type: string) {
  const map: Record<string, React.ReactNode> = {
    NEW_RECRUITMENT: <FileText className="w-3.5 h-3.5" />,
    DEADLINE_CHANGED: <AlertCircle className="w-3.5 h-3.5" />,
    APPLICATION_EXTENDED: <CalendarDays className="w-3.5 h-3.5" />,
    EXAM_DATE_CHANGED: <CalendarDays className="w-3.5 h-3.5" />,
    CORRIGENDUM: <ScrollText className="w-3.5 h-3.5" />,
    ADMIT_CARD: <FileCheck className="w-3.5 h-3.5" />,
    ANSWER_KEY: <BookOpen className="w-3.5 h-3.5" />,
    RESULT: <CheckCircle2 className="w-3.5 h-3.5" />,
    CANCELLATION: <XOctagon className="w-3.5 h-3.5" />,
  };
  return map[type] ?? <Info className="w-3.5 h-3.5" />;
}

function eventColorCls(type: string) {
  const map: Record<string, string> = {
    NEW_RECRUITMENT: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    DEADLINE_CHANGED: 'bg-amber-50 text-amber-600 border-amber-200',
    APPLICATION_EXTENDED: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    EXAM_DATE_CHANGED: 'bg-amber-50 text-amber-700 border-amber-200',
    CORRIGENDUM: 'bg-violet-50 text-violet-600 border-violet-200',
    ADMIT_CARD: 'bg-sky-50 text-sky-600 border-sky-200',
    ANSWER_KEY: 'bg-teal-50 text-teal-600 border-teal-200',
    RESULT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLATION: 'bg-rose-50 text-rose-600 border-rose-200',
  };
  return map[type] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

/* ─── CriteriaList ────────────────────────────────────────────────────────── */

function CriteriaList({
  items,
  icon,
  colorCls,
  title,
}: {
  items: string[];
  icon: React.ReactNode;
  colorCls: string;
  title: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className={`text-xs font-bold mb-1.5 flex items-center gap-1 ${colorCls}`}>
        {icon}
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export function RecruitmentDetailPage() {
  const { recruitmentId } = useParams<{ recruitmentId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<RecruitmentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);
  const [applicationStateLoaded, setApplicationStateLoaded] = useState(false);
  const [applicationLoadFailed, setApplicationLoadFailed] = useState(false);
  const [applicationSaving, setApplicationSaving] = useState(false);
  const [applicationError, setApplicationError] = useState<string | null>(null);

  useEffect(() => {
    if (!recruitmentId) {
      setError('Invalid recruitment ID.');
      setLoading(false);
      return;
    }
    setApplicationStateLoaded(false);
    setApplicationLoadFailed(false);
    setApplicationError(null);
    Promise.all([
      recruitmentApi.getDetail(recruitmentId),
      recruitmentApi.getApplications().catch(() => null),
    ])
      .then(([{ data: detail }, applicationsResponse]) => {
        setData(detail as RecruitmentDetailResponse);
        if (applicationsResponse) {
          const applications = applicationsResponse.data.applications as UserApplicationRecord[];
          const currentApplication = applications?.find((application) => application.recruitment_id === recruitmentId);
          setApplicationStatus(currentApplication?.application_status ?? null);
        } else {
          setApplicationLoadFailed(true);
          setApplicationError('Could not load your application decision. You can still update it below.');
        }
        setApplicationStateLoaded(true);
      })
      .catch((err) => {
        const msg =
          err?.response?.status === 404
            ? 'Recruitment not found.'
            : 'Failed to load recruitment details.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [recruitmentId]);

  const handleApplicationChange = async (status: ApplicationStatus) => {
    if (!recruitmentId) return;
    const previousStatus = applicationStatus;
    setApplicationStatus(status);
    setApplicationError(null);
    setApplicationSaving(true);

    try {
      await recruitmentApi.setApplicationStatus(recruitmentId, status);
      setApplicationStateLoaded(true);
      setApplicationLoadFailed(false);
    } catch {
      setApplicationStatus(previousStatus);
      setApplicationError('Could not save your application decision. Please try again.');
    } finally {
      setApplicationSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin" />
        <span className="text-sm">Loading recruitment details…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-5"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-7 h-7 text-rose-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-rose-700">{error ?? 'Something went wrong.'}</p>
        </div>
      </div>
    );
  }

  const { recruitment: rec, userMatch, events } = data;
  const recBadge = recruitmentStatusBadge(rec.status);
  const orgCls = orgColorCls(rec.organization);
  const elConfig = userMatch ? eligibilityConfig(userMatch.eligibility_status) : null;
  const days = daysUntil(rec.application_end);

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Back nav */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* ── Header Card ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded border ${orgCls}`}>
            {rec.organization}
          </span>
          <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded border ${recBadge.cls}`}>
            {recBadge.label}
          </span>
          {rec.recruitment_type && (
            <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {rec.recruitment_type}
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-slate-900 leading-snug mb-1">{rec.title}</h1>

        {rec.notification_number && (
          <p className="text-xs text-slate-400 mb-4">Notification: {rec.notification_number}</p>
        )}

        {/* Key facts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Vacancies</div>
            <div className="text-base font-bold text-slate-900">
              {rec.vacancies != null ? rec.vacancies.toLocaleString() : '—'}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Notification Date</div>
            <div className="text-sm font-semibold text-slate-900">{formatDate(rec.notification_date)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Apply By</div>
            <div className="text-sm font-semibold text-slate-900">{formatDate(rec.application_end)}</div>
            {days !== null && days >= 0 && days <= 14 && (
              <div className="text-[11px] text-amber-600 font-semibold">{days}d left</div>
            )}
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Exam Date</div>
            <div className="text-sm font-semibold text-slate-900">{formatDate(rec.exam_date)}</div>
          </div>
        </div>

        {/* Historical record banner */}
        {rec.status === 'closed' && (
          <div className="mt-4 p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>This is a closed/historical recruitment record kept for reference and audit purposes.</span>
          </div>
        )}

        {/* Official links and manual application decision */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap gap-2">
            {rec.official_page_url && (
              <a
                href={rec.official_page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md border border-indigo-200 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                Official Page
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {rec.official_pdf_url && (
              <a
                href={rec.official_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Notification PDF
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-xs font-semibold text-slate-600">Application decision</span>
              <span className="text-xs text-slate-500" aria-live="polite">
                Application: {applicationStatus === 'applied'
                  ? 'Applied'
                  : applicationStatus === 'not_applied'
                    ? 'Not Applied'
                    : applicationStateLoaded
                      ? applicationLoadFailed
                        ? 'Unavailable'
                        : 'Not recorded'
                      : 'Loading…'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                disabled={applicationSaving}
                aria-pressed={applicationStatus === 'applied'}
                onClick={() => handleApplicationChange('applied')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait ${applicationStatus === 'applied'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {applicationStatus === 'applied' && <CheckCircle2 className="w-3.5 h-3.5" />}
                Eligible / Applied
              </button>
              <button
                type="button"
                disabled={applicationSaving}
                aria-pressed={applicationStatus === 'not_applied'}
                onClick={() => handleApplicationChange('not_applied')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait ${applicationStatus === 'not_applied'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {applicationStatus === 'not_applied' && <CheckCircle2 className="w-3.5 h-3.5" />}
                Not Eligible / Not Applied
              </button>
            </div>
            {applicationError && (
              <p role="alert" className="text-xs text-rose-600 mt-2">{applicationError}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Eligibility Result ─────────────────────────────────────────────── */}
      {userMatch && elConfig ? (
        <div className={`rounded-xl border p-5 shadow-xs ${elConfig.cls}`}>
          <div className="flex items-center gap-2.5 mb-3">
            {elConfig.icon}
            <h2 className="text-sm font-bold">{elConfig.label}</h2>
          </div>
          <p className="text-xs leading-relaxed mb-4 opacity-90">{elConfig.desc}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/50 rounded-lg p-4 border border-white/80">
            <CriteriaList
              items={userMatch.matched_criteria}
              icon={<CheckCircle className="w-3 h-3" />}
              colorCls="text-emerald-700"
              title="Matched"
            />
            <CriteriaList
              items={userMatch.unmet_criteria}
              icon={<XCircle className="w-3 h-3" />}
              colorCls="text-rose-700"
              title="Not Met"
            />
            <CriteriaList
              items={userMatch.unknown_criteria}
              icon={<AlertTriangle className="w-3 h-3" />}
              colorCls="text-amber-700"
              title="Unverified"
            />
          </div>

          {userMatch.reasons && userMatch.reasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/50">
              <p className="text-[11px] font-semibold mb-1 opacity-80">Evaluation notes</p>
              <ul className="space-y-0.5">
                {userMatch.reasons.map((r, i) => (
                  <li key={i} className="text-xs opacity-80 flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {shouldShowQualificationMismatchDisclaimer(userMatch) && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold leading-relaxed">
                    Important eligibility note
                  </p>
                  <p className="text-[11px] leading-relaxed mt-1">
                    This result is based on the qualifications explicitly stated in the official notification. Some government application forms may provide an "Other", "Equivalent", or similar option for qualifications or branches not explicitly listed. Please check the official application form and detailed notification before deciding not to apply.
                  </p>
                  <p className="text-[11px] leading-relaxed mt-1 font-medium">
                    Always verify eligibility on the official source.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-[11px] opacity-60 mt-3">
            Last evaluated: {formatDate(userMatch.evaluated_at)}
          </p>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-center shadow-xs">
          <Info className="w-5 h-5 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No eligibility match on record</p>
          <p className="text-xs text-slate-500 mt-1">
            The eligibility engine will evaluate your profile against this recruitment automatically.
          </p>
        </div>
      )}

      {/* ── Application Window ────────────────────────────────────────────── */}
      {(rec.application_start || rec.application_end) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            Application Window
          </h2>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Opens</span>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(rec.application_start)}</div>
            </div>
            <div className="flex-1 h-px bg-slate-200" />
            <div className="text-right">
              <span className="text-slate-400 font-medium">Closes</span>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(rec.application_end)}</div>
            </div>
          </div>
          {days !== null && days > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className={`text-xs font-semibold flex items-center gap-1.5 ${days <= 7 ? 'text-rose-600' : days <= 14 ? 'text-amber-600' : 'text-emerald-600'}`}>
                <Clock className="w-3.5 h-3.5" />
                {days} day{days !== 1 ? 's' : ''} remaining to apply
              </div>
            </div>
          )}
          {days !== null && days < 0 && (
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">Application window has closed.</p>
          )}
        </div>
      )}

      {/* ── Vacancies ─────────────────────────────────────────────────────── */}
      {rec.vacancies != null && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{rec.vacancies.toLocaleString()}</div>
            <div className="text-xs text-slate-500 font-medium">Total posts advertised</div>
          </div>
        </div>
      )}

      {/* ── Event Timeline ────────────────────────────────────────────────── */}
      {events.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Event Timeline</h2>
          <div className="relative">
            {/* vertical rule */}
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-100" />
            <div className="space-y-5">
              {events.map((ev, i) => {
                const isCls = eventColorCls(ev.event_type);
                const icon = eventIcon(ev.event_type);
                return (
                  <div key={ev.id} className="relative pl-9">
                    {/* dot */}
                    <div className={`absolute left-1.5 top-1 w-4 h-4 rounded-full border flex items-center justify-center ${isCls}`}>
                      <span className="scale-75">{icon}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${isCls}`}>
                          {ev.event_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">{formatDate(ev.created_at)}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 mt-0.5">{ev.title}</h4>
                    {ev.description && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ev.description}</p>
                    )}
                    {ev.official_url && (
                      <a
                        href={ev.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Official source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {i < events.length - 1 && <div className="mt-4" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Actions ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white px-3 py-1.5 rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <Link
          to="/notifications"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white px-3 py-1.5 rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
        >
          All Events
        </Link>
      </div>
    </div>
  );
}
