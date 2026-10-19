import { Candidate } from './database';

export type SelectionComponentCode = 'ACADEMIC' | 'QURAN' | 'PSYCHOTEST';

export type VersionStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED';

export interface SelectionScoringComponent {
  id: string;
  scoring_version_id: string;
  component_code: SelectionComponentCode;
  weight: number; // e.g. 40.00, 35.00, 25.00 (sum must equal 100.00)
  source_exam_id?: string; // Required for ACADEMIC and PSYCHOTEST
  source_schedule_id?: string; // Optional/required for QURAN
  created_at: string;
}

export interface SelectionScoringVersion {
  id: string;
  version_name: string;
  academic_year: string;
  status: VersionStatus;
  notes?: string;
  created_by?: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  components?: SelectionScoringComponent[];
}

export interface SelectionPassingRuleVersion {
  id: string;
  version_name: string;
  academic_year: string;
  min_academic: number | null; // NULL means not applied
  min_quran: number | null; // NULL means not applied
  min_psychotest: number | null; // NULL means not applied
  min_final_score: number | null; // NULL means not applied
  status: VersionStatus;
  notes?: string;
  created_by?: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

export type SelectionTieBreakerRule =
  | 'FINAL_SCORE'
  | 'ACADEMIC_SCORE'
  | 'QURAN_SCORE'
  | 'PSYCHOTEST_SCORE'
  | 'REGISTRATION_TIMESTAMP';

export interface SelectionTieBreaker {
  id: string;
  scoring_version_id?: string;
  priority: number; // 1, 2, 3, 4, ...
  rule_code: SelectionTieBreakerRule;
  direction: 'DESC' | 'ASC';
  created_at: string;
}

export type SelectionRunStatus =
  | 'DRAFT'
  | 'CALCULATING'
  | 'CALCULATED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'SOURCE_AMBIGUOUS';

export interface SelectionRun {
  id: string;
  academic_year: string;
  run_name: string;
  scoring_version_id: string;
  passing_rule_version_id: string;
  quota: number;
  reserve_count: number;
  status: SelectionRunStatus;
  candidate_count: number;
  complete_count: number;
  eligible_count: number;
  lulus_count: number;
  reserve_count_actual: number;
  tidak_lulus_count: number;
  tie_pending_count: number;
  created_by?: string;
  reviewed_by?: string;
  approved_by?: string;
  calculated_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  notes?: string;
  is_current: boolean;
  superseded_by_run_id?: string;
  created_at: string;
  updated_at: string;

  // Enriched snapshot metadata
  scoring_version?: SelectionScoringVersion;
  passing_rule_version?: SelectionPassingRuleVersion;
  component_snapshots?: SelectionRunComponentSnapshot[];
}

export interface SelectionRunComponentSnapshot {
  id: string;
  selection_run_id: string;
  component_code: SelectionComponentCode;
  weight: number;
  min_score: number | null;
  source_exam_id?: string;
  source_schedule_id?: string;
  created_at: string;
}

export type SelectionEligibilityStatus =
  | 'INCOMPLETE'
  | 'ELIGIBLE'
  | 'FAILED_COMPONENT'
  | 'FAILED_FINAL'
  | 'TIE_PENDING';

export type SelectionResultStatus =
  | 'BELUM_DITETAPKAN'
  | 'LULUS'
  | 'CADANGAN'
  | 'TIDAK_LULUS'
  | 'TIE_PENDING';

export interface ComponentFailureDetail {
  component: SelectionComponentCode | 'FINAL';
  score: number;
  minimum: number;
  message: string;
}

export interface SelectionResultComponent {
  id: string;
  selection_result_id: string;
  component_code: SelectionComponentCode;
  source_record_id: string;
  raw_score: number;
  max_score: number;
  normalized_score: number;
  weight: number;
  weighted_score: number;
  source_status: string;
  created_at: string;
}

export interface SelectionResult {
  id: string;
  selection_run_id: string;
  candidate_id: string;
  academic_score: number | null; // normalized 0-100
  quran_score: number | null; // normalized 0-100
  psychotest_score: number | null; // normalized 0-100
  final_score: number | null; // full database precision
  display_final_score: string; // e.g. "82.15"
  calculation_precision: number;
  overall_rank: number | null;
  eligible_rank: number | null;
  eligibility_status: SelectionEligibilityStatus;
  result_status: SelectionResultStatus;
  failure_reasons: ComponentFailureDetail[];
  decision_reason?: string;
  calculated_at: string;
  created_at: string;

  // Joined metadata
  candidate?: Candidate;
  components?: SelectionResultComponent[];
}

export type ComponentSourceStatus = 'OK' | 'MISSING' | 'AMBIGUOUS' | 'INVALID';

export interface CandidateCompletenessStatus {
  candidate_id: string;
  registration_number: string;
  full_name: string;
  academic_status: ComponentSourceStatus;
  quran_status: ComponentSourceStatus;
  psychotest_status: ComponentSourceStatus;
  academic_details?: string;
  quran_details?: string;
  psychotest_details?: string;
}

export interface SelectionCompletenessReport {
  totalCandidates: number;
  hasAcademic: number;
  hasQuran: number;
  hasPsychotest: number;
  completeCount: number;
  incompleteCount: number;
  missingAcademicCount: number;
  missingQuranCount: number;
  missingPsychotestCount: number;
  ambiguousCount: number;
  invalidCount: number;
  sourceAmbiguityWarnings: string[];
  candidateBreakdowns?: CandidateCompletenessStatus[];
}

export interface ExecutiveSelectionSummary {
  run_name: string;
  academic_year: string;
  status: string;
  quota: number;
  reserve_count: number;
  total_pendaftar: number;
  terverifikasi: number;
  nilai_lengkap: number;
  eligible: number;
  lulus: number;
  cadangan: number;
  tidak_lulus: number;
  tie_pending: number;
  avg_academic: number;
  avg_quran: number;
  avg_psychotest: number;
  avg_final: number;
  score_distribution: Array<{
    range: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  school_statistics: Array<{
    school_name: string;
    total_candidates: number;
    lulus_count: number;
    cadangan_count: number;
    tidak_lulus_count: number;
  }>;
  approved_at?: string;
}
