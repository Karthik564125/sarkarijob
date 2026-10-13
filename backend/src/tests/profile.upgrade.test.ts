import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAge } from '../utils/age.js';
import {
  mapLegacyTenthBoard,
  mapLegacyTwelfthBoard,
  mapLegacyTwelfthStream,
  mapLegacyGraduationDegree,
  mapLegacyGraduationBranch,
} from '../config/educationOptions.js';
import { supabase } from '../config/supabase.js';
import { refreshUserProfileMatches, evaluateUserRecruitment } from '../services/recruitment/matching.service.js';

describe('Profile, Education & Eligibility Upgrade Test Suite', () => {
  // ── 1. Age Calculation Tests ──────────────────────────────────────────────
  describe('Age calculation utility', () => {
    it('calculates exact age for typical birthday', () => {
      const age = calculateAge('2000-05-15', new Date('2026-05-15'));
      assert.equal(age, 26);
    });

    it('returns age - 1 on the day before the birthday', () => {
      const age = calculateAge('2000-05-15', new Date('2026-05-14'));
      assert.equal(age, 25);
    });

    it('returns exact age on birthday day', () => {
      const age = calculateAge('2000-05-15', new Date('2026-05-15'));
      assert.equal(age, 26);
    });

    it('handles leap year birthdate (Feb 29) on non-leap years', () => {
      // 2000 is leap year. In 2025 (non-leap), on Feb 28 candidate has not reached birthday
      const age28 = calculateAge('2000-02-29', new Date('2025-02-28'));
      assert.equal(age28, 24);
      // On March 1, 2025, candidate has reached 25
      const ageMar1 = calculateAge('2000-02-29', new Date('2025-03-01'));
      assert.equal(ageMar1, 25);
    });

    it('handles leap year birthdate (Feb 29) on leap years', () => {
      const ageLeap28 = calculateAge('2000-02-29', new Date('2024-02-28'));
      assert.equal(ageLeap28, 23);
      const ageLeap29 = calculateAge('2000-02-29', new Date('2024-02-29'));
      assert.equal(ageLeap29, 24);
    });

    it('returns null for missing, empty, or invalid dates', () => {
      assert.equal(calculateAge(null), null);
      assert.equal(calculateAge(''), null);
      assert.equal(calculateAge('invalid-date'), null);
      assert.equal(calculateAge('2020-02-31'), null); // invalid Feb 31
    });
  });

  // ── 2. Legacy Profile Mapping Tests ───────────────────────────────────────
  describe('Legacy profile normalization', () => {
    it('maps 10th boards correctly', () => {
      assert.deepEqual(mapLegacyTenthBoard('State board'), { board: 'State Board' });
      assert.deepEqual(mapLegacyTenthBoard('CBSE'), { board: 'CBSE' });
      assert.deepEqual(mapLegacyTenthBoard('ICSE'), { board: 'ICSE' });
      assert.deepEqual(mapLegacyTenthBoard('NIOS Board'), { board: 'NIOS' });
      assert.deepEqual(mapLegacyTenthBoard('Cambridge International'), {
        board: 'Other',
        board_other: 'Cambridge International',
      });
    });

    it('maps 12th boards correctly', () => {
      assert.deepEqual(mapLegacyTwelfthBoard('State board'), { board: 'State Board' });
      assert.deepEqual(mapLegacyTwelfthBoard('BIEAP'), { board: 'State Board' });
      assert.deepEqual(mapLegacyTwelfthBoard('CBSE'), { board: 'CBSE' });
      assert.deepEqual(mapLegacyTwelfthBoard('ISC'), { board: 'ISC' });
      assert.deepEqual(mapLegacyTwelfthBoard('Foreign Board'), {
        board: 'Other',
        board_other: 'Foreign Board',
      });
    });

    it('maps 12th streams correctly', () => {
      assert.deepEqual(mapLegacyTwelfthStream('MPC'), {
        stream: 'MPC — Mathematics, Physics, Chemistry',
      });
      assert.deepEqual(mapLegacyTwelfthStream('Bi.p.c'), {
        stream: 'BiPC — Biology, Physics, Chemistry',
      });
      assert.deepEqual(mapLegacyTwelfthStream('MBiPC'), {
        stream: 'MBiPC — Mathematics, Biology, Physics, Chemistry',
      });
      assert.deepEqual(mapLegacyTwelfthStream('CEC'), {
        stream: 'CEC — Civics, Economics, Commerce',
      });
      assert.deepEqual(mapLegacyTwelfthStream('Polytechnic'), {
        stream: 'Polytechnic / Diploma',
      });
      assert.deepEqual(mapLegacyTwelfthStream('Diploma in Mechanical'), {
        stream: 'Polytechnic / Diploma',
      });
      assert.deepEqual(mapLegacyTwelfthStream('Special Vocational'), {
        stream: 'Other',
        stream_other: 'Special Vocational',
      });
    });

    it('maps graduation degrees correctly', () => {
      assert.deepEqual(mapLegacyGraduationDegree('btech'), { degree: 'B.Tech / B.E.' });
      assert.deepEqual(mapLegacyGraduationDegree('B.Tech'), { degree: 'B.Tech / B.E.' });
      assert.deepEqual(mapLegacyGraduationDegree('B.E.'), { degree: 'B.Tech / B.E.' });
      assert.deepEqual(mapLegacyGraduationDegree('B.Sc'), { degree: 'B.Sc.' });
      assert.deepEqual(mapLegacyGraduationDegree('B.Com'), { degree: 'B.Com.' });
      assert.deepEqual(mapLegacyGraduationDegree('B.A.'), { degree: 'B.A.' });
      assert.deepEqual(mapLegacyGraduationDegree('Bachelor of Pharmacy'), { degree: 'B.Pharmacy' });
      assert.deepEqual(mapLegacyGraduationDegree('B.Voc Design'), {
        degree: 'Other',
        degree_other: 'B.Voc Design',
      });
    });

    it('maps graduation branches correctly depending on degree', () => {
      const cseMap = mapLegacyGraduationBranch('B.Tech / B.E.', 'Computer science and engineering');
      assert.deepEqual(cseMap, { branch: 'Computer Science and Engineering' });

      const itMap = mapLegacyGraduationBranch('B.Tech / B.E.', 'IT');
      assert.deepEqual(itMap, { branch: 'Information Technology' });

      const bscMathMap = mapLegacyGraduationBranch('B.Sc.', 'Mathematics');
      assert.deepEqual(bscMathMap, { branch: 'Mathematics' });

      const customBranchMap = mapLegacyGraduationBranch('B.Tech / B.E.', 'Quantum Robotics');
      assert.deepEqual(customBranchMap, { branch: 'Other', branch_other: 'Quantum Robotics' });
    });
  });

  // ── 3. Database Round-Trip & Application Tracking Preservation ────────────
  describe('Profile updates and application tracking preservation', () => {
    const testUserId = '655875a4-878d-40ad-8be1-78e763e9eac1'; // karthik

    it('preserves existing manual application tracking status during match re-evaluation', async () => {
      // Find an application for user
      const { data: appBefore } = await supabase
        .from('user_recruitment_applications')
        .select('*')
        .eq('user_id', testUserId)
        .limit(1)
        .maybeSingle();

      if (appBefore) {
        // Trigger match re-evaluation for this recruitment
        await evaluateUserRecruitment(testUserId, appBefore.recruitment_id);

        const { data: appAfter } = await supabase
          .from('user_recruitment_applications')
          .select('*')
          .eq('id', appBefore.id)
          .single();

        assert.equal(
          appAfter?.application_status,
          appBefore.application_status,
          'User recruitment application tracking status must NOT be modified by match recalculation'
        );
      }
    });
  });
});
