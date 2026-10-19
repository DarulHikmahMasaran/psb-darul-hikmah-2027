import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { quranService } from '../services/quranService';
import { QuranAssessment, QuranAssessmentRubricSnapshot } from '../types/quran';
import {
  BookOpen,
  ArrowLeft,
  Save,
  CheckCircle2,
  Lock,
  AlertCircle,
  HelpCircle,
  User,
  MapPin,
  Calendar,
  Sparkles,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { Modal } from '../components/Modal';

interface ScoreInputState {
  rubric_id: string;
  score: number;
  examiner_note: string;
}

export const PengujiAssessmentPage = ({
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

  // Form Fields
  const [surahName, setSurahName] = useState('');
  const [ayatRange, setAyatRange] = useState('');
  const [juzTested, setJuzTested] = useState('Juz 30');
  const [readingNotes, setReadingNotes] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [scoresState, setScoresState] = useState<Record<string, ScoreInputState>>({});

  // Actions
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const loadAssessment = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await quranService.getAssessmentById(assessmentId, {
        id: user?.id || '',
        role: user?.role || 'PENGUJI_QURAN',
      });

      if (res.assessment) {
        const a = res.assessment;
        setAssessment(a);
        setSurahName(a.surah_name || '');
        setAyatRange(a.ayat_range || '');
        setJuzTested(a.juz_tested || 'Juz 30');
        setReadingNotes(a.reading_notes || '');
        setGeneralNotes(a.notes || '');

        const mapped: Record<string, ScoreInputState> = {};
        if (a.snapshots) {
          a.snapshots.forEach((snap) => {
            const sc = a.scores?.find((s) => s.rubric_id === snap.rubric_id);
            mapped[snap.rubric_id] = {
              rubric_id: snap.rubric_id,
              score: sc?.score ?? 0,
              examiner_note: sc?.examiner_note || '',
            };
          });
        }
        setScoresState(mapped);
      } else {
        setErrorMessage(res.error || 'Penilaian tidak ditemukan.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat data penilaian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssessment();
  }, [assessmentId, user?.id]);

  // Is Locked?
  const isLocked = assessment?.status === 'LOCKED';
  const isNeedsRevision = assessment?.status === 'NEEDS_REVISION';
  const canEdit = !isLocked;

  // Real-time live score calculation
  const liveCalculation = useMemo(() => {
    if (!assessment?.snapshots) return { total: 0, items: [] };

    let total = 0;
    const items = assessment.snapshots.map((snap) => {
      const stateItem = scoresState[snap.rubric_id];
      const val = stateItem ? Number(stateItem.score || 0) : 0;
      const safe = Math.min(Math.max(val, snap.min_score_snapshot), snap.max_score_snapshot);
      const weighted = Math.round((safe * (snap.weight_snapshot / 100)) * 100) / 100;
      total += weighted;
      return {
        rubricId: snap.rubric_id,
        name: snap.rubric_name_snapshot,
        weight: snap.weight_snapshot,
        score: safe,
        weightedScore: weighted,
      };
    });

    return {
      total: Math.round(total * 100) / 100,
      items,
    };
  }, [assessment?.snapshots, scoresState]);

  const handleScoreChange = (rubricId: string, value: number) => {
    if (!canEdit) return;
    setScoresState((prev) => ({
      ...prev,
      [rubricId]: {
        ...(prev[rubricId] || { rubric_id: rubricId, examiner_note: '' }),
        score: isNaN(value) ? 0 : value,
      },
    }));
  };

  const handleNoteChange = (rubricId: string, note: string) => {
    if (!canEdit) return;
    setScoresState((prev) => ({
      ...prev,
      [rubricId]: {
        ...(prev[rubricId] || { rubric_id: rubricId, score: 0 }),
        examiner_note: note,
      },
    }));
  };

  const handleQuickAdd = (rubricId: string, addVal: number, maxScore: number) => {
    if (!canEdit) return;
    const current = scoresState[rubricId]?.score || 0;
    const next = Math.min(maxScore, current + addVal);
    handleScoreChange(rubricId, next);
  };

  const handleSetExact = (rubricId: string, exactVal: number) => {
    if (!canEdit) return;
    handleScoreChange(rubricId, exactVal);
  };

  const buildPayload = () => {
    const scoresArray = Object.values(scoresState).map((item) => ({
      rubric_id: item.rubric_id,
      score: item.score,
      examiner_note: item.examiner_note,
    }));

    return {
      surah_name: surahName,
      ayat_range: ayatRange,
      juz_tested: juzTested,
      reading_notes: readingNotes,
      notes: generalNotes,
      scores: scoresArray,
    };
  };

  const handleSaveDraft = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = buildPayload();
      const res = await quranService.saveAssessmentDraft(assessmentId, payload, {
        id: user?.id || '',
        email: user?.email || '',
        role: user?.role || 'PENGUJI_QURAN',
      });

      if (res.success && res.assessment) {
        setAssessment(res.assessment);
        setSuccessMessage('Draft penilaian berhasil disimpan.');
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res.error || 'Gagal menyimpan draft.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitFinal = async () => {
    if (!canEdit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirmSubmitOpen(false);

    try {
      const payload = buildPayload();
      const res = await quranService.submitAssessment(assessmentId, payload, {
        id: user?.id || '',
        email: user?.email || '',
        role: user?.role || 'PENGUJI_QURAN',
        name: user?.profile?.full_name,
      });

      if (res.success && res.assessment) {
        setAssessment(res.assessment);
        setSuccessMessage('Penilaian Al-Qur\'an berhasil dikirim dan dikunci.');
      } else {
        setErrorMessage(res.error || 'Gagal submit penilaian.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700">Memuat Formulir Penilaian Al-Qur'an...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <Alert type="error" title="Gagal Membuka Penilaian" message={errorMessage || 'Data tidak ditemukan.'} />
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onNavigate('/penguji')}>
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const candidate = assessment.candidate;
  const schedule = assessment.schedule;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('/penguji')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          Kembali
        </Button>

        <div className="text-right">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
            PSB PPTQM Darul Hikmah TP 2027/2028
          </span>
          <span className="text-xs font-extrabold text-emerald-800">
            Lembar Penilaian Al-Qur'an
          </span>
        </div>
      </div>

      {/* Banner / Revision Alert */}
      {isLocked && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">Nilai Telah Dikirim & Dikunci (LOCKED)</h3>
              <p className="text-xs text-emerald-800">
                Penilaian ini telah selesai dan tidak dapat diubah tanpa izin revisi dari panitia PSB.
              </p>
            </div>
          </div>
          <span className="text-xl font-black text-emerald-800 px-3 py-1 bg-white rounded-lg border border-emerald-200 shadow-xs">
            {assessment.normalized_score}
          </span>
        </div>
      )}

      {isNeedsRevision && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-600 text-white rounded-lg shrink-0 mt-0.5">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">Permintaan Revisi dari Panitia</h3>
              <p className="text-xs text-amber-900 mt-1 font-medium bg-white/70 p-2.5 rounded-lg border border-amber-200">
                "{assessment.revision_notes || 'Silakan tinjau kembali skor atau catatan bacaan santri.'}"
              </p>
              <p className="text-[11px] text-amber-700 mt-1">
                Formulir telah dibuka kembali. Silakan perbaiki lalu tekan tombol <strong>Submit Penilaian</strong> kembali.
              </p>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6">
          <Alert type="error" title="Kesalahan" message={errorMessage} />
        </div>
      )}

      {successMessage && (
        <div className="mb-6">
          <Alert type="success" title="Berhasil" message={successMessage} />
        </div>
      )}

      {/* Candidate Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-800 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold shadow-md shrink-0">
              {candidate?.full_name ? candidate.full_name.charAt(0) : <User className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {candidate?.registration_number || '-'}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {candidate?.gender === 'L' ? 'Ikhwan (Putra)' : 'Akhwat (Putri)'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                {candidate?.full_name || 'Nama Santri'}
              </h2>
              <p className="text-xs text-slate-500">
                Asal Sekolah: <span className="font-semibold text-slate-700">{candidate?.school_name || '-'}</span>
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <div className="text-xs font-bold text-slate-800">{schedule?.title || 'Sesi Seleksi Al-Qur\'an'}</div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center sm:justify-end gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              <span>{schedule?.room || 'Halaqah'} • {schedule?.test_date}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Pukul {schedule?.start_time} - {schedule?.end_time} WIB
            </div>
          </div>
        </div>
      </div>

      {/* Bacaan Detail Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs mb-6">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-700" />
          <span>Informasi Materi Bacaan Santri</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Surah yang Diuji
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={surahName}
              onChange={(e) => setSurahName(e.target.value)}
              placeholder="Contoh: QS. Al-Mulk, An-Naba"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rentang Ayat
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={ayatRange}
              onChange={(e) => setAyatRange(e.target.value)}
              placeholder="Contoh: Ayat 1 - 20"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Juz / Kelompok Hafalan
            </label>
            <select
              disabled={!canEdit}
              value={juzTested}
              onChange={(e) => setJuzTested(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="Juz 30">Juz 30 (Standar Seleksi)</option>
              <option value="Juz 29 - 30">Juz 29 s.d 30 (2 Juz)</option>
              <option value="Juz 1 - 5">Juz 1 s.d 5 (Takhassus)</option>
              <option value="Lebih dari 5 Juz">&gt; 5 Juz (Hafidz Mutqin)</option>
              <option value="Surah Pilihan">Surah Pilihan Tertentu</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rubrics Assessment Cards */}
      <div className="space-y-6 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            <span>Penilaian per Aspek Rubrik Al-Qur'an</span>
          </h3>
          <span className="text-xs text-slate-500">Skala Nilai 0 - 100</span>
        </div>

        {assessment.snapshots?.map((snap, idx) => {
          const stateItem = scoresState[snap.rubric_id] || { rubric_id: snap.rubric_id, score: 0, examiner_note: '' };
          const currentScore = stateItem.score;
          const weightedScore = Math.round((currentScore * (snap.weight_snapshot / 100)) * 100) / 100;

          return (
            <div
              key={snap.id}
              className="bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-500/50 p-5 sm:p-6 shadow-xs transition duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                      {snap.rubric_name_snapshot}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Bobot: {snap.weight_snapshot}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                    {snap.description_snapshot}
                  </p>
                </div>

                {/* Score Big Display */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-3 sm:p-0 bg-slate-50 sm:bg-transparent rounded-xl shrink-0">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Nilai Terbobot</span>
                  <div className="text-xl sm:text-2xl font-black text-emerald-700">
                    {weightedScore} <span className="text-xs font-medium text-slate-400">pts</span>
                  </div>
                </div>
              </div>

              {/* Score Input & Quick Buttons */}
              <div className="pt-4 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                <div className="md:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Masukkan Skor Santri ({snap.min_score_snapshot} - {snap.max_score_snapshot}):
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={snap.min_score_snapshot}
                      max={snap.max_score_snapshot}
                      disabled={!canEdit}
                      value={currentScore === 0 ? '' : currentScore}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        handleScoreChange(snap.rubric_id, val);
                      }}
                      placeholder="0"
                      className="w-28 text-center py-2.5 px-3 text-2xl font-black text-slate-900 rounded-xl border-2 border-emerald-700/60 focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                    <div className="text-xs text-slate-400">
                      <div>Min: {snap.min_score_snapshot}</div>
                      <div>Max: {snap.max_score_snapshot}</div>
                    </div>
                  </div>
                </div>

                {/* Quick Score Buttons */}
                {canEdit && (
                  <div className="md:col-span-7">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Pilihan Skor Cepat:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[70, 75, 80, 85, 90, 95, 100].map((quickVal) => (
                        <button
                          key={quickVal}
                          type="button"
                          onClick={() => handleSetExact(snap.rubric_id, quickVal)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            currentScore === quickVal
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {quickVal}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(snap.rubric_id, 5, snap.max_score_snapshot)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Examiner Note Per Rubric */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Catatan Khusus untuk {snap.rubric_name_snapshot} (opsional):
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={stateItem.examiner_note || ''}
                  onChange={(e) => handleNoteChange(snap.rubric_id, e.target.value)}
                  placeholder={`Contoh: Tajwid mantap, atau tawaqquf 2x pada ayat ke-5...`}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Reading Notes & General Feedback */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            Catatan Kesalahan Bacaan
          </h4>
          <p className="text-[11px] text-slate-500 mb-2">
            Catat detail letak kesalahan tajwid, makhraj, atau ayat yang terlewat (jika ada):
          </p>
          <textarea
            disabled={!canEdit}
            rows={3}
            value={readingNotes}
            onChange={(e) => setReadingNotes(e.target.value)}
            placeholder="Contoh: Kesalahan hukum ikhfa pada ayat 8, makhraj huruf Dhod tertukar dengan Zho..."
            className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50 resize-none"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            Catatan Umum & Rekomendasi
          </h4>
          <p className="text-[11px] text-slate-500 mb-2">
            Rekomendasi penempatan program (Reguler / Takhassus Tahfidz):
          </p>
          <textarea
            disabled={!canEdit}
            rows={3}
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Contoh: Bacaan tartil dan merdu, sangat layak masuk program Takhassus 30 Juz..."
            className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50 resize-none"
          />
        </div>
      </div>

      {/* Sticky Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 px-4 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Nilai Al-Qur'an (Live)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-800">
                  {liveCalculation.total}
                </span>
                <span className="text-xs font-bold text-slate-500">/ 100</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 text-[11px] text-slate-600">
              {liveCalculation.items.map((it) => (
                <span key={it.rubricId} className="px-2 py-0.5 bg-slate-100 rounded-md">
                  {it.name.split(' ')[0]}: <strong>{it.weightedScore}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {canEdit ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={isSaving}
                  onClick={handleSaveDraft}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                  className="text-xs"
                >
                  Simpan Draft
                </Button>
                <Button
                  size="sm"
                  isLoading={isSubmitting}
                  onClick={() => setConfirmSubmitOpen(true)}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md"
                >
                  Submit Penilaian
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Nilai Terkunci Permanen</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal Submit */}
      <Modal
        isOpen={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        title="Konfirmasi Submit Penilaian Al-Qur'an"
      >
        <div className="space-y-4 text-xs text-slate-600">
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-amber-950">Peringatan Penguncian Nilai (Locking)</p>
              <p className="mt-1 leading-relaxed">
                Setelah dikirim, nilai Al-Qur'an peserta <strong>{candidate?.full_name} ({candidate?.registration_number})</strong> akan langsung <strong>DIKUNCI (LOCKED)</strong> dan tidak dapat diubah kembali oleh penguji tanpa persetujuan revisi dari panitia PSB.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex justify-between font-bold text-slate-800 text-sm">
              <span>Total Nilai Akhir Al-Qur'an:</span>
              <span className="text-emerald-700 text-base">{liveCalculation.total} / 100</span>
            </div>
            {liveCalculation.items.map((it) => (
              <div key={it.rubricId} className="flex justify-between text-slate-600 text-xs">
                <span>{it.name} ({it.weight}%):</span>
                <span>Skor: {it.score} &rarr; Terbobot: <strong>{it.weightedScore}</strong></span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-500">
            Apakah Anda yakin seluruh nilai dan catatan bacaan santri sudah benar dan sesuai ketentuan seleksi?
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmSubmitOpen(false)}
            >
              Batal & Periksa Lagi
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitFinal}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
            >
              Ya, Submit & Kunci Nilai
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
