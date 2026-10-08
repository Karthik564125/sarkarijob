import 'dotenv/config';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { supabase } from '../config/supabase.js';
import { refreshUserProfileMatches } from '../services/recruitment/matching.service.js';

const userId = '655875a4-878d-40ad-8be1-78e763e9eac1';
const recruitmentId = 'd0756bbd-87fe-4257-b5e1-9ef6a836e86e';

describe('profile sync regression tests', () => {
  it('re-evaluates stale match rows when profile data changes', async () => {
    await supabase.from('education_graduation').upsert({
      user_id: userId,
      degree: "Bachelor's Degree",
      branch: 'Computer Science and Engineering',
      university: 'KL University',
      passing_year: 2026,
      percentage_or_cgpa: '80%',
    }, { onConflict: 'user_id' });

    const before = await supabase
      .from('user_recruitment_matches')
      .select('eligibility_status, reasons, unmet_criteria')
      .eq('user_id', userId)
      .eq('recruitment_id', recruitmentId)
      .maybeSingle();

    await refreshUserProfileMatches(userId);

    const after = await supabase
      .from('user_recruitment_matches')
      .select('eligibility_status, reasons, unmet_criteria, matched_criteria')
      .eq('user_id', userId)
      .eq('recruitment_id', recruitmentId)
      .maybeSingle();

    assert.ok(after.data, 'match row should exist after refresh');
    assert.ok(
      JSON.stringify(after.data?.reasons ?? []).includes('Branch mismatch') ||
      JSON.stringify(after.data?.unmet_criteria ?? []).includes('Computer Science and Engineering'),
      `re-evaluation should use the current profile, not stale Forestry / Science. Got ${JSON.stringify(after.data)}`
    );
    assert.equal(after.data?.eligibility_status, 'not_eligible');
    assert.ok(!JSON.stringify(after.data?.unmet_criteria ?? []).includes('Forestry / Science'));
    assert.ok(!JSON.stringify(after.data?.reasons ?? []).includes('Forestry / Science'));
  });
});
