import { appscCollector } from './src/services/recruitment/collectors/appsc.collector.js';

async function test() {
  const items = await appscCollector.collect();
  console.log('Total APPSC items discovered:', items.length);
  const found07 = items.find(i => i.notification_number === '07/2026');
  const found26 = items.find(i => i.notification_number === '26/2026');
  console.log('07/2026 found:', !!found07, found07?.title, found07?.official_pdf_url);
  console.log('26/2026 found:', !!found26, found26?.title, found26?.official_pdf_url);
}

test().catch(console.error);
