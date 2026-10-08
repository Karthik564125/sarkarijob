import 'dotenv/config';
import { supabase } from '../config/supabase.js';
import { evaluateEligibility } from '../services/recruitment/matching.service.js';
import type { UserProfile } from '../services/recruitment/matching.service.js';

async function testRealUser162026() {
  console.log('===========================================================');
  console.log('   SAFE REAL USER TEST AGAINST AUTHENTIC APPSC 16/2026    ');
  console.log('===========================================================\n');

  const userId = '655875a4-878d-40ad-8be1-78e763e9eac1'; // karthik
  const recruitmentId = 'db7b336b-747c-48e9-a8cc-bd975b184fc2'; // APPSC 16/2026

  // 1. Read real profile from DB WITHOUT modification
  const { data: prof } = await supabase
    .from('user_profiles')
    .select('date_of_birth, gender, state_of_domicile, reservation_category')
    .eq('user_id', userId)
    .single();

  const { data: grad } = await supabase
    .from('education_graduation')
    .select('degree, branch, university, passing_year')
    .eq('user_id', userId)
    .single();

  const userProfile: UserProfile = {
    date_of_birth: prof?.date_of_birth ?? null,
    gender: prof?.gender ?? null,
    state_of_domicile: prof?.state_of_domicile ?? null,
    reservation_category: prof?.reservation_category ?? null,
    education: grad
      ? {
          degree: grad.degree ?? null,
          branch: grad.branch ?? null,
          university: grad.university ?? null,
          passing_year: grad.passing_year ?? null,
        }
      : null,
  };

  console.log('User Profile Loaded from DB (Read-Only):');
  console.log(' - DOB:', userProfile.date_of_birth);
  console.log(' - Gender:', userProfile.gender);
  console.log(' - Domicile:', userProfile.state_of_domicile);
  console.log(' - Degree:', userProfile.education?.degree);
  console.log(' - Branch:', userProfile.education?.branch);

  // 2. Read authentic recruitment record from DB WITHOUT modification
  const { data: rec } = await supabase
    .from('recruitments')
    .select('id, title, notification_number, eligibility_rules')
    .eq('id', recruitmentId)
    .single();

  if (!rec) throw new Error('Recruitment 16/2026 not found');

  console.log('\nRecruitment Loaded from DB (Read-Only):');
  console.log(' - Title:', rec.title);
  console.log(' - Notification Number:', rec.notification_number);
  console.log(' - Extracted Age:', rec.eligibility_rules?.age);
  console.log(' - Extracted Allowed Branches:', rec.eligibility_rules?.education?.allowed_branches);
  console.log(' - Extracted Required Subjects:', rec.eligibility_rules?.education?.required_subjects);
  console.log(' - Extraction Ambiguities:', rec.eligibility_rules?.ambiguities);

  // 3. Evaluate eligibility
  const result = evaluateEligibility(userProfile, rec.eligibility_rules as any);

  console.log('\n--- EVALUATION VERDICT FOR AUTHENTIC 16/2026 ---');
  console.log('Status:', result.status.toUpperCase());
  console.log('Matched Criteria:', JSON.stringify(result.matched_criteria, null, 2));
  console.log('Unmet Criteria:', JSON.stringify(result.unmet_criteria, null, 2));
  console.log('Unknown Criteria:', JSON.stringify(result.unknown_criteria, null, 2));
  console.log('Reasons:', JSON.stringify(result.reasons, null, 2));

  if (result.status !== 'verify') {
    throw new Error(`EXPECTED STATUS 'verify', GOT '${result.status}'`);
  }

  console.log('\n===========================================================');
  console.log(' ✅ REAL USER TEST PASSED: STATUS IS CORRECTLY "VERIFY" (🟡)');
  console.log('===========================================================');
}

testRealUser162026().catch(err => {
  console.error('\n❌ REAL USER TEST FAILED:', err);
  process.exit(1);
});
