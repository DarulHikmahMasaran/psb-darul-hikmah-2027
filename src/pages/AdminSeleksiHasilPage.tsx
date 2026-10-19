import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { selectionScoringService } from '../services/selectionScoringService';
import { SelectionRun, SelectionResult, SelectionResultComponent } from '../types/selection';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import {
  FileSpreadsheet,
  ArrowLeft,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Eye,
  Award,
  Layers,
  HelpCircle,
  ShieldCheck,
  Scale
} from 'lucide-react';

export const AdminSeleksiHasilPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const canResolveTie = hasPermission(role, 'SELECTION_TIE_RESOLVE');

  const [runs, setRuns] = useState<SelectionRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [results, setResults] = useState<SelectionResult[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LULUS' | 'CADANGAN' | 'TIDAK_LULUS' | 'INCOMPLETE' | 'TIE_PENDING'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'FINAL' | 'ACADEMIC' | 'QURAN' | 'PSYCHOTEST'>('FINAL');
  const [isLoading, setIsLoading] = useState(true);

  // Detail Modal
  const [selectedResult, setSelectedResult] = useState<SelectionResult | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Tie Resolve Modal
  const [tieCandidate, setTieCandidate] = useState<SelectionResult | null>(null);
  const [tieDecision, setTieDecision] = useState<'LULUS' | 'CADANGAN' | 'TIDAK_LULUS'>('LULUS');
  const [tieReason, setTieReason] = useState('');
  const [isTieModalOpen, setIsTieModalOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    setIsLoading(true);
    try {
      const runsList = await selectionScoringService.getSelectionRuns();
      setRuns(runsList);

      // Check URL search params for runId if any
      const urlParams = new URLSearchParams(window.location.search);
      const urlRunId = urlParams.get('runId');

      if (urlRunId && runsList.some(r => r.id === urlRunId)) {
        setSelectedRunId(urlRunId);
        await loadResults(urlRunId);
      } else {
        const currentRun = runsList.find(r => r.is_current) || runsList[0];
        if (currentRun) {
          setSelectedRunId(currentRun.id);
          await loadResults(currentRun.id);
        }
      }
    } catch (e) {
      console.error('Failed to load runs', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadResults = async (runId: string) => {
    setIsLoading(true);
    try {
      const list = await selectionScoringService.getSelectionResults(runId, undefined, {
        id: user?.id,
        role: role || undefined,
        email: user?.email,
      });
      setResults(list);
    } catch (e) {
      console.error('Failed to load selection results', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunChange = (runId: string) => {
    setSelectedRunId(runId);
    loadResults(runId);
  };

  const handleExportCsv = async () => {
    if (!selectedRunId) return;
    try {
      const csv = await selectionScoringService.exportSelectionResultsCsv(selectedRunId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hasil-Seleksi-${selectedRunId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToastNotification('Gagal mengekspor laporan CSV.');
    }
  };

  const handleOpenDetail = (res: SelectionResult) => {
    setSelectedResult(res);
    setIsDetailModalOpen(true);
  };

  const handleOpenTieModal = (res: SelectionResult) => {
    setTieCandidate(res);
    setTieDecision('LULUS');
    setTieReason('');
    setIsTieModalOpen(true);
  };

  const handleConfirmResolveTie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tieCandidate || !canResolveTie) return;

    setIsResolving(true);
    try {
      const res = await selectionScoringService.resolveTie(
        selectedRunId,
        tieCandidate.candidate_id,
        tieDecision,
        tieReason,
        { id: user?.id, role: role || undefined, email: user?.email }
      );

      if (!res.success) throw new Error(res.error);

      setIsTieModalOpen(false);
      await loadResults(selectedRunId);
      await loadRuns();
    } catch (e: any) {
      showToastNotification(e.message || 'Gagal menyelesaikan seri.');
    } finally {
      setIsResolving(false);
    }
  };

  // Filter & Search logic
  const filteredResults = results.filter(r => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'INCOMPLETE') {
        if (r.eligibility_status !== 'INCOMPLETE') return false;
      } else {
        if (r.result_status !== statusFilter) return false;
      }
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = r.candidate?.full_name.toLowerCase().includes(q);
      const matchReg = r.candidate?.registration_number?.toLowerCase().includes(q);
      if (!matchName && !matchReg) return false;
    }

    return true;
  });

  // Sort logic
  filteredResults.sort((a, b) => {
    if (sortBy === 'FINAL') {
      return (b.final_score ?? -1) - (a.final_score ?? -1);
    }
    if (sortBy === 'ACADEMIC') {
      return (b.academic_score ?? -1) - (a.academic_score ?? -1);
    }
    if (sortBy === 'QURAN') {
      return (b.quran_score ?? -1) - (a.quran_score ?? -1);
    }
    if (sortBy === 'PSYCHOTEST') {
      return (b.psychotest_score ?? -1) - (a.psychotest_score ?? -1);
    }
    return 0;
  });

  const activeRun = runs.find(r => r.id === selectedRunId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate('/admin/seleksi')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 mb-2 transition"
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Dashboard Seleksi</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rekapitulasi Hasil Akhir & Peringkat Seleksi</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Daftar perankingan deterministik kelulusan santri baru PPTQM Darul Hikmah TP 2027/2028.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <Download size={14} className="mr-1.5" />
            Ekspor Laporan (CSV)
          </Button>
        </div>
      </div>

      {/* Run Selector & Metrics Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Selection Run Sumber:</label>
            <select
              value={selectedRunId}
              onChange={e => handleRunChange(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {runs.map(r => (
                <option key={r.id} value={r.id}>
                  {r.run_name} ({r.status}) {r.is_current ? '★ CURRENT RESMI' : ''}
                </option>
              ))}
            </select>
          </div>

          {activeRun && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                activeRun.status === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                Status: {activeRun.status}
              </span>
              <span className="text-slate-400">|</span>
              <span className="font-mono text-slate-600">Kuota: <strong>{activeRun.quota}</strong></span>
              <span className="text-slate-400">|</span>
              <span className="font-mono text-slate-600">Cadangan: <strong>{activeRun.reserve_count}</strong></span>
            </div>
          )}
        </div>

        {/* Counts summary row */}
        {activeRun && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Santri</div>
              <div className="text-sm font-black text-slate-800 mt-0.5">{results.length}</div>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="text-[10px] text-emerald-700 font-bold uppercase">Lulus Kuota</div>
              <div className="text-sm font-black text-emerald-800 mt-0.5">{results.filter(r => r.result_status === 'LULUS').length}</div>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
              <div className="text-[10px] text-amber-700 font-bold uppercase">Cadangan</div>
              <div className="text-sm font-black text-amber-800 mt-0.5">{results.filter(r => r.result_status === 'CADANGAN').length}</div>
            </div>
            <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
              <div className="text-[10px] text-rose-700 font-bold uppercase">Tidak Lulus</div>
              <div className="text-sm font-black text-rose-800 mt-0.5">{results.filter(r => r.result_status === 'TIDAK_LULUS').length}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Nilai Belum Lengkap</div>
              <div className="text-sm font-black text-slate-500 mt-0.5">{results.filter(r => r.eligibility_status === 'INCOMPLETE').length}</div>
            </div>
            <div className={`p-2.5 rounded-xl border ${
              results.some(r => r.result_status === 'TIE_PENDING')
                ? 'bg-rose-100 border-rose-300 text-rose-800'
                : 'bg-slate-50 border-slate-100 text-slate-400'
            }`}>
              <div className="text-[10px] font-bold uppercase">Hasil Seri</div>
              <div className="text-sm font-black mt-0.5">{results.filter(r => r.result_status === 'TIE_PENDING').length}</div>
            </div>
          </div>
        )}

        {/* Tie Warning Banner */}
        {results.some(r => r.result_status === 'TIE_PENDING') && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between text-xs text-rose-900">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>
                <strong>Perhatian:</strong> Terdapat peserta dengan hasil seri pada batas kuota (TIE_PENDING). Pengesahan kelulusan resmi diblokir hingga Super Admin menyelesaikan keputusan manual.
              </span>
            </div>
          </div>
        )}

        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter size={12} /> Status:
            </span>
            {(['ALL', 'LULUS', 'CADANGAN', 'TIDAK_LULUS', 'INCOMPLETE', 'TIE_PENDING'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st === 'ALL' ? 'Semua Status' : st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cari nama / no peserta..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
            >
              <option value="FINAL">Urut: Nilai Akhir</option>
              <option value="ACADEMIC">Urut: Akademik</option>
              <option value="QURAN">Urut: Al-Qur'an</option>
              <option value="PSYCHOTEST">Urut: Psikotes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <LoadingSpinner size="lg" />
            <p className="text-xs text-slate-400 mt-2">Memuat hasil kelulusan...</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-2">
            <Layers size={24} className="mx-auto text-slate-300" />
            <p>Tidak ada hasil seleksi yang cocok dengan filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center w-16">Peringkat</TableHead>
                  <TableHead>Nomor / Nama Santri</TableHead>
                  <TableHead className="text-center">Akademik (40%)</TableHead>
                  <TableHead className="text-center">Al-Qur'an (35%)</TableHead>
                  <TableHead className="text-center">Psikotes (25%)</TableHead>
                  <TableHead className="text-center">Nilai Akhir</TableHead>
                  <TableHead className="text-center">Status Kelulusan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map(r => {
                  const isLulus = r.result_status === 'LULUS';
                  const isCadangan = r.result_status === 'CADANGAN';
                  const isTie = r.result_status === 'TIE_PENDING';
                  const isIncomplete = r.eligibility_status === 'INCOMPLETE';

                  return (
                    <TableRow key={r.id} className={isLulus ? 'bg-emerald-50/20' : isTie ? 'bg-rose-50/30' : undefined}>
                      <TableCell className="text-center font-mono">
                        {r.eligible_rank ? (
                          <div className="font-bold text-slate-900 text-xs">
                            #{r.eligible_rank}
                            <span className="text-[9px] text-slate-400 block font-normal">(Ov: #{r.overall_rank})</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="font-bold text-slate-900 text-xs">{r.candidate?.full_name || 'Santri'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {r.candidate?.registration_number || '-'} | {r.candidate?.school_name || '-'}
                        </div>
                      </TableCell>

                      <TableCell className="text-center font-mono text-xs">
                        {r.academic_score !== null ? (
                          <div>
                            <span className="font-bold text-indigo-700">{r.academic_score.toFixed(1)}</span>
                            <span className="text-[9px] text-slate-400 block font-normal">{(r.academic_score * 0.4).toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center font-mono text-xs">
                        {r.quran_score !== null ? (
                          <div>
                            <span className="font-bold text-emerald-700">{r.quran_score.toFixed(1)}</span>
                            <span className="text-[9px] text-slate-400 block font-normal">{(r.quran_score * 0.35).toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center font-mono text-xs">
                        {r.psychotest_score !== null ? (
                          <div>
                            <span className="font-bold text-amber-700">{r.psychotest_score.toFixed(1)}</span>
                            <span className="text-[9px] text-slate-400 block font-normal">{(r.psychotest_score * 0.25).toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center font-mono">
                        {r.final_score !== null ? (
                          <span className="text-xs font-black text-slate-900 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                            {r.display_final_score}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isLulus
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isCadangan
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isTie
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 font-extrabold animate-pulse'
                              : isIncomplete
                              ? 'bg-slate-100 text-slate-500 border border-slate-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {r.result_status}
                          </span>
                          {r.decision_reason && (
                            <span className="text-[9px] text-slate-400 max-w-[140px] truncate" title={r.decision_reason}>
                              {r.decision_reason}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetail(r)}
                            className="text-xs py-1 text-slate-700"
                            title="Rincian perhitungan nilai & audit trail"
                          >
                            <Eye size={12} className="mr-1 text-slate-500" /> Detail
                          </Button>

                          {isTie && canResolveTie && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenTieModal(r)}
                              className="text-xs py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold"
                            >
                              Selesaikan Seri
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modal: Rincian Lengkap & Auditable Detail Perhitungan */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Rincian Perhitungan Nilai: ${selectedResult?.candidate?.full_name || ''}`}
      >
        {selectedResult && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">{selectedResult.candidate?.full_name}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  No. Pendaftaran: {selectedResult.candidate?.registration_number} | Sekolah: {selectedResult.candidate?.school_name}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono">
                  Peringkat #{selectedResult.eligible_rank ?? '-'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Status: {selectedResult.result_status}</span>
              </div>
            </div>

            {/* 3 Component Breakdown */}
            <div className="space-y-2">
              <div className="font-bold text-slate-800">Komposisi 3 Komponen Nilai:</div>

              {/* 1. Akademik */}
              <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-1">
                <div className="flex items-center justify-between font-bold text-indigo-950">
                  <span>1. Ujian CBT Akademik</span>
                  <span className="font-mono text-indigo-700">{selectedResult.academic_score?.toFixed(2) ?? '-'} / 100</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 font-mono pt-1">
                  <div>Bobot: <strong>40.00%</strong></div>
                  <div>Kontribusi: <strong className="text-indigo-800">{((selectedResult.academic_score ?? 0) * 0.4).toFixed(4)}</strong></div>
                  <div>Status: <span className="text-emerald-700 font-bold">SUBMITTED</span></div>
                </div>
              </div>

              {/* 2. Quran */}
              <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-1">
                <div className="flex items-center justify-between font-bold text-emerald-950">
                  <span>2. Ujian Al-Qur'an (Tahfidz, Tajwid, Makharij)</span>
                  <span className="font-mono text-emerald-700">{selectedResult.quran_score?.toFixed(2) ?? '-'} / 100</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 font-mono pt-1">
                  <div>Bobot: <strong>35.00%</strong></div>
                  <div>Kontribusi: <strong className="text-emerald-800">{((selectedResult.quran_score ?? 0) * 0.35).toFixed(4)}</strong></div>
                  <div>Status: <span className="text-emerald-700 font-bold">LOCKED</span></div>
                </div>
              </div>

              {/* 3. Psikotes */}
              <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/40 space-y-1">
                <div className="flex items-center justify-between font-bold text-amber-950">
                  <span>3. Psikotes CBT</span>
                  <span className="font-mono text-amber-700">{selectedResult.psychotest_score?.toFixed(2) ?? '-'} / 100</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 font-mono pt-1">
                  <div>Bobot: <strong>25.00%</strong></div>
                  <div>Kontribusi: <strong className="text-amber-800">{((selectedResult.psychotest_score ?? 0) * 0.25).toFixed(4)}</strong></div>
                  <div>Status: <span className="text-emerald-700 font-bold">SUBMITTED</span></div>
                </div>
              </div>
            </div>

            {/* Total Accumulation */}
            <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nilai Akhir Akumulasi (Full Precision)</div>
                <div className="text-xs font-mono text-emerald-400 mt-0.5">{selectedResult.final_score?.toFixed(6) ?? '-'}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tampilan Resmi</div>
                <div className="text-2xl font-black text-white">{selectedResult.display_final_score}</div>
              </div>
            </div>

            {/* Failure reasons if any */}
            {selectedResult.failure_reasons && selectedResult.failure_reasons.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-rose-600" />
                  Alasan Tidak Memenuhi Syarat:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-rose-800 text-[11px]">
                  {selectedResult.failure_reasons.map((f, i) => (
                    <li key={i}>{f.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Audit Version Tracing */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-mono text-slate-500 space-y-1">
              <div>Audit Trace ID: {selectedResult.id}</div>
              <div>Selection Run ID: {selectedResult.selection_run_id}</div>
              <div>Dihitung pada: {new Date(selectedResult.calculated_at).toLocaleString('id-ID')}</div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Resolusi Seri Manual (Super Admin Only) */}
      <Modal
        isOpen={isTieModalOpen}
        onClose={() => setIsTieModalOpen(false)}
        title={`Resolusi Seri: ${tieCandidate?.candidate?.full_name || ''}`}
      >
        <form onSubmit={handleConfirmResolveTie} className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-900">
              <AlertTriangle size={14} /> Penetapan Keputusan Hasil Seri Manual
            </div>
            <p className="text-[11px] leading-relaxed">
              Peserta ini memiliki nilai identik pada batas kuota yang tidak dapat dipisahkan oleh aturan tie-breaker otomatis. Keputusan penetapan ini akan dicatat ke dalam Audit Trail dengan otorisasi Super Admin.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Status Keputusan Kelulusan *</label>
            <select
              value={tieDecision}
              onChange={e => setTieDecision(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold"
            >
              <option value="LULUS">LULUS (Diterima masuk kuota)</option>
              <option value="CADANGAN">CADANGAN (Masuk daftar tunggu)</option>
              <option value="TIDAK_LULUS">TIDAK_LULUS (Tidak diterima)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Alasan Pertimbangan Kebijakan *</label>
            <textarea
              required
              rows={3}
              value={tieReason}
              onChange={e => setTieReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none"
              placeholder="Contoh: Berdasarkan hasil sidang panitia penguji dan wawancara kesiapan santri..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsTieModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isResolving}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isResolving ? 'Menyimpan...' : 'Tetapkan Keputusan Seri'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
