import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { selectionScoringService } from '../services/selectionScoringService';
import { SelectionPassingRuleVersion } from '../types/selection';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import {
  Scale,
  Plus,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Lock,
  Layers,
  ShieldCheck,
  CheckSquare,
  Square
} from 'lucide-react';

export const AdminSeleksiAturanPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const canManage = hasPermission(role, 'PASSING_RULE_MANAGE');
  const canApprove = hasPermission(role, 'RESULT_APPROVE');

  const [rules, setRules] = useState<SelectionPassingRuleVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formVersionName, setFormVersionName] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Individual rules & active flags
  const [isAcadActive, setIsAcadActive] = useState(true);
  const [minAcad, setMinAcad] = useState<number>(65);

  const [isQuranActive, setIsQuranActive] = useState(true);
  const [minQuran, setMinQuran] = useState<number>(70);

  const [isPsiActive, setIsPsiActive] = useState(true);
  const [minPsi, setMinPsi] = useState<number>(60);

  const [isFinalActive, setIsFinalActive] = useState(true);
  const [minFinal, setMinFinal] = useState<number>(65);

  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await selectionScoringService.getPassingRuleVersions();
      setRules(list);
    } catch (e) {
      console.error('Failed to load passing rule versions', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setFormVersionName(`Standar Kelulusan TP 2027/2028 (v${rules.length + 1})`);
    setFormNotes('Kriteria ambang batas kelayakan santri.');
    setIsAcadActive(true);
    setMinAcad(65);
    setIsQuranActive(true);
    setMinQuran(70);
    setIsPsiActive(true);
    setMinPsi(60);
    setIsFinalActive(true);
    setMinFinal(65);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      setModalError('Akses Ditolak (403): Hanya Super Admin yang berwenang membuat aturan kelulusan.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await selectionScoringService.createPassingRuleVersion(
        {
          version_name: formVersionName,
          academic_year: '2027/2028',
          min_academic: isAcadActive ? Number(minAcad) : null,
          min_quran: isQuranActive ? Number(minQuran) : null,
          min_psychotest: isPsiActive ? Number(minPsi) : null,
          min_final_score: isFinalActive ? Number(minFinal) : null,
          notes: formNotes,
        },
        { id: user?.id, role: role || undefined, email: user?.email }
      );

      if (!res.success) throw new Error(res.error || 'Gagal menyimpan aturan.');

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Terjadi kesalahan saat menyimpan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveRule = async (rule: SelectionPassingRuleVersion) => {
    if (!canApprove) {
      showToastNotification('Akses Ditolak (403): Hanya Super Admin yang berwenang menyetujui aturan passing grade.');
      return;
    }

    if (!confirmAction(`Setujui aturan kelulusan "${rule.version_name}"?\nSetelah disetujui, aturan ini berstatus APPROVED dan dapat digunakan resmi dalam Selection Run.`)) {
      return;
    }

    const res = await selectionScoringService.approvePassingRuleVersion(
      rule.id,
      { id: user?.id, role: role || undefined, email: user?.email }
    );

    if (!res.success) {
      showToastNotification(res.error || 'Gagal menyetujui aturan.');
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
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-xs">
              <Scale size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Aturan Passing Grade & Ambang Kelayakan</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Konfigurasi syarat nilai minimal per komponen dan ambang skor akhir kelulusan (NULL = Tidak Diterapkan).
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
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              <Plus size={16} className="mr-1.5" />
              Buat Aturan Baru
            </Button>
          )}
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-2 py-16 text-center">
            <LoadingSpinner size="lg" />
            <p className="text-xs text-slate-400 mt-2">Memuat daftar aturan passing grade...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="col-span-2 py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Layers size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Belum Ada Aturan Passing Grade</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Buat kriteria passing grade pertama untuk menentukan batasan minimal kelayakan santri.
            </p>
          </div>
        ) : (
          rules.map(rule => {
            const isApproved = rule.status === 'APPROVED';

            return (
              <div
                key={rule.id}
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
                          {rule.status}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">TP {rule.academic_year}</span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 mt-1.5">{rule.version_name}</h2>
                      {rule.notes && <p className="text-xs text-slate-500 mt-0.5">{rule.notes}</p>}
                    </div>
                    {isApproved && (
                      <div className="text-emerald-600 flex items-center gap-1 text-xs font-bold shrink-0">
                        <ShieldCheck size={16} />
                        Disahkan
                      </div>
                    )}
                  </div>

                  {/* 4 Criteria Badges */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Minimal Akademik</div>
                      <div className="text-sm font-black text-indigo-700 mt-0.5">
                        {rule.min_academic !== null ? `${rule.min_academic.toFixed(1)} / 100` : <span className="text-slate-400 font-normal">Tidak Diterapkan</span>}
                      </div>
                      <span className="text-[9px] text-slate-400">{rule.min_academic !== null ? 'Wajib >= batas' : 'Bebas ambang'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Minimal Al-Qur'an</div>
                      <div className="text-sm font-black text-emerald-700 mt-0.5">
                        {rule.min_quran !== null ? `${rule.min_quran.toFixed(1)} / 100` : <span className="text-slate-400 font-normal">Tidak Diterapkan</span>}
                      </div>
                      <span className="text-[9px] text-slate-400">{rule.min_quran !== null ? 'Wajib >= batas' : 'Bebas ambang'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Minimal Psikotes</div>
                      <div className="text-sm font-black text-amber-700 mt-0.5">
                        {rule.min_psychotest !== null ? `${rule.min_psychotest.toFixed(1)} / 100` : <span className="text-slate-400 font-normal">Tidak Diterapkan</span>}
                      </div>
                      <span className="text-[9px] text-slate-400">{rule.min_psychotest !== null ? 'Wajib >= batas' : 'Bebas ambang'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Minimal Nilai Akhir</div>
                      <div className="text-sm font-black text-teal-700 mt-0.5">
                        {rule.min_final_score !== null ? `${rule.min_final_score.toFixed(1)} / 100` : <span className="text-slate-400 font-normal">Tidak Diterapkan</span>}
                      </div>
                      <span className="text-[9px] text-slate-400">{rule.min_final_score !== null ? 'Threshold Kelulusan' : 'Bebas ambang'}</span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400">
                    {rule.approved_at
                      ? `Disahkan pada: ${new Date(rule.approved_at).toLocaleDateString('id-ID')}`
                      : `Dibuat: ${new Date(rule.created_at).toLocaleDateString('id-ID')}`}
                  </div>

                  {!isApproved && canApprove && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApproveRule(rule)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                    >
                      <CheckCircle size={14} className="mr-1" />
                      Setujui Aturan Ini
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

      {/* Modal: Tambah Aturan Passing Grade Baru */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Buat Aturan Passing Grade Baru"
      >
        <form onSubmit={handleCreateRule} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Versi Aturan *</label>
            <input
              type="text"
              required
              value={formVersionName}
              onChange={e => setFormVersionName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              placeholder="Contoh: Standar Kelulusan Minimal TP 2027/2028"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none"
              placeholder="Keterangan kebijakan passing grade..."
            />
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="text-xs font-bold text-slate-800">Kriteria Ambang Minimal per Aspek (Skala 0-100):</div>

            {/* 1. Academic */}
            <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAcadActive(!isAcadActive)}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  {isAcadActive ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                </button>
                <div>
                  <div className="text-xs font-bold text-slate-800">1. Nilai Minimal Akademik</div>
                  <div className="text-[10px] text-slate-400">{isAcadActive ? 'Aktif diterapkan' : 'Aturan tidak diterapkan'}</div>
                </div>
              </div>
              <div className="w-24">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={!isAcadActive}
                  value={minAcad}
                  onChange={e => setMinAcad(parseFloat(e.target.value) || 0)}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg border text-center font-bold ${
                    isAcadActive ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-slate-100 text-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* 2. Quran */}
            <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuranActive(!isQuranActive)}
                  className="text-emerald-600 hover:text-emerald-800"
                >
                  {isQuranActive ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                </button>
                <div>
                  <div className="text-xs font-bold text-slate-800">2. Nilai Minimal Al-Qur'an</div>
                  <div className="text-[10px] text-slate-400">{isQuranActive ? 'Aktif diterapkan' : 'Aturan tidak diterapkan'}</div>
                </div>
              </div>
              <div className="w-24">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={!isQuranActive}
                  value={minQuran}
                  onChange={e => setMinQuran(parseFloat(e.target.value) || 0)}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg border text-center font-bold ${
                    isQuranActive ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* 3. Psychotest */}
            <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPsiActive(!isPsiActive)}
                  className="text-amber-600 hover:text-amber-800"
                >
                  {isPsiActive ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                </button>
                <div>
                  <div className="text-xs font-bold text-slate-800">3. Nilai Minimal Psikotes</div>
                  <div className="text-[10px] text-slate-400">{isPsiActive ? 'Aktif diterapkan' : 'Aturan tidak diterapkan'}</div>
                </div>
              </div>
              <div className="w-24">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={!isPsiActive}
                  value={minPsi}
                  onChange={e => setMinPsi(parseFloat(e.target.value) || 0)}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg border text-center font-bold ${
                    isPsiActive ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-100 text-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* 4. Final Score */}
            <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFinalActive(!isFinalActive)}
                  className="text-teal-600 hover:text-teal-800"
                >
                  {isFinalActive ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                </button>
                <div>
                  <div className="text-xs font-bold text-slate-800">4. Nilai Minimal Akhir (Total Akumulasi)</div>
                  <div className="text-[10px] text-slate-400">{isFinalActive ? 'Aktif diterapkan' : 'Aturan tidak diterapkan'}</div>
                </div>
              </div>
              <div className="w-24">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={!isFinalActive}
                  value={minFinal}
                  onChange={e => setMinFinal(parseFloat(e.target.value) || 0)}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg border text-center font-bold ${
                    isFinalActive ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 bg-slate-100 text-slate-400'
                  }`}
                />
              </div>
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
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Aturan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
