import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { quranService } from '../services/quranService';
import { QuranExaminerAssignment } from '../types/quran';
import {
  BookOpen,
  Search,
  Filter,
  ArrowLeft,
  Calendar,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';

export const PengujiPesertaPage = ({
  onNavigate,
  initialFilter = 'ALL',
}: {
  onNavigate: (to: string) => void;
  initialFilter?: string;
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<QuranExaminerAssignment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [scheduleFilter, setScheduleFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const examinerUserId = user?.id || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await quranService.getExaminerCandidates(examinerUserId);
      setAssignments(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat peserta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [examinerUserId]);

  const uniqueSchedules = Array.from(
    new Map(
      assignments.map((a) => [a.schedule_id, a.schedule?.title || 'Sesi Seleksi'])
    ).entries()
  );

  const filtered = assignments.filter((a) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (a.candidate?.full_name || '').toLowerCase().includes(q) ||
      (a.candidate?.registration_number || '').toLowerCase().includes(q) ||
      (a.candidate?.school_name || '').toLowerCase().includes(q);

    const matchesSchedule = scheduleFilter === 'ALL' || a.schedule_id === scheduleFilter;

    let matchesStatus = true;
    const st = a.assessment?.status || 'NOT_STARTED';
    if (statusFilter === 'NOT_STARTED') {
      matchesStatus = st === 'NOT_STARTED';
    } else if (statusFilter === 'IN_PROGRESS') {
      matchesStatus = st === 'IN_PROGRESS' || st === 'NEEDS_REVISION';
    } else if (statusFilter === 'LOCKED') {
      matchesStatus = st === 'LOCKED' || st === 'SUBMITTED';
    }

    return matchesSearch && matchesSchedule && matchesStatus;
  });

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Breadcrumb & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/penguji')}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Kembali ke Dashboard
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Daftar Santri Ujian Al-Qur'an</h1>
            <p className="text-xs text-slate-500">
              Filter dan kelola santri binaan yang telah ditugaskan kepada Anda.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6">
          <Alert type="error" title="Perhatian" message={errorMessage} />
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama santri, nomor registrasi, sekolah..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">Filter:</span>
          </div>

          <select
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-700"
          >
            <option value="ALL">Semua Sesi Jadwal</option>
            {uniqueSchedules.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-700"
          >
            <option value="ALL">Semua Status Penilaian</option>
            <option value="NOT_STARTED">Belum Dinilai</option>
            <option value="IN_PROGRESS">Draft / Revisi</option>
            <option value="LOCKED">Selesai / Terkunci</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Tidak ada peserta yang cocok dengan filter</p>
            <p className="text-xs text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Nomor Peserta</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Asal Sekolah</th>
                  <th className="py-3 px-4">Sesi & Ruangan</th>
                  <th className="py-3 px-4 text-center">Presensi</th>
                  <th className="py-3 px-4 text-center">Status & Nilai</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((a, idx) => {
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
                        <div className="font-bold text-slate-900">{a.candidate?.full_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {a.candidate?.gender === 'L' ? 'Putra (Ikhwan)' : 'Putri (Akhwat)'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {a.candidate?.school_name || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{a.schedule?.title}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-emerald-700" />
                          <span>{a.schedule?.room} • {a.schedule?.test_date} ({a.schedule?.start_time} WIB)</span>
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
                            <ShieldCheck className="w-3 h-3" />
                            Nilai: {a.assessment?.normalized_score} (Locked)
                          </span>
                        ) : assessStatus === 'IN_PROGRESS' || assessStatus === 'NEEDS_REVISION' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            Draft ({a.assessment?.normalized_score || 0})
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Belum Dinilai</span>
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
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
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
