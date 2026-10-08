import { appscCollector } from '../services/recruitment/collectors/appsc.collector.js';

async function testCollector() {
  console.log('Testing APPSC Collector...');
  const items = await appscCollector.collect();
  console.log(`Total collected: ${items.length}`);
  
  const notif07 = items.find(i => i.notification_number === '07/2026');
  const notif26 = items.find(i => i.notification_number === '26/2026');
  
  console.log('Found 07/2026:', notif07 ? notif07.title : 'MISSING');
  console.log('Found 26/2026:', notif26 ? notif26.title : 'MISSING');

  const nonRecruits = items.filter(i => 
    i.title.toLowerCase().includes('manual') || 
    i.title.toLowerCase().includes('faq') || 
    i.title.toLowerCase().includes('meeting')
  );
  console.log('Non-recruitment items remaining:', nonRecruits.length);

  console.log('\nSample items collected:');
  items.slice(0, 10).forEach(i => console.log(`- [${i.notification_number || 'NO_NUM'}] ${i.title}`));
}

testCollector();
