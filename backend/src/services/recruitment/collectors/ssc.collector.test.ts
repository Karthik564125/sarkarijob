import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecruitmentTitle } from '../normalization.service.js';

import {
  getSscAttachmentUrl,
  mapSscRecruitmentNotice,
  normalizeSscRecruitmentTitle,
  safeNavUrl,
  shouldKeepSscAllExam,
} from './ssc.collector.js';

test('SSC allExams catalogue entries without date windows are rejected', () => {
  const exam = {
    id: 'cgl-2026',
    examCode: 'CGL',
    examName: 'Combined Graduate Level Examination, 2026',
    navigationUrl: '/ApplicationForm/cglform',
    description: 'Combined Graduate Level Examination, 2026 official form page',
  };

  assert.equal(shouldKeepSscAllExam(exam, new Set()), false);
  assert.equal(
    shouldKeepSscAllExam(exam, new Set(['combined graduate level examination, 2026'])),
    false
  );
});

test('SSC notice attachments resolve only to official PDF URLs', () => {
  assert.equal(
    getSscAttachmentUrl('uploads\\masterData\\NoticeBoards\\Notice_of_adv_cgl_2026.pdf'),
    'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf'
  );
  assert.equal(getSscAttachmentUrl('NULL'), null);
  assert.equal(getSscAttachmentUrl('https://example.com/notice.pdf'), null);
  assert.equal(safeNavUrl('https://example.com/notice.pdf'), null);
});

test('SSC recruitment notice maps only an official notification PDF without inventing fields', () => {
  const item = mapSscRecruitmentNotice({
    id: 'official-notice-id',
    headline: 'Notice of Combined Higher Secondary (10+2) Level Examination, 2026',
    createdAt: '2026-09-07T15:59:02.300Z',
    attachments: [{
      fileName: 'Notice_of_adv_chsle_2026.pdf',
      type: 'application/pdf',
      path: 'uploads\\masterData\\NoticeBoards\\Notice_of_adv_chsle_2026.pdf',
    }],
  }, '2026-10-08T00:00:00.000Z');

  assert.ok(item);
  assert.equal(item.title, 'Combined Higher Secondary Level (10+2) Examination, 2026');
  assert.equal(item.notification_date, '2026-09-07');
  assert.equal(item.official_pdf_url, 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_chsle_2026.pdf');
  assert.equal(item.application_start, null);
  assert.equal(item.application_end, null);
  assert.equal(item.exam_date, null);
  assert.equal(item.vacancies, null);
  assert.equal(normalizeSscRecruitmentTitle('Notice of Combined Graduate Level Examination, 2026'), 'Combined Graduate Level Examination, 2026');
});

test('SSC mapper rejects non-recruitment notices and missing PDF attachments', () => {
  assert.equal(mapSscRecruitmentNotice({
    id: 'result-notice',
    headline: 'Combined Higher Secondary (10+2) Level Examination, 2025: Declaration of Final Result',
    attachments: [{ fileName: 'result.pdf', type: 'application/pdf', path: 'uploads/result.pdf' }],
  }), null);
  assert.equal(mapSscRecruitmentNotice({
    id: 'notice-without-pdf',
    headline: 'Notice of Combined Graduate Level Examination, 2026',
    attachments: [{ fileName: 'notice.txt', type: 'text/plain', path: 'uploads/notice.txt' }],
  }), null);
});

test('SSC CHSL punctuation variants normalize to the same existing recruitment identity', () => {
  assert.equal(
    normalizeRecruitmentTitle('Combined Higher Secondary Level (10+2) Examination, 2026'),
    normalizeRecruitmentTitle('Combined Higher Secondary Level (10+2) Examination 2026')
  );
});

test('SSC CGL tentative vacancies map to a second official document for the canonical CGL recruitment', () => {
  const item = mapSscRecruitmentNotice({
    id: 'cgl-vacancy-notice',
    headline: 'Tentative Vacancy of Combined Graduate Level Examination, 2026 as on 24.09.2026',
    createdAt: '2026-09-24T11:53:36.250Z',
    attachments: [{
      fileName: 'Tentative_vacancy_CGLE2026_24092026.pdf',
      type: 'application/pdf',
      path: 'uploads\\masterData\\NoticeBoards\\Tentative_vacancy_CGLE2026_24092026.pdf',
    }],
  }, '2026-10-08T00:00:00.000Z');

  assert.ok(item);
  assert.equal(item.title, 'Combined Graduate Level Examination, 2026');
  assert.equal(item.notification_date, null);
  assert.equal(item.document_published_at, '2026-09-24');
  assert.equal(item.document_type, 'vacancy_notice_pdf');
  assert.equal(item.official_pdf_url, 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Tentative_vacancy_CGLE2026_24092026.pdf');
});
