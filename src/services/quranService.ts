import {
  QuranRubric,
  QuranExaminerAssignment,
  QuranAssessment,
  QuranAssessmentRubricSnapshot,
  QuranAssessmentScore,
  QuranAssignmentStatus,
  QuranAssessmentStatus,
  SaveQuranAssessmentPayload,
  QuranScoringCalculation
} from '../types/quran';
import { Profile, Candidate } from '../types/database';
import { getStorageData, saveStorageData } from '../lib/storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { auditService } from './auditService';
import { defaultQuranRubrics } from '../lib/quranSeeds';

class QuranService {
  // ==========================================================================
  // 1. RUBRICS MANAGEMENT (Configurable by Super Admin)
  // ==========================================================================

  async getRubrics(activeOnly = false): Promise<QuranRubric[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase
          .from('quran_rubrics')
          .select('*')
          .order('sort_order', { ascending: true });

        if (activeOnly) {
          query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as QuranRubric[];
        }
      } catch (e) {
        console.warn('Fallback to local storage for quran_rubrics', e);
      }
    }

    const data = getStorageData();
    let rubrics = data.quranRubrics || defaultQuranRubrics;
    if (activeOnly) {
      rubrics = rubrics.filter((r) => r.is_active);
    }
    return [...rubrics].sort((a, b) => a.sort_order - b.sort_order);
  }

  async saveRubric(
    rubric: Partial<QuranRubric>,
    user: { id: string; email: string }
  ): Promise<{ success: boolean; error?: string; rubric?: QuranRubric }> {
    if (!rubric.name?.trim()) {
      return { success: false, error: 'Nama rubrik penilaian wajib diisi.' };
    }
    if (!rubric.code?.trim()) {
      return { success: false, error: 'Kode rubrik wajib diisi.' };
    }
    if (rubric.weight !== undefined && (rubric.weight < 0 || rubric.weight > 100)) {
      return { success: false, error: 'Bobot rubrik harus berada di antara 0% s.d 100%.' };
    }
    if (rubric.min_score !== undefined && rubric.max_score !== undefined && rubric.min_score >= rubric.max_score) {
      return { success: false, error: 'Skor maksimum harus lebih besar dari skor minimum.' };
    }

    const data = getStorageData();
    const cleanCode = rubric.code.trim().toUpperCase().replace(/\s+/g, '_');
    const nowIso = new Date().toISOString();

    let target: QuranRubric;

    if (rubric.id) {
      const idx = data.quranRubrics.findIndex((r) => r.id === rubric.id);
      if (idx === -1) {
        return { success: false, error: 'Rubrik penilaian tidak ditemukan.' };
      }
      target = {
        ...data.quranRubrics[idx],
        ...rubric,
        code: cleanCode,
        updated_at: nowIso,
      };
      data.quranRubrics[idx] = target;
    } else {
      // Check duplicate code
      if (data.quranRubrics.some((r) => r.code === cleanCode)) {
        return { success: false, error: `Kode rubrik "${cleanCode}" sudah digunakan.` };
      }
      target = {
        id: `rub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        code: cleanCode,
        name: rubric.name.trim(),
        description: rubric.description?.trim() || '',
        min_score: rubric.min_score ?? 0,
        max_score: rubric.max_score ?? 100,
        weight: rubric.weight ?? 0,
        sort_order: rubric.sort_order ?? (data.quranRubrics.length + 1),
        is_required: rubric.is_required ?? true,
        is_active: rubric.is_active ?? true,
        created_at: nowIso,
        updated_at: nowIso,
      };
      data.quranRubrics.push(target);
    }

    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('quran_rubrics').upsert({
          id: target.id,
          code: target.code,
          name: target.name,
          description: target.description,
          min_score: target.min_score,
          max_score: target.max_score,
          weight: target.weight,
          sort_order: target.sort_order,
          is_required: target.is_required,
          is_active: target.is_active,
          updated_at: nowIso,
        });
      } catch (e) {
        console.warn('Supabase saveRubric error', e);
      }
    }

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'QURAN_RUBRIC_UPDATED',
      entityType: 'QURAN_RUBRIC',
      entityId: target.id,
      newValue: { code: target.code, name: target.name, weight: target.weight },
    });

    return { success: true, rubric: target };
  }

  async updateRubricWeights(
    weights: Array<{ id: string; weight: number }>,
    user: { id: string; email: string }
  ): Promise<{ success: boolean; error?: string }> {
    const total = weights.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    const rounded = Math.round(total * 100) / 100;
    if (rounded !== 100) {
      return {
        success: false,
        error: `Total bobot rubrik aktif harus tepat 100%. Total saat ini: ${rounded}%.`,
      };
    }

    const data = getStorageData();
    const nowIso = new Date().toISOString();

    for (const item of weights) {
      const idx = data.quranRubrics.findIndex((r) => r.id === item.id);
      if (idx !== -1) {
        data.quranRubrics[idx].weight = Number(item.weight);
        data.quranRubrics[idx].updated_at = nowIso;
      }
    }

    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        for (const item of weights) {
          await supabase
            .from('quran_rubrics')
            .update({ weight: Number(item.weight), updated_at: nowIso })
            .eq('id', item.id);
        }
      } catch (e) {
        console.warn('Supabase updateRubricWeights error', e);
      }
    }

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'QURAN_WEIGHT_UPDATED',
      entityType: 'QURAN_RUBRICS',
      newValue: { weights, total: rounded },
    });

    return { success: true };
  }

  async deleteOrArchiveRubric(
    id: string,
    user: { id: string; email: string }
  ): Promise<{ success: boolean; error?: string }> {
    const data = getStorageData();
    const idx = data.quranRubrics.findIndex((r) => r.id === id);
    if (idx === -1) {
      return { success: false, error: 'Rubrik tidak ditemukan.' };
    }

    // Check if rubric is used in snapshots or scores
    const isUsed = (data.quranAssessmentScores || []).some((s) => s.rubric_id === id);
    if (isUsed) {
      // Archive instead of delete to preserve historical integrity
      data.quranRubrics[idx].is_active = false;
      data.quranRubrics[idx].updated_at = new Date().toISOString();
      saveStorageData(data);
      return { success: true };
    }

    data.quranRubrics.splice(idx, 1);
    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('quran_rubrics').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase delete rubric error', e);
      }
    }

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'QURAN_RUBRIC_DELETED',
      entityType: 'QURAN_RUBRIC',
      entityId: id,
    });

    return { success: true };
  }

  // ==========================================================================
  // 2. EXAMINERS & ASSIGNMENTS
  // ==========================================================================

  async getExaminers(): Promise<Profile[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['PENGUJI_QURAN', 'PANITIA', 'SUPER_ADMIN'])
          .eq('is_active', true);

        if (!error && data && data.length > 0) {
          return data as Profile[];
        }
      } catch (e) {
        console.warn('Fallback to local storage for getExaminers', e);
      }
    }

    const data = getStorageData();
    return data.profiles.filter(
      (p) => p.is_active && (p.role === 'PENGUJI_QURAN' || p.role === 'PANITIA' || p.role === 'SUPER_ADMIN')
    );
  }

  async getAssignments(filters?: {
    schedule_id?: string;
    examiner_user_id?: string;
    candidate_id?: string;
    status?: QuranAssignmentStatus;
  }): Promise<QuranExaminerAssignment[]> {
    const data = getStorageData();
    let assignments = [...(data.quranAssignments || [])];

    if (filters?.schedule_id) {
      assignments = assignments.filter((a) => a.schedule_id === filters.schedule_id);
    }
    if (filters?.examiner_user_id) {
      assignments = assignments.filter((a) => a.examiner_user_id === filters.examiner_user_id);
    }
    if (filters?.candidate_id) {
      assignments = assignments.filter((a) => a.candidate_id === filters.candidate_id);
    }
    if (filters?.status) {
      assignments = assignments.filter((a) => a.assignment_status === filters.status);
    }

    // Attach joined metadata
    return assignments.map((a) => {
      const cand = data.candidates.find((c) => c.id === a.candidate_id);
      const sch = data.testSchedules.find((s) => s.id === a.schedule_id);
      const ex = data.profiles.find((p) => p.user_id === a.examiner_user_id);
      const assess = (data.quranAssessments || []).find(
        (qa) => qa.schedule_id === a.schedule_id && qa.candidate_id === a.candidate_id
      );
      const participant = data.testScheduleParticipants.find(
        (p) => p.schedule_id === a.schedule_id && p.candidate_id === a.candidate_id
      );

      return {
        ...a,
        candidate: cand,
        schedule: sch,
        examiner: ex,
        assessment: assess,
        attendance_status: participant?.attendance_status || 'BELUM_HADIR',
      };
    });
  }

  async assignExaminer(
    payload: {
      schedule_id: string;
      candidate_id: string;
      examiner_user_id: string;
      notes?: string;
    },
    user: { id: string; email: string }
  ): Promise<{ success: boolean; error?: string; assignment?: QuranExaminerAssignment }> {
    const data = getStorageData();

    // 1. Validate schedule is QURAN test type
    const schedule = data.testSchedules.find((s) => s.id === payload.schedule_id);
    if (!schedule) {
      return { success: false, error: 'Sesi jadwal tidak ditemukan.' };
    }
    const testType = data.testTypes.find((t) => t.id === schedule.test_type_id);
    if (testType?.code !== 'QURAN') {
      return { success: false, error: 'Penugasan penguji Al-Qur\'an hanya dapat dilakukan pada jadwal jenis QURAN.' };
    }

    // 2. Validate candidate status
    const candidate = data.candidates.find((c) => c.id === payload.candidate_id);
    if (!candidate) {
      return { success: false, error: 'Data pendaftar tidak ditemukan.' };
    }
    const allowedStatuses = [
      'TERVERIFIKASI',
      'DIIZINKAN_MENGIKUTI_SELEKSI',
      'MENGIKUTI_SELEKSI',
      'SELESAI_SELEKSI',
      'LULUS',
      'CADANGAN',
    ];
    if (!allowedStatuses.includes(candidate.status)) {
      return {
        success: false,
        error: `Pendaftar berstatus "${candidate.status}". Hanya santri dengan berkas TERVERIFIKASI yang dapat ditugaskan untuk tes Al-Qur'an.`,
      };
    }

    // 3. Validate candidate is assigned to this schedule
    const isScheduled = data.testScheduleParticipants.some(
      (p) => p.schedule_id === payload.schedule_id && p.candidate_id === payload.candidate_id
    );
    if (!isScheduled) {
      return {
        success: false,
        error: 'Pendaftar belum terdaftar pada sesi jadwal ini. Silakan tempatkan peserta pada jadwal terlebih dahulu.',
      };
    }

    // 4. Validate unique assignment constraint
    const existing = (data.quranAssignments || []).find(
      (a) =>
        a.schedule_id === payload.schedule_id &&
        a.candidate_id === payload.candidate_id &&
        a.assignment_status !== 'CANCELLED'
    );
    if (existing) {
      if (existing.examiner_user_id === payload.examiner_user_id) {
        return { success: false, error: 'Peserta sudah ditugaskan kepada penguji ini pada jadwal yang sama.' };
      }
      // Reassign to new examiner
      existing.examiner_user_id = payload.examiner_user_id;
      existing.notes = payload.notes || existing.notes;
      existing.updated_at = new Date().toISOString();
      saveStorageData(data);
      return { success: true, assignment: existing };
    }

    const nowIso = new Date().toISOString();
    const newAssignment: QuranExaminerAssignment = {
      id: `qea-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      schedule_id: payload.schedule_id,
      candidate_id: payload.candidate_id,
      examiner_user_id: payload.examiner_user_id,
      assignment_status: 'ASSIGNED',
      assigned_at: nowIso,
      assigned_by: user.id,
      notes: payload.notes?.trim() || undefined,
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (!data.quranAssignments) data.quranAssignments = [];
    data.quranAssignments.push(newAssignment);
    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('quran_examiner_assignments').insert({
          id: newAssignment.id,
          schedule_id: newAssignment.schedule_id,
          candidate_id: newAssignment.candidate_id,
          examiner_user_id: newAssignment.examiner_user_id,
          assignment_status: newAssignment.assignment_status,
          assigned_at: nowIso,
          assigned_by: user.id,
          notes: newAssignment.notes,
        });
      } catch (e) {
        console.warn('Supabase assignExaminer error', e);
      }
    }

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'QURAN_EXAMINER_ASSIGNED',
      entityType: 'QURAN_ASSIGNMENT',
      entityId: newAssignment.id,
      newValue: {
        candidate_reg: candidate.registration_number,
        examiner_user_id: payload.examiner_user_id,
        schedule_id: payload.schedule_id,
      },
    });

    return { success: true, assignment: newAssignment };
  }

  async removeAssignment(
    assignmentId: string,
    user: { id: string; email: string }
  ): Promise<{ success: boolean; error?: string }> {
    const data = getStorageData();
    const idx = (data.quranAssignments || []).findIndex((a) => a.id === assignmentId);
    if (idx === -1) {
      return { success: false, error: 'Penugasan tidak ditemukan.' };
    }

    const assignment = data.quranAssignments[idx];

    // Cannot remove if assessment is already completed or locked
    const assess = (data.quranAssessments || []).find(
      (qa) => qa.schedule_id === assignment.schedule_id && qa.candidate_id === assignment.candidate_id
    );
    if (assess && (assess.status === 'LOCKED' || assess.status === 'SUBMITTED')) {
      return {
        success: false,
        error: 'Penugasan tidak dapat dibatalkan karena penilaian peserta sudah selesai dan dikunci.',
      };
    }

    data.quranAssignments.splice(idx, 1);
    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('quran_examiner_assignments').delete().eq('id', assignmentId);
      } catch (e) {
        console.warn('Supabase removeAssignment error', e);
      }
    }

    return { success: true };
  }

  // ==========================================================================
  // 3. EXAMINER DASHBOARD & PARTICIPANT LIST
  // ==========================================================================

  async getExaminerDashboardStats(examinerUserId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  }> {
    const assignments = await this.getAssignments({ examiner_user_id: examinerUserId });
    let pending = 0;
    let inProgress = 0;
    let completed = 0;

    for (const a of assignments) {
      const st = a.assessment?.status;
      if (!st || st === 'NOT_STARTED') {
        pending++;
      } else if (st === 'IN_PROGRESS' || st === 'NEEDS_REVISION') {
        inProgress++;
      } else if (st === 'SUBMITTED' || st === 'LOCKED') {
        completed++;
      }
    }

    return {
      total: assignments.length,
      pending,
      inProgress,
      completed,
    };
  }

  async getExaminerCandidates(
    examinerUserId: string,
    filters?: {
      date?: string;
      schedule_id?: string;
      status?: string;
      search?: string;
    }
  ): Promise<QuranExaminerAssignment[]> {
    let assignments = await this.getAssignments({ examiner_user_id: examinerUserId });

    if (filters?.schedule_id) {
      assignments = assignments.filter((a) => a.schedule_id === filters.schedule_id);
    }

    if (filters?.date) {
      assignments = assignments.filter((a) => a.schedule?.test_date === filters.date);
    }

    if (filters?.status) {
      if (filters.status === 'PENDING') {
        assignments = assignments.filter((a) => !a.assessment || a.assessment.status === 'NOT_STARTED');
      } else if (filters.status === 'IN_PROGRESS') {
        assignments = assignments.filter(
          (a) => a.assessment?.status === 'IN_PROGRESS' || a.assessment?.status === 'NEEDS_REVISION'
        );
      } else if (filters.status === 'COMPLETED') {
        assignments = assignments.filter(
          (a) => a.assessment?.status === 'SUBMITTED' || a.assessment?.status === 'LOCKED'
        );
      }
    }

    if (filters?.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      assignments = assignments.filter((a) => {
        const name = (a.candidate?.full_name || '').toLowerCase();
        const reg = (a.candidate?.registration_number || '').toLowerCase();
        const school = (a.candidate?.school_name || '').toLowerCase();
        return name.includes(q) || reg.includes(q) || school.includes(q);
      });
    }

    return assignments;
  }

  // ==========================================================================
  // 4. ASSESSMENT RUNTIME (START, DRAFT, SUBMIT, LOCK, REVISION)
  // ==========================================================================

  async getAssessmentById(
    assessmentId: string,
    currentUser?: { id: string; role: string }
  ): Promise<{ assessment: QuranAssessment | null; error?: string }> {
    const data = getStorageData();
    const assess = (data.quranAssessments || []).find((qa) => qa.id === assessmentId);

    if (!assess) {
      return { assessment: null, error: 'Sesi penilaian Al-Qur\'an tidak ditemukan.' };
    }

    // Role Security Guard:
    // PENGUJI_QURAN can ONLY view their own assessment!
    if (currentUser?.role === 'PENGUJI_QURAN' && assess.examiner_user_id !== currentUser.id) {
      return {
        assessment: null,
        error: 'Akses Ditolak: Anda tidak memiliki izin mengakses penilaian milik penguji lain.',
      };
    }
    if (currentUser?.role === 'PESERTA') {
      return {
        assessment: null,
        error: 'Akses Ditolak: Calon santri tidak diizinkan membuka formulir penilaian internal.',
      };
    }

    const cand = data.candidates.find((c) => c.id === assess.candidate_id);
    const sch = data.testSchedules.find((s) => s.id === assess.schedule_id);
    const ex = data.profiles.find((p) => p.user_id === assess.examiner_user_id);
    const rev = assess.reviewed_by ? data.profiles.find((p) => p.user_id === assess.reviewed_by) : undefined;

    const scores = (data.quranAssessmentScores || []).filter((s) => s.assessment_id === assess.id);
    const snapshots = (data.quranRubricSnapshots || []).filter((sn) => sn.assessment_id === assess.id);

    return {
      assessment: {
        ...assess,
        candidate: cand,
        schedule: sch,
        examiner: ex,
        reviewer: rev,
        scores: scores.sort((a, b) => {
          const snapA = snapshots.find((s) => s.rubric_id === a.rubric_id);
          const snapB = snapshots.find((s) => s.rubric_id === b.rubric_id);
          return (snapA?.sort_order || 0) - (snapB?.sort_order || 0);
        }),
        snapshots: snapshots.sort((a, b) => a.sort_order - b.sort_order),
      },
    };
  }

  async startOrGetAssessment(
    assignmentId: string,
    currentUser: { id: string; email: string; role: string; name?: string }
  ): Promise<{ success: boolean; assessment?: QuranAssessment; error?: string }> {
    const data = getStorageData();
    const assignment = (data.quranAssignments || []).find((a) => a.id === assignmentId);

    if (!assignment) {
      return { success: false, error: 'Data penugasan penguji tidak ditemukan.' };
    }

    // Role check: Penguji can only start their own assigned candidate
    if (currentUser.role === 'PENGUJI_QURAN' && assignment.examiner_user_id !== currentUser.id) {
      return {
        success: false,
        error: 'Akses Ditolak: Peserta ini ditugaskan kepada penguji lain.',
      };
    }

    // Attendance integration check:
    const participant = data.testScheduleParticipants.find(
      (p) => p.schedule_id === assignment.schedule_id && p.candidate_id === assignment.candidate_id
    );

    if (participant && participant.attendance_status === 'TIDAK_HADIR') {
      return {
        success: false,
        error: 'Peserta ini berstatus TIDAK HADIR. Penguji tidak dapat melakukan penilaian kecuali panitia melakukan verifikasi kehadiran.',
      };
    }

    // Check if assessment already exists
    let assess = (data.quranAssessments || []).find(
      (qa) => qa.schedule_id === assignment.schedule_id && qa.candidate_id === assignment.candidate_id
    );

    if (assess) {
      const full = await this.getAssessmentById(assess.id, currentUser);
      return { success: true, assessment: full.assessment || assess };
    }

    // CREATE NEW ASSESSMENT & RUBRIC SNAPSHOTS
    const activeRubrics = (data.quranRubrics || defaultQuranRubrics).filter((r) => r.is_active);
    if (activeRubrics.length === 0) {
      return {
        success: false,
        error: 'Belum ada rubrik penilaian Al-Qur\'an yang aktif. Silakan hubungi admin panitia.',
      };
    }

    const nowIso = new Date().toISOString();
    const assessId = `qas-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Create snapshots so future rubric modifications don't alter past tests
    const snapshots: QuranAssessmentRubricSnapshot[] = activeRubrics.map((r, idx) => ({
      id: `qsnap-${assessId}-${idx + 1}`,
      assessment_id: assessId,
      rubric_id: r.id,
      rubric_name_snapshot: r.name,
      description_snapshot: r.description,
      min_score_snapshot: r.min_score,
      max_score_snapshot: r.max_score,
      weight_snapshot: r.weight,
      sort_order: r.sort_order,
      created_at: nowIso,
    }));

    // Initialize blank scores
    const initialScores: QuranAssessmentScore[] = activeRubrics.map((r) => ({
      id: `qsc-${assessId}-${r.id}`,
      assessment_id: assessId,
      rubric_id: r.id,
      rubric_name_snapshot: r.name,
      score: 0,
      weight: r.weight,
      weighted_score: 0,
      examiner_note: '',
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const newAssessment: QuranAssessment = {
      id: assessId,
      schedule_id: assignment.schedule_id,
      candidate_id: assignment.candidate_id,
      examiner_user_id: assignment.examiner_user_id,
      status: 'IN_PROGRESS',
      started_at: nowIso,
      raw_score: 0,
      normalized_score: 0,
      surah_name: '',
      ayat_range: '',
      juz_tested: 'Juz 30',
      reading_notes: '',
      notes: '',
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (!data.quranAssessments) data.quranAssessments = [];
    if (!data.quranRubricSnapshots) data.quranRubricSnapshots = [];
    if (!data.quranAssessmentScores) data.quranAssessmentScores = [];

    data.quranAssessments.push(newAssessment);
    data.quranRubricSnapshots.push(...snapshots);
    data.quranAssessmentScores.push(...initialScores);

    // Update assignment status to IN_PROGRESS
    assignment.assignment_status = 'IN_PROGRESS';
    assignment.updated_at = nowIso;

    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('quran_assessments').insert({
          id: newAssessment.id,
          schedule_id: newAssessment.schedule_id,
          candidate_id: newAssessment.candidate_id,
          examiner_user_id: newAssessment.examiner_user_id,
          status: newAssessment.status,
          started_at: newAssessment.started_at,
          raw_score: newAssessment.raw_score,
          normalized_score: newAssessment.normalized_score,
          surah_name: newAssessment.surah_name,
          ayat_range: newAssessment.ayat_range,
          juz_tested: newAssessment.juz_tested,
        });

        for (const s of snapshots) {
          await supabase.from('quran_assessment_rubric_snapshots').insert(s);
        }

        for (const sc of initialScores) {
          await supabase.from('quran_assessment_scores').insert(sc);
        }
      } catch (e) {
        console.warn('Supabase startOrGetAssessment error', e);
      }
    }

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'QURAN_ASSESSMENT_STARTED',
      entityType: 'QURAN_ASSESSMENT',
      entityId: assessId,
      newValue: { candidate_id: assignment.candidate_id, schedule_id: assignment.schedule_id },
    });

    const full = await this.getAssessmentById(assessId, currentUser);
    return { success: true, assessment: full.assessment || newAssessment };
  }

  // ==========================================================================
  // 5. SERVER-SIDE SCORING CALCULATION
  // ==========================================================================

  calculateAssessmentScores(
    snapshots: QuranAssessmentRubricSnapshot[],
    submittedScores: Array<{ rubric_id: string; score: number; examiner_note?: string }>
  ): QuranScoringCalculation {
    let rawScore = 0;
    let totalWeight = 0;

    const evaluatedScores = snapshots.map((snap) => {
      const userItem = submittedScores.find((s) => s.rubric_id === snap.rubric_id);
      const rawVal = Number(userItem?.score || 0);

      // Validate clamp
      const safeScore = isNaN(rawVal)
        ? 0
        : Math.min(Math.max(rawVal, snap.min_score_snapshot), snap.max_score_snapshot);

      // Weighted score = score * (weight / 100)
      const weighted = Math.round((safeScore * (snap.weight_snapshot / 100)) * 100) / 100;

      rawScore += weighted;
      totalWeight += snap.weight_snapshot;

      return {
        rubric_id: snap.rubric_id,
        rubric_name: snap.rubric_name_snapshot,
        score: safeScore,
        weight: snap.weight_snapshot,
        weighted_score: weighted,
        examiner_note: userItem?.examiner_note?.trim() || '',
      };
    });

    const normalizedScore = Math.round(rawScore * 100) / 100;

    return {
      scores: evaluatedScores,
      raw_score: normalizedScore,
      normalized_score: normalizedScore,
      total_weight: totalWeight,
    };
  }

  async saveAssessmentDraft(
    assessmentId: string,
    payload: SaveQuranAssessmentPayload,
    currentUser: { id: string; email: string; role: string }
  ): Promise<{ success: boolean; assessment?: QuranAssessment; error?: string }> {
    const data = getStorageData();
    const assessIdx = (data.quranAssessments || []).findIndex((qa) => qa.id === assessmentId);
    if (assessIdx === -1) {
      return { success: false, error: 'Sesi penilaian tidak ditemukan.' };
    }

    const assess = data.quranAssessments[assessIdx];

    // Security: Examiner can only modify their own assessment
    if (currentUser.role === 'PENGUJI_QURAN' && assess.examiner_user_id !== currentUser.id) {
      return { success: false, error: 'Akses Ditolak: Anda tidak dapat mengubah penilaian penguji lain.' };
    }

    // Security: Cannot edit if locked
    if (assess.status === 'LOCKED') {
      return {
        success: false,
        error: 'Nilai telah dikunci (LOCKED) dan tidak dapat diubah. Hubungi panitia untuk meminta revisi.',
      };
    }

    const snapshots = (data.quranRubricSnapshots || []).filter((s) => s.assessment_id === assessmentId);
    const calc = this.calculateAssessmentScores(snapshots, payload.scores);

    const nowIso = new Date().toISOString();
    assess.surah_name = payload.surah_name?.trim() || '';
    assess.ayat_range = payload.ayat_range?.trim() || '';
    assess.juz_tested = payload.juz_tested?.trim() || '';
    assess.reading_notes = payload.reading_notes?.trim() || '';
    assess.notes = payload.notes?.trim() || '';
    assess.raw_score = calc.raw_score;
    assess.normalized_score = calc.normalized_score;
    assess.updated_at = nowIso;

    // Update individual scores in storage
    for (const evaluated of calc.scores) {
      const scIdx = (data.quranAssessmentScores || []).findIndex(
        (sc) => sc.assessment_id === assessmentId && sc.rubric_id === evaluated.rubric_id
      );
      if (scIdx !== -1) {
        data.quranAssessmentScores[scIdx].score = evaluated.score;
        data.quranAssessmentScores[scIdx].weight = evaluated.weight;
        data.quranAssessmentScores[scIdx].weighted_score = evaluated.weighted_score;
        data.quranAssessmentScores[scIdx].examiner_note = evaluated.examiner_note;
        data.quranAssessmentScores[scIdx].updated_at = nowIso;
      }
    }

    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('quran_assessments')
          .update({
            surah_name: assess.surah_name,
            ayat_range: assess.ayat_range,
            juz_tested: assess.juz_tested,
            reading_notes: assess.reading_notes,
            notes: assess.notes,
            raw_score: assess.raw_score,
            normalized_score: assess.normalized_score,
            updated_at: nowIso,
          })
          .eq('id', assessmentId);

        for (const evaluated of calc.scores) {
          await supabase
            .from('quran_assessment_scores')
            .update({
              score: evaluated.score,
              weighted_score: evaluated.weighted_score,
              examiner_note: evaluated.examiner_note,
              updated_at: nowIso,
            })
            .eq('assessment_id', assessmentId)
            .eq('rubric_id', evaluated.rubric_id);
        }
      } catch (e) {
        console.warn('Supabase saveAssessmentDraft error', e);
      }
    }

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'QURAN_ASSESSMENT_DRAFT_SAVED',
      entityType: 'QURAN_ASSESSMENT',
      entityId: assessmentId,
      newValue: { raw_score: calc.raw_score },
    });

    const full = await this.getAssessmentById(assessmentId, currentUser);
    return { success: true, assessment: full.assessment || assess };
  }

  async submitAssessment(
    assessmentId: string,
    payload: SaveQuranAssessmentPayload,
    currentUser: { id: string; email: string; role: string; name?: string }
  ): Promise<{ success: boolean; assessment?: QuranAssessment; error?: string }> {
    const data = getStorageData();
    const assessIdx = (data.quranAssessments || []).findIndex((qa) => qa.id === assessmentId);
    if (assessIdx === -1) {
      return { success: false, error: 'Sesi penilaian tidak ditemukan.' };
    }

    const assess = data.quranAssessments[assessIdx];

    // Security: Examiner role guard
    if (currentUser.role === 'PENGUJI_QURAN' && assess.examiner_user_id !== currentUser.id) {
      return { success: false, error: 'Akses Ditolak: Anda tidak dapat submit penilaian penguji lain.' };
    }
    if (assess.status === 'LOCKED') {
      return { success: false, error: 'Penilaian sudah dikunci (LOCKED).' };
    }

    const snapshots = (data.quranRubricSnapshots || []).filter((s) => s.assessment_id === assessmentId);

    // Validate that all required rubrics are filled with valid numeric values
    for (const snap of snapshots) {
      const item = payload.scores.find((s) => s.rubric_id === snap.rubric_id);
      if (item === undefined || item.score === null || isNaN(Number(item.score))) {
        return {
          success: false,
          error: `Aspek "${snap.rubric_name_snapshot}" wajib dinilai. Silakan masukkan skor antara ${snap.min_score_snapshot} s.d ${snap.max_score_snapshot}.`,
        };
      }
      const num = Number(item.score);
      if (num < snap.min_score_snapshot || num > snap.max_score_snapshot) {
        return {
          success: false,
          error: `Skor untuk "${snap.rubric_name_snapshot}" harus berada di antara ${snap.min_score_snapshot} dan ${snap.max_score_snapshot}. Nilai Anda: ${num}.`,
        };
      }
    }

    // Server-side evaluation
    const calc = this.calculateAssessmentScores(snapshots, payload.scores);
    const nowIso = new Date().toISOString();

    assess.surah_name = payload.surah_name?.trim() || '';
    assess.ayat_range = payload.ayat_range?.trim() || '';
    assess.juz_tested = payload.juz_tested?.trim() || '';
    assess.reading_notes = payload.reading_notes?.trim() || '';
    assess.notes = payload.notes?.trim() || '';
    assess.raw_score = calc.raw_score;
    assess.normalized_score = calc.normalized_score;
    assess.status = 'LOCKED'; // SUBMITTED -> LOCKED automatically
    assess.submitted_at = nowIso;
    assess.updated_at = nowIso;

    // Update scores
    for (const evaluated of calc.scores) {
      const scIdx = (data.quranAssessmentScores || []).findIndex(
        (sc) => sc.assessment_id === assessmentId && sc.rubric_id === evaluated.rubric_id
      );
      if (scIdx !== -1) {
        data.quranAssessmentScores[scIdx].score = evaluated.score;
        data.quranAssessmentScores[scIdx].weight = evaluated.weight;
        data.quranAssessmentScores[scIdx].weighted_score = evaluated.weighted_score;
        data.quranAssessmentScores[scIdx].examiner_note = evaluated.examiner_note;
        data.quranAssessmentScores[scIdx].updated_at = nowIso;
      }
    }

    // Update assignment to COMPLETED
    const assignIdx = (data.quranAssignments || []).findIndex(
      (a) => a.schedule_id === assess.schedule_id && a.candidate_id === assess.candidate_id
    );
    if (assignIdx !== -1) {
      data.quranAssignments[assignIdx].assignment_status = 'COMPLETED';
      data.quranAssignments[assignIdx].updated_at = nowIso;
    }

    // Notify Panitia
    const cand = data.candidates.find((c) => c.id === assess.candidate_id);
    const candidateName = cand?.full_name || 'Santri';
    const regNum = cand?.registration_number || '-';

    data.notifications.push({
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      candidate_id: assess.candidate_id,
      title: 'Penilaian Al-Qur\'an Selesai',
      message: `Penilaian Al-Qur'an peserta ${regNum} (${candidateName}) telah selesai dan dikunci oleh ${currentUser.name || 'Penguji'}. Nilai: ${calc.normalized_score}.`,
      type: 'QURAN_ASSESSMENT_COMPLETED',
      is_read: false,
      created_at: nowIso,
    });

    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('quran_assessments')
          .update({
            status: 'LOCKED',
            submitted_at: nowIso,
            raw_score: assess.raw_score,
            normalized_score: assess.normalized_score,
            surah_name: assess.surah_name,
            ayat_range: assess.ayat_range,
            juz_tested: assess.juz_tested,
            reading_notes: assess.reading_notes,
            notes: assess.notes,
            updated_at: nowIso,
          })
          .eq('id', assessmentId);

        await supabase
          .from('quran_examiner_assignments')
          .update({ assignment_status: 'COMPLETED', updated_at: nowIso })
          .eq('schedule_id', assess.schedule_id)
          .eq('candidate_id', assess.candidate_id);
      } catch (e) {
        console.warn('Supabase submitAssessment error', e);
      }
    }

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'QURAN_ASSESSMENT_SUBMITTED',
      entityType: 'QURAN_ASSESSMENT',
      entityId: assessmentId,
      newValue: {
        score: calc.normalized_score,
        status: 'LOCKED',
        candidate_reg: regNum,
      },
    });

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'QURAN_ASSESSMENT_LOCKED',
      entityType: 'QURAN_ASSESSMENT',
      entityId: assessmentId,
      newValue: { locked_at: nowIso },
    });

    const full = await this.getAssessmentById(assessmentId, currentUser);
    return { success: true, assessment: full.assessment || assess };
  }

  async requestRevision(
    assessmentId: string,
    revisionNotes: string,
    adminUser: { id: string; email: string; name?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!revisionNotes?.trim()) {
      return { success: false, error: 'Catatan alasan permintaan revisi wajib diisi.' };
    }

    const data = getStorageData();
    const assessIdx = (data.quranAssessments || []).findIndex((qa) => qa.id === assessmentId);
    if (assessIdx === -1) {
      return { success: false, error: 'Sesi penilaian tidak ditemukan.' };
    }

    const assess = data.quranAssessments[assessIdx];
    const nowIso = new Date().toISOString();

    assess.status = 'NEEDS_REVISION';
    assess.revision_notes = revisionNotes.trim();
    assess.reviewed_at = nowIso;
    assess.reviewed_by = adminUser.id;
    assess.updated_at = nowIso;

    // Assignment also set back to IN_PROGRESS
    const assignIdx = (data.quranAssignments || []).findIndex(
      (a) => a.schedule_id === assess.schedule_id && a.candidate_id === assess.candidate_id
    );
    if (assignIdx !== -1) {
      data.quranAssignments[assignIdx].assignment_status = 'IN_PROGRESS';
      data.quranAssignments[assignIdx].updated_at = nowIso;
    }

    // Add notification to candidate / examiner
    const cand = data.candidates.find((c) => c.id === assess.candidate_id);
    data.notifications.push({
      id: `notif-rev-${Date.now()}`,
      candidate_id: assess.candidate_id,
      title: 'Permintaan Revisi Penilaian Al-Qur\'an',
      message: `Panitia meminta koreksi penilaian Al-Qur'an untuk ${cand?.full_name || 'santri'} (${cand?.registration_number}): "${revisionNotes.trim()}".`,
      type: 'QURAN_REVISION_REQUESTED',
      is_read: false,
      created_at: nowIso,
    });

    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('quran_assessments')
          .update({
            status: 'NEEDS_REVISION',
            revision_notes: assess.revision_notes,
            reviewed_at: nowIso,
            reviewed_by: adminUser.id,
            updated_at: nowIso,
          })
          .eq('id', assessmentId);
      } catch (e) {
        console.warn('Supabase requestRevision error', e);
      }
    }

    await auditService.logAction({
      userId: adminUser.id,
      userEmail: adminUser.email,
      action: 'QURAN_ASSESSMENT_REVISION_REQUESTED',
      entityType: 'QURAN_ASSESSMENT',
      entityId: assessmentId,
      newValue: { revision_notes: revisionNotes.trim() },
    });

    return { success: true };
  }

  async adminUnlockAssessment(
    assessmentId: string,
    reason: string,
    adminUser: { id: string; email: string; role?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (adminUser.role && adminUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403): Hanya SUPER_ADMIN yang memiliki wewenang untuk membuka kunci (unlock) penilaian Al-Qur\'an.',
      };
    }

    const data = getStorageData();
    const assessIdx = (data.quranAssessments || []).findIndex((qa) => qa.id === assessmentId);
    if (assessIdx === -1) {
      return { success: false, error: 'Sesi penilaian tidak ditemukan.' };
    }

    const assess = data.quranAssessments[assessIdx];
    const nowIso = new Date().toISOString();

    assess.status = 'IN_PROGRESS';
    assess.updated_at = nowIso;
    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('quran_assessments')
          .update({ status: 'IN_PROGRESS', updated_at: nowIso })
          .eq('id', assessmentId);
      } catch (e) {
        console.warn('Supabase adminUnlockAssessment error', e);
      }
    }

    await auditService.logAction({
      userId: adminUser.id,
      userEmail: adminUser.email,
      action: 'QURAN_ASSESSMENT_UNLOCKED',
      entityType: 'QURAN_ASSESSMENT',
      entityId: assessmentId,
      newValue: { reason },
    });

    return { success: true };
  }

  // ==========================================================================
  // 6. PANITIA / ADMIN OVERVIEW
  // ==========================================================================

  async getAdminQuranOverview(filters?: {
    schedule_id?: string;
    examiner_id?: string;
    status?: string;
    search?: string;
  }): Promise<{
    stats: {
      total: number;
      pending: number;
      inProgress: number;
      submitted: number;
      locked: number;
      needsRevision: number;
    };
    items: QuranExaminerAssignment[];
  }> {
    const data = getStorageData();
    const assignments = await this.getAssignments({
      schedule_id: filters?.schedule_id,
      examiner_user_id: filters?.examiner_id,
    });

    let pending = 0;
    let inProgress = 0;
    let submitted = 0;
    let locked = 0;
    let needsRevision = 0;

    for (const a of assignments) {
      const st = a.assessment?.status;
      if (!st || st === 'NOT_STARTED') {
        pending++;
      } else if (st === 'IN_PROGRESS') {
        inProgress++;
      } else if (st === 'SUBMITTED') {
        submitted++;
      } else if (st === 'LOCKED') {
        locked++;
      } else if (st === 'NEEDS_REVISION') {
        needsRevision++;
      }
    }

    let filtered = [...assignments];

    if (filters?.status && filters.status !== 'ALL') {
      filtered = filtered.filter((a) => {
        const st = a.assessment?.status || 'NOT_STARTED';
        return st === filters.status;
      });
    }

    if (filters?.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter((a) => {
        const name = (a.candidate?.full_name || '').toLowerCase();
        const reg = (a.candidate?.registration_number || '').toLowerCase();
        const exName = (a.examiner?.full_name || '').toLowerCase();
        return name.includes(q) || reg.includes(q) || exName.includes(q);
      });
    }

    return {
      stats: {
        total: assignments.length,
        pending,
        inProgress,
        submitted,
        locked,
        needsRevision,
      },
      items: filtered,
    };
  }
}

export const quranService = new QuranService();
