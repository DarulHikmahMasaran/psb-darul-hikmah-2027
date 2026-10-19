import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { cbtService, ActiveExamSession } from '../services/cbtService';
import { ExamAttemptQuestion, ExamAnswer } from '../types/cbt';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import {
  Brain,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Send,
  HelpCircle,
  Check,
  ShieldAlert,
  Award,
  Calendar,
  ListFilter,
  Eye,
  FileText
} from 'lucide-react';

export interface PesertaPsikotesPageProps {
  examId?: string;
  onNavigate: (route: string) => void;
}

export const PesertaPsikotesPage: React.FC<PesertaPsikotesPageProps> = ({ examId, onNavigate }) => {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveExamSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Pre-test instructions & ready state
  const [isReadyStarted, setIsReadyStarted] = useState(false);
  const [targetExamMeta, setTargetExamMeta] = useState<any>(null);

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const timerIntervalRef = useRef<any>(null);

  // Autosave status indicator
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pre-submit Modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Final Result state after submission
  const [submissionResult, setSubmissionResult] = useState<{
    totalQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    unansweredQuestions: number;
    rawScore: number;
    normalizedScore: number;
    showScore: boolean;
    isAutoSubmit?: boolean;
    categoryScores?: any[];
  } | null>(null);

  // Mobile Question Drawer
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState(false);

  // Anti-cheating violations
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);

  // --------------------------------------------------------------------------
  // 1. INITIALIZE EXAM ACCESS & CHECK EXISTING ATTEMPT
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (user?.id) {
      initExam();
    }
  }, [user?.id, examId]);

  const initExam = async () => {
    setIsLoading(true);
    setAccessError(null);
    try {
      const access = await cbtService.checkCandidateExamAccess(user!.id, examId, 'PSYCHOTEST');

      if (!access.allowed) {
        setAccessError(access.reason || 'Anda tidak diizinkan mengakses asesmen psikotes.');
        setIsLoading(false);
        return;
      }

      setTargetExamMeta({
        exam: access.exam,
        candidate: access.candidate,
        schedule: access.schedule,
      });

      // Check if attempt already submitted
      if (access.attempt && (access.attempt.status === 'SUBMITTED' || access.attempt.status === 'AUTO_SUBMITTED')) {
        const res = await cbtService.submitExamAttempt(access.attempt.id);
        setSubmissionResult({
          ...res,
          isAutoSubmit: access.attempt.status === 'AUTO_SUBMITTED',
          categoryScores: access.attempt.category_scores,
        });
        setIsLoading(false);
        return;
      }

      // If attempt is already in progress, resume immediately without re-showing instructions
      if (access.attempt && access.attempt.status === 'IN_PROGRESS') {
        const startRes = await cbtService.startOrResumeAttempt(access.candidate!.id, access.exam!.id);
        if (startRes.success && startRes.session) {
          setSession(startRes.session);
          setAnswers(startRes.session.answers);
          setSecondsRemaining(startRes.session.remainingSeconds);
          setIsReadyStarted(true);
        }
      }
    } catch (e: any) {
      console.error('Failed to init psychotest exam', e);
      setAccessError(e.message || 'Terjadi kesalahan sistem saat memuat asesmen psikotes.');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 2. CANDIDATE CONFIRMED READY: START TIMER & LOAD QUESTIONS
  // --------------------------------------------------------------------------
  const handleStartExam = async () => {
    if (!targetExamMeta?.candidate?.id || !targetExamMeta?.exam?.id) return;
    setIsLoading(true);
    try {
      const startRes = await cbtService.startOrResumeAttempt(
        targetExamMeta.candidate.id,
        targetExamMeta.exam.id
      );
      if (!startRes.success || !startRes.session) {
        setAccessError(startRes.error || 'Gagal memulai sesi asesmen psikotes.');
        setIsLoading(false);
        return;
      }
      setSession(startRes.session);
      setAnswers(startRes.session.answers);
      setSecondsRemaining(startRes.session.remainingSeconds);
      setIsReadyStarted(true);
    } catch (e: any) {
      setAccessError(e.message || 'Gagal memulai psikotes.');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 3. SERVER-SYNCHRONIZED COUNTDOWN TIMER & AUTO-SUBMIT
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!session || submissionResult || !isReadyStarted) return;

    timerIntervalRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [session?.attempt.id, submissionResult, isReadyStarted]);

  const handleAutoSubmit = useCallback(async () => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await cbtService.submitExamAttempt(session.attempt.id, true);
      setSubmissionResult({
        ...res,
        isAutoSubmit: true,
        categoryScores: res.attempt?.category_scores,
      });
    } catch (e) {
      console.error('Auto submit error in psychotest', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [session, isSubmitting]);

  // --------------------------------------------------------------------------
  // 4. TAB VISIBILITY DETECTION & AUDIT
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!session || submissionResult || !isReadyStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cbtService.recordExamEvent(session.attempt.id, 'TAB_SWITCH', {
          questionIndex: currentQuestionIndex + 1,
          timestamp: new Date().toISOString(),
        });
      } else {
        cbtService.recordExamEvent(session.attempt.id, 'TAB_VISIBLE', {
          questionIndex: currentQuestionIndex + 1,
          timestamp: new Date().toISOString(),
        });
        setViolationCount(prev => {
          const next = prev + 1;
          setShowViolationModal(true);
          return next;
        });
      }
    };

    const handleBlur = () => {
      cbtService.recordExamEvent(session.attempt.id, 'WINDOW_BLUR', {
        questionIndex: currentQuestionIndex + 1,
        timestamp: new Date().toISOString(),
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [session?.attempt.id, currentQuestionIndex, submissionResult, isReadyStarted]);

  // --------------------------------------------------------------------------
  // 5. QUESTION SELECTION & AUTOSAVE
  // --------------------------------------------------------------------------
  const currentQuestion = session?.questions[currentQuestionIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleOptionSelect = async (optionId: string) => {
    if (!session || !currentQuestion) return;

    const isMarked = currentAnswer?.is_marked || false;
    const newSelected = [optionId];

    const updatedAns: ExamAnswer = {
      id: currentAnswer?.id || 'ans-tmp',
      attempt_id: session.attempt.id,
      attempt_question_id: currentQuestion.id,
      selected_option_ids: newSelected,
      answered_at: new Date().toISOString(),
      is_marked: isMarked,
      updated_at: new Date().toISOString(),
    };

    setAnswers(prev => ({ ...prev, [currentQuestion.id]: updatedAns }));

    setIsSavingAnswer(true);
    setSaveError(null);
    try {
      await cbtService.saveAnswer(
        session.attempt.id,
        currentQuestion.id,
        newSelected,
        isMarked
      );
    } catch (e: any) {
      console.error('Failed to autosave answer', e);
      setSaveError('Koneksi terganggu. Jawaban yang tersimpan di server tetap aman.');
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const handleToggleMark = async () => {
    if (!session || !currentQuestion) return;

    const newMarked = !currentAnswer?.is_marked;
    const selected = currentAnswer?.selected_option_ids || [];

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] || {
          id: 'ans-tmp',
          attempt_id: session.attempt.id,
          attempt_question_id: currentQuestion.id,
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        attempt_id: session.attempt.id,
        attempt_question_id: currentQuestion.id,
        selected_option_ids: selected,
        is_marked: newMarked,
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }));

    try {
      await cbtService.saveAnswer(
        session.attempt.id,
        currentQuestion.id,
        selected,
        newMarked
      );
    } catch (e) {
      console.error('Failed to toggle mark', e);
    }
  };

  const handleManualSubmit = async () => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await cbtService.submitExamAttempt(session.attempt.id, false);
      setSubmissionResult({
        ...res,
        isAutoSubmit: false,
        categoryScores: res.attempt?.category_scores,
      });
      setIsSubmitModalOpen(false);
    } catch (e: any) {
      console.error('Submit exam error', e);
      setAccessError(e.message || 'Gagal mengirimkan jawaban psikotes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper stats
  const totalQuestions = session?.questions.length || 0;
  const answeredCount = Object.values(answers).filter(a => a.selected_option_ids && a.selected_option_ids.length > 0).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const markedCount = Object.values(answers).filter(a => a.is_marked).length;

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // --------------------------------------------------------------------------
  // RENDER: LOADING STATE
  // --------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <LoadingSpinner size="lg" className="text-teal-400 mb-4" />
        <h2 className="text-xl font-bold">Menyiapkan Asesmen Psikotes...</h2>
        <p className="text-slate-400 text-sm mt-1">Memverifikasi berkas pendaftaran dan memuat snapshot soal aman.</p>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: ACCESS FORBIDDEN / NOT ELIGIBLE
  // --------------------------------------------------------------------------
  if (accessError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Akses Psikotes Ditolak</h2>
          <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl mb-6 text-left border border-red-200">
            {accessError}
          </div>
          <p className="text-slate-500 text-sm mb-6">
            Pastikan pendaftaran santri Anda telah berstatus <strong>TERVERIFIKASI</strong> dan telah dijadwalkan oleh Panitia PSB PPTQM Darul Hikmah pada sesi Psikotes.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => onNavigate('/peserta/dashboard')}>
              <ArrowLeft size={16} className="mr-2" />
              Kembali ke Dashboard
            </Button>
            <Button variant="primary" onClick={() => onNavigate('/peserta/jadwal')}>
              Lihat Jadwal Seleksi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: FINAL RESULT SCREEN (SUBMITTED)
  // --------------------------------------------------------------------------
  if (submissionResult) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 py-12">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white p-8 text-center">
            <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
              <Brain size={36} className="text-teal-300" />
            </div>
            <div className="text-xs uppercase tracking-wider font-semibold text-teal-300 mb-1">
              PSB PPTQM DARUL HIKMAH TP 2027/2028
            </div>
            <h2 className="text-2xl font-bold">Psikotes Selesai Dikerjakan</h2>
            <p className="text-teal-100 text-sm mt-2">
              {submissionResult.isAutoSubmit
                ? 'Waktu ujian telah berakhir dan jawaban Anda otomatis dikumpulkan oleh sistem.'
                : 'Jawaban asesmen psikotes Anda telah berhasil dikumpulkan dan dikunci secara aman.'}
            </p>
          </div>

          <div className="p-8 space-y-6">
            {/* Score Display (Controlled by show_score_to_candidate) */}
            {submissionResult.showScore ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
                <div className="text-xs uppercase font-semibold tracking-wider text-slate-500 mb-1">
                  Skor Perolehan Anda
                </div>
                <div className="text-5xl font-black text-teal-700">
                  {submissionResult.normalizedScore}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Skor Mentah: {submissionResult.rawScore} poin
                </div>
              </div>
            ) : (
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 text-teal-900 flex items-start gap-4">
                <CheckCircle size={24} className="text-teal-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-teal-950">Psikotes Anda telah selesai</div>
                  <p className="text-teal-800 mt-1">
                    Hasil dan rekapitulasi asesmen kognitif akan diproses secara terintegrasi oleh Panitia Seleksi PSB PPTQM Darul Hikmah TP 2027/2028.
                  </p>
                </div>
              </div>
            )}

            {/* Questions breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                <div className="text-2xl font-bold text-slate-800">{submissionResult.totalQuestions}</div>
                <div className="text-xs text-slate-500 font-medium mt-1">Total Soal Asesmen</div>
              </div>
              <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 text-center">
                <div className="text-2xl font-bold text-teal-700">{submissionResult.answeredQuestions}</div>
                <div className="text-xs text-teal-600 font-medium mt-1">Soal Terjawab</div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <Button
                variant="primary"
                className="w-full justify-center py-3 text-base shadow-lg shadow-teal-700/20"
                onClick={() => onNavigate('/peserta/dashboard')}
              >
                <ArrowLeft size={18} className="mr-2" />
                Kembali ke Dashboard Santri
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: PRE-TEST INSTRUCTION & READY PAGE (Requirement 16)
  // --------------------------------------------------------------------------
  if (!isReadyStarted) {
    const examMeta = targetExamMeta?.exam;
    const scheduleMeta = targetExamMeta?.schedule;
    const candidateMeta = targetExamMeta?.candidate;

    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 py-12">
        <div className="max-w-2xl w-full bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-950 p-8 border-b border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-teal-500/20 border border-teal-400/30 rounded-2xl flex items-center justify-center text-teal-300">
                <Brain size={28} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-teal-300">
                  PSB PPTQM DARUL HIKMAH TP 2027/2028
                </div>
                <h1 className="text-2xl font-bold text-white">
                  {examMeta?.title || 'Psikotes Seleksi Calon Santri Baru'}
                </h1>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Asesmen potensi kognitif yang mengukur kemampuan logika, daya penalaran, konsentrasi, ketelitian, dan daya tangkap visual calon santri kelas 6 SD/MI untuk jenjang SMP PPTQM Darul Hikmah.
            </p>
          </div>

          {/* Test Meta Info */}
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-700/50 p-4 rounded-2xl border border-slate-600/50 flex items-center gap-3">
                <Clock size={24} className="text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400 font-medium">Durasi Pengerjaan</div>
                  <div className="text-lg font-bold text-white">{examMeta?.duration_minutes || 60} Menit</div>
                </div>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-2xl border border-slate-600/50 flex items-center gap-3">
                <FileText size={24} className="text-teal-400 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400 font-medium">Jumlah Soal</div>
                  <div className="text-lg font-bold text-white">{examMeta?.total_questions || 16} Butir</div>
                </div>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-2xl border border-slate-600/50 flex items-center gap-3">
                <ShieldAlert size={24} className="text-sky-400 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400 font-medium">Kesempatan</div>
                  <div className="text-lg font-bold text-white">1 Kali Attempt</div>
                </div>
              </div>
            </div>

            {/* Candidate Info Card */}
            <div className="bg-slate-700/30 p-4 rounded-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <span className="text-slate-400">Nama Calon Santri: </span>
                <span className="font-semibold text-white">{candidateMeta?.full_name}</span>
              </div>
              <div>
                <span className="text-slate-400">No. Registrasi: </span>
                <span className="font-mono font-semibold text-teal-300">{candidateMeta?.registration_number}</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-teal-300 uppercase tracking-wider flex items-center gap-2">
                <HelpCircle size={16} />
                Ketentuan & Tata Tertib Pengerjaan
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold">•</span>
                  <span><strong>Satu Kali Kesempatan:</strong> Psikotes hanya dapat dikerjakan satu kali. Setelah jawaban dikumpulkan (submit), attempt akan dikunci dan tidak dapat diulang.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold">•</span>
                  <span><strong>Autosave Otomatis:</strong> Setiap jawaban yang Anda pilih akan langsung tersimpan di server secara aman. Jika koneksi terputus sesaat, jawaban Anda tetap aman.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold">•</span>
                  <span><strong>Waktu Berjalan Server-Side:</strong> Timer dihitung berdasarkan waktu server. Saat waktu habis, sistem akan melakukan <strong>Auto-Submit</strong> secara otomatis.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold">•</span>
                  <span><strong>Pola & Gambar:</strong> Pada soal visual dan spasial, perhatikan gambar pola dengan seksama sebelum memilih jawaban terbaik.</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="w-full sm:w-auto text-slate-300 border-slate-600 hover:bg-slate-700 justify-center"
                onClick={() => onNavigate('/peserta/dashboard')}
              >
                <ArrowLeft size={16} className="mr-2" />
                Kembali ke Dashboard
              </Button>
              <Button
                variant="primary"
                className="flex-1 justify-center py-3.5 text-base font-bold bg-teal-600 hover:bg-teal-500 shadow-xl shadow-teal-600/30"
                onClick={handleStartExam}
              >
                [ SAYA SIAP MENGERJAKAN ]
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: ACTIVE EXAM INTERFACE (Generic CBT Layout Reuse)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none">
      {/* 1. TOP BAR */}
      <header className="bg-slate-800/90 backdrop-blur border-b border-slate-700/80 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600/20 border border-teal-500/40 rounded-xl flex items-center justify-center text-teal-400">
            <Brain size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-teal-400">
              PSIKOTES PPTQM DARUL HIKMAH
            </div>
            <div className="text-xs text-slate-400 hidden sm:block">
              TP 2027/2028 • {session?.exam.title || 'Psikotes Calon Santri'}
            </div>
          </div>
        </div>

        {/* Center: Server-side Timer */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-base sm:text-lg font-bold border ${
          secondsRemaining < 300
            ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
            : 'bg-slate-700/60 text-amber-300 border-slate-600'
        }`}>
          <Clock size={18} />
          <span>{formatTimer(secondsRemaining)}</span>
        </div>

        {/* Right: Autosave status & Submit trigger */}
        <div className="flex items-center gap-2">
          {/* Autosave status indicator */}
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            {isSavingAnswer ? (
              <span className="text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Menyimpan...
              </span>
            ) : saveError ? (
              <span className="text-red-400 text-[11px] max-w-[180px] truncate" title={saveError}>
                ⚠️ {saveError}
              </span>
            ) : (
              <span className="text-teal-400 flex items-center gap-1">
                <Check size={14} />
                ✓ Tersimpan
              </span>
            )}
          </div>

          {/* Palette toggle on Mobile */}
          <button
            onClick={() => setIsPaletteOpenMobile(true)}
            className="lg:hidden p-2 rounded-xl bg-slate-700/80 text-slate-300 hover:text-white"
          >
            <ListFilter size={18} />
          </button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsSubmitModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs sm:text-sm shadow-md"
          >
            <Send size={14} className="mr-1.5" />
            Submit Psikotes
          </Button>
        </div>
      </header>

      {/* 2. MAIN BODY */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT / CENTER: QUESTION DISPLAY (Cols 1-3) */}
        <div className="lg:col-span-3 flex flex-col justify-between bg-slate-800/60 rounded-3xl border border-slate-700/80 p-6 sm:p-8 backdrop-blur shadow-xl">
          {currentQuestion ? (
            <div className="space-y-6">
              {/* Question Header & Category Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold bg-teal-500/20 text-teal-300 px-3 py-1 rounded-xl border border-teal-500/30">
                    Soal No. {currentQuestionIndex + 1} / {totalQuestions}
                  </span>
                  {currentQuestion.category_name_snapshot && (
                    <span className="text-xs uppercase font-bold tracking-wider bg-slate-700 text-amber-300 px-2.5 py-1 rounded-lg">
                      {currentQuestion.category_name_snapshot}
                    </span>
                  )}
                </div>

                {/* Mark question button */}
                <button
                  onClick={handleToggleMark}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                    currentAnswer?.is_marked
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  <Bookmark size={14} className={currentAnswer?.is_marked ? 'fill-amber-300 text-amber-300' : ''} />
                  {currentAnswer?.is_marked ? 'Ditandai Ragu-ragu' : 'Tandai Ragu-ragu'}
                </button>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed whitespace-pre-line">
                {currentQuestion.question_text_snapshot}
              </div>

              {/* Question Image (Visual / Spatial Attachment) */}
              {currentQuestion.image_url_snapshot && (
                <div className="my-4 bg-slate-900/80 rounded-2xl p-4 border border-slate-700 flex flex-col items-center justify-center">
                  <div className="text-xs text-slate-400 mb-2 font-medium">Bagan / Pola Gambar Soal:</div>
                  <img
                    src={currentQuestion.image_url_snapshot}
                    alt="Bagan Soal Psikotes"
                    className="max-h-56 w-auto rounded-xl object-contain shadow-md"
                  />
                </div>
              )}

              {/* Options */}
              <div className="space-y-3 pt-2">
                {currentQuestion.options_snapshot.map(opt => {
                  const isSelected = currentAnswer?.selected_option_ids?.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleOptionSelect(opt.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                        isSelected
                          ? 'bg-teal-500/20 border-teal-400 text-white shadow-lg shadow-teal-500/10'
                          : 'bg-slate-700/40 border-slate-600/80 text-slate-200 hover:bg-slate-700/70 hover:border-slate-500'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center shrink-0 text-sm ${
                        isSelected
                          ? 'bg-teal-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-300 border border-slate-600'
                      }`}>
                        {opt.option_key}
                      </div>
                      <div className="text-sm sm:text-base pt-1 leading-relaxed">
                        {opt.option_text}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">Tidak ada soal aktif.</div>
          )}

          {/* Bottom Navigation Controls */}
          <div className="flex items-center justify-between pt-8 border-t border-slate-700/80 mt-8">
            <Button
              variant="outline"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              className="text-slate-300 border-slate-600 hover:bg-slate-700"
            >
              <ArrowLeft size={16} className="mr-2" />
              Soal Sebelumnya
            </Button>

            <div className="text-xs text-slate-400 hidden sm:block">
              {currentAnswer?.selected_option_ids?.length ? '✓ Jawaban dipilih' : 'Belum dijawab'}
            </div>

            {currentQuestionIndex < totalQuestions - 1 ? (
              <Button
                variant="primary"
                onClick={() => setCurrentQuestionIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                className="bg-teal-600 hover:bg-teal-500 text-white"
              >
                Soal Berikutnya
                <ArrowRight size={16} className="ml-2" />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setIsSubmitModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Selesai & Kumpulkan
                <Send size={16} className="ml-2" />
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT: QUESTION PALETTE DRAWER (Col 4 on desktop) */}
        <div className="hidden lg:flex flex-col bg-slate-800/60 rounded-3xl border border-slate-700/80 p-6 backdrop-blur shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Navigasi Soal
            </h3>
            <span className="text-xs font-semibold text-teal-400">
              {answeredCount} / {totalQuestions}
            </span>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mb-4 pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-500" />
              <span>Terjawab</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span>Ragu-ragu</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-700 border border-slate-500" />
              <span>Belum</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded ring-2 ring-teal-400 bg-transparent" />
              <span>Aktif</span>
            </div>
          </div>

          {/* Grid buttons */}
          <div className="grid grid-cols-4 gap-2.5 overflow-y-auto max-h-[460px] pr-1">
            {session?.questions.map((q, idx) => {
              const ans = answers[q.id];
              const isAnswered = ans && ans.selected_option_ids && ans.selected_option_ids.length > 0;
              const isMarked = ans?.is_marked;
              const isCurrent = idx === currentQuestionIndex;

              let btnStyle = 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600';
              if (isMarked) {
                btnStyle = 'bg-amber-500 text-slate-950 font-bold border-amber-400';
              } else if (isAnswered) {
                btnStyle = 'bg-teal-600 text-white font-bold border-teal-500';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`h-11 rounded-xl font-mono text-sm border flex items-center justify-center transition-all ${btnStyle} ${
                    isCurrent ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105 z-10' : ''
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. MOBILE PALETTE MODAL */}
      <Modal
        isOpen={isPaletteOpenMobile}
        onClose={() => setIsPaletteOpenMobile(false)}
        title="Daftar Nomor Soal Psikotes"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto p-1">
            {session?.questions.map((q, idx) => {
              const ans = answers[q.id];
              const isAnswered = ans && ans.selected_option_ids && ans.selected_option_ids.length > 0;
              const isMarked = ans?.is_marked;
              const isCurrent = idx === currentQuestionIndex;

              let btnStyle = 'bg-slate-100 text-slate-700 border-slate-300';
              if (isMarked) {
                btnStyle = 'bg-amber-500 text-white font-bold border-amber-500';
              } else if (isAnswered) {
                btnStyle = 'bg-teal-600 text-white font-bold border-teal-600';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentQuestionIndex(idx);
                    setIsPaletteOpenMobile(false);
                  }}
                  className={`h-12 rounded-xl text-sm font-bold border flex items-center justify-center ${btnStyle} ${
                    isCurrent ? 'ring-2 ring-teal-700' : ''
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* 4. PRE-SUBMIT CONFIRMATION MODAL (Requirement 20) */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Konfirmasi Pengumpulan Psikotes"
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Soal Asesmen:</span>
              <span className="font-bold text-slate-800">{totalQuestions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-teal-700 font-medium">Sudah dijawab:</span>
              <span className="font-bold text-teal-700">{answeredCount} / {totalQuestions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-amber-700 font-medium">Belum dijawab:</span>
              <span className="font-bold text-amber-700">{unansweredCount}</span>
            </div>
            {markedCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600 font-medium">Ditandai Ragu-ragu:</span>
                <span className="font-bold text-amber-600">{markedCount}</span>
              </div>
            )}
          </div>

          {unansweredCount > 0 && (
            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-200 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                Masih ada <strong>{unansweredCount} soal</strong> yang belum Anda jawab. Apakah Anda yakin ingin mengumpulkan psikotes ini sekarang?
              </span>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Setelah tombol <strong>[Submit Psikotes]</strong> ditekan, sesi psikotes akan dikunci dan Anda tidak dapat mengubah jawaban lagi.
          </p>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="outline"
              onClick={() => setIsSubmitModalOpen(false)}
              disabled={isSubmitting}
            >
              [ Batal ]
            </Button>
            <Button
              variant="primary"
              onClick={handleManualSubmit}
              isLoading={isSubmitting}
              className="bg-teal-700 hover:bg-teal-600 font-bold"
            >
              [ Submit Psikotes ]
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. TAB VIOLATION ALERT MODAL */}
      <Modal
        isOpen={showViolationModal}
        onClose={() => setShowViolationModal(false)}
        title="Peringatan Integritas Seleksi"
      >
        <div className="space-y-4 text-center">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={28} />
          </div>
          <h4 className="text-lg font-bold text-slate-800">Aktivitas Terdeteksi</h4>
          <p className="text-sm text-slate-600">
            Sistem mendeteksi bahwa Anda berpindah tab atau jendela peramban. Seluruh aktivitas terekam dalam audit event log seleksi.
          </p>
          <div className="bg-slate-100 text-slate-700 text-xs p-3 rounded-xl">
            Jumlah Peringatan Berpindah: <strong>{violationCount} kali</strong>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowViolationModal(false)}
            className="w-full justify-center bg-teal-700"
          >
            Saya Mengerti & Kembali Mengerjakan
          </Button>
        </div>
      </Modal>
    </div>
  );
};
