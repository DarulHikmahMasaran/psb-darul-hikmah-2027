import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { selectionScoringService } from '../services/selectionScoringService';
import {
  SelectionRun,
  SelectionScoringVersion,
  SelectionPassingRuleVersion,
  SelectionCompletenessReport,
} from '../types/selection';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import {
  Award,
  Play,
  CheckCircle,
  Clock,
  Layers,
  Sliders,
  Scale,
  Users,
  AlertTriangle,
  Eye,
  FileCheck,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Plus,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';

export const AdminSeleksiDashboardPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const canManageRuns = hasPermission(role, 'SELECTION_RUN_MANAGE');
  const canApprove = hasPermission(role, 'RESULT_APPROVE');
  const canReview = hasPermission(role, 'RESULT_REVIEW');

  const [runs, setRuns] = useState<SelectionRun[]>([]);
  const [scoringVersions, setScoringVersions] = useState<SelectionScoringVersion[]>([]);
  const [passingRules, setPassingRules] = useState<SelectionPassingRuleVersion[]>([]);
  const [quotaConfig, setQuotaConfig] = useState<{ quota: number; reserve_count: number }>({ quota: 120, reserve_count: 20 });
  const [isLoading, setIsLoading] = useState(true);

  // New Run Modal
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);
  const [runName, setRunName] = useState('');
  const [academicYear, setAcademicYear] = useState('2027/2028');
  const [selectedScoringId, setSelectedScoringId] = useState('');
  const [selectedPassingRuleId, setSelectedPassingRuleId] = useState('');
  const [formQuota, setFormQuota] = useState(120);
  const [formReserve, setFormReserve] = useState(20);
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Pre-audit validation modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditRun, setAuditRun] = useState<SelectionRun | null>(null);
  const [auditReport, setAuditReport] = useState<SelectionCompletenessReport | null>(null);
  const [auditErrors, setAuditErrors] = useState<string[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  // Review modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRun, setReviewRun] = useState<SelectionRun | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Action status message
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [runsList, scoringList, passingList, quota] = await Promise.all([
        selectionScoringService.getSelectionRuns(),
        selectionScoringService.getScoringVersions(),
        selectionScoringService.getPassingRuleVersions(),
        selectionScoringService.getQuotaConfig(),
      ]);

      setRuns(runsList);
      setScoringVersions(scoringList);
      setPassingRules(passingList);
      setQuotaConfig(quota);
      setFormQuota(quota.quota);
      setFormReserve(quota.reserve_count);

      // Default selected versions for new run
      const approvedScoring = scoringList.find(s => s.status === 'APPROVED');
      if (approvedScoring) setSelectedScoringId(approvedScoring.id);

      const approvedPassing = passingList.find(p => p.status === 'APPROVED');
      if (approvedPassing) setSelectedPassingRuleId(approvedPassing.id);
    } catch (e: any) {
      console.error('Failed to load selection dashboard data', e);
      setActionError('Gagal memuat data seleksi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenNewRun = () => {
    setRunName(`Seleksi Resmi TP 2027/2028 - Run #${runs.length + 1}`);
    setModalError(null);
    setIsNewRunModalOpen(true);
  };

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageRuns) {
      setModalError('Akses Ditolak (403): Hanya Super Admin yang berwenang membuat Selection Run.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await selectionScoringService.createSelectionRun(
        {
          run_name: runName,
          academic_year: academicYear,
          scoring_version_id: selectedScoringId,
          passing_rule_version_id: selectedPassingRuleId,
          quota: Number(formQuota),
          reserve_count: Number(formReserve),
          notes: formNotes,
        },
        { id: user?.id, role: role || undefined, email: user?.email }
      );

      if (!res.success) {
        throw new Error(res.error || 'Gagal membuat selection run.');
      }

      setIsNewRunModalOpen(false);
      setActionSuccess(`Selection Run "${runName}" berhasil dibuat dalam status DRAFT.`);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Terjadi kesalahan saat membuat run.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreAudit = async (run: SelectionRun) => {
    setAuditRun(run);
    setIsAuditModalOpen(true);
    setIsAuditLoading(true);
    try {
      const val = await selectionScoringService.validateSelectionRun(run.id);
      setAuditReport(val.report);
      setAuditErrors(val.errors);
    } catch (e: any) {
      setAuditErrors(['Gagal melakukan validasi data seleksi.']);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleCalculate = async (run: SelectionRun) => {
    if (!canManageRuns) {
      showToastNotification('Akses Ditolak (403): Hanya Super Admin yang berwenang menjalankan kalkulasi.');
      return;
    }

    if (!confirmAction(`Jalankan kalkulasi resmi untuk "${run.run_name}"?\nSistem akan menghitung bobot nilai (Akademik, Qur'an, Psikotes), passing grade, peringkat, kuota, dan mendeteksi hasil seri secara deterministik.`)) {
      return;
    }

    setIsLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await selectionScoringService.calculateSelectionRun(
        run.id,
        { id: user?.id, role: role || undefined, email: user?.email },
        false
      );

      if (!res.success) {
        throw new Error(res.error || 'Gagal menghitung hasil seleksi.');
      }

      setActionSuccess(`Kalkulasi "${run.run_name}" berhasil diselesaikan. Status: CALCULATED. Silakan buka menu Hasil Seleksi untuk meninjau.`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Gagal menjalankan kalkulasi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReview = (run: SelectionRun) => {
    setReviewRun(run);
    setReviewNotes('');
    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewRun) return;

    try {
      const res = await selectionScoringService.submitReview(
        reviewRun.id,
        reviewNotes,
        { id: user?.id, role: role || undefined, email: user?.email }
      );

      if (!res.success) throw new Error(res.error);

      setIsReviewModalOpen(false);
      setActionSuccess(`Selection Run "${reviewRun.run_name}" kini berstatus UNDER_REVIEW.`);
      await loadData();
    } catch (e: any) {
      showToastNotification(e.message || 'Gagal mengajukan review.');
    }
  };

  const handleApprove = async (run: SelectionRun) => {
    if (!canApprove) {
      showToastNotification('Akses Ditolak (403): Hanya Super Admin yang berwenang menyetujui hasil seleksi resmi (RESULT_APPROVE).');
      return;
    }

    if (run.tie_pending_count > 0) {
      showToastNotification(`Approval DIBLOKIR: Terdapat ${run.tie_pending_count} peserta dengan status seri (TIE_PENDING) pada batas kuota. Super Admin wajib menyelesaikan keputusan seri terlebih dahulu.`);
      return;
    }

    if (!confirmAction(`PERINGATAN PENTING:\nApakah Anda yakin ingin MENYETUJUI (APPROVE) hasil resmi "${run.run_name}"?\nSetelah disetujui, hasil seleksi akan bersifat IMMUTABLE (terkunci permanen) dan menjadi dasar penerimaan santri baru TP ${run.academic_year}.`)) {
      return;
    }

    setIsLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await selectionScoringService.approveSelectionRun(
        run.id,
        { id: user?.id, role: role || undefined, email: user?.email }
      );

      if (!res.success) throw new Error(res.error);

      setActionSuccess(`Hasil Seleksi "${run.run_name}" BERHASIL DISETUJUI & DISAHKAN sebagai hasil seleksi resmi (APPROVED).`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Gagal menyetujui hasil seleksi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
              <Award size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Final Scoring & Penetapan Kelulusan</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Penggabungan hasil Tes Akademik (40%), Al-Qur'an (35%), dan Psikotes (25%) secara deterministik & teraudit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManageRuns && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenNewRun}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
            >
              <Plus size={16} className="mr-1.5" />
              Buat Selection Run Baru
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="font-bold hover:underline">Tutup</button>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="font-bold hover:underline">Tutup</button>
        </div>
      )}

      {/* Sub-Navigation Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('/admin/seleksi/scoring')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition text-left flex items-start gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition">
            <Sliders size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              Bobot Penilaian
              <ChevronRight size={14} className="text-slate-400 group-hover:text-indigo-600 transition" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Akademik 40%, Qur'an 35%, Psikotes 25% (Total 100%)</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('/admin/seleksi/aturan')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition text-left flex items-start gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 group-hover:scale-105 transition">
            <Scale size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              Ambang Kelulusan
              <ChevronRight size={14} className="text-slate-400 group-hover:text-amber-600 transition" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Passing grade minimal per aspek & nilai akhir</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('/admin/seleksi/kuota')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition text-left flex items-start gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition">
            <Users size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              Target Kuota
              <ChevronRight size={14} className="text-slate-400 group-hover:text-emerald-600 transition" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Kuota Utama: {quotaConfig.quota} | Cadangan: {quotaConfig.reserve_count}</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('/admin/seleksi/hasil')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition text-left flex items-start gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0 group-hover:scale-105 transition">
            <FileSpreadsheet size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              Rekapitulasi Hasil
              <ChevronRight size={14} className="text-slate-400 group-hover:text-teal-600 transition" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Tabel perangkingan & download laporan CSV</p>
          </div>
        </button>
      </div>

      {/* Main Table: Selection Runs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Daftar Selection Run (Riwayat Kalkulasi Seleksi)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Setiap kalkulasi hasil seleksi dicatat sebagai snapshot versi resmi yang terisolasi dan immutable setelah disetujui.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="text-xs">
            <RefreshCw size={14} className="mr-1.5" />
            Segarkan
          </Button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <LoadingSpinner size="lg" />
            <p className="text-xs text-slate-400 mt-2">Memuat daftar selection run...</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Layers size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Belum Ada Selection Run</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Buat Selection Run pertama untuk menghubungkan konfigurasi bobot dan aturan kelulusan guna menghitung ranking seleksi.
              </p>
            </div>
            {canManageRuns && (
              <Button variant="primary" size="sm" onClick={handleOpenNewRun} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                <Plus size={14} className="mr-1" />
                Buat Run Sekarang
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Run / Tahun</TableHead>
                  <TableHead>Status & Versi</TableHead>
                  <TableHead className="text-center">Kuota / Cadangan</TableHead>
                  <TableHead className="text-center">Kandidat Lengkap</TableHead>
                  <TableHead className="text-center">Lulus / Cadangan</TableHead>
                  <TableHead className="text-center">Status Seri</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(run => {
                  const isDraft = run.status === 'DRAFT';
                  const isCalculated = run.status === 'CALCULATED';
                  const isUnderReview = run.status === 'UNDER_REVIEW';
                  const isApproved = run.status === 'APPROVED';
                  const isSuperseded = run.status === 'SUPERSEDED';

                  return (
                    <TableRow key={run.id} className={run.is_current ? 'bg-emerald-50/30' : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {run.is_current && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              CURRENT RESMI
                            </span>
                          )}
                          <span className="font-bold text-slate-900 text-xs">{run.run_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tahun: {run.academic_year} | Dibuat: {new Date(run.created_at).toLocaleDateString('id-ID')}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isCalculated
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : isUnderReview
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : isSuperseded
                              ? 'bg-slate-100 text-slate-500 border border-slate-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {run.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          Bobot: {run.scoring_version?.version_name?.slice(0, 24) || run.scoring_version_id}...
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="text-xs font-bold text-slate-800">
                          {run.quota} Utama
                        </div>
                        <div className="text-[11px] text-slate-500">
                          +{run.reserve_count} Cadangan
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="text-xs font-bold text-slate-800">
                          {run.complete_count} / {run.candidate_count}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium">
                          {run.eligible_count} Lolos Passing
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="text-xs font-bold text-emerald-700">
                          {run.lulus_count} LULUS
                        </div>
                        <div className="text-[10px] text-amber-700">
                          {run.reserve_count_actual} Cadangan | {run.tidak_lulus_count} Gagal
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        {run.tie_pending_count > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center gap-1 mx-auto w-fit">
                            <AlertTriangle size={11} />
                            {run.tie_pending_count} SERI
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Normal</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Pre-audit check button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreAudit(run)}
                            title="Validasi kelengkapan nilai sebelum kalkulasi"
                            className="text-xs py-1 text-slate-700"
                          >
                            <FileCheck size={13} className="mr-1 text-slate-500" />
                            Praaudit
                          </Button>

                          {/* Calculate Button */}
                          {(isDraft || isCalculated || isUnderReview) && canManageRuns && !isApproved && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCalculate(run)}
                              className="text-xs py-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold"
                            >
                              <Play size={13} className="mr-1 text-emerald-600" />
                              {isDraft ? 'Hitung' : 'Hitung Ulang'}
                            </Button>
                          )}

                          {/* View Results */}
                          {(isCalculated || isUnderReview || isApproved || isSuperseded) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onNavigate(`/admin/seleksi/hasil?runId=${run.id}`)}
                              className="text-xs py-1 text-teal-700 border-teal-300 hover:bg-teal-50"
                            >
                              <Eye size={13} className="mr-1 text-teal-600" />
                              Hasil
                            </Button>
                          )}

                          {/* Review Button */}
                          {isCalculated && canReview && !isApproved && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenReview(run)}
                              className="text-xs py-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                            >
                              Review
                            </Button>
                          )}

                          {/* Approve Button (Super Admin only) */}
                          {(isCalculated || isUnderReview) && canApprove && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={run.tie_pending_count > 0}
                              onClick={() => handleApprove(run)}
                              className="text-xs py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                            >
                              <CheckCircle size={13} className="mr-1" />
                              Setujui
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modal: Buat Selection Run Baru */}
      <Modal
        isOpen={isNewRunModalOpen}
        onClose={() => setIsNewRunModalOpen(false)}
        title="Buat Selection Run Baru"
      >
        <form onSubmit={handleCreateRun} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Selection Run *</label>
            <input
              type="text"
              required
              value={runName}
              onChange={e => setRunName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              placeholder="Contoh: Seleksi Resmi Gelombang 1 TP 2027/2028"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Pelajaran</label>
              <input
                type="text"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Versi Bobot (Scoring) *</label>
              <select
                required
                value={selectedScoringId}
                onChange={e => setSelectedScoringId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
              >
                {scoringVersions
                  .filter(v => v.status === 'APPROVED')
                  .map(v => (
                    <option key={v.id} value={v.id}>
                      {v.version_name} (APPROVED)
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Versi Passing Grade Minimal *</label>
            <select
              required
              value={selectedPassingRuleId}
              onChange={e => setSelectedPassingRuleId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
            >
              {passingRules
                .filter(p => p.status === 'APPROVED')
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.version_name} (APPROVED)
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kuota Utama Santri *</label>
              <input
                type="number"
                min="1"
                required
                value={formQuota}
                onChange={e => setFormQuota(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-emerald-800"
              />
              <span className="text-[10px] text-slate-400">Snapshot kuota resmi target</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kuota Cadangan *</label>
              <input
                type="number"
                min="0"
                required
                value={formReserve}
                onChange={e => setFormReserve(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-amber-800"
              />
              <span className="text-[10px] text-slate-400">Jumlah kuota urutan berikutnya</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none"
              placeholder="Catatan kebijakan seleksi atau keterangan khusus..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsNewRunModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
              {isSubmitting ? 'Membuat...' : 'Buat Selection Run'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Praaudit Validasi Kelengkapan */}
      <Modal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title={`Praaudit Data Seleksi: ${auditRun?.run_name || ''}`}
      >
        <div className="space-y-4">
          {isAuditLoading ? (
            <div className="py-8 text-center">
              <LoadingSpinner size="md" />
              <p className="text-xs text-slate-400 mt-2">Memeriksa kelengkapan data seleksi...</p>
            </div>
          ) : (
            <>
              {auditErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <AlertTriangle size={14} /> Terdapat Kesalahan Konfigurasi / Sumber Ambigu:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {auditErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {auditReport && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-800">Ringkasan Kelengkapan 3 Komponen Ujian:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-medium">Total Terdaftar</div>
                      <div className="text-base font-black text-slate-800 mt-0.5">{auditReport.totalCandidates} Santri</div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <div className="text-[10px] text-emerald-600 font-medium">Lengkap 3 Aspek</div>
                      <div className="text-base font-black text-emerald-800 mt-0.5">{auditReport.completeCount} Santri</div>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <div className="text-[10px] text-amber-600 font-medium">Belum Lengkap</div>
                      <div className="text-base font-black text-amber-800 mt-0.5">{auditReport.incompleteCount} Santri</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-medium">Kuota Target</div>
                      <div className="text-base font-black text-slate-800 mt-0.5">{auditRun?.quota} Santri</div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="text-[11px] font-bold text-slate-700">Rincian Komponen Terisi:</div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>• Ujian CBT Akademik Selesai:</span>
                      <strong className="text-slate-800">{auditReport.hasAcademic} / {auditReport.totalCandidates}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>• Tes Al-Qur'an (Locked):</span>
                      <strong className="text-slate-800">{auditReport.hasQuran} / {auditReport.totalCandidates}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>• Psikotes CBT Selesai:</span>
                      <strong className="text-slate-800">{auditReport.hasPsychotest} / {auditReport.totalCandidates}</strong>
                    </div>
                  </div>

                  {/* Candidate Status Breakdown Table */}
                  {auditReport.candidateBreakdowns && auditReport.candidateBreakdowns.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700 flex justify-between items-center">
                        <span>Status Kelengkapan Sumber per Calon Santri</span>
                        <span className="text-[10px] text-slate-500 font-normal">OK / MISSING / AMBIGUOUS / INVALID</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] sticky top-0">
                            <tr>
                              <th className="py-2 px-3">Santri</th>
                              <th className="py-2 px-2 text-center">Akademik</th>
                              <th className="py-2 px-2 text-center">Al-Qur'an</th>
                              <th className="py-2 px-2 text-center">Psikotes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[11px]">
                            {auditReport.candidateBreakdowns.map((cand, idx) => {
                              const renderBadge = (st: string) => {
                                if (st === 'OK') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">OK</span>;
                                if (st === 'AMBIGUOUS') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">AMBIGUOUS</span>;
                                if (st === 'INVALID') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">INVALID</span>;
                                return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">MISSING</span>;
                              };
                              return (
                                <tr key={cand.candidate_id || idx} className="hover:bg-slate-50">
                                  <td className="py-2 px-3">
                                    <div className="font-semibold text-slate-800">{cand.full_name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{cand.registration_number}</div>
                                  </td>
                                  <td className="py-2 px-2 text-center">{renderBadge(cand.academic_status)}</td>
                                  <td className="py-2 px-2 text-center">{renderBadge(cand.quran_status)}</td>
                                  <td className="py-2 px-2 text-center">{renderBadge(cand.psychotest_status)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {auditReport.incompleteCount > 0 && (
                    <p className="text-[11px] text-slate-500 italic leading-relaxed">
                      Catatan: Santri dengan nilai belum lengkap akan diberi status <strong>INCOMPLETE</strong> dan tidak bersaing dalam pemeringkatan kuota LULUS.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsAuditModalOpen(false)}>
                  Tutup
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal: Review Run */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`Pengajuan Review: ${reviewRun?.run_name || ''}`}
      >
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <p className="text-xs text-slate-600">
            Kirimkan catatan evaluasi hasil kalkulasi seleksi ini kepada panitia penguji dan pimpinan sebelum disahkan.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Review Panitia *</label>
            <textarea
              required
              rows={4}
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none"
              placeholder="Contoh: Seluruh nilai telah diverifikasi oleh tim panitia seleksi..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsReviewModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
              Kirim Catatan Review
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
