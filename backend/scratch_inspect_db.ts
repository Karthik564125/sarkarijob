import { supabase } from './src/config/supabase.js';

async function inspectDB() {
  console.log('--- RECRUITMENTS ---');
  const { data: recs, error: e1 } = await supabase.from('recruitments').select('*').order('created_at', { ascending: false });
  if (e1) console.error('Recruitments error:', e1);
  else {
    console.log(`Total recruitments: ${recs.length}`);
    for (const r of recs) {
      console.log(`- [${r.organization}] ${r.notification_number || 'N/A'} | ${r.title.substring(0, 50)} | status=${r.status} | start=${r.application_start} | end=${r.application_end} | extraction=${r.extraction_status}`);
    }
  }

  console.log('\n--- RECRUITMENT DOCUMENTS ---');
  const { data: docs, error: e2 } = await supabase.from('recruitment_documents').select('*');
  if (e2) console.error('Docs error:', e2);
  else {
    console.log(`Total documents: ${docs.length}`);
    const pending = docs.filter(d => d.extraction_status === 'pending');
    const completed = docs.filter(d => d.extraction_status === 'completed');
    const failed = docs.filter(d => d.extraction_status === 'failed');
    console.log(`Pending: ${pending.length}, Completed: ${completed.length}, Failed: ${failed.length}`);
  }

  console.log('\n--- USER RECRUITMENT MATCHES ---');
  const { data: matches, error: e3 } = await supabase.from('user_recruitment_matches').select('*');
  if (e3) console.error('Matches error:', e3);
  else {
    console.log(`Total matches: ${matches.length}`);
    for (const m of matches) {
      console.log(`- User: ${m.user_id} | Rec: ${m.recruitment_id} | Eligibility: ${m.eligibility_status}`);
    }
  }

  console.log('\n--- USERS ---');
  const { data: users, error: e4 } = await supabase.from('users').select('id, username, email');
  if (e4) console.error('Users error:', e4);
  else console.log('Users:', users);
}

inspectDB().catch(console.error);
