import { Candidate, TestSchedule } from './database';

export type ExamType = 'ACADEMIC' | 'PSYCHOTEST';
export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTIPLE_SELECT' | 'SCALE';
export type QuestionDifficulty = 'MUDAH' | 'SEDANG' | 'SULIT';
export type ExamAttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED' | 'ABANDONED';

export type ExamEventType = 
  | 'EXAM_STARTED'
  | 'QUESTION_VIEWED'
  | 'ANSWER_SAVED'
  | 'TAB_HIDDEN'
  | 'TAB_VISIBLE'
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'RECONNECT'
  | 'HEARTBEAT'
  | 'EXAM_SUBMITTED'
  | 'AUTO_SUBMITTED'
  | 'CONNECTION_LOST'
  | 'CONNECTION_RESTORED';

export interface Subject {
  id: string;
  code: string; // MATEMATIKA, BAHASA_INDONESIA, IPA, PAI, PENGETAHUAN_UMUM, PSIKOTES
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionCategory {
  id: string;
  subject_id: string;
  subject?: Subject;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  option_key: string; // 'A', 'B', 'C', 'D', 'E' or 'BENAR', 'SALAH'
  is_correct: boolean;
  score?: number; // Configurable scoring per option (e.g. A=1, B=0 or A=0, B=2, C=1, D=0)
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  subject_id: string;
  subject?: Subject;
  category_id?: string;
  category?: QuestionCategory;
  sub_category?: string;
  question_text: string;
  image_url?: string; // Visual pattern / geometric matrix for psychotest
  question_type: QuestionType;
  explanation?: string;
  difficulty: QuestionDifficulty;
  points: number;
  is_active: boolean;
  options: QuestionOption[];
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: string;
  test_schedule_id: string;
  test_schedule?: TestSchedule;
  title: string;
  description?: string;
  exam_type?: ExamType;
  duration_minutes: number;
  total_questions: number;
  randomize_questions: boolean;
  randomize_options: boolean;
  max_attempts: number;
  passing_score?: number;
  is_active: boolean;
  show_score_to_candidate?: boolean;
  configs?: ExamQuestionConfig[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ExamQuestionConfig {
  id: string;
  exam_id: string;
  subject_id?: string;
  subject?: Subject;
  category_id?: string;
  category?: QuestionCategory;
  question_count: number;
  points_per_question: number;
  created_at: string;
  updated_at: string;
}

export interface SnapshotOption {
  id: string;
  option_key: string;
  option_text: string;
  sort_order: number;
}

export interface ExamAttemptQuestion {
  id: string;
  attempt_id: string;
  question_id: string;
  category_id?: string;
  category_name_snapshot?: string;
  question_order: number;
  question_text_snapshot: string;
  image_url_snapshot?: string;
  options_snapshot: SnapshotOption[]; // Sanitized: is_correct and score are NOT exposed
  points_snapshot: number;
  created_at: string;
}

export interface ExamAnswer {
  id: string;
  attempt_id: string;
  attempt_question_id: string;
  selected_option_ids: string[];
  answer_text?: string;
  answered_at: string;
  is_marked: boolean;
  updated_at: string;
}

export interface ExamCategoryScore {
  category_id: string;
  category_name: string;
  raw_score: number;
  max_score: number;
  normalized_score: number;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
}

export interface PsychotestScoringConfig {
  id: string;
  category_id: string;
  category_name?: string;
  scoring_model: 'BINARY' | 'WEIGHTED_OPTION' | 'SCALE';
  default_correct_score: number;
  default_wrong_score: number;
  normalization_base: number;
  passing_threshold?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExamScoringSnapshot {
  id: string;
  attempt_id: string;
  exam_id: string;
  category_configs: PsychotestScoringConfig[];
  question_keys: Array<{
    question_id: string;
    category_id: string;
    category_name: string;
    options: Array<{ id: string; option_key: string; is_correct: boolean; score: number }>;
  }>;
  created_at: string;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  exam?: Exam;
  candidate_id: string;
  candidate?: Candidate;
  started_at: string;
  expires_at: string;
  submitted_at?: string;
  status: ExamAttemptStatus;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  raw_score: number;
  max_score: number;
  normalized_score: number;
  category_scores?: ExamCategoryScore[];
  scoring_snapshot?: ExamScoringSnapshot;
  created_at: string;
  updated_at: string;
}

export interface ExamEvent {
  id: string;
  attempt_id: string;
  event_type: ExamEventType;
  metadata?: Record<string, any>;
  created_at: string;
}
