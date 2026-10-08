import test from 'node:test';
import assert from 'node:assert/strict';
import type { RawRecruitmentItem } from './types.js';
import { createBackfillPlan, type BackfillRecruitment } from './backfill-planner.js';

function createRecruitment(overrides: Partial<BackfillRecruitment> = {}): BackfillRecruitment {
  return {
    id: 'recruitment-1',
    organization: 'RRB',
    title: 'RRB CEN 04/2026 - Centralised Employment Notice',
    notification_number: 'CEN 04/2026',
    notification_date: null,
    application_start: null,
    application_end: null,
    exam_date: null,
    vacancies: null,
    eligibility_rules: null,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function createItem(overrides: Partial<RawRecruitmentItem> = {}): RawRecruitmentItem {
  return {
    organization: 'RRB',
    title: 'RRB CEN 04/2026 - Centralised Employment Notice',
    notification_number: 'CEN 04/2026',
    recruitment_type: 'recruitment_notification',
    description: null,
    vacancies: null,
    notification_date: null,
    application_start: null,
    application_end: null,
    exam_date: null,
    official_page_url: 'https://rrb.indianrailways.gov.in/chandigarh',
    official_pdf_url: 'https://rrb.indianrailways.gov.in/-/image/CEN_04_2026_English.pdf/examsDocuments',
    source_url: 'https://www.rrb.gov.in/',
    source_document_url: 'https://rrb.indianrailways.gov.in/chandigarh',
    discovered_at: '2026-10-08T00:00:00.000Z',
    raw_text: null,
    content_hash: 'cen-04-hash',
    min_age: null,
    max_age: null,
    fee: null,
    ...overrides,
  };
}

test('duplicate regional discoveries produce one planned recruitment/document pair', () => {
  const discoveries = [
    createItem(),
    createItem({ official_page_url: 'https://www.rrbchennai.gov.in/getdata?cennum=04%2F2026&category=Notification' }),
  ];
  const plan = createBackfillPlan([createRecruitment()], [], discoveries);

  assert.equal(plan.documents.length, 1);
  assert.equal(plan.documents[0].recruitment.id, 'recruitment-1');
  assert.equal(plan.duplicateDocumentsPrevented, 1);
  assert.equal(plan.duplicateRecruitmentsPrevented, 0);
});

test('SSC title variants map to the most complete existing CHSL row without inserting a recruitment', () => {
  const incomplete = createRecruitment({
    id: 'chsl-incomplete',
    organization: 'SSC',
    title: 'Combined Higher Secondary Level (10+2) Examination,2026',
    notification_number: null,
  });
  const complete = createRecruitment({
    id: 'chsl-complete',
    organization: 'SSC',
    title: 'Combined Higher Secondary Level (10+2) Examination 2026',
    notification_number: null,
    notification_date: '2026-03-20',
    application_start: '2026-09-07',
    application_end: '2026-10-07',
  });
  const item = createItem({
    organization: 'SSC',
    title: 'Combined Higher Secondary Level (10+2) Examination, 2026',
    notification_number: null,
    official_page_url: 'https://ssc.gov.in/',
    official_pdf_url: 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_chsle_2026.pdf',
  });

  const plan = createBackfillPlan([incomplete, complete], [], [item]);
  assert.equal(plan.documents.length, 1);
  assert.equal(plan.documents[0].recruitment.id, 'chsl-complete');
  assert.equal(plan.duplicateRecruitmentsPrevented, 1);
});

test('existing completed documents are recognized and third-party URLs are rejected', () => {
  const item = createItem();
  const plan = createBackfillPlan([createRecruitment()], [{
    id: 'existing-doc',
    recruitment_id: 'recruitment-1',
    official_url: item.official_pdf_url!,
    extraction_status: 'completed',
  }], [item, createItem({ official_pdf_url: 'https://example.com/fake.pdf' })]);

  assert.equal(plan.documents.length, 1);
  assert.equal(plan.documents[0].existingDocument?.extraction_status, 'completed');
  assert.equal(plan.duplicateDocumentsPrevented, 1);
  assert.equal(plan.invalidOfficialUrls, 1);
});