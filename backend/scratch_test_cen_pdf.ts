import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

async function inspectCenNotificationPage() {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  // Test 1: Fetch the Notification page for CEN 01/2024
  const notifUrl = 'https://www.rrbchennai.gov.in/getdata?cennum=01/2024&loc=chennai&category=Notification';
  console.log(`Fetching ${notifUrl}...`);
  try {
    const res = await axios.get(notifUrl, { headers, httpsAgent, timeout: 15000 });
    const $ = cheerio.load(res.data);

    console.log('--- Links inside Notification page ---');
    $('a').each((i, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      const href = $(el).attr('href');
      if (href && (href.includes('.pdf') || href.includes('.PDF') || text.includes('Notification') || text.includes('Detailed'))) {
        console.log(`  [Link #${i + 1}] "${text}" -> ${href}`);
      }
    });
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }

  // Test 2: Check what whatsNew returns
  const whatsNewUrl = 'https://www.rrbchennai.gov.in/chennai/whatsNew?contentType=page';
  console.log(`\nFetching ${whatsNewUrl}...`);
  try {
    const res = await axios.get(whatsNewUrl, { headers, httpsAgent, timeout: 15000 });
    console.log('whatsNew response type:', typeof res.data);
    if (typeof res.data === 'string') {
      const $ = cheerio.load(res.data);
      const pdfs: Array<{ text: string; href: string }> = [];
      $('a[href*=".pdf"], a[href*=".PDF"]').each((_, a) => {
        pdfs.push({ text: $(a).text().trim().replace(/\s+/g, ' '), href: $(a).attr('href') || '' });
      });
      console.log(`whatsNew PDF links count: ${pdfs.length}`);
      pdfs.slice(0, 10).forEach((p, i) => console.log(`  [PDF #${i + 1}] "${p.text}" -> ${p.href}`));
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }
}

inspectCenNotificationPage().catch(console.error);
