import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const APPSC_TARGET_URLS = [
  'https://portal-psc.ap.gov.in/HomePages/RecruitmentNotifications.aspx',
  'https://portal-psc.ap.gov.in/HomePages/RecruitmentNotifications',
];

async function testFetchAll() {
  for (const url of APPSC_TARGET_URLS) {
    try {
      console.log(`\n--- FETCHING ${url} ---`);
      const response = await axios.get(url, {
        httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      console.log('Total links:', $('a').length);

      const items: any[] = [];
      $('a').each((i, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        const href = $(el).attr('href');
        if (text && href) {
          items.push({ text, href });
        }
      });

      console.log('Unique titles count:', items.length);

      // Check 2026 matches
      const matches2026 = items.filter(m => /2026/.test(m.text) || /2026/.test(m.href));
      console.log(`2026 matches found: ${matches2026.length}`);
      matches2026.forEach(m => console.log(`  2026: "${m.text}" | href="${m.href}"`));

    } catch (err: any) {
      console.error(`Error fetching ${url}:`, err.message);
    }
  }
}

testFetchAll();
