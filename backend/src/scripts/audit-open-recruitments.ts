/**
 * FULL DATABASE AUDIT SCRIPT
 * Part 1: Inspect all current open recruitments (the "Open Now" source of truth)
 * Part 2: SSC CGL 2026 specific check
 * Part 3: APPSC 07/2026, 08/2026, 19/2026 specific checks
 * Part 4: Freshness classification audit for all recruitments
 */

import { supabase } from '../config/supabase.js';
import {
  isRecruitmentCurrentOrRelevant,
  deriveRecruitmentStatus,
} from '../services/recruitment/recruitmentFreshness.service.js';

// ─── IST timezone helpers ─────────────────────────────────────────────────────
function nowIST(): Date {
  // India Standard Time = UTC+5:30
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
}

function todayISTString(): string {
  return nowIST().toISOString().split('T')[0];
}

function isCurrentlyOpen(rec: any, todayIST: string): boolean {
  if (!rec.application_start || !rec.application_end) return false;
  return rec.application_start <= todayIST && rec.application_end >= todayIST;
}

// ─── Main audit ───────────────────────────────────────────────────────────────
async function runFullAudit() {
  const todayIST = todayISTString();
  const now = new Date();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SARKARIJOB FULL DATABASE AUDIT');
  console.log(`  Runtime (UTC):       ${now.toISOString()}`);
  console.log(`  Today (IST date):    ${todayIST}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Fetch ALL recruitments ──────────────────────────────────────────────────
  const { data: allRecs, error } = await supabase
    .from('recruitments')
    .select(
      'id, organization, notification_number, title, application_start, application_end, status, notification_date, official_page_url, official_pdf_url, last_changed_at, created_at'
    )
    .order('organization', { ascending: true });

  if (error || !allRecs) {
    console.error('ERROR fetching recruitments:', error?.message);
    process.exit(1);
  }

  console.log(`Total rows in recruitments table: ${allRecs.length}\n`);

  // ── PART 1: What is "current/relevant" per freshness service? ───────────────
  const currentRecs = allRecs.filter((r) => isRecruitmentCurrentOrRelevant(r, now));

  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`PART 1: isRecruitmentCurrentOrRelevant → ${currentRecs.length} records`);
  console.log('─────────────────────────────────────────────────────────────────');
  for (const r of currentRecs) {
    console.log(
      `  [${r.organization}] ${r.notification_number ?? 'N/A'} | ${r.title?.substring(0, 60)} | start:${r.application_start ?? 'null'} end:${r.application_end ?? 'null'} | db_status:${r.status}`
    );
  }

  // ── PART 2: What is "Open Now" per dashboard logic? ────────────────────────
  const openNowRecs = currentRecs.filter(
    (r) => r.status === 'open' || r.status === 'closing_soon'
  );
  const openByDate = currentRecs.filter((r) => isCurrentlyOpen(r, todayIST));

  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log(`PART 2: "Open Now" — Dashboard reads r.status === 'open'`);
  console.log(`  By stored status 'open'/'closing_soon': ${openNowRecs.length} records`);
  console.log(`  By actual date window (start<=today AND end>=today): ${openByDate.length} records`);
  console.log('─────────────────────────────────────────────────────────────────');

  console.log('\n  By stored DB status (what dashboard currently shows as "Open Now"):');
  for (const r of openNowRecs) {
    console.log(
      `    [${r.organization}] ${r.notification_number ?? 'N/A'} | ${r.title?.substring(0, 60)}`
    );
    console.log(`       start:${r.application_start ?? 'null'} end:${r.application_end ?? 'null'} | db_status:${r.status}`);
  }

  console.log('\n  By ACTUAL date window (application_start <= today AND application_end >= today):');
  for (const r of openByDate) {
    const derivedStatus = deriveRecruitmentStatus(
      r.application_start, r.application_end, r.notification_date, r.notification_number, now
    );
    const endDate = new Date(r.application_end);
    const todayDate = new Date(todayIST);
    const daysRemaining = Math.ceil((endDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
    console.log(
      `    [${r.organization}] ${r.notification_number ?? 'N/A'} | ${r.title?.substring(0, 60)}`
    );
    console.log(`       start:${r.application_start} end:${r.application_end} | db_status:${r.status} | derived:${derivedStatus} | days_remaining:${daysRemaining}`);
  }

  // ── PART 3: SSC CGL 2026 specific ──────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('PART 3: SSC CGL 2026 — Specific Database Check');
  console.log('─────────────────────────────────────────────────────────────────');
  const sscCglRecs = allRecs.filter(
    (r) =>
      r.organization === 'SSC' &&
      (r.title?.toLowerCase().includes('combined graduate level') ||
        r.title?.toLowerCase().includes('cgl') ||
        r.title?.toLowerCase().includes('2026'))
  );

  if (sscCglRecs.length === 0) {
    console.log('  ❌ SSC CGL 2026 NOT FOUND in database.');
    console.log('  All SSC records in database:');
    const sscRecs = allRecs.filter((r) => r.organization === 'SSC');
    for (const r of sscRecs) {
      console.log(`    ${r.notification_number ?? 'N/A'} | ${r.title?.substring(0, 80)}`);
      console.log(`       start:${r.application_start ?? 'null'} end:${r.application_end ?? 'null'} | status:${r.status}`);
    }
  } else {
    for (const r of sscCglRecs) {
      const isOpen = isCurrentlyOpen(r, todayIST);
      const isCurrent = isRecruitmentCurrentOrRelevant(r, now);
      const derivedStatus = deriveRecruitmentStatus(
        r.application_start, r.application_end, r.notification_date, r.notification_number, now
      );
      console.log(`  FOUND: ${r.title}`);
      console.log(`    id:              ${r.id}`);
      console.log(`    notification_no: ${r.notification_number ?? 'null'}`);
      console.log(`    application_start: ${r.application_start ?? 'null'}`);
      console.log(`    application_end:   ${r.application_end ?? 'null'}`);
      console.log(`    notification_date: ${r.notification_date ?? 'null'}`);
      console.log(`    db_status:         ${r.status}`);
      console.log(`    derived_status:    ${derivedStatus}`);
      console.log(`    is_currently_open: ${isOpen}`);
      console.log(`    is_current/relevant: ${isCurrent}`);
      console.log(`    official_page_url: ${r.official_page_url ?? 'null'}`);
      console.log(`    official_pdf_url:  ${r.official_pdf_url ?? 'null'}`);
    }
  }

  // ── PART 4: APPSC Current Notifications ────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('PART 4: APPSC Notifications — 07/2026, 08/2026, 19/2026');
  console.log('─────────────────────────────────────────────────────────────────');

  const targetAppscNotifs = ['07/2026', '08/2026', '19/2026'];
  for (const notifNum of targetAppscNotifs) {
    const found = allRecs.filter(
      (r) =>
        r.organization === 'APPSC' &&
        (r.notification_number === notifNum ||
          r.notification_number?.includes(notifNum))
    );
    if (found.length === 0) {
      console.log(`  ❌ APPSC ${notifNum} — NOT FOUND in database`);
    } else {
      for (const r of found) {
        const isOpen = isCurrentlyOpen(r, todayIST);
        const isCurrent = isRecruitmentCurrentOrRelevant(r, now);
        const derivedStatus = deriveRecruitmentStatus(
          r.application_start, r.application_end, r.notification_date, r.notification_number, now
        );
        console.log(`  ✅ APPSC ${notifNum} FOUND: ${r.title?.substring(0, 70)}`);
        console.log(`    application_start: ${r.application_start ?? 'null'}`);
        console.log(`    application_end:   ${r.application_end ?? 'null'}`);
        console.log(`    notification_date: ${r.notification_date ?? 'null'}`);
        console.log(`    db_status:         ${r.status}`);
        console.log(`    derived_status:    ${derivedStatus}`);
        console.log(`    is_currently_open: ${isOpen}`);
        console.log(`    is_current/relevant: ${isCurrent}`);
      }
    }
  }

  // ── PART 5: All APPSC records to see full picture ──────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('PART 5: All APPSC Records in Database (current year only)');
  console.log('─────────────────────────────────────────────────────────────────');
  const appscRecs = allRecs.filter((r) => r.organization === 'APPSC');
  const currentYear = now.getFullYear();
  const appsc2026 = appscRecs.filter(
    (r) =>
      r.notification_number?.includes(String(currentYear)) ||
      r.title?.includes(String(currentYear))
  );
  console.log(`  Total APPSC records: ${appscRecs.length}, Of which ${currentYear}: ${appsc2026.length}`);
  for (const r of appsc2026) {
    const isOpen = isCurrentlyOpen(r, todayIST);
    console.log(
      `    ${r.notification_number ?? 'N/A'} | ${r.title?.substring(0, 60)} | start:${r.application_start ?? 'null'} end:${r.application_end ?? 'null'} | db_status:${r.status} | open_by_date:${isOpen}`
    );
  }

  // ── PART 6: Status mismatch audit ─────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('PART 6: Status Mismatch Audit (db_status != derived_status for current recs)');
  console.log('─────────────────────────────────────────────────────────────────');
  let mismatches = 0;
  for (const r of currentRecs) {
    if (!r.application_start && !r.application_end) continue;
    const derived = deriveRecruitmentStatus(
      r.application_start, r.application_end, r.notification_date, r.notification_number, now
    );
    if (derived !== r.status) {
      mismatches++;
      console.log(
        `  MISMATCH [${r.organization}] ${r.notification_number ?? 'N/A'} | db_status:${r.status} → should be:${derived}`
      );
      console.log(`    start:${r.application_start} end:${r.application_end} title:${r.title?.substring(0, 50)}`);
    }
  }
  if (mismatches === 0) console.log('  ✅ No mismatches found — all db statuses are accurate.');

  // ── PART 7: User_recruitment_matches check ─────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('PART 7: Open-by-date recruitments WITH NO match row (would be invisible from matches-only logic)');
  console.log('─────────────────────────────────────────────────────────────────');
  const openByDateIds = openByDate.map((r) => r.id);
  let unmatchedCount = 0;
  if (openByDateIds.length > 0) {
    const { data: matchRows } = await supabase
      .from('user_recruitment_matches')
      .select('recruitment_id')
      .in('recruitment_id', openByDateIds);
    const matchedIds = new Set((matchRows || []).map((m) => m.recruitment_id));
    for (const r of openByDate) {
      if (!matchedIds.has(r.id)) {
        unmatchedCount++;
        console.log(
          `  [${r.organization}] ${r.notification_number ?? 'N/A'} | ${r.title?.substring(0, 60)} — NO match row exists`
        );
      }
    }
  }
  if (unmatchedCount === 0) {
    console.log('  ✅ All open-by-date recruitments have match rows.');
  } else {
    console.log(`  ⚠️  ${unmatchedCount} open recruitment(s) would be INVISIBLE if we relied solely on user_recruitment_matches`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('AUDIT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

runFullAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
