import { createClient } from '@supabase/supabase-js';
import type { RecruitmentExtraction } from '../ai/extraction.schema.js';
import { calculateAge } from '../../utils/age.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type EligibilityStatus = 'eligible' | 'verify' | 'not_eligible';

export interface UserEducation10th {
  school_name: string | null;
  board: string | null;
  board_other?: string | null;
  passing_year: number | null;
  percentage_or_cgpa?: string | null;
}

export interface UserEducation12th {
  college_name: string | null;
  board: string | null;
  board_other?: string | null;
  stream: string | null;
  stream_other?: string | null;
  passing_year: number | null;
  percentage_or_cgpa?: string | null;
  subjects?: string[] | null;
}

export interface UserEducationGraduation {
  degree: string | null;
  degree_other?: string | null;
  branch: string | null;
  branch_other?: string | null;
  college_name?: string | null;
  university: string | null;
  passing_year: number | null;
  percentage_or_cgpa?: string | null;
}

export interface UserProfile {
  date_of_birth: string | null;
  gender: string | null;
  state_of_domicile: string | null;
  reservation_category: string | null;
  // Legacy / backward-compatible alias for graduation
  education: UserEducationGraduation | null;
  education_10th?: UserEducation10th | null;
  education_12th?: UserEducation12th | null;
  education_graduation?: UserEducationGraduation | null;
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
  'polytechnic': 3,
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
  'b.pharmacy': 4,
  'b.arch': 4,
  'b.ed': 4,
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

export function normalizeEduLevel(raw: string | null | undefined): number {
  if (!raw) return 0;
  const lower = raw.trim().toLowerCase();
  for (const [key, rank] of Object.entries(EDUCATION_LEVEL_RANK)) {
    if (lower.includes(key)) return rank;
  }
  return 0;
}

export function userAgeAt(dobStr: string | null | undefined, referenceDate = new Date()): number | null {
  return calculateAge(dobStr, referenceDate);
}

export function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

/**
 * Strict branch comparison: exact match or strict word-boundary match.
 * Eliminates dangerous bidirectional broad substring matching.
 */
export function isBranchMatching(userBranch: string, allowedBranches: string[]): boolean {
  const normUser = normalizeString(userBranch);
  const userWords = normUser.split(' ');

  for (const allowed of allowedBranches) {
    const normAllowed = normalizeString(allowed);
    if (normUser === normAllowed) return true;
    if (userWords.includes(normAllowed) || normAllowed.split(' ').includes(normUser)) return true;
  }
  return false;
}

export function isDegreeMatching(userDegree: string, allowedDegrees: string[]): boolean {
  const normUser = normalizeString(userDegree);
  const userWords = normUser.split(' ');

  for (const allowed of allowedDegrees) {
    const normAllowed = normalizeString(allowed);
    if (normUser === normAllowed) return true;
    if (userWords.includes(normAllowed) || normAllowed.split(' ').includes(normUser)) return true;

    // Standard abbreviations
    const isEngAllowed = normAllowed.includes('btech') || normAllowed.includes('be') || normAllowed.includes('engineering') || normAllowed.includes('technology');
    const isEngUser = normUser.includes('btech') || normUser.includes('be') || normUser.includes('engineering') || normUser.includes('technology');
    if (isEngAllowed && isEngUser) return true;

    if (normAllowed.includes('bsc') && normUser.includes('bsc')) return true;
    if (normAllowed.includes('bcom') && normUser.includes('bcom')) return true;
    if (normAllowed.includes('ba') && normUser.includes('ba') && !normUser.includes('bba') && !normUser.includes('bca')) return true;
    if (normAllowed.includes('bca') && normUser.includes('bca')) return true;
    if (normAllowed.includes('bba') && normUser.includes('bba')) return true;
    if (normAllowed.includes('mca') && normUser.includes('mca')) return true;
    if (normAllowed.includes('mba') && normUser.includes('mba')) return true;
    if ((normAllowed.includes('mtech') || normAllowed.includes('me')) && (normUser.includes('mtech') || normUser.includes('me'))) return true;
  }
  return false;
}

export function isIntermediateStreamMatching(userStream: string, allowedStreams: string[]): boolean {
  const normUser = normalizeString(userStream);

  for (const allowed of allowedStreams) {
    const normAllowed = normalizeString(allowed);
    if (normUser === normAllowed) return true;

    if (normAllowed.includes('mpc') && normUser.includes('mpc')) return true;
    if (normAllowed.includes('bipc') && normUser.includes('bipc')) return true;
    if (normAllowed.includes('mbipc') && (normUser.includes('mbipc') || (normUser.includes('mpc') && normUser.includes('bipc')))) return true;
    if (normAllowed.includes('cec') && normUser.includes('cec')) return true;
    if (normAllowed.includes('mec') && normUser.includes('mec')) return true;
    if (normAllowed.includes('hec') && normUser.includes('hec')) return true;

    if (normAllowed.includes('science') && (normUser.includes('mpc') || normUser.includes('bipc') || normUser.includes('mbipc') || normUser.includes('science'))) return true;
    if (normAllowed.includes('commerce') && (normUser.includes('cec') || normUser.includes('mec') || normUser.includes('commerce'))) return true;
    if (normAllowed.includes('arts') && (normUser.includes('hec') || normUser.includes('arts') || normUser.includes('humanities'))) return true;
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
  const cutoffDateStr = rules.age?.cutoff_date ?? null;

  let refDate = new Date();
  let hasSpecificCutoff = false;
  if (cutoffDateStr) {
    const parsed = new Date(cutoffDateStr);
    if (!isNaN(parsed.getTime())) {
      refDate = parsed;
      hasSpecificCutoff = true;
    }
  }

  const userAge = userAgeAt(user.date_of_birth, refDate);

  if (ageMin !== null || ageMax !== null) {
    if (userAge === null) {
      unknown.push('Age: date of birth not set in profile — cannot verify age limit compliance');
      hasUnknown = true;
    } else {
      let ageFail = false;
      const refLabel = hasSpecificCutoff ? `on cut-off date ${cutoffDateStr}` : 'as of current date';

      if (ageMin !== null && userAge < ageMin) {
        unmet.push(`Age: user is ${userAge} years old (${refLabel}), minimum required is ${ageMin}`);
        reasons.push(`Too young: minimum age is ${ageMin}, you are ${userAge}`);
        hasHardFail = true;
        ageFail = true;
      }

      let effectiveMax = ageMax;
      let relaxationApplied = false;
      let relaxationDetails = '';

      if (ageMax !== null && user.reservation_category && rules.age?.relaxation) {
        const catNorm = normalizeString(user.reservation_category);
        for (const [key, val] of Object.entries(rules.age.relaxation)) {
          const keyNorm = normalizeString(key);
          if (keyNorm === catNorm || catNorm.includes(keyNorm) || keyNorm.includes(catNorm)) {
            const relaxYears = parseInt(val, 10);
            if (!isNaN(relaxYears)) {
              effectiveMax = ageMax + relaxYears;
              relaxationApplied = true;
              relaxationDetails = ` (including +${relaxYears} years relaxation for ${user.reservation_category})`;
              break;
            }
          }
        }
      }

      if (effectiveMax !== null && userAge > effectiveMax) {
        const isReserved = user.reservation_category &&
          !normalizeString(user.reservation_category).includes('general') &&
          !normalizeString(user.reservation_category).includes('ur');

        if (isReserved && !relaxationApplied && (!rules.age?.relaxation || Object.keys(rules.age.relaxation).length === 0)) {
          unknown.push(`Age: user is ${userAge} years old (${refLabel}) and exceeds general maximum (${ageMax}), but category relaxation rules for "${user.reservation_category}" are not specified in notification — manual verification required`);
          hasUnknown = true;
        } else {
          unmet.push(`Age: user is ${userAge} years old (${refLabel}), maximum allowed is ${effectiveMax}${relaxationDetails}`);
          reasons.push(`Age exceeded: maximum age is ${effectiveMax}, you are ${userAge}`);
          hasHardFail = true;
          ageFail = true;
        }
      }

      if (!ageFail && !hasUnknown) {
        matched.push(`Age: ${userAge} years (${refLabel}) — within required range`);
      }
    }
  } else {
    unknown.push('Age: not explicitly stated in notification');
    hasUnknown = true;
  }

  // ── 2. EDUCATION LEVEL & DEGREE CHECK ──────────────────────────────────
  const requiredLevel = rules.education?.minimum_level ?? null;
  const allowedBranches = rules.education?.allowed_branches ?? null;
  const requiredDegrees = rules.education?.required_degrees ?? null;
  const requiredStreams = rules.education?.intermediate_streams ?? null;
  const requiredSubjects = rules.education?.required_subjects ?? null;

  const grad = user.education_graduation || user.education;
  const twelfth = user.education_12th;
  const tenth = user.education_10th;

  const userDegree = grad?.degree ?? null;
  const userDegreeOther = grad?.degree_other ?? null;
  const effectiveDegree = (userDegree === 'Other' && userDegreeOther) ? userDegreeOther : userDegree;

  const userBranch = grad?.branch ?? null;
  const userBranchOther = grad?.branch_other ?? null;
  const effectiveBranch = (userBranch === 'Other' && userBranchOther) ? userBranchOther : userBranch;

  // Level check
  if (requiredLevel !== null) {
    const requiredRank = normalizeEduLevel(requiredLevel);

    // Calculate highest recorded education rank
    let userRank = 0;
    if (effectiveDegree) {
      const gradRank = normalizeEduLevel(effectiveDegree);
      userRank = gradRank > 0 ? gradRank : 4; // default degree rank
    } else if (twelfth?.stream) {
      userRank = twelfth.stream.includes('Diploma') ? 3 : 2;
    } else if (tenth?.school_name || tenth?.board) {
      userRank = 1;
    }

    if (userRank === 0 && !effectiveDegree) {
      unknown.push('Education: graduation record not set in profile — cannot verify degree requirement');
      hasUnknown = true;
    } else if (effectiveDegree && normalizeEduLevel(effectiveDegree) === 0 && requiredRank >= 4) {
      unknown.push(`Education: could not determine education level for profile degree "${effectiveDegree}"`);
      hasUnknown = true;
    } else if (requiredRank > 0 && userRank < requiredRank) {
      unmet.push(`Education: required minimum level is "${requiredLevel}", user has "${effectiveDegree || twelfth?.stream || 'incomplete education'}"`);
      reasons.push(`Education requirement not met: need ${requiredLevel}, you have ${effectiveDegree || twelfth?.stream || 'incomplete education'}`);
      hasHardFail = true;
    } else {
      matched.push(`Education level: "${effectiveDegree || requiredLevel}" meets minimum required "${requiredLevel}"`);
    }
  } else {
    unknown.push('Education minimum level: not explicitly stated in notification');
    hasUnknown = true;
  }

  // Required Degrees Check
  if (requiredDegrees !== null && requiredDegrees.length > 0) {
    if (!effectiveDegree) {
      unknown.push(`Degree: notification requires degree in [${requiredDegrees.join(', ')}], but graduation record is not set in profile`);
      hasUnknown = true;
    } else {
      const isDegMatch = isDegreeMatching(effectiveDegree, requiredDegrees);
      if (isDegMatch) {
        matched.push(`Degree: "${effectiveDegree}" matches required degrees`);
      } else if (userDegree === 'Other') {
        unknown.push(`Degree: user specified custom degree "${effectiveDegree}", needs manual verification against [${requiredDegrees.join(', ')}]`);
        hasUnknown = true;
      } else {
        unmet.push(`Degree: user degree "${effectiveDegree}" is not in the required degrees list [${requiredDegrees.join(', ')}]`);
        reasons.push(`Degree mismatch: your degree "${effectiveDegree}" is not among the required degrees`);
        hasHardFail = true;
      }
    }
  }

  // Strict Branch Check
  if (allowedBranches !== null && allowedBranches.length > 0) {
    if (!effectiveBranch) {
      unknown.push('Branch: no branch specified in profile — cannot verify allowed branch requirement');
      hasUnknown = true;
    } else {
      const isMatched = isBranchMatching(effectiveBranch, allowedBranches);
      if (isMatched) {
        matched.push(`Branch: "${effectiveBranch}" matches allowed branches`);
      } else if (requiredSubjects !== null && requiredSubjects.length > 0) {
        unknown.push(`Branch/Subjects: user branch "${effectiveBranch}" is not in allowed branches [${allowedBranches.join(', ')}], but recruitment also specifies required subjects — manual verification required`);
        hasUnknown = true;
      } else if (userBranch === 'Other') {
        unknown.push(`Branch: user specified custom branch "${effectiveBranch}", needs manual verification against [${allowedBranches.join(', ')}]`);
        hasUnknown = true;
      } else {
        unmet.push(`Branch: user branch "${effectiveBranch}" is not in the allowed list [${allowedBranches.join(', ')}]`);
        reasons.push(`Branch mismatch: your branch "${effectiveBranch}" is not among the allowed branches`);
        hasHardFail = true;
      }
    }
  }

  // Intermediate Stream Check
  if (requiredStreams !== null && requiredStreams.length > 0) {
    const userStream = twelfth?.stream ?? null;
    const userStreamOther = twelfth?.stream_other ?? null;
    const effectiveStream = (userStream === 'Other' || userStream === 'Other Intermediate stream') && userStreamOther
      ? userStreamOther
      : userStream;

    if (!effectiveStream) {
      unknown.push(`12th Stream: recruitment requires intermediate stream [${requiredStreams.join(', ')}], but 12th record is not set in profile`);
      hasUnknown = true;
    } else if (userStream === 'Polytechnic / Diploma' && !rules.education?.diploma_allowed_as_intermediate) {
      unmet.push(`12th Stream: recruitment requires intermediate stream [${requiredStreams.join(', ')}], but user qualification is Polytechnic / Diploma (not recognized as intermediate equivalent without official rule)`);
      reasons.push(`Qualification mismatch: recruitment requires intermediate stream [${requiredStreams.join(', ')}], not Polytechnic / Diploma`);
      hasHardFail = true;
    } else {
      const isStreamMatch = isIntermediateStreamMatching(effectiveStream, requiredStreams);
      if (isStreamMatch) {
        matched.push(`12th Stream: "${effectiveStream}" matches required streams`);
      } else if (userStream === 'Other' || userStream === 'Other Intermediate stream') {
        unknown.push(`12th Stream: user specified custom stream "${effectiveStream}", needs manual verification against [${requiredStreams.join(', ')}]`);
        hasUnknown = true;
      } else {
        unmet.push(`12th Stream: user stream "${effectiveStream}" is not in required streams [${requiredStreams.join(', ')}]`);
        reasons.push(`Stream mismatch: recruitment requires intermediate stream [${requiredStreams.join(', ')}], you have ${effectiveStream}`);
        hasHardFail = true;
      }
    }
  }

  // Required Subjects Check
  if (requiredSubjects !== null && requiredSubjects.length > 0) {
    const userSubs = twelfth?.subjects ?? [];
    if (!userSubs || userSubs.length === 0) {
      unknown.push(`Required Subjects: notification requires specific subjects [${requiredSubjects.join(', ')}], but individual subjects are not recorded in user profile — manual verification required`);
      hasUnknown = true;
    } else {
      const normUserSubs = userSubs.map(s => normalizeString(s));
      const missingSubs: string[] = [];
      for (const reqSub of requiredSubjects) {
        const normReq = normalizeString(reqSub);
        const found = normUserSubs.some(s => s === normReq || s.includes(normReq) || normReq.includes(s));
        if (!found) {
          missingSubs.push(reqSub);
        }
      }

      if (missingSubs.length === 0) {
        matched.push(`Required Subjects: profile confirms required subjects [${requiredSubjects.join(', ')}]`);
      } else {
        unknown.push(`Required Subjects: profile lists [${userSubs.join(', ')}], but required subject(s) [${missingSubs.join(', ')}] could not be verified — manual verification required`);
        hasUnknown = true;
      }
    }
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

  // ── 7. FINAL VERDICT RULE ─────────────────────────────────────────────
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

  // Load 10th with fallback
  let edu10Data: any = null;
  const { data: e10Full, error: e10Err } = await supabase
    .from('education_10th')
    .select('school_name, board, board_other, passing_year, percentage, percentage_or_cgpa')
    .eq('user_id', userId)
    .maybeSingle();

  if (!e10Err) {
    edu10Data = e10Full;
  } else if (e10Err.code === '42703') {
    const { data: e10Base } = await supabase
      .from('education_10th')
      .select('school_name, board, passing_year, percentage')
      .eq('user_id', userId)
      .maybeSingle();
    edu10Data = e10Base;
  }

  // Load 12th with fallback
  let edu12Data: any = null;
  const { data: e12Full, error: e12Err } = await supabase
    .from('education_12th')
    .select('college_name, school_college_name, board, board_other, stream, stream_other, passing_year, percentage, percentage_or_cgpa, subjects')
    .eq('user_id', userId)
    .maybeSingle();

  if (!e12Err) {
    edu12Data = e12Full;
  } else if (e12Err.code === '42703') {
    const { data: e12Base } = await supabase
      .from('education_12th')
      .select('school_college_name, board, stream, passing_year, percentage')
      .eq('user_id', userId)
      .maybeSingle();
    edu12Data = e12Base;
  }

  // Load graduation with fallback
  let gradData: any = null;
  const { data: gradFull, error: gradErr } = await supabase
    .from('education_graduation')
    .select('degree, degree_other, branch, branch_other, college_name, university, passing_year, percentage_or_cgpa')
    .eq('user_id', userId)
    .maybeSingle();

  if (!gradErr) {
    gradData = gradFull;
  } else if (gradErr.code === '42703') {
    const { data: gradBase } = await supabase
      .from('education_graduation')
      .select('degree, branch, university, passing_year, percentage_or_cgpa')
      .eq('user_id', userId)
      .maybeSingle();
    gradData = gradBase;
  }

  const gradEdu: UserEducationGraduation | null = gradData
    ? {
        degree: gradData.degree ?? null,
        degree_other: gradData.degree_other ?? null,
        branch: gradData.branch ?? null,
        branch_other: gradData.branch_other ?? null,
        college_name: gradData.college_name ?? null,
        university: gradData.university ?? null,
        passing_year: gradData.passing_year ?? null,
        percentage_or_cgpa: gradData.percentage_or_cgpa ?? null,
      }
    : null;

  return {
    date_of_birth: profile?.date_of_birth ?? null,
    gender: profile?.gender ?? null,
    state_of_domicile: profile?.state_of_domicile ?? null,
    reservation_category: profile?.reservation_category ?? null,
    education: gradEdu,
    education_graduation: gradEdu,
    education_10th: edu10Data
      ? {
          school_name: edu10Data.school_name ?? null,
          board: edu10Data.board ?? null,
          board_other: edu10Data.board_other ?? null,
          passing_year: edu10Data.passing_year ?? null,
          percentage_or_cgpa: edu10Data.percentage_or_cgpa ?? edu10Data.percentage ?? null,
        }
      : null,
    education_12th: edu12Data
      ? {
          college_name: edu12Data.college_name ?? edu12Data.school_college_name ?? null,
          board: edu12Data.board ?? null,
          board_other: edu12Data.board_other ?? null,
          stream: edu12Data.stream ?? null,
          stream_other: edu12Data.stream_other ?? null,
          passing_year: edu12Data.passing_year ?? null,
          percentage_or_cgpa: edu12Data.percentage_or_cgpa ?? edu12Data.percentage ?? null,
          subjects: Array.isArray(edu12Data.subjects) ? edu12Data.subjects : [],
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
