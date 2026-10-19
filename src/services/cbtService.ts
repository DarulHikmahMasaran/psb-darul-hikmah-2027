import {
  Subject,
  QuestionCategory,
  Question,
  QuestionType,
  QuestionOption,
  Exam,
  ExamType,
  ExamQuestionConfig,
  ExamAttempt,
  ExamAttemptQuestion,
  ExamAnswer,
  ExamEvent,
  ExamEventType,
  ExamCategoryScore,
  PsychotestScoringConfig,
  ExamScoringSnapshot
} from '../types/cbt';
import { Candidate, CandidateStatus, TestSchedule } from '../types/database';
import { getStorageData, saveStorageData } from '../lib/storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { auditService } from './auditService';

export interface CsvImportRowError {
  row: number;
  error: string;
  rawData?: any;
}

export interface CsvImportResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: CsvImportRowError[];
  validQuestions: Question[];
}

export interface CandidateExamAccessResult {
  allowed: boolean;
  reason?: string;
  exam?: Exam;
  candidate?: Candidate;
  schedule?: TestSchedule;
  attempt?: ExamAttempt;
}

export interface ActiveExamSession {
  attempt: ExamAttempt;
  exam: Exam;
  questions: ExamAttemptQuestion[];
  answers: Record<string, ExamAnswer>; // attempt_question_id -> ExamAnswer
  serverTime: string;
  remainingSeconds: number;
}

class CbtService {
  // ==========================================================================
  // 1. SUBJECTS & CATEGORIES
  // ==========================================================================

  async getSubjects(): Promise<Subject[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .order('sort_order', { ascending: true });
        if (!error && data) return data as Subject[];
      } catch (e) {
        console.warn('Fallback to local storage for subjects', e);
      }
    }
    const data = getStorageData();
    return [...data.subjects].sort((a, b) => a.sort_order - b.sort_order);
  }

  async getCategories(subjectId?: string): Promise<QuestionCategory[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('question_categories').select('*, subject:subjects(*)');
        if (subjectId) {
          query = query.eq('subject_id', subjectId);
        }
        const { data, error } = await query;
        if (!error && data) return data as QuestionCategory[];
      } catch (e) {
        console.warn('Fallback to local storage for categories', e);
      }
    }
    const data = getStorageData();
    let cats = data.questionCategories;
    if (subjectId) {
      cats = cats.filter(c => c.subject_id === subjectId);
    }
    return cats.map(c => ({
      ...c,
      subject: data.subjects.find(s => s.id === c.subject_id),
    }));
  }

  // ==========================================================================
  // 2. QUESTION BANK MANAGEMENT
  // ==========================================================================

  async getQuestions(filters?: {
    subject_id?: string;
    category_id?: string;
    difficulty?: string;
    is_active?: boolean;
    search?: string;
  }): Promise<Question[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase
          .from('questions')
          .select(`
            *,
            subject:subjects(*),
            category:question_categories(*),
            options:question_options(*)
          `)
          .order('created_at', { ascending: false });

        if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id);
        if (filters?.category_id) query = query.eq('category_id', filters.category_id);
        if (filters?.difficulty) query = query.eq('difficulty', filters.difficulty);
        if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);
        if (filters?.search) {
          query = query.ilike('question_text', `%${filters.search}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data as Question[];
        }
      } catch (e) {
        console.warn('Fallback to local storage for questions', e);
      }
    }

    const data = getStorageData();
    let result = data.questions.map(q => {
      const qOptions = data.questionOptions.filter(o => o.question_id === q.id);
      return {
        ...q,
        subject: data.subjects.find(s => s.id === q.subject_id),
        category: data.questionCategories.find(c => c.id === q.category_id),
        options: qOptions.sort((a, b) => a.sort_order - b.sort_order),
      };
    });

    if (filters?.subject_id) {
      result = result.filter(q => q.subject_id === filters.subject_id);
    }
    if (filters?.category_id) {
      result = result.filter(q => q.category_id === filters.category_id);
    }
    if (filters?.difficulty) {
      result = result.filter(q => q.difficulty === filters.difficulty);
    }
    if (filters?.is_active !== undefined) {
      result = result.filter(q => q.is_active === filters.is_active);
    }
    if (filters?.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(
        q =>
          q.question_text.toLowerCase().includes(term) ||
          q.subject?.name.toLowerCase().includes(term) ||
          q.category?.name.toLowerCase().includes(term)
      );
    }

    return result;
  }

  async getQuestionById(id: string): Promise<Question | null> {
    const list = await this.getQuestions();
    return list.find(q => q.id === id) || null;
  }

  async createQuestion(payload: {
    subject_id: string;
    category_id?: string;
    question_text: string;
    question_type: QuestionType;
    explanation?: string;
    difficulty: 'MUDAH' | 'SEDANG' | 'SULIT';
    points: number;
    is_active?: boolean;
    options: Array<{
      option_key: string;
      option_text: string;
      is_correct: boolean;
      sort_order?: number;
    }>;
    created_by?: string;
  }): Promise<{ success: boolean; question?: Question; error?: string }> {
    // Validation
    if (!payload.question_text.trim()) {
      return { success: false, error: 'Pertanyaan soal wajib diisi.' };
    }
    if (!payload.subject_id) {
      return { success: false, error: 'Mata pelajaran wajib dipilih.' };
    }
    if (payload.points <= 0) {
      return { success: false, error: 'Bobot poin soal harus lebih dari 0.' };
    }
    if (!payload.options || payload.options.length < 2) {
      return { success: false, error: 'Soal minimal harus memiliki 2 pilihan jawaban.' };
    }

    // Validate correct answer
    const correctCount = payload.options.filter(o => o.is_correct).length;
    if (payload.question_type === 'MULTIPLE_CHOICE' && correctCount !== 1) {
      return { success: false, error: 'Pilihan ganda (Multiple Choice) harus memiliki tepat 1 kunci jawaban benar.' };
    }
    if (payload.question_type === 'TRUE_FALSE' && correctCount !== 1) {
      return { success: false, error: 'Soal Benar/Salah harus memiliki tepat 1 jawaban benar.' };
    }

    const questionId = 'q-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const createdOptions: QuestionOption[] = payload.options.map((opt, idx) => ({
      id: 'opt-' + Date.now() + '-' + idx,
      question_id: questionId,
      option_key: opt.option_key,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
      sort_order: opt.sort_order ?? idx + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const newQuestion: Question = {
      id: questionId,
      subject_id: payload.subject_id,
      category_id: payload.category_id || undefined,
      question_text: payload.question_text.trim(),
      question_type: payload.question_type,
      explanation: payload.explanation?.trim() || undefined,
      difficulty: payload.difficulty,
      points: Number(payload.points),
      is_active: payload.is_active ?? true,
      options: createdOptions,
      created_by: payload.created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error: qErr } = await supabase.from('questions').insert({
          id: newQuestion.id,
          subject_id: newQuestion.subject_id,
          category_id: newQuestion.category_id,
          question_text: newQuestion.question_text,
          question_type: newQuestion.question_type,
          explanation: newQuestion.explanation,
          difficulty: newQuestion.difficulty,
          points: newQuestion.points,
          is_active: newQuestion.is_active,
          created_by: newQuestion.created_by,
        });

        if (!qErr) {
          const { error: optErr } = await supabase.from('question_options').insert(
            createdOptions.map(o => ({
              id: o.id,
              question_id: o.question_id,
              option_key: o.option_key,
              option_text: o.option_text,
              is_correct: o.is_correct,
              sort_order: o.sort_order,
            }))
          );

          if (!optErr) {
            await auditService.logAction({
              action: 'CREATE_QUESTION',
              entityType: 'CBT_QUESTION',
              entityId: newQuestion.id,
              newValue: { subject_id: newQuestion.subject_id, difficulty: newQuestion.difficulty },
            });
            return { success: true, question: newQuestion };
          }
        }
      } catch (e) {
        console.warn('Fallback saving question to local storage', e);
      }
    }

    const data = getStorageData();
    data.questions.unshift(newQuestion);
    data.questionOptions.push(...createdOptions);
    saveStorageData(data);

    await auditService.logAction({
      action: 'CREATE_QUESTION',
      entityType: 'CBT_QUESTION',
      entityId: newQuestion.id,
      newValue: { subject_id: newQuestion.subject_id, difficulty: newQuestion.difficulty },
    });

    return { success: true, question: newQuestion };
  }

  async updateQuestion(
    id: string,
    payload: {
      subject_id: string;
      category_id?: string;
      question_text: string;
      question_type: QuestionType;
      explanation?: string;
      difficulty: 'MUDAH' | 'SEDANG' | 'SULIT';
      points: number;
      is_active: boolean;
      options: Array<{
        id?: string;
        option_key: string;
        option_text: string;
        is_correct: boolean;
        sort_order?: number;
      }>;
      updated_by?: string;
    }
  ): Promise<{ success: boolean; question?: Question; error?: string }> {
    if (!payload.question_text.trim()) {
      return { success: false, error: 'Pertanyaan soal wajib diisi.' };
    }
    const correctCount = payload.options.filter(o => o.is_correct).length;
    if (payload.question_type === 'MULTIPLE_CHOICE' && correctCount !== 1) {
      return { success: false, error: 'Pilihan ganda harus memiliki tepat 1 kunci jawaban benar.' };
    }

    const data = getStorageData();
    const idx = data.questions.findIndex(q => q.id === id);
    if (idx === -1) {
      return { success: false, error: 'Soal tidak ditemukan.' };
    }

    const updatedOptions: QuestionOption[] = payload.options.map((opt, i) => ({
      id: opt.id || 'opt-' + Date.now() + '-' + i,
      question_id: id,
      option_key: opt.option_key,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
      sort_order: opt.sort_order ?? i + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const updatedQuestion: Question = {
      ...data.questions[idx],
      subject_id: payload.subject_id,
      category_id: payload.category_id || undefined,
      question_text: payload.question_text.trim(),
      question_type: payload.question_type,
      explanation: payload.explanation?.trim() || undefined,
      difficulty: payload.difficulty,
      points: Number(payload.points),
      is_active: payload.is_active,
      updated_by: payload.updated_by,
      updated_at: new Date().toISOString(),
      options: updatedOptions,
    };

    data.questions[idx] = updatedQuestion;
    // Replace options for this question
    data.questionOptions = data.questionOptions.filter(o => o.question_id !== id).concat(updatedOptions);
    saveStorageData(data);

    await auditService.logAction({
      action: 'UPDATE_QUESTION',
      entityType: 'CBT_QUESTION',
      entityId: id,
      newValue: { subject_id: payload.subject_id, points: payload.points },
    });

    return { success: true, question: updatedQuestion };
  }

  async toggleQuestionStatus(id: string, is_active: boolean): Promise<boolean> {
    const data = getStorageData();
    const q = data.questions.find(x => x.id === id);
    if (!q) return false;
    q.is_active = is_active;
    q.updated_at = new Date().toISOString();
    saveStorageData(data);
    return true;
  }

  async deleteQuestion(id: string): Promise<{ success: boolean; error?: string }> {
    const data = getStorageData();
    // Rule: Cannot delete if question has already been used in attempt snapshots
    const isUsedInAttempts = data.examAttemptQuestions.some(aq => aq.question_id === id);
    if (isUsedInAttempts) {
      return {
        success: false,
        error: 'Soal ini tidak dapat dihapus karena sudah memiliki riwayat ujian pendaftar. Anda dapat menonaktifkan status soal agar tidak diacak pada ujian berikutnya.'
      };
    }

    data.questions = data.questions.filter(q => q.id !== id);
    data.questionOptions = data.questionOptions.filter(o => o.question_id !== id);
    saveStorageData(data);

    await auditService.logAction({
      action: 'DELETE_QUESTION',
      entityType: 'CBT_QUESTION',
      entityId: id,
    });

    return { success: true };
  }

  // ==========================================================================
  // 3. IMPORT & EXPORT SOAL CSV
  // ==========================================================================

  parseCsvText(csvText: string): string[][] {
    const lines = csvText.trim().split(/\r?\n/);
    return lines.map(line => {
      const row: string[] = [];
      let inQuote = false;
      let cur = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          row.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      row.push(cur.trim());
      return row;
    });
  }

  async validateAndPreviewCsv(csvText: string): Promise<CsvImportResult> {
    const subjects = await this.getSubjects();
    const subjectCodeMap = new Map(subjects.map(s => [s.code.toUpperCase(), s]));

    const rows = this.parseCsvText(csvText);
    if (rows.length < 2) {
      return {
        totalRows: 0,
        validCount: 0,
        errorCount: 1,
        errors: [{ row: 1, error: 'File CSV kosong atau tidak memiliki baris data soal.' }],
        validQuestions: [],
      };
    }

    // Expected Header:
    // subject_code, category, question, option_a, option_b, option_c, option_d, option_e, correct_answer, difficulty, points
    const header = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const colIndex = {
      subject_code: header.indexOf('subject_code'),
      category: header.indexOf('category'),
      question: header.indexOf('question'),
      option_a: header.indexOf('option_a'),
      option_b: header.indexOf('option_b'),
      option_c: header.indexOf('option_c'),
      option_d: header.indexOf('option_d'),
      option_e: header.indexOf('option_e'),
      correct_answer: header.indexOf('correct_answer'),
      difficulty: header.indexOf('difficulty'),
      points: header.indexOf('points'),
    };

    if (colIndex.subject_code === -1 || colIndex.question === -1 || colIndex.correct_answer === -1) {
      return {
        totalRows: rows.length - 1,
        validCount: 0,
        errorCount: 1,
        errors: [{
          row: 1,
          error: 'Format kolom header tidak sesuai. Kolom wajib: subject_code, category, question, option_a, option_b, option_c, option_d, option_e, correct_answer, difficulty, points'
        }],
        validQuestions: [],
      };
    }

    const errors: CsvImportRowError[] = [];
    const validQuestions: Question[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const rowNum = r + 1; // 1-based human row index

      // Skip completely empty lines
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const subCode = (row[colIndex.subject_code] || '').toUpperCase().trim();
      const catName = colIndex.category !== -1 ? (row[colIndex.category] || '').trim() : '';
      const qText = (row[colIndex.question] || '').trim();
      const optA = colIndex.option_a !== -1 ? (row[colIndex.option_a] || '').trim() : '';
      const optB = colIndex.option_b !== -1 ? (row[colIndex.option_b] || '').trim() : '';
      const optC = colIndex.option_c !== -1 ? (row[colIndex.option_c] || '').trim() : '';
      const optD = colIndex.option_d !== -1 ? (row[colIndex.option_d] || '').trim() : '';
      const optE = colIndex.option_e !== -1 ? (row[colIndex.option_e] || '').trim() : '';
      const correctAns = (row[colIndex.correct_answer] || '').toUpperCase().trim();
      const diffRaw = colIndex.difficulty !== -1 ? (row[colIndex.difficulty] || '').toUpperCase().trim() : 'SEDANG';
      const pointsRaw = colIndex.points !== -1 ? Number(row[colIndex.points]) : 2;

      // Validate subject
      const subject = subjectCodeMap.get(subCode);
      if (!subject) {
        errors.push({
          row: rowNum,
          error: `Baris ${rowNum}: subject_code '${subCode}' tidak valid. Pilihan: MATEMATIKA, BAHASA_INDONESIA, IPA, PAI, PENGETAHUAN_UMUM.`,
        });
        continue;
      }

      // Validate question text
      if (!qText) {
        errors.push({ row: rowNum, error: `Baris ${rowNum}: Kolom pertanyaan tidak boleh kosong.` });
        continue;
      }

      // Validate options
      if (!optA || !optB) {
        errors.push({ row: rowNum, error: `Baris ${rowNum}: Minimal harus memiliki option_a dan option_b.` });
        continue;
      }

      // Options list
      const optionEntries: Array<{ key: string; text: string }> = [
        { key: 'A', text: optA },
        { key: 'B', text: optB },
      ];
      if (optC) optionEntries.push({ key: 'C', text: optC });
      if (optD) optionEntries.push({ key: 'D', text: optD });
      if (optE) optionEntries.push({ key: 'E', text: optE });

      // Validate correct answer
      const validKeys = optionEntries.map(o => o.key);
      if (!validKeys.includes(correctAns)) {
        errors.push({
          row: rowNum,
          error: `Baris ${rowNum}: correct_answer '${correctAns}' tidak valid. Harus sesuai dengan pilihan yang tersedia (${validKeys.join(', ')}).`,
        });
        continue;
      }

      // Validate difficulty
      let difficulty: 'MUDAH' | 'SEDANG' | 'SULIT' = 'SEDANG';
      if (diffRaw === 'MUDAH' || diffRaw === 'SEDANG' || diffRaw === 'SULIT') {
        difficulty = diffRaw;
      }

      // Validate points
      const points = isNaN(pointsRaw) || pointsRaw <= 0 ? 2 : pointsRaw;

      // Construct Question
      const qId = 'q-csv-' + Date.now() + '-' + r;
      const questionOptions: QuestionOption[] = optionEntries.map((o, idx) => ({
        id: `opt-csv-${qId}-${o.key}`,
        question_id: qId,
        option_key: o.key,
        option_text: o.text,
        is_correct: o.key === correctAns,
        sort_order: idx + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const newQ: Question = {
        id: qId,
        subject_id: subject.id,
        subject: subject,
        question_text: qText,
        question_type: 'MULTIPLE_CHOICE',
        difficulty: difficulty,
        points: points,
        is_active: true,
        options: questionOptions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      validQuestions.push(newQ);
    }

    return {
      totalRows: rows.length - 1,
      validCount: validQuestions.length,
      errorCount: errors.length,
      errors: errors,
      validQuestions: validQuestions,
    };
  }

  async commitImportQuestions(questions: Question[]): Promise<number> {
    const data = getStorageData();
    let count = 0;
    for (const q of questions) {
      data.questions.unshift(q);
      if (q.options) {
        data.questionOptions.push(...q.options);
      }
      count++;
    }
    saveStorageData(data);

    await auditService.logAction({
      action: 'IMPORT_QUESTIONS_CSV',
      entityType: 'CBT_QUESTION_BANK',
      newValue: { importedCount: count },
    });

    return count;
  }

  async exportQuestionsCsv(): Promise<string> {
    const questions = await this.getQuestions();
    const headers = [
      'subject_code',
      'category',
      'question',
      'option_a',
      'option_b',
      'option_c',
      'option_d',
      'option_e',
      'correct_answer',
      'difficulty',
      'points'
    ];

    const escapeCsv = (str?: string) => {
      if (!str) return '""';
      const clean = str.replace(/"/g, '""');
      return `"${clean}"`;
    };

    const lines: string[] = [headers.join(',')];

    for (const q of questions) {
      const subCode = q.subject?.code || '';
      const catName = q.category?.name || '';
      const qText = q.question_text || '';

      const optA = q.options?.find(o => o.option_key === 'A' || o.option_key === 'BENAR')?.option_text || '';
      const optB = q.options?.find(o => o.option_key === 'B' || o.option_key === 'SALAH')?.option_text || '';
      const optC = q.options?.find(o => o.option_key === 'C')?.option_text || '';
      const optD = q.options?.find(o => o.option_key === 'D')?.option_text || '';
      const optE = q.options?.find(o => o.option_key === 'E')?.option_text || '';

      const correctOpt = q.options?.find(o => o.is_correct);
      const correctKey = correctOpt ? correctOpt.option_key : 'A';

      lines.push([
        escapeCsv(subCode),
        escapeCsv(catName),
        escapeCsv(qText),
        escapeCsv(optA),
        escapeCsv(optB),
        escapeCsv(optC),
        escapeCsv(optD),
        escapeCsv(optE),
        escapeCsv(correctKey),
        escapeCsv(q.difficulty),
        q.points
      ].join(','));
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // 4. CBT EXAMS & QUESTION CONFIGS
  // ==========================================================================

  async getExams(filters?: { active_only?: boolean; exam_type?: ExamType }): Promise<Exam[]> {
    const data = getStorageData();
    let exams = data.exams.map(ex => {
      const schedule = data.testSchedules.find(s => s.id === ex.test_schedule_id);
      const configs = data.examConfigs
        .filter(c => c.exam_id === ex.id)
        .map(c => ({
          ...c,
          subject: data.subjects.find(s => s.id === c.subject_id),
          category: data.questionCategories.find(cat => cat.id === c.category_id),
        }));
      return {
        ...ex,
        test_schedule: schedule,
        configs: configs,
      };
    });

    if (filters?.active_only) {
      exams = exams.filter(e => e.is_active);
    }
    if (filters?.exam_type) {
      exams = exams.filter(e => e.exam_type === filters.exam_type || (!e.exam_type && (filters.exam_type === 'PSYCHOTEST' ? e.id.includes('psikotes') : !e.id.includes('psikotes'))));
    }
    return exams;
  }

  async getExamById(id: string): Promise<Exam | null> {
    const list = await this.getExams();
    return list.find(e => e.id === id) || null;
  }

  async createExam(payload: {
    test_schedule_id: string;
    title: string;
    description?: string;
    exam_type?: ExamType;
    duration_minutes: number;
    total_questions: number;
    randomize_questions?: boolean;
    randomize_options?: boolean;
    passing_score?: number;
    show_score_to_candidate?: boolean;
    configs?: Array<{ subject_id?: string; category_id?: string; question_count: number; points_per_question: number }>;
  }): Promise<{ success: boolean; exam?: Exam; error?: string }> {
    if (!payload.title.trim()) {
      return { success: false, error: 'Judul paket ujian wajib diisi.' };
    }
    if (!payload.test_schedule_id) {
      return { success: false, error: 'Jadwal seleksi wajib dihubungkan ke paket ujian.' };
    }
    if (payload.duration_minutes <= 0) {
      return { success: false, error: 'Durasi ujian harus lebih dari 0 menit.' };
    }

    const examId = 'exam-' + Date.now();
    const newExam: Exam = {
      id: examId,
      test_schedule_id: payload.test_schedule_id,
      title: payload.title.trim(),
      description: payload.description?.trim(),
      exam_type: payload.exam_type || 'ACADEMIC',
      duration_minutes: payload.duration_minutes,
      total_questions: payload.total_questions || 50,
      randomize_questions: payload.randomize_questions ?? true,
      randomize_options: payload.randomize_options ?? true,
      max_attempts: 1, // Rule: strictly 1 attempt
      passing_score: payload.passing_score,
      is_active: true,
      show_score_to_candidate: payload.show_score_to_candidate ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const data = getStorageData();
    data.exams.unshift(newExam);

    if (payload.configs && payload.configs.length > 0) {
      for (const cfg of payload.configs) {
        data.examConfigs.push({
          id: 'cfg-' + Date.now() + '-' + (cfg.category_id || cfg.subject_id || Math.random().toString(36).substring(2, 6)),
          exam_id: examId,
          subject_id: cfg.subject_id,
          category_id: cfg.category_id,
          question_count: cfg.question_count,
          points_per_question: cfg.points_per_question,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    saveStorageData(data);

    const isPsi = newExam.exam_type === 'PSYCHOTEST';
    await auditService.logAction({
      action: isPsi ? 'PSYCHOTEST_CREATED' : 'CREATE_EXAM',
      entityType: isPsi ? 'PSYCHOTEST_EXAM' : 'CBT_EXAM',
      entityId: examId,
      newValue: { title: newExam.title, schedule_id: newExam.test_schedule_id, exam_type: newExam.exam_type },
    });

    return { success: true, exam: newExam };
  }

  async updateExam(
    id: string,
    payload: {
      test_schedule_id: string;
      title: string;
      description?: string;
      exam_type?: ExamType;
      duration_minutes: number;
      total_questions: number;
      randomize_questions: boolean;
      randomize_options: boolean;
      passing_score?: number;
      is_active: boolean;
      show_score_to_candidate: boolean;
      configs?: Array<{ subject_id?: string; category_id?: string; question_count: number; points_per_question: number }>;
    }
  ): Promise<{ success: boolean; exam?: Exam; error?: string }> {
    const data = getStorageData();
    const idx = data.exams.findIndex(e => e.id === id);
    if (idx === -1) {
      return { success: false, error: 'Paket ujian tidak ditemukan.' };
    }

    data.exams[idx] = {
      ...data.exams[idx],
      test_schedule_id: payload.test_schedule_id,
      title: payload.title.trim(),
      description: payload.description?.trim(),
      exam_type: payload.exam_type || data.exams[idx].exam_type || 'ACADEMIC',
      duration_minutes: payload.duration_minutes,
      total_questions: payload.total_questions,
      randomize_questions: payload.randomize_questions,
      randomize_options: payload.randomize_options,
      passing_score: payload.passing_score,
      is_active: payload.is_active,
      show_score_to_candidate: payload.show_score_to_candidate,
      updated_at: new Date().toISOString(),
    };

    if (payload.configs) {
      data.examConfigs = data.examConfigs.filter(c => c.exam_id !== id);
      for (const cfg of payload.configs) {
        data.examConfigs.push({
          id: 'cfg-' + Date.now() + '-' + (cfg.category_id || cfg.subject_id || Math.random().toString(36).substring(2, 6)),
          exam_id: id,
          subject_id: cfg.subject_id,
          category_id: cfg.category_id,
          question_count: cfg.question_count,
          points_per_question: cfg.points_per_question,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    saveStorageData(data);

    const isPsi = data.exams[idx].exam_type === 'PSYCHOTEST';
    await auditService.logAction({
      action: isPsi ? 'PSYCHOTEST_UPDATED' : 'UPDATE_EXAM',
      entityType: isPsi ? 'PSYCHOTEST_EXAM' : 'CBT_EXAM',
      entityId: id,
      newValue: { title: payload.title, exam_type: data.exams[idx].exam_type },
    });

    return { success: true, exam: data.exams[idx] };
  }

  async createPsychotestPackage(
    payload: {
      test_schedule_id: string;
      title: string;
      description?: string;
      duration_minutes: number;
      total_questions: number;
      randomize_questions?: boolean;
      randomize_options?: boolean;
      passing_score?: number;
      show_score_to_candidate?: boolean;
      configs?: Array<{ subject_id?: string; category_id?: string; question_count: number; points_per_question: number }>;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; exam?: Exam; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang membuat paket psikotes baru (PSYCHOTEST_MANAGE).',
      };
    }
    return this.createExam({
      ...payload,
      exam_type: 'PSYCHOTEST',
    });
  }

  async updatePsychotestPackage(
    id: string,
    payload: {
      test_schedule_id?: string;
      title?: string;
      description?: string;
      duration_minutes?: number;
      total_questions?: number;
      randomize_questions?: boolean;
      randomize_options?: boolean;
      passing_score?: number;
      is_active?: boolean;
      show_score_to_candidate?: boolean;
      configs?: Array<{ subject_id?: string; category_id?: string; question_count: number; points_per_question: number }>;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; exam?: Exam; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang mengubah paket psikotes (PSYCHOTEST_MANAGE). Panitia dilarang mengedit durasi, kuota, acak opsi/soal, atau mengaktifkan/menonaktifkan paket.',
      };
    }
    const data = getStorageData();
    const idx = data.exams.findIndex(e => e.id === id);
    if (idx === -1) {
      return { success: false, error: 'Paket psikotes tidak ditemukan.' };
    }

    data.exams[idx] = {
      ...data.exams[idx],
      test_schedule_id: payload.test_schedule_id || data.exams[idx].test_schedule_id,
      title: payload.title ? payload.title.trim() : data.exams[idx].title,
      description: payload.description !== undefined ? payload.description.trim() : data.exams[idx].description,
      exam_type: 'PSYCHOTEST',
      duration_minutes: payload.duration_minutes !== undefined ? Number(payload.duration_minutes) : data.exams[idx].duration_minutes,
      total_questions: payload.total_questions !== undefined ? Number(payload.total_questions) : data.exams[idx].total_questions,
      randomize_questions: payload.randomize_questions !== undefined ? payload.randomize_questions : data.exams[idx].randomize_questions,
      randomize_options: payload.randomize_options !== undefined ? payload.randomize_options : data.exams[idx].randomize_options,
      passing_score: payload.passing_score !== undefined ? payload.passing_score : data.exams[idx].passing_score,
      is_active: payload.is_active !== undefined ? payload.is_active : data.exams[idx].is_active,
      show_score_to_candidate: payload.show_score_to_candidate !== undefined ? payload.show_score_to_candidate : data.exams[idx].show_score_to_candidate,
      updated_at: new Date().toISOString(),
    };

    if (payload.configs) {
      data.examConfigs = data.examConfigs.filter(c => c.exam_id !== id);
      for (const cfg of payload.configs) {
        data.examConfigs.push({
          id: 'cfg-' + Date.now() + '-' + (cfg.category_id || cfg.subject_id || Math.random().toString(36).substring(2, 6)),
          exam_id: id,
          subject_id: cfg.subject_id,
          category_id: cfg.category_id,
          question_count: cfg.question_count,
          points_per_question: cfg.points_per_question,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'PSYCHOTEST_PACKAGE_UPDATED',
      entityType: 'PSYCHOTEST_EXAM',
      entityId: id,
      newValue: { title: data.exams[idx].title, duration: data.exams[idx].duration_minutes },
    });

    return { success: true, exam: data.exams[idx] };
  }

  async toggleExamStatus(id: string, is_active: boolean): Promise<boolean> {
    const data = getStorageData();
    const ex = data.exams.find(e => e.id === id);
    if (!ex) return false;
    ex.is_active = is_active;
    ex.updated_at = new Date().toISOString();
    saveStorageData(data);
    return true;
  }

  async deleteExam(
    id: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang menghapus paket ujian.',
      };
    }
    const data = getStorageData();
    // Rule: Cannot delete if attempts exist
    const hasAttempts = data.examAttempts.some(a => a.exam_id === id);
    if (hasAttempts) {
      return {
        success: false,
        error: 'Ujian ini sudah memiliki peserta yang mengerjakan. Ujian tidak dapat dihapus, silakan nonaktifkan (arsip) status ujian.',
      };
    }

    data.exams = data.exams.filter(e => e.id !== id);
    data.examConfigs = data.examConfigs.filter(c => c.exam_id !== id);
    saveStorageData(data);
    return { success: true };
  }

  // ==========================================================================
  // 5. CANDIDATE ACCESS & CBT RUNTIME (Zero Leakage, Snapshot, Autosave)
  // ==========================================================================

  async checkCandidateExamAccess(
    userId: string,
    examId?: string,
    preferredType: 'ACADEMIC' | 'PSYCHOTEST' = 'ACADEMIC'
  ): Promise<CandidateExamAccessResult> {
    const data = getStorageData();
    const candidate = data.candidates.find(c => c.user_id === userId);
    if (!candidate) {
      return { allowed: false, reason: 'Data pendaftar santri tidak ditemukan.' };
    }

    const isPsi = preferredType === 'PSYCHOTEST' || (examId && examId.includes('psikotes'));
    const testLabel = isPsi ? 'ujian psikotes' : 'ujian akademik';

    // Rule: Status must allow exam
    const allowedStatuses: CandidateStatus[] = [
      'TERVERIFIKASI',
      'DIIZINKAN_MENGIKUTI_SELEKSI',
      'MENGIKUTI_SELEKSI',
      'SELESAI_SELEKSI'
    ];
    if (!allowedStatuses.includes(candidate.status)) {
      return {
        allowed: false,
        reason: `Pendaftaran Anda berstatus '${candidate.status}'. Hanya santri yang berkasnya telah TERVERIFIKASI yang dapat mengikuti ${testLabel}.`,
        candidate,
      };
    }

    let exam: Exam | undefined;
    if (examId) {
      exam = data.exams.find(e => e.id === examId);
    } else {
      // Find candidate's active schedule for this test type
      const targetScheduleType = isPsi ? 'tt-psikotes' : 'tt-akademik';
      const candidateSchedules = data.testScheduleParticipants
        .filter(p => p.candidate_id === candidate.id)
        .map(p => data.testSchedules.find(s => s.id === p.schedule_id))
        .filter(Boolean) as TestSchedule[];

      const matchedSchedule = candidateSchedules.find(s => s.test_type_id === targetScheduleType && s.is_active);
      if (matchedSchedule) {
        exam = data.exams.find(e => e.test_schedule_id === matchedSchedule.id && e.is_active);
      }
      if (!exam) {
        // Fallback to active exam of matching type
        exam = data.exams.find(e => (e.exam_type === preferredType || (!e.exam_type && (isPsi ? e.id.includes('psikotes') : !e.id.includes('psikotes')))) && e.is_active);
      }
    }

    if (!exam) {
      return { allowed: false, reason: `Paket ${testLabel} belum dibuka atau tidak ditemukan.`, candidate };
    }
    if (!exam.is_active) {
      return { allowed: false, reason: `Paket ${testLabel} sedang dinonaktifkan oleh panitia.`, candidate, exam };
    }

    // Rule: Candidate must be assigned to the test_schedule tied to this exam
    const isAssigned = data.testScheduleParticipants.some(
      p => p.schedule_id === exam!.test_schedule_id && p.candidate_id === candidate.id
    );

    const schedule = data.testSchedules.find(s => s.id === exam!.test_schedule_id);

    if (!isAssigned) {
      return {
        allowed: false,
        reason: isPsi
          ? 'Anda belum terdaftar pada sesi jadwal Psikotes ini. Pastikan panitia telah menempatkan Anda pada sesi Psikotes.'
          : 'Anda tidak terdaftar pada sesi jadwal ujian ini. Pastikan panitia telah menempatkan Anda pada sesi akademik.',
        candidate,
        exam,
        schedule,
      };
    }

    // Check existing attempt
    const existingAttempt = data.examAttempts.find(
      a => a.exam_id === exam!.id && a.candidate_id === candidate.id
    );

    return {
      allowed: true,
      candidate,
      exam,
      schedule,
      attempt: existingAttempt,
    };
  }

  async startOrResumeAttempt(candidateId: string, examId: string): Promise<{
    success: boolean;
    session?: ActiveExamSession;
    error?: string;
  }> {
    const data = getStorageData();
    const candidate = data.candidates.find(c => c.id === candidateId);
    const exam = data.exams.find(e => e.id === examId);

    if (!candidate || !exam) {
      return { success: false, error: 'Data pendaftar atau ujian tidak ditemukan.' };
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Check if attempt already exists
    let attempt = data.examAttempts.find(
      a => a.exam_id === examId && a.candidate_id === candidateId
    );

    if (attempt) {
      // If submitted, cannot resume
      if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
        return {
          success: false,
          error: 'Ujian ini telah selesai dikerjakan. Anda tidak dapat mengerjakan ulang ujian.',
        };
      }

      // Check server expiration
      const expiresAtDate = new Date(attempt.expires_at);
      if (now.getTime() >= expiresAtDate.getTime()) {
        // Automatically submit expired attempt
        await this.submitExamAttempt(attempt.id, true);
        return {
          success: false,
          error: 'Waktu ujian telah berakhir dan jawaban Anda telah otomatis dikumpulkan (Auto-Submitted).',
        };
      }

      // Fetch snapshot questions for this attempt (sanitized without is_correct)
      const attemptQuestions = data.examAttemptQuestions
        .filter(aq => aq.attempt_id === attempt.id)
        .sort((a, b) => a.question_order - b.question_order);

      // Fetch existing answers
      const answersMap: Record<string, ExamAnswer> = {};
      data.examAnswers
        .filter(ans => ans.attempt_id === attempt.id)
        .forEach(ans => {
          answersMap[ans.attempt_question_id] = ans;
        });

      const remainingSeconds = Math.max(0, Math.floor((expiresAtDate.getTime() - now.getTime()) / 1000));

      return {
        success: true,
        session: {
          attempt,
          exam,
          questions: attemptQuestions,
          answers: answersMap,
          serverTime: nowIso,
          remainingSeconds,
        },
      };
    }

    // 2. CREATE NEW ATTEMPT (Transaction-like snapshot generation)
    // Server computes expires_at strictly from now + duration
    const durationMs = exam.duration_minutes * 60 * 1000;
    const expiresAtIso = new Date(now.getTime() + durationMs).toISOString();

    // Gather questions
    const allActiveQuestions = data.questions.filter(q => q.is_active);
    const configs = data.examConfigs.filter(c => c.exam_id === examId);

    let selectedQuestions: Question[] = [];

    if (configs.length > 0) {
      // Pick per category or per subject based on configuration
      for (const cfg of configs) {
        let pool: Question[] = [];
        if (cfg.category_id) {
          pool = allActiveQuestions.filter(q => q.category_id === cfg.category_id);
        } else if (cfg.subject_id) {
          pool = allActiveQuestions.filter(q => q.subject_id === cfg.subject_id);
        }
        const shuffled = exam.randomize_questions
          ? [...pool].sort(() => Math.random() - 0.5)
          : pool;
        selectedQuestions.push(...shuffled.slice(0, cfg.question_count));
      }
    }

    // Fallback if not configured or empty: take all active questions
    if (selectedQuestions.length === 0) {
      const isPsi = exam.exam_type === 'PSYCHOTEST' || exam.id.includes('psikotes');
      const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');
      const filteredPool = isPsi && psiSubject
        ? allActiveQuestions.filter(q => q.subject_id === psiSubject.id)
        : allActiveQuestions.filter(q => !psiSubject || q.subject_id !== psiSubject.id);

      const poolToUse = filteredPool.length > 0 ? filteredPool : allActiveQuestions;
      const shuffled = exam.randomize_questions
        ? [...poolToUse].sort(() => Math.random() - 0.5)
        : poolToUse;
      selectedQuestions = shuffled.slice(0, exam.total_questions || 50);
    }

    // Final randomize order of questions if enabled
    if (exam.randomize_questions) {
      selectedQuestions.sort(() => Math.random() - 0.5);
    }

    const attemptId = 'att-' + Date.now();
    const newAttempt: ExamAttempt = {
      id: attemptId,
      exam_id: examId,
      candidate_id: candidateId,
      started_at: nowIso,
      expires_at: expiresAtIso,
      status: 'IN_PROGRESS',
      total_questions: selectedQuestions.length,
      answered_questions: 0,
      correct_answers: 0,
      raw_score: 0,
      max_score: selectedQuestions.reduce((sum, q) => sum + (q.points || 2), 0),
      normalized_score: 0,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Create question snapshots (WITHOUT is_correct or score exposed)
    const snapshotQuestions: ExamAttemptQuestion[] = selectedQuestions.map((q, idx) => {
      let options = (q.options || []).map(o => ({
        id: o.id,
        option_key: o.option_key,
        option_text: o.option_text,
        sort_order: o.sort_order,
      }));

      if (exam.randomize_options) {
        options.sort(() => Math.random() - 0.5);
      }

      const cat = data.questionCategories.find(c => c.id === q.category_id);

      return {
        id: 'aq-' + attemptId + '-' + (idx + 1),
        attempt_id: attemptId,
        question_id: q.id,
        category_id: q.category_id,
        category_name_snapshot: cat?.name || q.category?.name || 'UMUM',
        question_order: idx + 1,
        question_text_snapshot: q.question_text,
        image_url_snapshot: q.image_url,
        options_snapshot: options, // ZERO LEAKAGE: No is_correct and No score field
        points_snapshot: q.points || 2,
        created_at: nowIso,
      };
    });

    // Create immutable scoring snapshot for reliable historical scoring versioning
    const scoringSnapshot: ExamScoringSnapshot = {
      id: 'sc-snap-' + attemptId,
      attempt_id: attemptId,
      exam_id: examId,
      category_configs: data.psychotestScoringConfigs || [],
      question_keys: selectedQuestions.map(q => {
        const cat = data.questionCategories.find(c => c.id === q.category_id);
        return {
          question_id: q.id,
          category_id: q.category_id || '',
          category_name: cat?.name || q.category?.name || 'UMUM',
          options: (q.options || []).map(o => ({
            id: o.id,
            option_key: o.option_key,
            is_correct: o.is_correct,
            score: o.score !== undefined ? o.score : (o.is_correct ? (q.points || 2) : 0),
          })),
        };
      }),
      created_at: nowIso,
    };
    newAttempt.scoring_snapshot = scoringSnapshot;

    data.examAttempts.push(newAttempt);
    data.examAttemptQuestions.push(...snapshotQuestions);
    saveStorageData(data);

    const isPsychotest = exam.exam_type === 'PSYCHOTEST' || exam.id.includes('psikotes');

    // Record Event
    await this.recordExamEvent(attemptId, 'EXAM_STARTED', {
      started_at: nowIso,
      expires_at: expiresAtIso,
      question_count: snapshotQuestions.length,
      exam_type: isPsychotest ? 'PSYCHOTEST' : 'ACADEMIC',
    });

    await auditService.logAction({
      action: isPsychotest ? 'PSYCHOTEST_STARTED' : 'START_EXAM_ATTEMPT',
      entityType: isPsychotest ? 'PSYCHOTEST_ATTEMPT' : 'CBT_ATTEMPT',
      entityId: attemptId,
      newValue: {
        candidate_id: candidateId,
        exam_id: examId,
        started_at: nowIso,
      },
    });

    const remainingSeconds = exam.duration_minutes * 60;

    return {
      success: true,
      session: {
        attempt: newAttempt,
        exam,
        questions: snapshotQuestions,
        answers: {},
        serverTime: nowIso,
        remainingSeconds,
      },
    };
  }

  // ==========================================================================
  // 6. AUTOSAVE ANSWER & EVENTS
  // ==========================================================================

  async saveAnswer(
    attemptId: string,
    attemptQuestionId: string,
    selectedOptionIds: string[],
    isMarked: boolean = false
  ): Promise<{ success: boolean; answer?: ExamAnswer; error?: string }> {
    const data = getStorageData();
    const attempt = data.examAttempts.find(a => a.id === attemptId);

    if (!attempt) {
      return { success: false, error: 'Sesi ujian tidak ditemukan.' };
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return { success: false, error: 'Ujian ini telah selesai dikerjakan.' };
    }

    // Check expiration
    const now = new Date();
    if (now.getTime() > new Date(attempt.expires_at).getTime()) {
      await this.submitExamAttempt(attemptId, true);
      return { success: false, error: 'Waktu ujian telah berakhir.' };
    }

    const nowIso = now.toISOString();
    let existingAns = data.examAnswers.find(
      ans => ans.attempt_id === attemptId && ans.attempt_question_id === attemptQuestionId
    );

    if (existingAns) {
      existingAns.selected_option_ids = selectedOptionIds;
      existingAns.is_marked = isMarked;
      existingAns.answered_at = nowIso;
      existingAns.updated_at = nowIso;
    } else {
      existingAns = {
        id: 'ans-' + Date.now(),
        attempt_id: attemptId,
        attempt_question_id: attemptQuestionId,
        selected_option_ids: selectedOptionIds,
        answered_at: nowIso,
        is_marked: isMarked,
        updated_at: nowIso,
      };
      data.examAnswers.push(existingAns);
    }

    // Recalculate answered count
    const attemptAnswers = data.examAnswers.filter(
      ans => ans.attempt_id === attemptId && ans.selected_option_ids.length > 0
    );
    attempt.answered_questions = attemptAnswers.length;
    attempt.updated_at = nowIso;

    saveStorageData(data);

    return { success: true, answer: existingAns };
  }

  async recordExamEvent(
    attemptId: string,
    eventType: ExamEventType,
    metadata?: Record<string, any>
  ): Promise<void> {
    const data = getStorageData();
    const event: ExamEvent = {
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      attempt_id: attemptId,
      event_type: eventType,
      metadata: metadata,
      created_at: new Date().toISOString(),
    };
    data.examEvents.push(event);
    saveStorageData(data);
  }

  // ==========================================================================
  // 7. SUBMIT UJIAN & SERVER-SIDE SCORING
  // ==========================================================================

  async submitExamAttempt(
    attemptId: string,
    isAutoSubmit: boolean = false
  ): Promise<{
    success: boolean;
    attempt?: ExamAttempt;
    totalQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    unansweredQuestions: number;
    rawScore: number;
    normalizedScore: number;
    showScore: boolean;
  }> {
    const data = getStorageData();
    const attempt = data.examAttempts.find(a => a.id === attemptId);

    if (!attempt) {
      throw new Error('Sesi ujian tidak ditemukan.');
    }

    // If already submitted, return the saved scores (Idempotent)
    const exam = data.exams.find(e => e.id === attempt.exam_id);
    const showScore = exam?.show_score_to_candidate ?? false;

    if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
      const unanswered = attempt.total_questions - attempt.answered_questions;
      const wrong = attempt.answered_questions - attempt.correct_answers;
      return {
        success: true,
        attempt,
        totalQuestions: attempt.total_questions,
        answeredQuestions: attempt.answered_questions,
        correctAnswers: attempt.correct_answers,
        wrongAnswers: Math.max(0, wrong),
        unansweredQuestions: Math.max(0, unanswered),
        rawScore: attempt.raw_score,
        normalizedScore: attempt.normalized_score,
        showScore,
      };
    }

    // SERVER-SIDE SCORING CALCULATION
    const snapshots = data.examAttemptQuestions.filter(aq => aq.attempt_id === attemptId);
    const answers = data.examAnswers.filter(ans => ans.attempt_id === attemptId);

    // Track per-category score breakdown
    const categoryStats: Record<string, {
      category_id: string;
      category_name: string;
      raw_score: number;
      max_score: number;
      total_questions: number;
      answered_questions: number;
      correct_answers: number;
    }> = {};

    let rawScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let answeredCount = 0;

    for (const snap of snapshots) {
      const catId = snap.category_id || 'cat-umum';
      const catName = snap.category_name_snapshot || 'UMUM';

      if (!categoryStats[catId]) {
        categoryStats[catId] = {
          category_id: catId,
          category_name: catName,
          raw_score: 0,
          max_score: 0,
          total_questions: 0,
          answered_questions: 0,
          correct_answers: 0,
        };
      }

      categoryStats[catId].total_questions++;
      maxScore += snap.points_snapshot;
      categoryStats[catId].max_score += snap.points_snapshot;

      const userAns = answers.find(a => a.attempt_question_id === snap.id);

      if (userAns && userAns.selected_option_ids && userAns.selected_option_ids.length > 0) {
        answeredCount++;
        categoryStats[catId].answered_questions++;
        const selectedId = userAns.selected_option_ids[0];

        // 1. Check scoring snapshot first for strict historical immutability
        const snapQuestionKey = attempt.scoring_snapshot?.question_keys?.find(
          k => k.question_id === snap.question_id
        );
        const snapOption = snapQuestionKey?.options?.find(o => o.id === selectedId);

        let earnedScore = 0;
        let isCorrect = false;

        if (snapOption) {
          earnedScore = snapOption.score;
          isCorrect = snapOption.is_correct || snapOption.score > 0;
        } else {
          // 2. Fallback to current question options
          const realOption = data.questionOptions.find(o => o.id === selectedId);
          if (realOption) {
            if (realOption.score !== undefined) {
              earnedScore = realOption.score;
              isCorrect = realOption.is_correct || realOption.score > 0;
            } else if (realOption.is_correct) {
              earnedScore = snap.points_snapshot;
              isCorrect = true;
            }
          }
        }

        if (earnedScore > 0) {
          rawScore += earnedScore;
          categoryStats[catId].raw_score += earnedScore;
        }
        if (isCorrect) {
          correctCount++;
          categoryStats[catId].correct_answers++;
        }
      }
    }

    const normalizedScore = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
    const roundedNormalized = Math.round(normalizedScore * 100) / 100;

    const categoryScores: ExamCategoryScore[] = Object.values(categoryStats).map(stat => ({
      category_id: stat.category_id,
      category_name: stat.category_name,
      raw_score: stat.raw_score,
      max_score: stat.max_score,
      normalized_score: stat.max_score > 0 ? Math.round((stat.raw_score / stat.max_score) * 10000) / 100 : 0,
      total_questions: stat.total_questions,
      answered_questions: stat.answered_questions,
      correct_answers: stat.correct_answers,
    }));

    const nowIso = new Date().toISOString();
    attempt.status = isAutoSubmit ? 'AUTO_SUBMITTED' : 'SUBMITTED';
    attempt.submitted_at = nowIso;
    attempt.total_questions = snapshots.length;
    attempt.answered_questions = answeredCount;
    attempt.correct_answers = correctCount;
    attempt.raw_score = rawScore;
    attempt.max_score = maxScore;
    attempt.normalized_score = roundedNormalized;
    attempt.category_scores = categoryScores;
    attempt.updated_at = nowIso;

    saveStorageData(data);

    const isPsychotest = exam?.exam_type === 'PSYCHOTEST' || exam?.id?.includes('psikotes');

    await this.recordExamEvent(
      attemptId,
      isAutoSubmit ? 'AUTO_SUBMITTED' : 'EXAM_SUBMITTED',
      {
        answered: answeredCount,
        correct: correctCount,
        raw_score: rawScore,
        normalized_score: roundedNormalized,
        category_scores: categoryScores,
        exam_type: isPsychotest ? 'PSYCHOTEST' : 'ACADEMIC',
      }
    );

    await auditService.logAction({
      action: isPsychotest
        ? (isAutoSubmit ? 'PSYCHOTEST_AUTO_SUBMITTED' : 'PSYCHOTEST_SUBMITTED')
        : (isAutoSubmit ? 'AUTO_SUBMIT_EXAM' : 'SUBMIT_EXAM'),
      entityType: isPsychotest ? 'PSYCHOTEST_ATTEMPT' : 'CBT_ATTEMPT',
      entityId: attemptId,
      newValue: {
        candidate_id: attempt.candidate_id,
        score: roundedNormalized,
        status: attempt.status,
        category_scores: categoryScores,
      },
    });

    if (isPsychotest) {
      await auditService.logAction({
        action: 'PSYCHOTEST_SCORE_CALCULATED',
        entityType: 'PSYCHOTEST_SCORING',
        entityId: attemptId,
        newValue: {
          raw_score: rawScore,
          max_score: maxScore,
          normalized_score: roundedNormalized,
          category_breakdown: categoryScores,
        },
      });
    }

    const unanswered = snapshots.length - answeredCount;
    const wrong = answeredCount - correctCount;

    return {
      success: true,
      attempt,
      totalQuestions: snapshots.length,
      answeredQuestions: answeredCount,
      correctAnswers: correctCount,
      wrongAnswers: Math.max(0, wrong),
      unansweredQuestions: Math.max(0, unanswered),
      rawScore,
      normalizedScore: roundedNormalized,
      showScore,
    };
  }

  // ==========================================================================
  // 8. ADMIN RESULTS & MONITORING
  // ==========================================================================

  async getExamResults(filters?: {
    exam_id?: string;
    status?: string;
    search?: string;
  }): Promise<
    Array<{
      attempt: ExamAttempt;
      candidate: Candidate;
      exam: Exam;
      answeredCount: number;
      correctCount: number;
      wrongCount: number;
      unansweredCount: number;
    }>
  > {
    const data = getStorageData();
    let attempts = data.examAttempts.filter(
      a => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED' || a.status === 'IN_PROGRESS'
    );

    if (filters?.exam_id) {
      attempts = attempts.filter(a => a.exam_id === filters.exam_id);
    }
    if (filters?.status) {
      attempts = attempts.filter(a => a.status === filters.status);
    }

    const results = attempts.map(att => {
      const cand = data.candidates.find(c => c.id === att.candidate_id) || ({} as Candidate);
      const ex = data.exams.find(e => e.id === att.exam_id) || ({} as Exam);
      const wrong = att.answered_questions - att.correct_answers;
      const unanswered = att.total_questions - att.answered_questions;

      return {
        attempt: att,
        candidate: cand,
        exam: ex,
        answeredCount: att.answered_questions,
        correctCount: att.correct_answers,
        wrongCount: Math.max(0, wrong),
        unansweredCount: Math.max(0, unanswered),
      };
    });

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      return results.filter(
        r =>
          r.candidate.full_name?.toLowerCase().includes(term) ||
          r.candidate.registration_number?.toLowerCase().includes(term)
      );
    }

    return results;
  }

  async getExamMonitoring(examId?: string): Promise<{
    stats: {
      totalAssigned: number;
      notStarted: number;
      inProgress: number;
      submitted: number;
      autoSubmitted: number;
    };
    participants: Array<{
      participantId: string;
      candidateId: string;
      candidateName: string;
      registrationNumber: string;
      schoolName: string;
      attemptStatus: string;
      startedAt?: string;
      expiresAt?: string;
      answeredQuestions: number;
      totalQuestions: number;
      seatNumber: string;
    }>;
  }> {
    const data = getStorageData();
    const targetExam = examId
      ? data.exams.find(e => e.id === examId)
      : data.exams.find(e => e.is_active) || data.exams[0];

    if (!targetExam) {
      return {
        stats: { totalAssigned: 0, notStarted: 0, inProgress: 0, submitted: 0, autoSubmitted: 0 },
        participants: [],
      };
    }

    // Find all candidates assigned to this exam's schedule
    const assignedParticipants = data.testScheduleParticipants.filter(
      p => p.schedule_id === targetExam.test_schedule_id
    );

    let notStarted = 0;
    let inProgress = 0;
    let submitted = 0;
    let autoSubmitted = 0;

    const list = assignedParticipants.map(p => {
      const cand = data.candidates.find(c => c.id === p.candidate_id);
      const attempt = data.examAttempts.find(
        a => a.exam_id === targetExam.id && a.candidate_id === p.candidate_id
      );

      let violationsCount = 0;
      if (attempt) {
        violationsCount = data.examEvents.filter(
          e =>
            e.attempt_id === attempt.id &&
            (e.event_type === 'TAB_SWITCH' ||
              e.event_type === 'WINDOW_BLUR' ||
              e.event_type === 'TAB_HIDDEN')
        ).length;

        if (attempt.status === 'IN_PROGRESS') {
          inProgress++;
          status = 'SEDANG_UJIAN';
        } else if (attempt.status === 'SUBMITTED') {
          submitted++;
          status = 'SUDAH_SUBMIT';
        } else if (attempt.status === 'AUTO_SUBMITTED') {
          autoSubmitted++;
          status = 'AUTO_SUBMIT';
        }
      } else {
        notStarted++;
      }

      return {
        participantId: p.id,
        attemptId: attempt?.id,
        candidateId: p.candidate_id,
        candidateName: cand?.full_name || 'Calon Santri',
        registrationNumber: cand?.registration_number || '-',
        schoolName: cand?.school_name || '-',
        attemptStatus: status,
        startedAt: attempt?.started_at,
        expiresAt: attempt?.expires_at,
        answeredQuestions: attempt?.answered_questions || 0,
        totalQuestions: attempt?.total_questions || targetExam.total_questions || 50,
        seatNumber: p.seat_number,
        violationsCount,
      };
    });

    return {
      stats: {
        totalAssigned: assignedParticipants.length,
        notStarted,
        inProgress,
        submitted,
        autoSubmitted,
      },
      participants: list,
    };
  }

  async forceSubmitAttempt(
    attemptId: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang memiliki wewenang Force Submit CBT (CBT_FORCE_SUBMIT).',
      };
    }
    try {
      await this.submitExamAttempt(attemptId, true);
      await auditService.logAction({
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        action: 'FORCE_SUBMIT_EXAM',
        entityType: 'CBT_ATTEMPT',
        entityId: attemptId,
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Gagal melakukan force submit.' };
    }
  }

  async resetAttempt(
    attemptId: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang memiliki wewenang me-reset sesi CBT (CBT_RESET).',
      };
    }
    try {
      const data = getStorageData();
      const att = data.examAttempts.find(a => a.id === attemptId);
      if (!att) return { success: false, error: 'Data attempt tidak ditemukan.' };

      data.examAnswers = data.examAnswers.filter(a => a.attempt_id !== attemptId);
      data.examAttemptQuestions = data.examAttemptQuestions.filter(q => q.attempt_id !== attemptId);
      data.examEvents = data.examEvents.filter(e => e.attempt_id !== attemptId);
      data.examAttempts = data.examAttempts.filter(a => a.id !== attemptId);

      saveStorageData(data);

      await auditService.logAction({
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        action: 'RESET_EXAM_ATTEMPT',
        entityType: 'CBT_ATTEMPT',
        entityId: attemptId,
        oldValue: { candidate_id: att.candidate_id, exam_id: att.exam_id },
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Gagal me-reset attempt.' };
    }
  }

  async resetExamAttempt(
    attemptId: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    return this.resetAttempt(attemptId, currentUser);
  }

  // ==========================================================================
  // 9. PSYCHOTEST SCORING CONFIGURATION & CATEGORIES (SUPER_ADMIN ONLY)
  // ==========================================================================

  async getPsychotestScoringConfigs(
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; configs: PsychotestScoringConfig[]; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        configs: [],
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat konfigurasi scoring psikotes (PSYCHOTEST_SCORING_MANAGE). PIMPINAN, PANITIA, PENGUJI_QURAN, dan PESERTA tidak diperkenankan membaca konfigurasi bobot internal.',
      };
    }
    const data = getStorageData();
    const configs = data.psychotestScoringConfigs || [];
    const enriched = configs.map(c => {
      const cat = data.questionCategories.find(qc => qc.id === c.category_id);
      return {
        ...c,
        category_name: cat?.name || c.category_name || 'KATEGORI',
      };
    });
    return {
      success: true,
      configs: enriched,
    };
  }

  async updatePsychotestScoringConfig(
    id: string,
    payload: {
      scoring_model: 'BINARY' | 'WEIGHTED_OPTION' | 'SCALE';
      default_correct_score: number;
      default_wrong_score: number;
      normalization_base: number;
      is_active: boolean;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; config?: PsychotestScoringConfig; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang mengubah konfigurasi scoring psikotes (PSYCHOTEST_SCORING_MANAGE).',
      };
    }
    const data = getStorageData();
    if (!data.psychotestScoringConfigs) data.psychotestScoringConfigs = [];
    const idx = data.psychotestScoringConfigs.findIndex(c => c.id === id);
    if (idx === -1) {
      return { success: false, error: 'Konfigurasi scoring tidak ditemukan.' };
    }
    const oldVal = { ...data.psychotestScoringConfigs[idx] };
    data.psychotestScoringConfigs[idx] = {
      ...data.psychotestScoringConfigs[idx],
      ...payload,
      updated_at: new Date().toISOString(),
    };
    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'PSYCHOTEST_CONFIGURATION_CHANGED',
      entityType: 'PSYCHOTEST_SCORING_CONFIG',
      entityId: id,
      oldValue: oldVal,
      newValue: data.psychotestScoringConfigs[idx],
    });

    return { success: true, config: data.psychotestScoringConfigs[idx] };
  }

  async updatePsychotestScoring(
    id: string,
    payload: {
      scoring_model: 'BINARY' | 'WEIGHTED_OPTION' | 'SCALE';
      default_correct_score: number;
      default_wrong_score: number;
      normalization_base: number;
      is_active: boolean;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; config?: PsychotestScoringConfig; error?: string }> {
    return this.updatePsychotestScoringConfig(id, payload, currentUser);
  }

  async createPsychotestCategory(
    payload: {
      name: string;
      description?: string;
      scoring_model?: 'BINARY' | 'WEIGHTED_OPTION' | 'SCALE';
      default_correct_score?: number;
      default_wrong_score?: number;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; category?: QuestionCategory; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang menambah kategori psikotes.',
      };
    }
    const nameClean = payload.name.trim().toUpperCase();
    if (!nameClean) {
      return { success: false, error: 'Nama kategori psikotes wajib diisi.' };
    }
    const data = getStorageData();
    const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');
    if (!psiSubject) {
      return { success: false, error: 'Mata pelajaran Psikotes tidak ditemukan.' };
    }

    if (data.questionCategories.some(c => c.subject_id === psiSubject.id && c.name.toUpperCase() === nameClean)) {
      return { success: false, error: `Kategori '${nameClean}' sudah ada.` };
    }

    const catId = 'cat-psi-' + Date.now();
    const newCat: QuestionCategory = {
      id: catId,
      subject_id: psiSubject.id,
      name: nameClean,
      description: payload.description?.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    data.questionCategories.push(newCat);

    // Create corresponding scoring config
    const scId = 'sc-' + Date.now();
    const newSc: PsychotestScoringConfig = {
      id: scId,
      category_id: catId,
      category_name: nameClean,
      scoring_model: payload.scoring_model || 'BINARY',
      default_correct_score: payload.default_correct_score || 2,
      default_wrong_score: payload.default_wrong_score || 0,
      normalization_base: 100,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!data.psychotestScoringConfigs) data.psychotestScoringConfigs = [];
    data.psychotestScoringConfigs.push(newSc);

    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'PSYCHOTEST_CREATED',
      entityType: 'PSYCHOTEST_CATEGORY',
      entityId: catId,
      newValue: { name: nameClean, description: payload.description },
    });

    return { success: true, category: newCat };
  }

  // ==========================================================================
  // 10. PSYCHOTEST QUESTION BANK (SUPER_ADMIN ONLY)
  // ==========================================================================

  async getPsychotestQuestions(filters?: {
    category_id?: string;
    difficulty?: string;
    is_active?: boolean;
    search?: string;
  }): Promise<Question[]> {
    const data = getStorageData();
    const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');
    if (!psiSubject) return [];

    let result = data.questions
      .filter(q => q.subject_id === psiSubject.id)
      .map(q => {
        const qOptions = data.questionOptions.filter(o => o.question_id === q.id);
        return {
          ...q,
          subject: psiSubject,
          category: data.questionCategories.find(c => c.id === q.category_id),
          options: qOptions.sort((a, b) => a.sort_order - b.sort_order),
        };
      });

    if (filters?.category_id) {
      result = result.filter(q => q.category_id === filters.category_id);
    }
    if (filters?.difficulty) {
      result = result.filter(q => q.difficulty === filters.difficulty);
    }
    if (filters?.is_active !== undefined) {
      result = result.filter(q => q.is_active === filters.is_active);
    }
    if (filters?.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(q => q.question_text.toLowerCase().includes(term));
    }

    return result;
  }

  async savePsychotestQuestion(
    payload: {
      id?: string;
      category_id: string;
      sub_category?: string;
      question_text: string;
      image_url?: string;
      question_type?: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
      difficulty?: 'MUDAH' | 'SEDANG' | 'SULIT';
      points?: number;
      is_active?: boolean;
      options: Array<{
        id?: string;
        option_key: string;
        option_text: string;
        is_correct: boolean;
        score?: number;
        sort_order?: number;
      }>;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; question?: Question; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang mengelola bank soal psikotes (PSYCHOTEST_QUESTION_MANAGE).',
      };
    }
    const data = getStorageData();
    const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');
    if (!psiSubject) return { success: false, error: 'Subject Psikotes tidak ditemukan.' };

    const qId = payload.id || 'q-psi-' + Date.now();
    const isEdit = !!payload.id;

    const options: QuestionOption[] = payload.options.map((opt, idx) => ({
      id: opt.id || 'opt-' + qId + '-' + (idx + 1),
      question_id: qId,
      option_key: opt.option_key,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
      score: opt.score !== undefined ? opt.score : (opt.is_correct ? (payload.points || 2) : 0),
      sort_order: opt.sort_order ?? idx + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const question: Question = {
      id: qId,
      subject_id: psiSubject.id,
      category_id: payload.category_id,
      sub_category: payload.sub_category?.trim(),
      question_text: payload.question_text.trim(),
      image_url: payload.image_url?.trim(),
      question_type: payload.question_type || 'MULTIPLE_CHOICE',
      difficulty: payload.difficulty || 'SEDANG',
      points: payload.points || 2,
      is_active: payload.is_active ?? true,
      options,
      updated_at: new Date().toISOString(),
      created_at: isEdit ? (data.questions.find(q => q.id === qId)?.created_at || new Date().toISOString()) : new Date().toISOString(),
    };

    if (isEdit) {
      const idx = data.questions.findIndex(q => q.id === qId);
      if (idx !== -1) {
        data.questions[idx] = question;
      }
      data.questionOptions = data.questionOptions.filter(o => o.question_id !== qId);
      data.questionOptions.push(...options);
    } else {
      data.questions.unshift(question);
      data.questionOptions.push(...options);
    }

    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: isEdit ? 'PSYCHOTEST_UPDATED' : 'PSYCHOTEST_CREATED',
      entityType: 'PSYCHOTEST_QUESTION',
      entityId: qId,
      newValue: { category_id: payload.category_id, question_text: payload.question_text },
    });

    return { success: true, question };
  }

  async updatePsychotestQuestion(
    payload: {
      id: string;
      category_id: string;
      sub_category?: string;
      question_text: string;
      image_url?: string;
      question_type?: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
      difficulty?: 'MUDAH' | 'SEDANG' | 'SULIT';
      points?: number;
      is_active?: boolean;
      options: Array<{
        id?: string;
        option_key: string;
        option_text: string;
        is_correct: boolean;
        score?: number;
        sort_order?: number;
      }>;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; question?: Question; error?: string }> {
    return this.savePsychotestQuestion(payload, currentUser);
  }

  async duplicatePsychotestQuestion(
    id: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; question?: Question; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang menduplikasi soal (PSYCHOTEST_QUESTION_MANAGE).',
      };
    }
    const data = getStorageData();
    const original = data.questions.find(q => q.id === id);
    if (!original) return { success: false, error: 'Soal tidak ditemukan.' };

    const originalOpts = data.questionOptions.filter(o => o.question_id === id);
    return this.savePsychotestQuestion({
      category_id: original.category_id || '',
      sub_category: original.sub_category,
      question_text: original.question_text + ' (Duplikat)',
      image_url: original.image_url,
      question_type: original.question_type as any,
      difficulty: original.difficulty,
      points: original.points,
      is_active: original.is_active,
      options: originalOpts.map(o => ({
        option_key: o.option_key,
        option_text: o.option_text,
        is_correct: o.is_correct,
        score: o.score,
        sort_order: o.sort_order,
      })),
    }, currentUser);
  }

  async deletePsychotestQuestion(
    id: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang menghapus soal psikotes (PSYCHOTEST_QUESTION_MANAGE).',
      };
    }
    const data = getStorageData();
    const isUsed = data.examAttemptQuestions.some(aq => aq.question_id === id);
    if (isUsed) {
      return {
        success: false,
        error: 'Soal ini telah digunakan dalam pengerjaan psikotes peserta. Soal tidak dapat dihapus, silakan nonaktifkan status soal.',
      };
    }
    data.questions = data.questions.filter(q => q.id !== id);
    data.questionOptions = data.questionOptions.filter(o => o.question_id !== id);
    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'PSYCHOTEST_DEACTIVATED',
      entityType: 'PSYCHOTEST_QUESTION',
      entityId: id,
    });

    return { success: true };
  }

  async exportPsychotestQuestionsCsv(): Promise<string> {
    const data = getStorageData();
    const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');
    const questions = data.questions.filter(q => q.subject_id === psiSubject?.id);

    const headers = [
      'category',
      'question',
      'option_a',
      'option_b',
      'option_c',
      'option_d',
      'option_e',
      'score_a',
      'score_b',
      'score_c',
      'score_d',
      'score_e',
      'difficulty',
      'points',
      'status'
    ];

    const escapeCsv = (str?: string) => {
      if (!str) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const lines: string[] = [headers.join(',')];

    for (const q of questions) {
      const cat = data.questionCategories.find(c => c.id === q.category_id);
      const catName = cat?.name || 'LOGIKA';
      const qOptions = data.questionOptions.filter(o => o.question_id === q.id).sort((a, b) => a.sort_order - b.sort_order);

      const optA = qOptions.find(o => o.option_key === 'A')?.option_text || '';
      const optB = qOptions.find(o => o.option_key === 'B')?.option_text || '';
      const optC = qOptions.find(o => o.option_key === 'C')?.option_text || '';
      const optD = qOptions.find(o => o.option_key === 'D')?.option_text || '';
      const optE = qOptions.find(o => o.option_key === 'E')?.option_text || '';

      const scoreA = qOptions.find(o => o.option_key === 'A')?.score ?? (qOptions.find(o => o.option_key === 'A')?.is_correct ? q.points : 0);
      const scoreB = qOptions.find(o => o.option_key === 'B')?.score ?? (qOptions.find(o => o.option_key === 'B')?.is_correct ? q.points : 0);
      const scoreC = qOptions.find(o => o.option_key === 'C')?.score ?? (qOptions.find(o => o.option_key === 'C')?.is_correct ? q.points : 0);
      const scoreD = qOptions.find(o => o.option_key === 'D')?.score ?? (qOptions.find(o => o.option_key === 'D')?.is_correct ? q.points : 0);
      const scoreE = qOptions.find(o => o.option_key === 'E')?.score ?? (qOptions.find(o => o.option_key === 'E')?.is_correct ? q.points : 0);

      lines.push([
        escapeCsv(catName),
        escapeCsv(q.question_text),
        escapeCsv(optA),
        escapeCsv(optB),
        escapeCsv(optC),
        escapeCsv(optD),
        escapeCsv(optE),
        scoreA,
        scoreB,
        scoreC,
        scoreD,
        scoreE,
        escapeCsv(q.difficulty),
        q.points,
        q.is_active ? 'AKTIF' : 'NONAKTIF'
      ].join(','));
    }

    return lines.join('\n');
  }

  async parsePsychotestQuestionsCsv(csvText: string): Promise<CsvImportResult> {
    const data = getStorageData();
    const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');
    if (!psiSubject) {
      return { totalRows: 0, validCount: 0, errorCount: 1, errors: [{ row: 0, error: 'Mata pelajaran Psikotes belum diinisialisasi.' }], validQuestions: [] };
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      return { totalRows: 0, validCount: 0, errorCount: 1, errors: [{ row: 0, error: 'File CSV kosong atau tidak memiliki baris data.' }], validQuestions: [] };
    }

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const errors: CsvImportRowError[] = [];
    const validQuestions: Question[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1;
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 5) {
        errors.push({ row: rowNum, error: 'Format kolom tidak lengkap (minimal category, question, option_a, option_b).' });
        continue;
      }

      const catName = cols[0]?.trim().toUpperCase();
      const qText = cols[1]?.trim();
      const optA = cols[2]?.trim();
      const optB = cols[3]?.trim();
      const optC = cols[4]?.trim() || '';
      const optD = cols[5]?.trim() || '';
      const optE = cols[6]?.trim() || '';

      const scoreA = parseFloat(cols[7]) || 0;
      const scoreB = parseFloat(cols[8]) || 0;
      const scoreC = parseFloat(cols[9]) || 0;
      const scoreD = parseFloat(cols[10]) || 0;
      const scoreE = parseFloat(cols[11]) || 0;

      const difficultyRaw = (cols[12] || 'SEDANG').toUpperCase();
      const difficulty = ['MUDAH', 'SEDANG', 'SULIT'].includes(difficultyRaw) ? difficultyRaw as any : 'SEDANG';
      const points = parseFloat(cols[13]) || 2;
      const statusRaw = (cols[14] || 'AKTIF').toUpperCase();
      const isActive = statusRaw !== 'NONAKTIF' && statusRaw !== 'FALSE';

      if (!catName) {
        errors.push({ row: rowNum, error: 'Kategori soal wajib diisi.' });
        continue;
      }
      if (!qText) {
        errors.push({ row: rowNum, error: 'Pertanyaan soal wajib diisi.' });
        continue;
      }
      if (!optA || !optB) {
        errors.push({ row: rowNum, error: 'Pilihan A dan Pilihan B wajib diisi.' });
        continue;
      }

      let category = data.questionCategories.find(c => c.subject_id === psiSubject.id && c.name.toUpperCase() === catName);
      if (!category) {
        category = {
          id: 'cat-psi-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          subject_id: psiSubject.id,
          name: catName,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        data.questionCategories.push(category);
      }

      const qId = 'q-psi-import-' + Date.now() + '-' + i;
      const questionOptions: QuestionOption[] = [
        { id: 'opt-' + qId + '-a', question_id: qId, option_key: 'A', option_text: optA, is_correct: scoreA > 0, score: scoreA, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'opt-' + qId + '-b', question_id: qId, option_key: 'B', option_text: optB, is_correct: scoreB > 0, score: scoreB, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ];
      if (optC) questionOptions.push({ id: 'opt-' + qId + '-c', question_id: qId, option_key: 'C', option_text: optC, is_correct: scoreC > 0, score: scoreC, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      if (optD) questionOptions.push({ id: 'opt-' + qId + '-d', question_id: qId, option_key: 'D', option_text: optD, is_correct: scoreD > 0, score: scoreD, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      if (optE) questionOptions.push({ id: 'opt-' + qId + '-e', question_id: qId, option_key: 'E', option_text: optE, is_correct: scoreE > 0, score: scoreE, sort_order: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

      const newQ: Question = {
        id: qId,
        subject_id: psiSubject.id,
        category_id: category.id,
        question_text: qText,
        question_type: 'MULTIPLE_CHOICE',
        difficulty,
        points,
        is_active: isActive,
        options: questionOptions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      validQuestions.push(newQ);
    }

    return {
      totalRows: lines.length - 1,
      validCount: validQuestions.length,
      errorCount: errors.length,
      errors,
      validQuestions,
    };
  }

  async exportPsychotestResultsCsv(examId?: string): Promise<string> {
    const data = getStorageData();
    const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');
    const dbCategories = data.questionCategories
      .filter(c => !psiSubject || c.subject_id === psiSubject.id)
      .map(c => c.name.toUpperCase());
    const defaultFallback = ['LOGIKA', 'PENALARAN', 'NUMERIK', 'VERBAL', 'VISUAL', 'SPASIAL', 'KETELITIAN', 'KONSENTRASI'];
    const categories = Array.from(new Set(dbCategories.length > 0 ? dbCategories : defaultFallback));

    const results = await this.getExamResults({ exam_id: examId });
    const psiResults = results.filter(r => r.exam?.exam_type === 'PSYCHOTEST' || (!r.exam?.exam_type && r.exam?.id?.includes('psikotes')));

    const headers = [
      'nomor_peserta',
      'nama_lengkap',
      'asal_sekolah',
      'paket_ujian',
      'skor_mentah',
      'skor_maksimal',
      'skor_ternormalisasi',
      'status_ujian',
      'waktu_submit',
      ...categories.map(c => `skor_${c.toLowerCase()}`)
    ];

    const escapeCsv = (str?: any) => {
      if (str === undefined || str === null) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const lines: string[] = [headers.join(',')];

    for (const r of (psiResults.length > 0 ? psiResults : results)) {
      const catScoresMap: Record<string, number> = {};
      (r.attempt.category_scores || []).forEach(cs => {
        catScoresMap[cs.category_name.toUpperCase()] = cs.normalized_score;
      });

      const catCols = categories.map(c => catScoresMap[c] ?? '-');

      lines.push([
        escapeCsv(r.candidate.registration_number || '-'),
        escapeCsv(r.candidate.full_name || '-'),
        escapeCsv(r.candidate.school_name || '-'),
        escapeCsv(r.exam.title || '-'),
        r.attempt.raw_score,
        r.attempt.max_score,
        r.attempt.normalized_score,
        escapeCsv(r.attempt.status),
        escapeCsv(r.attempt.submitted_at || '-'),
        ...catCols
      ].join(','));
    }

    return lines.join('\n');
  }

  async getPsychotestDashboardStats(examId?: string): Promise<{
    totalCandidates: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    autoSubmitted: number;
    averageScore: number;
    minScore: number;
    maxScore: number;
    scoreDistribution: { range: string; count: number }[];
    categoryAverages: Record<string, number>;
  }> {
    const data = getStorageData();
    const psiExams = data.exams.filter(e => e.exam_type === 'PSYCHOTEST' || (!e.exam_type && e.id.includes('psikotes')));
    const targetExam = examId ? data.exams.find(e => e.id === examId) : psiExams[0];

    if (!targetExam) {
      return {
        totalCandidates: 0,
        notStarted: 0,
        inProgress: 0,
        submitted: 0,
        autoSubmitted: 0,
        averageScore: 0,
        minScore: 0,
        maxScore: 0,
        scoreDistribution: [],
        categoryAverages: {},
      };
    }

    const participants = data.testScheduleParticipants.filter(p => p.schedule_id === targetExam.test_schedule_id);
    const attempts = data.examAttempts.filter(a => a.exam_id === targetExam.id);

    let notStarted = 0;
    let inProgress = 0;
    let submitted = 0;
    let autoSubmitted = 0;

    participants.forEach(p => {
      const att = attempts.find(a => a.candidate_id === p.candidate_id);
      if (!att) notStarted++;
      else if (att.status === 'IN_PROGRESS') inProgress++;
      else if (att.status === 'SUBMITTED') submitted++;
      else if (att.status === 'AUTO_SUBMITTED') autoSubmitted++;
    });

    const finishedAttempts = attempts.filter(a => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED');
    const scores = finishedAttempts.map(a => a.normalized_score);

    const averageScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

    // Distribution
    const ranges = [
      { range: '0 - 49', min: 0, max: 49.99, count: 0 },
      { range: '50 - 64', min: 50, max: 64.99, count: 0 },
      { range: '65 - 79', min: 65, max: 79.99, count: 0 },
      { range: '80 - 89', min: 80, max: 89.99, count: 0 },
      { range: '90 - 100', min: 90, max: 100, count: 0 },
    ];
    scores.forEach(s => {
      const r = ranges.find(rng => s >= rng.min && s <= rng.max);
      if (r) r.count++;
    });

    // Category Averages
    const catSums: Record<string, { sum: number; count: number }> = {};
    finishedAttempts.forEach(att => {
      (att.category_scores || []).forEach(cs => {
        if (!catSums[cs.category_name]) {
          catSums[cs.category_name] = { sum: 0, count: 0 };
        }
        catSums[cs.category_name].sum += cs.normalized_score;
        catSums[cs.category_name].count += 1;
      });
    });

    const categoryAverages: Record<string, number> = {};
    Object.keys(catSums).forEach(cat => {
      categoryAverages[cat] = Math.round((catSums[cat].sum / catSums[cat].count) * 10) / 10;
    });

    return {
      totalCandidates: participants.length,
      notStarted,
      inProgress,
      submitted,
      autoSubmitted,
      averageScore,
      minScore,
      maxScore,
      scoreDistribution: ranges.map(r => ({ range: r.range, count: r.count })),
      categoryAverages,
    };
  }
}

export const cbtService = new CbtService();
