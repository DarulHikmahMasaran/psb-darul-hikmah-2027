import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { cbtService } from '../services/cbtService';
import { Exam } from '../types/cbt';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { formatDateTimeIndonesian } from '../utils/formatters';
import {
  Activity,
  RefreshCw,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send,
  ArrowLeft,
  ShieldAlert,
  RotateCcw,
  Search,
  Filter
} from 'lucide-react';

export const AdminPsikotesMonitoringPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const canForceSubmit = hasPermission(role, 'CBT_FORCE_SUBMIT');
  const canReset = hasPermission(role, 'CBT_RESET');

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [monitoringData, setMonitoringData] = useState<{
    stats: {
      totalAssigned: number;
      notStarted: number;
      inProgress: number;
      submitted: number;
      autoSubmitted: number;
    };
    participants: Array<{
      participantId: string;
      attemptId?: string;
      candidateId: string;
      candidateName: string;
      registrationNumber: string;
      schoolName: string;
      attemptStatus: string;
      startedAt?: string;
      expiresAt?: string;
      answeredQuestions: number;
      totalQuestions: number;
      seatNumber: string;
      violationsCount?: number;
    }>;
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      loadMonitoring(selectedExamId);
    }
  }, [selectedExamId]);

  const loadExams = async () => {
    setIsLoading(true);
    try {
      const allExams = await cbtService.getExams({ exam_type: 'PSYCHOTEST' });
      setExams(allExams);
      if (allExams.length > 0) {
        setSelectedExamId(allExams[0].id);
      }
    } catch (e) {
      console.error('Failed to load psychotest exams for monitoring', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonitoring = async (examId: string) => {
    try {
      const res = await cbtService.getExamMonitoring(examId);
      setMonitoringData(res);
      setLastRefreshed(new Date().toLocaleTimeString('id-ID'));
    } catch (e) {
      console.error('Failed to load monitoring data', e);
    }
  };

  const handleForceSubmit = async (attemptId: string, candidateName: string) => {
    if (!canForceSubmit) {
      showToastNotification('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang melakukan Force Submit.');
      return;
    }
    if (!confirmAction(`Apakah Anda yakin ingin melakukan FORCE SUBMIT untuk ${candidateName}?`)) {
      return;
    }
    setActionLoadingId(attemptId);
    try {
      const res = await cbtService.forceSubmitAttempt(attemptId, {
        id: user?.id,
        role: role || undefined,
        email: user?.email,
      });
      if (!res.success) {
        showToastNotification(res.error || 'Gagal melakukan force submit.');
        return;
      }
      await loadMonitoring(selectedExamId);
    } catch (e: any) {
      showToastNotification(e.message || 'Gagal melakukan force submit.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetAttempt = async (attemptId: string, candidateName: string) => {
    if (!canReset) {
      showToastNotification('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang me-reset attempt.');
      return;
    }
    if (!confirmAction(`PERINGATAN: Me-reset attempt akan menghapus seluruh rekaman jawaban dan event pengerjaan ${candidateName}. Lanjutkan?`)) {
      return;
    }
    setActionLoadingId(attemptId);
    try {
      const res = await cbtService.resetExamAttempt(attemptId, {
        id: user?.id,
        role: role || undefined,
        email: user?.email,
      });
      if (!res.success) {
        showToastNotification(res.error || 'Gagal me-reset attempt.');
        return;
      }
      await loadMonitoring(selectedExamId);
    } catch (e: any) {
      showToastNotification(e.message || 'Gagal me-reset attempt.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredParticipants = (monitoringData?.participants || []).filter(p => {
    if (statusFilter !== 'ALL' && p.attemptStatus !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = p.candidateName.toLowerCase().includes(term);
      const matchReg = p.registrationNumber.toLowerCase().includes(term);
      const matchSeat = p.seatNumber.toLowerCase().includes(term);
      if (!matchName && !matchReg && !matchSeat) return false;
    }
    return true;
  });

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
              <Activity size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Live Monitoring Psikotes CBT</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Pantau status pengerjaan santri secara real-time, kemajuan butir jawaban, anomali tab switch, dan kendali force submit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedExamId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMonitoring(selectedExamId)}
              className="text-xs"
            >
              <RefreshCw size={14} className="mr-1.5" />
              Refresh ({lastRefreshed || 'Memuat...'})
            </Button>
          )}
        </div>
      </div>

      {/* Package Selector & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="w-full sm:w-72">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Pilih Paket Psikotes
            </label>
            <select
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden bg-white font-medium"
            >
              {exams.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.duration_minutes} Menit)
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Filter Status
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden bg-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="NOT_STARTED">Belum Mulai</option>
              <option value="IN_PROGRESS">Sedang Mengerjakan</option>
              <option value="SUBMITTED">Selesai (Submit)</option>
              <option value="AUTO_SUBMITTED">Auto-Submitted (Waktu Habis)</option>
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
              placeholder="Cari nama, no reg, kursi..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Real-time KPI Stats Cards */}
      {monitoringData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Terdaftar</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{monitoringData.stats.totalAssigned}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Belum Mulai</div>
            <div className="text-2xl font-black text-slate-500 mt-1">{monitoringData.stats.notStarted}</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs">
            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Sedang Tes</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{monitoringData.stats.inProgress}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Selesai Submit</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{monitoringData.stats.submitted}</div>
          </div>
          <div className="bg-sky-50 p-4 rounded-2xl border border-sky-200 shadow-xs">
            <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Auto-Submitted</div>
            <div className="text-2xl font-black text-sky-700 mt-1">{monitoringData.stats.autoSubmitted}</div>
          </div>
        </div>
      )}

      {/* Participant Monitoring Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredParticipants.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            Tidak ada calon santri yang sesuai kriteria monitoring.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Kursi</TableHead>
                <TableHead>No. Registrasi & Calon Santri</TableHead>
                <TableHead>Status Pengerjaan</TableHead>
                <TableHead>Progress Butir</TableHead>
                <TableHead>Waktu Sesi</TableHead>
                <TableHead className="text-center">Anomali Tab Switch</TableHead>
                <TableHead className="text-right">Aksi Kendali</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParticipants.map(p => {
                const isOngoing = p.attemptStatus === 'IN_PROGRESS';
                const isFinished = p.attemptStatus === 'SUBMITTED' || p.attemptStatus === 'AUTO_SUBMITTED';

                return (
                  <TableRow key={p.participantId} className="hover:bg-slate-50">
                    <TableCell className="text-center font-mono font-bold text-slate-800 text-xs">
                      {p.seatNumber || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-900 text-xs">{p.candidateName}</div>
                      <div className="text-[11px] font-mono text-teal-700">{p.registrationNumber}</div>
                      <div className="text-[10px] text-slate-400">{p.schoolName}</div>
                    </TableCell>
                    <TableCell>
                      {p.attemptStatus === 'NOT_STARTED' && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          BELUM MULAI
                        </span>
                      )}
                      {p.attemptStatus === 'IN_PROGRESS' && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                          SEDANG MENGERJAKAN
                        </span>
                      )}
                      {p.attemptStatus === 'SUBMITTED' && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          SELESAI SUBMIT
                        </span>
                      )}
                      {p.attemptStatus === 'AUTO_SUBMITTED' && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                          AUTO-SUBMITTED
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.attemptStatus !== 'NOT_STARTED' ? (
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            {p.answeredQuestions} / {p.totalQuestions} Soal
                          </div>
                          <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-teal-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${p.totalQuestions > 0 ? (p.answeredQuestions / p.totalQuestions) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.startedAt ? (
                        <div className="text-[11px] text-slate-600">
                          <div>Mulai: {formatDateTimeIndonesian(p.startedAt)}</div>
                          {p.expiresAt && <div className="text-[10px] text-slate-400">Batas: {formatDateTimeIndonesian(p.expiresAt)}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {(p.violationsCount || 0) > 0 ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          {p.violationsCount}x Pindah Tab
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Normal (0)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isOngoing && p.attemptId && canForceSubmit && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoadingId === p.attemptId}
                            onClick={() => handleForceSubmit(p.attemptId!, p.candidateName)}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs py-1 font-bold"
                          >
                            <Send size={12} className="mr-1" />
                            Force Submit
                          </Button>
                        )}
                        {isFinished && canReset && p.attemptId && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoadingId === p.attemptId}
                            onClick={() => handleResetAttempt(p.attemptId!, p.candidateName)}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs py-1"
                          >
                            <RotateCcw size={12} className="mr-1" />
                            Reset
                          </Button>
                        )}
                        {!canForceSubmit && !canReset && (
                          <span className="text-[10px] text-slate-400 font-mono">Monitoring Only</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
