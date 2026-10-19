import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { quranService } from '../services/quranService';
import { scheduleService } from '../services/scheduleService';
import { candidateService } from '../services/candidateService';
import { QuranExaminerAssignment } from '../types/quran';
import { Profile, Candidate, TestSchedule } from '../types/database';
import {
  BookOpen,
  Users,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Settings,
  Plus
} from 'lucide-react';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { Modal } from '../components/Modal';

export const AdminQuranPage = ({ onNavigate }: { onNavigate: (to: string) => void }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QuranExaminerAssignment[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    submitted: 0,
    locked: 0,
    needsRevision: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [examinerFilter, setExaminerFilter] = useState('ALL');
  const [scheduleFilter, setScheduleFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Assign Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [examinersList, setExaminersList] = useState<Profile[]>([]);
  const [quranSchedules, setQuranSchedules] = useState<TestSchedule[]>([]);
  const [verifiedCandidates, setVerifiedCandidates] = useState<Candidate[]>([]);

  // Assign form state
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [selectedExaminerId, setSelectedExaminerId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const overview = await quranService.getAdminQuranOverview({
        schedule_id: scheduleFilter === 'ALL' ? undefined : scheduleFilter,
        examiner_id: examinerFilter === 'ALL' ? undefined : examinerFilter,
        status: statusFilter,
        search,
      });
      setStats(overview.stats);
      setItems(overview.items);
    } catch (err: any) {
      console.error('Error loading admin quran overview', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [scheduleFilter, examinerFilter, statusFilter, search]);

  const loadAssignModalData = async () => {
    try {
      const [exs, allSchedules, candsData] = await Promise.all([
        quranService.getExaminers(),
        scheduleService.getSchedules(),
        candidateService.getAllCandidates({ limit: 100 }),
      ]);

      const qSchedules = allSchedules.filter((s) => s.test_type?.code === 'QURAN');
      setExaminersList(exs);
      setQuranSchedules(qSchedules);
      if (qSchedules.length > 0 && !selectedScheduleId) {
        setSelectedScheduleId(qSchedules[0].id);
      }
      if (exs.length > 0 && !selectedExaminerId) {
        setSelectedExaminerId(exs[0].user_id);
      }

      // Filter eligible candidates
      const eligible = candsData.candidates.filter((c) =>
        ['TERVERIFIKASI', 'DIIZINKAN_MENGIKUTI_SELEKSI', 'MENGIKUTI_SELEKSI', 'SELESAI_SELEKSI'].includes(c.status)
      );
      setVerifiedCandidates(eligible);
      if (eligible.length > 0 && !selectedCandidateId) {
        setSelectedCandidateId(eligible[0].id);
      }
    } catch (err: any) {
      console.error('Error loading assign modal data', err);
    }
  };

  const handleOpenAssignModal = () => {
    setAssignError(null);
    setAssignModalOpen(true);
    loadAssignModalData();
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleId || !selectedCandidateId || !selectedExaminerId) {
      setAssignError('Mohon pilih jadwal Qur\'an, santri, dan ustadz penguji.');
      return;
    }

    setAssignLoading(true);
    setAssignError(null);
    try {
      const res = await quranService.assignExaminer(
        {
          schedule_id: selectedScheduleId,
          candidate_id: selectedCandidateId,
          examiner_user_id: selectedExaminerId,
          notes: assignNotes,
        },
        {
          id: user?.id || '',
          email: user?.email || '',
        }
      );

      if (res.success) {
        setAssignModalOpen(false);
        setActionSuccess('Penugasan penguji Al-Qur\'an berhasil disimpan.');
        setTimeout(() => setActionSuccess(null), 4000);
        loadOverview();
      } else {
        setAssignError(res.error || 'Gagal menyimpan penugasan.');
      }
    } catch (err: any) {
      setAssignError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setAssignLoading(false);
    }
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Monitoring Seleksi Luring: Tes Al-Qur'an</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Penilaian Al-Qur'an Santri (Tahfidz, Tajwid & Makharij)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pantau proses pengujian, penugasan penguji, nilai terkunci, dan permintaan revisi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('/admin/quran/rubrik')}
              leftIcon={<Settings className="w-3.5 h-3.5" />}
            >
              Rubrik & Bobot
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleOpenAssignModal}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
          >
            Tugaskan Penguji
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-6">
          <Alert type="success" title="Berhasil" message={actionSuccess} />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Ditugaskan</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Belum Dinilai</span>
          <div className="text-2xl font-black text-slate-600 mt-1">{stats.pending}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Draft Berjalan</span>
          <div className="text-2xl font-black text-blue-700 mt-1">{stats.inProgress}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Perlu Revisi</span>
          <div className="text-2xl font-black text-amber-700 mt-1">{stats.needsRevision}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Submitted</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{stats.submitted}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">Locked</span>
          <div className="text-2xl font-black text-purple-700 mt-1">{stats.locked}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari santri, no reg, penguji..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-700"
          >
            <option value="ALL">Semua Status</option>
            <option value="NOT_STARTED">Belum Dinilai</option>
            <option value="IN_PROGRESS">Draft</option>
            <option value="NEEDS_REVISION">Perlu Revisi</option>
            <option value="LOCKED">Terkunci (Locked)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Memuat data penilaian Al-Qur'an...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Belum Ada Data Penilaian</p>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan tombol <strong>Tugaskan Penguji</strong> untuk memulai alur pengujian Al-Qur'an santri.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Nomor Peserta</th>
                  <th className="py-3 px-4">Calon Santri</th>
                  <th className="py-3 px-4">Ustadz Penguji</th>
                  <th className="py-3 px-4">Sesi & Ruangan</th>
                  <th className="py-3 px-4 text-center">Nilai Akhir</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {items.map((it, idx) => {
                  const assess = it.assessment;
                  const st = assess?.status || 'NOT_STARTED';

                  return (
                    <tr key={it.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                          {it.candidate?.registration_number || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{it.candidate?.full_name}</div>
                        <div className="text-[11px] text-slate-400">{it.candidate?.school_name}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-medium text-slate-900">{it.examiner?.full_name || 'Ustadz Penguji'}</div>
                        <div className="text-[11px] text-slate-400">{it.examiner?.phone || '-'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div>{it.schedule?.title}</div>
                        <div className="text-[11px] text-slate-400">{it.schedule?.room} • {it.schedule?.test_date}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {assess && assess.normalized_score > 0 ? (
                          <span className="font-black text-sm text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            {assess.normalized_score}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {st === 'LOCKED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                            <ShieldCheck className="w-3 h-3" />
                            Terkunci (Locked)
                          </span>
                        ) : st === 'NEEDS_REVISION' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertCircle className="w-3 h-3" />
                            Perlu Revisi
                          </span>
                        ) : st === 'SUBMITTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" />
                            Submitted
                          </span>
                        ) : st === 'IN_PROGRESS' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            <Clock className="w-3 h-3" />
                            Draft
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            Belum Dimulai
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {assess ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigate(`/admin/quran/${assess.id}`)}
                            className="text-xs"
                          >
                            Detail Nilai
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Menunggu Penguji</span>
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

      {/* Modal Penugasan Penguji */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Penugasan Penguji Al-Qur'an Santri"
      >
        <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
          {assignError && (
            <Alert type="error" title="Gagal Menugaskan" message={assignError} />
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              1. Sesi Jadwal Tes Al-Qur'an (QURAN)
            </label>
            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            >
              {quranSchedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.test_date} • {s.room})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              2. Calon Santri (Berkas Terverifikasi)
            </label>
            <select
              value={selectedCandidateId}
              onChange={(e) => setSelectedCandidateId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            >
              {verifiedCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.registration_number} - {c.full_name} ({c.school_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              3. Ustadz Penguji Al-Qur'an
            </label>
            <select
              value={selectedExaminerId}
              onChange={(e) => setSelectedExaminerId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            >
              {examinersList.map((ex) => (
                <option key={ex.user_id} value={ex.user_id}>
                  {ex.full_name} ({ex.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Catatan Penugasan (Opsional)
            </label>
            <input
              type="text"
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              placeholder="Contoh: Fokus uji juz 30 dan fashahah huruf halqiyah..."
              className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAssignModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={assignLoading}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
            >
              Simpan Penugasan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
