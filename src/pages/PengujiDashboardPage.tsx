import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { quranService } from '../services/quranService';
import { QuranExaminerAssignment } from '../types/quran';
import {
  BookOpen,
  Users,
  Clock,
  CheckCircle,
  FileEdit,
  Search,
  Calendar,
  MapPin,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';

export const PengujiDashboardPage = ({ onNavigate }: { onNavigate: (to: string) => void }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0 });
  const [assignments, setAssignments] = useState<QuranExaminerAssignment[]>([]);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const examinerUserId = user?.id || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, listData] = await Promise.all([
        quranService.getExaminerDashboardStats(examinerUserId),
        quranService.getExaminerCandidates(examinerUserId),
      ]);
      setStats(statsData);
      setAssignments(listData);
    } catch (err: any) {
      console.error('Error loading examiner dashboard', err);
      setErrorMessage(err.message || 'Gagal memuat data penguji.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [examinerUserId]);

  const handleStartOrResume = async (assignment: QuranExaminerAssignment) => {
    setActionLoading(assignment.id);
    setErrorMessage(null);
    try {
      const res = await quranService.startOrGetAssessment(assignment.id, {
        id: user?.id || '',
        email: user?.email || '',
        role: user?.role || 'PENGUJI_QURAN',
        name: user?.profile?.full_name,
      });

      if (res.success && res.assessment) {
        onNavigate(`/penguji/quran/${res.assessment.id}`);
      } else {
        setErrorMessage(res.error || 'Gagal memulai penilaian.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const name = (a.candidate?.full_name || '').toLowerCase();
    const reg = (a.candidate?.registration_number || '').toLowerCase();
    const school = (a.candidate?.school_name || '').toLowerCase();
    return name.includes(q) || reg.includes(q) || school.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold mb-3">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Modul Seleksi Luring: Tes Bacaan & Hafalan Al-Qur'an</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Portal Penguji Al-Qur'an
            </h1>
            <p className="text-emerald-100 text-sm mt-1">
              Penguji: <span className="font-bold text-white">{user?.profile?.full_name || 'Ustadz Penguji'}</span> • PPTQM Darul Hikmah TP 2027/2028
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('/penguji/peserta')}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              Semua Peserta Saya
            </Button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6">
          <Alert type="error" title="Perhatian Penguji" message={errorMessage} />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Ditugaskan</span>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">Calon santri terdaftar</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Belum Dinilai</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700">{stats.pending}</div>
          <div className="text-xs text-slate-500 mt-1">Menunggu giliran tes</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Draft / Revisi</span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <FileEdit className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.inProgress}</div>
          <div className="text-xs text-slate-500 mt-1">Sedang berlangsung</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Selesai / Terkunci</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.completed}</div>
          <div className="text-xs text-slate-500 mt-1">Nilai masuk & terkunci</div>
        </div>
      </div>

      {/* Main Content: Peserta Hari Ini */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Daftar Peserta Tes Al-Qur'an</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hanya peserta yang terverifikasi dan ditugaskan kepada Anda yang ditampilkan di bawah ini.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari santri / no reg..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Memuat daftar santri...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Belum Ada Peserta yang Ditugaskan</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Panitia PSB belum menugaskan peserta kepada akun penguji Anda untuk jadwal seleksi Al-Qur'an.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Nomor Peserta</th>
                  <th className="py-3 px-4">Nama Calon Santri</th>
                  <th className="py-3 px-4">Asal Sekolah</th>
                  <th className="py-3 px-4">Sesi & Ruang</th>
                  <th className="py-3 px-4 text-center">Presensi</th>
                  <th className="py-3 px-4 text-center">Status Nilai</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAssignments.map((a, idx) => {
                  const assessStatus = a.assessment?.status || 'NOT_STARTED';
                  const isPresent = a.attendance_status === 'HADIR';
                  const isLate = a.attendance_status === 'TERLAMBAT';
                  const isAbsent = a.attendance_status === 'TIDAK_HADIR';

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                          {a.candidate?.registration_number || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{a.candidate?.full_name || '-'}</div>
                        <div className="text-[11px] text-slate-400">
                          {a.candidate?.gender === 'L' ? 'Santri Putra (Ikhwan)' : 'Santri Putri (Akhwat)'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {a.candidate?.school_name || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-semibold text-slate-800">{a.schedule?.title || 'Sesi Qur\'an'}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-emerald-700" />
                          <span>{a.schedule?.room || '-'} • Pukul {a.schedule?.start_time} WIB</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" />
                            Hadir
                          </span>
                        ) : isLate ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            Terlambat
                          </span>
                        ) : isAbsent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3" />
                            Tidak Hadir
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                            Belum Hadir
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {assessStatus === 'LOCKED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <ShieldCheck className="w-3 h-3 text-emerald-700" />
                            Terkunci ({a.assessment?.normalized_score})
                          </span>
                        ) : assessStatus === 'SUBMITTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            Submitted ({a.assessment?.normalized_score})
                          </span>
                        ) : assessStatus === 'NEEDS_REVISION' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <AlertCircle className="w-3 h-3 text-amber-700" />
                            Perlu Revisi
                          </span>
                        ) : assessStatus === 'IN_PROGRESS' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Draft ({a.assessment?.normalized_score || 0})
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Belum Dinilai
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {assessStatus === 'LOCKED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigate(`/penguji/quran/${a.assessment?.id}`)}
                            className="text-xs"
                          >
                            Lihat Hasil
                          </Button>
                        ) : assessStatus === 'IN_PROGRESS' || assessStatus === 'NEEDS_REVISION' ? (
                          <Button
                            size="sm"
                            onClick={() => onNavigate(`/penguji/quran/${a.assessment?.id}`)}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                          >
                            Lanjutkan
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={isAbsent}
                            isLoading={actionLoading === a.id}
                            onClick={() => handleStartOrResume(a)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs shadow-xs"
                          >
                            Mulai Penilaian
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
