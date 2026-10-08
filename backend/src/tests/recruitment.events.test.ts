import 'dotenv/config';
import {
  detectRecruitmentChanges,
  classifyDocumentTitle,
  RecruitmentState,
} from '../services/recruitment/events.service.js';
import type { RawRecruitmentItem } from '../services/recruitment/types.js';

function createMockItem(overrides: Partial<RawRecruitmentItem> = {}): RawRecruitmentItem {
  return {
    organization: 'APPSC',
    title: 'Notification to the Post of Forest Range Officers',
    notification_number: '16/2026',
    recruitment_type: 'recruitment_notification',
    description: 'General Recruitment',
    vacancies: 37,
    notification_date: '2026-03-01',
    application_start: '2026-03-10',
    application_end: '2026-04-10',
    exam_date: null,
    official_page_url: 'https://psc.ap.gov.in',
    official_pdf_url: 'https://psc.ap.gov.in/16_2026.pdf',
    source_url: 'https://psc.ap.gov.in',
    source_document_url: 'https://psc.ap.gov.in',
    discovered_at: '2026-03-01T00:00:00Z',
    raw_text: '{}',
    content_hash: 'hash_v1',
    min_age: null,
    max_age: null,
    fee: null,
    ...overrides,
  };
}

function createMockOldState(overrides: Partial<RecruitmentState> = {}): RecruitmentState {
  return {
    id: 'test-recruitment-uuid-1234',
    title: 'Notification to the Post of Forest Range Officers',
    notification_number: '16/2026',
    application_start: '2026-03-10',
    application_end: '2026-04-10',
    exam_date: null,
    vacancies: 37,
    content_hash: 'hash_v1',
    ...overrides,
  };
}

function runEventUnitTests() {
  console.log('===========================================================');
  console.log('    PHASE 6: RECRUITMENT EVENTS & CHANGE DETECTION TESTS   ');
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

  // -----------------------------------------------------------------
  // Test 1: Classification - Corrigendum
  // -----------------------------------------------------------------
  {
    const type = classifyDocumentTitle('Corrigendum to Notification No. 16/2026');
    assert(
      type === 'corrigendum',
      'Test 1: Official document title containing Corrigendum -> corrigendum event',
      `Got: ${type}`
    );
  }

  // -----------------------------------------------------------------
  // Test 2: Classification - Admit Card
  // -----------------------------------------------------------------
  {
    const type = classifyDocumentTitle('Download Hall Ticket / Admit Card for Forest Range Officer Exam');
    assert(
      type === 'admit_card',
      'Test 2: Official document title containing Admit Card -> admit_card event',
      `Got: ${type}`
    );
  }

  // -----------------------------------------------------------------
  // Test 3: Classification - Result
  // -----------------------------------------------------------------
  {
    const type = classifyDocumentTitle('Selection List & Final Result for Notification 16/2026');
    assert(
      type === 'result',
      'Test 3: Official document title containing Result -> result event',
      `Got: ${type}`
    );
  }

  // -----------------------------------------------------------------
  // Test 4: Classification - Answer Key
  // -----------------------------------------------------------------
  {
    const type = classifyDocumentTitle('Initial Answer Key & Response Sheet');
    assert(
      type === 'answer_key',
      'Test 4: Official document title containing Answer Key -> answer_key event',
      `Got: ${type}`
    );
  }

  // -----------------------------------------------------------------
  // Test 5: Deadline Unchanged -> 0 events
  // -----------------------------------------------------------------
  {
    const oldState = createMockOldState({ application_end: '2026-04-10' });
    const newItem = createMockItem({ application_end: '2026-04-10' });
    const events = detectRecruitmentChanges(oldState.id, oldState, newItem);
    const deadlineEvents = events.filter(e => e.event_type.includes('deadline') || e.event_type.includes('extended'));

    assert(
      deadlineEvents.length === 0,
      'Test 5: Deadline unchanged -> no event generated',
      `Events count: ${deadlineEvents.length}`
    );
  }

  // -----------------------------------------------------------------
  // Test 6: Deadline Moved Later -> application_extended
  // -----------------------------------------------------------------
  {
    const oldState = createMockOldState({ application_end: '2026-04-10' });
    const newItem = createMockItem({ application_end: '2026-04-20' });
    const events = detectRecruitmentChanges(oldState.id, oldState, newItem);
    const extEvent = events.find(e => e.event_type === 'application_extended');

    assert(
      Boolean(extEvent && extEvent.description?.includes('from 2026-04-10 to 2026-04-20')),
      'Test 6: Deadline moved later -> application_extended event created',
      `Event: ${JSON.stringify(extEvent)}`
    );
  }

  // -----------------------------------------------------------------
  // Test 7: Deadline Moved Earlier -> application_deadline_changed
  // -----------------------------------------------------------------
  {
    const oldState = createMockOldState({ application_end: '2026-04-20' });
    const newItem = createMockItem({ application_end: '2026-04-15' });
    const events = detectRecruitmentChanges(oldState.id, oldState, newItem);
    const changeEvent = events.find(e => e.event_type === 'application_deadline_changed');

    assert(
      Boolean(changeEvent && changeEvent.description?.includes('from 2026-04-20 to 2026-04-15')),
      'Test 7: Deadline moved earlier -> application_deadline_changed event created',
      `Event: ${JSON.stringify(changeEvent)}`
    );
  }

  // -----------------------------------------------------------------
  // Test 8: Exam Date Newly Announced -> exam_date_changed
  // -----------------------------------------------------------------
  {
    const oldState = createMockOldState({ exam_date: null });
    const newItem = createMockItem({ exam_date: '2026-08-15' });
    const events = detectRecruitmentChanges(oldState.id, oldState, newItem);
    const examEvent = events.find(e => e.event_type === 'exam_date_changed');

    assert(
      !!examEvent && examEvent.title === 'Exam date announced',
      'Test 8: Exam date newly announced -> exam_date_changed event created',
      `Event: ${JSON.stringify(examEvent)}`
    );
  }

  // -----------------------------------------------------------------
  // Test 9: Exam Date Changed -> exam_date_changed
  // -----------------------------------------------------------------
  {
    const oldState = createMockOldState({ exam_date: '2026-08-15' });
    const newItem = createMockItem({ exam_date: '2026-09-01' });
    const events = detectRecruitmentChanges(oldState.id, oldState, newItem);
    const examEvent = events.find(e => e.event_type === 'exam_date_changed');

    assert(
      !!examEvent && examEvent.title === 'Exam date updated',
      'Test 9: Exam date updated -> exam_date_changed event created',
      `Event: ${JSON.stringify(examEvent)}`
    );
  }

  // -----------------------------------------------------------------
  // Test 10: Vacancy Changed -> vacancy_changed
  // -----------------------------------------------------------------
  {
    const oldState = createMockOldState({ vacancies: 37 });
    const newItem = createMockItem({ vacancies: 45 });
    const events = detectRecruitmentChanges(oldState.id, oldState, newItem);
    const vacEvent = events.find(e => e.event_type === 'vacancy_changed');

    assert(
      Boolean(vacEvent && vacEvent.description?.includes('37 to 45')),
      'Test 10: Vacancy count changed -> vacancy_changed event created',
      `Event: ${JSON.stringify(vacEvent)}`
    );
  }

  // -----------------------------------------------------------------
  // Test 11: Event Content Hash Idempotency
  // -----------------------------------------------------------------
  {
    const oldState = createMockOldState({ vacancies: 37 });
    const newItem = createMockItem({ vacancies: 45 });
    const events1 = detectRecruitmentChanges(oldState.id, oldState, newItem);
    const events2 = detectRecruitmentChanges(oldState.id, oldState, newItem);

    assert(
      events1.length === events2.length && events1[0].content_hash === events2[0].content_hash,
      'Test 11: Idempotency - Same change produces identical content_hash across runs',
      `Hash 1: ${events1[0]?.content_hash}, Hash 2: ${events2[0]?.content_hash}`
    );
  }

  console.log('\n===========================================================');
  console.log(` Recruitment Events Suite Finished: ${passed} Passed, ${failed} Failed`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runEventUnitTests();
