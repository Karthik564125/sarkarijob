import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

async function inspectRrbPortalDetail() {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  const url = 'https://www.rrbchennai.gov.in/';
  console.log(`Fetching detailed DOM structure of ${url}...`);

  const response = await axios.get(url, { headers, httpsAgent, timeout: 15000 });
  const html = response.data;
  const $ = cheerio.load(html);

  console.log('--- Search for links with CEN or getdata or pdf ---');
  const cenLinks: Array<{ text: string; href: string }> = [];
  $('a').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    const href = $(el).attr('href');
    if (!href) return;
    if (href.includes('getdata') || href.includes('cen') || href.includes('CEN') || href.includes('notification') || href.includes('pdf') || href.includes('.PDF')) {
      cenLinks.push({ text, href });
    }
  });

  console.log(`Found ${cenLinks.length} matching links:`);
  cenLinks.slice(0, 25).forEach((l, i) => console.log(`  [#${i + 1}] "${l.text}" -> ${l.href}`));

  // Check script tags for data arrays or API endpoints
  console.log('\n--- Searching scripts for API or JSON data ---');
  $('script').each((i, el) => {
    const content = $(el).html() || '';
    if (content.includes('CEN') || content.includes('cen') || content.includes('getdata') || content.includes('api') || content.includes('fetch')) {
      console.log(`[Script #${i + 1}] snippet:`);
      console.log(content.substring(0, 600));
    }
  });
}

inspectRrbPortalDetail().catch(console.error);
