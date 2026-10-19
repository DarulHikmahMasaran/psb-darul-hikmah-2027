import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { cbtService } from '../services/cbtService';
import { Exam, ExamAttempt } from '../types/cbt';
import { Candidate } from '../types/database';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Modal } from '../components/Modal';
import { formatDateTimeIndonesian } from '../utils/formatters';
import {
  BarChart3,
  Search,
  Download,
  Filter,
  ArrowLeft,
  Eye,
  CheckCircle,
  FileSpreadsheet,
  Award,
  Layers,
  Brain,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';

interface ResultRow {
  attempt: ExamAttempt;
  candidate: Candidate;
  exam: Exam;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
}

export const AdminPsikotesHasilPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const [results, setResults] = useState<ResultRow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExamId, setFilterExamId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Detail Modal State
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allExams, allResults] = await Promise.all([
        cbtService.getExams({ exam_type: 'PSYCHOTEST' }),
        cbtService.getExamResults(),
      ]);
      setExams(allExams);

      // Filter only psychotest attempts
      const psiResults = allResults.filter(
        r => r.exam.exam_type === 'PSYCHOTEST' || (!r.exam.exam_type && r.exam.id.includes('psikotes'))
      );
      setResults(psiResults);
    } catch (e) {
      console.error('Failed to load psychotest results', e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResults = results.filter(r => {
    if (filterExamId && r.exam.id !== filterExamId) return false;
    if (filterStatus && r.attempt.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = r.candidate.full_name?.toLowerCase().includes(term);
      const matchReg = r.candidate.registration_number?.toLowerCase().includes(term);
      const matchSch = r.candidate.school_name?.toLowerCase().includes(term);
      if (!matchName && !matchReg && !matchSch) return false;
    }
    return true;
  });

  const handleExportCsv = async () => {
    if (filteredResults.length === 0) {
      showToastNotification('Tidak ada data hasil psikotes untuk diekspor.');
      return;
    }

    try {
      const csvContent = await cbtService.exportPsychotestResultsCsv(filterExamId || undefined);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `rekap-hasil-psikotes-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Export CSV failed', e);
      showToastNotification('Gagal mengekspor data CSV.');
    }
  };

  const handleOpenDetail = (row: ResultRow) => {
    setSelectedResult(row);
    setIsDetailModalOpen(true);
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
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rekapitulasi Hasil Psikotes Santri</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Laporan nilai kuantitatif asesmen kognitif, penalaran visual, konsistensi belajar, dan ketelitian calon santri TP 2027/2028.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="text-teal-700 border-teal-200 hover:bg-teal-50 text-xs font-bold"
          >
            <Download size={14} className="mr-1.5" />
            Ekspor CSV (Netral Kuantitatif)
          </Button>
        </div>
      </div>

      {/* Principle Notice */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 border border-slate-800 flex items-center gap-3 text-xs">
        <ShieldCheck size={20} className="text-teal-400 shrink-0" />
        <div>
          <span className="font-bold text-teal-300">Format Laporan Standar Pesantren: </span>
          Hasil asesmen disajikan secara objektif dalam bentuk skor mentah dan nilai skala 0-100 per subtes tanpa pelabelan klinis atau diagnosis psikologis.
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="w-full sm:w-72">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Filter Paket Psikotes
            </label>
            <select
              value={filterExamId}
              onChange={e => setFilterExamId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden bg-white"
            >
              <option value="">Semua Paket Psikotes</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Filter Status
            </label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden bg-white"
            >
              <option value="">Semua Status</option>
              <option value="SUBMITTED">Selesai (Submit)</option>
              <option value="AUTO_SUBMITTED">Auto-Submitted</option>
            </select>
          </div>
        </div>

        <div className="w-full md:w-72">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Pencarian Santri
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, no pendaftaran, sekolah..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            Belum ada data pengerjaan psikotes yang terekam atau sesuai kriteria filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">No</TableHead>
                <TableHead>Calon Santri & Asal Sekolah</TableHead>
                <TableHead>Paket Psikotes</TableHead>
                <TableHead className="text-center">Skor Mentah</TableHead>
                <TableHead className="text-center">Nilai Akhir (0-100)</TableHead>
                <TableHead>Rincian Subtes Utama</TableHead>
                <TableHead>Status & Waktu</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((r, idx) => {
                const catScores = r.attempt.category_scores || [];
                return (
                  <TableRow key={r.attempt.id} className="hover:bg-slate-50">
                    <TableCell className="text-center text-xs font-mono text-slate-500">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-900 text-xs">{r.candidate.full_name}</div>
                      <div className="text-[11px] font-mono text-teal-700">{r.candidate.registration_number}</div>
                      <div className="text-[10px] text-slate-400">{r.candidate.school_name}</div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {r.exam.title}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold text-slate-800">
                      {r.attempt.raw_score} / {r.attempt.max_score}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                        {r.attempt.normalized_score}
                      </div>
                    </TableCell>
                    <TableCell>
                      {catScores.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {catScores.slice(0, 3).map(cs => (
                            <span
                              key={cs.category_id}
                              className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                            >
                              {cs.category_name}: <strong>{cs.normalized_score}</strong>
                            </span>
                          ))}
                          {catScores.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{catScores.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          r.attempt.status === 'SUBMITTED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}>
                          {r.attempt.status === 'SUBMITTED' ? 'SELESAI' : 'AUTO-SUBMIT'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {r.attempt.submitted_at ? formatDateTimeIndonesian(r.attempt.submitted_at) : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(r)}
                        className="text-slate-700 hover:bg-slate-100 text-xs py-1"
                      >
                        <Eye size={13} className="mr-1" />
                        Rincian
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal: Detail Rincian Hasil Psikotes */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Rincian Hasil Asesmen Psikotes"
        size="lg"
      >
        {selectedResult && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400 font-medium">Calon Santri</div>
                <div className="text-base font-bold text-slate-900">{selectedResult.candidate.full_name}</div>
                <div className="text-xs font-mono text-teal-700">{selectedResult.candidate.registration_number}</div>
                <div className="text-xs text-slate-500">{selectedResult.candidate.school_name}</div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs text-slate-400 font-medium">Skor Akhir Ternormalisasi</div>
                <div className="text-3xl font-black text-teal-700 font-mono mt-0.5">
                  {selectedResult.attempt.normalized_score}
                  <span className="text-xs text-slate-400 font-normal"> / 100</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Skor Mentah: <strong>{selectedResult.attempt.raw_score}</strong> / {selectedResult.attempt.max_score}
                </div>
              </div>
            </div>

            {/* Performance Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-medium">Total Soal</div>
                <div className="text-base font-bold text-slate-800 mt-0.5">{selectedResult.attempt.total_questions} Butir</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-medium">Soal Dijawab</div>
                <div className="text-base font-bold text-teal-700 mt-0.5">{selectedResult.attempt.answered_questions} Butir</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-medium">Jawaban Tepat</div>
                <div className="text-base font-bold text-emerald-700 mt-0.5">{selectedResult.attempt.correct_answers} Butir</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-medium">Status Pengerjaan</div>
                <div className="text-xs font-bold text-slate-800 mt-1">{selectedResult.attempt.status}</div>
              </div>
            </div>

            {/* Breakdown Per Subtes / Kategori */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Capaian Nilai Per Subtes Kategori
              </h3>

              {(selectedResult.attempt.category_scores || []).length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  Data rincian kategori belum tercatat pada sesi ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedResult.attempt.category_scores!.map(cs => (
                    <div
                      key={cs.category_id}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-800">{cs.category_name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Skor Mentah: {cs.raw_score} / {cs.max_score} • Benar: {cs.correct_answers} / {cs.total_questions} Soal
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div
                            className="bg-teal-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, cs.normalized_score))}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-base text-teal-800">
                          {cs.normalized_score}
                        </div>
                        <div className="text-[10px] text-slate-400">Skala 100</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-xs"
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
