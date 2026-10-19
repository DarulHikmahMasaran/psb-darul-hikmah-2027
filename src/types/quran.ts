import { Candidate, TestSchedule, Profile, AttendanceStatus } from './database';

export type QuranAssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type QuranAssessmentStatus = 
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'LOCKED'
  | 'NEEDS_REVISION';

export interface QuranRubric {
  id: string;
  code: string; // TAHFIDZ, TAJWID, MAKHARIJUL_HURUF, KELANCARAN, WAQAF_IBTIDA, ADAB, etc.
  name: string;
  description: string;
  min_score: number;
  max_score: number;
  weight: number; // Percentage e.g. 35.00
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuranExaminerAssignment {
  id: string;
  schedule_id: string;
  candidate_id: string;
  examiner_user_id: string;
  assignment_status: QuranAssignmentStatus;
  assigned_at: string;
  assigned_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;

  // Joined metadata
  candidate?: Candidate;
  schedule?: TestSchedule;
  examiner?: Profile;
  assessment?: QuranAssessment;
  attendance_status?: AttendanceStatus;
}

export interface QuranAssessmentRubricSnapshot {
  id: string;
  assessment_id: string;
  rubric_id: string;
  rubric_name_snapshot: string;
  description_snapshot: string;
  min_score_snapshot: number;
  max_score_snapshot: number;
  weight_snapshot: number;
  sort_order: number;
  created_at: string;
}

export interface QuranAssessmentScore {
  id: string;
  assessment_id: string;
  rubric_id: string;
  rubric_name_snapshot: string;
  score: number;
  weight: number;
  weighted_score: number;
  examiner_note?: string;
  created_at: string;
  updated_at: string;
}

export interface QuranAssessment {
  id: string;
  schedule_id: string;
  candidate_id: string;
  examiner_user_id: string;
  status: QuranAssessmentStatus;
  started_at?: string;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  raw_score: number;
  normalized_score: number;
  surah_name?: string;
  ayat_range?: string;
  juz_tested?: string;
  reading_notes?: string;
  notes?: string;
  revision_notes?: string;
  created_at: string;
  updated_at: string;

  // Joined metadata
  candidate?: Candidate;
  schedule?: TestSchedule;
  examiner?: Profile;
  reviewer?: Profile;
  scores?: QuranAssessmentScore[];
  snapshots?: QuranAssessmentRubricSnapshot[];
}

export interface SaveQuranAssessmentPayload {
  surah_name?: string;
  ayat_range?: string;
  juz_tested?: string;
  reading_notes?: string;
  notes?: string;
  scores: Array<{
    rubric_id: string;
    score: number;
    examiner_note?: string;
  }>;
}

export interface QuranScoringCalculation {
  scores: Array<{
    rubric_id: string;
    rubric_name: string;
    score: number;
    weight: number;
    weighted_score: number;
    examiner_note?: string;
  }>;
  raw_score: number;
  normalized_score: number;
  total_weight: number;
}
