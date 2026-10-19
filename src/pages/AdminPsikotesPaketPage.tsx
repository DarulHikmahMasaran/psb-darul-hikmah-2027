import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { cbtService } from '../services/cbtService';
import { Exam, QuestionCategory } from '../types/cbt';
import { TestSchedule } from '../types/database';
import { getStorageData, saveStorageData } from '../lib/storage';
import { auditService } from '../services/auditService';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import {
  Brain,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Calendar,
  Layers,
  ArrowLeft,
  Settings,
  ShieldAlert,
  HelpCircle,
  Eye,
  Sliders,
  Info
} from 'lucide-react';

export const AdminPsikotesPaketPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const canManage = hasPermission(role, 'PSYCHOTEST_MANAGE');

  const [exams, setExams] = useState<Exam[]>([]);
  const [schedules, setSchedules] = useState<TestSchedule[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScheduleId, setFormScheduleId] = useState('');
  const [formDuration, setFormDuration] = useState(60);
  const [formTotalQuestions, setFormTotalQuestions] = useState(16);
  const [formRandomizeQuestions, setFormRandomizeQuestions] = useState(true);
  const [formRandomizeOptions, setFormRandomizeOptions] = useState(true);
  const [formPassingScore, setFormPassingScore] = useState<number | undefined>(65);
  const [formShowScore, setFormShowScore] = useState(false);
  const [formCategoryQuotas, setFormCategoryQuotas] = useState<Array<{
    category_id: string;
    category_name: string;
    question_count: number;
    points_per_question: number;
  }>>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = getStorageData();
      const allExams = await cbtService.getExams({ exam_type: 'PSYCHOTEST' });
      setExams(allExams);

      setSchedules(data.testSchedules || []);

      const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');
      const psiCats = psiSubject
        ? data.questionCategories.filter(c => c.subject_id === psiSubject.id)
        : data.questionCategories;
      setCategories(psiCats);
    } catch (e) {
      console.error('Failed to load psychotest exams', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setCurrentExamId(null);
    setFormTitle('Paket Asesmen Psikotes Santri Baru 2027/2028');
    setFormDescription('Asesmen kognitif, penalaran visual, konsistensi belajar, dan ketelitian calon santri');
    setFormScheduleId(schedules.find(s => s.test_type?.code === 'PSIKOTES' || s.title.toLowerCase().includes('psikotes'))?.id || schedules[0]?.id || '');
    setFormDuration(60);
    setFormTotalQuestions(16);
    setFormRandomizeQuestions(true);
    setFormRandomizeOptions(true);
    setFormPassingScore(65);
    setFormShowScore(false);

    // Initial category quotas
    setFormCategoryQuotas(
      categories.map(cat => ({
        category_id: cat.id,
        category_name: cat.name,
        question_count: 4,
        points_per_question: 2,
      }))
    );

    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exam: Exam) => {
    setIsEditing(true);
    setCurrentExamId(exam.id);
    setFormTitle(exam.title);
    setFormDescription(exam.description || '');
    setFormScheduleId(exam.test_schedule_id);
    setFormDuration(exam.duration_minutes);
    setFormTotalQuestions(exam.total_questions);
    setFormRandomizeQuestions(exam.randomize_questions);
    setFormRandomizeOptions(exam.randomize_options);
    setFormPassingScore(exam.passing_score);
    setFormShowScore(exam.show_score_to_candidate ?? false);

    // Populate category quotas from exam configs
    const data = getStorageData();
    const existingConfigs = data.examConfigs.filter(c => c.exam_id === exam.id);

    const quotas = categories.map(cat => {
      const cfg = existingConfigs.find(c => c.category_id === cat.id);
      return {
        category_id: cat.id,
        category_name: cat.name,
        question_count: cfg ? cfg.question_count : 4,
        points_per_question: cfg ? cfg.points_per_question : 2,
      };
    });
    setFormCategoryQuotas(quotas);

    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      setFormError('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang menyimpan konfigurasi paket psikotes.');
      return;
    }

    if (!formTitle.trim()) {
      setFormError('Judul paket ujian wajib diisi.');
      return;
    }
    if (!formScheduleId) {
      setFormError('Jadwal seleksi wajib dipilih.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const data = getStorageData();
      const psiSubject = data.subjects.find(s => s.code === 'PSIKOTES');

      const configsPayload = formCategoryQuotas.map(cq => ({
        subject_id: psiSubject?.id,
        category_id: cq.category_id,
        question_count: cq.question_count,
        points_per_question: cq.points_per_question,
      }));

      const callerAuth = { id: user?.id, role: role || undefined, email: user?.email };

      if (isEditing && currentExamId) {
        const updateRes = await cbtService.updatePsychotestPackage(
          currentExamId,
          {
            title: formTitle.trim(),
            description: formDescription.trim(),
            test_schedule_id: formScheduleId,
            duration_minutes: Number(formDuration),
            total_questions: Number(formTotalQuestions),
            randomize_questions: formRandomizeQuestions,
            randomize_options: formRandomizeOptions,
            passing_score: formPassingScore ? Number(formPassingScore) : undefined,
            show_score_to_candidate: formShowScore,
            configs: configsPayload,
          },
          callerAuth
        );

        if (!updateRes.success) {
          throw new Error(updateRes.error || 'Gagal memperbarui paket psikotes.');
        }
      } else {
        const createRes = await cbtService.createPsychotestPackage(
          {
            title: formTitle.trim(),
            description: formDescription.trim(),
            test_schedule_id: formScheduleId,
            duration_minutes: Number(formDuration),
            total_questions: Number(formTotalQuestions),
            randomize_questions: formRandomizeQuestions,
            randomize_options: formRandomizeOptions,
            passing_score: formPassingScore ? Number(formPassingScore) : undefined,
            show_score_to_candidate: formShowScore,
            configs: configsPayload,
          },
          callerAuth
        );

        if (!createRes.success) {
          throw new Error(createRes.error || 'Gagal membuat paket psikotes');
        }
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat menyimpan paket.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (exam: Exam) => {
    if (!canManage) {
      showToastNotification('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang mengubah status aktif paket.');
      return;
    }
    const callerAuth = { id: user?.id, role: role || undefined, email: user?.email };
    const res = await cbtService.updatePsychotestPackage(
      exam.id,
      { is_active: !exam.is_active },
      callerAuth
    );
    if (!res.success) {
      showToastNotification(res.error || 'Gagal mengubah status paket.');
      return;
    }
    await loadData();
  };

  const handleDelete = async (exam: Exam) => {
    if (!canManage) {
      showToastNotification('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang menghapus paket.');
      return;
    }

    if (!confirmAction(`Apakah Anda yakin ingin menghapus paket psikotes "${exam.title}"?`)) {
      return;
    }

    const res = await cbtService.deleteExam(exam.id, { id: user?.id, role: role || undefined, email: user?.email });
    if (!res.success) {
      showToastNotification(res.error || 'Gagal menghapus paket.');
      return;
    }

    await auditService.logAction({
      userId: user?.id,
      userEmail: user?.email,
      action: 'PSYCHOTEST_PACKAGE_DELETED',
      entityType: 'PSYCHOTEST_EXAM',
      entityId: exam.id,
      oldValue: { title: exam.title },
    });

    await loadData();
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
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Kelola Paket Asesmen Psikotes</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Konfigurasi durasi, alokasi butir per subtes, acak soal/opsi, serta jadwal pelaksanaan asesmen calon santri.
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
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold"
            >
              <Plus size={16} className="mr-1.5" />
              Buat Paket Baru
            </Button>
          )}
        </div>
      </div>

      {/* Panitia Read-Only Alert */}
      {!canManage && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-blue-900 text-xs leading-relaxed">
          <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Mode Operasional Panitia (Read-Only): </span>
            Sebagai Panitia Seleksi, Anda memiliki izin baca untuk memantau paket asesmen psikotes, rincian durasi, alokasi subtes, dan jadwal ujian peserta. Sesuai matriks perizinan resmi, Panitia tidak memiliki wewenang untuk menambah paket, mengubah durasi, kuota soal, ambang skor, pengacakan, maupun mengaktifkan/menonaktifkan paket.
          </div>
        </div>
      )}

      {/* Warning Notice about Non-Clinical Policy */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
        <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Ketentuan Konfigurasi & Etika Asesmen: </span>
          Paket psikotes dirancang semata-mata untuk mengukur daya serap kognitif dasar, penalaran logis-visual, konsistensi belajar, dan ketelitian santri dalam lingkungan pesantren. Sistem tidak boleh menyematkan label klinis atau diagnosis kepribadian.
        </div>
      </div>

      {/* Package List Cards */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Layers size={32} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Belum Ada Paket Psikotes</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Buat paket ujian baru untuk mengonfigurasi jadwal dan butir pertanyaan asesmen psikotes santri.
            </p>
          </div>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              className="bg-teal-700 hover:bg-teal-800 text-white"
            >
              <Plus size={16} className="mr-1.5" />
              Tambah Paket Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exams.map(exam => {
            const sched = schedules.find(s => s.id === exam.test_schedule_id);
            const data = getStorageData();
            const configs = data.examConfigs.filter(c => c.exam_id === exam.id);

            return (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          exam.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {exam.is_active ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                          PSIKOTES CBT
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mt-2">{exam.title}</h2>
                      {exam.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {exam.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Badges / Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-medium">Durasi</div>
                      <div className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Clock size={13} className="text-teal-600" />
                        <span>{exam.duration_minutes} Menit</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-medium">Total Soal</div>
                      <div className="font-bold text-slate-800 mt-0.5">
                        {exam.total_questions} Butir
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-medium">Ambang Skor</div>
                      <div className="font-bold text-teal-700 mt-0.5">
                        {exam.passing_score ?? '-'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-medium">Hasil di Santri</div>
                      <div className="font-bold text-slate-800 mt-0.5">
                        {exam.show_score_to_candidate ? 'DITAMPILKAN' : 'DIRAHAASIAKAN'}
                      </div>
                    </div>
                  </div>

                  {/* Schedule link */}
                  <div className="bg-teal-50/60 border border-teal-100 p-3 rounded-xl flex items-center gap-2 text-xs text-teal-900">
                    <Calendar size={15} className="text-teal-700 shrink-0" />
                    <div>
                      <span className="font-medium text-teal-700">Jadwal Seleksi: </span>
                      <span className="font-bold">{sched ? sched.title : 'Belum Ditautkan'}</span>
                      {sched && <span className="text-[10px] text-teal-600 ml-1">({sched.room})</span>}
                    </div>
                  </div>

                  {/* Subtest Category Breakdown */}
                  {configs.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Komposisi Subtes Soal
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {configs.map(cfg => {
                          const cat = categories.find(c => c.id === cfg.category_id);
                          return (
                            <span
                              key={cfg.id}
                              className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                            >
                              {cat?.name || 'Umum'}: <strong>{cfg.question_count} Soal</strong>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {canManage ? (
                      <button
                        onClick={() => handleToggleActive(exam)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                          exam.is_active
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {exam.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">Pratinjau Operasional (Read-Only)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canManage && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(exam)}
                          className="text-slate-700 text-xs"
                        >
                          <Edit size={14} className="mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(exam)}
                          className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                        >
                          <Trash2 size={14} className="mr-1.5" />
                          Hapus
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Form Tambah/Edit Paket Psikotes */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Paket Asesmen Psikotes' : 'Buat Paket Asesmen Psikotes Baru'}
        size="lg"
      >
        <form onSubmit={handleSaveExam} className="space-y-6">
          {formError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Judul Paket Psikotes <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Contoh: Paket Asesmen Psikotes Santri Baru 2027/2028"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Deskripsi / Petunjuk Pengantar
              </label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Contoh: Asesmen daya tangkap kognitif, penalaran visual-spasial, dan konsistensi sikap belajar calon santri."
                rows={2}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tautkan ke Jadwal Seleksi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formScheduleId}
                  onChange={e => setFormScheduleId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden bg-white"
                  required
                >
                  <option value="">-- Pilih Jadwal Seleksi --</option>
                  {schedules.map(sch => (
                    <option key={sch.id} value={sch.id}>
                      {sch.title} ({sch.test_type?.name || 'Seleksi'}) - {sch.room}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Durasi Pengerjaan (Menit) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={10}
                  max={240}
                  value={formDuration}
                  onChange={e => setFormDuration(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Target Soal
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={formTotalQuestions}
                  onChange={e => setFormTotalQuestions(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ambang Kelulusan (Passing Score)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formPassingScore ?? ''}
                  onChange={e => setFormPassingScore(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Contoh: 65"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tampilkan Nilai ke Santri
                </label>
                <select
                  value={formShowScore ? 'TRUE' : 'FALSE'}
                  onChange={e => setFormShowScore(e.target.value === 'TRUE')}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden bg-white"
                >
                  <option value="FALSE">Rahasiakan (Hanya Panitia)</option>
                  <option value="TRUE">Tampilkan ke Santri Selesai Submit</option>
                </select>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formRandomizeQuestions}
                  onChange={e => setFormRandomizeQuestions(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Acak Urutan Butir Soal (Per Kandidat)</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formRandomizeOptions}
                  onChange={e => setFormRandomizeOptions(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Acak Urutan Opsi Pilihan Jawaban</span>
              </label>
            </div>

            {/* Category Quotas Configuration */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Alokasi Butir Per Subtes Kategori
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  Total Terkonfigurasi: <strong>{formCategoryQuotas.reduce((sum, q) => sum + q.question_count, 0)} Soal</strong>
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                {formCategoryQuotas.map((cq, idx) => (
                  <div key={cq.category_id} className="p-3 flex items-center justify-between gap-4 text-xs">
                    <span className="font-bold text-slate-800">{cq.category_name}</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px]">Jumlah:</span>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={cq.question_count}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setFormCategoryQuotas(prev => {
                              const next = [...prev];
                              next[idx].question_count = val;
                              return next;
                            });
                          }}
                          className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-xs text-center font-bold"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px]">Poin/Soal:</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={cq.points_per_question}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setFormCategoryQuotas(prev => {
                              const next = [...prev];
                              next[idx].points_per_question = val;
                              return next;
                            });
                          }}
                          className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-xs text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
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
              {isSaving ? 'Menyimpan...' : (isEditing ? 'Simpan Perubahan' : 'Buat Paket')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
