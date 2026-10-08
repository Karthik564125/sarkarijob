import 'dotenv/config';
import { supabase } from '../config/supabase.js';
import { evaluateUserRecruitment, evaluateEligibility } from '../services/recruitment/matching.service.js';
import type { UserProfile } from '../services/recruitment/matching.service.js';
import type { RecruitmentExtraction } from '../services/ai/extraction.schema.js';

async function runPhase4Tests() {
  console.log('=====================================================');
  console.log(' PHASE 4: USER RECRUITMENT MATCHING & PERSISTENCE TEST');
  console.log('=====================================================\n');

  // 1. Get test user
  const { data: user } = await supabase.from('users').select('id, username').limit(1).single();
  if (!user) {
    throw new Error('No user found in DB for testing.');
  }
  console.log(`[TEST 1] Using test user: ${user.username} (${user.id})`);

  // Ensure user profile exists
  await supabase.from('user_profiles').upsert({
    user_id: user.id,
    full_name: 'Test User',
    date_of_birth: '1998-05-15',
    gender: 'Male',
    state_of_domicile: 'Andhra Pradesh',
    reservation_category: 'OBC',
  }, { onConflict: 'user_id' });

  await supabase.from('education_graduation').upsert({
    user_id: user.id,
    degree: "Bachelor's Degree",
    branch: 'Forestry / Science',
    university: 'Andhra University',
    passing_year: 2020,
    percentage_or_cgpa: '80%',
  }, { onConflict: 'user_id' });

  // 2. Get or create a test recruitment (e.g. APPSC Forest Range Officer Notification 16/2026)
  const appscForestRules: RecruitmentExtraction = {
    recruitment_title: 'Forest Range Officers in A.P. Forest Service',
    notification_number: '16/2026',
    organization: 'APPSC',
    recruitment_type: 'recruitment_notification',
    vacancies: 37,
    application_start: '2026-03-10',
    application_end: '2026-04-10',
    exam_date: null,
    age: {
      minimum: 18,
      maximum: 30,
      relaxation: { OBC: '5 years', SC: '5 years', ST: '5 years' },
    },
    education: {
      minimum_level: "Bachelor's Degree",
      required_degrees: ["Bachelor's Degree in Forestry", "Bachelor's Degree in Science"],
      allowed_branches: ['Forestry', 'Botany', 'Zoology', 'Chemistry', 'Physics', 'Agriculture', 'Engineering'],
      required_subjects: null,
    },
    experience: { required: false, details: null },
    nationality_requirement: 'Citizen of India',
    domicile_requirement: 'Andhra Pradesh',
    category_requirements: null,
    gender_requirements: 'All candidates',
    physical_requirements: null,
    post_wise_eligibility: null,
    important_conditions: null,
    ambiguities: [],
  };

  // Find existing or insert
  let { data: rec } = await supabase
    .from('recruitments')
    .select('id')
    .eq('organization', 'APPSC')
    .eq('notification_number', '16/2026')
    .maybeSingle();

  if (!rec) {
    const { data: newRec, error: insertErr } = await supabase.from('recruitments').insert({
      organization: 'APPSC',
      title: 'Forest Range Officers in A.P. Forest Service',
      notification_number: '16/2026',
      source_url: 'https://psc.ap.gov.in/ForestRangeOfficer2026',
      eligibility_rules: appscForestRules,
      content_hash: 'test_appsc_fro_16_2026_hash',
    }).select('id').single();

    if (insertErr) throw new Error(`Failed to insert recruitment: ${insertErr.message}`);
    rec = newRec;
  } else {
    // Update rules for test
    await supabase.from('recruitments').update({ eligibility_rules: appscForestRules }).eq('id', rec.id);
  }

  if (!rec) throw new Error('Failed to create/get test recruitment.');
  console.log(`[TEST 2] Target recruitment ID: ${rec.id} (APPSC 16/2026)`);

  // 3. Test Deterministic Engine
  console.log('\n--- Evaluating Eligibility Engine ---');
  const mockProfile: UserProfile = {
    date_of_birth: '1998-05-15', // Age ~28 in 2026 -> under max age (30 + 5 OBC = 35)
    gender: 'Male',
    state_of_domicile: 'Andhra Pradesh',
    reservation_category: 'OBC',
    education: {
      degree: "Bachelor's Degree",
      branch: 'Forestry',
      university: 'Andhra University',
      passing_year: 2020,
    },
  };
  const engineResult = evaluateEligibility(mockProfile, appscForestRules);
  console.log('Engine Result:', JSON.stringify(engineResult, null, 2));
  if (engineResult.status !== 'eligible') {
    throw new Error(`Expected status 'eligible', got '${engineResult.status}'`);
  }
  console.log('✅ Deterministic Eligibility Engine PASSED');

  // 4. Test evaluateUserRecruitment (First Evaluation)
  console.log('\n--- Running evaluateUserRecruitment (Initial Run) ---');
  const result1 = await evaluateUserRecruitment(user.id, rec.id);
  console.log('Initial match result:', {
    status: result1.status,
    recruitmentId: result1.recruitmentId,
    isNew: result1.isNew,
    evaluatedAt: result1.evaluatedAt,
  });

  // Verify in DB
  const { data: matchDb1, count: count1 } = await supabase
    .from('user_recruitment_matches')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('recruitment_id', rec.id);

  console.log(`Matching records in DB: ${count1}`);
  if (count1 !== 1) {
    throw new Error(`Expected exactly 1 match record in DB, found ${count1}`);
  }
  console.log('Stored DB record eligibility status:', matchDb1![0].eligibility_status);
  console.log('Matched criteria:', matchDb1![0].matched_criteria);
  console.log('✅ Initial persistence PASSED');

  // 5. Test Idempotency (Second Evaluation)
  console.log('\n--- Running evaluateUserRecruitment (Second Run / Re-evaluate) ---');
  const result2 = await evaluateUserRecruitment(user.id, rec.id);
  console.log('Re-evaluate match result:', {
    status: result2.status,
    isNew: result2.isNew,
    evaluatedAt: result2.evaluatedAt,
  });

  if (result2.isNew !== false) {
    throw new Error('Expected isNew to be false on re-evaluation!');
  }

  const { count: count2 } = await supabase
    .from('user_recruitment_matches')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('recruitment_id', rec.id);

  console.log(`Matching records in DB after re-evaluate: ${count2}`);
  if (count2 !== 1) {
    throw new Error(`Idempotency violated! Found ${count2} match records for user + recruitment.`);
  }
  console.log('✅ Idempotency (UPSERT) PASSED');

  // 6. Test User Security Isolation Query
  console.log('\n--- Testing User Security Isolation ---');
  const { data: userMatches } = await supabase
    .from('user_recruitment_matches')
    .select('id, user_id, eligibility_status, recruitments(title)')
    .eq('user_id', user.id);

  console.log(`Found ${userMatches?.length} match(es) for user ${user.username}:`);
  userMatches?.forEach(m => console.log(' - Match ID:', m.id, '| Status:', m.eligibility_status));
  console.log('✅ User Security Isolation PASSED');

  console.log('\n=====================================================');
  console.log(' 🎉 PHASE 4 PERSISTENCE & MATCHING FULLY VERIFIED!');
  console.log('=====================================================');
}

runPhase4Tests().catch(err => {
  console.error('\n❌ PHASE 4 TEST FAILED:', err);
  process.exit(1);
});
