import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { getStorageData, saveStorageData, generateNextRegistrationNumber } from '../lib/storage';
import { Candidate, CandidateStatus, CandidateStatusHistory } from '../types/database';
import { auditService } from './auditService';
import { documentService } from './documentService';
import { validateBiodataForFinalSubmission } from '../utils/validation';

export const candidateService = {
  async getCandidateByUserId(userId: string): Promise<Candidate | null> {
    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('candidates')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            return null;
          }
          console.warn('Supabase getCandidateByUserId error:', error.message);
          return null;
        }
        return (data as Candidate) || null;
      } catch (err: any) {
        if (err?.code === 'PGRST205' || err?.message?.includes('schema cache')) {
          return null;
        }
        console.warn('Supabase getCandidateByUserId catch:', err?.message || err);
        return null;
      }
    }

    const data = getStorageData();
    const found = data.candidates.find((c) => c.user_id === userId);
    return found || null;
  },

  async getCandidateById(candidateId: string): Promise<Candidate | null> {
    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            return null;
          }
          console.warn('Supabase getCandidateById error:', error.message);
          return null;
        }
        return (data as Candidate) || null;
      } catch (err: any) {
        if (err?.code === 'PGRST205' || err?.message?.includes('schema cache')) {
          return null;
        }
        console.warn('Supabase getCandidateById catch:', err?.message || err);
        return null;
      }
    }

    const data = getStorageData();
    const found = data.candidates.find((c) => c.id === candidateId);
    return found || null;
  },

  async getAllCandidates(options?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ candidates: Candidate[]; total: number }> {
    const { search = '', status = 'ALL', page = 1, limit = 10 } = options || {};

    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('candidates').select('*', { count: 'exact' });

        if (status && status !== 'ALL') {
          query = query.eq('status', status);
        }

        if (search.trim()) {
          const s = search.trim();
          query = query.or(`full_name.ilike.%${s}%,registration_number.ilike.%${s}%,nisn.ilike.%${s}%,school_name.ilike.%${s}%`);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            return { candidates: [], total: 0 };
          }
          console.warn('Supabase getAllCandidates error:', error.message);
          return { candidates: [], total: 0 };
        }
        return {
          candidates: (data as Candidate[]) || [],
          total: count || 0,
        };
      } catch (err: any) {
        if (err?.code === 'PGRST205' || err?.message?.includes('schema cache')) {
          return { candidates: [], total: 0 };
        }
        console.warn('Supabase getAllCandidates catch:', err?.message || err);
        return { candidates: [], total: 0 };
      }
    }

    // Fallback or demo storage
    const data = getStorageData();
    let filtered = [...data.candidates];

    if (status && status !== 'ALL') {
      filtered = filtered.filter((c) => c.status === status);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((c) =>
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.registration_number || '').toLowerCase().includes(q) ||
        (c.nisn || '').toLowerCase().includes(q) ||
        (c.nik || '').toLowerCase().includes(q) ||
        (c.school_name || '').toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      candidates: paginated,
      total,
    };
  },

  async updateCandidateDraft(
    candidateId: string,
    updates: Partial<Candidate>,
    userId?: string,
    userEmail?: string
  ): Promise<{ success: boolean; candidate?: Candidate; error?: string }> {
    const data = getStorageData();
    const index = data.candidates.findIndex((c) => c.id === candidateId);

    if (index === -1) {
      return { success: false, error: 'Data pendaftar tidak ditemukan.' };
    }

    const current = data.candidates[index];
    // Peserta can only update in DRAFT or PERLU_PERBAIKAN status
    if (current.status !== 'DRAFT' && current.status !== 'PERLU_PERBAIKAN' && updates.status === undefined) {
      return {
        success: false,
        error: 'Biodata tidak dapat diubah karena sedang dalam proses verifikasi atau sudah terverifikasi.',
      };
    }

    // Security Hardening: Strip immutable and protected administrative fields
    const {
      registration_number: _reg,
      id: _id,
      user_id: _uid,
      status: _status,
      created_at: _cat,
      ...safeUpdates
    } = updates;

    const updatedCandidate: Candidate = {
      ...current,
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    };

    data.candidates[index] = updatedCandidate;
    saveStorageData(data);

    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('candidates')
          .update({
            ...safeUpdates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidateId);
      } catch (err) {
        console.error('Supabase updateCandidateDraft error', err);
      }
    }

    await auditService.logAction({
      userId,
      userEmail,
      action: 'UPDATE_BIODATA_DRAFT',
      entityType: 'CANDIDATE',
      entityId: candidateId,
      oldValue: { status: current.status },
      newValue: { updated_fields: Object.keys(updates) },
    });

    return { success: true, candidate: updatedCandidate };
  },

  async submitCandidateFinal(
    candidateId: string,
    updates: Partial<Candidate>,
    userId?: string,
    userEmail?: string
  ): Promise<{ success: boolean; candidate?: Candidate; error?: string; missingFields?: string[] }> {
    const data = getStorageData();
    const index = data.candidates.findIndex((c) => c.id === candidateId);

    if (index === -1) {
      return { success: false, error: 'Data pendaftar tidak ditemukan.' };
    }

    const current = data.candidates[index];
    const {
      registration_number: _reg,
      id: _id,
      user_id: _uid,
      status: _status,
      created_at: _cat,
      ...safeUpdates
    } = updates;

    const merged: Candidate = {
      ...current,
      ...safeUpdates,
    };

    // Validate mandatory fields for final submission
    const validation = validateBiodataForFinalSubmission(merged);
    if (!validation.isValid) {
      return {
        success: false,
        error: 'Mohon lengkapi seluruh isian biodata wajib sebelum melakukan pengiriman final.',
        missingFields: validation.missingFields,
      };
    }

    // Validate mandatory documents
    const docSummary = await documentService.getCandidateDocumentSummary(candidateId);
    if (!docSummary.isAllRequiredUploaded) {
      const missingDocNames = docSummary.missingRequiredTypes.map((t) => t.name);
      return {
        success: false,
        error: `Terdapat berkas persyaratan wajib yang belum diunggah: ${missingDocNames.join(', ')}.`,
        missingFields: missingDocNames,
      };
    }

    if (docSummary.hasRejected) {
      return {
        success: false,
        error: 'Terdapat dokumen persyaratan yang berstatus DITOLAK oleh panitia. Silakan unggah ulang dokumen tersebut terlebih dahulu.',
      };
    }

    const oldStatus = current.status;
    const newStatus: CandidateStatus = 'TERDAFTAR';

    merged.status = newStatus;
    merged.updated_at = new Date().toISOString();
    data.candidates[index] = merged;

    // Record status history
    const historyEntry: CandidateStatusHistory = {
      id: `hist-${Date.now()}`,
      candidate_id: candidateId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: userId,
      changed_by_name: merged.full_name,
      note: 'Pengisian biodata dan upload berkas persyaratan lengkap. Data dikirim untuk verifikasi panitia.',
      created_at: new Date().toISOString(),
    };
    data.statusHistory = [historyEntry, ...data.statusHistory];
    saveStorageData(data);

    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('candidates')
          .update({
            ...safeUpdates,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidateId);

        await supabase.from('candidate_status_history').insert({
          candidate_id: candidateId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: userId,
          note: historyEntry.note,
        });
      } catch (err) {
        console.error('Supabase submitCandidateFinal error', err);
      }
    }

    await auditService.logAction({
      userId,
      userEmail,
      action: 'FINAL_SUBMISSION',
      entityType: 'CANDIDATE',
      entityId: candidateId,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus },
    });

    return { success: true, candidate: merged };
  },

  async updateCandidateStatus(params: {
    candidateId: string;
    newStatus: CandidateStatus;
    note: string;
    changedBy: string;
    changedByName: string;
    changedByEmail: string;
    userRole?: string;
  }): Promise<{ success: boolean; error?: string }> {
    // RBAC Security Enforcement
    if (params.userRole) {
      if (['PIMPINAN', 'PESERTA', 'PENGUJI_QURAN'].includes(params.userRole)) {
        return {
          success: false,
          error: `Akses Ditolak (403): Role ${params.userRole} tidak memiliki izin mengubah status peserta.`,
        };
      }

      if (['LULUS', 'CADANGAN', 'TIDAK_LULUS'].includes(params.newStatus) && params.userRole !== 'SUPER_ADMIN') {
        return {
          success: false,
          error: 'Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang menetapkan status kelulusan santri (LULUS / CADANGAN / TIDAK LULUS).',
        };
      }
    }

    const data = getStorageData();
    const index = data.candidates.findIndex((c) => c.id === params.candidateId);

    if (index === -1) {
      return { success: false, error: 'Data pendaftar tidak ditemukan.' };
    }

    const candidate = data.candidates[index];
    const oldStatus = candidate.status;
    candidate.status = params.newStatus;
    candidate.updated_at = new Date().toISOString();

    const historyEntry: CandidateStatusHistory = {
      id: `hist-${Date.now()}`,
      candidate_id: params.candidateId,
      old_status: oldStatus,
      new_status: params.newStatus,
      changed_by: params.changedBy,
      changed_by_name: params.changedByName,
      note: params.note || `Status diubah menjadi ${params.newStatus}`,
      created_at: new Date().toISOString(),
    };

    data.statusHistory = [historyEntry, ...data.statusHistory];
    saveStorageData(data);

    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('candidates')
          .update({
            status: params.newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.candidateId);

        await supabase.from('candidate_status_history').insert({
          candidate_id: params.candidateId,
          old_status: oldStatus,
          new_status: params.newStatus,
          changed_by: params.changedBy,
          note: historyEntry.note,
        });
      } catch (err) {
        console.error('Supabase updateCandidateStatus error', err);
      }
    }

    await auditService.logAction({
      userId: params.changedBy,
      userEmail: params.changedByEmail,
      action: 'UPDATE_CANDIDATE_STATUS',
      entityType: 'CANDIDATE',
      entityId: params.candidateId,
      oldValue: { status: oldStatus },
      newValue: { status: params.newStatus, note: params.note },
    });

    return { success: true };
  },

  async getStatusHistory(candidateId: string): Promise<CandidateStatusHistory[]> {
    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('candidate_status_history')
          .select('*')
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false });

        if (!error && data) return data as CandidateStatusHistory[];
      } catch (err) {
        console.error('Supabase getStatusHistory error', err);
      }
    }

    const data = getStorageData();
    return data.statusHistory
      .filter((h) => h.candidate_id === candidateId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
};
