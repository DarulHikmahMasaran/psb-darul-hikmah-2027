import {
  SelectionScoringVersion,
  SelectionScoringComponent,
  SelectionPassingRuleVersion,
  SelectionTieBreaker
} from '../types/selection';

export const defaultScoringVersionId = 'sc-ver-2027-v1';
export const defaultPassingRuleVersionId = 'pr-ver-2027-v1';

export const defaultSelectionScoringVersions: SelectionScoringVersion[] = [
  {
    id: defaultScoringVersionId,
    version_name: 'Konfigurasi Bobot Seleksi TP 2027/2028 (Resmi 40/35/25)',
    academic_year: '2027/2028',
    status: 'APPROVED',
    notes: 'Bobot resmi: Tes Akademik 40%, Tes Al-Qur\'an 35%, Psikotes 25% (Total tepat 100.00%). Disahkan panitia & pimpinan.',
    created_by: 'usr-admin-1',
    created_at: new Date('2026-10-01T08:00:00Z').toISOString(),
    approved_by: 'usr-admin-1',
    approved_at: new Date('2026-10-01T09:00:00Z').toISOString(),
  },
];

export const defaultSelectionScoringComponents: SelectionScoringComponent[] = [
  {
    id: 'ssc-2027-acad',
    scoring_version_id: defaultScoringVersionId,
    component_code: 'ACADEMIC',
    weight: 40.00,
    source_exam_id: 'exam-cbt-1',
    created_at: new Date('2026-10-01T08:00:00Z').toISOString(),
  },
  {
    id: 'ssc-2027-quran',
    scoring_version_id: defaultScoringVersionId,
    component_code: 'QURAN',
    weight: 35.00,
    source_schedule_id: 'sched-1',
    created_at: new Date('2026-10-01T08:00:00Z').toISOString(),
  },
  {
    id: 'ssc-2027-psi',
    scoring_version_id: defaultScoringVersionId,
    component_code: 'PSYCHOTEST',
    weight: 25.00,
    source_exam_id: 'exam-psi-cbt-1',
    created_at: new Date('2026-10-01T08:00:00Z').toISOString(),
  },
];

export const defaultSelectionPassingRuleVersions: SelectionPassingRuleVersion[] = [
  {
    id: defaultPassingRuleVersionId,
    version_name: 'Standar Kelulusan Minimal PSB TP 2027/2028',
    academic_year: '2027/2028',
    min_academic: 65.00,
    min_quran: 70.00,
    min_psychotest: 60.00,
    min_final_score: 65.00,
    status: 'APPROVED',
    notes: 'Kriteria kelayakan standar minimal: Akademik >= 65, Qur\'an >= 70, Psikotes >= 60, Nilai Akhir >= 65.',
    created_by: 'usr-admin-1',
    created_at: new Date('2026-10-01T08:30:00Z').toISOString(),
    approved_by: 'usr-admin-1',
    approved_at: new Date('2026-10-01T09:30:00Z').toISOString(),
  },
];

export const defaultSelectionTieBreakers: SelectionTieBreaker[] = [
  {
    id: 'tb-1',
    scoring_version_id: defaultScoringVersionId,
    priority: 1,
    rule_code: 'FINAL_SCORE',
    direction: 'DESC',
    created_at: new Date('2026-10-01T08:00:00Z').toISOString(),
  },
  {
    id: 'tb-2',
    scoring_version_id: defaultScoringVersionId,
    priority: 2,
    rule_code: 'ACADEMIC_SCORE',
    direction: 'DESC',
    created_at: new Date('2026-10-01T08:00:00Z').toISOString(),
  },
  {
    id: 'tb-3',
    scoring_version_id: defaultScoringVersionId,
    priority: 3,
    rule_code: 'QURAN_SCORE',
    direction: 'DESC',
    created_at: new Date('2026-10-01T08:00:00Z').toISOString(),
  },
  {
    id: 'tb-4',
    scoring_version_id: defaultScoringVersionId,
    priority: 4,
    rule_code: 'PSYCHOTEST_SCORE',
    direction: 'DESC',
    created_at: new Date('2026-10-01T08:00:00Z').toISOString(),
  },
];
