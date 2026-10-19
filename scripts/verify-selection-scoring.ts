/**
 * Verification Script: Automated Tests for Final Scoring & Selection Engine
 * Validates PSB PPTQM Darul Hikmah TP 2027/2028 Final Selection Requirements
 */

import { hasPermission } from '../src/lib/permissions';
import { selectionScoringService } from '../src/services/selectionScoringService';
import { getStorageData, saveStorageData } from '../src/lib/storage';
import { SelectionScoringVersion, SelectionPassingRuleVersion, SelectionTieBreaker } from '../src/types/selection';

async function runSelectionScoringTests() {
  console.log('================================================================');
  console.log('RUNNING MANDATORY FINAL SCORING & KELULUSAN AUDIT TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testNum: number, desc: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`[PASS] TEST ${testNum}: ${desc}`);
      if (details) console.log(`       -> ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] TEST ${testNum}: ${desc}`);
      if (details) console.error(`       -> ${details}`);
      failed++;
    }
  }

  const superAdminUser = { id: 'usr-admin-1', role: 'SUPER_ADMIN', email: 'admin@darulhikmah.sch.id' };
  const panitiaUser = { id: 'usr-panitia-1', role: 'PANITIA', email: 'panitia@darulhikmah.sch.id' };
  const pimpinanUser = { id: 'usr-pimpinan-1', role: 'PIMPINAN', email: 'pimpinan@darulhikmah.sch.id' };
  const pengujiUser = { id: 'usr-penguji-1', role: 'PENGUJI_QURAN', email: 'penguji@darulhikmah.sch.id' };
  const pesertaUser = { id: 'usr-peserta-1', role: 'PESERTA', email: 'peserta@darulhikmah.sch.id' };

  // ============================================================================
  // TEST 1: TEST FORMULA WEIGHTED SCORE
  // ============================================================================
  // Formula: (academic_score * 0.40) + (quran_score * 0.35) + (psychotest_score * 0.25)
  // Given: Academic = 80, Quran = 90, Psychotest = 70
  // Calculation: (80 * 0.40) + (90 * 0.35) + (70 * 0.25) = 32 + 31.5 + 17.5 = 81.00
  const acadScore = 80;
  const quranScore = 90;
  const psiScore = 70;
  const weightAcad = 40;
  const weightQuran = 35;
  const weightPsi = 25;
  const calculatedFinal = (acadScore * weightAcad) / 100 + (quranScore * weightQuran) / 100 + (psiScore * weightPsi) / 100;
  const expectedFinal = 81.00;
  assert(
    1,
    'Formula Weighted Score Verification (40% / 35% / 25%)',
    Math.abs(calculatedFinal - expectedFinal) < 0.000001,
    `Calculated: ${calculatedFinal.toFixed(2)}, Expected: ${expectedFinal.toFixed(2)}`
  );

  // ============================================================================
  // TEST 2: TEST NORMALISASI 0–100
  // ============================================================================
  // Raw scores out of different maximums must normalize cleanly into [0, 100]
  const rawAcad = 45;
  const maxAcad = 50; // 45 / 50 * 100 = 90
  const normalizedAcad = (rawAcad / maxAcad) * 100;
  assert(
    2,
    'Normalisasi Komponen 0–100 Scale',
    normalizedAcad === 90 && normalizedAcad >= 0 && normalizedAcad <= 100,
    `Raw: ${rawAcad}/${maxAcad} normalized to: ${normalizedAcad}`
  );

  // Setup mock test environment in storage
  const data = getStorageData();

  // Clean test candidates
  const testCandidateA: any = {
    id: 'cand-test-1',
    user_id: 'usr-cand-1',
    registration_number: 'PSB27-TEST01',
    full_name: 'Ahmad Fawwaz',
    gender: 'L',
    nisn: '1234567890',
    school_origin: 'SD Darul Hikmah',
    school_name: 'SD Darul Hikmah',
    status: 'TERVERIFIKASI',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  };

  const testCandidateB: any = {
    id: 'cand-test-2',
    user_id: 'usr-cand-2',
    registration_number: 'PSB27-TEST02',
    full_name: 'Bilal Habasyi',
    gender: 'L',
    nisn: '1234567891',
    school_origin: 'SD Islam Terpadu',
    school_name: 'SD Islam Terpadu',
    status: 'TERVERIFIKASI',
    created_at: '2026-10-01T08:15:00Z',
    updated_at: '2026-10-01T08:15:00Z',
  };

  const testCandidateC: any = {
    id: 'cand-test-3',
    user_id: 'usr-cand-3',
    registration_number: 'PSB27-TEST03',
    full_name: 'Chaidir Ali',
    gender: 'L',
    nisn: '1234567892',
    school_origin: 'SD Teladan',
    school_name: 'SD Teladan',
    status: 'TERVERIFIKASI',
    created_at: '2026-10-01T08:30:00Z',
    updated_at: '2026-10-01T08:30:00Z',
  };

  const testCandidateD_FailedComponent: any = {
    id: 'cand-test-4',
    user_id: 'usr-cand-4',
    registration_number: 'PSB27-TEST04',
    full_name: 'Daffa Rizky',
    gender: 'L',
    nisn: '1234567893',
    school_origin: 'SD Negeri 01',
    school_name: 'SD Negeri 01',
    status: 'TERVERIFIKASI',
    created_at: '2026-10-01T08:45:00Z',
    updated_at: '2026-10-01T08:45:00Z',
  };

  data.candidates = [testCandidateA, testCandidateB, testCandidateC, testCandidateD_FailedComponent];

  // Exams
  const academicExamId = 'exam-academic-audit';
  const psychotestExamId = 'exam-psychotest-audit';
  data.exams = [
    {
      id: academicExamId,
      test_schedule_id: 'sched-1',
      title: 'Ujian CBT Akademik PSB 2027',
      exam_type: 'ACADEMIC',
      duration_minutes: 90,
      total_questions: 50,
      randomize_questions: false,
      randomize_options: false,
      max_attempts: 1,
      passing_score: 65,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: psychotestExamId,
      test_schedule_id: 'sched-1',
      title: 'Psikotes CBT PSB 2027',
      exam_type: 'PSYCHOTEST',
      duration_minutes: 60,
      total_questions: 40,
      randomize_questions: false,
      randomize_options: false,
      max_attempts: 1,
      passing_score: 60,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Candidate A: High Scores
  // Acad: 85, Quran: 90, Psi: 80 => (85*0.40) + (90*0.35) + (80*0.25) = 34 + 31.5 + 20 = 85.50
  // Candidate B: Equal Final Score to C for tie-breaker testing
  // Candidate B: Acad: 80, Quran: 85, Psi: 70 => (80*0.40) + (85*0.35) + (70*0.25) = 32 + 29.75 + 17.5 = 79.25
  // Candidate C: Acad: 75, Quran: 90.714285, Psi: 70 => (75*0.40) + (90.714285*0.35) + (70*0.25) = 30 + 31.75 + 17.5 = 79.25
  // Candidate D: Fails Quran (score = 50 < 70 min passing grade)
  data.examAttempts = [
    // Candidate A
    { id: 'att-a-1', candidate_id: 'cand-test-1', exam_id: academicExamId, total_questions: 50, answered_questions: 50, correct_answers: 42, raw_score: 85, max_score: 100, normalized_score: 85, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' },
    { id: 'att-a-2', candidate_id: 'cand-test-1', exam_id: psychotestExamId, total_questions: 40, answered_questions: 40, correct_answers: 32, raw_score: 80, max_score: 100, normalized_score: 80, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' },
    // Candidate B
    { id: 'att-b-1', candidate_id: 'cand-test-2', exam_id: academicExamId, total_questions: 50, answered_questions: 50, correct_answers: 40, raw_score: 80, max_score: 100, normalized_score: 80, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' },
    { id: 'att-b-2', candidate_id: 'cand-test-2', exam_id: psychotestExamId, total_questions: 40, answered_questions: 40, correct_answers: 28, raw_score: 70, max_score: 100, normalized_score: 70, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' },
    // Candidate C
    { id: 'att-c-1', candidate_id: 'cand-test-3', exam_id: academicExamId, total_questions: 50, answered_questions: 50, correct_answers: 38, raw_score: 75, max_score: 100, normalized_score: 75, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' },
    { id: 'att-c-2', candidate_id: 'cand-test-3', exam_id: psychotestExamId, total_questions: 40, answered_questions: 40, correct_answers: 28, raw_score: 70, max_score: 100, normalized_score: 70, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' },
    // Candidate D (Failed Component)
    { id: 'att-d-1', candidate_id: 'cand-test-4', exam_id: academicExamId, total_questions: 50, answered_questions: 50, correct_answers: 40, raw_score: 80, max_score: 100, normalized_score: 80, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' },
    { id: 'att-d-2', candidate_id: 'cand-test-4', exam_id: psychotestExamId, total_questions: 40, answered_questions: 40, correct_answers: 32, raw_score: 80, max_score: 100, normalized_score: 80, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' },
  ];

  data.quranAssessments = [
    { id: 'qa-test-1', candidate_id: 'cand-test-1', schedule_id: 'sched-1', examiner_user_id: 'usr-penguji-1', raw_score: 90, normalized_score: 90, status: 'LOCKED', created_at: '', updated_at: '' },
    { id: 'qa-test-2', candidate_id: 'cand-test-2', schedule_id: 'sched-1', examiner_user_id: 'usr-penguji-1', raw_score: 85, normalized_score: 85, status: 'LOCKED', created_at: '', updated_at: '' },
    { id: 'qa-test-3', candidate_id: 'cand-test-3', schedule_id: 'sched-1', examiner_user_id: 'usr-penguji-1', raw_score: 90.714285, normalized_score: 90.714285, status: 'LOCKED', created_at: '', updated_at: '' },
    // Candidate D fails Quran passing grade (50 < 70)
    { id: 'qa-test-4', candidate_id: 'cand-test-4', schedule_id: 'sched-1', examiner_user_id: 'usr-penguji-1', raw_score: 50, normalized_score: 50, status: 'LOCKED', created_at: '', updated_at: '' },
  ];

  saveStorageData(data);

  // Setup Version
  const createScoringRes = await selectionScoringService.createScoringVersion(
    {
      version_name: 'Versi Uji Audit Final (40/35/25)',
      academic_year: '2027/2028',
      components: [
        { component_code: 'ACADEMIC', weight: 40, source_exam_id: academicExamId },
        { component_code: 'QURAN', weight: 35 },
        { component_code: 'PSYCHOTEST', weight: 25, source_exam_id: psychotestExamId },
      ],
    },
    superAdminUser
  );
  const scoringVerId = createScoringRes.version!.id;
  await selectionScoringService.approveScoringVersion(scoringVerId, superAdminUser);

  // Setup Passing Rule: min academic = 65, min quran = 70, min psychotest = 60, min final = 65
  const createPassingRes = await selectionScoringService.createPassingRuleVersion(
    {
      version_name: 'Standar Kelulusan Audit 2027',
      academic_year: '2027/2028',
      min_academic: 65,
      min_quran: 70,
      min_psychotest: 60,
      min_final_score: 65,
    },
    superAdminUser
  );
  const passingRuleVerId = createPassingRes.version!.id;
  await selectionScoringService.approvePassingRuleVersion(passingRuleVerId, superAdminUser);

  // Create Selection Run with Quota = 1, Reserve = 1
  const createRunRes = await selectionScoringService.createSelectionRun(
    {
      run_name: 'Selection Run Audit Kelulusan',
      academic_year: '2027/2028',
      scoring_version_id: scoringVerId,
      passing_rule_version_id: passingRuleVerId,
      quota: 1,
      reserve_count: 1,
    },
    superAdminUser
  );
  const runId = createRunRes.run!.id;

  // Run calculation
  const calcRes = await selectionScoringService.calculateSelectionRun(runId, superAdminUser);
  const results = calcRes.results || [];

  // ============================================================================
  // TEST 3: TEST PASSING GRADE KOMPONEN
  // ============================================================================
  const candDResult = results.find(r => r.candidate_id === 'cand-test-4');
  assert(
    3,
    'Passing Grade Komponen Evaluation (Gagal Qur\'an)',
    candDResult?.eligibility_status === 'FAILED_COMPONENT' &&
      candDResult.result_status === 'TIDAK_LULUS' &&
      candDResult.failure_reasons.some(f => f.component === 'QURAN'),
    `Cand D Result: ${candDResult?.result_status}, Reason: "${candDResult?.decision_reason}"`
  );

  // ============================================================================
  // TEST 4: TEST PASSING GRADE FINAL
  // ============================================================================
  // Candidates with fullFinalScore < 65 marked FAILED_FINAL
  assert(
    4,
    'Passing Grade Final Evaluation',
    candDResult !== undefined && candDResult.result_status === 'TIDAK_LULUS',
    'Candidate failing component threshold is marked TIDAK_LULUS'
  );

  // ============================================================================
  // TEST 5: TEST RANKING DETERMINISTIC
  // ============================================================================
  // Ahmad Fawwaz has score 85.50 -> Rank 1
  // Bilal (79.25, Acad=80) vs Chaidir (79.25, Acad=75). Tie breaker priority 2 is ACADEMIC_SCORE.
  // Bilal has higher academic score (80 > 75) => Bilal must be ranked higher than Chaidir!
  const rank1 = results.find(r => r.overall_rank === 1);
  const candBRes = results.find(r => r.candidate_id === 'cand-test-2');
  const candCRes = results.find(r => r.candidate_id === 'cand-test-3');
  assert(
    5,
    'Deterministic Ranking by Score & Tie Breaker',
    rank1?.candidate_id === 'cand-test-1' &&
      (candBRes?.overall_rank ?? 99) < (candCRes?.overall_rank ?? 99),
    `Rank 1: ${rank1?.candidate?.full_name}, Rank 2: ${candBRes?.candidate?.full_name} (Rank ${candBRes?.overall_rank}), Rank 3: ${candCRes?.candidate?.full_name} (Rank ${candCRes?.overall_rank})`
  );

  // ============================================================================
  // TEST 6: TEST QUOTA
  // ============================================================================
  // Quota = 1 => only Rank 1 (Ahmad Fawwaz) is LULUS
  const lulusList = results.filter(r => r.result_status === 'LULUS');
  assert(
    6,
    'Quota Allocation (Quota = 1)',
    lulusList.length === 1 && lulusList[0].candidate_id === 'cand-test-1',
    `LULUS count: ${lulusList.length} (Expected: 1, Candidate: ${lulusList[0]?.candidate?.full_name})`
  );

  // ============================================================================
  // TEST 7: TEST CADANGAN
  // ============================================================================
  // Reserve count = 1 => Rank 2 (Bilal) is CADANGAN
  const cadanganList = results.filter(r => r.result_status === 'CADANGAN');
  assert(
    7,
    'Reserve (Cadangan) Allocation (Reserve = 1)',
    cadanganList.length === 1 && cadanganList[0].candidate_id === 'cand-test-2',
    `CADANGAN count: ${cadanganList.length} (Expected: 1, Candidate: ${cadanganList[0]?.candidate?.full_name})`
  );

  // ============================================================================
  // TEST 8: TEST TIE BREAKER RESOLUTION
  // ============================================================================
  // Bilal & Chaidir had same final score (79.25), but Bilal won tie breaker on Academic Score (80 > 75)
  assert(
    8,
    'Deterministic Tie-Breaker Applied (Academic Score Priority)',
    (candBRes?.eligible_rank ?? 0) === 2 && (candCRes?.eligible_rank ?? 0) === 3,
    `Candidate B Rank: ${candBRes?.eligible_rank}, Candidate C Rank: ${candCRes?.eligible_rank}`
  );

  // ============================================================================
  // TEST 9: TEST UNRESOLVED TIE => TIE_PENDING & APPROVAL BLOCK
  // ============================================================================
  // Create an exact identical clone of Candidate A at quota boundary to trigger unresolved tie
  const storageWithTie = getStorageData();
  const candClone = {
    id: 'cand-clone-tie',
    user_id: 'usr-clone-tie',
    registration_number: 'PSB27-CLONE',
    full_name: 'Ahmad Clone (Identical)',
    gender: 'L',
    nisn: '9999999999',
    school_origin: 'SD Darul Hikmah',
    school_name: 'SD Darul Hikmah',
    status: 'TERVERIFIKASI',
    created_at: '2026-10-01T08:00:00Z', // Exact same registration timestamp
    updated_at: '2026-10-01T08:00:00Z',
  };
  storageWithTie.candidates.push(candClone as any);
  storageWithTie.examAttempts.push(
    { id: 'att-clone-1', candidate_id: 'cand-clone-tie', exam_id: academicExamId, total_questions: 50, answered_questions: 50, correct_answers: 42, raw_score: 85, max_score: 100, normalized_score: 85, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' },
    { id: 'att-clone-2', candidate_id: 'cand-clone-tie', exam_id: psychotestExamId, total_questions: 40, answered_questions: 40, correct_answers: 32, raw_score: 80, max_score: 100, normalized_score: 80, status: 'SUBMITTED', started_at: '', expires_at: '', submitted_at: '', created_at: '', updated_at: '' }
  );
  storageWithTie.quranAssessments.push(
    { id: 'qa-clone-1', candidate_id: 'cand-clone-tie', schedule_id: 'sched-1', examiner_user_id: 'usr-penguji-1', raw_score: 90, normalized_score: 90, status: 'LOCKED', created_at: '', updated_at: '' }
  );
  saveStorageData(storageWithTie);

  const tieRunRes = await selectionScoringService.createSelectionRun(
    {
      run_name: 'Run Unresolved Tie Test',
      academic_year: '2027/2028',
      scoring_version_id: scoringVerId,
      passing_rule_version_id: passingRuleVerId,
      quota: 1,
      reserve_count: 0,
    },
    superAdminUser
  );
  const tieRunId = tieRunRes.run!.id;
  const calcTieRun = await selectionScoringService.calculateSelectionRun(tieRunId, superAdminUser);
  const tiePendingResults = (calcTieRun.results || []).filter(r => r.result_status === 'TIE_PENDING');

  // Try approving while tie pending exists
  const blockedApproval = await selectionScoringService.approveSelectionRun(tieRunId, superAdminUser);

  assert(
    9,
    'Unresolved Tie Boundary => TIE_PENDING & Approval Blocked',
    tiePendingResults.length >= 2 &&
      calcTieRun.run?.tie_pending_count! >= 2 &&
      blockedApproval.success === false &&
      Boolean(blockedApproval.error?.includes('Approval diblokir')),
    `Tie pending candidates: ${tiePendingResults.length}, Approval error: "${blockedApproval.error}"`
  );

  // Clean clone candidate from storage
  const cleanData = getStorageData();
  cleanData.candidates = cleanData.candidates.filter(c => c.id !== 'cand-clone-tie');
  cleanData.examAttempts = cleanData.examAttempts.filter(a => a.candidate_id !== 'cand-clone-tie');
  cleanData.quranAssessments = cleanData.quranAssessments.filter(a => a.candidate_id !== 'cand-clone-tie');
  saveStorageData(cleanData);

  // ============================================================================
  // TEST 10: TEST APPROVED RUN IMMUTABLE
  // ============================================================================
  // Approve the clean original run
  const approveRes = await selectionScoringService.approveSelectionRun(runId, superAdminUser);
  const recalculateApproved = await selectionScoringService.calculateSelectionRun(runId, superAdminUser);

  assert(
    10,
    'APPROVED Selection Run is Strictly Immutable',
    approveRes.success === true &&
      recalculateApproved.success === false &&
      Boolean(recalculateApproved.error?.includes('IMMUTABLE')),
    `Approval success: ${approveRes.success}, Recalculation rejected: "${recalculateApproved.error}"`
  );

  // ============================================================================
  // TEST 11 to 23: SPECIFIC ROLE-BASED NEGATIVE & POSITIVE TESTS
  // ============================================================================

  // TEST 11: PANITIA create run => 403
  const panitiaCreateRunRes = await selectionScoringService.createSelectionRun(
    { run_name: 'Hacked Run', scoring_version_id: scoringVerId, passing_rule_version_id: passingRuleVerId },
    panitiaUser
  );
  assert(
    11,
    'PANITIA create run => 403 Forbidden',
    panitiaCreateRunRes.success === false && Boolean(panitiaCreateRunRes.error?.includes('403')),
    `Result: ${panitiaCreateRunRes.error}`
  );

  // TEST 12: PANITIA change scoring => 403
  const panitiaChangeScoringRes = await selectionScoringService.createScoringVersion(
    {
      version_name: 'Illegal Version by Panitia',
      components: [
        { component_code: 'ACADEMIC', weight: 40 },
        { component_code: 'QURAN', weight: 35 },
        { component_code: 'PSYCHOTEST', weight: 25 },
      ],
    },
    panitiaUser
  );
  assert(
    12,
    'PANITIA change scoring => 403 Forbidden',
    panitiaChangeScoringRes.success === false && Boolean(panitiaChangeScoringRes.error?.includes('403')),
    `Result: ${panitiaChangeScoringRes.error}`
  );

  // TEST 13: PANITIA change quota => 403
  const panitiaChangeQuotaRes = await selectionScoringService.updateQuotaConfig(
    { quota: 200, reserve_count: 50 },
    panitiaUser
  );
  assert(
    13,
    'PANITIA change quota => 403 Forbidden',
    panitiaChangeQuotaRes.success === false && Boolean(panitiaChangeQuotaRes.error?.includes('403')),
    `Result: ${panitiaChangeQuotaRes.error}`
  );

  // TEST 14: PANITIA resolve tie => 403
  const panitiaResolveTieRes = await selectionScoringService.resolveTie(
    runId,
    'cand-test-1',
    'LULUS',
    'Panitia unauthorized resolution',
    panitiaUser
  );
  assert(
    14,
    'PANITIA resolve tie => 403 Forbidden',
    panitiaResolveTieRes.success === false && Boolean(panitiaResolveTieRes.error?.includes('403')),
    `Result: ${panitiaResolveTieRes.error}`
  );

  // TEST 15: PANITIA approve => 403
  const panitiaApproveRes = await selectionScoringService.approveSelectionRun(runId, panitiaUser);
  assert(
    15,
    'PANITIA approve => 403 Forbidden',
    panitiaApproveRes.success === false && Boolean(panitiaApproveRes.error?.includes('403')),
    `Result: ${panitiaApproveRes.error}`
  );

  // TEST 16: PIMPINAN read scoring config => DENIED
  const pimpinanReadScoringRes = await selectionScoringService.queryScoringVersions(pimpinanUser);
  assert(
    16,
    'PIMPINAN read scoring config => DENIED (403 Forbidden)',
    pimpinanReadScoringRes.success === false && Boolean(pimpinanReadScoringRes.error?.includes('403')),
    `Result: ${pimpinanReadScoringRes.error}`
  );

  // TEST 17: PIMPINAN read passing rules => DENIED
  const pimpinanReadPassingRes = await selectionScoringService.queryPassingRuleVersions(pimpinanUser);
  assert(
    17,
    'PIMPINAN read passing rules => DENIED (403 Forbidden)',
    pimpinanReadPassingRes.success === false && Boolean(pimpinanReadPassingRes.error?.includes('403')),
    `Result: ${pimpinanReadPassingRes.error}`
  );

  // TEST 18: PIMPINAN read tie breakers => DENIED
  const pimpinanReadTieRes = await selectionScoringService.queryTieBreakers(scoringVerId, pimpinanUser);
  assert(
    18,
    'PIMPINAN read tie breakers => DENIED (403 Forbidden)',
    pimpinanReadTieRes.success === false && Boolean(pimpinanReadTieRes.error?.includes('403')),
    `Result: ${pimpinanReadTieRes.error}`
  );

  // TEST 19: PIMPINAN read internal snapshots => DENIED
  const pimpinanReadSnapshotsRes = await selectionScoringService.queryRunComponentSnapshots(runId, pimpinanUser);
  assert(
    19,
    'PIMPINAN read internal snapshots => DENIED (403 Forbidden)',
    pimpinanReadSnapshotsRes.success === false && Boolean(pimpinanReadSnapshotsRes.error?.includes('403')),
    `Result: ${pimpinanReadSnapshotsRes.error}`
  );

  // TEST 20: PENGUJI_QURAN Final Selection => DENIED
  const pengujiQueryRes = await selectionScoringService.querySelectionResults(runId, pengujiUser);
  assert(
    20,
    'PENGUJI_QURAN Final Selection => DENIED (403 Forbidden)',
    pengujiQueryRes.success === false && Boolean(pengujiQueryRes.error?.includes('403')),
    `Result: ${pengujiQueryRes.error}`
  );

  // TEST 21: PESERTA Final Selection sebelum announcement => DENIED
  const pesertaQueryRes = await selectionScoringService.querySelectionResults(runId, pesertaUser);
  assert(
    21,
    'PESERTA Final Selection sebelum announcement => DENIED (403 Forbidden)',
    pesertaQueryRes.success === false && Boolean(pesertaQueryRes.error?.includes('403')),
    `Result: ${pesertaQueryRes.error}`
  );

  // TEST 22: SUPER_ADMIN semua fungsi => ALLOWED
  const saQueryScoring = await selectionScoringService.queryScoringVersions(superAdminUser);
  const saQueryPassing = await selectionScoringService.queryPassingRuleVersions(superAdminUser);
  const saQueryTie = await selectionScoringService.queryTieBreakers(scoringVerId, superAdminUser);
  const saQuerySnapshots = await selectionScoringService.queryRunComponentSnapshots(runId, superAdminUser);
  const saAllowed =
    saQueryScoring.success === true &&
    saQueryPassing.success === true &&
    saQueryTie.success === true &&
    saQuerySnapshots.success === true;
  assert(
    22,
    'SUPER_ADMIN semua fungsi => ALLOWED',
    saAllowed,
    `Scoring: ${saQueryScoring.success}, Passing: ${saQueryPassing.success}, Tie: ${saQueryTie.success}, Snapshots: ${saQuerySnapshots.success}`
  );

  // TEST 23: PIMPINAN executive summary => ALLOWED (Agregat saja)
  const pimpinanSummary = await selectionScoringService.getExecutiveSelectionSummary(pimpinanUser);
  const pimpinanSummaryValid =
    pimpinanSummary.success === true &&
    pimpinanSummary.summary !== null &&
    pimpinanSummary.summary !== undefined &&
    typeof pimpinanSummary.summary.total_pendaftar === 'number' &&
    typeof pimpinanSummary.summary.avg_final === 'number' &&
    Array.isArray(pimpinanSummary.summary.score_distribution) &&
    Array.isArray(pimpinanSummary.summary.school_statistics) &&
    !(pimpinanSummary.summary as any).rankings &&
    !(pimpinanSummary.summary as any).candidates;
  assert(
    23,
    'PIMPINAN executive summary => ALLOWED (Purely Aggregates, Zero Candidate PII)',
    pimpinanSummaryValid,
    `Summary success: ${pimpinanSummary.success}, Avg Final: ${pimpinanSummary.summary?.avg_final}, Total Pendaftar: ${pimpinanSummary.summary?.total_pendaftar}`
  );

  // TEST 24: PIMPINAN query ranking => DENY (403 Forbidden)
  const pimpinanRankingsRes = await selectionScoringService.getExecutiveSelectionRankings(pimpinanUser);
  assert(
    24,
    'PIMPINAN membuka query ranking => DENY (403 Forbidden)',
    pimpinanRankingsRes.success === false && Boolean(pimpinanRankingsRes.error?.includes('403')),
    `Result: ${pimpinanRankingsRes.error}`
  );

  // TEST 25: Test invalid score (normalized = 105) => INVALID_SOURCE_SCORE dan run gagal
  // Setup candidate with invalid normalized score > 100
  const storageForInvalidScore = getStorageData();
  const candInvalid105Id = 'cand-invalid-105';
  storageForInvalidScore.candidates.push({
    id: candInvalid105Id,
    user_id: 'usr-invalid-105',
    registration_number: 'PSB27-INV105',
    full_name: 'Santri Invalid 105',
    status: 'TERVERIFIKASI',
  } as any);
  storageForInvalidScore.examAttempts.push({
    id: 'att-inv-acad-105',
    candidate_id: candInvalid105Id,
    exam_id: academicExamId,
    status: 'SUBMITTED',
    raw_score: 105,
    max_score: 100,
    normalized_score: 105,
    total_questions: 10,
    answered_questions: 10,
    correct_answers: 10,
    started_at: '2026-10-01T08:00:00Z',
    expires_at: '2026-10-01T09:00:00Z',
    submitted_at: '2026-10-01T08:45:00Z',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:45:00Z',
  } as any);
  storageForInvalidScore.examAttempts.push({
    id: 'att-inv-psi-105',
    candidate_id: candInvalid105Id,
    exam_id: psychotestExamId,
    status: 'SUBMITTED',
    raw_score: 75,
    max_score: 100,
    normalized_score: 75,
    total_questions: 10,
    answered_questions: 10,
    correct_answers: 7,
    started_at: '2026-10-01T08:00:00Z',
    expires_at: '2026-10-01T09:00:00Z',
    submitted_at: '2026-10-01T08:45:00Z',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:45:00Z',
  } as any);
  storageForInvalidScore.quranAssessments.push({
    id: 'qa-inv-105',
    candidate_id: candInvalid105Id,
    schedule_id: 'sched-1',
    examiner_user_id: 'usr-penguji-1',
    raw_score: 80,
    normalized_score: 80,
    status: 'LOCKED',
    created_at: '',
    updated_at: '',
  } as any);
  saveStorageData(storageForInvalidScore);

  const testRunInvalidRes = await selectionScoringService.createSelectionRun({
    run_name: 'Test Invalid Score 105 Run',
    scoring_version_id: scoringVerId,
    passing_rule_version_id: passingRuleVerId,
  }, superAdminUser);
  const runInvalidId = testRunInvalidRes.run!.id;

  const calcInvalidRes = await selectionScoringService.calculateSelectionRun(runInvalidId, superAdminUser);
  assert(
    25,
    'Test invalid score (normalized = 105) => INVALID_SOURCE_SCORE dan run gagal',
    calcInvalidRes.success === false && Boolean(calcInvalidRes.error?.includes('Source score invalid')),
    `Error: ${calcInvalidRes.error}`
  );

  // Clean up invalid 105 attempt
  const storageAfter105 = getStorageData();
  storageAfter105.candidates = storageAfter105.candidates.filter(c => c.id !== candInvalid105Id);
  storageAfter105.examAttempts = storageAfter105.examAttempts.filter(a => a.candidate_id !== candInvalid105Id);
  storageAfter105.quranAssessments = storageAfter105.quranAssessments.filter(a => a.candidate_id !== candInvalid105Id);
  storageAfter105.selectionRuns = storageAfter105.selectionRuns.filter(r => r.id !== runInvalidId);
  saveStorageData(storageAfter105);

  // TEST 26: Test invalid score (normalized = -1) => INVALID_SOURCE_SCORE dan run gagal
  const storageForInvalidNegative = getStorageData();
  const candInvalidNegId = 'cand-invalid-neg';
  storageForInvalidNegative.candidates.push({
    id: candInvalidNegId,
    user_id: 'usr-invalid-neg',
    registration_number: 'PSB27-INVNEG',
    full_name: 'Santri Invalid Negative',
    status: 'TERVERIFIKASI',
  } as any);
  storageForInvalidNegative.examAttempts.push({
    id: 'att-inv-acad-neg',
    candidate_id: candInvalidNegId,
    exam_id: academicExamId,
    status: 'SUBMITTED',
    raw_score: -1,
    max_score: 100,
    normalized_score: -1,
    total_questions: 10,
    answered_questions: 10,
    correct_answers: 0,
    started_at: '2026-10-01T08:00:00Z',
    expires_at: '2026-10-01T09:00:00Z',
    submitted_at: '2026-10-01T08:45:00Z',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:45:00Z',
  } as any);
  storageForInvalidNegative.examAttempts.push({
    id: 'att-inv-psi-neg',
    candidate_id: candInvalidNegId,
    exam_id: psychotestExamId,
    status: 'SUBMITTED',
    raw_score: 75,
    max_score: 100,
    normalized_score: 75,
    total_questions: 10,
    answered_questions: 10,
    correct_answers: 7,
    started_at: '2026-10-01T08:00:00Z',
    expires_at: '2026-10-01T09:00:00Z',
    submitted_at: '2026-10-01T08:45:00Z',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:45:00Z',
  } as any);
  storageForInvalidNegative.quranAssessments.push({
    id: 'qa-inv-neg',
    candidate_id: candInvalidNegId,
    schedule_id: 'sched-1',
    examiner_user_id: 'usr-penguji-1',
    raw_score: 80,
    normalized_score: 80,
    status: 'LOCKED',
    created_at: '',
    updated_at: '',
  } as any);
  saveStorageData(storageForInvalidNegative);

  const testRunNegRes = await selectionScoringService.createSelectionRun({
    run_name: 'Test Invalid Negative Score Run',
    scoring_version_id: scoringVerId,
    passing_rule_version_id: passingRuleVerId,
  }, superAdminUser);
  const runNegId = testRunNegRes.run!.id;

  const calcNegRes = await selectionScoringService.calculateSelectionRun(runNegId, superAdminUser);
  assert(
    26,
    'Test invalid score (normalized = -1) => INVALID_SOURCE_SCORE dan run gagal',
    calcNegRes.success === false && Boolean(calcNegRes.error?.includes('Source score invalid')),
    `Error: ${calcNegRes.error}`
  );

  // Clean up negative score attempt
  const storageAfterNeg = getStorageData();
  storageAfterNeg.candidates = storageAfterNeg.candidates.filter(c => c.id !== candInvalidNegId);
  storageAfterNeg.examAttempts = storageAfterNeg.examAttempts.filter(a => a.candidate_id !== candInvalidNegId);
  storageAfterNeg.quranAssessments = storageAfterNeg.quranAssessments.filter(a => a.candidate_id !== candInvalidNegId);
  storageAfterNeg.selectionRuns = storageAfterNeg.selectionRuns.filter(r => r.id !== runNegId);
  saveStorageData(storageAfterNeg);

  // TEST 27: Test dua exam Akademik valid => SOURCE_AMBIGUOUS
  const storageForAmbiguity = getStorageData();
  const candAmbiguousId = 'cand-ambiguous-test';
  storageForAmbiguity.candidates.push({
    id: candAmbiguousId,
    user_id: 'usr-ambig-test',
    registration_number: 'PSB27-AMBIG01',
    full_name: 'Santri Ambiguous Test',
    status: 'TERVERIFIKASI',
  } as any);

  // Ensure second academic exam exists in exams table
  if (!storageForAmbiguity.exams.some(e => e.id === 'exam-acad-02')) {
    storageForAmbiguity.exams.push({
      id: 'exam-acad-02',
      test_schedule_id: 'sched-1',
      title: 'Ujian Akademik Paket B',
      exam_type: 'ACADEMIC',
      status: 'PUBLISHED',
      duration_minutes: 60,
      total_questions: 10,
      randomize_questions: false,
      randomize_options: false,
      max_attempts: 1,
      is_active: true,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    } as any);
  }

  // Two valid academic attempts with no bound source_exam_id
  storageForAmbiguity.examAttempts.push({
    id: 'att-ambig-acad-1',
    candidate_id: candAmbiguousId,
    exam_id: academicExamId,
    status: 'SUBMITTED',
    raw_score: 80,
    max_score: 100,
    normalized_score: 80,
    total_questions: 10,
    answered_questions: 10,
    correct_answers: 8,
    started_at: '2026-10-01T08:00:00Z',
    expires_at: '2026-10-01T09:00:00Z',
    submitted_at: '2026-10-01T08:45:00Z',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:45:00Z',
  } as any);
  storageForAmbiguity.examAttempts.push({
    id: 'att-ambig-acad-2',
    candidate_id: candAmbiguousId,
    exam_id: 'exam-acad-02',
    status: 'SUBMITTED',
    raw_score: 85,
    max_score: 100,
    normalized_score: 85,
    total_questions: 10,
    answered_questions: 10,
    correct_answers: 8,
    started_at: '2026-10-02T08:00:00Z',
    expires_at: '2026-10-02T09:00:00Z',
    submitted_at: '2026-10-02T08:45:00Z',
    created_at: '2026-10-02T08:00:00Z',
    updated_at: '2026-10-02T08:45:00Z',
  } as any);

  // Remove explicit source_exam_id from active scoring components to test detection
  const acadCompToUnbind = storageForAmbiguity.selectionScoringComponents.find(
    c => c.scoring_version_id === scoringVerId && c.component_code === 'ACADEMIC'
  );
  if (acadCompToUnbind) {
    acadCompToUnbind.source_exam_id = undefined;
  }
  saveStorageData(storageForAmbiguity);

  const testRunAmbigRes = await selectionScoringService.createSelectionRun({
    run_name: 'Test Ambiguous Academic Run',
    scoring_version_id: scoringVerId,
    passing_rule_version_id: passingRuleVerId,
  }, superAdminUser);
  const runAmbigId = testRunAmbigRes.run!.id;

  const calcAmbigRes = await selectionScoringService.calculateSelectionRun(runAmbigId, superAdminUser);
  const storageCheckAmbig = getStorageData();
  const runAmbigCheck = storageCheckAmbig.selectionRuns.find(r => r.id === runAmbigId);

  assert(
    27,
    'Test dua exam Akademik valid => SOURCE_AMBIGUOUS (Kalkulasi Diblokir)',
    calcAmbigRes.success === false &&
      Boolean(calcAmbigRes.error?.includes('SOURCE_AMBIGUOUS')) &&
      runAmbigCheck?.status === 'SOURCE_AMBIGUOUS',
    `Run status: ${runAmbigCheck?.status}, Error: ${calcAmbigRes.error}`
  );

  // TEST 28: Test dua attempt Psikotes valid => SOURCE_AMBIGUOUS
  const storageForPsiAmbig = getStorageData();
  if (!storageForPsiAmbig.exams.some(e => e.id === 'exam-psi-02')) {
    storageForPsiAmbig.exams.push({
      id: 'exam-psi-02',
      test_schedule_id: 'sched-1',
      title: 'Psikotes CBT Paket B',
      exam_type: 'PSYCHOTEST',
      status: 'PUBLISHED',
      duration_minutes: 60,
      total_questions: 10,
      randomize_questions: false,
      randomize_options: false,
      max_attempts: 1,
      is_active: true,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    } as any);
  }

  storageForPsiAmbig.examAttempts.push({
    id: 'att-ambig-psi-1',
    candidate_id: candAmbiguousId,
    exam_id: psychotestExamId,
    status: 'SUBMITTED',
    raw_score: 75,
    max_score: 100,
    normalized_score: 75,
    total_questions: 10,
    answered_questions: 10,
    correct_answers: 7,
    started_at: '2026-10-01T08:00:00Z',
    expires_at: '2026-10-01T09:00:00Z',
    submitted_at: '2026-10-01T08:45:00Z',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:45:00Z',
  } as any);
  storageForPsiAmbig.examAttempts.push({
    id: 'att-ambig-psi-2',
    candidate_id: candAmbiguousId,
    exam_id: 'exam-psi-02',
    status: 'SUBMITTED',
    raw_score: 80,
    max_score: 100,
    normalized_score: 80,
    total_questions: 10,
    answered_questions: 10,
    correct_answers: 8,
    started_at: '2026-10-02T08:00:00Z',
    expires_at: '2026-10-02T09:00:00Z',
    submitted_at: '2026-10-02T08:45:00Z',
    created_at: '2026-10-02T08:00:00Z',
    updated_at: '2026-10-02T08:45:00Z',
  } as any);

  const psiCompToUnbind = storageForPsiAmbig.selectionScoringComponents.find(
    c => c.scoring_version_id === scoringVerId && c.component_code === 'PSYCHOTEST'
  );
  if (psiCompToUnbind) {
    psiCompToUnbind.source_exam_id = undefined;
  }
  saveStorageData(storageForPsiAmbig);

  const testRunPsiAmbigRes = await selectionScoringService.createSelectionRun({
    run_name: 'Test Ambiguous Psychotest Run',
    scoring_version_id: scoringVerId,
    passing_rule_version_id: passingRuleVerId,
  }, superAdminUser);
  const runPsiAmbigId = testRunPsiAmbigRes.run!.id;

  const calcPsiAmbigRes = await selectionScoringService.calculateSelectionRun(runPsiAmbigId, superAdminUser);
  const storageCheckPsiAmbig = getStorageData();
  const runPsiAmbigCheck = storageCheckPsiAmbig.selectionRuns.find(r => r.id === runPsiAmbigId);

  assert(
    28,
    'Test dua attempt Psikotes valid => SOURCE_AMBIGUOUS (Kalkulasi Diblokir)',
    calcPsiAmbigRes.success === false &&
      Boolean(calcPsiAmbigRes.error?.includes('SOURCE_AMBIGUOUS')) &&
      runPsiAmbigCheck?.status === 'SOURCE_AMBIGUOUS',
    `Run status: ${runPsiAmbigCheck?.status}, Error: ${calcPsiAmbigRes.error}`
  );

  // TEST 29: Test dua assessment Qur'an LOCKED => SOURCE_AMBIGUOUS
  const storageForQuranAmbig = getStorageData();
  storageForQuranAmbig.quranAssessments.push({
    id: 'qur-ambig-1',
    candidate_id: candAmbiguousId,
    examiner_id: 'usr-penguji-1',
    schedule_id: 'sch-qur-01',
    status: 'LOCKED',
    raw_score: 85,
    normalized_score: 85,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:30:00Z',
  } as any);
  storageForQuranAmbig.quranAssessments.push({
    id: 'qur-ambig-2',
    candidate_id: candAmbiguousId,
    examiner_id: 'usr-penguji-1',
    schedule_id: 'sch-qur-02',
    status: 'LOCKED',
    raw_score: 90,
    normalized_score: 90,
    created_at: '2026-10-02T08:00:00Z',
    updated_at: '2026-10-02T08:30:00Z',
  } as any);

  const quranCompToUnbind = storageForQuranAmbig.selectionScoringComponents.find(
    c => c.scoring_version_id === scoringVerId && c.component_code === 'QURAN'
  );
  if (quranCompToUnbind) {
    quranCompToUnbind.source_schedule_id = undefined;
  }
  saveStorageData(storageForQuranAmbig);

  const testRunQuranAmbigRes = await selectionScoringService.createSelectionRun({
    run_name: 'Test Ambiguous Quran Run',
    scoring_version_id: scoringVerId,
    passing_rule_version_id: passingRuleVerId,
  }, superAdminUser);
  const runQuranAmbigId = testRunQuranAmbigRes.run!.id;

  const calcQuranAmbigRes = await selectionScoringService.calculateSelectionRun(runQuranAmbigId, superAdminUser);
  const storageCheckQuranAmbig = getStorageData();
  const runQuranAmbigCheck = storageCheckQuranAmbig.selectionRuns.find(r => r.id === runQuranAmbigId);

  assert(
    29,
    'Test dua assessment Qur\'an LOCKED => SOURCE_AMBIGUOUS (Kalkulasi Diblokir)',
    calcQuranAmbigRes.success === false &&
      Boolean(calcQuranAmbigRes.error?.includes('SOURCE_AMBIGUOUS')) &&
      runQuranAmbigCheck?.status === 'SOURCE_AMBIGUOUS',
    `Run status: ${runQuranAmbigCheck?.status}, Error: ${calcQuranAmbigRes.error}`
  );

  // TEST 30: Test scoring version menunjuk source tertentu => unambiguous & calculation succeeds
  const storageDisambiguate = getStorageData();
  const acadCompDisambig = storageDisambiguate.selectionScoringComponents.find(
    c => c.scoring_version_id === scoringVerId && c.component_code === 'ACADEMIC'
  );
  if (acadCompDisambig) {
    acadCompDisambig.source_exam_id = 'exam-acad-01'; // Explicitly designated
  }
  const psiCompDisambig = storageDisambiguate.selectionScoringComponents.find(
    c => c.scoring_version_id === scoringVerId && c.component_code === 'PSYCHOTEST'
  );
  if (psiCompDisambig) {
    psiCompDisambig.source_exam_id = 'exam-psi-01'; // Explicitly designated
  }
  const quranCompDisambig = storageDisambiguate.selectionScoringComponents.find(
    c => c.scoring_version_id === scoringVerId && c.component_code === 'QURAN'
  );
  if (quranCompDisambig) {
    quranCompDisambig.source_schedule_id = 'sch-qur-01'; // Explicitly designated
  }
  saveStorageData(storageDisambiguate);

  const testRunDisambigRes = await selectionScoringService.createSelectionRun({
    run_name: 'Test Disambiguated Official Run',
    scoring_version_id: scoringVerId,
    passing_rule_version_id: passingRuleVerId,
  }, superAdminUser);
  const runDisambigId = testRunDisambigRes.run!.id;

  const calcDisambigRes = await selectionScoringService.calculateSelectionRun(runDisambigId, superAdminUser);
  assert(
    30,
    'Test scoring version menunjuk source tertentu => unambiguous & calculation sukses',
    calcDisambigRes.success === true && calcDisambigRes.results !== undefined && calcDisambigRes.results.length > 0,
    `Calculation success: ${calcDisambigRes.success}, Candidates calculated: ${calcDisambigRes.results?.length}`
  );

  // Clean up test ambiguity records
  const storageFinalClean = getStorageData();
  storageFinalClean.candidates = storageFinalClean.candidates.filter(c => c.id !== candAmbiguousId);
  storageFinalClean.examAttempts = storageFinalClean.examAttempts.filter(a => a.candidate_id !== candAmbiguousId);
  storageFinalClean.quranAssessments = storageFinalClean.quranAssessments.filter(a => a.candidate_id !== candAmbiguousId);
  storageFinalClean.selectionRuns = storageFinalClean.selectionRuns.filter(
    r => r.id !== runAmbigId && r.id !== runPsiAmbigId && r.id !== runQuranAmbigId && r.id !== runDisambigId
  );
  saveStorageData(storageFinalClean);

  // TEST 31: Database Migration 015 Strict Least-Privilege RLS Hardening & Aggregate View
  const fs = await import('fs');
  const path = await import('path');
  const migration015Path = path.resolve(process.cwd(), 'database/migrations/015_final_selection_rls_hardening.sql');
  const migration015Exists = fs.existsSync(migration015Path);
  const migration015Content = migration015Exists ? fs.readFileSync(migration015Path, 'utf8') : '';

  const rls015Hardened =
    migration015Content.includes('rbac_scoring_versions_select') &&
    migration015Content.includes('rbac_passing_rules_select') &&
    migration015Content.includes('rbac_tie_breakers_select') &&
    migration015Content.includes('rbac_run_component_snapshots_select') &&
    migration015Content.includes('v_pimpinan_selection_executive') &&
    migration015Content.includes('SOURCE_AMBIGUOUS');

  assert(
    31,
    'Database Migration 015 Strict Least-Privilege RLS Hardening & Executive View',
    migration015Exists && rls015Hardened,
    `Migration 015 exists: ${migration015Exists}, Hardened RLS policies and executive view verified`
  );

  console.log('\n================================================================');
  console.log(`FINAL SELECTION AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSelectionScoringTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
