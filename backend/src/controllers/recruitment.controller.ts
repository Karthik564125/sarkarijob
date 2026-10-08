import type { Request, Response } from 'express';
import { SSCCollector } from '../services/recruitment/collectors/ssc.collector.js';
import { APPSCCollector } from '../services/recruitment/collectors/appsc.collector.js';
import { RRBCollector } from '../services/recruitment/collectors/rrb.collector.js';
import { saveCollectionResults } from '../services/recruitment/source.service.js';
import type { CollectionResult } from '../services/recruitment/types.js';
import { supabase } from '../config/supabase.js';
import { evaluateUserRecruitment } from '../services/recruitment/matching.service.js';
import { runRecruitmentMonitoring, isMonitoringActive } from '../services/recruitment/monitoring.service.js';
import {
  isRecruitmentCurrentOrRelevant,
  isEventRecentAndRelevant,
} from '../services/recruitment/recruitmentFreshness.service.js';

const userLastCheckMap = new Map<string, number>();
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function clearUserLastCheckMap(): void {
  userLastCheckMap.clear();
}

function formatRemainingTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.ceil((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

// ─── POST /api/recruitments/check-now — Manual Check Now Endpoint ────────────
export async function checkNow(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const now = Date.now();
  const ignoreCooldown = req.body?.ignoreCooldown === true || req.query?.ignoreCooldown === 'true';

  const lastCheck = userLastCheckMap.get(userId);
  if (!ignoreCooldown && lastCheck && now - lastCheck < TWO_HOURS_MS) {
    const remainingMs = TWO_HOURS_MS - (now - lastCheck);
    const retryAfterSeconds = Math.ceil(remainingMs / 1000);
    const timeStr = formatRemainingTime(remainingMs);
    res.status(429).json({
      message: `You can check again in about ${timeStr}.`,
      retryAfterSeconds,
    });
    return;
  }

  if (isMonitoringActive()) {
    res.status(409).json({ message: 'A recruitment monitoring run is already in progress.' });
    return;
  }

  try {
    userLastCheckMap.set(userId, now);
    const summary = await runRecruitmentMonitoring({
      skipCollection: req.body?.skipCollection === true || req.query?.skipCollection === 'true',
      limitDocuments: req.body?.limitDocuments ? parseInt(req.body.limitDocuments, 10) : 10,
    });

    const sscNew = summary.sources.ssc?.new ?? 0;
    const appscNew = summary.sources.appsc?.new ?? 0;
    const rrbNew = summary.sources.rrb?.new ?? 0;
    const sscUpd = summary.sources.ssc?.updated ?? 0;
    const appscUpd = summary.sources.appsc?.updated ?? 0;
    const rrbUpd = summary.sources.rrb?.updated ?? 0;
    const sscDisc = summary.sources.ssc?.discovered ?? 0;
    const appscDisc = summary.sources.appsc?.discovered ?? 0;
    const rrbDisc = summary.sources.rrb?.discovered ?? 0;

    const newRecruitments = sscNew + appscNew + rrbNew;
    const changedRecruitments = sscUpd + appscUpd + rrbUpd;

    res.status(200).json({
      status: summary.status,
      durationMs: summary.duration_ms || 0,
      sources: {
        ssc: { discovered: sscDisc, new: sscNew, updated: sscUpd },
        appsc: { discovered: appscDisc, new: appscNew, updated: appscUpd },
        rrb: { discovered: rrbDisc, new: rrbNew, updated: rrbUpd },
      },
      documents: {
        processed: summary.documents_processed,
        skipped: summary.documents_skipped,
        failed: summary.documents_failed,
      },
      newRecruitments,
      changedRecruitments,
      newEvents: newRecruitments + changedRecruitments,
      matchesUpdated: summary.matches_evaluated,
    });
  } catch (err: any) {
    console.error('[checkNow] Error during manual check:', err.message);
    res.status(500).json({ message: 'Check Now monitoring failed.' });
  }
}

// ─── POST /api/recruitments/monitor ──────────────────────────────────────────
// Protected endpoint: Trigger a recruitment monitoring run manually.
export async function triggerMonitoringRun(req: Request, res: Response): Promise<void> {
  if (isMonitoringActive()) {
    res.status(409).json({ message: 'A recruitment monitoring run is already in progress.' });
    return;
  }

  const skipCollection = req.body?.skipCollection === true || req.query?.skipCollection === 'true';
  const limitDocuments = req.body?.limitDocuments ? parseInt(req.body.limitDocuments, 10) : 5;

  try {
    console.log(`[API] Manual monitoring run triggered by user ${req.user!.userId}`);
    const summary = await runRecruitmentMonitoring({
      skipCollection,
      limitDocuments,
    });

    res.status(200).json(summary);
  } catch (err: any) {
    console.error('[API] Monitoring run error:', err.message);
    res.status(500).json({ message: 'Monitoring run failed.', detail: err.message });
  }
}

// ─── GET /api/recruitments — list recent recruitments ──────────────────────────
export async function getRecruitments(_req: Request, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('recruitments')
    .select('id, organization, title, notification_number, application_start, application_end, status, source_url, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    res.status(500).json({ message: 'Failed to fetch recruitments.' });
    return;
  }

  res.status(200).json({ recruitments: data ?? [] });
}

// ─── POST /api/recruitments/:recruitmentId/application ─────────────────────
// Application decisions are user-specific and never update eligibility matches.
export async function saveApplicationDecision(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const recruitmentId = String(req.params.recruitmentId || '');
  const applicationStatus = req.body?.application_status;

  if (!/^[0-9a-f-]{36}$/i.test(recruitmentId)) {
    res.status(400).json({ message: 'Invalid recruitment ID.' });
    return;
  }

  if (applicationStatus !== 'applied' && applicationStatus !== 'not_applied') {
    res.status(400).json({ message: 'application_status must be applied or not_applied.' });
    return;
  }

  const { data, error } = await supabase
    .from('user_recruitment_applications')
    .upsert(
      { user_id: userId, recruitment_id: recruitmentId, application_status: applicationStatus },
      { onConflict: 'user_id,recruitment_id' }
    )
    .select('id, recruitment_id, application_status, created_at, updated_at')
    .single();

  if (error) {
    console.error('[saveApplicationDecision] supabase error:', error.message);
    if (error.code === '23503') {
      res.status(404).json({ message: 'Recruitment not found.' });
      return;
    }
    if (error.code === 'PGRST205' || error.code === '42P01') {
      res.status(503).json({ message: 'Application tracking is not available until its database migration is applied.' });
      return;
    }
    res.status(500).json({ message: 'Failed to save application decision.' });
    return;
  }

  res.status(200).json({ application: data });
}

// ─── GET /api/recruitments/applications ─────────────────────────────────────
// Always scoped by the verified JWT user; request filters cannot change ownership.
export async function getUserApplications(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { data, error } = await supabase
    .from('user_recruitment_applications')
    .select(`
      id,
      recruitment_id,
      application_status,
      created_at,
      updated_at,
      recruitments!inner (
        id,
        organization,
        title,
        notification_number,
        application_end,
        status,
        official_page_url
      )
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[getUserApplications] supabase error:', error.message);
    if (error.code === 'PGRST205' || error.code === '42P01') {
      res.status(503).json({ message: 'Application tracking is not available until its database migration is applied.' });
      return;
    }
    res.status(500).json({ message: 'Failed to fetch applications.' });
    return;
  }

  res.status(200).json({ applications: data ?? [] });
}

// ─── POST /api/recruitments/:recruitmentId/evaluate ───────────────────────────
// Security: userId derived strictly from JWT payload.
export async function evaluateMatch(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const recruitmentId = String(req.params.recruitmentId || '');

  if (!recruitmentId || !/^[0-9a-f-]{36}$/i.test(recruitmentId)) {
    res.status(400).json({ message: 'Invalid recruitment ID.' });
    return;
  }

  try {
    const result = await evaluateUserRecruitment(userId, recruitmentId);
    res.status(200).json({
      message: result.isNew ? 'Match evaluated and stored.' : 'Match re-evaluated and updated.',
      recruitmentId: result.recruitmentId,
      notificationNumber: result.notificationNumber,
      status: result.status,
      evaluatedAt: result.evaluatedAt,
      eligibility: result.eligibility,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[evaluateMatch] error:', msg);
    if (msg.includes('not found')) {
      res.status(404).json({ message: msg });
    } else {
      res.status(500).json({ message: 'Evaluation failed.', detail: msg });
    }
  }
}

// ─── GET /api/recruitments/matches — User Match API ───────────────────────────
// Security: userId comes strictly from JWT payload. Never trusts query/body user_id.
// ─── GET /api/recruitments/matches — User Match API ───────────────────────────
// Security: userId comes strictly from JWT payload. Never trusts query/body user_id.
export async function getUserMatches(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const statusFilter = req.query.status as string | undefined;
  const orgFilter = req.query.organization as string | undefined;
  const includeClosed = req.query.includeClosed === 'true';

  const validStatuses = ['eligible', 'verify', 'not_eligible'];
  const validOrgs = ['SSC', 'APPSC', 'RRB'];

  try {
    let query = supabase
      .from('user_recruitment_matches')
      .select(`
        id,
        eligibility_status,
        reasons,
        matched_criteria,
        unmet_criteria,
        unknown_criteria,
        evaluated_at,
        recruitments!inner (
          id,
          organization,
          title,
          notification_number,
          recruitment_type,
          vacancies,
          notification_date,
          application_start,
          application_end,
          exam_date,
          official_page_url,
          official_pdf_url,
          status,
          last_changed_at
        )
      `)
      .eq('user_id', userId);

    if (statusFilter && validStatuses.includes(statusFilter)) {
      query = query.eq('eligibility_status', statusFilter);
    }

    if (orgFilter && validOrgs.includes(orgFilter.toUpperCase())) {
      query = query.eq('recruitments.organization', orgFilter.toUpperCase());
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getUserMatches] supabase error:', error.message);
      res.status(500).json({ message: 'Failed to fetch user matches.' });
      return;
    }

    let matches = data ?? [];

    if (!includeClosed) {
      matches = matches.filter((m: any) => isRecruitmentCurrentOrRelevant(m.recruitments));
    }

    // Sensible sorting: open/closing_soon first, then upcoming, then newest
    const sorted = matches.sort((a: any, b: any) => {
      const statusRank: Record<string, number> = {
        open: 1,
        closing_soon: 2,
        upcoming: 3,
        closed: 4,
        cancelled: 5,
      };
      const rankA = statusRank[a.recruitments?.status] ?? 99;
      const rankB = statusRank[b.recruitments?.status] ?? 99;
      if (rankA !== rankB) return rankA - rankB;

      const dateA = new Date(a.recruitments?.last_changed_at || a.evaluated_at).getTime();
      const dateB = new Date(b.recruitments?.last_changed_at || b.evaluated_at).getTime();
      return dateB - dateA;
    });

    res.status(200).json({
      total: sorted.length,
      matches: sorted,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getUserMatches] error:', msg);
    res.status(500).json({ message: 'Failed to fetch user matches.' });
  }
}

// ─── GET /api/recruitments/relevant — Relevant Recruitments Endpoint ─────────
// Security: Returns user's matched relevant recruitments (default: eligible & verify).
export async function getRelevantRecruitments(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const statusFilter = req.query.status as string | undefined;
  const orgFilter = req.query.organization as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '20', 10)));

  const validOrgs = ['SSC', 'APPSC', 'RRB'];

  try {
    let query = supabase
      .from('recruitments')
      .select('*')
      .order('created_at', { ascending: false });

    if (orgFilter && validOrgs.includes(orgFilter.toUpperCase())) {
      query = query.eq('organization', orgFilter.toUpperCase());
    }

    const { data: allRecs, error: recErr } = await query;

    if (recErr || !allRecs) {
      console.error('[getRelevantRecruitments] error:', recErr?.message);
      res.status(500).json({ message: 'Failed to fetch relevant recruitments.' });
      return;
    }

    // Filter for CURRENT/RELEVANT recruitments only
    const currentRecs = allRecs.filter((r) => isRecruitmentCurrentOrRelevant(r));
    const currentRecIds = currentRecs.map((r) => r.id);

    // Fetch existing matches for this user
    const matchesMap = new Map<string, any>();
    if (currentRecIds.length > 0) {
      const { data: matches } = await supabase
        .from('user_recruitment_matches')
        .select('*')
        .eq('user_id', userId)
        .in('recruitment_id', currentRecIds);

      (matches || []).forEach((m) => {
        matchesMap.set(m.recruitment_id, m);
      });
    }

    // Combine recruitments with user matches (or default pending match if no match row exists yet)
    const combined = currentRecs.map((rec) => {
      const match = matchesMap.get(rec.id);
      if (match) {
        return {
          id: match.id,
          eligibility_status: match.eligibility_status,
          reasons: match.reasons,
          matched_criteria: match.matched_criteria,
          unmet_criteria: match.unmet_criteria,
          unknown_criteria: match.unknown_criteria,
          evaluated_at: match.evaluated_at,
          recruitments: rec,
        };
      } else {
        return {
          id: `pending-${rec.id}`,
          eligibility_status: 'verify',
          reasons: ['Eligibility verification pending — recruitment recently discovered'],
          matched_criteria: [],
          unmet_criteria: [],
          unknown_criteria: ['Profile evaluation pending'],
          evaluated_at: null,
          recruitments: rec,
        };
      }
    });

    // Apply status filter
    let items = combined;
    if (statusFilter === 'eligible') {
      items = combined.filter((i) => i.eligibility_status === 'eligible');
    } else if (statusFilter === 'verify') {
      items = combined.filter((i) => i.eligibility_status === 'verify' || i.eligibility_status === 'checking');
    } else if (statusFilter === 'not_eligible') {
      items = combined.filter((i) => i.eligibility_status === 'not_eligible');
    } else if (statusFilter !== 'all') {
      // Default: eligible & verify
      items = combined.filter((i) => i.eligibility_status !== 'not_eligible');
    }

    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const from = (page - 1) * limit;
    const paginated = items.slice(from, from + limit);

    res.status(200).json({
      total,
      page,
      limit,
      totalPages,
      recruitments: paginated,
    });
  } catch (err) {
    console.error('[getRelevantRecruitments] error:', err);
    res.status(500).json({ message: 'Failed to fetch relevant recruitments.' });
  }
}

// ─── GET /api/recruitments/dashboard-summary — Dashboard Summary API ──────────
// Security: Computes counters strictly for the authenticated user.
export async function getDashboardSummary(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    const { data: allRecs, error: recErr } = await supabase
      .from('recruitments')
      .select('id, status, last_changed_at, notification_date, application_start, application_end, notification_number');

    if (recErr || !allRecs) {
      console.error('[getDashboardSummary] error:', recErr?.message);
      res.status(500).json({ message: 'Failed to calculate dashboard summary.' });
      return;
    }

    // Filter for CURRENT/RELEVANT recruitments only
    const currentRecs = allRecs.filter((r) => isRecruitmentCurrentOrRelevant(r));
    const currentRecIds = currentRecs.map((r) => r.id);

    const matchesMap = new Map<string, string>();
    if (currentRecIds.length > 0) {
      const { data: matches } = await supabase
        .from('user_recruitment_matches')
        .select('recruitment_id, eligibility_status')
        .eq('user_id', userId)
        .in('recruitment_id', currentRecIds);

      (matches || []).forEach((m) => {
        matchesMap.set(m.recruitment_id, m.eligibility_status);
      });
    }

    const now = new Date();
    // Use IST date string for Indian government recruitment date comparisons
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + istOffset).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let eligible = 0;
    let verify = 0;
    let notEligible = 0;
    let openNow = 0;   // "Open Now" = all active application windows
    let upcoming = 0;
    let recentChanges = 0;

    currentRecs.forEach((r) => {
      const elStatus = matchesMap.get(r.id);
      if (elStatus === 'eligible') {
        eligible++;
      } else if (elStatus === 'not_eligible') {
        notEligible++;
      } else {
        // 'verify' or pending match (includes recruitments with no match row yet)
        verify++;
      }

      // "Open Now" derives from the actual date window (IST), not solely stored db_status.
      // This correctly handles stale db_status (e.g., stored as 'upcoming' but date window says open).
      const appStart = r.application_start;
      const appEnd = r.application_end;
      const isOpenByDate = appStart && appEnd && appStart <= todayStr && appEnd >= todayStr;
      // Fallback: trust stored status for records without date data
      const isOpenByStatus = !appStart && (r.status === 'open' || r.status === 'closing_soon');

      if (isOpenByDate || isOpenByStatus) {
        openNow++;
      } else if (appStart && appStart > todayStr) {
        upcoming++;
      } else if (r.status === 'upcoming' && !appStart) {
        upcoming++;
      }

      if (r.last_changed_at) {
        const changedAt = new Date(r.last_changed_at);
        if (changedAt >= sevenDaysAgo) recentChanges++;
      }
    });

    res.status(200).json({
      eligible,
      verify,
      notEligible,
      open: openNow,
      closingSoon: 0,   // kept for API compatibility; subsumed into open
      upcoming,
      recentChanges,
    });
  } catch (err) {
    console.error('[getDashboardSummary] error:', err);
    res.status(500).json({ message: 'Failed to calculate dashboard summary.' });
  }
}

// ─── GET /api/recruitments/open — Currently Open Recruitments ─────────────────
// Returns the exact list of recruitments responsible for the "Open Now" dashboard count.
// Open Now = active application window (application_start <= today AND application_end >= today).
// Visibility is INDEPENDENT of whether a user_recruitment_matches row exists.
export async function getOpenRecruitments(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    const { data: allRecs, error: recErr } = await supabase
      .from('recruitments')
      .select('id, organization, title, notification_number, notification_date, application_start, application_end, status, official_page_url, official_pdf_url, vacancies, recruitment_type');

    if (recErr || !allRecs) {
      console.error('[getOpenRecruitments] error:', recErr?.message);
      res.status(500).json({ message: 'Failed to fetch open recruitments.' });
      return;
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + istOffset).toISOString().split('T')[0];

    // Filter: currently open by date window OR stored open/closing_soon (for date-less records)
    const openRecs = allRecs.filter((r) => {
      if (!isRecruitmentCurrentOrRelevant(r)) return false;
      const appStart = r.application_start;
      const appEnd = r.application_end;
      const isOpenByDate = appStart && appEnd && appStart <= todayStr && appEnd >= todayStr;
      const isOpenByStatus = !appStart && (r.status === 'open' || r.status === 'closing_soon');
      return isOpenByDate || isOpenByStatus;
    });

    // Sort: closing soonest first, then by organization
    openRecs.sort((a, b) => {
      const endA = a.application_end ? new Date(a.application_end).getTime() : Infinity;
      const endB = b.application_end ? new Date(b.application_end).getTime() : Infinity;
      if (endA !== endB) return endA - endB;
      return (a.organization ?? '').localeCompare(b.organization ?? '');
    });

    // Fetch this user's eligibility matches
    const openIds = openRecs.map((r) => r.id);
    const matchesMap = new Map<string, string>();
    if (openIds.length > 0) {
      const { data: matches } = await supabase
        .from('user_recruitment_matches')
        .select('recruitment_id, eligibility_status')
        .eq('user_id', userId)
        .in('recruitment_id', openIds);
      (matches || []).forEach((m) => matchesMap.set(m.recruitment_id, m.eligibility_status));
    }

    // Compute days remaining and attach eligibility
    const todayMs = new Date(todayStr).getTime();
    const result = openRecs.map((r) => {
      const endMs = r.application_end ? new Date(r.application_end).getTime() : null;
      const daysRemaining = endMs !== null ? Math.ceil((endMs - todayMs) / (24 * 60 * 60 * 1000)) : null;
      return {
        ...r,
        eligibility_status: matchesMap.get(r.id) ?? 'verify',
        days_remaining: daysRemaining,
      };
    });

    res.status(200).json({
      total: result.length,
      recruitments: result,
    });
  } catch (err) {
    console.error('[getOpenRecruitments] error:', err);
    res.status(500).json({ message: 'Failed to fetch open recruitments.' });
  }
}

// ─── GET /api/recruitments/my-events — Recent Events for User ───────────────
// Security: Returns events ONLY for recruitments matching optional organization & user relevance.
export async function getUserEvents(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const orgFilter = req.query.organization as string | undefined;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

  const validOrgs = ['SSC', 'APPSC', 'RRB'];
  const targetOrg = orgFilter && validOrgs.includes(orgFilter.toUpperCase()) ? orgFilter.toUpperCase() : null;

  try {
    let query = supabase
      .from('recruitment_events')
      .select(`
        id,
        recruitment_id,
        event_type,
        title,
        description,
        official_url,
        event_date,
        created_at,
        recruitments!inner (
          id,
          title,
          organization,
          notification_number,
          notification_date,
          application_start,
          application_end,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (targetOrg) {
      query = query.eq('recruitments.organization', targetOrg);
    }

    const { data: events, error: eventErr } = await query;

    if (eventErr || !events) {
      console.error('[getUserEvents] error:', eventErr?.message);
      res.status(500).json({ message: 'Failed to fetch user events.' });
      return;
    }

    // Filter events for freshness and strict organization matching
    let filteredEvents = events.filter((ev: any) => {
      if (targetOrg && ev.recruitments?.organization?.toUpperCase() !== targetOrg) {
        return false;
      }
      return isEventRecentAndRelevant(ev);
    });

    // Sort by meaningful event date (event_date -> notification_date -> created_at)
    filteredEvents.sort((a: any, b: any) => {
      const timeA = new Date(a.event_date || a.recruitments?.notification_date || a.created_at).getTime();
      const timeB = new Date(b.event_date || b.recruitments?.notification_date || b.created_at).getTime();
      return timeB - timeA;
    });

    const total = filteredEvents.length;
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);
    const from = (page - 1) * limit;
    const paginated = filteredEvents.slice(from, from + limit);

    const recruitmentIds = [...new Set(paginated.map((event: any) => event.recruitment_id))];
    const [applicationsResult, matchesResult] = recruitmentIds.length > 0
      ? await Promise.all([
          supabase
            .from('user_recruitment_applications')
            .select('recruitment_id, application_status')
            .eq('user_id', userId)
            .in('recruitment_id', recruitmentIds),
          supabase
            .from('user_recruitment_matches')
            .select('recruitment_id, eligibility_status')
            .eq('user_id', userId)
            .in('recruitment_id', recruitmentIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (applicationsResult.error && applicationsResult.error.code !== 'PGRST205' && applicationsResult.error.code !== '42P01') {
      console.error('[getUserEvents] application state error:', applicationsResult.error.message);
    }
    if (matchesResult.error) {
      console.error('[getUserEvents] eligibility state error:', matchesResult.error.message);
    }

    const applicationStatusByRecruitment = new Map(
      (applicationsResult.data ?? []).map((application: any) => [application.recruitment_id, application.application_status])
    );
    const eligibilityByRecruitment = new Map(
      (matchesResult.data ?? []).map((match: any) => [match.recruitment_id, match.eligibility_status])
    );
    const eventsWithUserState = paginated.map((event: any) => ({
      ...event,
      eligibility: { status: eligibilityByRecruitment.get(event.recruitment_id) ?? null },
      application: { status: applicationStatusByRecruitment.get(event.recruitment_id) ?? null },
    }));

    res.status(200).json({
      total,
      page,
      limit,
      totalPages,
      events: eventsWithUserState,
    });
  } catch (err) {
    console.error('[getUserEvents] error:', err);
    res.status(500).json({ message: 'Failed to fetch user events.' });
  }
}

// ─── GET /api/recruitments/:recruitmentId — Recruitment Detail Endpoint ──────
// Security: Returns recruitment details, user match (if any), and events.
export async function getRecruitmentDetail(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const recruitmentId = String(req.params.recruitmentId || '');

  if (!recruitmentId || !/^[0-9a-f-]{36}$/i.test(recruitmentId)) {
    res.status(400).json({ message: 'Invalid recruitment ID.' });
    return;
  }

  try {
    // 1. Fetch recruitment
    const { data: recruitment, error: recErr } = await supabase
      .from('recruitments')
      .select('*')
      .eq('id', recruitmentId)
      .maybeSingle();

    if (recErr || !recruitment) {
      res.status(404).json({ message: 'Recruitment not found.' });
      return;
    }

    // 2. Fetch current user's match
    const { data: userMatch } = await supabase
      .from('user_recruitment_matches')
      .select('id, eligibility_status, reasons, matched_criteria, unmet_criteria, unknown_criteria, evaluated_at')
      .eq('user_id', userId)
      .eq('recruitment_id', recruitmentId)
      .maybeSingle();

    // 3. Fetch recent events for this recruitment
    const { data: events } = await supabase
      .from('recruitment_events')
      .select('id, event_type, title, description, official_url, event_date, created_at')
      .eq('recruitment_id', recruitmentId)
      .order('created_at', { ascending: false })
      .limit(20);

    res.status(200).json({
      recruitment,
      userMatch: userMatch ?? null,
      events: events ?? [],
    });
  } catch (err) {
    console.error('[getRecruitmentDetail] error:', err);
    res.status(500).json({ message: 'Failed to fetch recruitment details.' });
  }
}

// ─── DEV/TEST: Trigger SSC collector ─────────────────────────────────────────

export async function triggerSSCCollection(_req: Request, res: Response): Promise<void> {
  console.log('[SSC] Manual collection triggered via API');
  const collector = new SSCCollector();
  try {
    const items = await collector.collect();
    console.log(`[SSC] Discovered ${items.length} item(s), saving to Supabase...`);
    const result = await saveCollectionResults(items, collector.organization);
    res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[SSC] Collection failed: ${msg}`);
    const errorResult: CollectionResult = {
      organization: 'SSC',
      success: false,
      discovered: 0,
      new: 0,
      updated: 0,
      unchanged: 0,
      documents: 0,
      errors: [msg],
    };
    res.status(500).json(errorResult);
  }
}

// ─── DEV/TEST: Trigger APPSC collector ───────────────────────────────────────

export async function triggerAPPSCCollection(_req: Request, res: Response): Promise<void> {
  console.log('[APPSC] Manual collection triggered via API');
  const collector = new APPSCCollector();
  try {
    const items = await collector.collect();
    console.log(`[APPSC] Discovered ${items.length} item(s), saving to Supabase...`);
    const result = await saveCollectionResults(items, collector.organization);
    res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[APPSC] Collection failed: ${msg}`);
    const errorResult: CollectionResult = {
      organization: 'APPSC',
      success: false,
      discovered: 0,
      new: 0,
      updated: 0,
      unchanged: 0,
      documents: 0,
      errors: [msg],
    };
    res.status(500).json(errorResult);
  }
}

// ─── DEV/TEST: Trigger RRB collector ─────────────────────────────────────────

export async function triggerRRBCollection(_req: Request, res: Response): Promise<void> {
  console.log('[RRB] Manual collection triggered via API');
  const collector = new RRBCollector();
  try {
    const items = await collector.collect();
    console.log(`[RRB] Discovered ${items.length} item(s), saving to Supabase...`);
    const result = await saveCollectionResults(items, collector.organization);
    res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[RRB] Collection failed: ${msg}`);
    const errorResult: CollectionResult = {
      organization: 'RRB',
      success: false,
      discovered: 0,
      new: 0,
      updated: 0,
      unchanged: 0,
      documents: 0,
      errors: [msg],
    };
    res.status(500).json(errorResult);
  }
}
