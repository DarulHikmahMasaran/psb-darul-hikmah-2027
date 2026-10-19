import { showToastNotification, confirmAction } from '../utils/notify';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { quranService } from '../services/quranService';
import { QuranAssessment } from '../types/quran';
import {
  BookOpen,
  ArrowLeft,
  ShieldCheck,
  RotateCcw,
  Unlock,
  Calendar,
  MapPin,
  User,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { Modal } from '../components/Modal';

export const AdminQuranDetailPage = ({
  assessmentId,
  onNavigate,
}: {
  assessmentId: string;
  onNavigate: (to: string) => void;
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<QuranAssessment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Revision Modal
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [revisionLoading, setRevisionLoading] = useState(false);

  // Unlock Modal
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await quranService.getAssessmentById(assessmentId, {
        id: user?.id || '',
        role: user?.role || 'PANITIA',
      });
      if (res.assessment) {
        setAssessment(res.assessment);
      } else {
        setErrorMessage(res.error || 'Data penilaian tidak ditemukan.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat detail penilaian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assessmentId, user?.id]);

  const handleRequestRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionNotes.trim()) {
      showToastNotification('Mohon isi alasan permintaan revisi.');
      return;
    }

    setRevisionLoading(true);
    try {
      const res = await quranService.requestRevision(assessmentId, revisionNotes, {
        id: user?.id || '',
        email: user?.email || '',
        name: user?.profile?.full_name,
      });

      if (res.success) {
        setRevisionModalOpen(false);
        setSuccessMessage('Permintaan revisi berhasil dikirim ke penguji.');
        loadData();
      } else {
        showToastNotification(res.error || 'Gagal meminta revisi.');
      }
    } catch (err: any) {
      showToastNotification(err.message || 'Terjadi kesalahan.');
    } finally {
      setRevisionLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockLoading(true);
    try {
      const res = await quranService.adminUnlockAssessment(assessmentId, unlockReason, {
        id: user?.id || '',
        email: user?.email || '',
        role: user?.role || undefined,
      });

      if (res.success) {
        setUnlockModalOpen(false);
        setSuccessMessage('Nilai berhasil dibuka kembali untuk diedit.');
        loadData();
      } else {
        showToastNotification(res.error || 'Gagal membuka kunci.');
      }
    } catch (err: any) {
      showToastNotification(err.message || 'Terjadi kesalahan.');
    } finally {
      setUnlockLoading(false);
    }
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700">Memuat detail penilaian Al-Qur'an...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <Alert type="error" title="Gagal Membuka" message={errorMessage || 'Data tidak ditemukan.'} />
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onNavigate('/admin/quran')}>
            Kembali ke Daftar Penilaian
          </Button>
        </div>
      </div>
    );
  }

  const candidate = assessment.candidate;
  const schedule = assessment.schedule;
  const isLocked = assessment.status === 'LOCKED';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('/admin/quran')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          Kembali ke Daftar Penilaian
        </Button>

        <div className="flex items-center gap-2">
          {isLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRevisionNotes('');
                setRevisionModalOpen(true);
              }}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="text-amber-800 border-amber-300 hover:bg-amber-50"
            >
              Minta Revisi
            </Button>
          )}

          {isSuperAdmin && isLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUnlockReason('');
                setUnlockModalOpen(true);
              }}
              leftIcon={<Unlock className="w-3.5 h-3.5" />}
              className="text-purple-800 border-purple-300 hover:bg-purple-50"
            >
              Buka Kunci Nilai
            </Button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="mb-6">
          <Alert type="success" title="Berhasil" message={successMessage} />
        </div>
      )}

      {/* Status Banner */}
      <div className="mb-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {candidate?.registration_number}
            </span>
            <span className="text-xs text-slate-500">• {candidate?.gender === 'L' ? 'Ikhwan' : 'Akhwat'}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">{candidate?.full_name}</h1>
          <p className="text-xs text-slate-500">{candidate?.school_name}</p>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-3 sm:p-0 bg-slate-50 sm:bg-transparent rounded-xl shrink-0">
          <span className="text-xs font-bold text-slate-400 uppercase">Nilai Akhir Qur'an</span>
          <div className="text-3xl font-black text-emerald-800">
            {assessment.normalized_score} <span className="text-xs font-medium text-slate-400">/ 100</span>
          </div>
          <div className="mt-1">
            {assessment.status === 'LOCKED' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                Terkunci (LOCKED)
              </span>
            ) : assessment.status === 'NEEDS_REVISION' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3.5 h-3.5" />
                Perlu Revisi
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                Draft / In Progress
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-xs">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <h3 className="font-bold text-slate-900 mb-2 uppercase text-[11px] text-slate-400 tracking-wider">
            Penguji & Sesi Seleksi
          </h3>
          <div className="space-y-1.5">
            <div>
              <span className="text-slate-500">Ustadz Penguji:</span>{' '}
              <strong className="text-slate-900">{assessment.examiner?.full_name || 'Ustadz Penguji'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Jadwal:</span>{' '}
              <strong className="text-slate-900">{schedule?.title}</strong>
            </div>
            <div>
              <span className="text-slate-500">Ruangan & Waktu:</span>{' '}
              <strong className="text-slate-900">{schedule?.room} • {schedule?.test_date} ({schedule?.start_time} WIB)</strong>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <h3 className="font-bold text-slate-900 mb-2 uppercase text-[11px] text-slate-400 tracking-wider">
            Materi Ujian
          </h3>
          <div className="space-y-1.5">
            <div>
              <span className="text-slate-500">Surah yang Diuji:</span>{' '}
              <strong className="text-slate-900">{assessment.surah_name || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Rentang Ayat:</span>{' '}
              <strong className="text-slate-900">{assessment.ayat_range || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Kelompok Juz:</span>{' '}
              <strong className="text-slate-900">{assessment.juz_tested || 'Juz 30'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown per Rubric */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-700" />
          <span>Rincian Nilai per Aspek Rubrik Al-Qur'an</span>
        </h3>

        <div className="divide-y divide-slate-100">
          {assessment.scores?.map((sc, idx) => {
            const snap = assessment.snapshots?.find((s) => s.rubric_id === sc.rubric_id);
            return (
              <div key={sc.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-900">{sc.rubric_name_snapshot}</h4>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        Bobot: {sc.weight}%
                      </span>
                    </div>
                    {snap?.description_snapshot && (
                      <p className="text-xs text-slate-500 mt-1 max-w-xl">{snap.description_snapshot}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-lg font-black text-emerald-700">
                      Skor: {sc.score}{' '}
                      <span className="text-xs font-medium text-slate-400">
                        (&rarr; Terbobot: {sc.weighted_score})
                      </span>
                    </div>
                  </div>
                </div>

                {sc.examiner_note && (
                  <div className="mt-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-700">
                    <span className="font-semibold text-slate-500">Catatan Khusus:</span> {sc.examiner_note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reading Notes & Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h4 className="font-bold text-slate-900 uppercase text-[11px] text-slate-400 tracking-wider mb-2">
            Catatan Kesalahan Bacaan
          </h4>
          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
            {assessment.reading_notes || 'Tidak ada catatan kesalahan bacaan khusus.'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h4 className="font-bold text-slate-900 uppercase text-[11px] text-slate-400 tracking-wider mb-2">
            Catatan Umum & Rekomendasi
          </h4>
          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
            {assessment.notes || 'Tidak ada catatan rekomendasi tambahan.'}
          </p>
        </div>
      </div>

      {/* Modal Minta Revisi */}
      <Modal
        isOpen={revisionModalOpen}
        onClose={() => setRevisionModalOpen(false)}
        title="Minta Revisi Penilaian Al-Qur'an"
      >
        <form onSubmit={handleRequestRevision} className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
            Penilaian akan dibuka kembali ke status <strong>NEEDS_REVISION</strong> dan penguji akan menerima pemberitahuan untuk melakukan koreksi skor/catatan.
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Alasan & Catatan Revisi untuk Penguji:
            </label>
            <textarea
              required
              rows={4}
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Contoh: Mohon periksa kembali skor kelancaran tajwid ayat 5-10, atau sesuaikan catatan makhraj..."
              className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevisionModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={revisionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              Kirim Permintaan Revisi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Unlock */}
      <Modal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        title="Buka Kunci Nilai (Super Admin Override)"
      >
        <form onSubmit={handleUnlock} className="space-y-4 text-xs">
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900">
            Tindakan ini akan mengembalikan status penilaian menjadi <strong>IN_PROGRESS</strong>. Semua perubahan akan tercatat di audit log.
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Alasan Pembukaan Kunci:
            </label>
            <input
              type="text"
              required
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Contoh: Koreksi nilai berdasarkan sidang pleno panitia..."
              className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUnlockModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={unlockLoading}
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold"
            >
              Buka Kunci
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
