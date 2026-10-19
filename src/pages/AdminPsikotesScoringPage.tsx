import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { cbtService } from '../services/cbtService';
import { PsychotestScoringConfig, QuestionCategory } from '../types/cbt';
import { getStorageData } from '../lib/storage';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import {
  Brain,
  Sliders,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Edit,
  ShieldCheck,
  Scale,
  Award,
  Layers,
  HelpCircle,
  Info
} from 'lucide-react';

export const AdminPsikotesScoringPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const canManageScoring = hasPermission(role, 'PSYCHOTEST_SCORING_MANAGE');

  const [configs, setConfigs] = useState<PsychotestScoringConfig[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PsychotestScoringConfig | null>(null);
  const [formScoringModel, setFormScoringModel] = useState<'BINARY' | 'WEIGHTED_OPTION' | 'SCALE'>('BINARY');
  const [formCorrectScore, setFormCorrectScore] = useState(2);
  const [formWrongScore, setFormWrongScore] = useState(0);
  const [formNormBase, setFormNormBase] = useState(100);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPassingThreshold, setFormPassingThreshold] = useState<number | undefined>(65);

  // New Category Modal State
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatModel, setNewCatModel] = useState<'BINARY' | 'WEIGHTED_OPTION' | 'SCALE'>('BINARY');
  const [newCatCorrectScore, setNewCatCorrectScore] = useState(2);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = getStorageData();
      const cfgRes = await cbtService.getPsychotestScoringConfigs({
        id: user?.id,
        role: role || undefined,
        email: user?.email,
      });
      if (cfgRes.success) {
        setConfigs(cfgRes.configs);
      } else {
        setFormError(cfgRes.error || 'Akses Ditolak (403 Forbidden)');
        setConfigs([]);
      }

      const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');
      const psiCats = psiSubject
        ? data.questionCategories.filter(c => c.subject_id === psiSubject.id)
        : data.questionCategories;
      setCategories(psiCats);
    } catch (e) {
      console.error('Failed to load scoring configs', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEdit = (cfg: PsychotestScoringConfig) => {
    setEditingConfig(cfg);
    setFormScoringModel(cfg.scoring_model);
    setFormCorrectScore(cfg.default_correct_score);
    setFormWrongScore(cfg.default_wrong_score);
    setFormNormBase(cfg.normalization_base || 100);
    setFormIsActive(cfg.is_active);
    setFormPassingThreshold(cfg.passing_threshold || 65);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageScoring) {
      setFormError('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang mengubah aturan scoring.');
      return;
    }
    if (!editingConfig) return;

    setIsSaving(true);
    setFormError(null);
    try {
      const res = await cbtService.updatePsychotestScoringConfig(
        editingConfig.id,
        {
          scoring_model: formScoringModel,
          default_correct_score: Number(formCorrectScore),
          default_wrong_score: Number(formWrongScore),
          normalization_base: Number(formNormBase),
          is_active: formIsActive,
        },
        { id: user?.id, role: role || undefined, email: user?.email }
      );

      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan aturan scoring');
      }

      setIsEditModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat menyimpan aturan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageScoring) {
      setFormError('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang menambah kategori.');
      return;
    }
    if (!newCatName.trim()) {
      setFormError('Nama kategori wajib diisi.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const res = await cbtService.createPsychotestCategory(
        {
          name: newCatName.trim(),
          description: newCatDesc.trim(),
          scoring_model: newCatModel,
          default_correct_score: Number(newCatCorrectScore),
          default_wrong_score: 0,
        },
        { id: user?.id, role: role || undefined, email: user?.email }
      );

      if (!res.success) {
        throw new Error(res.error || 'Gagal membuat kategori');
      }

      setIsNewCatModalOpen(false);
      setNewCatName('');
      setNewCatDesc('');
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat membuat kategori.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate('/admin/psikotes')}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1.5 mb-2 transition"
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Dashboard Psikotes</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
              <Sliders size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Aturan Scoring & Rubrik Kategori</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Konfigurasi model pembobotan, skala normalisasi 0-100, dan rubrik kuantitatif per subtes asesmen santri.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManageScoring && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setFormError(null);
                setIsNewCatModalOpen(true);
              }}
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold"
            >
              <Plus size={16} className="mr-1.5" />
              Tambah Kategori Baru
            </Button>
          )}
        </div>
      </div>

      {/* Principle & Ethics Notice */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
          <ShieldCheck size={16} />
          <span>Prinsip Keamanan & Standar Objektivitas Scoring</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          1. <strong>Tanpa Diagnosis Klinis:</strong> Perhitungan nilai semata-mata mengukur capaian kuantitatif skor mentah (raw score) dan skor ternormalisasi (0 - 100) berdasarkan kunci jawaban panitia.<br />
          2. <strong>Immutabilitas Riwayat:</strong> Saat peserta memulai tes, snapshot konfigurasi scoring dibekukan (scoring snapshot) agar perubahan aturan di kemudian hari tidak merusak konsistensi skor peserta yang sudah berjalan.<br />
          3. <strong>Hak Akses Terbatas:</strong> Hanya SUPER_ADMIN yang diizinkan mengubah konfigurasi scoring. Panitia dan Pimpinan hanya memiliki hak tinjau (read-only).
        </p>
      </div>

      {/* Scoring Configs Table / Cards */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : configs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">Belum ada aturan konfigurasi scoring kategori psikotes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {configs.map(cfg => {
            const cat = categories.find(c => c.id === cfg.category_id);
            return (
              <div
                key={cfg.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-6 space-y-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 uppercase">
                      {cfg.scoring_model}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-2">
                      {cat?.name || cfg.category_name}
                    </h3>
                    {cat?.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  {canManageScoring && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(cfg)}
                      className="text-xs shrink-0"
                    >
                      <Edit size={14} className="mr-1.5" />
                      Ubah
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs border-t border-slate-100 pt-3">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium">Poin Benar</div>
                    <div className="font-bold text-teal-700 mt-0.5 text-sm">
                      +{cfg.default_correct_score}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium">Poin Salah</div>
                    <div className="font-bold text-slate-700 mt-0.5 text-sm">
                      {cfg.default_wrong_score}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium">Skala Normalisasi</div>
                    <div className="font-bold text-slate-800 mt-0.5 text-sm">
                      0 - {cfg.normalization_base || 100}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Model Pembobotan
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {cfg.scoring_model === 'BINARY' && 'Skor biner (0 atau nilai penuh) sesuai ketepatan pilihan opsi benar.'}
                    {cfg.scoring_model === 'WEIGHTED_OPTION' && 'Skor bertingkat (0, 1, 2) berdasarkan bobot akurasi masing-masing opsi.'}
                    {cfg.scoring_model === 'SCALE' && 'Skor skala ordinal / Likert konsistensi belajar calon santri.'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Edit Aturan Scoring */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Konfigurasi Aturan: ${editingConfig?.category_name}`}
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {formError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Model Scoring
            </label>
            <select
              value={formScoringModel}
              onChange={e => setFormScoringModel(e.target.value as any)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden bg-white"
            >
              <option value="BINARY">BINARY (Benar/Salah Poin Penuh)</option>
              <option value="WEIGHTED_OPTION">WEIGHTED_OPTION (Bobot Spesifik Per Opsi)</option>
              <option value="SCALE">SCALE (Skala Ordinal Tingkat Minat/Konsistensi)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Poin Default Benar
              </label>
              <input
                type="number"
                step="0.5"
                value={formCorrectScore}
                onChange={e => setFormCorrectScore(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Poin Default Salah
              </label>
              <input
                type="number"
                step="0.5"
                value={formWrongScore}
                onChange={e => setFormWrongScore(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Basis Normalisasi Nilai
            </label>
            <input
              type="number"
              value={formNormBase}
              onChange={e => setFormNormBase(Number(e.target.value))}
              placeholder="100"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Nilai per kategori dinormalisasi dengan rumus: (Skor Mentah / Skor Maksimal) × {formNormBase}.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSaving}
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Aturan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Tambah Kategori Baru */}
      <Modal
        isOpen={isNewCatModalOpen}
        onClose={() => setIsNewCatModalOpen(false)}
        title="Tambah Kategori Subtes Psikotes Baru"
        size="md"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          {formError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Kategori <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Contoh: PENALARAN NUMERIK & SPASIAL"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Deskripsi Subtes
            </label>
            <textarea
              value={newCatDesc}
              onChange={e => setNewCatDesc(e.target.value)}
              placeholder="Deskripsi kemampuan yang diukur dalam subtes ini..."
              rows={2}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Model Scoring
              </label>
              <select
                value={newCatModel}
                onChange={e => setNewCatModel(e.target.value as any)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden bg-white"
              >
                <option value="BINARY">BINARY</option>
                <option value="WEIGHTED_OPTION">WEIGHTED_OPTION</option>
                <option value="SCALE">SCALE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Poin Benar
              </label>
              <input
                type="number"
                value={newCatCorrectScore}
                onChange={e => setNewCatCorrectScore(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
                required
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNewCatModalOpen(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSaving}
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs"
            >
              {isSaving ? 'Menyimpan...' : 'Tambah Kategori'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
