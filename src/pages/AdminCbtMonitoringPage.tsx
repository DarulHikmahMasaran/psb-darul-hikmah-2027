import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { cbtService } from '../services/cbtService';
import { Exam } from '../types/cbt';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { LoadingSpinner } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDateIndonesian, formatDateTimeIndonesian } from '../utils/formatters';
import {
  Activity,
  RefreshCw,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send,
  Zap,
  Radio,
  Layers
} from 'lucide-react';

export const AdminCbtMonitoringPage: React.FC = () => {
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
      const allExams = await cbtService.getExams();
      setExams(allExams);
      if (allExams.length > 0) {
        setSelectedExamId(allExams[0].id);
      }
    } catch (e) {
      console.error('Failed to load exams for monitoring', e);
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
      showToastNotification('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang melakukan Force Submit CBT.');
      return;
    }
    if (!confirmAction(`Yakin ingin mengumpulkan paksa ujian peserta "${candidateName}"? Sesi akan diselesaikan dan skor dihitung secara otomatis.`)) {
      return;
    }
    setActionLoadingId(attemptId);
    try {
      const res = await cbtService.forceSubmitAttempt(attemptId, {
        id: user?.id,
        role: role || undefined,
        email: user?.email,
      });
      if (res.success) {
        await loadMonitoring(selectedExamId);
      } else {
        showToastNotification(res.error || 'Gagal melakukan force submit.');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetAttempt = async (attemptId: string, candidateName: string) => {
    if (!canReset) {
      showToastNotification('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang me-reset sesi CBT.');
      return;
    }
    if (!confirmAction(`PERINGATAN: Yakin ingin ME-RESET sesi ujian "${candidateName}"? Seluruh riwayat dan jawaban peserta akan dihapus agar santri dapat mengulang ujian.`)) {
      return;
    }
    setActionLoadingId(attemptId);
    try {
      const res = await cbtService.resetAttempt(attemptId, {
        id: user?.id,
        role: role || undefined,
        email: user?.email,
      });
      if (res.success) {
        await loadMonitoring(selectedExamId);
      } else {
        showToastNotification(res.error || 'Gagal me-reset attempt.');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 animate-pulse text-emerald-600" />
            CBT Realtime Monitoring & Pengawasan
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Monitoring Peserta Ujian Seleksi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pantau status pengerjaan santri, batas waktu pengerjaan, dan progres lembar jawaban secara langsung.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-64">
            <Select
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              options={exams.map(e => ({ value: e.id, label: e.title }))}
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => selectedExamId && loadMonitoring(selectedExamId)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Menghubungkan ke monitor ujian..." className="py-16" />
      ) : !activeExam ? (
        <EmptyState
          icon={<Layers className="w-10 h-10 text-slate-300" />}
          title="Belum Ada Paket Ujian Aktif"
          description="Silakan buat paket ujian akademik terlebih dahulu pada menu Paket Ujian CBT."
        />
      ) : (
        <>
          {/* STATS TILES */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Terjadwal
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {monitoringData?.stats.totalAssigned || 0}
                </span>
                <span className="text-[10px] text-slate-500">Santri</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Belum Mulai
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-slate-600 font-mono">
                  {monitoringData?.stats.notStarted || 0}
                </span>
                <span className="text-[10px] text-slate-400">Menunggu</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping inline-block" />
                Sedang Ujian
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono">
                  {monitoringData?.stats.inProgress || 0}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold">Mengerjakan</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Sudah Submit
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-blue-700 font-mono">
                  {monitoringData?.stats.submitted || 0}
                </span>
                <span className="text-[10px] text-blue-600">Selesai</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Auto Submit
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-amber-700 font-mono">
                  {monitoringData?.stats.autoSubmitted || 0}
                </span>
                <span className="text-[10px] text-amber-600">Waktu Habis</span>
              </div>
            </div>
          </div>

          {/* Active Schedule Context Banner */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-700 font-mono font-bold text-[10px]">
                {activeExam.duration_minutes} Menit
              </span>
              <span className="font-bold">{activeExam.title}</span>
              <span className="text-slate-400 hidden sm:inline">•</span>
              <span className="text-slate-300">
                Sesi: <strong>{activeExam.test_schedule?.title || 'Sesi Ujian Akademik'}</strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Pembaruan terakhir: {lastRefreshed || 'Baru saja'}
            </div>
          </div>

          {/* Participants Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold">
                  <TableHead className="w-12 text-center">Kursi</TableHead>
                  <TableHead className="w-36">No. Pendaftaran</TableHead>
                  <TableHead>Nama Calon Santri</TableHead>
                  <TableHead>Asal Sekolah</TableHead>
                  <TableHead className="w-32 text-center">Status Attempt</TableHead>
                  <TableHead className="w-32 text-center">Progres Soal</TableHead>
                  <TableHead className="w-40">Mulai Ujian</TableHead>
                  <TableHead className="w-40">Batas Waktu</TableHead>
                  <TableHead className="w-24 text-center">Pelanggaran</TableHead>
                  <TableHead className="w-36 text-center">Aksi Pengawas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitoringData?.participants && monitoringData.participants.length > 0 ? (
                  monitoringData.participants.map(p => (
                    <TableRow key={p.participantId} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="text-center font-mono font-bold text-xs bg-slate-50">
                        {p.seatNumber}
                      </TableCell>

                      <TableCell className="font-mono font-bold text-xs text-emerald-800">
                        {p.registrationNumber}
                      </TableCell>

                      <TableCell>
                        <span className="font-bold text-slate-900 text-xs block">{p.candidateName}</span>
                      </TableCell>

                      <TableCell className="text-xs text-slate-600 truncate max-w-[180px]">
                        {p.schoolName}
                      </TableCell>

                      <TableCell className="text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            p.attemptStatus === 'SEDANG_UJIAN'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                              : p.attemptStatus === 'SUDAH_SUBMIT'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : p.attemptStatus === 'AUTO_SUBMIT'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {p.attemptStatus === 'SEDANG_UJIAN' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          )}
                          {p.attemptStatus === 'SEDANG_UJIAN'
                            ? 'Sedang Ujian'
                            : p.attemptStatus === 'SUDAH_SUBMIT'
                            ? 'Selesai'
                            : p.attemptStatus === 'AUTO_SUBMIT'
                            ? 'Auto-Submit'
                            : 'Belum Mulai'}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="inline-block">
                          <span className="font-mono font-bold text-xs text-slate-800">
                            {p.answeredQuestions} / {p.totalQuestions}
                          </span>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full rounded-full transition-all"
                              style={{
                                width: `${p.totalQuestions > 0 ? (p.answeredQuestions / p.totalQuestions) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-slate-600 font-mono">
                        {p.startedAt ? new Date(p.startedAt).toLocaleTimeString('id-ID') : '-'}
                      </TableCell>

                      <TableCell className="text-xs text-slate-600 font-mono">
                        {p.expiresAt ? new Date(p.expiresAt).toLocaleTimeString('id-ID') : '-'}
                      </TableCell>

                      <TableCell className="text-center">
                        {(p.violationsCount || 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            {p.violationsCount}x tab
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">0</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {p.attemptStatus === 'SEDANG_UJIAN' && p.attemptId && canForceSubmit && (
                            <button
                              type="button"
                              title="Paksa Kumpulkan Ujian"
                              disabled={actionLoadingId === p.attemptId}
                              onClick={() => handleForceSubmit(p.attemptId!, p.candidateName)}
                              className="p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition text-[10px] font-bold flex items-center gap-0.5"
                            >
                              <Zap className="w-3 h-3 text-amber-600" /> Submit
                            </button>
                          )}
                          {p.attemptId && canReset && (
                            <button
                              type="button"
                              title="Reset Attempt Ujian"
                              disabled={actionLoadingId === p.attemptId}
                              onClick={() => handleResetAttempt(p.attemptId!, p.candidateName)}
                              className="p-1 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 border border-slate-200 transition text-[10px] flex items-center gap-0.5"
                            >
                              <RefreshCw className="w-3 h-3" /> Reset
                            </button>
                          )}
                          {!canForceSubmit && !canReset && (
                            <span className="text-[10px] text-slate-400 font-mono">Monitoring Only</span>
                          )}
                          {!p.attemptId && (canForceSubmit || canReset) && (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-slate-400 text-xs">
                      Belum ada peserta yang ditempatkan pada sesi ujian ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};
