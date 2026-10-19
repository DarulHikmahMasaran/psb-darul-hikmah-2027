import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { cbtService } from '../services/cbtService';
import { Exam, ExamAttempt } from '../types/cbt';
import { Candidate } from '../types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { LoadingSpinner } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDateIndonesian } from '../utils/formatters';
import {
  BarChart2,
  Search,
  Download,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Award,
  Filter,
  Layers
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

export const AdminCbtResultsPage: React.FC = () => {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExamId, setFilterExamId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allExams, allResults] = await Promise.all([
        cbtService.getExams(),
        cbtService.getExamResults(),
      ]);
      setExams(allExams);
      setResults(allResults);
    } catch (e) {
      console.error('Failed to load exam results', e);
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

  const handleExportCsv = () => {
    if (filteredResults.length === 0) {
      showToastNotification('Tidak ada data hasil ujian untuk diekspor.');
      return;
    }

    const headers = [
      'Nomor Pendaftaran',
      'Nama Santri',
      'Asal Sekolah',
      'Paket Ujian',
      'Waktu Mulai',
      'Waktu Submit',
      'Total Soal',
      'Dijawab',
      'Benar',
      'Salah',
      'Kosong',
      'Raw Score',
      'Max Score',
      'Normalized Score',
      'Status',
    ];

    const escapeCsv = (str?: string | number) => {
      if (str === undefined || str === null) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const lines: string[] = [headers.join(',')];

    for (const r of filteredResults) {
      lines.push([
        escapeCsv(r.candidate.registration_number),
        escapeCsv(r.candidate.full_name),
        escapeCsv(r.candidate.school_name),
        escapeCsv(r.exam.title),
        escapeCsv(r.attempt.started_at ? new Date(r.attempt.started_at).toLocaleString('id-ID') : '-'),
        escapeCsv(r.attempt.submitted_at ? new Date(r.attempt.submitted_at).toLocaleString('id-ID') : '-'),
        r.attempt.total_questions,
        r.answeredCount,
        r.correctCount,
        r.wrongCount,
        r.unansweredCount,
        r.attempt.raw_score,
        r.attempt.max_score,
        r.attempt.normalized_score,
        r.attempt.status,
      ].join(','));
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rekap_nilai_cbt_darul_hikmah_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Stats calculation
  const totalSubmissions = filteredResults.length;
  const avgScore =
    totalSubmissions > 0
      ? Math.round(
          (filteredResults.reduce((sum, r) => sum + Number(r.attempt.normalized_score || 0), 0) /
            totalSubmissions) *
            100
        ) / 100
      : 0;

  const highestScore =
    totalSubmissions > 0
      ? Math.max(...filteredResults.map(r => Number(r.attempt.normalized_score || 0)))
      : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <Award className="w-4 h-4" />
            Penilaian & Rekapitulasi Akademik
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hasil Ujian CBT Akademik
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daftar lembar pengerjaan, skor mentah, perolehan nilai ternormalisasi (skala 100), dan status pengumpulan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadData}
          >
            Refresh
          </Button>

          <Button
            size="sm"
            variant="primary"
            className="bg-emerald-700 hover:bg-emerald-800 font-bold"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
          >
            Export Rekap Nilai CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Lembar Terkumpul
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {totalSubmissions} Peserta
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <BarChart2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Rata-rata Nilai
            </span>
            <span className="text-2xl font-black text-emerald-800 font-mono mt-1 block">
              {avgScore} / 100
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Nilai Tertinggi
            </span>
            <span className="text-2xl font-black text-purple-800 font-mono mt-1 block">
              {highestScore} / 100
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Input
              placeholder="Cari nama santri atau no pendaftaran..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div>
            <Select
              value={filterExamId}
              onChange={e => setFilterExamId(e.target.value)}
              options={[
                { value: '', label: 'Semua Paket Ujian' },
                ...exams.map(e => ({ value: e.id, label: e.title })),
              ]}
            />
          </div>

          <div>
            <Select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              options={[
                { value: '', label: 'Semua Status Pengerjaan' },
                { value: 'SUBMITTED', label: 'Submit Mandiri' },
                { value: 'AUTO_SUBMITTED', label: 'Auto Submit (Waktu Habis)' },
                { value: 'IN_PROGRESS', label: 'Sedang Mengerjakan' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Results Table */}
      {isLoading ? (
        <LoadingSpinner text="Memuat hasil ujian..." className="py-16" />
      ) : filteredResults.length === 0 ? (
        <EmptyState
          icon={<BarChart2 className="w-10 h-10 text-slate-300" />}
          title="Belum Ada Hasil Ujian"
          description="Peserta yang menyelesaikan ujian akademik akan secara otomatis terdata nilainya pada halaman ini."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold">
                <TableHead className="w-12 text-center">No</TableHead>
                <TableHead className="w-36">No. Registrasi</TableHead>
                <TableHead>Nama Santri & Asal Sekolah</TableHead>
                <TableHead className="w-44">Paket Ujian</TableHead>
                <TableHead className="w-20 text-center">Soal</TableHead>
                <TableHead className="w-20 text-center">Benar</TableHead>
                <TableHead className="w-20 text-center">Salah</TableHead>
                <TableHead className="w-20 text-center">Kosong</TableHead>
                <TableHead className="w-24 text-center">Raw Score</TableHead>
                <TableHead className="w-28 text-center bg-emerald-50/50">Nilai (100)</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((r, idx) => (
                <TableRow key={r.attempt.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="text-center font-mono text-xs text-slate-400">
                    {idx + 1}
                  </TableCell>

                  <TableCell className="font-mono font-bold text-xs text-emerald-800">
                    {r.candidate.registration_number || '-'}
                  </TableCell>

                  <TableCell>
                    <span className="font-bold text-slate-900 text-xs block">
                      {r.candidate.full_name || 'Santri'}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                      {r.candidate.school_name || '-'}
                    </span>
                  </TableCell>

                  <TableCell className="text-xs text-slate-700 truncate max-w-[170px]">
                    {r.exam.title}
                  </TableCell>

                  <TableCell className="text-center font-mono text-xs text-slate-700">
                    {r.attempt.total_questions}
                  </TableCell>

                  <TableCell className="text-center font-mono font-bold text-xs text-emerald-700">
                    {r.correctCount}
                  </TableCell>

                  <TableCell className="text-center font-mono font-bold text-xs text-rose-600">
                    {r.wrongCount}
                  </TableCell>

                  <TableCell className="text-center font-mono text-xs text-slate-400">
                    {r.unansweredCount}
                  </TableCell>

                  <TableCell className="text-center font-mono text-xs text-slate-700">
                    {r.attempt.raw_score} / {r.attempt.max_score}
                  </TableCell>

                  <TableCell className="text-center bg-emerald-50/50">
                    <span className="font-mono font-black text-sm text-emerald-900">
                      {Number(r.attempt.normalized_score).toFixed(2)}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.attempt.status === 'SUBMITTED'
                          ? 'bg-blue-100 text-blue-800'
                          : r.attempt.status === 'AUTO_SUBMITTED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {r.attempt.status === 'SUBMITTED'
                        ? 'Selesai'
                        : r.attempt.status === 'AUTO_SUBMITTED'
                        ? 'Auto-Submit'
                        : 'Berlangsung'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
