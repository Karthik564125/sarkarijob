import { describe, it, expect } from 'vitest';
import { shouldShowQualificationMismatchDisclaimer } from './RecruitmentDetailPage';

describe('qualification mismatch disclaimer', () => {
  it('shows disclaimer for not_eligible branch mismatch', () => {
    expect(
      shouldShowQualificationMismatchDisclaimer({
        eligibility_status: 'not_eligible',
        unmet_criteria: ['Branch: user branch "Computer Science and Engineering" is not in the allowed list [Electronics and Communication Engineering]'],
        reasons: ['Branch mismatch: your branch "Computer Science and Engineering" is not among the allowed branches'],
      })
    ).toBe(true);
  });

  it('shows disclaimer for degree mismatch', () => {
    expect(
      shouldShowQualificationMismatchDisclaimer({
        eligibility_status: 'not_eligible',
        unmet_criteria: ['Degree: user degree "B.Com" is not in the allowed list [B.Tech]'],
        reasons: ['Degree mismatch: your degree "B.Com" is not among the allowed degrees'],
      })
    ).toBe(true);
  });

  it('shows disclaimer for subject mismatch', () => {
    expect(
      shouldShowQualificationMismatchDisclaimer({
        eligibility_status: 'not_eligible',
        unmet_criteria: ['Subject: user subject "Biology" is not among required subjects [Physics, Chemistry]'],
        reasons: ['Subject mismatch: your subject "Biology" is not among the required subjects'],
      })
    ).toBe(true);
  });

  it('does not show disclaimer for age failure', () => {
    expect(
      shouldShowQualificationMismatchDisclaimer({
        eligibility_status: 'not_eligible',
        unmet_criteria: ['Age: user is 36 years old, maximum allowed is 30'],
        reasons: ['Age exceeded: maximum age is 30, you are 36'],
      })
    ).toBe(false);
  });

  it('does not show disclaimer for gender restriction', () => {
    expect(
      shouldShowQualificationMismatchDisclaimer({
        eligibility_status: 'not_eligible',
        unmet_criteria: ['Gender: notification restricts to "Female"'],
        reasons: ['Not eligible: this recruitment is restricted to Female'],
      })
    ).toBe(false);
  });

  it('does not show disclaimer for eligible recruitment', () => {
    expect(
      shouldShowQualificationMismatchDisclaimer({
        eligibility_status: 'eligible',
        unmet_criteria: [],
        reasons: ['All detectable eligibility criteria met based on your profile'],
      })
    ).toBe(false);
  });

  it('does not show disclaimer for verify recruitment with age ambiguity', () => {
    expect(
      shouldShowQualificationMismatchDisclaimer({
        eligibility_status: 'verify',
        unmet_criteria: [],
        reasons: ['Age limits are not explicitly stated in the notification'],
      })
    ).toBe(false);
  });

  it('does not alter the eligibility status', () => {
    const match = {
      eligibility_status: 'not_eligible',
      unmet_criteria: ['Branch: user branch "Computer Science and Engineering" is not in the allowed list [Electronics and Communication Engineering]'],
      reasons: ['Branch mismatch: your branch "Computer Science and Engineering" is not among the allowed branches'],
    } as const;

    expect(match.eligibility_status).toBe('not_eligible');
    expect(shouldShowQualificationMismatchDisclaimer(match)).toBe(true);
  });
});
