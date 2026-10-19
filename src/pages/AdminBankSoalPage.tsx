import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState, useRef } from 'react';
import { cbtService, CsvImportResult } from '../services/cbtService';
import { Subject, QuestionCategory, Question, QuestionType, QuestionDifficulty } from '../types/cbt';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import {
  BookOpen,
  Search,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  FileText,
  Filter,
  Check,
  X,
  Sparkles
} from 'lucide-react';

export const AdminBankSoalPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterActive, setFilterActive] = useState('ALL');

  // Form Modal (Add / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formType, setFormType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [formDifficulty, setFormDifficulty] = useState<QuestionDifficulty>('SEDANG');
  const [formPoints, setFormPoints] = useState(4);
  const [formText, setFormText] = useState('');
  const [formExplanation, setFormExplanation] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Options State
  const [options, setOptions] = useState<
    Array<{ id?: string; option_key: string; option_text: string; is_correct: boolean }>
  >([
    { option_key: 'A', option_text: '', is_correct: true },
    { option_key: 'B', option_text: '', is_correct: false },
    { option_key: 'C', option_text: '', is_correct: false },
    { option_key: 'D', option_text: '', is_correct: false },
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // CSV Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<CsvImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [qs, subs, cats] = await Promise.all([
        cbtService.getQuestions(),
        cbtService.getSubjects(),
        cbtService.getCategories(),
      ]);
      setQuestions(qs);
      setSubjects(subs);
      setCategories(cats);
    } catch (e) {
      console.error('Failed to load question bank', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingQuestion(null);
    setFormSubjectId(subjects[0]?.id || '');
    setFormCategoryId('');
    setFormType('MULTIPLE_CHOICE');
    setFormDifficulty('SEDANG');
    setFormPoints(4);
    setFormText('');
    setFormExplanation('');
    setFormActive(true);
    setOptions([
      { option_key: 'A', option_text: '', is_correct: true },
      { option_key: 'B', option_text: '', is_correct: false },
      { option_key: 'C', option_text: '', is_correct: false },
      { option_key: 'D', option_text: '', is_correct: false },
    ]);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setFormSubjectId(q.subject_id);
    setFormCategoryId(q.category_id || '');
    setFormType(q.question_type);
    setFormDifficulty(q.difficulty);
    setFormPoints(q.points);
    setFormText(q.question_text);
    setFormExplanation(q.explanation || '');
    setFormActive(q.is_active);

    if (q.options && q.options.length > 0) {
      setOptions(
        q.options.map(o => ({
          id: o.id,
          option_key: o.option_key,
          option_text: o.option_text,
          is_correct: o.is_correct,
        }))
      );
    } else {
      setOptions([
        { option_key: 'A', option_text: '', is_correct: true },
        { option_key: 'B', option_text: '', is_correct: false },
      ]);
    }
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleTypeChange = (type: QuestionType) => {
    setFormType(type);
    if (type === 'TRUE_FALSE') {
      setOptions([
        { option_key: 'BENAR', option_text: 'Benar', is_correct: true },
        { option_key: 'SALAH', option_text: 'Salah', is_correct: false },
      ]);
    } else if (type === 'MULTIPLE_CHOICE') {
      setOptions([
        { option_key: 'A', option_text: '', is_correct: true },
        { option_key: 'B', option_text: '', is_correct: false },
        { option_key: 'C', option_text: '', is_correct: false },
        { option_key: 'D', option_text: '', is_correct: false },
      ]);
    }
  };

  const handleCorrectOptionSelect = (index: number) => {
    setOptions(prev =>
      prev.map((opt, i) => ({
        ...opt,
        is_correct: i === index,
      }))
    );
  };

  const handleOptionTextChange = (index: number, val: string) => {
    setOptions(prev => {
      const copy = [...prev];
      copy[index].option_text = val;
      return copy;
    });
  };

  const handleAddOption = () => {
    if (options.length >= 5) return;
    const nextKeys = ['A', 'B', 'C', 'D', 'E'];
    const nextKey = nextKeys[options.length] || `OPT${options.length + 1}`;
    setOptions(prev => [...prev, { option_key: nextKey, option_text: '', is_correct: false }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const filtered = options.filter((_, i) => i !== index);
    // ensure at least one option is marked correct
    if (!filtered.some(o => o.is_correct)) {
      filtered[0].is_correct = true;
    }
    setOptions(filtered);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formText.trim()) {
      setFormError('Pertanyaan soal wajib diisi.');
      return;
    }

    for (let i = 0; i < options.length; i++) {
      if (!options[i].option_text.trim()) {
        setFormError(`Pilihan ${options[i].option_key} tidak boleh kosong.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingQuestion) {
        const res = await cbtService.updateQuestion(editingQuestion.id, {
          subject_id: formSubjectId,
          category_id: formCategoryId || undefined,
          question_text: formText,
          question_type: formType,
          explanation: formExplanation,
          difficulty: formDifficulty,
          points: formPoints,
          is_active: formActive,
          options: options,
        });

        if (!res.success) {
          setFormError(res.error || 'Gagal memperbarui soal.');
          setIsSaving(false);
          return;
        }

        setToastMessage({ type: 'success', text: 'Soal berhasil diperbarui.' });
      } else {
        const res = await cbtService.createQuestion({
          subject_id: formSubjectId,
          category_id: formCategoryId || undefined,
          question_text: formText,
          question_type: formType,
          explanation: formExplanation,
          difficulty: formDifficulty,
          points: formPoints,
          is_active: formActive,
          options: options,
        });

        if (!res.success) {
          setFormError(res.error || 'Gagal menambahkan soal.');
          setIsSaving(false);
          return;
        }

        setToastMessage({ type: 'success', text: 'Soal baru berhasil ditambahkan ke bank soal.' });
      }

      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = async (q: Question) => {
    if (!confirmAction(`Hapus soal "${q.question_text.slice(0, 40)}..."?`)) return;

    const res = await cbtService.deleteQuestion(q.id);
    if (!res.success) {
      showToastNotification(res.error);
      return;
    }

    setToastMessage({ type: 'success', text: 'Soal berhasil dihapus.' });
    loadData();
  };

  const handleToggleActive = async (q: Question) => {
    await cbtService.toggleQuestionStatus(q.id, !q.is_active);
    loadData();
  };

  // CSV Import handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const text = event.target?.result as string;
      setCsvText(text);
      const preview = await cbtService.validateAndPreviewCsv(text);
      setImportPreview(preview);
    };
    reader.readAsText(file);
  };

  const handleCommitImport = async () => {
    if (!importPreview || importPreview.validQuestions.length === 0) return;
    setIsImporting(true);
    try {
      const count = await cbtService.commitImportQuestions(importPreview.validQuestions);
      setToastMessage({
        type: 'success',
        text: `Berhasil mengimpor ${count} butir soal ke bank soal akademik.`,
      });
      setIsImportModalOpen(false);
      setImportPreview(null);
      setCsvText('');
      loadData();
    } catch (e) {
      console.error(e);
      showToastNotification('Gagal mengimpor soal');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await cbtService.exportQuestionsCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bank_soal_cbt_darul_hikmah_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      showToastNotification('Gagal mengekspor soal.');
    }
  };

  // Filtered List
  const filteredQuestions = questions.filter(q => {
    if (filterSubject && q.subject_id !== filterSubject) return false;
    if (filterCategory && q.category_id !== filterCategory) return false;
    if (filterDifficulty && q.difficulty !== filterDifficulty) return false;
    if (filterActive === 'ACTIVE' && !q.is_active) return false;
    if (filterActive === 'INACTIVE' && q.is_active) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchText = q.question_text.toLowerCase().includes(term);
      const matchSub = q.subject?.name.toLowerCase().includes(term);
      if (!matchText && !matchSub) return false;
    }
    return true;
  });

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4" />
            Computer Based Test (CBT) Akademik
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Bank Soal Seleksi Akademik
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kelola kumpulan soal Matematika, Bahasa Indonesia, IPA, PAI, dan Pengetahuan Umum untuk ujian seleksi santri baru.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
          >
            Export CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => {
              setImportPreview(null);
              setCsvText('');
              setIsImportModalOpen(true);
            }}
          >
            Import CSV
          </Button>

          <Button
            size="sm"
            variant="primary"
            className="bg-emerald-700 hover:bg-emerald-800"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            Tambah Soal Baru
          </Button>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {subjects.map(s => {
          const count = questions.filter(q => q.subject_id === s.id).length;
          return (
            <div
              key={s.id}
              onClick={() => setFilterSubject(filterSubject === s.id ? '' : s.id)}
              className={`p-3 rounded-xl border cursor-pointer transition text-xs flex flex-col justify-between ${
                filterSubject === s.id
                  ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-600/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="font-bold text-slate-800 truncate">{s.name}</span>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{s.code}</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded text-[11px]">
                  {count} Soal
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <Input
              placeholder="Cari pertanyaan atau mata pelajaran..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div>
            <Select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              options={[
                { value: '', label: 'Semua Mata Pelajaran' },
                ...subjects.map(s => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          <div>
            <Select
              value={filterDifficulty}
              onChange={e => setFilterDifficulty(e.target.value)}
              options={[
                { value: '', label: 'Semua Kesulitan' },
                { value: 'MUDAH', label: 'Mudah' },
                { value: 'SEDANG', label: 'Sedang' },
                { value: 'SULIT', label: 'Sulit' },
              ]}
            />
          </div>

          <div>
            <Select
              value={filterActive}
              onChange={e => setFilterActive(e.target.value)}
              options={[
                { value: 'ALL', label: 'Semua Status' },
                { value: 'ACTIVE', label: 'Aktif Saja' },
                { value: 'INACTIVE', label: 'Non-aktif' },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Menampilkan <strong>{filteredQuestions.length}</strong> dari {questions.length} butir soal
          </span>
          {(filterSubject || filterDifficulty || filterActive !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterSubject('');
                setFilterCategory('');
                setFilterDifficulty('');
                setFilterActive('ALL');
              }}
              className="text-emerald-700 font-semibold hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Question Table */}
      {isLoading ? (
        <LoadingSpinner text="Memuat daftar bank soal..." className="py-16" />
      ) : filteredQuestions.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-10 h-10 text-slate-300" />}
          title="Tidak ada soal ditemukan"
          description="Coba ubah kata kunci pencarian atau filter yang Anda terapkan."
          action={
            <Button size="sm" variant="primary" onClick={handleOpenCreate}>
              Buat Soal Pertama
            </Button>
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold">
                <TableHead className="w-12 text-center">No</TableHead>
                <TableHead className="w-44">Mata Pelajaran</TableHead>
                <TableHead>Pertanyaan Soal</TableHead>
                <TableHead className="w-28 text-center">Tipe</TableHead>
                <TableHead className="w-28 text-center">Tingkat</TableHead>
                <TableHead className="w-20 text-center">Poin</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-28 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuestions.map((q, idx) => (
                <TableRow key={q.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="text-center font-mono text-xs text-slate-400">
                    {idx + 1}
                  </TableCell>

                  <TableCell>
                    <span className="font-bold text-slate-900 text-xs block">
                      {q.subject?.name || 'Umum'}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate max-w-[150px]">
                      {q.category?.name || q.subject?.code}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs text-slate-900 font-medium line-clamp-2 max-w-xl">
                      {q.question_text}
                    </div>
                    {/* Options Preview */}
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {q.options?.map(opt => (
                        <span
                          key={opt.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            opt.is_correct
                              ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {opt.option_key}: {opt.option_text.slice(0, 20)}
                          {opt.option_text.length > 20 ? '...' : ''}
                        </span>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {q.question_type === 'MULTIPLE_CHOICE'
                        ? 'Pilihan Ganda'
                        : q.question_type === 'TRUE_FALSE'
                        ? 'Benar/Salah'
                        : 'Multi-Pilih'}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        q.difficulty === 'MUDAH'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : q.difficulty === 'SEDANG'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {q.difficulty}
                    </span>
                  </TableCell>

                  <TableCell className="text-center font-mono font-bold text-xs text-slate-800">
                    {q.points}
                  </TableCell>

                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggleActive(q)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                        q.is_active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {q.is_active ? 'Aktif' : 'Non-aktif'}
                    </button>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="p-1.5 h-8 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleOpenEdit(q)}
                        title="Edit Soal"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="p-1.5 h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => handleDeleteQuestion(q)}
                        title="Hapus Soal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* FORM MODAL (CREATE / EDIT) */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingQuestion ? 'Edit Soal Seleksi Akademik' : 'Tambah Soal Ujian Baru'}
        subtitle="Pastikan kunci jawaban benar telah dipilih sebelum menyimpan soal"
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
              onClick={handleSaveQuestion}
            >
              {editingQuestion ? 'Simpan Perubahan' : 'Tambahkan ke Bank Soal'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
          {formError && (
            <Alert type="error" title="Gagal Menyimpan" message={formError} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formSubjectId}
                onChange={e => setFormSubjectId(e.target.value)}
                options={subjects.map(s => ({ value: s.id, label: s.name }))}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kategori / Bab (Opsional)
              </label>
              <Select
                value={formCategoryId}
                onChange={e => setFormCategoryId(e.target.value)}
                options={[
                  { value: '', label: '- Pilih Kategori -' },
                  ...categories
                    .filter(c => !formSubjectId || c.subject_id === formSubjectId)
                    .map(c => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tipe Soal <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formType}
                onChange={e => handleTypeChange(e.target.value as QuestionType)}
                options={[
                  { value: 'MULTIPLE_CHOICE', label: 'Pilihan Ganda (1 Jawaban Benar)' },
                  { value: 'TRUE_FALSE', label: 'Benar / Salah' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tingkat Kesulitan <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formDifficulty}
                onChange={e => setFormDifficulty(e.target.value as QuestionDifficulty)}
                options={[
                  { value: 'MUDAH', label: 'Mudah' },
                  { value: 'SEDANG', label: 'Sedang' },
                  { value: 'SULIT', label: 'Sulit' },
                ]}
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Bobot Nilai (Poin) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={formPoints}
                onChange={e => setFormPoints(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Status Soal
              </label>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="formActiveCheck"
                  checked={formActive}
                  onChange={e => setFormActive(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4"
                />
                <label htmlFor="formActiveCheck" className="text-slate-700 cursor-pointer">
                  Aktifkan soal untuk diacak pada ujian
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Teks Pertanyaan Soal <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={formText}
              onChange={e => setFormText(e.target.value)}
              placeholder="Tuliskan butir soal pertanyaan seleksi..."
              className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            />
          </div>

          {/* Options Management */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 text-xs">
                Pilihan Jawaban & Kunci Jawaban Benar <span className="text-rose-500">*</span>
              </label>
              {formType === 'MULTIPLE_CHOICE' && options.length < 5 && (
                <Button size="sm" variant="ghost" onClick={handleAddOption} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  Tambah Pilihan ({options.length}/5)
                </Button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Pilih radio button pada pilihan yang merupakan <strong>kunci jawaban yang benar</strong>.
            </p>

            <div className="space-y-2">
              {options.map((opt, i) => (
                <div
                  key={opt.option_key || i}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                    opt.is_correct
                      ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input
                      type="radio"
                      name="correctOptionRadio"
                      checked={opt.is_correct}
                      onChange={() => handleCorrectOptionSelect(i)}
                      className="text-emerald-700 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-mono font-bold text-slate-800 w-6 text-center text-xs">
                      {opt.option_key}
                    </span>
                  </label>

                  <input
                    type="text"
                    value={opt.option_text}
                    onChange={e => handleOptionTextChange(i, e.target.value)}
                    placeholder={`Teks pilihan jawaban ${opt.option_key}...`}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    required
                  />

                  {opt.is_correct && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" /> Kunci Benar
                    </span>
                  )}

                  {formType === 'MULTIPLE_CHOICE' && options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(i)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Hapus opsi ini"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Pembahasan / Penjelasan Soal (Opsional)
            </label>
            <textarea
              rows={2}
              value={formExplanation}
              onChange={e => setFormExplanation(e.target.value)}
              placeholder="Catatan pembahasan atau alasan jawaban benar..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </form>
      </Modal>

      {/* CSV IMPORT MODAL */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Soal dari File CSV"
        subtitle="Unggah file spreadsheet CSV dengan kolom format standar bank soal"
        maxWidth="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button size="sm" variant="outline" onClick={() => setIsImportModalOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              disabled={!importPreview || importPreview.validCount === 0 || isImporting}
              isLoading={isImporting}
              onClick={handleCommitImport}
            >
              Impor {importPreview ? `${importPreview.validCount} Soal Valid` : ''}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-1.5 leading-relaxed">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-700" />
              Petunjuk Format Kolom CSV:
            </div>
            <code className="text-[11px] block bg-white p-2 rounded border font-mono text-emerald-950 overflow-x-auto">
              subject_code,category,question,option_a,option_b,option_c,option_d,option_e,correct_answer,difficulty,points
            </code>
            <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-600">
              <li><strong>subject_code</strong>: MATEMATIKA, BAHASA_INDONESIA, IPA, PAI, PENGETAHUAN_UMUM.</li>
              <li><strong>correct_answer</strong>: Pilihan huruf (A, B, C, D, atau E).</li>
              <li><strong>difficulty</strong>: MUDAH, SEDANG, atau SULIT.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => fileInputRef.current?.click()}
            >
              Pilih File CSV dari Komputer
            </Button>
            <span className="text-slate-500 text-[11px]">
              {fileInputRef.current?.files?.[0]?.name || 'Belum ada file dipilih'}
            </span>
          </div>

          {/* Preview Results */}
          {importPreview && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Hasil Validasi File:</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                    {importPreview.validCount} Valid
                  </span>
                  {importPreview.errorCount > 0 && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                      {importPreview.errorCount} Error
                    </span>
                  )}
                </div>
              </div>

              {importPreview.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1 max-h-40 overflow-y-auto">
                  <div className="font-bold flex items-center gap-1.5 text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Ditemukan Kesalahan pada Baris Berikut:
                  </div>
                  {importPreview.errors.map((err, i) => (
                    <div key={i} className="text-[11px] leading-tight font-mono">
                      • {err.error}
                    </div>
                  ))}
                </div>
              )}

              {importPreview.validQuestions.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 text-[10px] uppercase">
                      <tr>
                        <th className="p-2">Mapel</th>
                        <th className="p-2">Pertanyaan</th>
                        <th className="p-2 text-center">Kunci</th>
                        <th className="p-2 text-center">Kesulitan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importPreview.validQuestions.map((vq, i) => {
                        const correctOpt = vq.options.find(o => o.is_correct);
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-800">{vq.subject?.code}</td>
                            <td className="p-2 text-slate-700 truncate max-w-xs">{vq.question_text}</td>
                            <td className="p-2 text-center font-mono font-bold text-emerald-800">
                              {correctOpt?.option_key}
                            </td>
                            <td className="p-2 text-center">{vq.difficulty}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
