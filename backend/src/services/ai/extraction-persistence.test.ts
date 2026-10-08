import test from 'node:test';
import assert from 'node:assert/strict';
import { RecruitmentExtractionSchema, type RecruitmentExtraction } from './extraction.schema.js';
import { buildExtractionRecruitmentUpdate, mergeNonEmptyExtraction } from './extraction-persistence.js';

function createExtraction(overrides: Partial<RecruitmentExtraction> = {}): RecruitmentExtraction {
  return {
    recruitment_title: null,
    organization: null,
    notification_number: null,
    recruitment_type: null,
    vacancies: null,
    application_start: null,
    application_end: null,
    exam_date: null,
    age: { minimum: null, maximum: null, relaxation: null },
    education: { minimum_level: null, required_degrees: null, allowed_branches: null, required_subjects: null },
    experience: { required: null, details: null },
    nationality_requirement: null,
    domicile_requirement: null,
    category_requirements: null,
    gender_requirements: null,
    physical_requirements: null,
    post_wise_eligibility: null,
    important_conditions: [],
    ambiguities: [],
    ...overrides,
  };
}

const existingRecruitment = {
  title: 'Combined Graduate Level Examination, 2026',
  description: null as string | null,
  notification_number: null,
  notification_date: '2026-05-21',
  application_start: '2026-05-21',
  application_end: '2026-07-04',
  exam_date: '2026-09-01',
  vacancies: 14582,
  status: 'closed',
  eligibility_rules: {
    age: { minimum: 18, maximum: 32, relaxation: { SC: '5 years' } },
    education: { minimum_level: "Bachelor's Degree", required_degrees: ['B.Com'], allowed_branches: ['Commerce'], required_subjects: null },
    ambiguities: ['Existing uncertainty'],
  },
};

test('empty extraction values do not overwrite existing dates, vacancies, or eligibility values', () => {
  const merged = mergeNonEmptyExtraction(existingRecruitment.eligibility_rules, createExtraction());
  const mergedRules = merged as typeof existingRecruitment.eligibility_rules & Record<string, any>;
  assert.equal(mergedRules.age.minimum, 18);
  assert.deepEqual(mergedRules.age.relaxation, { SC: '5 years' });
  assert.deepEqual(mergedRules.education.allowed_branches, ['Commerce']);
  assert.deepEqual(mergedRules.ambiguities, ['Existing uncertainty']);
  assert.equal(mergedRules.experience.required, null);

  const update = buildExtractionRecruitmentUpdate(existingRecruitment, createExtraction(), null, new Date('2026-10-08T00:00:00Z'));
  assert.equal(update.notification_date, existingRecruitment.notification_date);
  assert.equal(update.application_start, existingRecruitment.application_start);
  assert.equal(update.application_end, existingRecruitment.application_end);
  assert.equal(update.exam_date, existingRecruitment.exam_date);
  assert.equal(update.vacancies, existingRecruitment.vacancies);
  assert.equal(update.title, existingRecruitment.title);
  assert.equal(update.status, 'closed');
  const updateRules = update.eligibility_rules as typeof existingRecruitment.eligibility_rules & Record<string, any>;
  assert.equal(updateRules.age.maximum, 32);
  assert.deepEqual(updateRules.education.allowed_branches, ['Commerce']);
  assert.deepEqual(updateRules.ambiguities, ['Existing uncertainty']);
  assert.equal(updateRules.nationality_requirement, null);
  assert.ok(!('content_hash' in update));
});

test('valid extracted values update fields and use existing recruitment status rules', () => {
  const update = buildExtractionRecruitmentUpdate(
    existingRecruitment,
    createExtraction({
      recruitment_title: 'Official Graduate Level Examination, 2026',
      description: 'Recruitment notice for graduate-level posts.',
      notification_number: 'CGL/2026',
      notification_date: '2026-05-20',
      application_start: '2099-01-10',
      application_end: '2099-02-10',
      exam_date: '2099-04-01',
      vacancies: 15000,
    }),
    null,
    new Date('2026-10-08T00:00:00Z')
  );

  assert.equal(update.title, 'Official Graduate Level Examination, 2026');
  assert.equal(update.description, 'Recruitment notice for graduate-level posts.');
  assert.equal(update.notification_number, 'CGL/2026');
  assert.equal(update.notification_date, '2026-05-20');
  assert.equal(update.application_start, '2099-01-10');
  assert.equal(update.application_end, '2099-02-10');
  assert.equal(update.exam_date, '2099-04-01');
  assert.equal(update.vacancies, 15000);
  assert.equal(update.status, 'upcoming');
});

test('cancelled recruitments retain cancelled status after extraction', () => {
  const update = buildExtractionRecruitmentUpdate(
    { ...existingRecruitment, status: 'cancelled' },
    createExtraction({ application_start: '2099-01-10', application_end: '2099-02-10' }),
    null,
    new Date('2026-10-08T00:00:00Z')
  );
  assert.equal(update.status, 'cancelled');
});

test('older extraction payloads remain valid without notification_date', () => {
  const extraction = createExtraction();
  const { notification_date: _optionalDate, ...legacyPayload } = extraction;
  assert.equal(RecruitmentExtractionSchema.safeParse(legacyPayload).success, true);
  assert.equal(RecruitmentExtractionSchema.safeParse(extraction).success, true);
});