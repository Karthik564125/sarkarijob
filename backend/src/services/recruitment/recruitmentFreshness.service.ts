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
 * Note: created_at is database insertion timestamp, NOT official government publication date.
 */
export function isRecruitmentCurrentOrRelevant(
  rec: RecruitmentLike,
  now = new Date()
): boolean {
  const { recentDays, upcomingDays } = getFreshnessEnvConfig();

  const todayStr = now.toISOString().split('T')[0];
  const todayMs = new Date(todayStr).getTime();

  const recentCutoffMs = todayMs - recentDays * 24 * 60 * 60 * 1000;
  const upcomingCutoffMs = todayMs + upcomingDays * 24 * 60 * 60 * 1000;

  const appStartMs = rec.application_start ? new Date(rec.application_start).getTime() : null;
  const appEndMs = rec.application_end ? new Date(rec.application_end).getTime() : null;

  let officialNotifMs: number | null = null;
  if (rec.notification_date) {
    const parsed = new Date(rec.notification_date).getTime();
    if (!isNaN(parsed)) officialNotifMs = parsed;
  }

  // 1. If application_end has passed before today, it is closed/historical.
  if (appEndMs !== null && !isNaN(appEndMs) && appEndMs < todayMs) {
    if (officialNotifMs !== null && officialNotifMs >= recentCutoffMs) {
      return true;
    }
    return false;
  }

  // 2. A. Application is currently open (start <= today AND end >= today)
  if (appStartMs !== null && !isNaN(appStartMs) && appStartMs <= todayMs) {
    if (appEndMs === null || isNaN(appEndMs) || appEndMs >= todayMs) {
      return true;
    }
  }

  // 3. B. Application is upcoming (start > today AND start <= upcomingCutoff)
  if (appStartMs !== null && !isNaN(appStartMs) && appStartMs > todayMs) {
    if (appStartMs <= upcomingCutoffMs) {
      return true;
    }
  }

  // 4. C. Recently published official notification date
  if (officialNotifMs !== null && officialNotifMs >= recentCutoffMs) {
    return true;
  }

  // 5. Year check in notification_number or title (e.g. "07/2026", "26/2026", "CEN 01/2026", "CEN 03/2018")
  const notifStr = `${rec.notification_number || ''} ${rec.title || ''}`;
  const yearMatch = notifStr.match(/(?:19|20)[0-9]{2}/);
  if (yearMatch) {
    const notifYear = parseInt(yearMatch[0], 10);
    const currentYear = now.getFullYear();
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
 * Derives appropriate recruitment status ('open', 'closing_soon', 'upcoming', 'closed')
 * based on application dates and notification date.
 */
export function deriveRecruitmentStatus(
  appStart: string | null,
  appEnd: string | null,
  notifDate: string | null,
  notifNum: string | null,
  now = new Date()
): string {
  const todayStr = now.toISOString().split('T')[0];
  const todayMs = new Date(todayStr).getTime();
  const { recentDays } = getFreshnessEnvConfig();
  const recentCutoffMs = todayMs - recentDays * 24 * 60 * 60 * 1000;

  if (appStart && appEnd) {
    const startMs = new Date(appStart).getTime();
    const endMs = new Date(appEnd).getTime();
    const sevenDaysFromNowMs = todayMs + 7 * 24 * 60 * 60 * 1000;

    if (todayMs < startMs) {
      return 'upcoming';
    } else if (todayMs >= startMs && todayMs <= endMs) {
      return endMs <= sevenDaysFromNowMs ? 'closing_soon' : 'open';
    } else {
      return 'closed';
    }
  }

  if (appEnd) {
    const endMs = new Date(appEnd).getTime();
    if (endMs < todayMs) return 'closed';
  }

  if (notifDate) {
    const notifMs = new Date(notifDate).getTime();
    if (!isNaN(notifMs) && notifMs < recentCutoffMs) {
      return 'closed';
    }
  }

  if (notifNum) {
    const yearMatch = notifNum.match(/(?:19|20)[0-9]{2}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      if (year < now.getFullYear()) {
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

  // 1. Initial discovery / notification events MUST belong to a current/recent recruitment
  if (event.event_type === 'notification' || event.event_type === 'NEW_RECRUITMENT') {
    if (!rec) return false;
    if (!isRecruitmentCurrentOrRelevant(rec, now)) {
      return false;
    }
    // Also check year in recruitment notification_number or title
    const notifStr = `${rec.notification_number || ''} ${rec.title || ''}`;
    const yearMatch = notifStr.match(/(?:19|20)[0-9]{2}/);
    if (yearMatch) {
      const notifYear = parseInt(yearMatch[0], 10);
      if (notifYear < now.getFullYear()) {
        return false;
      }
    }
    if (rec.notification_date) {
      const notifMs = new Date(rec.notification_date).getTime();
      if (!isNaN(notifMs) && notifMs < recentCutoffMs) {
        return false;
      }
    }
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
