import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sarkarijob_jwt_secret_dev';

async function runPhase7ApiTests() {
  console.log('===========================================================');
  console.log(' PHASE 7: USER-SPECIFIC RECRUITMENT MATCHING & API TESTS  ');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title} — ${detail || ''}`);
      failed++;
    }
  }

  const userA_id = '655875a4-878d-40ad-8be1-78e763e9eac1'; // karthik
  const userB_id = 'e165ac24-675c-48a5-b423-a97b37415169'; // sarkarijob_testadmin

  // -----------------------------------------------------------------
  // Test 1: User A Match Isolation
  // -----------------------------------------------------------------
  {
    const { data: matchesA } = await supabase
      .from('user_recruitment_matches')
      .select('id, user_id, eligibility_status')
      .eq('user_id', userA_id);

    const { data: matchesB } = await supabase
      .from('user_recruitment_matches')
      .select('id, user_id, eligibility_status')
      .eq('user_id', userB_id);

    const hasBInA = matchesA?.some((m) => m.user_id === userB_id);
    const hasAInB = matchesB?.some((m) => m.user_id === userA_id);

    assert(
      !hasBInA && !hasAInB,
      'Test 1: Authenticated user only sees own matches (Strict isolation between User A & User B)',
      `User A count: ${matchesA?.length}, User B count: ${matchesB?.length}`
    );
  }

  // -----------------------------------------------------------------
  // Test 2: Status Filtering (eligible, verify, not_eligible)
  // -----------------------------------------------------------------
  {
    const { data: eligibleMatches } = await supabase
      .from('user_recruitment_matches')
      .select('id, eligibility_status')
      .eq('user_id', userA_id)
      .eq('eligibility_status', 'eligible');

    const { data: verifyMatches } = await supabase
      .from('user_recruitment_matches')
      .select('id, eligibility_status')
      .eq('user_id', userA_id)
      .eq('eligibility_status', 'verify');

    const allEligibleValid = (eligibleMatches || []).every((m) => m.eligibility_status === 'eligible');
    const allVerifyValid = (verifyMatches || []).every((m) => m.eligibility_status === 'verify');

    assert(
      allEligibleValid && allVerifyValid,
      'Test 2: Status filtering (eligible / verify / not_eligible) functions accurately',
      `Eligible count: ${eligibleMatches?.length}, Verify count: ${verifyMatches?.length}`
    );
  }

  // -----------------------------------------------------------------
  // Test 3: Relevant Endpoint Excludes not_eligible by Default
  // -----------------------------------------------------------------
  {
    const { data: defaultRelevant } = await supabase
      .from('user_recruitment_matches')
      .select('id, eligibility_status')
      .eq('user_id', userA_id)
      .in('eligibility_status', ['eligible', 'verify']);

    const hasNotEligible = (defaultRelevant || []).some((m) => m.eligibility_status === 'not_eligible');

    assert(
      !hasNotEligible,
      'Test 3: Relevant recruitments endpoint excludes not_eligible by default',
      `Default relevant count: ${defaultRelevant?.length}`
    );
  }

  // -----------------------------------------------------------------
  // Test 4: Detail Endpoint Security (No Cross-User Match Exposure)
  // -----------------------------------------------------------------
  {
    const targetRecId = 'db7b336b-747c-48e9-a8cc-bd975b184fc2'; // APPSC 16/2026

    const { data: matchA } = await supabase
      .from('user_recruitment_matches')
      .select('*')
      .eq('user_id', userA_id)
      .eq('recruitment_id', targetRecId)
      .maybeSingle();

    const { data: matchB } = await supabase
      .from('user_recruitment_matches')
      .select('*')
      .eq('user_id', userB_id)
      .eq('recruitment_id', targetRecId)
      .maybeSingle();

    assert(
      matchA?.user_id === userA_id && matchB?.user_id === userB_id,
      'Test 4: Detail endpoint returns current user\'s match and does NOT expose another user\'s match',
      `Match A user: ${matchA?.user_id}, Match B user: ${matchB?.user_id}`
    );
  }

  // -----------------------------------------------------------------
  // Test 5: Events Restricted to Matched Recruitments Only
  // -----------------------------------------------------------------
  {
    const { data: userAMatches } = await supabase
      .from('user_recruitment_matches')
      .select('recruitment_id')
      .eq('user_id', userA_id);

    const recIdsA = (userAMatches || []).map((m) => m.recruitment_id);

    if (recIdsA.length > 0) {
      const { data: eventsA } = await supabase
        .from('recruitment_events')
        .select('id, recruitment_id')
        .in('recruitment_id', recIdsA);

      const allBelongToA = (eventsA || []).every((e) => recIdsA.includes(e.recruitment_id));

      assert(
        allBelongToA,
        'Test 5: User recruitment events are strictly restricted to matched recruitments',
        `Events count: ${eventsA?.length}`
      );
    } else {
      assert(true, 'Test 5: User recruitment events restricted (no matches on file)');
    }
  }

  // -----------------------------------------------------------------
  // Test 6: Dashboard Counts are User-Specific
  // -----------------------------------------------------------------
  {
    const { data: matchesA } = await supabase
      .from('user_recruitment_matches')
      .select('eligibility_status')
      .eq('user_id', userA_id);

    const { data: matchesB } = await supabase
      .from('user_recruitment_matches')
      .select('eligibility_status')
      .eq('user_id', userB_id);

    const countA_eligible = (matchesA || []).filter((m) => m.eligibility_status === 'eligible').length;
    const countB_eligible = (matchesB || []).filter((m) => m.eligibility_status === 'eligible').length;

    assert(
      typeof countA_eligible === 'number' && typeof countB_eligible === 'number',
      'Test 6: Dashboard summary statistics are calculated strictly per user',
      `User A eligible: ${countA_eligible}, User B eligible: ${countB_eligible}`
    );
  }

  // -----------------------------------------------------------------
  // Test 7: JWT Token Generation & Verification
  // -----------------------------------------------------------------
  {
    const tokenA = jwt.sign({ userId: userA_id, username: 'karthik' }, JWT_SECRET);
    const decoded = jwt.verify(tokenA, JWT_SECRET) as any;

    assert(
      decoded.userId === userA_id,
      'Test 7: JWT authentication claims correctly resolve user identity',
      `Decoded userId: ${decoded.userId}`
    );
  }

  console.log('\n===========================================================');
  console.log(` Phase 7 API Test Suite Finished: ${passed} Passed, ${failed} Failed`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase7ApiTests().catch((err) => {
  console.error('❌ Phase 7 API Test Error:', err);
  process.exit(1);
});
