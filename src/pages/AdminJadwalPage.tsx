import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { scheduleService, CreateSchedulePayload } from '../services/scheduleService';
import { candidateService } from '../services/candidateService';
import {
  TestSchedule,
  TestType,
  TestScheduleParticipant,
  Candidate,
  AttendanceStatus
} from '../types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDateIndonesian } from '../utils/formatters';
import {
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Users,
  UserPlus,
  UserMinus,
  CheckCircle,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Search,
  Check,
  X,
  Compass,
  FileCheck2,
  ArrowRight,
  BookOpen
} from 'lucide-react';

export const AdminJadwalPage: React.FC<{ onNavigate?: (to: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<TestSchedule[]>([]);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');

  // Add / Edit Schedule Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TestSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState<CreateSchedulePayload>({
    test_type_id: '',
    title: '',
    test_date: '',
    start_time: '08:00',
    end_time: '10:00',
    location: 'Kampus PPTQM Darul Hikmah',
    room: '',
    online_url: '',
    capacity: 30,
    notes: '',
  });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // View Schedule Participants Modal
  const [viewingSchedule, setViewingSchedule] = useState<TestSchedule | null>(null);
  const [participants, setParticipants] = useState<TestScheduleParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // Assign Participants Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [availableCandidates, setAvailableCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Feedback notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [types, schs] = await Promise.all([
        scheduleService.getTestTypes(),
        scheduleService.getSchedules(),
      ]);
      setTestTypes(types);
      setSchedules(schs);
      if (types.length > 0 && !scheduleForm.test_type_id) {
        setScheduleForm((prev) => ({ ...prev, test_type_id: types[0].id }));
      }
    } catch (err) {
      console.error('Failed to load schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingSchedule(null);
    setScheduleForm({
      test_type_id: testTypes[0]?.id || '',
      title: '',
      test_date: '',
      start_time: '08:00',
      end_time: '10:00',
      location: 'Kampus PPTQM Darul Hikmah',
      room: '',
      online_url: '',
      capacity: 30,
      notes: '',
    });
    setNotification(null);
    setIsScheduleModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (sch: TestSchedule) => {
    setEditingSchedule(sch);
    setScheduleForm({
      test_type_id: sch.test_type_id,
      title: sch.title,
      test_date: sch.test_date,
      start_time: sch.start_time,
      end_time: sch.end_time,
      location: sch.location,
      room: sch.room,
      online_url: sch.online_url || '',
      capacity: sch.capacity,
      notes: sch.notes || '',
    });
    setNotification(null);
    setIsScheduleModalOpen(true);
  };

  // Save Schedule (Create or Update)
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingSchedule(true);
    setNotification(null);

    const userInfo = {
      id: user.id,
      email: user.email,
      name: user.profile?.full_name || 'Panitia Seleksi',
    };

    if (editingSchedule) {
      // Update
      const res = await scheduleService.updateSchedule(editingSchedule.id, scheduleForm, userInfo);
      setIsSavingSchedule(false);
      if (res.success) {
        setNotification({ type: 'success', message: 'Sesi jadwal seleksi berhasil diperbarui.' });
        setIsScheduleModalOpen(false);
        loadAllData();
      } else {
        setNotification({ type: 'error', message: res.error || 'Gagal memperbarui jadwal.' });
      }
    } else {
      // Create
      const res = await scheduleService.createSchedule(scheduleForm, userInfo);
      setIsSavingSchedule(false);
      if (res.success) {
        setNotification({ type: 'success', message: 'Sesi jadwal seleksi baru berhasil dibuat.' });
        setIsScheduleModalOpen(false);
        loadAllData();
      } else {
        setNotification({ type: 'error', message: res.error || 'Gagal membuat jadwal.' });
      }
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (sch: TestSchedule) => {
    if (!user) return;
    if (sch.participant_count && sch.participant_count > 0) {
      setNotification({
        type: 'error',
        message: `Sesi ini tidak dapat dihapus karena telah memiliki ${sch.participant_count} peserta. Hapus peserta terlebih dahulu.`,
      });
      return;
    }

    if (!confirmAction(`Yakin ingin menghapus sesi "${sch.title}"?`)) return;

    const res = await scheduleService.deleteSchedule(sch.id, { id: user.id, email: user.email });
    if (res.success) {
      setNotification({ type: 'success', message: 'Sesi jadwal berhasil dihapus.' });
      loadAllData();
    } else {
      setNotification({ type: 'error', message: res.error || 'Gagal menghapus jadwal.' });
    }
  };

  // Open Participants Detail
  const handleOpenParticipants = async (sch: TestSchedule) => {
    setViewingSchedule(sch);
    setIsLoadingParticipants(true);
    setNotification(null);
    const data = await scheduleService.getScheduleParticipants(sch.id);
    setParticipants(data);
    setIsLoadingParticipants(false);
  };

  // Open Assign Modal
  const handleOpenAssignModal = async () => {
    if (!viewingSchedule) return;
    setSelectedCandidateIds([]);
    setCandidateSearch('');
    setIsAssignModalOpen(true);

    // Load all verified candidates
    const all = await candidateService.getAllCandidates({ limit: 1000 });
    const existingCandidateIds = new Set(participants.map((p) => p.candidate_id));

    // Filter: must be TERVERIFIKASI or later, and not already assigned to this schedule
    const eligible = all.candidates.filter((c) => {
      const isStatusEligible =
        c.status === 'TERVERIFIKASI' ||
        c.status === 'DIIZINKAN_MENGIKUTI_SELEKSI' ||
        c.status === 'MENGIKUTI_SELEKSI';
      return isStatusEligible && !existingCandidateIds.has(c.id);
    });

    setAvailableCandidates(eligible);
  };

  // Toggle selection for candidate
  const handleToggleCandidate = (id: string) => {
    if (!viewingSchedule) return;
    const currentCount = participants.length;
    const remainingSlots = viewingSchedule.capacity - currentCount;

    if (selectedCandidateIds.includes(id)) {
      setSelectedCandidateIds(selectedCandidateIds.filter((cid) => cid !== id));
    } else {
      if (selectedCandidateIds.length >= remainingSlots) {
        showToastNotification(`Kapasitas sisa hanya ${remainingSlots} peserta. Anda tidak dapat memilih lebih banyak.`);
        return;
      }
      setSelectedCandidateIds([...selectedCandidateIds, id]);
    }
  };

  // Select all eligible up to remaining capacity
  const handleSelectAllEligible = () => {
    if (!viewingSchedule) return;
    const currentCount = participants.length;
    const remainingSlots = viewingSchedule.capacity - currentCount;
    const filtered = getFilteredCandidates();
    const upToRemaining = filtered.slice(0, remainingSlots).map((c) => c.id);
    setSelectedCandidateIds(upToRemaining);
  };

  // Confirm Assign Participants
  const handleConfirmAssign = async () => {
    if (!viewingSchedule || !user || selectedCandidateIds.length === 0) return;
    setIsAssigning(true);

    const res = await scheduleService.assignParticipants({
      scheduleId: viewingSchedule.id,
      candidateIds: selectedCandidateIds,
      assignedBy: user.id,
      assignedByName: user.profile?.full_name || 'Panitia Seleksi',
      assignedByEmail: user.email,
    });

    setIsAssigning(false);

    if (res.success) {
      setNotification({
        type: 'success',
        message: `${res.assignedCount} peserta berhasil ditambahkan ke sesi "${viewingSchedule.title}".`,
      });
      setIsAssignModalOpen(false);
      // Reload participants
      const updated = await scheduleService.getScheduleParticipants(viewingSchedule.id);
      setParticipants(updated);
      loadAllData();
    } else {
      setNotification({ type: 'error', message: res.error || 'Gagal menambahkan peserta.' });
    }
  };

  // Remove Participant from Schedule
  const handleRemoveParticipant = async (candidateId: string) => {
    if (!viewingSchedule || !user) return;
    if (!confirmAction('Yakin ingin membatalkan penempatan peserta ini dari sesi?')) return;

    const res = await scheduleService.removeParticipant(viewingSchedule.id, candidateId, {
      id: user.id,
      email: user.email,
      name: user.profile?.full_name || 'Panitia',
    });

    if (res.success) {
      setNotification({ type: 'success', message: 'Peserta berhasil dikeluarkan dari sesi.' });
      const updated = await scheduleService.getScheduleParticipants(viewingSchedule.id);
      setParticipants(updated);
      loadAllData();
    } else {
      setNotification({ type: 'error', message: res.error || 'Gagal menghapus peserta.' });
    }
  };

  // Change Attendance Status
  const handleAttendanceChange = async (candidateId: string, status: AttendanceStatus) => {
    if (!viewingSchedule || !user) return;
    const res = await scheduleService.updateAttendance({
      scheduleId: viewingSchedule.id,
      candidateId,
      status,
      user: {
        id: user.id,
        email: user.email,
        name: user.profile?.full_name || 'Panitia Seleksi',
      },
    });

    if (res.success) {
      setParticipants((prev) =>
        prev.map((p) => (p.candidate_id === candidateId ? { ...p, attendance_status: status } : p))
      );
    }
  };

  const getFilteredCandidates = () => {
    let list = availableCandidates;
    if (candidateSearch.trim()) {
      const q = candidateSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.registration_number.toLowerCase().includes(q) ||
          (c.school_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  };

  // Filtered schedules for main list
  const filteredSchedules = schedules.filter((sch) => {
    if (selectedTypeFilter !== 'ALL' && sch.test_type_id !== selectedTypeFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        sch.title.toLowerCase().includes(q) ||
        sch.location.toLowerCase().includes(q) ||
        sch.room.toLowerCase().includes(q) ||
        sch.test_date.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-700" />
            Manajemen Jadwal Seleksi & Penempatan Peserta
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Atur jadwal ujian Tes Akademik, Al-Qur'an, dan Psikotes serta tetapkan nomor kursi calon santri
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadAllData}
          >
            Muat Ulang
          </Button>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreateModal}
            className="bg-emerald-700 hover:bg-emerald-800 font-bold"
          >
            Tambah Sesi Jadwal
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <Alert
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <Input
            placeholder="Cari judul sesi, ruangan, lokasi, tanggal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="w-full md:w-64">
          <Select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'Semua Jenis Seleksi' },
              ...testTypes.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner text="Memuat jadwal seleksi..." />
        ) : filteredSchedules.length === 0 ? (
          <EmptyState
            title="Belum Ada Sesi Jadwal"
            description="Silakan buat sesi jadwal baru untuk memulai penempatan peserta ujian seleksi."
            action={
              <Button size="sm" variant="primary" onClick={handleOpenCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
                Buat Sesi Pertama
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Jenis & Sesi Ujian</TableHead>
                <TableHead>Hari & Tanggal</TableHead>
                <TableHead>Waktu (WIB)</TableHead>
                <TableHead>Lokasi & Ruangan</TableHead>
                <TableHead align="center">Kapasitas & Kuota</TableHead>
                <TableHead align="center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedules.map((sch) => {
                const count = sch.participant_count || 0;
                const remaining = sch.capacity - count;
                const isFull = remaining <= 0;

                return (
                  <TableRow key={sch.id}>
                    <TableCell>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider block w-fit mb-1">
                          {sch.test_type?.name || 'Tes Seleksi'}
                        </span>
                        <span className="font-bold text-slate-900 text-sm block">
                          {sch.title}
                        </span>
                        {sch.notes && (
                          <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {sch.notes}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold">{formatDateIndonesian(sch.test_date)}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sch.start_time} - {sch.end_time}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-700">
                        <span className="font-bold text-slate-900 block">{sch.room}</span>
                        <span className="text-[11px] text-slate-500">{sch.location}</span>
                      </div>
                    </TableCell>

                    <TableCell align="center">
                      <div className="inline-flex flex-col items-center">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="font-bold text-slate-900">{count}</span>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-600">{sch.capacity}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                            isFull
                              ? 'bg-rose-100 text-rose-800'
                              : remaining <= 5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isFull ? 'Penuh' : `Sisa ${remaining} Kursi`}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell align="center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          className="bg-emerald-700 hover:bg-emerald-800 text-xs"
                          leftIcon={<Users className="w-3.5 h-3.5" />}
                          onClick={() => handleOpenParticipants(sch)}
                        >
                          Peserta ({count})
                        </Button>

                        {sch.test_type?.code === 'QURAN' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs"
                            leftIcon={<BookOpen className="w-3.5 h-3.5 text-emerald-700" />}
                            onClick={() => onNavigate?.('/admin/quran')}
                            title="Buka Penugasan & Monitoring Penguji Qur'an"
                          >
                            Penguji
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditModal(sch)}
                          aria-label="Edit Jadwal"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                        </Button>

                        <Button
                          size="sm"
                          variant="danger"
                          disabled={count > 0}
                          title={count > 0 ? 'Hapus peserta terlebih dahulu' : 'Hapus Sesi'}
                          onClick={() => handleDeleteSchedule(sch)}
                          aria-label="Hapus Jadwal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* MODAL 1: TAMBAH / EDIT JADWAL */}
      {isScheduleModalOpen && (
        <Modal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          title={editingSchedule ? 'Edit Sesi Jadwal Seleksi' : 'Tambah Sesi Jadwal Seleksi Baru'}
          subtitle="Tentukan tanggal pelaksanaan, ruang, waktu, dan kapasitas kursi"
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsScheduleModalOpen(false)}>
                Batal
              </Button>
              <Button
                size="sm"
                variant="primary"
                isLoading={isSavingSchedule}
                className="bg-emerald-700 hover:bg-emerald-800 font-bold"
                onClick={handleSaveSchedule}
              >
                {editingSchedule ? 'Simpan Perubahan' : 'Buat Sesi Jadwal'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Jenis Ujian Seleksi"
                required
                value={scheduleForm.test_type_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, test_type_id: e.target.value })}
                options={testTypes.map((t) => ({ value: t.id, label: t.name }))}
              />

              <Input
                label="Judul Sesi"
                required
                placeholder="Contoh: Tes Potensi Akademik Sesi Pagi 1"
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Tanggal Ujian"
                type="date"
                required
                value={scheduleForm.test_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, test_date: e.target.value })}
              />

              <Input
                label="Jam Mulai"
                type="time"
                required
                value={scheduleForm.start_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
              />

              <Input
                label="Jam Selesai"
                type="time"
                required
                value={scheduleForm.end_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Lokasi Kampus"
                required
                placeholder="Contoh: Kampus PPTQM Darul Hikmah Pusat"
                value={scheduleForm.location}
                onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
              />

              <Input
                label="Nama Ruangan / Gedung"
                required
                placeholder="Contoh: Ruang 201 Abu Bakar"
                value={scheduleForm.room}
                onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })}
              />

              <Input
                label="Kapasitas Maksimal (Orang)"
                type="number"
                min={1}
                max={500}
                required
                value={String(scheduleForm.capacity)}
                onChange={(e) => setScheduleForm({ ...scheduleForm, capacity: parseInt(e.target.value) || 30 })}
              />
            </div>

            <Input
              label="Catatan Khusus / Perlengkapan Bawaan"
              placeholder="Contoh: Wajib membawa pensil 2B, kartu ujian asli, dan mushaf Al-Qur'an"
              value={scheduleForm.notes}
              onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
            />
          </form>
        </Modal>
      )}

      {/* MODAL 2: DETAIL PESERTA PADA JADWAL & ASSIGN */}
      {viewingSchedule && (
        <Modal
          isOpen={Boolean(viewingSchedule)}
          onClose={() => setViewingSchedule(null)}
          title={`Daftar Peserta: ${viewingSchedule.title}`}
          subtitle={`Tanggal: ${formatDateIndonesian(viewingSchedule.test_date)} • Jam: ${viewingSchedule.start_time} - ${viewingSchedule.end_time} WIB • Ruang: ${viewingSchedule.room}`}
          maxWidth="4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-slate-500">
                Kapasitas: <strong>{viewingSchedule.capacity}</strong> • Terisi:{' '}
                <strong className="text-emerald-800">{participants.length}</strong> • Sisa:{' '}
                <strong>{Math.max(0, viewingSchedule.capacity - participants.length)} Kursi</strong>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-700 hover:bg-emerald-800"
                  disabled={participants.length >= viewingSchedule.capacity}
                  leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                  onClick={handleOpenAssignModal}
                >
                  {participants.length >= viewingSchedule.capacity ? 'Kapasitas Penuh' : 'Tambah Peserta'}
                </Button>

                <Button size="sm" variant="outline" onClick={() => setViewingSchedule(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {isLoadingParticipants ? (
              <LoadingSpinner text="Memuat daftar peserta sesi..." />
            ) : participants.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-400" />
                <p className="font-semibold text-slate-800">Belum Ada Peserta di Sesi Ini</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Klik tombol "Tambah Peserta" untuk memasukkan calon santri yang telah berstatus TERVERIFIKASI ke sesi ini.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow hoverable={false}>
                    <TableHead align="center">No. Kursi</TableHead>
                    <TableHead>No. Registrasi</TableHead>
                    <TableHead>Nama Calon Santri</TableHead>
                    <TableHead>Asal Sekolah</TableHead>
                    <TableHead>Status Kehadiran</TableHead>
                    <TableHead align="center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell align="center">
                        <span className="font-mono font-black text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          {p.seat_number}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {p.candidate?.registration_number || '-'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-bold text-xs text-slate-900">
                          {p.candidate?.full_name || '-'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-slate-600">
                          {p.candidate?.school_name || '-'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <select
                          value={p.attendance_status}
                          onChange={(e) =>
                            handleAttendanceChange(p.candidate_id, e.target.value as AttendanceStatus)
                          }
                          className="text-xs font-semibold rounded-lg border border-slate-200 bg-white py-1 px-2 focus:ring-emerald-600"
                        >
                          <option value="BELUM_HADIR">Belum Hadir</option>
                          <option value="HADIR">Hadir</option>
                          <option value="TERLAMBAT">Terlambat</option>
                          <option value="TIDAK_HADIR">Tidak Hadir</option>
                        </select>
                      </TableCell>

                      <TableCell align="center">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRemoveParticipant(p.candidate_id)}
                          aria-label="Keluarkan dari Sesi"
                          title="Keluarkan dari Sesi"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL 3: ASSIGN PESERTA DENGAN CHECKBOX */}
      {isAssignModalOpen && viewingSchedule && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title={`Pilih Peserta untuk: ${viewingSchedule.title}`}
          subtitle={`Sisa Kuota: ${viewingSchedule.capacity - participants.length} Kursi • Terpilih: ${selectedCandidateIds.length} Peserta`}
          maxWidth="4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button size="sm" variant="outline" onClick={handleSelectAllEligible}>
                Pilih Maksimal Kuota ({Math.max(0, viewingSchedule.capacity - participants.length)})
              </Button>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isAssigning}
                  disabled={selectedCandidateIds.length === 0}
                  className="bg-emerald-700 hover:bg-emerald-800 font-bold"
                  onClick={handleConfirmAssign}
                >
                  Tambahkan ke Sesi ({selectedCandidateIds.length})
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            {/* Search Input */}
            <Input
              placeholder="Cari nama, nomor registrasi, asal sekolah..."
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />

            {/* List */}
            {getFilteredCandidates().length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                Tidak ada calon santri berstatus TERVERIFIKASI yang belum terdaftar di sesi ini.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                {getFilteredCandidates().map((cand) => {
                  const isChecked = selectedCandidateIds.includes(cand.id);

                  return (
                    <label
                      key={cand.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCandidate(cand.id)}
                          className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-emerald-800">
                              {cand.registration_number}
                            </span>
                            <span className="font-bold text-xs text-slate-900">{cand.full_name}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 block">
                            {cand.school_name || 'Sekolah belum dicatat'}
                          </span>
                        </div>
                      </div>

                      <Badge status={cand.status} size="sm" />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
