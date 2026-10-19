import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { cbtService, ActiveExamSession } from '../services/cbtService';
import { Candidate, CandidateStatus } from '../types/database';
import { Exam, ExamAttempt, ExamAttemptQuestion, ExamAnswer } from '../types/cbt';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import {
  BookOpen,
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
  User,
  ListFilter
} from 'lucide-react';

export interface PesertaCbtPageProps {
  examId?: string;
  onNavigate: (route: string) => void;
}

export const PesertaCbtPage: React.FC<PesertaCbtPageProps> = ({ examId, onNavigate }) => {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveExamSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const timerIntervalRef = useRef<any>(null);

  // Autosave status indicator
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);

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
  } | null>(null);

  // Mobile Question Drawer
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState(false);

  // Anti-cheating violations
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);

  // --------------------------------------------------------------------------
  // 1. INITIALIZE EXAM ACCESS & LOAD/RESUME ATTEMPT
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
      // Find candidate
      const targetExamId = examId || 'exam-cbt-akademik-1';
      const access = await cbtService.checkCandidateExamAccess(user!.id, targetExamId);

      if (!access.allowed) {
        setAccessError(access.reason || 'Anda tidak diizinkan mengakses ujian ini.');
        setIsLoading(false);
        return;
      }

      // Check if attempt already submitted
      if (access.attempt && (access.attempt.status === 'SUBMITTED' || access.attempt.status === 'AUTO_SUBMITTED')) {
        // Load the finalized result
        const res = await cbtService.submitExamAttempt(access.attempt.id);
        setSubmissionResult({
          ...res,
          isAutoSubmit: access.attempt.status === 'AUTO_SUBMITTED',
        });
        setIsLoading(false);
        return;
      }

      // Start or Resume Active Attempt
      const startRes = await cbtService.startOrResumeAttempt(access.candidate!.id, targetExamId);
      if (!startRes.success || !startRes.session) {
        setAccessError(startRes.error || 'Gagal memulai sesi ujian.');
        setIsLoading(false);
        return;
      }

      setSession(startRes.session);
      setAnswers(startRes.session.answers);
      setSecondsRemaining(startRes.session.remainingSeconds);
    } catch (e: any) {
      console.error('Failed to init exam', e);
      setAccessError(e.message || 'Terjadi kesalahan sistem saat memuat ujian.');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 2. SERVER-SYNCHRONIZED COUNTDOWN TIMER & AUTO-SUBMIT
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!session || submissionResult) return;

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
  }, [session?.attempt.id, submissionResult]);

  const handleAutoSubmit = useCallback(async () => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await cbtService.submitExamAttempt(session.attempt.id, true);
      setSubmissionResult({
        ...res,
        isAutoSubmit: true,
      });
    } catch (e) {
      console.error('Auto submit error', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [session, isSubmitting]);

  // --------------------------------------------------------------------------
  // 3. ANTI-CHEATING AUDIT (TAB VISIBILITY DETECTION & BLUR)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!session || submissionResult) return;

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
  }, [session?.attempt.id, currentQuestionIndex, submissionResult]);

  // --------------------------------------------------------------------------
  // 4. QUESTION NAVIGATION & AUTOSAVE
  // --------------------------------------------------------------------------
  const currentQuestion = session?.questions[currentQuestionIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleOptionSelect = async (optionId: string) => {
    if (!session || !currentQuestion) return;

    const isMarked = currentAnswer?.is_marked || false;
    const newSelected = [optionId]; // Single choice for MULTIPLE_CHOICE / TRUE_FALSE

    // Optimistic local state update
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

    // Autosave to server
    setIsSavingAnswer(true);
    try {
      await cbtService.saveAnswer(
        session.attempt.id,
        currentQuestion.id,
        newSelected,
        isMarked
      );
    } catch (e) {
      console.error('Failed to autosave answer', e);
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
        selected_option_ids: selected,
        is_marked: newMarked,
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
      console.error('Failed to update mark', e);
    }
  };

  const handleNavigateQuestion = (idx: number) => {
    if (!session || idx < 0 || idx >= session.questions.length) return;
    setCurrentQuestionIndex(idx);
    setIsPaletteOpenMobile(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --------------------------------------------------------------------------
  // 5. MANUAL SUBMIT CONFIRMATION & EXECUTION
  // --------------------------------------------------------------------------
  const answeredCount = session
    ? session.questions.filter(q => answers[q.id]?.selected_option_ids?.length > 0).length
    : 0;
  const totalQuestionsCount = session?.questions.length || 0;
  const unansweredCount = totalQuestionsCount - answeredCount;

  const handleManualSubmit = async () => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await cbtService.submitExamAttempt(session.attempt.id, false);
      setSubmissionResult({
        ...res,
        isAutoSubmit: false,
      });
      setIsSubmitModalOpen(false);
    } catch (e: any) {
      showToastNotification(e.message || 'Gagal mengumpulkan lembar jawaban ujian.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format Timer HH:MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // --------------------------------------------------------------------------
  // 6. RENDER ERROR / DENIED ACCESS
  // --------------------------------------------------------------------------
  if (accessError) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900">Akses Ujian CBT Ditolak</h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            {accessError}
          </p>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 max-w-md mx-auto text-left space-y-1.5">
            <span className="font-bold text-slate-800 block">Syarat Mengikuti Ujian CBT:</span>
            <ul className="list-disc list-inside space-y-1">
              <li>Status pendaftaran telah <strong>TERVERIFIKASI</strong> (berkas valid).</li>
              <li>Telah ditempatkan pada <strong>Jadwal Seleksi Akademik</strong> oleh panitia.</li>
              <li>Ujian belum pernah disubmit (maksimal 1 kali pengerjaan).</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <Button variant="outline" onClick={() => onNavigate('/peserta/dashboard')}>
              Kembali ke Dashboard
            </Button>
            <Button
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              onClick={() => onNavigate('/peserta/jadwal')}
            >
              Cek Jadwal Seleksi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner text="Menyiapkan lembar ujian CBT Anda..." className="min-h-[70vh]" />;
  }

  // --------------------------------------------------------------------------
  // 7. RENDER SUBMISSION RESULT (When test is finished)
  // --------------------------------------------------------------------------
  if (submissionResult) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-white rounded-3xl border-2 border-emerald-800 p-8 shadow-xl text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto border-2 border-emerald-300">
            <Award className="w-10 h-10" />
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest block">
              Alhamdulillah
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              Ujian CBT Telah Selesai
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {submissionResult.isAutoSubmit
                ? 'Waktu pengerjaan telah habis. Seluruh jawaban Anda telah tersimpan dan otomatis dikumpulkan oleh sistem.'
                : 'Jawaban ujian seleksi akademik Anda telah berhasil dikumpulkan dan dinilai oleh sistem.'}
            </p>
          </div>

          {/* Breakdown summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-lg mx-auto">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Total Soal</span>
              <span className="font-mono text-xl font-bold text-slate-900">
                {submissionResult.totalQuestions}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Dijawab</span>
              <span className="font-mono text-xl font-bold text-emerald-700">
                {submissionResult.answeredQuestions}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Kosong</span>
              <span className="font-mono text-xl font-bold text-amber-600">
                {submissionResult.unansweredQuestions}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Status</span>
              <span className="font-bold text-xs text-emerald-800 block mt-1">
                Tersimpan
              </span>
            </div>
          </div>

          {/* Conditional score display based on showScore setting */}
          {submissionResult.showScore ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 max-w-sm mx-auto space-y-1">
              <span className="text-xs font-semibold text-emerald-800 uppercase block">
                Nilai Ujian Akademik
              </span>
              <div className="font-mono text-4xl sm:text-5xl font-black text-emerald-950">
                {submissionResult.normalizedScore.toFixed(2)}
              </div>
              <span className="text-xs text-emerald-700 font-medium block">
                Skala 0 - 100 • Jawaban Benar: {submissionResult.correctAnswers} Soal
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              <div className="font-bold text-slate-800 mb-1 flex items-center justify-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-700" />
                Pengumuman Hasil Seleksi
              </div>
              Ujian Anda telah selesai. Hasil akumulasi seleksi masuk santri baru akan diumumkan oleh panitia PSB PPTQM Darul Hikmah sesuai jadwal resmi di portal pendaftaran.
            </div>
          )}

          <div className="pt-2 flex flex-wrap gap-3 justify-center">
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => onNavigate('/peserta/dashboard')}
            >
              Kembali ke Dashboard Santri
            </Button>
            <Button
              variant="primary"
              size="md"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              onClick={() => onNavigate('/peserta/kartu')}
            >
              Lihat Kartu Ujian
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 8. RENDER ACTIVE CBT INTERFACE (Distraction-Free)
  // --------------------------------------------------------------------------
  if (!session || !currentQuestion) {
    return null;
  }

  const isTimerCritical = secondsRemaining <= 60;
  const isTimerWarning = secondsRemaining <= 300 && !isTimerCritical;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* 1. CBT HEADER BAR (Sticky top) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Institution & Exam Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-900 to-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-emerald-800 tracking-wider uppercase">
                PPTQM DARUL HIKMAH • TES AKADEMIK
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate max-w-xs sm:max-w-md">
                {session.exam.title}
              </h2>
            </div>
          </div>

          {/* TIMER DISPLAY */}
          <div className="flex items-center gap-3">
            {/* Autosave status indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              {isSavingAnswer ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" /> Menyimpan...
                </span>
              ) : (
                <span className="text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Jawaban Tersimpan
                </span>
              )}
            </div>

            <div
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border font-mono font-black text-sm sm:text-base transition-all ${
                isTimerCritical
                  ? 'bg-rose-100 text-rose-900 border-rose-400 animate-pulse'
                  : isTimerWarning
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-900 text-white border-slate-800'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>

            {/* Mobile Palette Toggle Button */}
            <button
              onClick={() => setIsPaletteOpenMobile(!isPaletteOpenMobile)}
              className="md:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              title="Daftar Soal"
            >
              <ListFilter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN TEST WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          {/* LEFT 3 COLS: CURRENT QUESTION AREA */}
          <div className="md:col-span-3 space-y-4">
            {/* Question Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              {/* Question Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Soal Nomor
                  </span>
                  <span className="w-9 h-9 rounded-xl bg-emerald-700 text-white font-mono font-black text-lg flex items-center justify-center shadow-xs">
                    {currentQuestion.question_order}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    dari {session.questions.length} Soal
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    Bobot: <strong>{currentQuestion.points_snapshot} Poin</strong>
                  </span>

                  <button
                    onClick={handleToggleMark}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition border ${
                      currentAnswer?.is_marked
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${currentAnswer?.is_marked ? 'fill-amber-600' : ''}`} />
                    {currentAnswer?.is_marked ? 'Ditandai Ragu' : 'Tandai Ragu'}
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-sm sm:text-base text-slate-900 font-medium leading-relaxed whitespace-pre-line mb-8 selection:bg-emerald-100">
                {currentQuestion.question_text_snapshot}
              </div>

              {/* Options List */}
              <div className="space-y-3">
                {currentQuestion.options_snapshot.map(opt => {
                  const isSelected = currentAnswer?.selected_option_ids?.includes(opt.id);

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleOptionSelect(opt.id)}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-600/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {opt.option_key}
                      </div>

                      <div className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed flex-1 pt-0.5">
                        {opt.option_text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Question Controls */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="md"
                disabled={currentQuestionIndex === 0}
                onClick={() => handleNavigateQuestion(currentQuestionIndex - 1)}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Sebelumnya
              </Button>

              <button
                onClick={handleToggleMark}
                className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition border ${
                  currentAnswer?.is_marked
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${currentAnswer?.is_marked ? 'fill-amber-600' : ''}`} />
                {currentAnswer?.is_marked ? 'Hapus Tanda Ragu' : 'Tandai Ragu-Ragu'}
              </button>

              {currentQuestionIndex < session.questions.length - 1 ? (
                <Button
                  variant="primary"
                  size="md"
                  className="bg-emerald-700 hover:bg-emerald-800 font-bold"
                  onClick={() => handleNavigateQuestion(currentQuestionIndex + 1)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Berikutnya
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  className="bg-blue-700 hover:bg-blue-800 font-bold"
                  onClick={() => setIsSubmitModalOpen(true)}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Selesai Ujian
                </Button>
              )}
            </div>
          </div>

          {/* RIGHT 1 COL: QUESTION PALETTE GRID (Desktop & Mobile Drawer) */}
          <div
            className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:relative md:inset-auto md:z-auto md:bg-transparent ${
              isPaletteOpenMobile ? 'flex items-center justify-center p-4' : 'hidden md:block'
            }`}
          >
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs w-full max-w-sm space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Navigasi Nomor Soal
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Terjawab: <strong>{answeredCount}</strong> dari {session.questions.length}
                  </p>
                </div>
                <button
                  onClick={() => setIsPaletteOpenMobile(false)}
                  className="md:hidden text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  Tutup
                </button>
              </div>

              {/* Status Legend */}
              <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
                  <span>Dijawab</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                  <span>Ragu</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-200 inline-block" />
                  <span>Kosong</span>
                </div>
              </div>

              {/* Grid Numbers */}
              <div className="grid grid-cols-5 gap-2 pt-1">
                {session.questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const hasAnswered = ans && ans.selected_option_ids && ans.selected_option_ids.length > 0;
                  const isMarked = ans?.is_marked;
                  const isCurrent = idx === currentQuestionIndex;

                  let btnStyle = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
                  if (hasAnswered && !isMarked) {
                    btnStyle = 'bg-emerald-600 text-white font-bold border-emerald-700 shadow-xs';
                  } else if (isMarked) {
                    btnStyle = 'bg-amber-500 text-white font-bold border-amber-600';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => handleNavigateQuestion(idx)}
                      className={`h-10 rounded-xl font-mono text-xs flex items-center justify-center transition border ${btnStyle} ${
                        isCurrent ? 'ring-3 ring-emerald-500 ring-offset-1 font-black scale-105' : ''
                      }`}
                    >
                      {q.question_order}
                    </button>
                  );
                })}
              </div>

              {/* Finish Exam Button at Bottom of Palette */}
              <div className="pt-3 border-t border-slate-100">
                <Button
                  size="md"
                  variant="primary"
                  className="w-full bg-blue-700 hover:bg-blue-800 font-bold"
                  leftIcon={<Send className="w-4 h-4" />}
                  onClick={() => {
                    setIsPaletteOpenMobile(false);
                    setIsSubmitModalOpen(true);
                  }}
                >
                  Kumpulkan Lembar Ujian
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 3. CONFIRMATION SUBMIT MODAL */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => !isSubmitting && setIsSubmitModalOpen(false)}
        title="Konfirmasi Pengumpulan Ujian"
        subtitle="Pastikan seluruh jawaban Anda telah terisi dengan benar"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setIsSubmitModalOpen(false)}
            >
              Periksa Kembali
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold shadow-md"
              isLoading={isSubmitting}
              onClick={handleManualSubmit}
            >
              Ya, Kumpulkan Sekarang
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">Total Soal Ujian:</span>
              <strong className="text-slate-900 font-mono">{totalQuestionsCount} Soal</strong>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">Soal Telah Dijawab:</span>
              <strong className="text-emerald-700 font-mono font-bold">{answeredCount} Soal</strong>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">Soal Belum Dijawab:</span>
              <strong className={unansweredCount > 0 ? 'text-rose-600 font-mono font-bold' : 'text-slate-600 font-mono'}>
                {unansweredCount} Soal
              </strong>
            </div>
          </div>

          {unansweredCount > 0 ? (
            <Alert
              type="warning"
              title="Perhatian"
              message={`Anda masih memiliki ${unansweredCount} butir soal yang belum dijawab. Soal yang kosong akan mendapatkan nilai 0 poin.`}
            />
          ) : (
            <Alert
              type="success"
              title="Lengkap"
              message="Seluruh butir soal telah berhasil Anda jawab. Klik tombol di bawah untuk mengumpulkan lembar jawaban."
            />
          )}

          <p className="text-[11px] text-slate-500 leading-tight">
            Setelah dikumpulkan, sesi pengerjaan ujian Anda akan ditutup secara permanen dan tidak dapat dibuka kembali.
          </p>
        </div>
      </Modal>

      {/* ANTI-CHEATING VIOLATION WARNING MODAL */}
      <Modal
        isOpen={showViolationModal}
        onClose={() => setShowViolationModal(false)}
        title="Peringatan Integritas Ujian!"
        subtitle="Aktivitas keluar tab / jendela ujian terdeteksi"
        maxWidth="md"
        footer={
          <div className="flex justify-end w-full">
            <Button
              size="sm"
              variant="primary"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              onClick={() => setShowViolationModal(false)}
            >
              Saya Mengerti dan Kembali Mengerjakan
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              Peringatan Pelanggaran ke-{violationCount} dari Batas 3x
            </div>
            <p className="leading-relaxed">
              Anda terdeteksi beralih jendela atau membuka tab lain selama ujian berlangsung.
              Sistem mencatat waktu dan aktivitas ini secara otomatis ke dalam riwayat pengawasan ujian (Audit Trail).
            </p>
          </div>

          {violationCount >= 3 && (
            <Alert
              type="error"
              title="Batas Toleransi Tercapai"
              message="Anda telah mencapai batas 3 kali perpindahan tab. Sesi ujian Anda telah ditandai untuk peninjauan khusus oleh panitia seleksi PSB."
            />
          )}

          <p className="text-[11px] text-slate-500">
            Demi keadilan seleksi seluruh calon santri baru PPTQM Darul Hikmah, harap tetap berada pada halaman ini hingga ujian selesai.
          </p>
        </div>
      </Modal>
    </div>
  );
};
