import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

async function testRrbEndpoints() {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  const testUrls = [
    'https://www.rrbchennai.gov.in/getdata?cennum=01/2024&loc=chennai&category=Notification',
    'https://www.rrbchennai.gov.in/chennai/whatsNew?contentType=page',
    'https://www.rrbcdg.gov.in/getdata?cennum=01/2024&loc=chandigarh&category=Notification',
  ];

  for (const url of testUrls) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing GET ${url}...`);
    try {
      const response = await axios.get(url, { headers, httpsAgent, timeout: 15000 });
      console.log(`Status: ${response.status} | Content-Type: ${response.headers['content-type']}`);
      const data = response.data;
      if (typeof data === 'string') {
        console.log(`Response length: ${data.length} chars`);
        console.log(`Snippet (first 600 chars):\n${data.substring(0, 600)}`);
      } else {
        console.log('JSON Data:', JSON.stringify(data, null, 2).substring(0, 800));
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
    }
  }

  // Also inspect the DOM navigation hierarchy for CEN menu items on rrbchennai.gov.in
  console.log(`\n--------------------------------------------------`);
  console.log('Inspecting CEN menu items on RRB portal page...');
  const mainRes = await axios.get('https://www.rrbchennai.gov.in/', { headers, httpsAgent, timeout: 15000 });
  const $ = cheerio.load(mainRes.data);

  // Find all li elements or headers containing CEN
  $('li, tr, div, a').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.startsWith('CEN') && text.length < 150 && text.length > 5) {
      const childLinks: string[] = [];
      $(el).find('a').each((_, a) => {
        const href = $(a).attr('href');
        const aText = $(a).text().trim();
        if (href) childLinks.push(`"${aText}" -> ${href}`);
      });
      if (childLinks.length > 0) {
        console.log(`\nCEN Header: "${text.substring(0, 80)}"`);
        console.log(`  Links count: ${childLinks.length}`);
        console.log(`  Sample Links: ${childLinks.slice(0, 3).join(' | ')}`);
      }
    }
  });
}

testRrbEndpoints().catch(console.error);
