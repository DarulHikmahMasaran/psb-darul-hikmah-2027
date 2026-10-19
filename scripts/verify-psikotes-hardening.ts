/**
 * Verification Script: Automated Tests for CBT & Psikotes Final Hardening
 * Tests 1 to 12 as requested in the Hardening Specification
 */

import { hasPermission } from '../src/lib/permissions';
import { cbtService } from '../src/services/cbtService';
import { getStorageData, saveStorageData } from '../src/lib/storage';

async function runHardeningTests() {
  console.log('================================================================');
  console.log('RUNNING MANDATORY CBT & PSIKOTES HARDENING AUDIT (TEST 1 - 12)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testNum: number, name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`[PASS] TEST ${testNum}: ${name}`);
      if (detail) console.log(`       -> ${detail}`);
      passed++;
    } else {
      console.error(`[FAIL] TEST ${testNum}: ${name}`);
      if (detail) console.error(`       -> ${detail}`);
      failed++;
    }
  }

  // Set up mock test attempt in storage for real method testing
  const data = getStorageData();
  const testAttemptId = 'att-hardening-test-1';
  data.examAttempts = data.examAttempts.filter(a => a.id !== testAttemptId);
  data.examAttempts.push({
    id: testAttemptId,
    exam_id: 'exam-cbt-1',
    candidate_id: 'cand-1',
    started_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    status: 'IN_PROGRESS',
    total_questions: 10,
    answered_questions: 5,
    correct_answers: 3,
    raw_score: 6,
    max_score: 20,
    normalized_score: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  saveStorageData(data);

  // TEST 1: PANITIA membuka monitoring.
  // Expected: ALLOW READ.
  const panitiaCanMonitor = hasPermission('PANITIA', 'PSYCHOTEST_MONITOR');
  assert(1, 'PANITIA membuka monitoring', panitiaCanMonitor === true, 'PANITIA has PSYCHOTEST_MONITOR permission');

  // TEST 2: PANITIA klik Force Submit.
  // Expected: tidak tersedia (Button hidden in UI).
  const panitiaCanForceSubmitUI = hasPermission('PANITIA', 'CBT_FORCE_SUBMIT');
  assert(2, 'PANITIA klik Force Submit', panitiaCanForceSubmitUI === false, 'CBT_FORCE_SUBMIT is DENIED for PANITIA (button hidden in UI)');

  // TEST 3: PANITIA mencoba endpoint Force Submit langsung.
  // Expected: 403.
  const panitiaForceSubmitRes = await cbtService.forceSubmitAttempt(testAttemptId, {
    id: 'usr-panitia-1',
    role: 'PANITIA',
    email: 'panitia@darulhikmah.sch.id',
  });
  assert(
    3,
    'PANITIA mencoba endpoint Force Submit langsung',
    panitiaForceSubmitRes.success === false && Boolean(panitiaForceSubmitRes.error?.includes('403')),
    `Service rejected call: "${panitiaForceSubmitRes.error}"`
  );

  // TEST 4: PANITIA mencoba Reset Attempt.
  // Expected: 403.
  const panitiaResetRes = await cbtService.resetAttempt(testAttemptId, {
    id: 'usr-panitia-1',
    role: 'PANITIA',
    email: 'panitia@darulhikmah.sch.id',
  });
  assert(
    4,
    'PANITIA mencoba Reset Attempt',
    panitiaResetRes.success === false && Boolean(panitiaResetRes.error?.includes('403')),
    `Service rejected call: "${panitiaResetRes.error}"`
  );

  // TEST 5: PANITIA membuka scoring config.
  // Expected: 403.
  const panitiaCanManageScoring = hasPermission('PANITIA', 'PSYCHOTEST_SCORING_MANAGE');
  const panitiaScoringRes = await cbtService.updatePsychotestScoringConfig(
    'sc-1',
    {
      scoring_model: 'BINARY',
      default_correct_score: 5,
      default_wrong_score: 0,
      normalization_base: 100,
      is_active: true,
    },
    { id: 'usr-panitia-1', role: 'PANITIA' }
  );
  assert(
    5,
    'PANITIA membuka scoring config',
    panitiaCanManageScoring === false && panitiaScoringRes.success === false && Boolean(panitiaScoringRes.error?.includes('403')),
    `Permission denied & service rejected: "${panitiaScoringRes.error}"`
  );

  // TEST 6: SUPER_ADMIN Force Submit.
  // Expected: ALLOW.
  const superAdminCanForceSubmit = hasPermission('SUPER_ADMIN', 'CBT_FORCE_SUBMIT');
  const superAdminForceSubmitRes = await cbtService.forceSubmitAttempt(testAttemptId, {
    id: 'usr-admin-1',
    role: 'SUPER_ADMIN',
    email: 'admin@darulhikmah.sch.id',
  });
  assert(
    6,
    'SUPER_ADMIN Force Submit',
    superAdminCanForceSubmit === true && superAdminForceSubmitRes.success === true,
    'SUPER_ADMIN successfully executed force submit'
  );

  // TEST 7: SUPER_ADMIN Reset Attempt.
  // Expected: ALLOW.
  const superAdminCanReset = hasPermission('SUPER_ADMIN', 'CBT_RESET');
  const superAdminResetRes = await cbtService.resetAttempt(testAttemptId, {
    id: 'usr-admin-1',
    role: 'SUPER_ADMIN',
    email: 'admin@darulhikmah.sch.id',
  });
  assert(
    7,
    'SUPER_ADMIN Reset Attempt',
    superAdminCanReset === true && superAdminResetRes.success === true,
    'SUPER_ADMIN successfully executed reset attempt'
  );

  // TEST 8: PIMPINAN membuka /admin/psikotes.
  // Expected: 403.
  const pimpinanAdminPsikotes = hasPermission('PIMPINAN', 'PSYCHOTEST_VIEW');
  const pimpinanCanManagePsikotes = hasPermission('PIMPINAN', 'PSYCHOTEST_MANAGE');
  assert(
    8,
    'PIMPINAN membuka /admin/psikotes',
    pimpinanAdminPsikotes === false && pimpinanCanManagePsikotes === false,
    'PIMPINAN is strictly DENIED from /admin/psikotes operational routes (Route guard & permission 403)'
  );

  // TEST 9: PIMPINAN membuka dashboard /pimpinan.
  // Expected: ALLOW READ ONLY.
  const pimpinanCanExecutive = hasPermission('PIMPINAN', 'EXECUTIVE_VIEW');
  const pimpinanCanEdit = hasPermission('PIMPINAN', 'PSYCHOTEST_MANAGE') || hasPermission('PIMPINAN', 'CBT_FORCE_SUBMIT');
  assert(
    9,
    'PIMPINAN membuka dashboard /pimpinan',
    pimpinanCanExecutive === true && pimpinanCanEdit === false,
    'PIMPINAN has EXECUTIVE_VIEW with 0 write/mutation permissions (pure READ ONLY)'
  );

  // TEST 10: PENGUJI_QURAN membuka Psikotes.
  // Expected: 403.
  const pengujiQuranPsikotesView = hasPermission('PENGUJI_QURAN', 'PSYCHOTEST_VIEW');
  const pengujiQuranPsikotesMonitor = hasPermission('PENGUJI_QURAN', 'PSYCHOTEST_MONITOR');
  const pengujiQuranSelfTake = hasPermission('PENGUJI_QURAN', 'SELF_PSYCHOTEST_TAKE');
  assert(
    10,
    'PENGUJI_QURAN membuka Psikotes',
    pengujiQuranPsikotesView === false && pengujiQuranPsikotesMonitor === false && pengujiQuranSelfTake === false,
    'PENGUJI_QURAN has zero permissions on Psikotes module (DENIED on all admin, result, and runtime routes)'
  );

  // TEST 11: PESERTA membuka question bank.
  // Expected: 403.
  const pesertaQuestionManage = hasPermission('PESERTA', 'QUESTION_MANAGE');
  const pesertaPsiQuestionManage = hasPermission('PESERTA', 'PSYCHOTEST_QUESTION_MANAGE');
  const pesertaSaveQuestionRes = await cbtService.savePsychotestQuestion(
    {
      category_id: 'cat-1',
      question_text: 'Hacked question',
      options: [],
    },
    { id: 'usr-peserta-1', role: 'PESERTA' }
  );
  assert(
    11,
    'PESERTA membuka question bank',
    pesertaQuestionManage === false && pesertaPsiQuestionManage === false && pesertaSaveQuestionRes.success === false && Boolean(pesertaSaveQuestionRes.error?.includes('403')),
    `Peserta denied from question bank: "${pesertaSaveQuestionRes.error}"`
  );

  // TEST 12: Peserta mencoba mengubah score.
  // Expected: 403.
  const pesertaScoreManage = hasPermission('PESERTA', 'SCORE_MANAGE');
  const pesertaPsiScoreManage = hasPermission('PESERTA', 'PSYCHOTEST_SCORING_MANAGE');
  const pesertaUpdateScoreRes = await cbtService.updatePsychotestScoringConfig(
    'sc-1',
    {
      scoring_model: 'BINARY',
      default_correct_score: 100,
      default_wrong_score: 0,
      normalization_base: 100,
      is_active: true,
    },
    { id: 'usr-peserta-1', role: 'PESERTA' }
  );
  assert(
    12,
    'Peserta mencoba mengubah score',
    pesertaScoreManage === false && pesertaPsiScoreManage === false && pesertaUpdateScoreRes.success === false && Boolean(pesertaUpdateScoreRes.error?.includes('403')),
    `Peserta denied from altering scores: "${pesertaUpdateScoreRes.error}"`
  );

  console.log('\n----------------------------------------------------------------');
  console.log('AUDIT SPECIFIC: PSYCHOTEST SCORING CONFIG QUERY & DASHBOARD ACCESS');
  console.log('----------------------------------------------------------------\n');

  // SPECIFIC TEST 1: PIMPINAN query scoring config → 403/denied
  const pimpinanQueryScoring = await cbtService.getPsychotestScoringConfigs({
    id: 'usr-pimpinan-1',
    role: 'PIMPINAN',
    email: 'pimpinan@darulhikmah.sch.id',
  });
  assert(
    13,
    'PIMPINAN query scoring config (getPsychotestScoringConfigs)',
    pimpinanQueryScoring.success === false && Boolean(pimpinanQueryScoring.error?.includes('403')),
    `PIMPINAN query rejected: "${pimpinanQueryScoring.error}"`
  );

  // SPECIFIC TEST 2: PIMPINAN dashboard statistik → allowed
  const pimpinanExecutiveView = hasPermission('PIMPINAN', 'EXECUTIVE_VIEW');
  const pimpinanCbtResultView = hasPermission('PIMPINAN', 'CBT_RESULT_VIEW');
  const pimpinanPsiResultView = hasPermission('PIMPINAN', 'PSYCHOTEST_RESULT_VIEW');
  assert(
    14,
    'PIMPINAN dashboard statistik (executive aggregated overview)',
    pimpinanExecutiveView === true && pimpinanCbtResultView === true && pimpinanPsiResultView === true,
    'PIMPINAN is allowed to view aggregate results, category distributions, and executive reports'
  );

  // SPECIFIC TEST 3: PANITIA query scoring config → denied
  const panitiaQueryScoring = await cbtService.getPsychotestScoringConfigs({
    id: 'usr-panitia-1',
    role: 'PANITIA',
    email: 'panitia@darulhikmah.sch.id',
  });
  assert(
    15,
    'PANITIA query scoring config (getPsychotestScoringConfigs)',
    panitiaQueryScoring.success === false && Boolean(panitiaQueryScoring.error?.includes('403')),
    `PANITIA query rejected: "${panitiaQueryScoring.error}"`
  );

  // SPECIFIC TEST 4: SUPER_ADMIN query scoring config → allowed
  const superAdminQueryScoring = await cbtService.getPsychotestScoringConfigs({
    id: 'usr-admin-1',
    role: 'SUPER_ADMIN',
    email: 'admin@darulhikmah.sch.id',
  });
  assert(
    16,
    'SUPER_ADMIN query scoring config (getPsychotestScoringConfigs)',
    superAdminQueryScoring.success === true && superAdminQueryScoring.configs.length > 0,
    `SUPER_ADMIN successfully retrieved ${superAdminQueryScoring.configs.length} scoring configs`
  );

  // SPECIFIC TEST 5: Peserta query scoring config → denied
  const pesertaQueryScoring = await cbtService.getPsychotestScoringConfigs({
    id: 'usr-peserta-1',
    role: 'PESERTA',
    email: 'peserta@darulhikmah.sch.id',
  });
  assert(
    17,
    'PESERTA query scoring config (getPsychotestScoringConfigs)',
    pesertaQueryScoring.success === false && Boolean(pesertaQueryScoring.error?.includes('403')),
    `PESERTA query rejected: "${pesertaQueryScoring.error}"`
  );

  // SPECIFIC TEST 6: Penguji Qur'an query scoring config → denied
  const pengujiQueryScoring = await cbtService.getPsychotestScoringConfigs({
    id: 'usr-penguji-1',
    role: 'PENGUJI_QURAN',
    email: 'penguji@darulhikmah.sch.id',
  });
  assert(
    18,
    'PENGUJI_QURAN query scoring config (getPsychotestScoringConfigs)',
    pengujiQueryScoring.success === false && Boolean(pengujiQueryScoring.error?.includes('403')),
    `PENGUJI_QURAN query rejected: "${pengujiQueryScoring.error}"`
  );

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
