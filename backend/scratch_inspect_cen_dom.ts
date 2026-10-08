import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

async function parseAddChield() {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  const response = await axios.get('https://www.rrbchennai.gov.in/', { headers, httpsAgent, timeout: 15000 });
  const $ = cheerio.load(response.data);

  console.log('--- Inspecting li.addChield elements ---');
  $('li.addChield, li:has(a[href*="cennum"])').each((i, el) => {
    const headingText = $(el).children('a').first().text().trim().replace(/\s+/g, ' ');
    const fullText = $(el).text().trim().replace(/\s+/g, ' ');

    const notifLink = $(el).find('a[href*="category=Notification"], a[href*="category=notification"], a[href*="cennum"]').filter((_, a) => {
      const h = $(a).attr('href') || '';
      return h.includes('category=Notification') || h.includes('category=notification');
    }).first();

    const notifHref = notifLink.attr('href');

    // Extract CEN number from headingText, fullText, or notifHref
    const hrefCenMatch = notifHref?.match(/cennum=([0-9]{1,2}\/[0-9]{4})/i);
    const textCenMatch = fullText.match(/CEN\s*(?:NO\.?|NUMBER)?\s*([0-9]{1,2}\s*\/\s*[0-9]{4})/i) ||
                         headingText.match(/CEN\s*(?:NO\.?|NUMBER)?\s*([0-9]{1,2}\s*\/\s*[0-9]{4})/i);

    const cenNumStr = hrefCenMatch ? `CEN ${hrefCenMatch[1]}` : (textCenMatch ? `CEN ${textCenMatch[1].replace(/\s+/g, '')}` : null);

    console.log(`\n[#${i + 1}] Heading: "${headingText}"`);
    console.log(`  Derived CEN: ${cenNumStr}`);
    console.log(`  Notification Link Href: ${notifHref}`);
    console.log(`  Full Element Text Snippet: "${fullText.substring(0, 150)}"`);
  });
}

parseAddChield().catch(console.error);
