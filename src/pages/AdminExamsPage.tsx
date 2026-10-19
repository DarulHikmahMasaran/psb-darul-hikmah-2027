import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { cbtService } from '../services/cbtService';
import { scheduleService } from '../services/scheduleService';
import { Exam, Subject, ExamQuestionConfig } from '../types/cbt';
import { TestSchedule } from '../types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDateIndonesian } from '../utils/formatters';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Shuffle,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Play,
  BarChart2,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';

export interface AdminExamsPageProps {
  onNavigate?: (route: string) => void;
}

export const AdminExamsPage: React.FC<AdminExamsPageProps> = ({ onNavigate }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [academicSchedules, setAcademicSchedules] = useState<TestSchedule[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [totalQuestions, setTotalQuestions] = useState(50);
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [passingScore, setPassingScore] = useState<number | undefined>(70);
  const [showScore, setShowScore] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Per-Subject Question Count Configurations
  const [subjectConfigs, setSubjectConfigs] = useState<
    Array<{ subject_id: string; question_count: number; points_per_question: number }>
  >([]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allExams, allSchedules, allSubjects] = await Promise.all([
        cbtService.getExams(),
        scheduleService.getSchedules(),
        cbtService.getSubjects(),
      ]);

      setExams(allExams);
      setSubjects(allSubjects);
      // Filter schedules to AKADEMIK type
      const academicOnly = allSchedules.filter(
        s => s.test_type?.code === 'AKADEMIK' || s.title.toLowerCase().includes('akademik')
      );
      setAcademicSchedules(academicOnly.length > 0 ? academicOnly : allSchedules);
    } catch (e) {
      console.error('Failed to load exams', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingExam(null);
    setTitle('Tes Potensi Akademik PSB 2027/2028');
    setDescription('Ujian seleksi berbasis komputer materi Matematika, Bahasa Indonesia, IPA, PAI, dan Pengetahuan Umum.');
    setScheduleId(academicSchedules[0]?.id || '');
    setDurationMinutes(90);
    setTotalQuestions(25);
    setRandomizeQuestions(true);
    setRandomizeOptions(true);
    setPassingScore(70);
    setShowScore(false);
    setIsActive(true);

    // Initial default configs (equal split across subjects)
    setSubjectConfigs(
      subjects.map(s => ({
        subject_id: s.id,
        question_count: 5,
        points_per_question: 4,
      }))
    );

    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (exam: Exam) => {
    setEditingExam(exam);
    setTitle(exam.title);
    setDescription(exam.description || '');
    setScheduleId(exam.test_schedule_id);
    setDurationMinutes(exam.duration_minutes);
    setTotalQuestions(exam.total_questions);
    setRandomizeQuestions(exam.randomize_questions);
    setRandomizeOptions(exam.randomize_options);
    setPassingScore(exam.passing_score);
    setShowScore(exam.show_score_to_candidate ?? false);
    setIsActive(exam.is_active);

    if (exam.configs && exam.configs.length > 0) {
      setSubjectConfigs(
        subjects.map(s => {
          const existing = exam.configs?.find(c => c.subject_id === s.id);
          return {
            subject_id: s.id,
            question_count: existing ? existing.question_count : 0,
            points_per_question: existing ? existing.points_per_question : 4,
          };
        })
      );
    } else {
      setSubjectConfigs(
        subjects.map(s => ({
          subject_id: s.id,
          question_count: Math.floor(exam.total_questions / subjects.length),
          points_per_question: 4,
        }))
      );
    }

    setFormError(null);
    setIsFormOpen(true);
  };

  const handleConfigChange = (subjectId: string, count: number, points: number) => {
    setSubjectConfigs(prev =>
      prev.map(c => (c.subject_id === subjectId ? { ...c, question_count: count, points_per_question: points } : c))
    );
  };

  const currentConfiguredTotal = subjectConfigs.reduce((sum, c) => sum + Number(c.question_count || 0), 0);

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Judul paket ujian wajib diisi.');
      return;
    }
    if (!scheduleId) {
      setFormError('Jadwal seleksi akademik wajib dipilih.');
      return;
    }
    if (durationMinutes <= 0) {
      setFormError('Durasi ujian harus lebih dari 0 menit.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingExam) {
        const res = await cbtService.updateExam(editingExam.id, {
          test_schedule_id: scheduleId,
          title,
          description,
          duration_minutes: durationMinutes,
          total_questions: currentConfiguredTotal > 0 ? currentConfiguredTotal : totalQuestions,
          randomize_questions: randomizeQuestions,
          randomize_options: randomizeOptions,
          passing_score: passingScore,
          is_active: isActive,
          show_score_to_candidate: showScore,
          configs: subjectConfigs,
        });

        if (!res.success) {
          setFormError(res.error || 'Gagal memperbarui ujian.');
          setIsSaving(false);
          return;
        }

        setToastMessage({ type: 'success', text: 'Paket ujian berhasil diperbarui.' });
      } else {
        const res = await cbtService.createExam({
          test_schedule_id: scheduleId,
          title,
          description,
          duration_minutes: durationMinutes,
          total_questions: currentConfiguredTotal > 0 ? currentConfiguredTotal : totalQuestions,
          randomize_questions: randomizeQuestions,
          randomize_options: randomizeOptions,
          passing_score: passingScore,
          show_score_to_candidate: showScore,
          configs: subjectConfigs,
        });

        if (!res.success) {
          setFormError(res.error || 'Gagal membuat paket ujian.');
          setIsSaving(false);
          return;
        }

        setToastMessage({ type: 'success', text: 'Paket ujian CBT baru berhasil dibuat.' });
      }

      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (exam: Exam) => {
    await cbtService.toggleExamStatus(exam.id, !exam.is_active);
    loadData();
  };

  const handleDeleteExam = async (exam: Exam) => {
    if (!confirmAction(`Hapus paket ujian "${exam.title}"?`)) return;

    const res = await cbtService.deleteExam(exam.id);
    if (!res.success) {
      showToastNotification(res.error);
      return;
    }

    setToastMessage({ type: 'success', text: 'Paket ujian berhasil dihapus.' });
    loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <Alert
          type={toastMessage.type}
          title={toastMessage.type === 'success' ? 'Sukses' : 'Peringatan'}
          message={toastMessage.text}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            Manajemen Paket Ujian CBT
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Paket Ujian Seleksi Akademik
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Atur parameter durasi, batas pengerjaan, komposisi soal per mata pelajaran, dan jadwal pelaksanaan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Activity className="w-4 h-4 text-emerald-600" />}
                onClick={() => onNavigate('/admin/cbt/monitoring')}
              >
                Monitoring Realtime
              </Button>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<BarChart2 className="w-4 h-4 text-emerald-600" />}
                onClick={() => onNavigate('/admin/cbt/hasil')}
              >
                Hasil Ujian
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="primary"
            className="bg-emerald-700 hover:bg-emerald-800"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            Buat Paket Ujian
          </Button>
        </div>
      </div>

      {/* Exam List */}
      {isLoading ? (
        <LoadingSpinner text="Memuat daftar paket ujian..." className="py-16" />
      ) : exams.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-10 h-10 text-slate-300" />}
          title="Belum Ada Paket Ujian CBT"
          description="Buat paket ujian seleksi akademik dan hubungkan ke jadwal seleksi pendaftar santri."
          action={
            <Button size="sm" variant="primary" onClick={handleOpenCreate}>
              Buat Paket Ujian Sekarang
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exams.map(ex => (
            <div
              key={ex.id}
              className={`bg-white rounded-2xl border p-6 shadow-xs flex flex-col justify-between transition ${
                ex.is_active ? 'border-slate-200 hover:border-emerald-300' : 'border-slate-200 opacity-70 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      ex.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {ex.is_active ? 'Aktif Digunakan' : 'Dinonaktifkan'}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    Maks. {ex.max_attempts}x Pengerjaan
                  </span>
                </div>

                <h3 className="font-extrabold text-lg text-slate-900 leading-snug">
                  {ex.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {ex.description || 'Tidak ada deskripsi tambahan.'}
                </p>

                {/* Tied Schedule Info */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Jadwal Terhubung:</span>
                    <span className="text-emerald-700 font-mono font-bold">
                      {ex.test_schedule?.title || 'Sesi Seleksi Akademik'}
                    </span>
                  </div>
                  {ex.test_schedule && (
                    <div className="text-[11px] text-slate-500">
                      {formatDateIndonesian(ex.test_schedule.test_date)} • {ex.test_schedule.start_time} -{' '}
                      {ex.test_schedule.end_time} WIB ({ex.test_schedule.room})
                    </div>
                  )}
                </div>

                {/* Specs */}
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <span className="text-[10px] font-semibold text-slate-500 block">Durasi</span>
                    <span className="font-mono font-bold text-emerald-900 text-sm">
                      {ex.duration_minutes} Menit
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <span className="text-[10px] font-semibold text-slate-500 block">Total Soal</span>
                    <span className="font-mono font-bold text-emerald-900 text-sm">
                      {ex.total_questions} Butir
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <span className="text-[10px] font-semibold text-slate-500 block">Pengacakan</span>
                    <span className="font-bold text-emerald-900 text-xs">
                      {ex.randomize_questions ? 'Soal & Opsi' : 'Urut'}
                    </span>
                  </div>
                </div>

                {/* Subject Distribution */}
                {ex.configs && ex.configs.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Distribusi Soal per Mapel:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ex.configs.map(c => (
                        <span
                          key={c.id}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium"
                        >
                          {c.subject?.name || 'Mapel'}: <strong>{c.question_count} soal</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleActive(ex)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    ex.is_active
                      ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  {ex.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                    onClick={() => handleOpenEdit(ex)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:bg-rose-50"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => handleDeleteExam(ex)}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingExam ? 'Edit Paket Ujian CBT' : 'Buat Paket Ujian Seleksi Baru'}
        subtitle="Konfigurasikan durasi, jadwal terhubung, dan alokasi soal per mata pelajaran"
        maxWidth="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button size="sm" variant="outline" onClick={() => setIsFormOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              isLoading={isSaving}
              onClick={handleSaveExam}
            >
              {editingExam ? 'Simpan Perubahan' : 'Buat Paket Ujian'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveExam} className="space-y-4 text-xs">
          {formError && (
            <Alert type="error" title="Gagal Menyimpan" message={formError} />
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Judul Paket Ujian <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Contoh: Tes Potensi Akademik PSB 2027/2028"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Hubungkan ke Sesi Jadwal Seleksi <span className="text-rose-500">*</span>
            </label>
            <Select
              value={scheduleId}
              onChange={e => setScheduleId(e.target.value)}
              options={academicSchedules.map(s => ({
                value: s.id,
                label: `${s.title} (${formatDateIndonesian(s.test_date)} • ${s.start_time}-${s.end_time} WIB • Ruang ${s.room})`,
              }))}
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Hanya peserta yang di-assign oleh panitia pada sesi jadwal ini yang diizinkan memulai ujian.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Durasi Pengerjaan (Menit) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Passing Score (Nilai Minimal)
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={passingScore ?? ''}
                onChange={e => setPassingScore(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="70"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Batas Percobaan (Max Attempts)
              </label>
              <Input value="1 Kali (Sesuai Aturan Seleksi)" disabled />
            </div>
          </div>

          {/* Randomization and visibility options */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeQuestions}
                onChange={e => setRandomizeQuestions(e.target.checked)}
                className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4"
              />
              <span className="text-slate-800 font-medium">Acak Urutan Soal per Peserta</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeOptions}
                onChange={e => setRandomizeOptions(e.target.checked)}
                className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4"
              />
              <span className="text-slate-800 font-medium">Acak Urutan Pilihan Jawaban (A-E)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer sm:col-span-2 pt-2 border-t border-slate-200">
              <input
                type="checkbox"
                checked={showScore}
                onChange={e => setShowScore(e.target.checked)}
                className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4"
              />
              <div>
                <span className="text-slate-800 font-semibold block">Tampilkan Nilai ke Peserta Setelah Selesai</span>
                <span className="text-[11px] text-slate-500">
                  Jika dimatikan (default), peserta hanya melihat konfirmasi selesai dan nilai dirahasiakan hingga tanggal pengumuman kelulusan resmi.
                </span>
              </div>
            </label>
          </div>

          {/* Subject Question Allocation */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 text-xs">
                Alokasi Jumlah Soal per Mata Pelajaran
              </label>
              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Total: {currentConfiguredTotal} Soal
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Sistem akan memilih dan membuat snapshot soal secara proporsional sesuai kuota mapel saat peserta memulai ujian.
            </p>

            <div className="space-y-2">
              {subjects.map(s => {
                const cfg = subjectConfigs.find(c => c.subject_id === s.id) || {
                  question_count: 5,
                  points_per_question: 4,
                };
                return (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="flex-1">
                      <span className="font-bold text-slate-900 block">{s.name}</span>
                      <span className="text-[10px] text-slate-500">{s.code}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">Jumlah Soal:</span>
                        <input
                          type="number"
                          min="0"
                          value={cfg.question_count}
                          onChange={e =>
                            handleConfigChange(s.id, Number(e.target.value), cfg.points_per_question)
                          }
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-center font-mono font-bold text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">Poin/Soal:</span>
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={cfg.points_per_question}
                          onChange={e =>
                            handleConfigChange(s.id, cfg.question_count, Number(e.target.value))
                          }
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-center font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
