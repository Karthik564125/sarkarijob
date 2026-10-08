import { isRecruitmentCurrentOrRelevant, deriveRecruitmentStatus, isEventRecentAndRelevant } from '../services/recruitment/recruitmentFreshness.service.js';
import { appscCollector } from '../services/recruitment/collectors/appsc.collector.js';
import { SSCCollector } from '../services/recruitment/collectors/ssc.collector.js';
import { rrbCollector } from '../services/recruitment/collectors/rrb.collector.js';

async function runVerification() {
  console.log('=== STARTING FRESHNESS & COLLECTOR VERIFICATION ===\n');

  // 1. Freshness Unit Tests
  console.log('--- 1. Testing Freshness Rules ---');
  const now = new Date('2026-10-07T10:00:00Z');

  const openJob = {
    title: 'Group-I Services 07/2026',
    notification_number: '07/2026',
    application_start: '2026-10-01',
    application_end: '2026-11-01',
    notification_date: '2026-10-06',
    status: 'open',
  };

  const oldJob = {
    title: 'Assistant Engineer 15/2021',
    notification_number: '15/2021',
    application_start: '2021-05-01',
    application_end: '2021-06-01',
    notification_date: '2021-05-10',
    status: 'closed',
  };

  const old2023Job = {
    title: 'Polytechnic Lecturers 13/2023',
    notification_number: '13/2023',
    application_start: '2023-12-01',
    application_end: '2024-01-01',
    notification_date: '2023-12-21',
    status: 'closed',
  };

  const upcomingJob = {
    title: 'CEN 01/2026 ALP',
    notification_number: 'CEN 01/2026',
    application_start: '2026-10-15',
    application_end: '2026-11-15',
    notification_date: '2026-10-01',
    status: 'upcoming',
  };

  console.log('07/2026 (Current):', isRecruitmentCurrentOrRelevant(openJob, now) === true ? 'PASS (Current)' : 'FAIL');
  console.log('15/2021 (Historical):', isRecruitmentCurrentOrRelevant(oldJob, now) === false ? 'PASS (Filtered Out)' : 'FAIL');
  console.log('13/2023 (Historical):', isRecruitmentCurrentOrRelevant(old2023Job, now) === false ? 'PASS (Filtered Out)' : 'FAIL');
  console.log('CEN 01/2026 (Upcoming):', isRecruitmentCurrentOrRelevant(upcomingJob, now) === true ? 'PASS (Current)' : 'FAIL');

  // Derive status
  console.log('\nStatus resolution:');
  console.log('Old 2021 job without end date status:', deriveRecruitmentStatus(null, null, '2021-05-10', '15/2021', now) === 'closed' ? 'PASS (Closed)' : 'FAIL');
  console.log('Current 2026 job status:', deriveRecruitmentStatus('2026-10-01', '2026-11-01', '2026-10-06', '07/2026', now) === 'open' ? 'PASS (Open)' : 'FAIL');

  // Event filtering
  console.log('\nEvent filtering:');
  const oldImportEvent = {
    event_type: 'notification',
    created_at: '2026-10-07T10:00:00Z',
    recruitments: oldJob,
  };
  const recentCorrigendumEvent = {
    event_type: 'CORRIGENDUM',
    event_date: '2026-10-05',
    created_at: '2026-10-07T10:00:00Z',
    recruitments: openJob,
  };
  console.log('Historical import event:', isEventRecentAndRelevant(oldImportEvent, now) === false ? 'PASS (Filtered Out)' : 'FAIL');
  console.log('Recent corrigendum event:', isEventRecentAndRelevant(recentCorrigendumEvent, now) === true ? 'PASS (Kept)' : 'FAIL');

  // 2. Collector Live Verification
  console.log('\n--- 2. Testing APPSC Collector ---');
  const appscItems = await appscCollector.collect();
  const has07_2026 = appscItems.some((i) => i.notification_number === '07/2026');
  const has26_2026 = appscItems.some((i) => i.notification_number === '26/2026');
  const nonRecruitsCount = appscItems.filter((i) =>
    i.title.toLowerCase().includes('manual') ||
    i.title.toLowerCase().includes('faq') ||
    i.title.toLowerCase().includes('meeting')
  ).length;

  console.log(`APPSC Total Discovered: ${appscItems.length}`);
  console.log(`APPSC 07/2026 present: ${has07_2026 ? 'PASS' : 'FAIL'}`);
  console.log(`APPSC 26/2026 present: ${has26_2026 ? 'PASS' : 'FAIL'}`);
  console.log(`APPSC Non-recruitment links count: ${nonRecruitsCount} (Target: 0) -> ${nonRecruitsCount === 0 ? 'PASS' : 'FAIL'}`);

  console.log('\n--- 3. Testing SSC Collector ---');
  try {
    const sscCollector = new SSCCollector();
    const sscItems = await sscCollector.collect();
    console.log(`SSC Total Discovered: ${sscItems.length}`);
  } catch (e: any) {
    console.warn(`SSC collector notice: ${e.message}`);
  }

  console.log('\n--- 4. Testing RRB Collector ---');
  try {
    const rrbItems = await rrbCollector.collect();
    console.log(`RRB Total Discovered: ${rrbItems.length}`);
  } catch (e: any) {
    console.warn(`RRB collector notice: ${e.message}`);
  }

  console.log('\n=== ALL TESTS COMPLETED ===');
}

runVerification().catch(err => console.error('Verification error:', err));
