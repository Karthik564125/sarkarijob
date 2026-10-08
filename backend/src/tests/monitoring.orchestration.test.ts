import 'dotenv/config';
import { runRecruitmentMonitoring, isMonitoringActive } from '../services/recruitment/monitoring.service.js';
import { getSchedulerConfig } from '../services/recruitment/scheduler.service.js';

async function runMonitoringTests() {
  console.log('===========================================================');
  console.log('       PHASE 5: RECRUITMENT MONITORING ORCHESTRATION TEST   ');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title} — ${detail || ''}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------
  // Test 1: Scheduler Configuration
  // -----------------------------------------------------------------
  {
    const config = getSchedulerConfig();
    assert(
      typeof config.enabled === 'boolean' && typeof config.intervalMinutes === 'number',
      'Test 1: Scheduler Configuration reads environment defaults',
      `Enabled: ${config.enabled}, Interval: ${config.intervalMinutes}m`
    );
  }

  // -----------------------------------------------------------------
  // Test 2: Controlled Monitoring Run (skipCollection = true)
  // -----------------------------------------------------------------
  {
    console.log('\nRunning controlled monitoring run (skipCollection=true, limitDocuments=0)...');
    const summary = await runRecruitmentMonitoring({
      skipCollection: true,
      limitDocuments: 0,
      limitUsers: 1,
    });

    assert(
      summary.status === 'completed',
      'Test 2a: Monitoring service initializes and completes successfully',
      `Got status: ${summary.status}`
    );

    assert(
      typeof summary.duration_ms === 'number' && summary.duration_ms >= 0,
      'Test 2b: Duration and timestamps recorded correctly',
      `Duration: ${summary.duration_ms}ms`
    );
  }

  // -----------------------------------------------------------------
  // Test 3: Concurrency Safety Lock
  // -----------------------------------------------------------------
  {
    console.log('\nTesting Concurrency Lock (simultaneous runs)...');

    // Launch run 1 without await (simulating active run)
    const run1Promise = runRecruitmentMonitoring({
      skipCollection: true,
      limitDocuments: 0,
    });

    // Immediately attempt run 2 while run 1 is in-flight
    const run2Result = await runRecruitmentMonitoring({
      skipCollection: true,
      limitDocuments: 0,
    });

    // Wait for run 1 to finish
    await run1Promise;

    assert(
      run2Result.status === 'already_running',
      'Test 3: Concurrency lock rejects concurrent execution with "already_running"',
      `Run 2 status: ${run2Result.status}`
    );

    assert(
      isMonitoringActive() === false,
      'Test 3b: Lock releases cleanly after execution finishes',
      `isMonitoringActive(): ${isMonitoringActive()}`
    );
  }

  // -----------------------------------------------------------------
  // Test 4: Skipping Completed Documents (No Duplicate Gemini Calls)
  // -----------------------------------------------------------------
  {
    console.log('\nTesting Completed Document Skipping...');
    const { processRecruitmentDocument } = await import('../services/ai/document-processing.service.js');
    
    // Document e2c6558f-4141-41fe-a73a-1ba356d1ed1c is completed APPSC 16/2026
    const res = await processRecruitmentDocument('e2c6558f-4141-41fe-a73a-1ba356d1ed1c', { forceRetry: false });

    assert(
      res.status === 'already_processed',
      'Test 4: Completed documents skipped without making unnecessary Gemini calls',
      `Got status: ${res.status}`
    );
  }

  console.log('\n===========================================================');
  console.log(` Monitoring Orchestration Suite Finished: ${passed} Passed, ${failed} Failed`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMonitoringTests().catch((err) => {
  console.error('❌ Orchestration test error:', err);
  process.exit(1);
});
