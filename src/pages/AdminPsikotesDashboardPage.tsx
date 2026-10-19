import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { cbtService } from '../services/cbtService';
import { Exam } from '../types/cbt';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import {
  Brain,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  BookOpen,
  Settings,
  Eye,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity
} from 'lucide-react';

export const AdminPsikotesDashboardPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { role } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedExamId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allExams = await cbtService.getExams({ exam_type: 'PSYCHOTEST' });
      setExams(allExams);

      const targetId = selectedExamId || (allExams.length > 0 ? allExams[0].id : undefined);
      if (targetId && !selectedExamId) {
        setSelectedExamId(targetId);
      }

      const statData = await cbtService.getPsychotestDashboardStats(targetId);
      setStats(statData);
    } catch (e) {
      console.error('Failed to load psychotest stats', e);
    } finally {
      setIsLoading(false);
    }
  };

  const isSuperAdmin = role === 'SUPER_ADMIN';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-300 mb-2">
              <Brain size={18} />
              <span>Modul Asesmen Psikotes CBT • TP 2027/2028</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Dashboard Psikotes Calon Santri</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              Pusat kendali asesmen kognitif, penalaran logis, konsentrasi, ketelitian, dan daya tangkap visual calon santri SMP PPTQM Darul Hikmah.
            </p>
          </div>

          {/* Quick Nav Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {hasPermission(role, 'PSYCHOTEST_MONITOR') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('/admin/psikotes/monitoring')}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs font-semibold"
              >
                <Activity size={14} className="mr-1.5" />
                Live Monitoring
              </Button>
            )}
            {hasPermission(role, 'PSYCHOTEST_RESULT_VIEW') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('/admin/psikotes/hasil')}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs font-semibold"
              >
                <BarChart3 size={14} className="mr-1.5" />
                Rekap Hasil
              </Button>
            )}
            {hasPermission(role, 'PSYCHOTEST_VIEW') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('/admin/psikotes/paket')}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs font-semibold"
              >
                <Layers size={14} className="mr-1.5" />
                Paket Tes
              </Button>
            )}
            {hasPermission(role, 'PSYCHOTEST_QUESTION_MANAGE') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('/admin/psikotes/soal')}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs font-semibold"
              >
                <BookOpen size={14} className="mr-1.5" />
                Bank Soal
              </Button>
            )}
            {hasPermission(role, 'PSYCHOTEST_SCORING_MANAGE') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('/admin/psikotes/scoring')}
                className="bg-amber-500/20 text-amber-200 border-amber-400/30 hover:bg-amber-500/30 text-xs font-semibold"
              >
                <Settings size={14} className="mr-1.5" />
                Konfigurasi Scoring
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter by Exam Package */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pilih Paket Psikotes:</span>
          <select
            value={selectedExamId}
            onChange={e => setSelectedExamId(e.target.value)}
            className="text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>
                {ex.title} {ex.is_active ? '(Aktif)' : '(Nonaktif)'}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total Terdaftar: <strong className="text-slate-800 font-bold">{stats?.totalCandidates || 0} Santri</strong>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <LoadingSpinner size="lg" className="text-teal-700 mb-2" />
          <p className="text-slate-500 text-sm">Memuat statistik psikotes...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Total Peserta</span>
                <Users size={18} className="text-teal-600" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-900">{stats?.totalCandidates || 0}</div>
                <div className="text-[11px] text-slate-400 mt-1">Terjadwal di sesi Psikotes</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Belum Mulai</span>
                <Clock size={18} className="text-slate-400" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-600">{stats?.notStarted || 0}</div>
                <div className="text-[11px] text-slate-400 mt-1">Menunggu waktu pengerjaan</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-700 text-xs font-bold uppercase">
                <span>Sedang Mengerjakan</span>
                <Activity size={18} className="text-amber-500 animate-pulse" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-amber-600">{stats?.inProgress || 0}</div>
                <div className="text-[11px] text-amber-700/70 mt-1">Sesi ujian aktif berjalan</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-teal-700 text-xs font-bold uppercase">
                <span>Sudah Submit</span>
                <CheckCircle2 size={18} className="text-teal-600" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-teal-700">{stats?.submitted || 0}</div>
                <div className="text-[11px] text-teal-700/70 mt-1">Selesai submit mandiri</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-sky-700 text-xs font-bold uppercase">
                <span>Auto Submit</span>
                <AlertCircle size={18} className="text-sky-500" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-sky-700">{stats?.autoSubmitted || 0}</div>
                <div className="text-[11px] text-sky-700/70 mt-1">Waktu berakhir otomatis</div>
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Overview */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <TrendingUp size={18} className="text-teal-600" />
                  Statistik Nilai Ternormalisasi
                </h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500">Skala 0-100</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Rata-Rata</div>
                  <div className="text-3xl font-black text-teal-700 mt-1">{stats?.averageScore || 0}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Terendah</div>
                  <div className="text-3xl font-black text-slate-700 mt-1">{stats?.minScore || 0}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Tertinggi</div>
                  <div className="text-3xl font-black text-emerald-600 mt-1">{stats?.maxScore || 0}</div>
                </div>
              </div>

              {/* Distribution */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Distribusi Rentang Nilai</h4>
                <div className="space-y-2">
                  {stats?.scoreDistribution?.map((dist: any) => {
                    const totalFinished = (stats.submitted || 0) + (stats.autoSubmitted || 0);
                    const pct = totalFinished > 0 ? Math.round((dist.count / totalFinished) * 100) : 0;
                    return (
                      <div key={dist.range} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium text-slate-600">
                          <span>Nilai {dist.range}</span>
                          <span>{dist.count} santri ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-teal-600 h-full rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Category Averages Breakdown */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Brain size={18} className="text-teal-600" />
                  Rata-rata Skor per Kategori Asesmen
                </h3>
                <span className="text-xs text-slate-500">Normalisasi 0 - 100</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.keys(stats?.categoryAverages || {}).length > 0 ? (
                  Object.entries(stats.categoryAverages).map(([catName, scoreVal]: [string, any]) => (
                    <div key={catName} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">{catName}</span>
                        <span className="text-base font-extrabold text-teal-800">{scoreVal}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-teal-500 to-teal-700 h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, scoreVal))}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 text-slate-400 text-sm">
                    Belum ada data pengerjaan santri untuk paket ini.
                  </div>
                )}
              </div>

              {/* Functional principle disclaimer */}
              <div className="bg-slate-50 text-slate-600 text-xs p-4 rounded-2xl border border-slate-200 leading-relaxed">
                <strong>Catatan Sistem:</strong> Sistem asesmen psikotes ini murni menghitung perolehan skor kognitif sesuai rubrik dan scoring key yang dikonfigurasi panitia. Sistem <strong>TIDAK</strong> membuat diagnosis psikologis, label klinis, ataupun klaim kepribadian mutlak.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
