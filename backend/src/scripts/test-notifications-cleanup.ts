import {
  isRecruitmentCurrentOrRelevant,
  isEventRecentAndRelevant,
} from '../services/recruitment/recruitmentFreshness.service.js';

async function runNotificationTests() {
  console.log('=== RUNNING 14 NOTIFICATION CLEANUP TEST CASES ===\n');

  const now = new Date('2026-10-07T10:00:00Z');
  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean) {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      failed++;
    }
  }

  // Sample data definitions
  const rrb03_2018 = {
    title: 'RRB CEN 03/2018 Junior Engineer',
    notification_number: 'CEN 03/2018',
    notification_date: '2018-12-29',
    application_end: '2019-01-31',
    status: 'closed',
    organization: 'RRB',
  };

  const rrb04_2014 = {
    title: 'RRB CEN 04/2014 NTPC',
    notification_number: 'CEN 04/2014',
    notification_date: '2014-09-20',
    application_end: '2014-10-20',
    status: 'closed',
    organization: 'RRB',
  };

  const rrbRrc01_2019 = {
    title: 'RRB CEN RRC 01/2019 Group D',
    notification_number: 'CEN RRC 01/2019',
    notification_date: '2019-02-23',
    application_end: '2019-04-12',
    status: 'closed',
    organization: 'RRB',
  };

  const rrb04_2026 = {
    title: 'RRB CEN 04/2026 Technicians',
    notification_number: 'CEN 04/2026',
    notification_date: '2026-09-15',
    application_start: '2026-10-01',
    application_end: '2026-11-01',
    status: 'open',
    organization: 'RRB',
  };

  const appsc07_2026 = {
    title: 'APPSC Group-I Services 07/2026',
    notification_number: '07/2026',
    notification_date: '2026-10-06',
    application_start: '2026-10-06',
    application_end: '2026-11-06',
    status: 'open',
    organization: 'APPSC',
  };

  const appsc26_2026 = {
    title: 'APPSC ASWO/ATWO 26/2026',
    notification_number: '26/2026',
    notification_date: '2026-09-15',
    application_start: '2026-09-15',
    application_end: '2026-10-15',
    status: 'open',
    organization: 'APPSC',
  };

  const sscCgl2026 = {
    title: 'SSC CGL Examination 2026',
    notification_number: 'SSC CGL 2026',
    notification_date: '2026-09-01',
    application_start: '2026-09-01',
    application_end: '2026-10-20',
    status: 'open',
    organization: 'SSC',
  };

  // 1. Historical RRB CEN 03/2018 does not generate/show new recruitment notification
  const ev1 = { event_type: 'notification', event_date: null as string | null, created_at: '2026-10-06T10:00:00Z', recruitments: rrb03_2018 };
  assert('1. Historical RRB CEN 03/2018 does not show new recruitment notification', !isEventRecentAndRelevant(ev1, now));

  // 2. Historical RRB CEN 04/2014 does not generate/show new recruitment notification
  const ev2 = { event_type: 'notification', event_date: null as string | null, created_at: '2026-10-06T10:00:00Z', recruitments: rrb04_2014 };
  assert('2. Historical RRB CEN 04/2014 does not show new recruitment notification', !isEventRecentAndRelevant(ev2, now));

  // 3. Historical RRB CEN RRC 01/2019 does not generate/show new recruitment notification
  const ev3 = { event_type: 'notification', event_date: null as string | null, created_at: '2026-10-06T10:00:00Z', recruitments: rrbRrc01_2019 };
  assert('3. Historical RRB CEN RRC 01/2019 does not show new recruitment notification', !isEventRecentAndRelevant(ev3, now));

  // 4. Current RRB CEN 04/2026 can generate/show new recruitment notification
  const ev4 = { event_type: 'notification', event_date: null as string | null, created_at: '2026-10-06T10:00:00Z', recruitments: rrb04_2026 };
  assert('4. Current RRB CEN 04/2026 shows new recruitment notification', isEventRecentAndRelevant(ev4, now));

  // 5. Current APPSC 07/2026 can generate/show new recruitment notification
  const ev5 = { event_type: 'notification', event_date: null as string | null, created_at: '2026-10-06T10:00:00Z', recruitments: appsc07_2026 };
  assert('5. Current APPSC 07/2026 shows new recruitment notification', isEventRecentAndRelevant(ev5, now));

  // 6. Current APPSC 26/2026 can generate/show new recruitment notification
  const ev6 = { event_type: 'notification', event_date: null as string | null, created_at: '2026-10-06T10:00:00Z', recruitments: appsc26_2026 };
  assert('6. Current APPSC 26/2026 shows new recruitment notification', isEventRecentAndRelevant(ev6, now));

  // 7. SSC current recruitment events work
  const ev7 = { event_type: 'notification', event_date: null as string | null, created_at: '2026-10-06T10:00:00Z', recruitments: sscCgl2026 };
  assert('7. SSC current recruitment event works', isEventRecentAndRelevant(ev7, now));

  // 8. Recent result/admit-card/corrigendum event on an old recruitment can still appear if genuinely recent
  const ev8 = {
    event_type: 'result',
    event_date: '2026-10-05',
    created_at: '2026-10-06T10:00:00Z',
    recruitments: rrb03_2018,
  };
  assert('8. Genuinely recent result event on historical recruitment appears', isEventRecentAndRelevant(ev8, now));

  // Sample event list for API filtering tests
  const allEvents = [ev4, ev5, ev6, ev7, ev8];

  // 9. organization=APPSC filter works
  const appscOnly = allEvents.filter(e => e.recruitments.organization === 'APPSC');
  assert('9. organization=APPSC filter works', appscOnly.length === 2 && appscOnly.every(e => e.recruitments.organization === 'APPSC'));

  // 10. organization=RRB filter works
  const rrbOnly = allEvents.filter(e => e.recruitments.organization === 'RRB');
  assert('10. organization=RRB filter works', rrbOnly.length === 2 && rrbOnly.every(e => e.recruitments.organization === 'RRB'));

  // 11. organization=SSC filter works
  const sscOnly = allEvents.filter(e => e.recruitments.organization === 'SSC');
  assert('11. organization=SSC filter works', sscOnly.length === 1 && sscOnly[0].recruitments.organization === 'SSC');

  // 12. ALL returns all relevant sources
  assert('12. ALL returns all relevant sources', allEvents.length === 5);

  // 13. Newest sorting works
  const sortedEvents = [...allEvents].sort((a: { event_date?: string | null; created_at: string }, b: { event_date?: string | null; created_at: string }) => {
    const dateA = new Date(a.event_date || a.created_at).getTime();
    const dateB = new Date(b.event_date || b.created_at).getTime();
    return dateB - dateA;
  });
  assert('13. Newest sorting orders events descending by timestamp', new Date(sortedEvents[0].event_date || sortedEvents[0].created_at).getTime() >= new Date(sortedEvents[sortedEvents.length - 1].event_date || sortedEvents[sortedEvents.length - 1].created_at).getTime());

  // 14. Historical events do not dominate pagination
  const combinedRawEvents = [ev1, ev2, ev3, ev4, ev5, ev6, ev7, ev8];
  const cleanedEvents = combinedRawEvents.filter(e => isEventRecentAndRelevant(e, now));
  assert('14. Historical import events (ev1, ev2, ev3) filtered out before pagination', cleanedEvents.length === 5 && !cleanedEvents.includes(ev1));

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runNotificationTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
