import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { cbtService, CsvImportResult } from '../services/cbtService';
import { Question, QuestionCategory } from '../types/cbt';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import {
  Brain,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Copy,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Image as ImageIcon,
  ArrowLeft
} from 'lucide-react';

export const AdminPsikotesSoalPage: React.FC<{ onNavigate?: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const canManageQuestions = hasPermission(role, 'PSYCHOTEST_QUESTION_MANAGE');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Question Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Form State
  const [formCategory, setFormCategory] = useState('');
  const [formSubCategory, setFormSubCategory] = useState('');
  const [formQuestionText, setFormQuestionText] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formDifficulty, setFormDifficulty] = useState<'MUDAH' | 'SEDANG' | 'SULIT'>('SEDANG');
  const [formPoints, setFormPoints] = useState(2);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formOptions, setFormOptions] = useState<Array<{
    id?: string;
    option_key: string;
    option_text: string;
    is_correct: boolean;
    score: number;
  }>>([
    { option_key: 'A', option_text: '', is_correct: true, score: 2 },
    { option_key: 'B', option_text: '', is_correct: false, score: 0 },
    { option_key: 'C', option_text: '', is_correct: false, score: 0 },
    { option_key: 'D', option_text: '', is_correct: false, score: 0 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // CSV Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFileContent, setCsvFileContent] = useState<string>('');
  const [csvPreview, setCsvPreview] = useState<CsvImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const psiCats = await cbtService.getCategories();
      const psiSubject = (await cbtService.getSubjects()).find(s => s.code === 'PSIKOTES');
      const filteredCats = psiSubject ? psiCats.filter(c => c.subject_id === psiSubject.id) : psiCats;
      setCategories(filteredCats);

      if (filteredCats.length > 0 && !formCategory) {
        setFormCategory(filteredCats[0].id);
      }

      await loadQuestions();
    } catch (e) {
      console.error('Failed to load initial question data', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuestions = async () => {
    const list = await cbtService.getPsychotestQuestions({
      category_id: selectedCategory || undefined,
      difficulty: selectedDifficulty || undefined,
      is_active: selectedStatus === 'ALL' ? undefined : selectedStatus === 'ACTIVE',
      search: search || undefined,
    });
    setQuestions(list);
  };

  useEffect(() => {
    loadQuestions();
  }, [selectedCategory, selectedDifficulty, selectedStatus, search]);

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setFormCategory(categories[0]?.id || '');
    setFormSubCategory('');
    setFormQuestionText('');
    setFormImageUrl('');
    setFormDifficulty('SEDANG');
    setFormPoints(2);
    setFormIsActive(true);
    setFormOptions([
      { option_key: 'A', option_text: '', is_correct: true, score: 2 },
      { option_key: 'B', option_text: '', is_correct: false, score: 0 },
      { option_key: 'C', option_text: '', is_correct: false, score: 0 },
      { option_key: 'D', option_text: '', is_correct: false, score: 0 },
    ]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (q: Question) => {
    setIsEditing(true);
    setCurrentId(q.id);
    setFormCategory(q.category_id || categories[0]?.id || '');
    setFormSubCategory(q.sub_category || '');
    setFormQuestionText(q.question_text);
    setFormImageUrl(q.image_url || '');
    setFormDifficulty(q.difficulty);
    setFormPoints(q.points);
    setFormIsActive(q.is_active);
    setFormOptions(
      (q.options || []).map(o => ({
        id: o.id,
        option_key: o.option_key,
        option_text: o.option_text,
        is_correct: o.is_correct,
        score: o.score !== undefined ? o.score : (o.is_correct ? q.points : 0),
      }))
    );
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageQuestions) {
      setFormError('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang mengelola bank soal psikotes.');
      return;
    }
    if (!formQuestionText.trim()) {
      setFormError('Pertanyaan soal wajib diisi.');
      return;
    }
    if (!formCategory) {
      setFormError('Kategori soal wajib dipilih.');
      return;
    }
    const hasEmptyOption = formOptions.some(o => !o.option_text.trim());
    if (hasEmptyOption) {
      setFormError('Seluruh teks pilihan jawaban wajib diisi.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const res = await cbtService.savePsychotestQuestion({
        id: currentId || undefined,
        category_id: formCategory,
        sub_category: formSubCategory,
        question_text: formQuestionText,
        image_url: formImageUrl,
        question_type: 'MULTIPLE_CHOICE',
        difficulty: formDifficulty,
        points: Number(formPoints),
        is_active: formIsActive,
        options: formOptions,
      }, { id: user?.id, role: role || undefined, email: user?.email });

      if (!res.success) {
        setFormError(res.error || 'Gagal menyimpan soal.');
        return;
      }

      setIsModalOpen(false);
      await loadQuestions();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!canManageQuestions) {
      showToastNotification('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang menduplikasi soal.');
      return;
    }
    if (!confirmAction('Duplikasi soal ini?')) return;
    const res = await cbtService.duplicatePsychotestQuestion(id, { id: user?.id, role: role || undefined, email: user?.email });
    if (res.success) {
      await loadQuestions();
    } else {
      showToastNotification(res.error || 'Gagal menduplikasi soal.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManageQuestions) {
      showToastNotification('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang menghapus soal.');
      return;
    }
    if (!confirmAction('Apakah Anda yakin ingin menghapus soal psikotes ini?')) return;
    const res = await cbtService.deletePsychotestQuestion(id, { id: user?.id, role: role || undefined, email: user?.email });
    if (res.success) {
      await loadQuestions();
    } else {
      showToastNotification(res.error || 'Gagal menghapus soal.');
    }
  };

  const handleExportCsv = async () => {
    const csvContent = await cbtService.exportPsychotestQuestionsCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bank_soal_psikotes_dh2027_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async event => {
      const text = event.target?.result as string;
      setCsvFileContent(text);
      const parsed = await cbtService.parsePsychotestQuestionsCsv(text);
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleCommitImport = async () => {
    if (!csvPreview || csvPreview.validQuestions.length === 0) return;
    setIsImporting(true);
    try {
      await cbtService.commitImportQuestions(csvPreview.validQuestions);
      setIsImportModalOpen(false);
      setCsvPreview(null);
      setCsvFileContent('');
      await loadQuestions();
      showToastNotification(`Berhasil mengimpor ${csvPreview.validCount} butir soal psikotes.`);
    } catch (e: any) {
      showToastNotification('Gagal mengimpor: ' + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <Brain size={16} />
            <span>Bank Soal Psikotes Santri • TP 2027/2028</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Manajemen Soal Psikotes
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Kelola butir soal kognitif, pola gambar matriks visual, dan scoring key pilihan ganda.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <Button variant="outline" size="sm" onClick={() => onNavigate('/admin/psikotes')}>
              <ArrowLeft size={16} className="mr-1.5" />
              Kembali
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download size={16} className="mr-1.5" />
            Export CSV
          </Button>
          {canManageQuestions && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)}>
                <Upload size={16} className="mr-1.5" />
                Import CSV
              </Button>
              <Button variant="primary" size="sm" onClick={handleOpenCreateModal} className="bg-teal-700 hover:bg-teal-600 font-bold">
                <Plus size={16} className="mr-1.5" />
                Tambah Soal Baru
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari teks soal..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {/* Filter Kategori */}
        <div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-700"
          >
            <option value="">Semua Kategori ({categories.length})</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Filter Kesulitan */}
        <div>
          <select
            value={selectedDifficulty}
            onChange={e => setSelectedDifficulty(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-700"
          >
            <option value="">Semua Tingkat Kesulitan</option>
            <option value="MUDAH">Mudah</option>
            <option value="SEDANG">Sedang</option>
            <option value="SULIT">Sulit</option>
          </select>
        </div>

        {/* Filter Status */}
        <div>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-700"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Questions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <LoadingSpinner size="lg" className="text-teal-700 mb-2" />
            <p className="text-slate-500 text-sm">Memuat daftar soal psikotes...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Brain size={48} className="text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">Tidak ada soal psikotes yang cocok</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              Silakan sesuaikan filter pencarian Anda atau tambahkan soal baru ke dalam bank soal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4 w-32">Kategori</th>
                  <th className="py-3.5 px-4">Pertanyaan & Pilihan Jawaban</th>
                  <th className="py-3.5 px-4 w-28 text-center">Kesulitan</th>
                  <th className="py-3.5 px-4 w-24 text-center">Status</th>
                  <th className="py-3.5 px-4 w-32 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {questions.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 text-center font-mono font-bold text-slate-400 text-xs">
                      {idx + 1}
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4 align-top">
                      <span className="inline-block bg-teal-100 text-teal-800 font-bold text-xs px-2.5 py-1 rounded-lg">
                        {q.category?.name || 'LOGIKA'}
                      </span>
                      {q.sub_category && (
                        <div className="text-[11px] text-slate-400 mt-1 font-medium">{q.sub_category}</div>
                      )}
                    </td>

                    {/* Question text & Visual */}
                    <td className="py-4 px-4 align-top space-y-2">
                      <div className="font-semibold text-slate-900 leading-relaxed whitespace-pre-line text-sm">
                        {q.question_text}
                      </div>

                      {/* Visual indicator */}
                      {q.image_url && (
                        <div className="flex items-center gap-1.5 text-xs text-sky-700 font-medium bg-sky-50 px-2 py-1 rounded-md w-fit border border-sky-200">
                          <ImageIcon size={14} />
                          <span>Memiliki Bagan / Pola Gambar Visual</span>
                        </div>
                      )}

                      {/* Options preview */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
                        {q.options?.map(opt => (
                          <div
                            key={opt.id}
                            className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                              (opt.score || 0) > 0 || opt.is_correct
                                ? 'bg-teal-50 border-teal-200 text-teal-900 font-medium'
                                : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-bold text-slate-800">{opt.option_key}.</span>
                              <span className="truncate">{opt.option_text}</span>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border shrink-0 text-slate-500">
                              Skor: {opt.score ?? (opt.is_correct ? q.points : 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Difficulty */}
                    <td className="py-4 px-4 align-top text-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        q.difficulty === 'MUDAH'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.difficulty === 'SEDANG'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 align-top text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        q.is_active ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {q.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 align-top text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canManageQuestions && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(q)}
                              title="Edit Soal"
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDuplicate(q.id)}
                              title="Duplikasi Soal"
                              className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(q.id)}
                              title="Hapus Soal"
                              className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Soal Psikotes' : 'Tambah Soal Psikotes Baru'}
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {formError && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kategori *</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Subkategori (Opsional)</label>
              <input
                type="text"
                placeholder="Contoh: Silogisme, Rotasi 2D..."
                value={formSubCategory}
                onChange={e => setFormSubCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pertanyaan Soal *</label>
            <textarea
              rows={4}
              placeholder="Tuliskan butir pertanyaan psikotes..."
              value={formQuestionText}
              onChange={e => setFormQuestionText(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Gambar Bagan/Pola Visual (Opsional)
            </label>
            <input
              type="text"
              placeholder="URL gambar atau Data URI SVG untuk soal visual..."
              value={formImageUrl}
              onChange={e => setFormImageUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none font-mono text-xs"
            />
            {formImageUrl && (
              <div className="mt-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] text-slate-400 mb-1">Preview Gambar:</div>
                <img src={formImageUrl} alt="Preview" className="max-h-36 mx-auto rounded-lg object-contain" />
              </div>
            )}
          </div>

          {/* Difficulty & Points */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tingkat Kesulitan</label>
              <select
                value={formDifficulty}
                onChange={e => setFormDifficulty(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
              >
                <option value="MUDAH">Mudah</option>
                <option value="SEDANG">Sedang</option>
                <option value="SULIT">Sulit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Default Bobot Poin</label>
              <input
                type="number"
                min={1}
                value={formPoints}
                onChange={e => setFormPoints(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Status Soal</label>
              <select
                value={formIsActive ? '1' : '0'}
                onChange={e => setFormIsActive(e.target.value === '1')}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
              >
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </div>
          </div>

          {/* Options & Scoring Key */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase">
                Pilihan Jawaban & Scoring Key per Opsi
              </label>
              <span className="text-[11px] text-slate-400">
                Skor 0 jika salah, atau skor berbobot jika benar/berjenjang
              </span>
            </div>

            <div className="space-y-2">
              {formOptions.map((opt, idx) => (
                <div key={opt.option_key} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="w-7 h-7 rounded-lg bg-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {opt.option_key}
                  </div>
                  <input
                    type="text"
                    placeholder={`Teks pilihan ${opt.option_key}...`}
                    value={opt.option_text}
                    onChange={e => {
                      const val = e.target.value;
                      setFormOptions(prev => {
                        const copy = [...prev];
                        copy[idx].option_text = val;
                        return copy;
                      });
                    }}
                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-slate-500 font-semibold">Skor:</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={opt.score}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormOptions(prev => {
                          const copy = [...prev];
                          copy[idx].score = val;
                          copy[idx].is_correct = val > 0;
                          return copy;
                        });
                      }}
                      className="w-16 px-2 py-1 text-sm bg-white border border-slate-300 rounded-lg text-center font-bold text-teal-800"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" isLoading={isSaving} className="bg-teal-700 hover:bg-teal-600 font-bold">
              Simpan Soal Psikotes
            </Button>
          </div>
        </form>
      </Modal>

      {/* CSV IMPORT MODAL (Requirement 37) */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Soal Psikotes via CSV"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Unggah file CSV bank soal psikotes. Kolom minimal: <code>category, question, option_a, option_b, option_c, option_d, score_a, score_b, score_c, score_d, difficulty, points, status</code>.
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
          />

          {csvPreview && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2 rounded-lg border">
                  Total Baris: <strong>{csvPreview.totalRows}</strong>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-emerald-800">
                  Valid: <strong>{csvPreview.validCount}</strong>
                </div>
                <div className="bg-red-50 p-2 rounded-lg border border-red-200 text-red-800">
                  Error: <strong>{csvPreview.errorCount}</strong>
                </div>
              </div>

              {csvPreview.errors.length > 0 && (
                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-800 space-y-1 max-h-36 overflow-y-auto">
                  <div className="font-bold mb-1">Daftar Baris Tidak Valid:</div>
                  {csvPreview.errors.map((err, i) => (
                    <div key={i}>
                      • Baris {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              )}

              {csvPreview.validCount > 0 && (
                <div className="bg-teal-50 p-3 rounded-xl border border-teal-200 text-xs text-teal-800">
                  ✓ Siap mengimpor <strong>{csvPreview.validCount} soal</strong> yang telah tervalidasi.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleCommitImport}
              disabled={!csvPreview || csvPreview.validCount === 0}
              isLoading={isImporting}
              className="bg-teal-700 hover:bg-teal-600 font-bold"
            >
              Komit Import Soal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
