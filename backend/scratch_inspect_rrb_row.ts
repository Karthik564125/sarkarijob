import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

async function inspectNotificationRow() {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  const response = await axios.get('https://www.rrbchennai.gov.in/', { headers, httpsAgent, timeout: 15000 });
  const $ = cheerio.load(response.data);

  console.log('--- Inspecting notification links with dates ---');

  $('a[href*="category=Notification"], a[href*="category=notification"]').each((i, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    const href = $(el).attr('href') || '';
    const parentHtml = $(el).parent().html() || '';
    const rowText = $(el).closest('tr, li, div').text().trim().replace(/\s+/g, ' ');

    if (text.includes('(') && text.includes(')')) {
      console.log(`\n[#${i + 1}] Link Text: "${text}"`);
      console.log(`  Href: "${href}"`);
      console.log(`  Container Row Text: "${rowText.substring(0, 200)}"`);
      // Check for any child or sibling PDF links
      const siblingPdfs = $(el).closest('tr, li, div').find('a[href*=".pdf"], a[href*=".PDF"]');
      if (siblingPdfs.length > 0) {
        siblingPdfs.each((_, p) => {
          console.log(`  Found Sibling PDF: "${$(p).text().trim()}" -> ${$(p).attr('href')}`);
        });
      }
    }
  });
}

inspectNotificationRow().catch(console.error);
