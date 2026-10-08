import { runRecruitmentMonitoring } from './monitoring.service.js';

let schedulerIntervalHandle: NodeJS.Timeout | null = null;

export interface SchedulerConfig {
  enabled: boolean;
  intervalMinutes: number;
}

/**
 * Read scheduler configuration from environment variables.
 * Default: disabled (enabled = false), interval = 1440 mins (24 hours).
 */
export function getSchedulerConfig(): SchedulerConfig {
  const enabledStr = process.env.RECRUITMENT_MONITOR_ENABLED?.toLowerCase() ?? 'true';
  const enabled = enabledStr === 'true' || enabledStr === '1';
  const intervalMinutes = parseInt(process.env.RECRUITMENT_MONITOR_INTERVAL_MINUTES || '360', 10);

  return {
    enabled,
    intervalMinutes: isNaN(intervalMinutes) || intervalMinutes < 5 ? 360 : intervalMinutes,
  };
}

/**
 * Initialize the automated recruitment monitoring scheduler.
 * Controlled strictly by environment variables.
 */
export function initMonitoringScheduler(): void {
  const config = getSchedulerConfig();

  if (!config.enabled) {
    console.log('[SchedulerService] Automated recruitment monitoring scheduler is DISABLED (RECRUITMENT_MONITOR_ENABLED=false).');
    return;
  }

  const intervalMs = config.intervalMinutes * 60 * 1000;
  console.log(`[SchedulerService] Initializing recruitment monitoring scheduler (interval: ${config.intervalMinutes} minutes)...`);

  if (schedulerIntervalHandle) {
    clearInterval(schedulerIntervalHandle);
  }

  schedulerIntervalHandle = setInterval(() => {
    console.log('[SchedulerService] Scheduled timer triggered monitoring run...');
    runRecruitmentMonitoring({ skipCollection: false })
      .then((summary) => {
        console.log(`[SchedulerService] Scheduled run finished with status: ${summary.status}`);
      })
      .catch((err) => {
        console.error('[SchedulerService] Scheduled run failed with error:', err.message);
      });
  }, intervalMs);
}

/**
 * Stop active scheduler timer (useful during graceful shutdown or testing).
 */
export function stopMonitoringScheduler(): void {
  if (schedulerIntervalHandle) {
    clearInterval(schedulerIntervalHandle);
    schedulerIntervalHandle = null;
    console.log('[SchedulerService] Scheduler timer stopped.');
  }
}
