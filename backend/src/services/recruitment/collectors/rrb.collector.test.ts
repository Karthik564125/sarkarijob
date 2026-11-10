import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCenNumber, parseRrbNotificationDocuments, safeNavUrl, RRB_APPLY_PORTAL_URL } from './rrb.collector.js';
import { normalizeDate } from '../normalization.service.js';

test('regional CEN variants normalize to one recruitment key', () => {
  assert.equal(normalizeCenNumber('04/2026'), 'CEN 04/2026');
  assert.equal(normalizeCenNumber('1/2026'), 'CEN 01/2026');
  assert.equal(normalizeCenNumber('01/2026'), normalizeCenNumber('1/2026'));
  assert.equal(normalizeCenNumber('CEN 04/2026'), 'CEN 04/2026');
  assert.equal(normalizeCenNumber('RPF 01/2024'), 'CEN RPF 01/2024');
  assert.equal(normalizeCenNumber('NULL'), null);
});

test('official apply portal CEN formats and descriptions normalize accurately', () => {
  assert.equal(normalizeCenNumber('CEN No. 09/2026'), 'CEN 09/2026');
  assert.equal(normalizeCenNumber('CEN NO. 08/2026'), 'CEN 08/2026');
  assert.equal(normalizeCenNumber('CEN 07/2026'), 'CEN 07/2026');
  assert.equal(
    normalizeCenNumber('CENTRALISED EMPLOYMENT NOTIFICATION (CEN) No. 09/2026 Recruitment for various posts of Isolated Categories'),
    'CEN 09/2026'
  );
  assert.equal(
    normalizeCenNumber('CENTRALIZED EMPLOYEMENT NOTICE (CEN) No. 08/2026 STATION MASTER '),
    'CEN 08/2026'
  );
  assert.equal(
    normalizeCenNumber('CENTRALISED EMPLOYMENT NOTICE (CEN) No. 07/2026 Recruitment for various posts of Non-Technical Popular Categories (Under Graduate)'),
    'CEN 07/2026'
  );
});

test('RRB URL normalization accepts only configured official RRB hosts including rrbapply.gov.in', () => {
  assert.equal(
    safeNavUrl('/-/image/1787058904504CEN_04_2026_JE_DMS_English.pdf/examsDocuments', 'https://rrb.indianrailways.gov.in/chandigarh'),
    'https://rrb.indianrailways.gov.in/-/image/1787058904504CEN_04_2026_JE_DMS_English.pdf/examsDocuments'
  );
  assert.equal(
    safeNavUrl('/assets/forms/CEN_09_2026_IsolatedCategory.pdf', RRB_APPLY_PORTAL_URL),
    'https://www.rrbapply.gov.in/assets/forms/CEN_09_2026_IsolatedCategory.pdf'
  );
  assert.equal(
    safeNavUrl('https://api.recruitmentrrb.in/api/Advertisement/WhatsNew', RRB_APPLY_PORTAL_URL),
    'https://api.recruitmentrrb.in/api/Advertisement/WhatsNew'
  );
  assert.equal(safeNavUrl('https://example.com/CEN_04_2026.pdf', 'https://rrb.indianrailways.gov.in/chandigarh'), null);
  assert.equal(safeNavUrl('http://www.rrbcdg.gov.in/notification.pdf', 'https://rrb.indianrailways.gov.in/chandigarh'), null);
});

test('RRB date parser handles DD/MM/YYYY and ISO timestamps accurately', () => {
  assert.equal(normalizeDate('05/11/2026'), '2026-11-05');
  assert.equal(normalizeDate('04/12/2026'), '2026-12-04');
  assert.equal(normalizeDate('27/10/2026'), '2026-10-27');
  assert.equal(normalizeDate('25/11/2026'), '2026-11-25');
  assert.equal(normalizeDate('15/10/2026'), '2026-10-15');
  assert.equal(normalizeDate('13/11/2026'), '2026-11-13');
  assert.equal(normalizeDate('2026-11-05T00:00:00'), '2026-11-05');
  assert.equal(normalizeDate('2026-12-04T23:59:00'), '2026-12-04');
});

test('RRB parser associates only the detailed English PDF with its CEN', () => {
  const html = `
    <table>
      <tr>
        <td>1</td><td>04/2026</td><td>Notification</td>
        <td>Corrigendum No.1 of CEN No. 04/2026</td><td>18-08-2026</td>
        <td><select><option value="/-/image/corrigendum.pdf/examsDocuments">English</option></select></td>
      </tr>
      <tr>
        <td>2</td><td>04/2026</td><td>Notification</td>
        <td>Detailed Centralised Employment Notification</td><td>13-08-2026</td>
        <td><select>
          <option value="">Select Language</option>
          <option value="/-/image/CEN_04_2026_JE_DMS_English.pdf/examsDocuments">English</option>
          <option value="/-/image/CEN_04_2026_JE_DMS_Hindi.pdf/examsDocuments">Hindi</option>
        </select></td>
      </tr>
      <tr>
        <td>3</td><td>04/2026</td><td>Notification</td>
        <td>Frequently Asked Questions regarding CEN No. 04/2026</td><td>13-08-2026</td>
        <td><select><option value="/-/image/FAQ_CEN_04_2026_English.pdf/examsDocuments">English</option></select></td>
      </tr>
    </table>`;

  assert.deepEqual(parseRrbNotificationDocuments(html, 'https://rrb.indianrailways.gov.in/getdata'), [{
    notification_number: 'CEN 04/2026',
    description: 'Detailed Centralised Employment Notification',
    notification_date: '2026-08-13',
    official_pdf_url: 'https://rrb.indianrailways.gov.in/-/image/CEN_04_2026_JE_DMS_English.pdf/examsDocuments',
  }]);
});

test('RRB parser falls back to an official Hindi PDF when no English option exists', () => {
  const html = `
    <table><tr>
      <td>1</td><td>01/2026</td><td>Notification</td>
      <td>Detailed Centralised Employment Notification</td><td>12-01-2026</td>
      <td><select><option value="">Select Language</option><option value="/-/image/CEN_01_2026_Hindi.pdf/examsDocuments">Hindi</option></select></td>
    </tr></table>`;

  assert.equal(
    parseRrbNotificationDocuments(html, 'https://rrb.indianrailways.gov.in/getdata')[0]?.official_pdf_url,
    'https://rrb.indianrailways.gov.in/-/image/CEN_01_2026_Hindi.pdf/examsDocuments'
  );
});
