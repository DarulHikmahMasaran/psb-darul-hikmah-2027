import { getStorageData, saveStorageData } from '../lib/storage';
import { auditService } from './auditService';
import {
  SelectionScoringVersion,
  SelectionScoringComponent,
  SelectionPassingRuleVersion,
  SelectionTieBreaker,
  SelectionRun,
  SelectionRunComponentSnapshot,
  SelectionResult,
  SelectionResultComponent,
  SelectionCompletenessReport,
  ComponentFailureDetail,
  ComponentSourceStatus,
  CandidateCompletenessStatus,
  ExecutiveSelectionSummary,
} from '../types/selection';
import { ExamAttempt } from '../types/cbt';
import { QuranAssessment } from '../types/quran';
import { defaultSelectionTieBreakers, defaultScoringVersionId } from '../lib/selectionSeeds';

export class SelectionScoringService {
  // ==========================================================================
  // 1. SCORING VERSIONS & WEIGHTS
  // ==========================================================================

  async getScoringVersions(currentUser?: { id?: string; role?: string; email?: string }): Promise<SelectionScoringVersion[]> {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat konfigurasi bobot penilaian seleksi. Akses untuk PANITIA, PIMPINAN, PENGUJI_QURAN, dan PESERTA ditolak.');
    }
    const data = getStorageData();
    const versions = data.selectionScoringVersions || [];
    const components = data.selectionScoringComponents || [];
    return versions.map(v => ({
      ...v,
      components: components.filter(c => c.scoring_version_id === v.id),
    }));
  }

  async getScoringVersionById(id: string, currentUser?: { id?: string; role?: string; email?: string }): Promise<SelectionScoringVersion | null> {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat konfigurasi bobot penilaian seleksi.');
    }
    const list = await this.getScoringVersions();
    return list.find(v => v.id === id) || null;
  }

  async queryScoringVersions(currentUser?: { id?: string; role?: string; email?: string }): Promise<{ success: boolean; versions: SelectionScoringVersion[]; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        versions: [],
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat konfigurasi bobot penilaian seleksi (SCORE_MANAGE). PIMPINAN, PANITIA, PENGUJI_QURAN, dan PESERTA dilarang mengakses konfigurasi bobot.',
      };
    }
    try {
      const versions = await this.getScoringVersions(currentUser);
      return { success: true, versions };
    } catch (err: any) {
      return { success: false, versions: [], error: err?.message };
    }
  }

  async createScoringVersion(
    payload: {
      version_name: string;
      academic_year?: string;
      notes?: string;
      components: Array<{
        component_code: 'ACADEMIC' | 'QURAN' | 'PSYCHOTEST';
        weight: number;
        source_exam_id?: string;
        source_schedule_id?: string;
      }>;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; version?: SelectionScoringVersion; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang membuat konfigurasi bobot penilaian seleksi (SCORE_MANAGE).',
      };
    }

    if (!payload.version_name?.trim()) {
      return { success: false, error: 'Nama versi konfigurasi bobot wajib diisi.' };
    }

    // Validate weights sum exactly 100.00%
    const totalWeight = payload.components.reduce((sum, c) => sum + Number(c.weight || 0), 0);
    const roundedTotal = Math.round(totalWeight * 100) / 100;
    if (Math.abs(roundedTotal - 100) > 0.001) {
      return {
        success: false,
        error: `Total bobot harus tepat 100.00% (Total saat ini: ${roundedTotal}%). Validasi ditolak.`,
      };
    }

    // Validate unique component codes
    const codes = payload.components.map(c => c.component_code);
    if (new Set(codes).size !== codes.length) {
      return { success: false, error: 'Komponen penilaian tidak boleh duplikat dalam satu versi.' };
    }

    const data = getStorageData();
    const versionId = 'sc-ver-' + Date.now();
    const newVersion: SelectionScoringVersion = {
      id: versionId,
      version_name: payload.version_name.trim(),
      academic_year: payload.academic_year || '2027/2028',
      status: 'DRAFT',
      notes: payload.notes?.trim(),
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
    };

    const newComponents: SelectionScoringComponent[] = payload.components.map((c, idx) => ({
      id: 'ssc-' + versionId + '-' + (idx + 1),
      scoring_version_id: versionId,
      component_code: c.component_code,
      weight: Number(c.weight),
      source_exam_id: c.source_exam_id,
      source_schedule_id: c.source_schedule_id,
      created_at: new Date().toISOString(),
    }));

    data.selectionScoringVersions.unshift(newVersion);
    data.selectionScoringComponents.push(...newComponents);
    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'SCORING_VERSION_CREATED' as any,
      entityType: 'SELECTION_SCORING_VERSION',
      entityId: versionId,
      newValue: { version_name: newVersion.version_name, components: newComponents },
    });

    return {
      success: true,
      version: { ...newVersion, components: newComponents },
    };
  }

  async updateScoringVersion(
    id: string,
    payload: {
      version_name?: string;
      notes?: string;
      components?: Array<{
        component_code: 'ACADEMIC' | 'QURAN' | 'PSYCHOTEST';
        weight: number;
        source_exam_id?: string;
        source_schedule_id?: string;
      }>;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; version?: SelectionScoringVersion; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang mengubah konfigurasi bobot (SCORE_MANAGE).',
      };
    }

    const data = getStorageData();
    const idx = data.selectionScoringVersions.findIndex(v => v.id === id);
    if (idx === -1) {
      return { success: false, error: 'Versi konfigurasi bobot tidak ditemukan.' };
    }

    const ver = data.selectionScoringVersions[idx];
    if (ver.status === 'APPROVED' || ver.status === 'ARCHIVED') {
      return {
        success: false,
        error: 'Versi konfigurasi yang sudah disetujui (APPROVED/ARCHIVED) bersifat immutable dan tidak boleh diubah. Buat versi baru untuk mengubah bobot.',
      };
    }

    if (payload.components) {
      const totalWeight = payload.components.reduce((sum, c) => sum + Number(c.weight || 0), 0);
      const roundedTotal = Math.round(totalWeight * 100) / 100;
      if (Math.abs(roundedTotal - 100) > 0.001) {
        return {
          success: false,
          error: `Total bobot harus tepat 100.00% (Total saat ini: ${roundedTotal}%). Validasi ditolak.`,
        };
      }
    }

    if (payload.version_name) ver.version_name = payload.version_name.trim();
    if (payload.notes !== undefined) ver.notes = payload.notes.trim();

    if (payload.components) {
      data.selectionScoringComponents = data.selectionScoringComponents.filter(c => c.scoring_version_id !== id);
      const newComps: SelectionScoringComponent[] = payload.components.map((c, i) => ({
        id: 'ssc-' + id + '-' + (i + 1),
        scoring_version_id: id,
        component_code: c.component_code,
        weight: Number(c.weight),
        source_exam_id: c.source_exam_id,
        source_schedule_id: c.source_schedule_id,
        created_at: new Date().toISOString(),
      }));
      data.selectionScoringComponents.push(...newComps);
    }

    saveStorageData(data);
    return { success: true, version: await this.getScoringVersionById(id) || undefined };
  }

  async approveScoringVersion(
    id: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; version?: SelectionScoringVersion; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang menyetujui konfigurasi bobot (RESULT_APPROVE).',
      };
    }

    const data = getStorageData();
    const ver = data.selectionScoringVersions.find(v => v.id === id);
    if (!ver) return { success: false, error: 'Versi konfigurasi tidak ditemukan.' };

    const comps = data.selectionScoringComponents.filter(c => c.scoring_version_id === id);
    const totalWeight = comps.reduce((s, c) => s + Number(c.weight), 0);
    if (Math.abs(totalWeight - 100) > 0.001) {
      return { success: false, error: `Bobot belum tepat 100.00% (Total: ${totalWeight}%). Tidak dapat disetujui.` };
    }

    ver.status = 'APPROVED';
    ver.approved_by = currentUser.id;
    ver.approved_at = new Date().toISOString();
    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'SCORING_VERSION_APPROVED' as any,
      entityType: 'SELECTION_SCORING_VERSION',
      entityId: id,
      newValue: { version_name: ver.version_name, approved_at: ver.approved_at },
    });

    return { success: true, version: ver };
  }

  // ==========================================================================
  // 2. PASSING RULE VERSIONS
  // ==========================================================================

  async getPassingRuleVersions(currentUser?: { id?: string; role?: string; email?: string }): Promise<SelectionPassingRuleVersion[]> {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat aturan passing grade minimal. Akses untuk PANITIA, PIMPINAN, PENGUJI_QURAN, dan PESERTA ditolak.');
    }
    const data = getStorageData();
    return data.selectionPassingRuleVersions || [];
  }

  async getPassingRuleVersionById(id: string, currentUser?: { id?: string; role?: string; email?: string }): Promise<SelectionPassingRuleVersion | null> {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat aturan passing grade minimal.');
    }
    const list = await this.getPassingRuleVersions();
    return list.find(v => v.id === id) || null;
  }

  async queryPassingRuleVersions(currentUser?: { id?: string; role?: string; email?: string }): Promise<{ success: boolean; versions: SelectionPassingRuleVersion[]; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        versions: [],
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat aturan passing grade minimal (PASSING_RULE_MANAGE). PIMPINAN, PANITIA, PENGUJI_QURAN, dan PESERTA dilarang mengakses konfigurasi passing rules.',
      };
    }
    try {
      const versions = await this.getPassingRuleVersions(currentUser);
      return { success: true, versions };
    } catch (err: any) {
      return { success: false, versions: [], error: err?.message };
    }
  }

  async createPassingRuleVersion(
    payload: {
      version_name: string;
      academic_year?: string;
      min_academic: number | null;
      min_quran: number | null;
      min_psychotest: number | null;
      min_final_score: number | null;
      notes?: string;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; version?: SelectionPassingRuleVersion; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang membuat aturan kelulusan minimal (PASSING_RULE_MANAGE).',
      };
    }

    if (!payload.version_name?.trim()) {
      return { success: false, error: 'Nama versi aturan passing grade wajib diisi.' };
    }

    const data = getStorageData();
    const ruleId = 'pr-ver-' + Date.now();
    const newRule: SelectionPassingRuleVersion = {
      id: ruleId,
      version_name: payload.version_name.trim(),
      academic_year: payload.academic_year || '2027/2028',
      min_academic: payload.min_academic !== null && payload.min_academic !== undefined ? Number(payload.min_academic) : null,
      min_quran: payload.min_quran !== null && payload.min_quran !== undefined ? Number(payload.min_quran) : null,
      min_psychotest: payload.min_psychotest !== null && payload.min_psychotest !== undefined ? Number(payload.min_psychotest) : null,
      min_final_score: payload.min_final_score !== null && payload.min_final_score !== undefined ? Number(payload.min_final_score) : null,
      status: 'DRAFT',
      notes: payload.notes?.trim(),
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
    };

    data.selectionPassingRuleVersions.unshift(newRule);
    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'PASSING_RULE_CREATED' as any,
      entityType: 'SELECTION_PASSING_RULE_VERSION',
      entityId: ruleId,
      newValue: newRule,
    });

    return { success: true, version: newRule };
  }

  async updatePassingRuleVersion(
    id: string,
    payload: {
      version_name?: string;
      min_academic?: number | null;
      min_quran?: number | null;
      min_psychotest?: number | null;
      min_final_score?: number | null;
      notes?: string;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; version?: SelectionPassingRuleVersion; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang mengubah aturan passing grade.',
      };
    }

    const data = getStorageData();
    const rule = data.selectionPassingRuleVersions.find(r => r.id === id);
    if (!rule) return { success: false, error: 'Aturan passing grade tidak ditemukan.' };

    if (rule.status === 'APPROVED' || rule.status === 'ARCHIVED') {
      return {
        success: false,
        error: 'Aturan passing grade yang sudah APPROVED bersifat immutable. Buat versi aturan baru.',
      };
    }

    if (payload.version_name) rule.version_name = payload.version_name.trim();
    if (payload.min_academic !== undefined) rule.min_academic = payload.min_academic;
    if (payload.min_quran !== undefined) rule.min_quran = payload.min_quran;
    if (payload.min_psychotest !== undefined) rule.min_psychotest = payload.min_psychotest;
    if (payload.min_final_score !== undefined) rule.min_final_score = payload.min_final_score;
    if (payload.notes !== undefined) rule.notes = payload.notes.trim();

    saveStorageData(data);
    return { success: true, version: rule };
  }

  async approvePassingRuleVersion(
    id: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; version?: SelectionPassingRuleVersion; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang menyetujui aturan kelulusan (RESULT_APPROVE).',
      };
    }

    const data = getStorageData();
    const rule = data.selectionPassingRuleVersions.find(r => r.id === id);
    if (!rule) return { success: false, error: 'Aturan passing grade tidak ditemukan.' };

    rule.status = 'APPROVED';
    rule.approved_by = currentUser.id;
    rule.approved_at = new Date().toISOString();
    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'PASSING_RULE_APPROVED' as any,
      entityType: 'SELECTION_PASSING_RULE_VERSION',
      entityId: id,
      newValue: { version_name: rule.version_name, approved_at: rule.approved_at },
    });

    return { success: true, version: rule };
  }

  // ==========================================================================
  // 3. TIE BREAKERS
  // ==========================================================================

  async getTieBreakers(scoringVersionId?: string, currentUser?: { id?: string; role?: string; email?: string }): Promise<SelectionTieBreaker[]> {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat konfigurasi tie-breaker seleksi.');
    }
    const data = getStorageData();
    let list = data.selectionTieBreakers || [];
    if (scoringVersionId) {
      const versionSpecific = list.filter(t => t.scoring_version_id === scoringVersionId);
      if (versionSpecific.length > 0) {
        list = versionSpecific;
      } else {
        list = list.filter(t => !t.scoring_version_id || t.scoring_version_id === defaultScoringVersionId);
      }
    }
    if (list.length === 0) {
      list = defaultSelectionTieBreakers;
    }
    return [...list].sort((a, b) => a.priority - b.priority);
  }

  async queryTieBreakers(scoringVersionId?: string, currentUser?: { id?: string; role?: string; email?: string }): Promise<{ success: boolean; tieBreakers: SelectionTieBreaker[]; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        tieBreakers: [],
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat konfigurasi tie-breaker.',
      };
    }
    try {
      const tieBreakers = await this.getTieBreakers(scoringVersionId, currentUser);
      return { success: true, tieBreakers };
    } catch (err: any) {
      return { success: false, tieBreakers: [], error: err?.message };
    }
  }

  async updateTieBreakers(
    items: Array<{ priority: number; rule_code: any; direction: 'DESC' | 'ASC' }>,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang mengatur aturan tie-break.',
      };
    }

    const data = getStorageData();
    const newItems: SelectionTieBreaker[] = items.map((it, idx) => ({
      id: 'tb-' + Date.now() + '-' + (idx + 1),
      priority: it.priority,
      rule_code: it.rule_code,
      direction: it.direction,
      created_at: new Date().toISOString(),
    }));

    data.selectionTieBreakers = newItems;
    saveStorageData(data);
    return { success: true };
  }

  // ==========================================================================
  // 4. SELECTION RUNS & VALIDATION
  // ==========================================================================

  async getSelectionRuns(currentUser?: { id?: string; role?: string; email?: string }): Promise<SelectionRun[]> {
    if (currentUser) {
      if (currentUser.role === 'PIMPINAN') {
        throw new Error('Akses Ditolak (403 Forbidden): Pimpinan hanya mengakses ringkasan eksekutif melalui portal pimpinan, bukan tabel internal Selection Runs.');
      }
      if (currentUser.role === 'PENGUJI_QURAN') {
        throw new Error('Akses Ditolak (403 Forbidden): Penguji Al-Qur\'an tidak memiliki izin melihat data Final Selection.');
      }
      if (currentUser.role === 'PESERTA') {
        throw new Error('Akses Ditolak (403 Forbidden): Calon santri tidak memiliki akses ke Selection Runs.');
      }
      if (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'PANITIA') {
        throw new Error('Akses Ditolak (403 Forbidden): Akses data Selection Runs ditolak.');
      }
    }

    const data = getStorageData();
    let runs = data.selectionRuns || [];

    if (currentUser && currentUser.role === 'PANITIA') {
      runs = runs.filter(r => ['CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED'].includes(r.status));
    }

    const isSuperAdmin = !currentUser || currentUser.role === 'SUPER_ADMIN';

    return runs.map(r => ({
      ...r,
      scoring_version: isSuperAdmin ? data.selectionScoringVersions.find(v => v.id === r.scoring_version_id) : undefined,
      passing_rule_version: isSuperAdmin ? data.selectionPassingRuleVersions.find(v => v.id === r.passing_rule_version_id) : undefined,
      component_snapshots: isSuperAdmin ? (data.selectionRunComponentSnapshots || []).filter(s => s.selection_run_id === r.id) : undefined,
    }));
  }

  async getSelectionRunById(id: string, currentUser?: { id?: string; role?: string; email?: string }): Promise<SelectionRun | null> {
    const list = await this.getSelectionRuns(currentUser);
    return list.find(r => r.id === id) || null;
  }

  async getRunComponentSnapshots(runId: string, currentUser?: { id?: string; role?: string; email?: string }): Promise<SelectionRunComponentSnapshot[]> {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('Akses Ditolak (403 Forbidden): Snapshot internal bobot & passing rule komponen hanya dapat diakses oleh SUPER_ADMIN.');
    }
    const data = getStorageData();
    return (data.selectionRunComponentSnapshots || []).filter(s => s.selection_run_id === runId);
  }

  async queryRunComponentSnapshots(runId: string, currentUser?: { id?: string; role?: string; email?: string }): Promise<{ success: boolean; snapshots: SelectionRunComponentSnapshot[]; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        snapshots: [],
        error: 'Akses Ditolak (403 Forbidden): Snapshot internal bobot & passing rule komponen hanya dapat diakses oleh SUPER_ADMIN.',
      };
    }
    try {
      const snapshots = await this.getRunComponentSnapshots(runId, currentUser);
      return { success: true, snapshots };
    } catch (err: any) {
      return { success: false, snapshots: [], error: err?.message };
    }
  }

  async createSelectionRun(
    payload: {
      run_name: string;
      academic_year?: string;
      scoring_version_id: string;
      passing_rule_version_id: string;
      quota?: number;
      reserve_count?: number;
      notes?: string;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; run?: SelectionRun; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang membuat Selection Run baru (SELECTION_RUN_MANAGE).',
      };
    }

    const data = getStorageData();
    const scoringVer = data.selectionScoringVersions.find(v => v.id === payload.scoring_version_id);
    if (!scoringVer || scoringVer.status !== 'APPROVED') {
      return {
        success: false,
        error: 'Versi konfigurasi bobot harus berstatus APPROVED sebelum digunakan dalam Selection Run.',
      };
    }

    const passingVer = data.selectionPassingRuleVersions.find(v => v.id === payload.passing_rule_version_id);
    if (!passingVer || passingVer.status !== 'APPROVED') {
      return {
        success: false,
        error: 'Versi aturan passing grade harus berstatus APPROVED sebelum digunakan dalam Selection Run.',
      };
    }

    // Default quota from system settings
    const settingQuota = data.settings.find(s => s.key === 'target_quota');
    const defaultQuota = settingQuota ? parseInt(settingQuota.value, 10) : 120;
    const finalQuota = payload.quota && payload.quota > 0 ? payload.quota : defaultQuota;
    const finalReserve = payload.reserve_count !== undefined && payload.reserve_count >= 0 ? payload.reserve_count : 20;

    const runId = 'run-' + Date.now();
    const comps = data.selectionScoringComponents.filter(c => c.scoring_version_id === payload.scoring_version_id);

    // Save immutable snapshot of component weights & passing minimums for this run
    const runSnapshots: SelectionRunComponentSnapshot[] = comps.map((comp, idx) => {
      let minScore: number | null = null;
      if (comp.component_code === 'ACADEMIC') minScore = passingVer.min_academic;
      else if (comp.component_code === 'QURAN') minScore = passingVer.min_quran;
      else if (comp.component_code === 'PSYCHOTEST') minScore = passingVer.min_psychotest;

      return {
        id: `srcs-${runId}-${idx + 1}`,
        selection_run_id: runId,
        component_code: comp.component_code,
        weight: comp.weight,
        min_score: minScore,
        source_exam_id: comp.source_exam_id,
        source_schedule_id: comp.source_schedule_id,
        created_at: new Date().toISOString(),
      };
    });

    if (!data.selectionRunComponentSnapshots) {
      data.selectionRunComponentSnapshots = [];
    }
    data.selectionRunComponentSnapshots.push(...runSnapshots);

    const newRun: SelectionRun = {
      id: runId,
      academic_year: payload.academic_year || scoringVer.academic_year || '2027/2028',
      run_name: payload.run_name.trim(),
      scoring_version_id: payload.scoring_version_id,
      passing_rule_version_id: payload.passing_rule_version_id,
      quota: finalQuota,
      reserve_count: finalReserve,
      status: 'DRAFT',
      candidate_count: data.candidates.length,
      complete_count: 0,
      eligible_count: 0,
      lulus_count: 0,
      reserve_count_actual: 0,
      tidak_lulus_count: 0,
      tie_pending_count: 0,
      created_by: currentUser.id,
      notes: payload.notes?.trim(),
      is_current: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      component_snapshots: runSnapshots,
    };

    data.selectionRuns.unshift(newRun);
    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'SELECTION_RUN_CREATED' as any,
      entityType: 'SELECTION_RUN',
      entityId: runId,
      newValue: { run_name: newRun.run_name, quota: finalQuota, reserve_count: finalReserve },
    });

    return { success: true, run: newRun };
  }

  async validateSelectionRun(runId: string): Promise<{
    valid: boolean;
    errors: string[];
    report: SelectionCompletenessReport;
    statusAmbiguity: boolean;
  }> {
    const data = getStorageData();
    const run = data.selectionRuns.find(r => r.id === runId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!run) {
      return {
        valid: false,
        errors: ['Selection Run tidak ditemukan.'],
        report: {
          totalCandidates: 0,
          hasAcademic: 0,
          hasQuran: 0,
          hasPsychotest: 0,
          completeCount: 0,
          incompleteCount: 0,
          missingAcademicCount: 0,
          missingQuranCount: 0,
          missingPsychotestCount: 0,
          ambiguousCount: 0,
          invalidCount: 0,
          sourceAmbiguityWarnings: [],
          candidateBreakdowns: [],
        },
        statusAmbiguity: false,
      };
    }

    const scoringVer = data.selectionScoringVersions.find(v => v.id === run.scoring_version_id);
    if (!scoringVer || scoringVer.status !== 'APPROVED') {
      errors.push('Scoring version harus berstatus APPROVED.');
    }

    const passingVer = data.selectionPassingRuleVersions.find(v => v.id === run.passing_rule_version_id);
    if (!passingVer || passingVer.status !== 'APPROVED') {
      errors.push('Passing rule version harus berstatus APPROVED.');
    }

    const comps = data.selectionScoringComponents.filter(c => c.scoring_version_id === run.scoring_version_id);
    const acadComp = comps.find(c => c.component_code === 'ACADEMIC');
    const quranComp = comps.find(c => c.component_code === 'QURAN');
    const psiComp = comps.find(c => c.component_code === 'PSYCHOTEST');

    let statusAmbiguity = false;
    let ambiguousCount = 0;
    let invalidCount = 0;

    const academicExams = data.exams.filter(e => e.exam_type === 'ACADEMIC' || (!e.exam_type && !e.id.includes('psikotes')));
    const psiExams = data.exams.filter(e => e.exam_type === 'PSYCHOTEST' || e.id.includes('psikotes'));

    const candidates = data.candidates || [];
    let hasAcademic = 0;
    let hasQuran = 0;
    let hasPsychotest = 0;
    let completeCount = 0;
    let missingAcad = 0;
    let missingQur = 0;
    let missingPsi = 0;
    const candidateBreakdowns: CandidateCompletenessStatus[] = [];

    for (const cand of candidates) {
      // 1. Academic Assessment / Attempts
      const acadAttempts = (data.examAttempts || []).filter(
        a =>
          a.candidate_id === cand.id &&
          (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') &&
          (acadComp?.source_exam_id ? a.exam_id === acadComp.source_exam_id : academicExams.some(e => e.id === a.exam_id))
      );

      let acadStatus: ComponentSourceStatus = 'OK';
      let acadDetail: string | undefined = undefined;

      if (acadAttempts.length === 0) {
        acadStatus = 'MISSING';
        acadDetail = 'Belum ada ujian Akademik yang diselesaikan.';
        missingAcad++;
      } else if (acadAttempts.length > 1) {
        acadStatus = 'AMBIGUOUS';
        acadDetail = `Terdapat ${acadAttempts.length} attempt Akademik valid. Tentukan source_exam_id eksplisit.`;
        statusAmbiguity = true;
        ambiguousCount++;
        errors.push(`SOURCE_AMBIGUOUS: Peserta ${cand.registration_number || cand.full_name} memiliki ${acadAttempts.length} attempt ujian Akademik yang valid. Super Admin wajib menentukan paket ujian sumber secara eksplisit.`);
      } else {
        const attempt = acadAttempts[0];
        if (attempt.max_score <= 0) {
          acadStatus = 'INVALID';
          acadDetail = `max_score <= 0 (${attempt.max_score}). Source score invalid.`;
          invalidCount++;
          errors.push(`Nilai Akademik peserta ${cand.registration_number || cand.full_name} memiliki max_score <= 0. Source score invalid.`);
        } else {
          const norm = attempt.normalized_score !== undefined && attempt.normalized_score !== null
            ? Number(attempt.normalized_score)
            : (attempt.raw_score / attempt.max_score) * 100;
          if (isNaN(norm) || norm < 0 || norm > 100) {
            acadStatus = 'INVALID';
            acadDetail = `Normalized score ${norm} di luar rentang 0-100.`;
            invalidCount++;
            errors.push(`Nilai Akademik peserta ${cand.registration_number || cand.full_name} menghasilkan normalized score ${norm}. Source score invalid.`);
          } else {
            hasAcademic++;
          }
        }
      }

      // 2. Psychotest Assessment / Attempts
      const psiAttempts = (data.examAttempts || []).filter(
        a =>
          a.candidate_id === cand.id &&
          (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') &&
          (psiComp?.source_exam_id ? a.exam_id === psiComp.source_exam_id : psiExams.some(e => e.id === a.exam_id))
      );

      let psiStatus: ComponentSourceStatus = 'OK';
      let psiDetail: string | undefined = undefined;

      if (psiAttempts.length === 0) {
        psiStatus = 'MISSING';
        psiDetail = 'Belum ada ujian Psikotes yang diselesaikan.';
        missingPsi++;
      } else if (psiAttempts.length > 1) {
        psiStatus = 'AMBIGUOUS';
        psiDetail = `Terdapat ${psiAttempts.length} attempt Psikotes valid. Tentukan source_exam_id eksplisit.`;
        statusAmbiguity = true;
        ambiguousCount++;
        errors.push(`SOURCE_AMBIGUOUS: Peserta ${cand.registration_number || cand.full_name} memiliki ${psiAttempts.length} attempt Psikotes yang valid. Super Admin wajib menentukan paket ujian sumber secara eksplisit.`);
      } else {
        const attempt = psiAttempts[0];
        if (attempt.max_score <= 0) {
          psiStatus = 'INVALID';
          psiDetail = `max_score <= 0 (${attempt.max_score}). Source score invalid.`;
          invalidCount++;
          errors.push(`Nilai Psikotes peserta ${cand.registration_number || cand.full_name} memiliki max_score <= 0. Source score invalid.`);
        } else {
          const norm = attempt.normalized_score !== undefined && attempt.normalized_score !== null
            ? Number(attempt.normalized_score)
            : (attempt.raw_score / attempt.max_score) * 100;
          if (isNaN(norm) || norm < 0 || norm > 100) {
            psiStatus = 'INVALID';
            psiDetail = `Normalized score ${norm} di luar rentang 0-100.`;
            invalidCount++;
            errors.push(`Nilai Psikotes peserta ${cand.registration_number || cand.full_name} menghasilkan normalized score ${norm}. Source score invalid.`);
          } else {
            hasPsychotest++;
          }
        }
      }

      // 3. Quran Assessments
      const quranLocked = (data.quranAssessments || []).filter(
        a =>
          a.candidate_id === cand.id &&
          a.status === 'LOCKED' &&
          (quranComp?.source_schedule_id ? (a.schedule_id === quranComp.source_schedule_id || a.id === quranComp.source_schedule_id) : true)
      );

      let quranStatus: ComponentSourceStatus = 'OK';
      let quranDetail: string | undefined = undefined;

      if (quranLocked.length === 0) {
        quranStatus = 'MISSING';
        quranDetail = 'Belum ada penilaian Qur\'an LOCKED.';
        missingQur++;
      } else if (quranLocked.length > 1) {
        quranStatus = 'AMBIGUOUS';
        quranDetail = `Terdapat ${quranLocked.length} asesmen Qur'an LOCKED. Tentukan source_schedule_id eksplisit.`;
        statusAmbiguity = true;
        ambiguousCount++;
        errors.push(`SOURCE_AMBIGUOUS: Peserta ${cand.registration_number || cand.full_name} memiliki ${quranLocked.length} asesmen Al-Qur'an LOCKED. Super Admin wajib menentukan asesmen sumber secara eksplisit.`);
      } else {
        const assessment = quranLocked[0];
        const norm = assessment.normalized_score !== undefined && assessment.normalized_score !== null
          ? Number(assessment.normalized_score)
          : Number(assessment.raw_score);
        if (isNaN(norm) || norm < 0 || norm > 100) {
          quranStatus = 'INVALID';
          quranDetail = `Normalized score ${norm} di luar rentang 0-100.`;
          invalidCount++;
          errors.push(`Nilai Al-Qur'an peserta ${cand.registration_number || cand.full_name} menghasilkan normalized score ${norm}. Source score invalid.`);
        } else {
          hasQuran++;
        }
      }

      if (acadStatus === 'OK' && psiStatus === 'OK' && quranStatus === 'OK') {
        completeCount++;
      }

      candidateBreakdowns.push({
        candidate_id: cand.id,
        registration_number: cand.registration_number || '-',
        full_name: cand.full_name,
        academic_status: acadStatus,
        quran_status: quranStatus,
        psychotest_status: psiStatus,
        academic_details: acadDetail,
        quran_details: quranDetail,
        psychotest_details: psiDetail,
      });
    }

    if (statusAmbiguity && run.status !== 'APPROVED') {
      run.status = 'SOURCE_AMBIGUOUS';
      saveStorageData(data);
    }

    const report: SelectionCompletenessReport = {
      totalCandidates: candidates.length,
      hasAcademic,
      hasQuran,
      hasPsychotest,
      completeCount,
      incompleteCount: candidates.length - completeCount,
      missingAcademicCount: missingAcad,
      missingQuranCount: missingQur,
      missingPsychotestCount: missingPsi,
      ambiguousCount,
      invalidCount,
      sourceAmbiguityWarnings: warnings,
      candidateBreakdowns,
    };

    return {
      valid: errors.length === 0,
      errors,
      report,
      statusAmbiguity,
    };
  }

  // ==========================================================================
  // 5. CALCULATION ENGINE (Deterministic, Full Precision, Atomic, Idempotent)
  // ==========================================================================

  async calculateSelectionRun(
    runId: string,
    currentUser?: { id?: string; role?: string; email?: string },
    previewOnly = false
  ): Promise<{
    success: boolean;
    results?: SelectionResult[];
    run?: SelectionRun;
    error?: string;
  }> {
    if (!previewOnly && (!currentUser || currentUser.role !== 'SUPER_ADMIN')) {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang menjalankan kalkulasi seleksi resmi (SCORE_RECALCULATE).',
      };
    }

    const data = getStorageData();
    const run = data.selectionRuns.find(r => r.id === runId);
    if (!run) {
      return { success: false, error: 'Selection Run tidak ditemukan.' };
    }

    if (!previewOnly && (run.status === 'APPROVED' || run.status === 'SUPERSEDED')) {
      return {
        success: false,
        error: `Selection Run ini berstatus '${run.status}' (IMMUTABLE). Hasil yang telah disetujui tidak boleh dihitung ulang. Silakan buat Selection Run baru.`,
      };
    }

    // Validate configuration
    const val = await this.validateSelectionRun(runId);
    if (!val.valid) {
      if (val.statusAmbiguity) {
        run.status = 'SOURCE_AMBIGUOUS';
        saveStorageData(data);
        return {
          success: false,
          error: `Kalkulasi DIBLOKIR: Terdeteksi ambiguitas sumber nilai (SOURCE_AMBIGUOUS). Super Admin wajib menentukan paket ujian/asesmen resmi secara eksplisit. ${val.errors.join('; ')}`,
        };
      }
      return {
        success: false,
        error: `Validasi Selection Run gagal: ${val.errors.join('; ')}`,
      };
    }

    const scoringVer = data.selectionScoringVersions.find(v => v.id === run.scoring_version_id)!;
    const comps = data.selectionScoringComponents.filter(c => c.scoring_version_id === run.scoring_version_id);
    const acadComp = comps.find(c => c.component_code === 'ACADEMIC')!;
    const quranComp = comps.find(c => c.component_code === 'QURAN')!;
    const psiComp = comps.find(c => c.component_code === 'PSYCHOTEST')!;

    const passingVer = data.selectionPassingRuleVersions.find(v => v.id === run.passing_rule_version_id)!;
    const tieBreakers = await this.getTieBreakers(run.scoring_version_id);

    const candidates = data.candidates || [];
    const calcTimestamp = new Date().toISOString();

    const academicExams = data.exams.filter(e => e.exam_type === 'ACADEMIC' || (!e.exam_type && !e.id.includes('psikotes')));
    const psiExams = data.exams.filter(e => e.exam_type === 'PSYCHOTEST' || e.id.includes('psikotes'));

    const calculatedResults: SelectionResult[] = [];
    const calculatedComponents: SelectionResultComponent[] = [];

    // Step 1: Calculate candidate scores & check minimums
    for (const cand of candidates) {
      // Find sources without silent fallback or ambiguity
      const acadAttempts = (data.examAttempts || []).filter(
        a =>
          a.candidate_id === cand.id &&
          (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') &&
          (acadComp.source_exam_id ? a.exam_id === acadComp.source_exam_id : academicExams.some(e => e.id === a.exam_id))
      );

      const psiAttempts = (data.examAttempts || []).filter(
        a =>
          a.candidate_id === cand.id &&
          (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') &&
          (psiComp.source_exam_id ? a.exam_id === psiComp.source_exam_id : psiExams.some(e => e.id === a.exam_id))
      );

      const quranLockedAssessments = (data.quranAssessments || []).filter(
        a =>
          a.candidate_id === cand.id &&
          a.status === 'LOCKED' &&
          (quranComp.source_schedule_id ? (a.schedule_id === quranComp.source_schedule_id || a.id === quranComp.source_schedule_id) : true)
      );

      if (acadAttempts.length > 1 || psiAttempts.length > 1 || quranLockedAssessments.length > 1) {
        run.status = 'SOURCE_AMBIGUOUS';
        saveStorageData(data);
        return {
          success: false,
          error: `Kalkulasi DIBLOKIR: Terdeteksi ambiguitas sumber nilai (SOURCE_AMBIGUOUS) pada peserta ${cand.registration_number || cand.full_name}. Super Admin wajib menentukan paket ujian/asesmen resmi secara eksplisit.`,
        };
      }

      const acadAttempt = acadAttempts[0];
      const psiAttempt = psiAttempts[0];
      const quranAssessment = quranLockedAssessments[0];

      const resultId = 'sr-' + runId + '-' + cand.id;

      // Incomplete Check
      if (!acadAttempt || !quranAssessment || !psiAttempt) {
        const failureList: ComponentFailureDetail[] = [];
        if (!acadAttempt) failureList.push({ component: 'ACADEMIC', score: 0, minimum: 0, message: 'Belum mengikuti/menyelesaikan Tes Akademik' });
        if (!quranAssessment) failureList.push({ component: 'QURAN', score: 0, minimum: 0, message: 'Belum mengikuti/dinilai pada Tes Al-Qur\'an' });
        if (!psiAttempt) failureList.push({ component: 'PSYCHOTEST', score: 0, minimum: 0, message: 'Belum mengikuti/menyelesaikan Psikotes CBT' });

        calculatedResults.push({
          id: resultId,
          selection_run_id: runId,
          candidate_id: cand.id,
          academic_score: null,
          quran_score: null,
          psychotest_score: null,
          final_score: null,
          display_final_score: '-',
          calculation_precision: 4,
          overall_rank: null,
          eligible_rank: null,
          eligibility_status: 'INCOMPLETE',
          result_status: 'BELUM_DITETAPKAN',
          failure_reasons: failureList,
          decision_reason: 'Nilai ujian belum lengkap pada 3 komponen seleksi.',
          calculated_at: calcTimestamp,
          created_at: calcTimestamp,
          candidate: cand,
        });
        continue;
      }

      // Normalization validation (STRICT: NO CLAMPING, 0 <= score <= 100)
      if (acadAttempt.max_score <= 0) {
        return {
          success: false,
          error: `Nilai Akademik peserta ${cand.registration_number || cand.full_name} memiliki max_score <= 0. Source score invalid.`,
        };
      }
      const normAcad = acadAttempt.normalized_score !== undefined && acadAttempt.normalized_score !== null
        ? Number(acadAttempt.normalized_score)
        : (acadAttempt.raw_score / acadAttempt.max_score) * 100;
      if (isNaN(normAcad) || normAcad < 0 || normAcad > 100) {
        return {
          success: false,
          error: `Nilai Akademik peserta ${cand.registration_number || cand.full_name} menghasilkan normalized score ${normAcad}. Source score invalid.`,
        };
      }

      const normQuran = quranAssessment.normalized_score !== undefined && quranAssessment.normalized_score !== null
        ? Number(quranAssessment.normalized_score)
        : Number(quranAssessment.raw_score);
      if (isNaN(normQuran) || normQuran < 0 || normQuran > 100) {
        return {
          success: false,
          error: `Nilai Al-Qur'an peserta ${cand.registration_number || cand.full_name} menghasilkan normalized score ${normQuran}. Source score invalid.`,
        };
      }

      if (psiAttempt.max_score <= 0) {
        return {
          success: false,
          error: `Nilai Psikotes peserta ${cand.registration_number || cand.full_name} memiliki max_score <= 0. Source score invalid.`,
        };
      }
      const normPsi = psiAttempt.normalized_score !== undefined && psiAttempt.normalized_score !== null
        ? Number(psiAttempt.normalized_score)
        : (psiAttempt.raw_score / psiAttempt.max_score) * 100;
      if (isNaN(normPsi) || normPsi < 0 || normPsi > 100) {
        return {
          success: false,
          error: `Nilai Psikotes peserta ${cand.registration_number || cand.full_name} menghasilkan normalized score ${normPsi}. Source score invalid.`,
        };
      }

      // Weighted score calculation using exact precision
      const weightA = Number(acadComp.weight);
      const weightQ = Number(quranComp.weight);
      const weightP = Number(psiComp.weight);

      const weightedAcad = (normAcad * weightA) / 100;
      const weightedQuran = (normQuran * weightQ) / 100;
      const weightedPsi = (normPsi * weightP) / 100;

      const fullFinalScore = weightedAcad + weightedQuran + weightedPsi;
      const displayFinal = fullFinalScore.toFixed(2);

      // Create snapshot components
      calculatedComponents.push(
        {
          id: 'src-' + resultId + '-acad',
          selection_result_id: resultId,
          component_code: 'ACADEMIC',
          source_record_id: acadAttempt.id,
          raw_score: acadAttempt.raw_score,
          max_score: acadAttempt.max_score,
          normalized_score: normAcad,
          weight: weightA,
          weighted_score: weightedAcad,
          source_status: acadAttempt.status,
          created_at: calcTimestamp,
        },
        {
          id: 'src-' + resultId + '-quran',
          selection_result_id: resultId,
          component_code: 'QURAN',
          source_record_id: quranAssessment.id,
          raw_score: quranAssessment.raw_score,
          max_score: 100,
          normalized_score: normQuran,
          weight: weightQ,
          weighted_score: weightedQuran,
          source_status: quranAssessment.status,
          created_at: calcTimestamp,
        },
        {
          id: 'src-' + resultId + '-psi',
          selection_result_id: resultId,
          component_code: 'PSYCHOTEST',
          source_record_id: psiAttempt.id,
          raw_score: psiAttempt.raw_score,
          max_score: psiAttempt.max_score,
          normalized_score: normPsi,
          weight: weightP,
          weighted_score: weightedPsi,
          source_status: psiAttempt.status,
          created_at: calcTimestamp,
        }
      );

      // Evaluate minimum component criteria
      const failureList: ComponentFailureDetail[] = [];

      if (passingVer.min_academic !== null && normAcad < passingVer.min_academic) {
        failureList.push({
          component: 'ACADEMIC',
          score: normAcad,
          minimum: passingVer.min_academic,
          message: `Nilai Akademik (${normAcad.toFixed(2)}) di bawah ambang minimal (${passingVer.min_academic.toFixed(2)})`,
        });
      }

      if (passingVer.min_quran !== null && normQuran < passingVer.min_quran) {
        failureList.push({
          component: 'QURAN',
          score: normQuran,
          minimum: passingVer.min_quran,
          message: `Nilai Al-Qur'an (${normQuran.toFixed(2)}) di bawah ambang minimal (${passingVer.min_quran.toFixed(2)})`,
        });
      }

      if (passingVer.min_psychotest !== null && normPsi < passingVer.min_psychotest) {
        failureList.push({
          component: 'PSYCHOTEST',
          score: normPsi,
          minimum: passingVer.min_psychotest,
          message: `Nilai Psikotes (${normPsi.toFixed(2)}) di bawah ambang minimal (${passingVer.min_psychotest.toFixed(2)})`,
        });
      }

      let eligibility: 'ELIGIBLE' | 'FAILED_COMPONENT' | 'FAILED_FINAL' = 'ELIGIBLE';
      let resultStatus: 'BELUM_DITETAPKAN' | 'TIDAK_LULUS' = 'BELUM_DITETAPKAN';
      let decisionReason: string | undefined = undefined;

      if (failureList.length > 0) {
        eligibility = 'FAILED_COMPONENT';
        resultStatus = 'TIDAK_LULUS';
        decisionReason = failureList.map(f => f.message).join('; ');
      } else if (passingVer.min_final_score !== null && fullFinalScore < passingVer.min_final_score) {
        // Evaluate minimum final score (using full precision, not rounded display)
        eligibility = 'FAILED_FINAL';
        resultStatus = 'TIDAK_LULUS';
        failureList.push({
          component: 'FINAL',
          score: fullFinalScore,
          minimum: passingVer.min_final_score,
          message: `Nilai Akhir (${displayFinal}) di bawah ambang kelulusan minimal (${passingVer.min_final_score.toFixed(2)})`,
        });
        decisionReason = `Nilai Akhir di bawah batas minimal ${passingVer.min_final_score.toFixed(2)}`;
      }

      calculatedResults.push({
        id: resultId,
        selection_run_id: runId,
        candidate_id: cand.id,
        academic_score: normAcad,
        quran_score: normQuran,
        psychotest_score: normPsi,
        final_score: fullFinalScore,
        display_final_score: displayFinal,
        calculation_precision: 6,
        overall_rank: null,
        eligible_rank: null,
        eligibility_status: eligibility,
        result_status: resultStatus,
        failure_reasons: failureList,
        decision_reason: decisionReason,
        calculated_at: calcTimestamp,
        created_at: calcTimestamp,
        candidate: cand,
      });
    }

    // Step 2: Ranking
    // Helper comparator based on configurable tie breakers
    const compareTieBreakers = (a: SelectionResult, b: SelectionResult): number => {
      for (const tb of tieBreakers) {
        let valA = 0;
        let valB = 0;

        if (tb.rule_code === 'FINAL_SCORE') {
          valA = a.final_score ?? 0;
          valB = b.final_score ?? 0;
        } else if (tb.rule_code === 'ACADEMIC_SCORE') {
          valA = a.academic_score ?? 0;
          valB = b.academic_score ?? 0;
        } else if (tb.rule_code === 'QURAN_SCORE') {
          valA = a.quran_score ?? 0;
          valB = b.quran_score ?? 0;
        } else if (tb.rule_code === 'PSYCHOTEST_SCORE') {
          valA = a.psychotest_score ?? 0;
          valB = b.psychotest_score ?? 0;
        } else if (tb.rule_code === 'REGISTRATION_TIMESTAMP') {
          valA = new Date(a.candidate?.created_at || 0).getTime();
          valB = new Date(b.candidate?.created_at || 0).getTime();
        }

        const diff = valA - valB;
        if (Math.abs(diff) > 0.0000001) {
          return tb.direction === 'ASC' ? diff : -diff;
        }
      }
      return 0; // Truly identical
    };

    // Overall rank: all complete candidates
    const completedCandidates = calculatedResults.filter(r => r.eligibility_status !== 'INCOMPLETE');
    completedCandidates.sort(compareTieBreakers);
    completedCandidates.forEach((r, idx) => {
      r.overall_rank = idx + 1;
    });

    // Eligible rank: only ELIGIBLE candidates
    const eligibleCandidates = calculatedResults.filter(r => r.eligibility_status === 'ELIGIBLE');
    eligibleCandidates.sort(compareTieBreakers);
    eligibleCandidates.forEach((r, idx) => {
      r.eligible_rank = idx + 1;
    });

    // Step 3: Quota Allocation & Boundary Tie Detection
    const quota = run.quota;
    const reserveCount = run.reserve_count;
    let tiePendingCount = 0;

    // Check if there is an unresolved tie at the quota boundary
    // e.g. candidate at quota (rank = quota) and candidate at quota + 1 have exactly identical tie-breaker comparison
    if (eligibleCandidates.length > quota && quota > 0) {
      const boundaryCand = eligibleCandidates[quota - 1]; // rank = quota
      const nextCand = eligibleCandidates[quota]; // rank = quota + 1

      if (compareTieBreakers(boundaryCand, nextCand) === 0) {
        // TIE AT QUOTA BOUNDARY DETECTED!
        // Mark all candidates with this exact score as TIE_PENDING
        const tiedScore = boundaryCand.final_score;
        eligibleCandidates.forEach(cand => {
          if (cand.final_score !== null && Math.abs(cand.final_score - (tiedScore ?? 0)) < 0.000001) {
            cand.eligibility_status = 'TIE_PENDING';
            cand.result_status = 'TIE_PENDING';
            cand.decision_reason = 'Hasil seri pada batas kuota seleksi yang membutuhkan resolusi manual oleh Super Admin.';
            tiePendingCount++;
          }
        });
      }
    }

    // Allocate LULUS and CADANGAN for non-tie-pending eligible candidates
    eligibleCandidates.forEach((cand, idx) => {
      if (cand.result_status === 'TIE_PENDING') return;

      const rank = idx + 1;
      if (rank <= quota) {
        cand.result_status = 'LULUS';
        cand.decision_reason = `Lulus seleksi (Peringkat ${rank} dari kuota ${quota})`;
      } else if (rank <= quota + reserveCount) {
        cand.result_status = 'CADANGAN';
        cand.decision_reason = `Cadangan seleksi (Peringkat ${rank} masuk kuota cadangan ${reserveCount})`;
      } else {
        cand.result_status = 'TIDAK_LULUS';
        cand.decision_reason = `Memenuhi passing grade namun di luar batas kuota dan cadangan (Peringkat ${rank})`;
      }
    });

    const lulusCount = calculatedResults.filter(r => r.result_status === 'LULUS').length;
    const cadanganCount = calculatedResults.filter(r => r.result_status === 'CADANGAN').length;
    const tidakLulusCount = calculatedResults.filter(r => r.result_status === 'TIDAK_LULUS').length;
    const eligibleCount = calculatedResults.filter(r => r.eligibility_status === 'ELIGIBLE').length;
    const completeCount = calculatedResults.filter(r => r.eligibility_status !== 'INCOMPLETE').length;

    if (!previewOnly) {
      // Atomic write to storage
      run.status = 'CALCULATED';
      run.candidate_count = candidates.length;
      run.complete_count = completeCount;
      run.eligible_count = eligibleCount;
      run.lulus_count = lulusCount;
      run.reserve_count_actual = cadanganCount;
      run.tidak_lulus_count = tidakLulusCount;
      run.tie_pending_count = tiePendingCount;
      run.calculated_at = calcTimestamp;
      run.updated_at = calcTimestamp;

      // Replace results idempotently
      data.selectionResults = data.selectionResults.filter(r => r.selection_run_id !== runId);
      data.selectionResults.push(...calculatedResults);

      data.selectionResultComponents = data.selectionResultComponents.filter(
        c => !calculatedResults.some(r => r.id === c.selection_result_id)
      );
      data.selectionResultComponents.push(...calculatedComponents);

      saveStorageData(data);

      await auditService.logAction({
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        action: 'SELECTION_RUN_CALCULATED' as any,
        entityType: 'SELECTION_RUN',
        entityId: runId,
        newValue: {
          complete_count: completeCount,
          eligible_count: eligibleCount,
          lulus_count: lulusCount,
          cadangan_count: cadanganCount,
          tie_pending_count: tiePendingCount,
        },
      });

      if (tiePendingCount > 0) {
        await auditService.logAction({
          userId: currentUser?.id,
          userEmail: currentUser?.email,
          action: 'TIE_DETECTED' as any,
          entityType: 'SELECTION_RUN',
          entityId: runId,
          newValue: { tie_count: tiePendingCount },
        });
      }
    }

    return {
      success: true,
      results: calculatedResults,
      run,
    };
  }

  // ==========================================================================
  // 6. APPROVAL & TIE RESOLUTION (SUPER_ADMIN ONLY)
  // ==========================================================================

  async approveSelectionRun(
    runId: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; run?: SelectionRun; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang menyetujui hasil seleksi resmi (RESULT_APPROVE).',
      };
    }

    const data = getStorageData();
    const run = data.selectionRuns.find(r => r.id === runId);
    if (!run) return { success: false, error: 'Selection Run tidak ditemukan.' };

    if (run.status !== 'CALCULATED' && run.status !== 'UNDER_REVIEW') {
      return {
        success: false,
        error: `Selection Run harus berstatus CALCULATED atau UNDER_REVIEW sebelum dapat disetujui (Status saat ini: ${run.status}).`,
      };
    }

    if (run.tie_pending_count > 0) {
      return {
        success: false,
        error: `Approval diblokir: Masih terdapat ${run.tie_pending_count} peserta dengan hasil seri (TIE_PENDING) pada batas kuota. Selesaikan hasil seri terlebih dahulu.`,
      };
    }

    const approvedTimestamp = new Date().toISOString();

    // Mark previous approved run as SUPERSEDED
    const prevApproved = data.selectionRuns.find(
      r => r.academic_year === run.academic_year && r.status === 'APPROVED' && r.id !== runId
    );
    if (prevApproved) {
      prevApproved.status = 'SUPERSEDED';
      prevApproved.is_current = false;
      prevApproved.superseded_by_run_id = runId;
      prevApproved.updated_at = approvedTimestamp;
    }

    run.status = 'APPROVED';
    run.approved_by = currentUser.id;
    run.approved_at = approvedTimestamp;
    run.is_current = true;
    run.updated_at = approvedTimestamp;

    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'SELECTION_RUN_APPROVED' as any,
      entityType: 'SELECTION_RUN',
      entityId: runId,
      newValue: {
        run_name: run.run_name,
        lulus_count: run.lulus_count,
        cadangan_count: run.reserve_count_actual,
        approved_at: approvedTimestamp,
      },
    });

    return { success: true, run };
  }

  async resolveTie(
    runId: string,
    candidateId: string,
    decision: 'LULUS' | 'CADANGAN' | 'TIDAK_LULUS',
    reason: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang menyelesaikan seri (SELECTION_TIE_RESOLVE).',
      };
    }

    if (!reason?.trim()) {
      return { success: false, error: 'Alasan resolusi seri wajib diisi.' };
    }

    const data = getStorageData();
    const run = data.selectionRuns.find(r => r.id === runId);
    if (!run) return { success: false, error: 'Selection Run tidak ditemukan.' };

    const res = data.selectionResults.find(r => r.selection_run_id === runId && r.candidate_id === candidateId);
    if (!res) return { success: false, error: 'Data hasil peserta tidak ditemukan.' };

    res.result_status = decision;
    res.eligibility_status = 'ELIGIBLE';
    res.decision_reason = `Keputusan Resolusi Seri oleh Super Admin: ${reason.trim()}`;

    // Recalculate tie pending count
    const remainingTies = data.selectionResults.filter(
      r => r.selection_run_id === runId && r.result_status === 'TIE_PENDING'
    ).length;
    run.tie_pending_count = remainingTies;

    // Recalculate counts
    run.lulus_count = data.selectionResults.filter(r => r.selection_run_id === runId && r.result_status === 'LULUS').length;
    run.reserve_count_actual = data.selectionResults.filter(r => r.selection_run_id === runId && r.result_status === 'CADANGAN').length;
    run.tidak_lulus_count = data.selectionResults.filter(r => r.selection_run_id === runId && r.result_status === 'TIDAK_LULUS').length;
    run.updated_at = new Date().toISOString();

    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'TIE_RESOLVED' as any,
      entityType: 'SELECTION_RESULT',
      entityId: res.id,
      newValue: { candidate_id: candidateId, decision, reason },
    });

    return { success: true };
  }

  // ==========================================================================
  // 7. RESULTS QUERY & DETAIL
  // ==========================================================================

  async getSelectionResults(
    runId: string,
    filters?: {
      status?: 'LULUS' | 'CADANGAN' | 'TIDAK_LULUS' | 'INCOMPLETE' | 'TIE_PENDING' | 'ALL';
      search?: string;
    },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<SelectionResult[]> {
    if (currentUser) {
      if (currentUser.role === 'PESERTA') {
        throw new Error('Akses Ditolak (403 Forbidden): Calon santri tidak diperkenankan mengakses rekapitulasi hasil seleksi sebelum pengumuman resmi diterbitkan.');
      }
      if (currentUser.role === 'PENGUJI_QURAN') {
        throw new Error('Akses Ditolak (403 Forbidden): Penguji Al-Qur\'an tidak memiliki wewenang mengakses rekapitulasi akhir kelulusan santri.');
      }
      if (currentUser.role === 'PIMPINAN') {
        throw new Error('Akses Ditolak (403 Forbidden): Pimpinan mengakses ringkasan eksekutif melalui getExecutiveSelectionSummary. PIMPINAN dilarang mengakses ranking atau nilai per peserta.');
      }
      if (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'PANITIA') {
        throw new Error('Akses Ditolak (403 Forbidden): Akses rekapitulasi hasil seleksi ditolak.');
      }
    }

    const data = getStorageData();
    let list = data.selectionResults.filter(r => r.selection_run_id === runId);

    // Enrich with candidate
    list = list.map(r => ({
      ...r,
      candidate: data.candidates.find(c => c.id === r.candidate_id),
      components: data.selectionResultComponents.filter(c => c.selection_result_id === r.id),
    }));

    if (filters?.status && filters.status !== 'ALL') {
      if (filters.status === 'INCOMPLETE') {
        list = list.filter(r => r.eligibility_status === 'INCOMPLETE');
      } else {
        list = list.filter(r => r.result_status === filters.status);
      }
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        r =>
          r.candidate?.full_name.toLowerCase().includes(q) ||
          r.candidate?.registration_number?.toLowerCase().includes(q)
      );
    }

    return list;
  }

  async querySelectionResults(
    runId: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; results: SelectionResult[]; error?: string }> {
    if (!currentUser || (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'PANITIA')) {
      return {
        success: false,
        results: [],
        error: 'Akses Ditolak (403 Forbidden): Akses rekapitulasi hasil seleksi ditolak. Hanya SUPER_ADMIN dan PANITIA yang berwenang.',
      };
    }
    try {
      const results = await this.getSelectionResults(runId, undefined, currentUser);
      return { success: true, results };
    } catch (err: any) {
      return { success: false, results: [], error: err?.message || 'Gagal memuat hasil seleksi.' };
    }
  }

  // ==========================================================================
  // 8. RESTRICTED EXECUTIVE SUMMARY & RANKINGS FOR PIMPINAN
  // ==========================================================================

  async getExecutiveSelectionSummary(
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{
    success: boolean;
    summary?: ExecutiveSelectionSummary | null;
    error?: string;
  }> {
    if (!currentUser || (currentUser.role !== 'PIMPINAN' && currentUser.role !== 'SUPER_ADMIN')) {
      return {
        success: false,
        summary: null,
        error: 'Akses Ditolak (403 Forbidden): Hanya PIMPINAN dan SUPER_ADMIN yang berwenang mengakses ringkasan eksekutif seleksi.',
      };
    }

    const data = getStorageData();
    const approvedRun = (data.selectionRuns || []).find(r => r.status === 'APPROVED' && r.is_current) || (data.selectionRuns || [])[0];
    if (!approvedRun) {
      return { success: true, summary: null };
    }

    const candidates = data.candidates || [];
    const results = (data.selectionResults || []).filter(r => r.selection_run_id === approvedRun.id);

    const total_pendaftar = candidates.length;
    const terverifikasi = (data.candidates || []).filter(c =>
      ['TERVERIFIKASI', 'DIIZINKAN_MENGIKUTI_SELEKSI', 'MENGIKUTI_SELEKSI', 'SELESAI_SELEKSI', 'LULUS', 'CADANGAN', 'DITERIMA_FINAL', 'DAFTAR_ULANG'].includes(c.status)
    ).length;
    const nilai_lengkap = results.filter(r => r.eligibility_status !== 'INCOMPLETE').length;
    const eligible = results.filter(r => r.eligibility_status === 'ELIGIBLE').length;
    const lulus = results.filter(r => r.result_status === 'LULUS').length;
    const cadangan = results.filter(r => r.result_status === 'CADANGAN').length;
    const tidak_lulus = results.filter(r => r.result_status === 'TIDAK_LULUS').length;
    const tie_pending = results.filter(r => r.result_status === 'TIE_PENDING').length;

    // Rata-rata komponen (0-100)
    const acadScores = results.filter(r => r.academic_score !== null).map(r => Number(r.academic_score));
    const avg_academic = acadScores.length > 0 ? Number((acadScores.reduce((a, b) => a + b, 0) / acadScores.length).toFixed(2)) : 0;

    const quranScores = results.filter(r => r.quran_score !== null).map(r => Number(r.quran_score));
    const avg_quran = quranScores.length > 0 ? Number((quranScores.reduce((a, b) => a + b, 0) / quranScores.length).toFixed(2)) : 0;

    const psiScores = results.filter(r => r.psychotest_score !== null).map(r => Number(r.psychotest_score));
    const avg_psychotest = psiScores.length > 0 ? Number((psiScores.reduce((a, b) => a + b, 0) / psiScores.length).toFixed(2)) : 0;

    const finalScores = results.filter(r => r.final_score !== null).map(r => Number(r.final_score));
    const avg_final = finalScores.length > 0 ? Number((finalScores.reduce((a, b) => a + b, 0) / finalScores.length).toFixed(2)) : 0;

    // Distribusi nilai akhir
    const validScores = finalScores;
    const totalValid = validScores.length || 1;
    const c90_100 = validScores.filter(s => s >= 90).length;
    const c80_89 = validScores.filter(s => s >= 80 && s < 90).length;
    const c70_79 = validScores.filter(s => s >= 70 && s < 80).length;
    const c60_69 = validScores.filter(s => s >= 60 && s < 70).length;
    const cUnder60 = validScores.filter(s => s < 60).length;

    const score_distribution = [
      { range: '90 - 100', label: 'Istimewa / Mumtaz', count: c90_100, percentage: Number(((c90_100 / totalValid) * 100).toFixed(1)) },
      { range: '80 - 89.99', label: 'Sangat Baik / Jayyid Jiddan', count: c80_89, percentage: Number(((c80_89 / totalValid) * 100).toFixed(1)) },
      { range: '70 - 79.99', label: 'Baik / Jayyid', count: c70_79, percentage: Number(((c70_79 / totalValid) * 100).toFixed(1)) },
      { range: '60 - 69.99', label: 'Cukup / Maqbul', count: c60_69, percentage: Number(((c60_69 / totalValid) * 100).toFixed(1)) },
      { range: '< 60', label: 'Perlu Pembinaan Intensif', count: cUnder60, percentage: Number(((cUnder60 / totalValid) * 100).toFixed(1)) },
    ];

    // Statistik per asal sekolah (Agregat institusi, zero candidate PII)
    const schoolMap: Record<string, { total_candidates: number; lulus_count: number; cadangan_count: number; tidak_lulus_count: number }> = {};

    results.forEach(res => {
      const cand = candidates.find(c => c.id === res.candidate_id);
      const school = cand?.school_name?.trim() || 'Madrasah / Sekolah Lain';
      if (!schoolMap[school]) {
        schoolMap[school] = { total_candidates: 0, lulus_count: 0, cadangan_count: 0, tidak_lulus_count: 0 };
      }
      schoolMap[school].total_candidates++;
      if (res.result_status === 'LULUS') schoolMap[school].lulus_count++;
      else if (res.result_status === 'CADANGAN') schoolMap[school].cadangan_count++;
      else if (res.result_status === 'TIDAK_LULUS') schoolMap[school].tidak_lulus_count++;
    });

    const school_statistics = Object.entries(schoolMap)
      .map(([school_name, item]) => ({
        school_name,
        total_candidates: item.total_candidates,
        lulus_count: item.lulus_count,
        cadangan_count: item.cadangan_count,
        tidak_lulus_count: item.tidak_lulus_count,
      }))
      .sort((a, b) => b.total_candidates - a.total_candidates);

    return {
      success: true,
      summary: {
        run_name: approvedRun.run_name,
        academic_year: approvedRun.academic_year,
        status: approvedRun.status,
        quota: approvedRun.quota,
        reserve_count: approvedRun.reserve_count,
        total_pendaftar,
        terverifikasi,
        nilai_lengkap,
        eligible,
        lulus,
        cadangan,
        tidak_lulus,
        tie_pending,
        avg_academic,
        avg_quran,
        avg_psychotest,
        avg_final,
        score_distribution,
        school_statistics,
        approved_at: approvedRun.approved_at,
      },
    };
  }

  async getExecutiveSelectionRankings(
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{
    success: boolean;
    rankings: Array<{
      result_id: string;
      rank: number;
      full_name: string;
      registration_number: string;
      school_name: string;
      academic_score: number | null;
      quran_score: number | null;
      psychotest_score: number | null;
      display_final_score: string;
      result_status: string;
      decision_reason?: string;
    }>;
    error?: string;
  }> {
    if (!currentUser || currentUser.role === 'PIMPINAN') {
      return {
        success: false,
        rankings: [],
        error: 'Akses Ditolak (403 Forbidden): PIMPINAN dilarang mengakses ranking atau nilai per peserta. PIMPINAN hanya berwenang mengakses data agregat dan ringkasan eksekutif (EXECUTIVE_SUMMARY_ONLY).',
      };
    }

    if (currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        rankings: [],
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang melihat daftar ranking seleksi.',
      };
    }

    const data = getStorageData();
    const approvedRun = (data.selectionRuns || []).find(r => r.status === 'APPROVED' && r.is_current) || (data.selectionRuns || [])[0];
    if (!approvedRun) {
      return { success: true, rankings: [] };
    }

    const results = (data.selectionResults || [])
      .filter(r => r.selection_run_id === approvedRun.id)
      .sort((a, b) => (a.eligible_rank ?? a.overall_rank ?? 9999) - (b.eligible_rank ?? b.overall_rank ?? 9999));

    const safeRankings = results.map((res, idx) => {
      const cand = data.candidates.find(c => c.id === res.candidate_id);
      return {
        result_id: res.id,
        rank: res.eligible_rank ?? res.overall_rank ?? (idx + 1),
        full_name: cand?.full_name || 'Santri',
        registration_number: cand?.registration_number || '-',
        school_name: cand?.school_name || '-',
        academic_score: res.academic_score !== null ? Number(res.academic_score) : null,
        quran_score: res.quran_score !== null ? Number(res.quran_score) : null,
        psychotest_score: res.psychotest_score !== null ? Number(res.psychotest_score) : null,
        display_final_score: res.display_final_score,
        result_status: res.result_status,
        decision_reason: res.decision_reason,
      };
    });

    return { success: true, rankings: safeRankings };
  }

  async getSelectionResultDetail(resultId: string): Promise<SelectionResult | null> {
    const data = getStorageData();
    const res = data.selectionResults.find(r => r.id === resultId);
    if (!res) return null;

    const cand = data.candidates.find(c => c.id === res.candidate_id);
    const comps = data.selectionResultComponents.filter(c => c.selection_result_id === res.id);

    return {
      ...res,
      candidate: cand,
      components: comps,
    };
  }

  async exportSelectionResultsCsv(runId: string): Promise<string> {
    const results = await this.getSelectionResults(runId, { status: 'ALL' });
    const run = await this.getSelectionRunById(runId);

    const headers = [
      'Rank Overall',
      'Rank Eligible',
      'Nomor Pendaftaran',
      'Nama Santri',
      'Asal Sekolah',
      'Nilai Akademik (0-100)',
      'Nilai Qur\'an (0-100)',
      'Nilai Psikotes (0-100)',
      'Nilai Akhir',
      'Status Kelayakan',
      'Status Kelulusan',
      'Alasan / Keputusan',
      'Selection Run',
      'Tahun Pelajaran',
    ];

    const rows = results.map(r => [
      r.overall_rank ?? '-',
      r.eligible_rank ?? '-',
      `"${r.candidate?.registration_number || '-'}"`,
      `"${r.candidate?.full_name || '-'}"`,
      `"${r.candidate?.school_name || '-'}"`,
      r.academic_score !== null ? r.academic_score.toFixed(2) : '-',
      r.quran_score !== null ? r.quran_score.toFixed(2) : '-',
      r.psychotest_score !== null ? r.psychotest_score.toFixed(2) : '-',
      r.display_final_score,
      r.eligibility_status,
      r.result_status,
      `"${r.decision_reason || ''}"`,
      `"${run?.run_name || '-'}"`,
      `"${run?.academic_year || '-'}"`,
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  // ==========================================================================
  // 8. QUOTA MANAGEMENT & REVIEW WORKFLOW
  // ==========================================================================

  async getQuotaConfig(): Promise<{ quota: number; reserve_count: number }> {
    const data = getStorageData();
    const quotaSetting = data.settings.find(s => s.key === 'target_quota');
    const reserveSetting = data.settings.find(s => s.key === 'target_reserve_count');

    return {
      quota: quotaSetting ? parseInt(quotaSetting.value, 10) : 120,
      reserve_count: reserveSetting ? parseInt(reserveSetting.value, 10) : 20,
    };
  }

  async updateQuotaConfig(
    payload: { quota: number; reserve_count: number },
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang mengubah konfigurasi kuota seleksi (QUOTA_MANAGE).',
      };
    }

    if (payload.quota <= 0) {
      return { success: false, error: 'Kuota utama harus lebih besar dari 0.' };
    }
    if (payload.reserve_count < 0) {
      return { success: false, error: 'Jumlah cadangan tidak boleh negatif.' };
    }

    const data = getStorageData();
    let qSetting = data.settings.find(s => s.key === 'target_quota');
    if (qSetting) {
      qSetting.value = String(payload.quota);
      qSetting.updated_at = new Date().toISOString();
    } else {
      data.settings.push({
        id: 'setting-quota-' + Date.now(),
        key: 'target_quota',
        value: String(payload.quota),
        description: 'Target kuota santri baru',
        updated_at: new Date().toISOString(),
      });
    }

    let rSetting = data.settings.find(s => s.key === 'target_reserve_count');
    if (rSetting) {
      rSetting.value = String(payload.reserve_count);
      rSetting.updated_at = new Date().toISOString();
    } else {
      data.settings.push({
        id: 'setting-reserve-' + Date.now(),
        key: 'target_reserve_count',
        value: String(payload.reserve_count),
        description: 'Jumlah kuota cadangan santri baru',
        updated_at: new Date().toISOString(),
      });
    }

    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'QUOTA_UPDATED' as any,
      entityType: 'SYSTEM_SETTINGS',
      entityId: 'quota_config',
      newValue: { quota: payload.quota, reserve_count: payload.reserve_count },
    });

    return { success: true };
  }

  async submitReview(
    runId: string,
    notes: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser || (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'PANITIA')) {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya staf yang berwenang meninjau hasil seleksi (RESULT_REVIEW).',
      };
    }

    const data = getStorageData();
    const run = data.selectionRuns.find(r => r.id === runId);
    if (!run) return { success: false, error: 'Selection Run tidak ditemukan.' };

    if (run.status !== 'CALCULATED') {
      return { success: false, error: `Hanya run berstatus CALCULATED yang dapat diajukan review (Status saat ini: ${run.status}).` };
    }

    run.status = 'UNDER_REVIEW';
    run.reviewed_at = new Date().toISOString();
    if (notes?.trim()) {
      run.notes = (run.notes ? run.notes + '\n\n' : '') + `[Review oleh ${currentUser.email || currentUser.role}]: ${notes.trim()}`;
    }
    run.updated_at = new Date().toISOString();

    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'SELECTION_RUN_REVIEWED' as any,
      entityType: 'SELECTION_RUN',
      entityId: runId,
      newValue: { notes },
    });

    return { success: true };
  }

  async supersedeSelectionRun(
    runId: string,
    currentUser?: { id?: string; role?: string; email?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403 Forbidden): Hanya SUPER_ADMIN yang berwenang mengubah status selection run.',
      };
    }

    const data = getStorageData();
    const run = data.selectionRuns.find(r => r.id === runId);
    if (!run) return { success: false, error: 'Selection Run tidak ditemukan.' };

    run.status = 'SUPERSEDED';
    run.is_current = false;
    run.updated_at = new Date().toISOString();

    saveStorageData(data);

    await auditService.logAction({
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'SELECTION_RUN_SUPERSEDED' as any,
      entityType: 'SELECTION_RUN',
      entityId: runId,
    });

    return { success: true };
  }
}

export const selectionScoringService = new SelectionScoringService();
