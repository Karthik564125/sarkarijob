import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

const agent = new https.Agent({ rejectUnauthorized: false });

async function check() {
  const urls = [
    'https://portal-psc.ap.gov.in/HomePages/RecruitmentNotifications',
    'https://psc.ap.gov.in/',
    'https://applications-psc.ap.gov.in/',
    'https://psc.ap.gov.in/(S(0))/Default.aspx',
    'https://psc.ap.gov.in/UI/Notifications/Notifications.aspx',
    'https://portal-psc.ap.gov.in/HomePages/RecruitmentNotifications.aspx',
  ];

  for (const url of urls) {
    console.log('\n==================================================');
    console.log('Fetching URL:', url);
    try {
      const res = await axios.get(url, {
        httpsAgent: agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      console.log('Status:', res.status, 'Length:', res.data.length);
      const $ = cheerio.load(res.data);
      const links = $('a');
      console.log(`Total <a> links: ${links.length}`);
      links.each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.includes('07/2026') || text.includes('26/2026') || text.includes('07') || text.includes('26') || text.includes('2026') || href.includes('07') || href.includes('26')) {
          console.log(`  Link [${i}]: href="${href}" | text="${text.substring(0, 100)}"`);
        }
      });
    } catch (err: any) {
      console.log('Failed:', url, err.message);
    }
  }
}

check().catch(console.error);
