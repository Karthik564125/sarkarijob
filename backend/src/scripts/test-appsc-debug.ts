import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function testFetch() {
  try {
    const url = 'https://portal-psc.ap.gov.in/HomePages/RecruitmentNotifications.aspx';
    const response = await axios.get(url, {
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    console.log('Total links:', $('a').length);

    const matches: any[] = [];
    $('a').each((i, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      const href = $(el).attr('href');
      if (text) {
        matches.push({ text, href });
      }
    });

    console.log('Links containing Notification No or Notifn or number pattern:');
    const notifLinks = matches.filter(m => 
      /Notification\s*No/i.test(m.text) || 
      /Notifn\.?\s*No/i.test(m.text) || 
      /[0-9]{1,2}\s*[\/\_]\s*[0-9]{4}/.test(m.text) ||
      /Direct Recruitment/i.test(m.text)
    );
    notifLinks.forEach(m => console.log(`MATCH: "${m.text}" | href="${m.href}"`));

    console.log('\nAll PDF links:');
    const pdfLinks = matches.filter(m => m.href && m.href.toLowerCase().endsWith('.pdf'));
    pdfLinks.forEach(m => console.log(`PDF: "${m.text}" | href="${m.href}"`));

  } catch (err: any) {
    console.error('Error fetching APPSC:', err.message);
  }
}

testFetch();
