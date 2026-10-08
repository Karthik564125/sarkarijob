import type { RawRecruitmentItem } from './types.js';

/**
 * All recruitment source collectors must implement this interface.
 */
export interface RecruitmentCollector {
  /** Short org name — must match the organization column in recruitment_sources */
  readonly organization: string;

  /** Collect raw recruitment items from the official source. */
  collect(): Promise<RawRecruitmentItem[]>;
}
