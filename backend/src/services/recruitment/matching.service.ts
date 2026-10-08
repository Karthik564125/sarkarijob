import { createClient } from '@supabase/supabase-js';
import type { RecruitmentExtraction } from '../ai/extraction.schema.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type EligibilityStatus = 'eligible' | 'verify' | 'not_eligible';

export interface UserProfile {
  date_of_birth: string | null;
  gender: string | null;
  state_of_domicile: string | null;
  reservation_category: string | null;
  education: {
    degree: string | null;
    branch: string | null;
    university: string | null;
    passing_year: number | null;
  } | null;
}

export interface EligibilityResult {
  status: EligibilityStatus;
  reasons: string[];
  matched_criteria: string[];
  unmet_criteria: string[];
  unknown_criteria: string[];
}

// -----------------------------------------------------------------------
// Helper & Normalization Functions
// -----------------------------------------------------------------------

const EDUCATION_LEVEL_RANK: Record<string, number> = {
  '10th': 1,
  'matriculation': 1,
  'ssc': 1,
  '12th': 2,
  'intermediate': 2,
  'hsc': 2,
  'diploma': 3,
  'graduate': 4,
  'graduation': 4,
  "bachelor's degree": 4,
  'bachelors': 4,
  'b.tech': 4,
  'b.e': 4,
  'b.sc': 4,
  'b.com': 4,
  'b.a': 4,
  'bca': 4,
  'bba': 4,
  'llb': 4,
  'post graduate': 5,
  'postgraduate': 5,
  'post-graduate': 5,
  "master's": 5,
  'masters': 5,
  'm.tech': 5,
  'm.sc': 5,
  'm.a': 5,
  'mca': 5,
  'mba': 5,
  'llm': 5,
  'doctorate': 6,
  'phd': 6,
  'ph.d': 6,
};

function normalizeEduLevel(raw: string | null | undefined): number {
  if (!raw) return 0;
  const lower = raw.trim().toLowerCase();
  for (const [key, rank] of Object.entries(EDUCATION_LEVEL_RANK)) {
    if (lower.includes(key)) return rank;
  }
  return 0;
}

function userAgeAt(dobStr: string | null, referenceDate = new Date()): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

/**
 * Strict branch comparison: exact match or strict word-boundary match.
 * Eliminates dangerous bidirectional broad substring matching.
 */
function isBranchMatching(userBranch: string, allowedBranches: string[]): boolean {
  const normUser = normalizeString(userBranch);
  const userWords = normUser.split(' ');

  for (const allowed of allowedBranches) {
    const normAllowed = normalizeString(allowed);
    // Exact match
    if (normUser === normAllowed) return true;
    // Single-word match (e.g. allowed "Computer" matches user "Computer Science")
    if (userWords.includes(normAllowed) || normAllowed.split(' ').includes(normUser)) return true;
  }
  return false;
}

// -----------------------------------------------------------------------
// Pure Deterministic Eligibility Engine
// -----------------------------------------------------------------------

export function evaluateEligibility(
  user: UserProfile,
  rules: RecruitmentExtraction
): EligibilityResult {
  const matched: string[] = [];
  const unmet: string[] = [];
  const unknown: string[] = [];
  const reasons: string[] = [];

  let hasHardFail = false;
  let hasUnknown = false;

  // ── 1. AGE CHECK ──────────────────────────────────────────────────────
  const ageMin = rules.age?.minimum ?? null;
  const ageMax = rules.age?.maximum ?? null;
  const userAge = userAgeAt(user.date_of_birth);

  if (ageMin !== null || ageMax !== null) {
    if (userAge === null) {
      unknown.push('Age: date of birth not set in profile — cannot verify age limit compliance');
      hasUnknown = true;
    } else {
      let ageFail = false;
      if (ageMin !== null && userAge < ageMin) {
        unmet.push(`Age: user is ${userAge} years old, minimum required is ${ageMin}`);
        reasons.push(`Too young: minimum age is ${ageMin}, you are ${userAge}`);
        hasHardFail = true;
        ageFail = true;
      }
      // Apply reservation category relaxation if available
      let effectiveMax = ageMax;
      if (ageMax !== null && user.reservation_category && rules.age?.relaxation) {
        const cat = normalizeString(user.reservation_category);
        for (const [key, val] of Object.entries(rules.age.relaxation)) {
          if (normalizeString(key) === cat) {
            const relaxYears = parseInt(val);
            if (!isNaN(relaxYears)) {
              effectiveMax = ageMax + relaxYears;
            }
          }
        }
      }
      if (effectiveMax !== null && userAge > effectiveMax) {
        unmet.push(`Age: user is ${userAge} years old, maximum allowed is ${effectiveMax} (for ${user.reservation_category ?? 'General'})`);
        reasons.push(`Age exceeded: maximum age is ${effectiveMax}, you are ${userAge}`);
        hasHardFail = true;
        ageFail = true;
      }
      if (!ageFail) {
        matched.push(`Age: ${userAge} years — within required range`);
      }
    }
  } else {
    unknown.push('Age: not explicitly stated in notification');
    hasUnknown = true;
  }

  // ── 2. EDUCATION CHECK ────────────────────────────────────────────────
  const requiredLevel = rules.education?.minimum_level ?? null;
  const allowedBranches = rules.education?.allowed_branches ?? null;
  const requiredSubjects = rules.education?.required_subjects ?? null;

  const userDegree = user.education?.degree ?? null;
  const userBranch = user.education?.branch ?? null;

  // Level check
  if (requiredLevel !== null) {
    const requiredRank = normalizeEduLevel(requiredLevel);
    const userRank = normalizeEduLevel(userDegree);

    if (userDegree === null) {
      unknown.push('Education: graduation record not set in profile — cannot verify degree requirement');
      hasUnknown = true;
    } else if (userRank === 0) {
      unknown.push(`Education: could not determine education level for profile degree "${userDegree}"`);
      hasUnknown = true;
    } else if (requiredRank > 0 && userRank < requiredRank) {
      unmet.push(`Education: required minimum level is "${requiredLevel}", user has "${userDegree}"`);
      reasons.push(`Education requirement not met: need ${requiredLevel}, you have ${userDegree}`);
      hasHardFail = true;
    } else {
      matched.push(`Education level: "${userDegree}" meets minimum required "${requiredLevel}"`);
    }
  } else {
    unknown.push('Education minimum level: not explicitly stated in notification');
    hasUnknown = true;
  }

  // Strict Branch Check
  if (allowedBranches !== null && allowedBranches.length > 0) {
    if (userBranch === null) {
      unknown.push('Branch: no branch specified in profile — cannot verify allowed branch requirement');
      hasUnknown = true;
    } else {
      const isMatched = isBranchMatching(userBranch, allowedBranches);
      if (isMatched) {
        matched.push(`Branch: "${userBranch}" matches allowed branches`);
      } else if (requiredSubjects !== null && requiredSubjects.length > 0) {
        // If required_subjects is also present, branch cannot be hard-failed because user branch may correspond to a required subject
        unknown.push(`Branch/Subjects: user branch "${userBranch}" is not in allowed branches [${allowedBranches.join(', ')}], but recruitment also specifies required subjects — manual verification required`);
        hasUnknown = true;
      } else {
        unmet.push(`Branch: user branch "${userBranch}" is not in the allowed list [${allowedBranches.join(', ')}]`);
        reasons.push(`Branch mismatch: your branch "${userBranch}" is not among the allowed branches`);
        hasHardFail = true;
      }
    }
  }

  // Required Subjects Check (Part 4)
  if (requiredSubjects !== null && requiredSubjects.length > 0) {
    // User profile currently does NOT store individual subject transcripts.
    // Therefore, required subjects cannot be proven automatically from degree/branch alone.
    unknown.push(`Required Subjects: notification requires specific subjects [${requiredSubjects.join(', ')}], but individual subjects are not recorded in user profile — manual verification required`);
    hasUnknown = true;
  }

  // ── 3. GENDER CHECK ───────────────────────────────────────────────────
  const genderReq = rules.gender_requirements ?? null;
  if (genderReq !== null) {
    const normReq = normalizeString(genderReq);
    if (!normReq.includes('all') && !normReq.includes('any')) {
      if (user.gender === null) {
        unknown.push('Gender: not set in profile — cannot verify gender restriction');
        hasUnknown = true;
      } else if (!normReq.includes(normalizeString(user.gender))) {
        unmet.push(`Gender: notification restricts to "${genderReq}", user gender is "${user.gender}"`);
        reasons.push(`Not eligible: this recruitment is restricted to ${genderReq}`);
        hasHardFail = true;
      } else {
        matched.push(`Gender: "${user.gender}" meets requirement "${genderReq}"`);
      }
    }
  }

  // ── 4. DOMICILE CHECK ─────────────────────────────────────────────────
  const domicileReq = rules.domicile_requirement ?? null;
  if (domicileReq !== null) {
    if (user.state_of_domicile === null) {
      unknown.push('Domicile: state not set in profile — cannot verify domicile requirement');
      hasUnknown = true;
    } else {
      const normReq = normalizeString(domicileReq);
      const normUser = normalizeString(user.state_of_domicile);
      if (normReq !== normUser && !normReq.includes(normUser) && !normUser.includes(normReq)) {
        unmet.push(`Domicile: notification requires "${domicileReq}", user domicile is "${user.state_of_domicile}"`);
        reasons.push(`Domicile mismatch: this job requires domicile of "${domicileReq}"`);
        hasHardFail = true;
      } else {
        matched.push(`Domicile: "${user.state_of_domicile}" matches requirement`);
      }
    }
  }

  // ── 5. EXPERIENCE CHECK ───────────────────────────────────────────────
  if (rules.experience?.required === true) {
    unknown.push('Experience: this recruitment requires prior experience — check notification for details');
    hasUnknown = true;
    if (rules.experience.details) {
      reasons.push(`Experience required: ${rules.experience.details}`);
    }
  }

  // ── 6. EXTRACTION AMBIGUITIES ──────────────────────────────────────────
  if (rules.ambiguities && rules.ambiguities.length > 0) {
    for (const ambiguity of rules.ambiguities) {
      unknown.push(`Extraction ambiguity: ${ambiguity}`);
    }
    hasUnknown = true;
  }

  // ── 7. FINAL VERDICT RULE (Part 5) ────────────────────────────────────
  // Any mandatory FAIL -> not_eligible
  // No FAIL + at least one UNKNOWN -> verify
  // All mandatory criteria PASS -> eligible
  let status: EligibilityStatus;

  if (hasHardFail) {
    status = 'not_eligible';
    if (reasons.length === 0) reasons.push('One or more mandatory eligibility criteria not met');
  } else if (hasUnknown) {
    status = 'verify';
    if (reasons.length === 0) reasons.push('Some eligibility criteria could not be verified from available profile data or notification content');
  } else {
    status = 'eligible';
    reasons.push('All detectable eligibility criteria met based on your profile');
  }

  return { status, reasons, matched_criteria: matched, unmet_criteria: unmet, unknown_criteria: unknown };
}

// -----------------------------------------------------------------------
// Load user profile from Supabase
// -----------------------------------------------------------------------
async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('date_of_birth, gender, state_of_domicile, reservation_category')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: grad } = await supabase
    .from('education_graduation')
    .select('degree, branch, university, passing_year')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    date_of_birth: profile?.date_of_birth ?? null,
    gender: profile?.gender ?? null,
    state_of_domicile: profile?.state_of_domicile ?? null,
    reservation_category: profile?.reservation_category ?? null,
    education: grad
      ? {
          degree: grad.degree ?? null,
          branch: grad.branch ?? null,
          university: grad.university ?? null,
          passing_year: grad.passing_year ?? null,
        }
      : null,
  };
}

// -----------------------------------------------------------------------
// Main Matching Service
// -----------------------------------------------------------------------

export interface MatchResult {
  status: EligibilityStatus;
  recruitmentId: string;
  notificationNumber: string | null;
  eligibility: EligibilityResult;
  evaluatedAt: string;
  isNew: boolean;
}

/**
 * Evaluate a user against a single recruitment and persist the result.
 * Idempotent: running twice produces exactly ONE match row, updated in place.
 */
export async function refreshUserProfileMatches(userId: string): Promise<number> {
  const { data: existingMatches, error } = await supabase
    .from('user_recruitment_matches')
    .select('recruitment_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to load current matches for profile refresh: ${error.message}`);
  }

  let count = 0;
  for (const match of existingMatches ?? []) {
    if (!match.recruitment_id) continue;
    await evaluateUserRecruitment(userId, match.recruitment_id);
    count++;
  }

  return count;
}

export async function evaluateUserRecruitment(
  userId: string,
  recruitmentId: string
): Promise<MatchResult> {
  // 1. Load recruitment
  const { data: rec, error: recErr } = await supabase
    .from('recruitments')
    .select('id, notification_number, eligibility_rules, updated_at')
    .eq('id', recruitmentId)
    .single();

  if (recErr || !rec) {
    throw new Error(`Recruitment ${recruitmentId} not found`);
  }

  // 2. Load user profile
  const profile = await loadUserProfile(userId);
  if (!profile) {
    throw new Error(`User profile not found for user ${userId}`);
  }

  // 3. Run eligibility engine
  const rules = rec.eligibility_rules as RecruitmentExtraction | null;
  let eligibility: EligibilityResult;

  if (!rules) {
    eligibility = {
      status: 'verify',
      reasons: ['Eligibility rules have not been extracted for this recruitment yet — check official notification'],
      matched_criteria: [],
      unmet_criteria: [],
      unknown_criteria: ['No extracted eligibility_rules available'],
    };
  } else {
    eligibility = evaluateEligibility(profile, rules);
  }

  // 4. Upsert match record (UNIQUE: user_id + recruitment_id)
  const evaluatedAt = new Date().toISOString();
  const { data: existing } = await supabase
    .from('user_recruitment_matches')
    .select('id')
    .eq('user_id', userId)
    .eq('recruitment_id', recruitmentId)
    .maybeSingle();

  const { error: upsertErr } = await supabase
    .from('user_recruitment_matches')
    .upsert(
      {
        user_id: userId,
        recruitment_id: recruitmentId,
        eligibility_status: eligibility.status,
        reasons: eligibility.reasons,
        matched_criteria: eligibility.matched_criteria,
        unmet_criteria: eligibility.unmet_criteria,
        unknown_criteria: eligibility.unknown_criteria,
        evaluated_at: evaluatedAt,
        recruitment_updated_at: rec.updated_at,
      },
      { onConflict: 'user_id,recruitment_id' }
    );

  if (upsertErr) {
    throw new Error(`Failed to persist match: ${upsertErr.message}`);
  }

  return {
    status: eligibility.status,
    recruitmentId,
    notificationNumber: rec.notification_number,
    eligibility,
    evaluatedAt,
    isNew: !existing,
  };
}
