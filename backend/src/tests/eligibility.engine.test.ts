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

  console.log('\n===========================================================');
  console.log(` Unit Test Suite Execution Finished: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('===========================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runEngineUnitTests();
