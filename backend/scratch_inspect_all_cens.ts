import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

async function parseAllCensFromPortals() {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  const portalUrls = [
    { name: 'Chennai', url: 'https://www.rrbchennai.gov.in/' },
    { name: 'Chandigarh', url: 'https://www.rrbcdg.gov.in/' },
    { name: 'Kolkata', url: 'https://www.rrbkolkata.gov.in/' },
    { name: 'Gorakhpur', url: 'https://www.rrbgkp.gov.in/' },
    { name: 'Patna', url: 'https://www.rrbpatna.gov.in/' },
    { name: 'Muzaffarpur', url: 'https://www.rrbmuzaffarpur.gov.in/' },
    { name: 'Malda', url: 'https://www.rrbmalda.gov.in/' },
  ];

  const allDiscoveredCens = new Map<string, { cenNum: string; title: string; pdfUrl: string | null; pageUrl: string; source: string }>();

  for (const portal of portalUrls) {
    console.log(`\nFetching ${portal.name} (${portal.url})...`);
    try {
      const response = await axios.get(portal.url, { headers, httpsAgent, timeout: 12000 });
      const $ = cheerio.load(response.data);

      $('a[href*="cennum"]').each((_, a) => {
        const href = $(a).attr('href') || '';
        const category = href.match(/category=([^&]*)/i)?.[1] || '';
        const rawCen = href.match(/cennum=([^&]*)/i)?.[1] || '';

        if (!rawCen) return;

        const cenNum = rawCen.toUpperCase().startsWith('CEN')
          ? rawCen.toUpperCase().replace(/\s+/g, ' ')
          : `CEN ${decodeURIComponent(rawCen).trim()}`;

        // Get parent li title text or link text
        const parentLiText = $(a).closest('li.addChield, li:has(ul)').children('a').first().text().trim().replace(/\s+/g, ' ');
        const titleText = parentLiText || `Centralised Employment Notice ${cenNum}`;

        const key = cenNum;

        // Resolve absolute URL for the notification link
        let fullPageUrl = href.startsWith('http') ? href : `${portal.url.replace(/\/$/, '')}${href.startsWith('/') ? '' : '/'}${href}`;

        if (!allDiscoveredCens.has(key)) {
          allDiscoveredCens.set(key, {
            cenNum,
            title: `RRB ${cenNum} - ${titleText}`,
            pdfUrl: null,
            pageUrl: fullPageUrl,
            source: portal.name,
          });
        }
      });
    } catch (err: any) {
      console.error(`Failed ${portal.name}: ${err.message}`);
    }
  }

  console.log(`\n==================================================`);
  console.log(`TOTAL UNIQUE CENs DISCOVERED ACROSS PORTALS: ${allDiscoveredCens.size}`);
  console.log(`==================================================`);

  Array.from(allDiscoveredCens.values()).forEach((item, i) => {
    console.log(`\n[CEN #${i + 1}] ${item.cenNum}`);
    console.log(`  Title: "${item.title}"`);
    console.log(`  Discovered via: ${item.source}`);
    console.log(`  Official Page URL: ${item.pageUrl}`);
  });
}

parseAllCensFromPortals().catch(console.error);
