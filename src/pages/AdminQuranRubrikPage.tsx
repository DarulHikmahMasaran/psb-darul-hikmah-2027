import { showToastNotification, confirmAction } from '../utils/notify';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { quranService } from '../services/quranService';
import { QuranRubric } from '../types/quran';
import {
  BookOpen,
  ArrowLeft,
  Plus,
  Save,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Sliders
} from 'lucide-react';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { Modal } from '../components/Modal';

export const AdminQuranRubrikPage = ({ onNavigate }: { onNavigate: (to: string) => void }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rubrics, setRubrics] = useState<QuranRubric[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit / Add modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Partial<QuranRubric> | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Weights batch editor state
  const [weightsState, setWeightsState] = useState<Record<string, number>>({});
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const loadRubrics = async () => {
    setLoading(true);
    try {
      const list = await quranService.getRubrics();
      setRubrics(list);
      const wMap: Record<string, number> = {};
      list.forEach((r) => {
        wMap[r.id] = r.weight;
      });
      setWeightsState(wMap);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat rubrik.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRubrics();
  }, []);

  const totalActiveWeight = rubrics
    .filter((r) => r.is_active)
    .reduce((sum, r) => sum + (Number(weightsState[r.id] ?? r.weight) || 0), 0);

  const isWeightValid = Math.round(totalActiveWeight * 100) / 100 === 100;

  const handleWeightChange = (rubricId: string, val: number) => {
    setWeightsState((prev) => ({
      ...prev,
      [rubricId]: isNaN(val) ? 0 : val,
    }));
  };

  const handleSaveAllWeights = async () => {
    if (!isWeightValid) {
      setErrorMessage(`Total bobot rubrik aktif harus tepat 100%. Total saat ini: ${totalActiveWeight}%.`);
      return;
    }

    setIsSavingWeights(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = Object.entries(weightsState).map(([id, weight]) => ({
        id,
        weight: Number(weight),
      }));

      const res = await quranService.updateRubricWeights(payload, {
        id: user?.id || '',
        email: user?.email || '',
      });

      if (res.success) {
        setSuccessMessage('Bobot penilaian Al-Qur\'an berhasil diperbarui.');
        loadRubrics();
      } else {
        setErrorMessage(res.error || 'Gagal menyimpan bobot.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSavingWeights(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingRubric({
      code: '',
      name: '',
      description: '',
      min_score: 0,
      max_score: 100,
      weight: 0,
      sort_order: rubrics.length + 1,
      is_required: false,
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (r: QuranRubric) => {
    setEditingRubric({ ...r });
    setModalOpen(true);
  };

  const handleSaveRubricModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRubric) return;

    setModalSaving(true);
    try {
      const res = await quranService.saveRubric(editingRubric, {
        id: user?.id || '',
        email: user?.email || '',
      });

      if (res.success) {
        setModalOpen(false);
        setSuccessMessage('Rubrik berhasil disimpan.');
        loadRubrics();
      } else {
        showToastNotification(res.error || 'Gagal menyimpan rubrik.');
      }
    } catch (err: any) {
      showToastNotification(err.message || 'Terjadi kesalahan.');
    } finally {
      setModalSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/admin/quran')}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Kembali
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pengaturan Rubrik & Bobot Al-Qur'an</h1>
            <p className="text-xs text-slate-500">
              Konfigurasi aspek rubrik penilaian, deskripsi, skala nilai, dan proporsi bobot.
            </p>
          </div>
        </div>

        {isSuperAdmin && (
          <Button
            size="sm"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
          >
            Tambah Rubrik Baru
          </Button>
        )}
      </div>

      {successMessage && (
        <div className="mb-6">
          <Alert type="success" title="Berhasil" message={successMessage} />
        </div>
      )}

      {errorMessage && (
        <div className="mb-6">
          <Alert type="error" title="Peringatan Validasi" message={errorMessage} />
        </div>
      )}

      {/* Weight Summary Indicator Bar */}
      <div
        className={`p-4 rounded-xl border mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isWeightValid
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg text-white ${
              isWeightValid ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          >
            {isWeightValid ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">
              Total Bobot Rubrik Aktif: <span className="text-base font-black">{totalActiveWeight}%</span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {isWeightValid
                ? 'Total bobot telah tepat 100% dan memenuhi ketentuan validasi penilaian seleksi.'
                : `Total bobot saat ini ${totalActiveWeight}%. Harap sesuaikan bobot agar berjumlah tepat 100%.`}
            </p>
          </div>
        </div>

        {isSuperAdmin && (
          <Button
            size="sm"
            disabled={!isWeightValid}
            isLoading={isSavingWeights}
            onClick={handleSaveAllWeights}
            leftIcon={<Save className="w-3.5 h-3.5" />}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold shrink-0"
          >
            Simpan Perubahan Bobot
          </Button>
        )}
      </div>

      {/* Rubrics List Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Memuat rubrik...</div>
        ) : (
          rubrics.map((r, idx) => {
            const currentWeight = weightsState[r.id] ?? r.weight;

            return (
              <div
                key={r.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition ${
                  r.is_active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-60'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h3 className="font-extrabold text-base text-slate-900">{r.name}</h3>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                        {r.code}
                      </span>
                      {r.is_required && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Wajib
                        </span>
                      )}
                      {!r.is_active && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                      {r.description}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                      <span>Skala Skor: {r.min_score} s.d {r.max_score}</span>
                      <span>•</span>
                      <span>Urutan Tampilan: #{r.sort_order}</span>
                    </div>
                  </div>

                  {/* Weight Input */}
                  <div className="flex items-center gap-3 shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">Bobot</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          disabled={!isSuperAdmin || !r.is_active}
                          value={currentWeight}
                          onChange={(e) => handleWeightChange(r.id, parseFloat(e.target.value))}
                          className="w-16 p-1.5 text-center text-sm font-black text-slate-900 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                        />
                        <span className="text-xs font-bold text-slate-600">%</span>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="pl-3 border-l border-slate-200">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditModal(r)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Edit / Add Rubric */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRubric?.id ? 'Edit Rubrik Al-Qur\'an' : 'Tambah Rubrik Baru'}
      >
        {editingRubric && (
          <form onSubmit={handleSaveRubricModal} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Kode Rubrik (Kapital, tanpa spasi):
              </label>
              <input
                type="text"
                required
                value={editingRubric.code || ''}
                onChange={(e) => setEditingRubric({ ...editingRubric, code: e.target.value })}
                placeholder="Contoh: KELANCARAN, WAQAF_IBTIDA"
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 uppercase font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nama Rubrik Penilaian:
              </label>
              <input
                type="text"
                required
                value={editingRubric.name || ''}
                onChange={(e) => setEditingRubric({ ...editingRubric, name: e.target.value })}
                placeholder="Contoh: Kelancaran & Kecepatan Membaca"
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Deskripsi / Petunjuk Penguji:
              </label>
              <textarea
                required
                rows={3}
                value={editingRubric.description || ''}
                onChange={(e) => setEditingRubric({ ...editingRubric, description: e.target.value })}
                placeholder="Jelaskan aspek yang dinilai pada rubrik ini secara objektif..."
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Skor Minimum:</label>
                <input
                  type="number"
                  min={0}
                  value={editingRubric.min_score ?? 0}
                  onChange={(e) => setEditingRubric({ ...editingRubric, min_score: parseFloat(e.target.value) })}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Skor Maksimum:</label>
                <input
                  type="number"
                  min={1}
                  value={editingRubric.max_score ?? 100}
                  onChange={(e) => setEditingRubric({ ...editingRubric, max_score: parseFloat(e.target.value) })}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bobot Persentase (%):</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editingRubric.weight ?? 0}
                  onChange={(e) => setEditingRubric({ ...editingRubric, weight: parseFloat(e.target.value) })}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Urutan (Sort Order):</label>
                <input
                  type="number"
                  min={1}
                  value={editingRubric.sort_order ?? 1}
                  onChange={(e) => setEditingRubric({ ...editingRubric, sort_order: parseInt(e.target.value, 10) })}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingRubric.is_active ?? true}
                  onChange={(e) => setEditingRubric({ ...editingRubric, is_active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-700">Aktif Digunakan</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingRubric.is_required ?? true}
                  onChange={(e) => setEditingRubric({ ...editingRubric, is_required: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-700">Wajib Dinilai</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={modalSaving}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                Simpan Rubrik
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
