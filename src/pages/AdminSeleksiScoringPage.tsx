import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { selectionScoringService } from '../services/selectionScoringService';
import { cbtService } from '../services/cbtService';
import { SelectionScoringVersion } from '../types/selection';
import { Exam } from '../types/cbt';
import { TestSchedule } from '../types/database';
import { getStorageData } from '../lib/storage';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import {
  Sliders,
  Plus,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Scale,
  ShieldCheck,
  Lock,
  Layers,
  Info
} from 'lucide-react';

export const AdminSeleksiScoringPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const canManage = hasPermission(role, 'SCORE_MANAGE');
  const canApprove = hasPermission(role, 'RESULT_APPROVE');

  const [versions, setVersions] = useState<SelectionScoringVersion[]>([]);
  const [academicExams, setAcademicExams] = useState<Exam[]>([]);
  const [psychotestExams, setPsychotestExams] = useState<Exam[]>([]);
  const [schedules, setSchedules] = useState<TestSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formVersionName, setFormVersionName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [academicWeight, setAcademicWeight] = useState<number>(40);
  const [quranWeight, setQuranWeight] = useState<number>(35);
  const [psychotestWeight, setPsychotestWeight] = useState<number>(25);
  const [sourceAcademicExamId, setSourceAcademicExamId] = useState('');
  const [sourcePsychotestExamId, setSourcePsychotestExamId] = useState('');
  const [sourceQuranScheduleId, setSourceQuranScheduleId] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = getStorageData();
      const list = await selectionScoringService.getScoringVersions();
      setVersions(list);

      const acadList = (data.exams || []).filter(e => e.exam_type === 'ACADEMIC' || !e.exam_type);
      const psiList = (data.exams || []).filter(e => e.exam_type === 'PSYCHOTEST' || e.id.includes('psikotes'));
      setAcademicExams(acadList);
      setPsychotestExams(psiList);
      setSchedules(data.testSchedules || []);

      if (acadList.length > 0) setSourceAcademicExamId(acadList[0].id);
      if (psiList.length > 0) setSourcePsychotestExamId(psiList[0].id);
      if (data.testSchedules?.length > 0) setSourceQuranScheduleId(data.testSchedules[0].id);
    } catch (e) {
      console.error('Failed to load scoring versions', e);
    } finally {
      setIsLoading(false);
    }
  };

  const totalCurrentWeight = Number(academicWeight || 0) + Number(quranWeight || 0) + Number(psychotestWeight || 0);
  const isWeightValid = Math.abs(Math.round(totalCurrentWeight * 100) / 100 - 100) < 0.001;

  const handleOpenAddModal = () => {
    setFormVersionName(`Konfigurasi Bobot TP 2027/2028 (v${versions.length + 1})`);
    setFormNotes('Standar bobot resmi seleksi santri.');
    setAcademicWeight(40);
    setQuranWeight(35);
    setPsychotestWeight(25);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      setModalError('Akses Ditolak (403): Hanya Super Admin yang berwenang membuat konfigurasi bobot.');
      return;
    }

    if (!isWeightValid) {
      setModalError(`Total bobot harus tepat 100.00% (Total saat ini: ${totalCurrentWeight}%). Harap sesuaikan.`);
      return;
    }

    if (!sourceAcademicExamId) {
      setModalError('Paket Ujian CBT Akademik sumber resmi wajib dipilih.');
      return;
    }
    if (!sourcePsychotestExamId) {
      setModalError('Paket Psikotes CBT sumber resmi wajib dipilih.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await selectionScoringService.createScoringVersion(
        {
          version_name: formVersionName,
          academic_year: '2027/2028',
          notes: formNotes,
          components: [
            {
              component_code: 'ACADEMIC',
              weight: Number(academicWeight),
              source_exam_id: sourceAcademicExamId,
            },
            {
              component_code: 'QURAN',
              weight: Number(quranWeight),
              source_schedule_id: sourceQuranScheduleId || undefined,
            },
            {
              component_code: 'PSYCHOTEST',
              weight: Number(psychotestWeight),
              source_exam_id: sourcePsychotestExamId,
            },
          ],
        },
        { id: user?.id, role: role || undefined, email: user?.email }
      );

      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan konfigurasi bobot.');
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Terjadi kesalahan saat menyimpan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveVersion = async (ver: SelectionScoringVersion) => {
    if (!canApprove) {
      showToastNotification('Akses Ditolak (403): Hanya Super Admin yang berwenang menyetujui versi bobot.');
      return;
    }

    if (!confirmAction(`Setujui konfigurasi bobot "${ver.version_name}"?\nSetelah disetujui, konfigurasi ini berstatus APPROVED dan dapat digunakan resmi pada Selection Run.`)) {
      return;
    }

    const res = await selectionScoringService.approveScoringVersion(
      ver.id,
      { id: user?.id, role: role || undefined, email: user?.email }
    );

    if (!res.success) {
      showToastNotification(res.error || 'Gagal menyetujui versi bobot.');
      return;
    }

    await loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate('/admin/seleksi')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 mb-2 transition"
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Dashboard Seleksi</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-xs">
              <Sliders size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Konfigurasi Bobot Penilaian (Scoring Versions)</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Pengaturan persentase kontribusi Tes Akademik, Al-Qur'an, dan Psikotes dengan validasi total tepat 100.00%.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold"
            >
              <Plus size={16} className="mr-1.5" />
              Buat Versi Bobot Baru
            </Button>
          )}
        </div>
      </div>

      {/* Weight Summary Banner */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs shrink-0">
            <Scale size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-indigo-950">Formula Baku Seleksi Santri PPTQM Darul Hikmah:</h3>
            <p className="text-xs text-indigo-700 mt-0.5">
              Nilai Akhir = (Akademik × 40%) + (Al-Qur'an × 35%) + (Psikotes × 25%)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-slate-700">Akademik: 40%</span>
          <span className="text-indigo-400">+</span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-slate-700">Qur'an: 35%</span>
          <span className="text-indigo-400">+</span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-slate-700">Psikotes: 25%</span>
          <span className="text-indigo-400">=</span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white shadow-xs">100.00% ✓</span>
        </div>
      </div>

      {/* Versions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-2 py-16 text-center">
            <LoadingSpinner size="lg" />
            <p className="text-xs text-slate-400 mt-2">Memuat daftar versi bobot...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="col-span-2 py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Layers size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Belum Ada Versi Bobot</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Buat konfigurasi bobot penilaian pertama untuk menetapkan komposisi nilai kelulusan.
            </p>
          </div>
        ) : (
          versions.map(ver => {
            const isApproved = ver.status === 'APPROVED';
            const comps = ver.components || [];
            const acad = comps.find(c => c.component_code === 'ACADEMIC');
            const qur = comps.find(c => c.component_code === 'QURAN');
            const psi = comps.find(c => c.component_code === 'PSYCHOTEST');

            const total = comps.reduce((s, c) => s + Number(c.weight), 0);

            return (
              <div
                key={ver.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isApproved
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {ver.status}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">TP {ver.academic_year}</span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 mt-1.5">{ver.version_name}</h2>
                      {ver.notes && <p className="text-xs text-slate-500 mt-0.5">{ver.notes}</p>}
                    </div>
                    {isApproved && (
                      <div className="text-emerald-600 flex items-center gap-1 text-xs font-bold shrink-0">
                        <ShieldCheck size={16} />
                        Disahkan
                      </div>
                    )}
                  </div>

                  {/* Components Breakdown */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Akademik</div>
                      <div className="text-lg font-black text-indigo-700 mt-0.5">{acad?.weight ?? 0}%</div>
                      <div className="text-[9px] text-slate-400 truncate mt-1">Paket: {acad?.source_exam_id || 'Umum'}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Al-Qur'an</div>
                      <div className="text-lg font-black text-emerald-700 mt-0.5">{qur?.weight ?? 0}%</div>
                      <div className="text-[9px] text-slate-400 truncate mt-1">Jadwal: {qur?.source_schedule_id || 'Sesi Ujian'}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Psikotes</div>
                      <div className="text-lg font-black text-amber-700 mt-0.5">{psi?.weight ?? 0}%</div>
                      <div className="text-[9px] text-slate-400 truncate mt-1">Paket: {psi?.source_exam_id || 'Umum'}</div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Total Akumulasi Bobot:</span>
                    <strong className={total === 100 ? 'text-emerald-700 font-mono font-bold' : 'text-rose-600 font-mono font-bold'}>
                      {total.toFixed(2)}% {total === 100 ? '✓ Tepat' : '⚠ Tidak Valid'}
                    </strong>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400">
                    {ver.approved_at
                      ? `Disahkan pada: ${new Date(ver.approved_at).toLocaleDateString('id-ID')}`
                      : `Dibuat: ${new Date(ver.created_at).toLocaleDateString('id-ID')}`}
                  </div>

                  {!isApproved && canApprove && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApproveVersion(ver)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                    >
                      <CheckCircle size={14} className="mr-1" />
                      Setujui Versi Ini
                    </Button>
                  )}
                  {isApproved && (
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Lock size={12} /> Terkunci Permanen
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Tambah Versi Bobot Baru */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Buat Konfigurasi Bobot Penilaian Baru"
      >
        <form onSubmit={handleCreateVersion} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Versi Konfigurasi *</label>
            <input
              type="text"
              required
              value={formVersionName}
              onChange={e => setFormVersionName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              placeholder="Contoh: Konfigurasi Bobot Seleksi TP 2027/2028 (40/35/25)"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Kebijakan</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none"
              placeholder="Keterangan atau dasar keputusan bobot..."
            />
          </div>

          {/* Bobot Inputs & Live Validator */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Komposisi Bobot (%)</span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                isWeightValid
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-700 border border-rose-300'
              }`}>
                Total: {totalCurrentWeight.toFixed(2)}% {isWeightValid ? '✓' : '✖ Wajib 100%'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-indigo-900 mb-1">1. Akademik (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={academicWeight}
                  onChange={e => setAcademicWeight(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 font-black text-indigo-700 text-center"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-900 mb-1">2. Al-Qur'an (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={quranWeight}
                  onChange={e => setQuranWeight(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-200 font-black text-emerald-700 text-center"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">3. Psikotes (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={psychotestWeight}
                  onChange={e => setPsychotestWeight(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-amber-200 font-black text-amber-700 text-center"
                />
              </div>
            </div>
          </div>

          {/* Source Bindings (Zero Ambiguity) */}
          <div className="space-y-3 pt-1">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Info size={14} className="text-indigo-600" />
              Penetapan Sumber Ujian Resmi (Mencegah Ambiguitas Nilai)
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Paket Sumber CBT Akademik *</label>
              <select
                required
                value={sourceAcademicExamId}
                onChange={e => setSourceAcademicExamId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
              >
                {academicExams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.duration_minutes} Menit, {ex.total_questions} Soal)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Paket Sumber Psikotes CBT *</label>
              <select
                required
                value={sourcePsychotestExamId}
                onChange={e => setSourcePsychotestExamId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
              >
                {psychotestExams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.duration_minutes} Menit, {ex.total_questions} Soal)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Sesi Jadwal Tes Al-Qur'an (Opsional)</label>
              <select
                value={sourceQuranScheduleId}
                onChange={e => setSourceQuranScheduleId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
              >
                <option value="">Semua Sesi Jadwal Al-Qur'an Resmi (Default)</option>
                {schedules.map(sch => (
                  <option key={sch.id} value={sch.id}>
                    {sch.title} - Ruang: {sch.room}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmitting || !isWeightValid}
              className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Versi Bobot'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
