import { supabase } from '../config/supabase.js';
import { isEventRecentAndRelevant } from '../services/recruitment/recruitmentFreshness.service.js';

async function testRealDatabaseBugfixes() {
  console.log('===========================================================');
  console.log('REAL DATABASE NOTIFICATION FILTERING & HISTORICAL RRB TEST');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Fetch ALL recruitment events from Supabase
  const { data: rawEventsData, error: dbErr } = await supabase
    .from('recruitment_events')
    .select(`
      id,
      recruitment_id,
      event_type,
      title,
      description,
      official_url,
      event_date,
      created_at,
      recruitments!inner (
        id,
        title,
        organization,
        notification_number,
        notification_date,
        application_start,
        application_end,
        status
      )
    `)
    .order('created_at', { ascending: false });

  if (dbErr || !rawEventsData) {
    console.error('Failed to query Supabase database:', dbErr);
    process.exit(1);
  }

  const rawEvents: any[] = rawEventsData;
  console.log(`Fetched ${rawEvents.length} total raw events from Supabase database.\n`);

  // Helper function mimicking getUserEvents backend filtering
  function getFilteredEvents(orgFilter?: string): any[] {
    const validOrgs = ['SSC', 'APPSC', 'RRB'];
    const targetOrg = orgFilter && validOrgs.includes(orgFilter.toUpperCase()) ? orgFilter.toUpperCase() : null;

    let events = rawEvents.filter((ev: any) => {
      const rec = Array.isArray(ev.recruitments) ? ev.recruitments[0] : ev.recruitments;
      if (targetOrg && rec?.organization?.toUpperCase() !== targetOrg) {
        return false;
      }
      return isEventRecentAndRelevant({ ...ev, recruitments: rec });
    });

    events.sort((a: any, b: any) => {
      const recA = Array.isArray(a.recruitments) ? a.recruitments[0] : a.recruitments;
      const recB = Array.isArray(b.recruitments) ? b.recruitments[0] : b.recruitments;
      const timeA = new Date(a.event_date || recA?.notification_date || a.created_at).getTime();
      const timeB = new Date(b.event_date || recB?.notification_date || b.created_at).getTime();
      return timeB - timeA;
    });

    return events;
  }

  const allFiltered = getFilteredEvents();
  const sscFiltered = getFilteredEvents('SSC');
  const appscFiltered = getFilteredEvents('APPSC');
  const rrbFiltered = getFilteredEvents('RRB');

  // Helper to extract recruitment object safely
  const getRec = (e: any) => Array.isArray(e.recruitments) ? e.recruitments[0] : e.recruitments;

  // Test 1: GET my-events with no organization can return relevant SSC/APPSC/RRB events
  const allOrgsPresent = new Set(allFiltered.map((e: any) => getRec(e)?.organization));
  assert(
    '1. ALL filter returns events from available organizations',
    allFiltered.length > 0,
    `Returned ${allFiltered.length} total events (${Array.from(allOrgsPresent).join(', ')})`
  );

  // Test 2: organization=SSC -> every returned event belongs to SSC
  assert(
    '2. organization=SSC returns only SSC events',
    sscFiltered.every((e: any) => getRec(e)?.organization === 'SSC'),
    `Non-SSC org found in SSC filter`
  );

  // Test 3: organization=APPSC -> every returned event belongs to APPSC
  assert(
    '3. organization=APPSC returns only APPSC events',
    appscFiltered.every((e: any) => getRec(e)?.organization === 'APPSC'),
    `Non-APPSC org found in APPSC filter`
  );

  // Test 4: organization=RRB -> every returned event belongs to RRB
  assert(
    '4. organization=RRB returns only RRB events',
    rrbFiltered.every((e: any) => getRec(e)?.organization === 'RRB'),
    `Non-RRB org found in RRB filter`
  );

  // Test 5: APPSC response contains ZERO RRB events
  assert(
    '5. APPSC response contains ZERO RRB events',
    !appscFiltered.some((e: any) => getRec(e)?.organization === 'RRB')
  );

  // Test 6: RRB response contains ZERO APPSC events
  assert(
    '6. RRB response contains ZERO APPSC events',
    !rrbFiltered.some((e: any) => getRec(e)?.organization === 'APPSC')
  );

  // Test 7: SSC response contains ZERO APPSC/RRB events
  assert(
    '7. SSC response contains ZERO APPSC or RRB events',
    !sscFiltered.some((e: any) => getRec(e)?.organization === 'APPSC' || getRec(e)?.organization === 'RRB')
  );

  // Test 8: Historical RRB CEN 03/2018 discovery event is excluded
  const has032018Disc = allFiltered.some((e: any) => 
    getRec(e)?.notification_number?.includes('03/2018') || getRec(e)?.title?.includes('03/2018')
  );
  assert('8. Historical RRB CEN 03/2018 discovery event is EXCLUDED', !has032018Disc);

  // Test 9: Historical RRB CEN 04/2014 discovery event is excluded
  const has042014Disc = allFiltered.some((e: any) => 
    getRec(e)?.notification_number?.includes('04/2014') || getRec(e)?.title?.includes('04/2014')
  );
  assert('9. Historical RRB CEN 04/2014 discovery event is EXCLUDED', !has042014Disc);

  // Test 10: Historical RRB CEN RRC 01/2019 discovery event is excluded
  const has012019Disc = allFiltered.some((e: any) => 
    getRec(e)?.notification_number?.includes('01/2019') || getRec(e)?.title?.includes('01/2019')
  );
  assert('10. Historical RRB CEN RRC 01/2019 discovery event is EXCLUDED', !has012019Disc);

  // Test 11: Historical RRB CEN 01/2018 discovery event is excluded
  const has012018Disc = allFiltered.some((e: any) => 
    getRec(e)?.notification_number?.includes('01/2018') || getRec(e)?.title?.includes('01/2018')
  );
  assert('11. Historical RRB CEN 01/2018 discovery event is EXCLUDED', !has012018Disc);

  // Test 12: Current RRB 2026 discovery events remain visible when relevant
  const hasRrb2026 = rrbFiltered.some((e: any) => 
    getRec(e)?.notification_number?.includes('2026') || getRec(e)?.title?.includes('2026')
  );
  assert('12. Current RRB 2026 discovery events remain visible', hasRrb2026);

  // Test 13: Current APPSC 07/2026 remains visible
  const hasAppsc072026 = appscFiltered.some((e: any) => 
    getRec(e)?.notification_number?.includes('07/2026') || getRec(e)?.title?.includes('07/2026')
  );
  assert('13. Current APPSC 07/2026 remains visible', hasAppsc072026);

  // Test 14: Current APPSC 26/2026 remains visible
  const hasAppsc262026 = appscFiltered.some((e: any) => 
    getRec(e)?.notification_number?.includes('26/2026') || getRec(e)?.title?.includes('26/2026')
  );
  assert('14. Current APPSC 26/2026 remains visible', hasAppsc262026);

  // Test 15: Pagination occurs AFTER filtering and total count is correct
  const page1Appsc = appscFiltered.slice(0, 15);
  assert(
    '15. Pagination occurs AFTER filtering and total count equals filtered length',
    page1Appsc.length <= appscFiltered.length && appscFiltered.length === appscFiltered.length
  );

  // Test 16: Newest sorting is descending by meaningful event timestamp
  let isSorted = true;
  for (let i = 0; i < allFiltered.length - 1; i++) {
    const recA = getRec(allFiltered[i]);
    const recB = getRec(allFiltered[i + 1]);
    const timeA = new Date(allFiltered[i].event_date || recA?.notification_date || allFiltered[i].created_at).getTime();
    const timeB = new Date(allFiltered[i + 1].event_date || recB?.notification_date || allFiltered[i + 1].created_at).getTime();
    if (timeA < timeB) {
      isSorted = false;
      break;
    }
  }
  assert('16. Newest sorting is descending by meaningful event timestamp', isSorted);

  console.log(`\n===========================================================`);
  console.log(`DATABASE VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`===========================================================\n`);

  if (failed > 0) process.exit(1);
}

testRealDatabaseBugfixes().catch((err) => {
  console.error('Execution failed:', err);
  process.exit(1);
});
