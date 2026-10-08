import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Modal } from '../components/common/Modal.js';
import { useAuth } from '../context/AuthContext.js';
import { profileApi, recruitmentApi } from '../lib/api.js';
import type { FullProfile } from '../types/api.types.js';
import type {
  DashboardSummary,
  UserMatch,
  EligibilityStatus,
  RecruitmentStatus,
} from '../types/recruitment.types.js';
import {
  Building2,
  UserCheck,
  CheckCircle,
  ShieldCheck,
  Briefcase,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  CalendarDays,
  ArrowRight,
  RefreshCw,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface DashboardPageProps {
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function orgColor(org: string): string {
  const map: Record<string, string> = {
    SSC: 'bg-blue-50 text-blue-700 border-blue-200',
    APPSC: 'bg-violet-50 text-violet-700 border-violet-200',
    RRB: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return map[org] ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

function eligibilityBadge(status: EligibilityStatus): { label: string; cls: string; icon: React.ReactNode } {
  const configs = {
    eligible: {
      label: 'Eligible',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    verify: {
      label: 'Verify',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    not_eligible: {
      label: 'Not Eligible',
      cls: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  return configs[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: null };
}

function recruitmentStatusBadge(status: RecruitmentStatus): { label: string; cls: string } {
  const configs: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-emerald-50 text-emerald-700' },
    closing_soon: { label: 'Closing Soon', cls: 'bg-amber-50 text-amber-800' },
    upcoming: { label: 'Upcoming', cls: 'bg-sky-50 text-sky-700' },
    closed: { label: 'Closed', cls: 'bg-slate-100 text-slate-500' },
    cancelled: { label: 'Cancelled', cls: 'bg-rose-50 text-rose-700' },
  };
  return configs[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' };
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  colorCls,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorCls: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`bg-white rounded-xl border border-slate-200 p-4 shadow-xs text-left w-full transition-all ${onClick ? 'hover:border-slate-300 hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colorCls}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5 font-medium">{label}</div>
    </button>
  );
}

function JobCard({ match, navigate }: { match: UserMatch; navigate: ReturnType<typeof useNavigate> }) {
  const rec = match.recruitments;
  const elBadge = eligibilityBadge(match.eligibility_status);
  const recBadge = recruitmentStatusBadge(rec.status);
  const orgCls = orgColor(rec.organization);
  const days = daysUntil(rec.application_end);

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all cursor-pointer group"
      onClick={() => navigate(`/recruitments/${rec.id}`)}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${orgCls}`}>
            {rec.organization}
          </span>
          <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded ${recBadge.cls}`}>
            {recBadge.label}
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${elBadge.cls} flex-shrink-0`}>
          {elBadge.icon}
          {elBadge.label}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-slate-900 leading-snug mb-1 group-hover:text-indigo-700 transition-colors">
        {rec.title}
      </h3>

      {rec.notification_number && (
        <p className="text-[11px] text-slate-400 mb-2">Notification: {rec.notification_number}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
        {rec.application_end && (
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            Deadline: {formatDate(rec.application_end)}
            {days !== null && days >= 0 && days <= 14 && (
              <span className="text-amber-600 font-semibold ml-1">({days}d left)</span>
            )}
          </span>
        )}
        {rec.vacancies != null && (
          <span className="flex items-center gap-1">
            <Briefcase className="w-3 h-3" />
            {rec.vacancies.toLocaleString()} posts
          </span>
        )}
        <span className="ml-auto text-indigo-500 font-semibold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
          View details <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export function DashboardPage({ onShowToast }: DashboardPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentJobs, setRecentJobs] = useState<UserMatch[]>([]);
  const [openRecruitments, setOpenRecruitments] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingOpenRecruitments, setLoadingOpenRecruitments] = useState(false);
  const [isCheckingNow, setIsCheckingNow] = useState(false);
  const [isOpenRecruitmentsModalOpen, setIsOpenRecruitmentsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'eligible' | 'verify' | 'not_eligible' | 'all'>('eligible');

  // Profile completion
  const calculateCompletion = (): number => {
    if (!profile) return 0;
    const checks = [
      profile.profile?.full_name,
      profile.profile?.date_of_birth,
      profile.profile?.gender,
      profile.profile?.state_of_domicile,
      profile.profile?.reservation_category,
      profile.education?.tenth?.board,
      profile.education?.tenth?.percentage,
      profile.education?.twelfth?.stream,
      profile.education?.twelfth?.percentage,
      profile.education?.graduation?.degree,
      profile.education?.graduation?.branch,
    ];
    const filled = checks.filter((c) => Boolean(c && String(c).trim() !== '')).length;
    return Math.round((filled / checks.length) * 100);
  };

  const completionPercent = calculateCompletion();

  // Fetch profile
  useEffect(() => {
    profileApi.get()
      .then(({ data }) => setProfile(data as FullProfile))
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  // Fetch dashboard summary
  const fetchDashboardSummary = useCallback(() => {
    setLoadingSummary(true);
    recruitmentApi.getDashboardSummary()
      .then(({ data }) => setSummary(data as DashboardSummary))
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }, []);

  useEffect(() => { fetchDashboardSummary(); }, [fetchDashboardSummary]);

  // Fetch recent jobs — re-fetch when filter changes
  const fetchJobs = useCallback(() => {
    setLoadingJobs(true);
    recruitmentApi.getRelevant({ status: statusFilter, limit: 6, page: 1 })
      .then(({ data }) => {
        const res = data as { recruitments: UserMatch[] };
        setRecentJobs(res.recruitments ?? []);
      })
      .catch(() => setRecentJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [statusFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const fetchOpenRecruitments = useCallback(async () => {
    setLoadingOpenRecruitments(true);
    try {
      const { data } = await recruitmentApi.getOpen();
      const res = data as { recruitments?: any[] };
      setOpenRecruitments(res.recruitments ?? []);
      return res.recruitments ?? [];
    } catch {
      setOpenRecruitments([]);
      return [];
    } finally {
      setLoadingOpenRecruitments(false);
    }
  }, []);

  const handleOpenNowClick = async () => {
    const items = await fetchOpenRecruitments();
    if (items.length > 0 || !loadingOpenRecruitments) {
      setIsOpenRecruitmentsModalOpen(true);
    }
  };

  const handleCheckNow = async () => {
    setIsCheckingNow(true);
    try {
      const { data } = await recruitmentApi.checkNow();
      const newCount = data.newRecruitments || 0;
      const updCount = data.changedRecruitments || 0;
      const docsCount = data.documents?.processed || 0;

      let msg = '';
      if (newCount > 0 || updCount > 0 || docsCount > 0) {
        const parts = [];
        if (newCount > 0) parts.push(`${newCount} new recruitment${newCount > 1 ? 's' : ''}`);
        if (updCount > 0) parts.push(`${updCount} update${updCount > 1 ? 's' : ''}`);
        if (docsCount > 0) parts.push(`${docsCount} document${docsCount > 1 ? 's' : ''} processed`);
        msg = `Check complete — ${parts.join(', ')}.`;
      } else {
        msg = 'Check complete — no new recruitment updates found.';
      }

      if (onShowToast) onShowToast(msg, 'success');

      fetchDashboardSummary();
      fetchJobs();
    } catch (err: any) {
      if (err.response?.status === 429) {
        const cooldownMsg = err.response?.data?.message || 'You can check again in about 2 hours.';
        if (onShowToast) onShowToast(cooldownMsg, 'warning');
      } else if (err.response?.status === 409) {
        if (onShowToast) onShowToast('A recruitment monitoring run is already in progress.', 'info');
      } else {
        if (onShowToast) onShowToast('Check completed with some errors. Could not complete monitoring.', 'warning');
      }
    } finally {
      setIsCheckingNow(false);
    }
  };

  const totalRelevant = (summary?.eligible ?? 0) + (summary?.verify ?? 0);
  const hasData = !loadingSummary && summary !== null;
  const hasJobs = !loadingJobs && recentJobs.length > 0;

  return (
    <div className="space-y-6 pb-12 max-w-5xl">
      {/* ── Greeting Header ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.username} 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {hasData && totalRelevant > 0
              ? `${totalRelevant} relevant recruitment${totalRelevant > 1 ? 's' : ''} found for your profile.`
              : 'Your SarkariJob recruitment dashboard'}
          </p>

          {/* Profile Completion */}
          {!loadingProfile && (
            <div className="mt-3 flex items-center gap-2.5 text-xs flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Eligibility Profile: <strong className="text-slate-800">{completionPercent}%</strong></span>
              </div>
              {completionPercent < 100 ? (
                <button
                  onClick={() => navigate('/profile')}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer text-xs"
                >
                  Complete profile →
                </button>
              ) : (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Profile Complete
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>SSC · APPSC · RRB</span>
          </div>
          <button
            onClick={handleCheckNow}
            disabled={isCheckingNow}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 ${isCheckingNow ? 'animate-spin' : ''}`} />
            <span>{isCheckingNow ? 'Checking...' : 'Check Now'}</span>
          </button>
          <button
            onClick={fetchJobs}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary Stats Grid ─────────────────────────────────────────────── */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-24 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-slate-100 mb-3" />
              <div className="h-5 w-12 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Eligible"
            value={summary.eligible}
            icon={<CheckCircle className="w-4 h-4" />}
            colorCls="bg-emerald-50 text-emerald-600"
            onClick={() => setStatusFilter('eligible')}
          />
          <StatCard
            label="Needs Verification"
            value={summary.verify}
            icon={<AlertTriangle className="w-4 h-4" />}
            colorCls="bg-amber-50 text-amber-600"
            onClick={() => setStatusFilter('verify')}
          />
          <StatCard
            label="Open Now"
            value={summary.open}
            icon={<Zap className="w-4 h-4" />}
            colorCls="bg-sky-50 text-sky-600"
            onClick={handleOpenNowClick}
          />
          <StatCard
            label="Recent Changes"
            value={summary.recentChanges}
            icon={<TrendingUp className="w-4 h-4" />}
            colorCls="bg-violet-50 text-violet-600"
            onClick={() => navigate('/notifications')}
          />
        </div>
      ) : null}

      <Modal
        isOpen={isOpenRecruitmentsModalOpen}
        onClose={() => setIsOpenRecruitmentsModalOpen(false)}
        title="Open Now"
      >
        {loadingOpenRecruitments ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading open recruitments…
          </div>
        ) : openRecruitments.length === 0 ? (
          <p className="text-sm text-slate-500">No recruitments are currently open.</p>
        ) : (
          <div className="space-y-3">
            {openRecruitments.map((rec) => (
              <button
                key={rec.id}
                onClick={() => {
                  setIsOpenRecruitmentsModalOpen(false);
                  navigate(`/recruitments/${rec.id}`);
                }}
                className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 p-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${orgColor(rec.organization)}`}>
                    {rec.organization}
                  </span>
                  {rec.days_remaining !== null && rec.days_remaining !== undefined && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      {rec.days_remaining}d left
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-900 leading-snug">{rec.title}</div>
                {rec.notification_number && (
                  <div className="text-[11px] text-slate-500 mt-1">Notification: {rec.notification_number}</div>
                )}
                {rec.application_end && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    Deadline: {formatDate(rec.application_end)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Relevant Jobs ──────────────────────────────────────────────────── */}
      <div>
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <h3 className="text-sm font-bold text-slate-900">Relevant Recruitments</h3>
          <div className="flex items-center gap-1.5">
            {(['eligible', 'verify', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {s === 'eligible' ? 'Eligible' : s === 'verify' ? 'Verify' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Job Cards */}
        {loadingJobs ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-28 animate-pulse">
                <div className="flex gap-2 mb-3">
                  <div className="w-12 h-5 bg-slate-100 rounded" />
                  <div className="w-16 h-5 bg-slate-100 rounded" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : hasJobs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentJobs.map((match) => (
              <JobCard key={match.id} match={match} navigate={navigate} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              {statusFilter === 'eligible'
                ? 'No eligible recruitments found yet'
                : statusFilter === 'verify'
                ? 'No recruitments needing verification'
                : 'No recruitments matched your profile yet'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {completionPercent < 100
                ? 'Complete your eligibility profile so SarkariJob can evaluate you against open positions.'
                : 'The monitoring system will evaluate new recruitments as they are collected from official sources.'}
            </p>
            {completionPercent < 100 && (
              <button
                onClick={() => navigate('/profile')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                Complete Eligibility Profile
              </button>
            )}
          </div>
        )}

        {/* View All Link */}
        {hasJobs && (
          <div className="mt-3 text-center">
            <Link
              to="/notifications"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              View all events & timeline <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* ── Source Indicators ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { org: 'SSC', label: 'Staff Selection Commission', sub: 'CGL, CHSL, MTS, CPO', color: 'bg-blue-50 text-blue-700' },
          { org: 'APPSC', label: 'AP Public Service Commission', sub: 'Group I/II/III, Forest Officer', color: 'bg-violet-50 text-violet-700' },
          { org: 'RRB', label: 'Railway Recruitment Board', sub: 'NTPC, ALP, Technicians, Group D', color: 'bg-amber-50 text-amber-700' },
        ].map(({ org, label, sub, color }) => (
          <div key={org} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg font-bold text-xs flex items-center justify-center flex-shrink-0 ${color}`}>
              {org}
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">{label}</h4>
              <p className="text-[11px] text-slate-500">{sub}</p>
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                <Clock className="w-2.5 h-2.5" /> Live monitoring
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
