import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { selectionScoringService } from '../services/selectionScoringService';
import { SelectionTieBreaker } from '../types/selection';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import {
  Users,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  ArrowUpDown,
  Sliders,
  Info
} from 'lucide-react';

export const AdminSeleksiKuotaPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const canManageQuota = hasPermission(role, 'QUOTA_MANAGE');

  const [quota, setQuota] = useState(120);
  const [reserveCount, setReserveCount] = useState(20);
  const [tieBreakers, setTieBreakers] = useState<SelectionTieBreaker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [qData, tbList] = await Promise.all([
        selectionScoringService.getQuotaConfig(),
        selectionScoringService.getTieBreakers(),
      ]);
      setQuota(qData.quota);
      setReserveCount(qData.reserve_count);
      setTieBreakers(tbList);
    } catch (e) {
      console.error('Failed to load quota and tie breakers', e);
      setErrorMessage('Gagal memuat konfigurasi kuota.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageQuota) {
      setErrorMessage('Akses Ditolak (403): Hanya Super Admin yang berwenang mengubah konfigurasi kuota.');
      return;
    }
    setShowWarning(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowWarning(false);
    try {
      const res = await selectionScoringService.updateQuotaConfig(
        { quota: Number(quota), reserve_count: Number(reserveCount) },
        { id: user?.id, role: role || undefined, email: user?.email }
      );

      if (!res.success) throw new Error(res.error || 'Gagal menyimpan kuota.');

      setSuccessMessage('Konfigurasi kuota dan cadangan penerimaan santri baru berhasil diperbarui.');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menyimpan kuota.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => onNavigate('/admin/seleksi')}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 mb-2 transition"
        >
          <ArrowLeft size={14} />
          <span>Kembali ke Dashboard Seleksi</span>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pengaturan Kuota & Cadangan Santri</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Alokasi kuota utama penerimaan santri dan ambang cadangan TP 2027/2028.
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <ShieldAlert size={16} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-slate-400 mt-2">Memuat konfigurasi kuota...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quota Form */}
          <form onSubmit={handleSaveClick} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders size={18} className="text-emerald-600" />
              Target Kuota Penerimaan Santri Baru
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                <label className="block text-xs font-black text-emerald-900 uppercase tracking-wider">
                  1. Kuota Utama (Lulus Murni) *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    required
                    disabled={!canManageQuota}
                    value={quota}
                    onChange={e => setQuota(parseInt(e.target.value, 10) || 1)}
                    className="w-32 px-4 py-2 text-2xl font-black rounded-xl border border-emerald-300 bg-white text-emerald-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                  />
                  <span className="text-sm font-bold text-emerald-800">Santri Baru</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  Peserta dengan peringkat 1 sampai {quota} yang memenuhi passing grade akan ditetapkan sebagai <strong>LULUS</strong>.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                <label className="block text-xs font-black text-amber-900 uppercase tracking-wider">
                  2. Kuota Cadangan (Waiting List) *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    required
                    disabled={!canManageQuota}
                    value={reserveCount}
                    onChange={e => setReserveCount(parseInt(e.target.value, 10) || 0)}
                    className="w-32 px-4 py-2 text-2xl font-black rounded-xl border border-amber-300 bg-white text-amber-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                  />
                  <span className="text-sm font-bold text-amber-800">Santri Cadangan</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Peserta peringkat {quota + 1} sampai {quota + reserveCount} yang memenuhi passing grade akan ditetapkan sebagai <strong>CADANGAN</strong>.
                </p>
              </div>
            </div>

            {/* Warning Dialog before Save */}
            {showWarning && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Konfirmasi Perubahan Kuota Resmi</h4>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Perubahan kuota ini akan berlaku untuk Selection Run berikutnya. Selection Run yang sudah berstatus APPROVED di masa lalu <strong>TIDAK AKAN BERUBAH</strong> (tetap menggunakan snapshot kuota historis). Tindakan ini akan dicatat ke dalam Audit Trail.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowWarning(false)}>
                    Batal
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    disabled={isSaving}
                    onClick={handleConfirmSave}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                  >
                    {isSaving ? 'Menyimpan...' : 'Ya, Simpan Perubahan Kuota'}
                  </Button>
                </div>
              </div>
            )}

            {!showWarning && canManageQuota && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button variant="primary" size="sm" type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                  Simpan Pengaturan Kuota
                </Button>
              </div>
            )}
          </form>

          {/* Tie Breakers Rules Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ArrowUpDown size={16} className="text-indigo-600" />
                  Urutan Prioritas Pemecah Nilai Seri (Tie-Breaker Rules)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hierarki penentuan peringkat deterministik jika terdapat kandidat dengan skor yang identik.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-slate-700">Urutan Prioritas Penentuan Rangking Resmi:</div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700">
                {tieBreakers.map((tb, idx) => (
                  <li key={tb.id} className="font-medium">
                    Prioritas {tb.priority}: <strong className="text-slate-900">{tb.rule_code}</strong> ({tb.direction === 'DESC' ? 'Tertinggi ke Terendah' : 'Terendah ke Tertinggi'})
                  </li>
                ))}
              </ol>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
              <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Kebijakan Seri di Batas Kuota:</strong> Jika seluruh aturan tie-break di atas masih menghasilkan skor identik pada batas kuota (misal peserta ke-120 dan ke-121 sama persis), sistem <strong>DILARANG</strong> memilih secara acak. Status peserta akan ditetapkan sebagai <strong>TIE_PENDING</strong> dan approval kelulusan akan diblokir sampai diselesaikan secara manual oleh Super Admin.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
