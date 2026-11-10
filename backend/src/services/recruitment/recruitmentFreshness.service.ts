import { normalizeDate, getKolkataDateString } from './normalization.service.js';

export interface RecruitmentLike {
  id?: string;
  status?: string | null;
  notification_date?: string | null;
  application_start?: string | null;
  application_end?: string | null;
  created_at?: string | null;
  notification_number?: string | null;
  title?: string;
  organization?: string;
}

export function getFreshnessEnvConfig() {
  const recentDays = parseInt(process.env.RECRUITMENT_RECENT_DAYS || '60', 10) || 60;
  const upcomingDays = parseInt(process.env.RECRUITMENT_UPCOMING_DAYS || '30', 10) || 30;
  const notificationDays = parseInt(process.env.RECRUITMENT_NOTIFICATION_DAYS || '30', 10) || 30;
  return { recentDays, upcomingDays, notificationDays };
}

/**
 * Determines whether a recruitment item is CURRENT / RELEVANT for active tracking.
 * Uses Asia/Kolkata timezone calendar date comparisons.
 */
export function isRecruitmentCurrentOrRelevant(
  rec: RecruitmentLike,
  now = new Date()
): boolean {
  const { recentDays, upcomingDays } = getFreshnessEnvConfig();

  const todayStr = getKolkataDateString(now);
  const normAppStart = normalizeDate(rec.application_start);
  const normAppEnd = normalizeDate(rec.application_end);
  const normNotifDate = normalizeDate(rec.notification_date);

  const todayMs = new Date(`${todayStr}T00:00:00+05:30`).getTime();
  const recentCutoffMs = todayMs - recentDays * 24 * 60 * 60 * 1000;
  const upcomingCutoffMs = todayMs + upcomingDays * 24 * 60 * 60 * 1000;

  const appStartMs = normAppStart ? new Date(`${normAppStart}T00:00:00+05:30`).getTime() : null;
  const appEndMs = normAppEnd ? new Date(`${normAppEnd}T00:00:00+05:30`).getTime() : null;
  const officialNotifMs = normNotifDate ? new Date(`${normNotifDate}T00:00:00+05:30`).getTime() : null;

  // 1. If application_end has passed before today, it is closed/historical.
  if (normAppEnd && todayStr > normAppEnd) {
    if (officialNotifMs !== null && officialNotifMs >= recentCutoffMs) {
      return true;
    }
    return false;
  }

  // 2. Application is currently open (start <= today AND end >= today)
  if (normAppStart && normAppStart <= todayStr) {
    if (!normAppEnd || normAppEnd >= todayStr) {
      return true;
    }
  }

  // 3. Application is upcoming (start > today AND start <= upcomingCutoff)
  if (appStartMs !== null && appStartMs > todayMs) {
    if (appStartMs <= upcomingCutoffMs) {
      return true;
    }
  }

  // 4. Recently published official notification date
  if (officialNotifMs !== null && officialNotifMs >= recentCutoffMs) {
    return true;
  }

  // 5. Year check in notification_number or title (e.g. "07/2026", "CEN 01/2026", "CEN 03/2018")
  const notifStr = `${rec.notification_number || ''} ${rec.title || ''}`;
  const yearMatch = notifStr.match(/(?:19|20)[0-9]{2}/);
  if (yearMatch) {
    const notifYear = parseInt(yearMatch[0], 10);
    const currentYear = parseInt(todayStr.split('-')[0], 10);
    if (notifYear >= currentYear) {
      return true;
    }
    if (notifYear < currentYear) {
      return false;
    }
  }

  // 6. Explicit status check ONLY if official notification date is recent
  if (rec.status === 'open' || rec.status === 'closing_soon' || rec.status === 'upcoming') {
    if (officialNotifMs !== null && officialNotifMs >= recentCutoffMs) {
      return true;
    }
  }

  return false;
}

/**
 * Derives appropriate recruitment status ('open', 'upcoming', 'closed')
 * based on application dates and notification date using Asia/Kolkata timezone.
 *
 * Application window:
 * - Upcoming: opening date is in the future.
 * - Open: current date is on or after the opening date and on or before the closing date.
 *         The closing date remains inclusive for the entire stated closing day.
 * - Closed: closing date has passed.
 */
export function deriveRecruitmentStatus(
  appStart: string | null,
  appEnd: string | null,
  notifDate: string | null,
  notifNum: string | null,
  now = new Date()
): 'open' | 'upcoming' | 'closed' {
  const todayStr = getKolkataDateString(now); // Asia/Kolkata YYYY-MM-DD

  const normStart = normalizeDate(appStart);
  const normEnd = normalizeDate(appEnd);

  if (normStart && normEnd) {
    if (todayStr < normStart) {
      return 'upcoming';
    } else if (todayStr >= normStart && todayStr <= normEnd) {
      return 'open';
    } else {
      return 'closed';
    }
  }

  if (normEnd) {
    if (todayStr > normEnd) return 'closed';
    return 'open';
  }

  if (normStart) {
    if (todayStr < normStart) return 'upcoming';
    return 'open';
  }

  if (notifDate) {
    const normNotif = normalizeDate(notifDate);
    if (normNotif) {
      const { recentDays } = getFreshnessEnvConfig();
      const notifTime = new Date(`${normNotif}T00:00:00+05:30`).getTime();
      const cutoffTime = now.getTime() - recentDays * 24 * 60 * 60 * 1000;
      if (notifTime < cutoffTime) {
        return 'closed';
      }
    }
  }

  if (notifNum) {
    const yearMatch = notifNum.match(/(?:19|20)[0-9]{2}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      const currentYear = parseInt(todayStr.split('-')[0], 10);
      if (year < currentYear) {
        return 'closed';
      }
    }
  }

  return 'upcoming';
}

/**
 * Filter for recruitment events to prevent old imported notifications from dominating feed.
 */
export function isEventRecentAndRelevant(
  event: {
    event_type: string;
    event_date?: string | null;
    created_at?: string | null;
    recruitments?: RecruitmentLike | null;
  },
  now = new Date()
): boolean {
  const { notificationDays, recentDays } = getFreshnessEnvConfig();
  const todayMs = now.getTime();
  const notifCutoffMs = todayMs - notificationDays * 24 * 60 * 60 * 1000;
  const recentCutoffMs = todayMs - recentDays * 24 * 60 * 60 * 1000;

  const rec = event.recruitments;

  // 1. Initial discovery / notification / applications opened events MUST belong to a current/recent recruitment
  if (
    event.event_type === 'notification' ||
    event.event_type === 'NEW_RECRUITMENT' ||
    event.event_type === 'application_opened'
  ) {
    if (!rec) return false;
    if (!isRecruitmentCurrentOrRelevant(rec, now)) {
      return false;
    }
    // Also check year in recruitment notification_number or title
    const notifStr = `${rec.notification_number || ''} ${rec.title || ''}`;
    const yearMatch = notifStr.match(/(?:19|20)[0-9]{2}/);
    if (yearMatch) {
      const notifYear = parseInt(yearMatch[0], 10);
      const currentYear = parseInt(getKolkataDateString(now).split('-')[0], 10);
      if (notifYear < currentYear) {
        return false;
      }
    }
    // If the recruitment is current or relevant, display the notification event
    return true;
  }

  // 2. Update events (result, admit_card, corrigendum, etc.) must have occurred within notificationDays
  const eventDateMs = event.event_date ? new Date(event.event_date).getTime() : null;
  const createdAtMs = event.created_at ? new Date(event.created_at).getTime() : null;
  const effectiveEventMs = (eventDateMs && !isNaN(eventDateMs)) ? eventDateMs : createdAtMs;

  if (effectiveEventMs && !isNaN(effectiveEventMs)) {
    if (effectiveEventMs < notifCutoffMs) {
      return false;
    }
  }

  return true;
}
