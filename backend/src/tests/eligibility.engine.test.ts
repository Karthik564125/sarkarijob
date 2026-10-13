import 'dotenv/config';
import { evaluateEligibility } from '../services/recruitment/matching.service.js';
import type { UserProfile } from '../services/recruitment/matching.service.js';
import type { RecruitmentExtraction } from '../services/ai/extraction.schema.js';

function createBaseRules(): RecruitmentExtraction {
  return {
    recruitment_title: 'Test Recruitment Notice',
    organization: 'TEST_ORG',
    notification_number: '01/2026',
    recruitment_type: 'Direct Recruitment',
    vacancies: 10,
    application_start: '2026-01-01',
    application_end: '2026-02-01',
    exam_date: null,
    age: {
      minimum: 18,
      maximum: 30,
      relaxation: { OBC: '3 years' },
    },
    education: {
      minimum_level: "Bachelor's Degree",
      required_degrees: ["Bachelor's Degree"],
      allowed_branches: ['Computer Science', 'Information Technology'],
      required_subjects: null,
    },
    experience: { required: false, details: null },
    nationality_requirement: null,
    domicile_requirement: null,
    category_requirements: null,
    gender_requirements: null,
    physical_requirements: null,
    post_wise_eligibility: null,
    important_conditions: null,
    ambiguities: [],
  };
}

function createBaseProfile(): UserProfile {
  return {
    date_of_birth: '1998-01-01', // Age ~28 in 2026
    gender: 'Male',
    state_of_domicile: 'Andhra Pradesh',
    reservation_category: 'General',
    education: {
      degree: "Bachelor's Degree",
      branch: 'Computer Science',
      university: 'State University',
      passing_year: 2020,
    },
  };
}

function runEngineUnitTests() {
  console.log('===========================================================');
  console.log('       IN-MEMORY ELIGIBILITY ENGINE UNIT TEST SUITE        ');
  console.log('===========================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${testName} — ${detail || ''}`);
      failedCount++;
    }
  }

  // -----------------------------------------------------------------------
  // Test 1: Exact matching qualification -> PASS (eligible)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    const rules = createBaseRules();
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'eligible' && res.unmet_criteria.length === 0 && res.unknown_criteria.length === 0,
      'Test 1: Exact matching qualification -> ELIGIBLE',
      `Got status: ${res.status}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 2: Clearly wrong branch -> FAIL (not_eligible)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education!.branch = 'Civil Engineering';
    const rules = createBaseRules();
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'not_eligible' && res.unmet_criteria.length > 0,
      'Test 2: Clearly wrong branch -> NOT_ELIGIBLE',
      `Got status: ${res.status}, unmet: ${JSON.stringify(res.unmet_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 3: Missing branch information -> UNKNOWN (verify)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education!.branch = null;
    const rules = createBaseRules();
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'verify' && res.unknown_criteria.some(u => u.includes('Branch')),
      'Test 3: Missing branch information -> VERIFY',
      `Got status: ${res.status}, unknown: ${JSON.stringify(res.unknown_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 4: Missing age requirement in notification -> UNKNOWN (verify)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    const rules = createBaseRules();
    rules.age.minimum = null;
    rules.age.maximum = null;
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'verify' && res.unknown_criteria.some(u => u.includes('Age')),
      'Test 4: Missing age requirement in notification -> VERIFY',
      `Got status: ${res.status}, unknown: ${JSON.stringify(res.unknown_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 5: Age explicitly outside range -> FAIL (not_eligible)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.date_of_birth = '1985-01-01'; // Age ~41 in 2026 (max is 30)
    const rules = createBaseRules();
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'not_eligible' && res.unmet_criteria.some(u => u.includes('Age')),
      'Test 5: Age explicitly outside range -> NOT_ELIGIBLE',
      `Got status: ${res.status}, unmet: ${JSON.stringify(res.unmet_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 6: Age explicitly inside range -> PASS (eligible)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.date_of_birth = '2002-01-01'; // Age ~24 in 2026 (min 18, max 30)
    const rules = createBaseRules();
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'eligible' && res.matched_criteria.some(m => m.includes('Age')),
      'Test 6: Age explicitly inside range -> ELIGIBLE',
      `Got status: ${res.status}, matched: ${JSON.stringify(res.matched_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 7: Required subject but profile lacks subject info -> UNKNOWN (verify)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    const rules = createBaseRules();
    rules.education.required_subjects = ['Forestry', 'Botany'];
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'verify' && res.unknown_criteria.some(u => u.includes('Required Subjects')),
      'Test 7: Required subject but profile lacks subject info -> VERIFY',
      `Got status: ${res.status}, unknown: ${JSON.stringify(res.unknown_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 8: Multiple criteria with one FAIL -> NOT_ELIGIBLE
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.date_of_birth = '1985-01-01'; // Age FAIL
    const rules = createBaseRules();
    rules.education.required_subjects = ['Forestry']; // Subject UNKNOWN
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'not_eligible',
      'Test 8: Multiple criteria with one FAIL -> NOT_ELIGIBLE',
      `Got status: ${res.status}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 9: Multiple criteria with UNKNOWN but no FAIL -> VERIFY
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.date_of_birth = null; // Age UNKNOWN
    const rules = createBaseRules();
    rules.education.required_subjects = ['Forestry']; // Subject UNKNOWN
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'verify',
      'Test 9: Multiple criteria with UNKNOWN but no FAIL -> VERIFY',
      `Got status: ${res.status}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 10: All mandatory criteria PASS -> ELIGIBLE
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    const rules = createBaseRules();
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'eligible' && res.reasons.length > 0,
      'Test 10: All mandatory criteria PASS -> ELIGIBLE',
      `Got status: ${res.status}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 11: Accurate age calculation around birthday boundaries
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.date_of_birth = '2000-06-15';
    const rules = createBaseRules();
    rules.age.cutoff_date = '2026-06-14'; // Day before 26th birthday -> age is 25
    rules.age.maximum = 25;
    const resBefore = evaluateEligibility(profile, rules);
    assert(
      resBefore.status === 'eligible',
      'Test 11a: Day before birthday: age is 25 <= 25 -> ELIGIBLE',
      `Got status: ${resBefore.status}, reasons: ${resBefore.reasons.join('; ')}`
    );

    rules.age.cutoff_date = '2026-06-15'; // Exact day of 26th birthday -> age is 26
    const resOn = evaluateEligibility(profile, rules);
    assert(
      resOn.status === 'not_eligible',
      'Test 11b: Day of birthday: age is 26 > 25 -> NOT_ELIGIBLE',
      `Got status: ${resOn.status}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 12: Leap year birthday handling (Feb 29)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.date_of_birth = '2000-02-29'; // Leap year baby
    const rules = createBaseRules();
    rules.age.maximum = 24;
    rules.age.cutoff_date = '2024-02-28'; // Day before 24th birthday -> age 23
    const res28 = evaluateEligibility(profile, rules);
    assert(
      res28.status === 'eligible',
      'Test 12a: Feb 28 on leap year: candidate has not turned 24 yet -> ELIGIBLE',
      `Got status: ${res28.status}`
    );

    rules.age.cutoff_date = '2024-02-29'; // Exact 24th birthday -> age 24
    const res29 = evaluateEligibility(profile, rules);
    assert(
      res29.status === 'eligible',
      'Test 12b: Feb 29 on leap year: candidate is exactly 24 -> ELIGIBLE',
      `Got status: ${res29.status}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 13: Recruitment-specific cut-off date evaluation
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.date_of_birth = '1995-12-01'; // In 2026 current date, age is 30/31
    const rules = createBaseRules();
    rules.age.minimum = 18;
    rules.age.maximum = 30;
    // Notification cut-off date set to back in 2025-01-01 when candidate was 29!
    rules.age.cutoff_date = '2025-01-01';
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'eligible',
      'Test 13: Age on notification cut-off date (2025-01-01) is 29 <= 30 -> ELIGIBLE',
      `Got status: ${res.status}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 14: Category-specific age relaxation (OBC +3 years)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.date_of_birth = '1994-01-01'; // Age 32 in 2026
    profile.reservation_category = 'OBC (Non-Creamy Layer)';
    const rules = createBaseRules();
    rules.age.maximum = 30;
    rules.age.relaxation = { 'OBC': '3 years' };
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'eligible' && res.matched_criteria.some(m => m.includes('Age')),
      'Test 14: OBC candidate age 32 with max 30 + 3y relaxation -> ELIGIBLE',
      `Got status: ${res.status}, matched: ${JSON.stringify(res.matched_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 15: Category relaxation rule missing from notification -> VERIFY
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.date_of_birth = '1990-01-01'; // Age 36 in 2026
    profile.reservation_category = 'SC';
    const rules = createBaseRules();
    rules.age.maximum = 30;
    rules.age.relaxation = null; // No relaxation table extracted
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'verify' && res.unknown_criteria.some(u => u.includes('Age')),
      'Test 15: Reserved candidate over general max without relaxation rules -> VERIFY',
      `Got status: ${res.status}, unknown: ${JSON.stringify(res.unknown_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 16: Intermediate stream matching (MPC required, candidate has MPC)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education_12th = {
      college_name: 'Govt Jr College',
      board: 'State Board',
      stream: 'MPC — Mathematics, Physics, Chemistry',
      passing_year: 2018,
      percentage_or_cgpa: '85%',
      subjects: ['Mathematics', 'Physics', 'Chemistry'],
    };
    const rules = createBaseRules();
    rules.education.intermediate_streams = ['MPC'];
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'eligible' && res.matched_criteria.some(m => m.includes('12th Stream')),
      'Test 16: Intermediate stream matching (MPC) -> ELIGIBLE',
      `Got status: ${res.status}, matched: ${JSON.stringify(res.matched_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 17: Intermediate stream mismatch (MPC required, candidate has CEC)
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education_12th = {
      college_name: 'Govt Jr College',
      board: 'State Board',
      stream: 'CEC — Civics, Economics, Commerce',
      passing_year: 2018,
      percentage_or_cgpa: '85%',
      subjects: ['Civics', 'Economics', 'Commerce'],
    };
    const rules = createBaseRules();
    rules.education.intermediate_streams = ['MPC'];
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'not_eligible' && res.unmet_criteria.some(u => u.includes('12th Stream')),
      'Test 17: Intermediate stream mismatch (CEC vs MPC) -> NOT_ELIGIBLE',
      `Got status: ${res.status}, unmet: ${JSON.stringify(res.unmet_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 18: Polytechnic / Diploma NOT equivalent to Intermediate without rule
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education_12th = {
      college_name: 'Polytechnic College',
      board: 'State Board',
      stream: 'Polytechnic / Diploma',
      passing_year: 2018,
      percentage_or_cgpa: '80%',
      subjects: [],
    };
    const rules = createBaseRules();
    rules.education.intermediate_streams = ['MPC'];
    rules.education.diploma_allowed_as_intermediate = false;
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'not_eligible' && res.unmet_criteria.some(u => u.includes('Polytechnic / Diploma')),
      'Test 18: Diploma NOT equivalent to Intermediate without explicit rule -> NOT_ELIGIBLE',
      `Got status: ${res.status}, unmet: ${JSON.stringify(res.unmet_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 19: Polytechnic / Diploma recognized when rule allows
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education_12th = {
      college_name: 'Polytechnic College',
      board: 'State Board',
      stream: 'Polytechnic / Diploma',
      passing_year: 2018,
      percentage_or_cgpa: '80%',
      subjects: [],
    };
    const rules = createBaseRules();
    rules.education.intermediate_streams = ['Polytechnic / Diploma', 'MPC'];
    rules.education.diploma_allowed_as_intermediate = true;
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'eligible',
      'Test 19: Diploma recognized when rule allows -> ELIGIBLE',
      `Got status: ${res.status}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 20: Required subjects confirmed in profile -> ELIGIBLE
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education_12th = {
      college_name: 'City Jr College',
      board: 'CBSE',
      stream: 'MPC — Mathematics, Physics, Chemistry',
      passing_year: 2018,
      percentage_or_cgpa: '90%',
      subjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
    };
    const rules = createBaseRules();
    rules.education.required_subjects = ['Physics', 'Mathematics'];
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'eligible' && res.matched_criteria.some(m => m.includes('Required Subjects')),
      'Test 20: Required subjects confirmed in profile -> ELIGIBLE',
      `Got status: ${res.status}, matched: ${JSON.stringify(res.matched_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 21: Required subject missing from profile subjects -> VERIFY
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education_12th = {
      college_name: 'City Jr College',
      board: 'CBSE',
      stream: 'BiPC — Biology, Physics, Chemistry',
      passing_year: 2018,
      percentage_or_cgpa: '90%',
      subjects: ['Biology', 'Physics', 'Chemistry'],
    };
    const rules = createBaseRules();
    rules.education.required_subjects = ['Mathematics']; // Mathematics missing!
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'verify' && res.unknown_criteria.some(u => u.includes('Required Subjects')),
      'Test 21: Required subject missing from profile -> VERIFY',
      `Got status: ${res.status}, unknown: ${JSON.stringify(res.unknown_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 22: Unknown / "Other" custom degree -> VERIFY
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education!.degree = 'Other';
    profile.education!.degree_other = 'B.Voc in Cloud Computing';
    const rules = createBaseRules();
    rules.education.required_degrees = ['B.Tech', 'B.Sc'];
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'verify' && res.unknown_criteria.some(u => u.includes('Degree')),
      'Test 22: Unknown / "Other" custom degree -> VERIFY',
      `Got status: ${res.status}, unknown: ${JSON.stringify(res.unknown_criteria)}`
    );
  }

  // -----------------------------------------------------------------------
  // Test 23: Unknown / "Other" custom branch -> VERIFY
  // -----------------------------------------------------------------------
  {
    const profile = createBaseProfile();
    profile.education!.branch = 'Other';
    profile.education!.branch_other = 'Robotics and Cybernetics';
    const rules = createBaseRules();
    rules.education.allowed_branches = ['Computer Science', 'Information Technology'];
    const res = evaluateEligibility(profile, rules);
    assert(
      res.status === 'verify' && res.unknown_criteria.some(u => u.includes('Branch')),
      'Test 23: Unknown / "Other" custom branch -> VERIFY',
      `Got status: ${res.status}, unknown: ${JSON.stringify(res.unknown_criteria)}`
    );
  }

  console.log('\n===========================================================');
  console.log(` Unit Test Suite Execution Finished: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('===========================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runEngineUnitTests();
