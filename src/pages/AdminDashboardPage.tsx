import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { candidateService } from '../services/candidateService';
import { Candidate, CandidateStatus, CandidateStatusHistory } from '../types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { Pagination } from '../components/Pagination';
import { LoadingSpinner } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDateIndonesian, formatDateTimeIndonesian } from '../utils/formatters';
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  UserCheck,
  Edit,
  Eye,
  RefreshCw,
  School,
  MapPin,
  Calendar,
  Send,
  FolderOpen,
  FileCheck2
} from 'lucide-react';

export interface AdminDashboardPageProps {
  onNavigate?: (route: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Selected candidate modal
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateHistory, setCandidateHistory] = useState<CandidateStatusHistory[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<CandidateStatus>('TERVERIFIKASI');
  const [statusNote, setStatusNote] = useState('');
  const [feedbackAlert, setFeedbackAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    terdaftar: 0,
    perluPerbaikan: 0,
    terverifikasi: 0,
    diizinkanSeleksi: 0,
  });

  const loadData = async () => {
    setIsLoading(true);
    const result = await candidateService.getAllCandidates({
      search,
      status: statusFilter,
      page: currentPage,
      limit: pageSize,
    });

    setCandidates(result.candidates);
    setTotalCount(result.total);

    // Compute stats from all candidates
    const all = await candidateService.getAllCandidates({ limit: 1000 });
    const allList = all.candidates;
    setStats({
      total: all.total,
      draft: allList.filter((c) => c.status === 'DRAFT').length,
      terdaftar: allList.filter((c) => c.status === 'TERDAFTAR').length,
      perluPerbaikan: allList.filter((c) => c.status === 'PERLU_PERBAIKAN').length,
      terverifikasi: allList.filter((c) => c.status === 'TERVERIFIKASI').length,
      diizinkanSeleksi: allList.filter((c) => c.status === 'DIIZINKAN_MENGIKUTI_SELEKSI').length,
    });

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, currentPage]);

  const handleOpenDetail = async (c: Candidate) => {
    setSelectedCandidate(c);
    setNewStatus(c.status);
    setStatusNote('');
    setFeedbackAlert(null);
    const hist = await candidateService.getStatusHistory(c.id);
    setCandidateHistory(hist);
  };

  const handleUpdateStatus = async () => {
    if (!selectedCandidate || !user) return;
    if (newStatus === selectedCandidate.status && !statusNote) {
      setFeedbackAlert({ type: 'error', message: 'Silakan pilih status baru atau masukkan catatan.' });
      return;
    }

    if (newStatus === 'PERLU_PERBAIKAN' && !statusNote.trim()) {
      setFeedbackAlert({ type: 'error', message: 'Wajib memberikan catatan perbaikan agar calon santri mengetahui bagian mana yang perlu diperbaiki.' });
      return;
    }

    if (!isSuperAdmin && ['LULUS', 'CADANGAN', 'TIDAK_LULUS'].includes(newStatus)) {
      setFeedbackAlert({
        type: 'error',
        message: 'Akses Ditolak: Hanya SUPER_ADMIN yang berwenang menetapkan status kelulusan santri (LULUS / CADANGAN / TIDAK LULUS).',
      });
      return;
    }

    setIsUpdatingStatus(true);
    const res = await candidateService.updateCandidateStatus({
      candidateId: selectedCandidate.id,
      newStatus,
      note: statusNote.trim() || `Status diubah menjadi ${newStatus} oleh ${isSuperAdmin ? 'Super Admin' : 'Panitia PSB'}`,
      changedBy: user.id,
      changedByName: user.profile?.full_name || (isSuperAdmin ? 'Super Admin' : 'Panitia PSB'),
      changedByEmail: user.email,
      userRole: role || undefined,
    });
    setIsUpdatingStatus(false);

    if (res.success) {
      setFeedbackAlert({ type: 'success', message: 'Status kandidat berhasil diperbarui!' });
      // Refresh current candidate & list
      const updated = await candidateService.getCandidateById(selectedCandidate.id);
      if (updated) setSelectedCandidate(updated);
      const hist = await candidateService.getStatusHistory(selectedCandidate.id);
      setCandidateHistory(hist);
      loadData();
    } else {
      setFeedbackAlert({ type: 'error', message: res.error || 'Gagal mengubah status.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Panel Verifikasi & Pendaftar PSB
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pondok Pesantren Tahfidzul Qur'an Modern Darul Hikmah • Jenjang SMP TP 2027/2028
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800"
              leftIcon={<FileCheck2 className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('/admin/verifikasi-dokumen')}
            >
              Verifikasi Berkas Dokumen
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => loadData()}
          >
            Segarkan Data
          </Button>
        </div>
      </div>

      {/* 1. KARTU STATISTIK PENDAFTAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Total Pendaftar</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-1">Calon Santri Baru</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Draft</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-700">{stats.draft}</div>
          <div className="text-[10px] text-slate-400 mt-1">Belum Kirim Final</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-blue-600">Terdaftar</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.terdaftar}</div>
          <div className="text-[10px] text-blue-500 mt-1">Perlu Verifikasi</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-amber-600">Perlu Perbaikan</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">{stats.perluPerbaikan}</div>
          <div className="text-[10px] text-amber-600 mt-1">Menunggu Peserta</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-emerald-600">Terverifikasi</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.terverifikasi}</div>
          <div className="text-[10px] text-emerald-600 mt-1">Berkas Valid</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-indigo-600">Siap Tes Seleksi</span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{stats.diizinkanSeleksi}</div>
          <div className="text-[10px] text-indigo-600 mt-1">Diizinkan Tes</div>
        </div>
      </div>

      {/* 2. PENCARIAN & FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <Input
            placeholder="Cari No. Registrasi, Nama, NISN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-56">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Semua Status Pendaftar' },
                { value: 'DRAFT', label: 'DRAFT (Belum Submit)' },
                { value: 'TERDAFTAR', label: 'TERDAFTAR (Menunggu Cek)' },
                { value: 'PERLU_PERBAIKAN', label: 'PERLU PERBAIKAN' },
                { value: 'TERVERIFIKASI', label: 'TERVERIFIKASI' },
                { value: 'DIIZINKAN_MENGIKUTI_SELEKSI', label: 'DIIZINKAN TES' },
                { value: 'LULUS', label: 'LULUS SELEKSI' },
                { value: 'CADANGAN', label: 'CADANGAN' },
                { value: 'TIDAK_LULUS', label: 'TIDAK LULUS' },
              ]}
            />
          </div>

          {(search || statusFilter !== 'ALL') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
            >
              Reset Filter
            </Button>
          )}
        </div>
      </div>

      {/* 3. TABEL DATA CALON SANTRI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner text="Memuat daftar calon santri..." />
        ) : candidates.length === 0 ? (
          <EmptyState
            title="Tidak Ada Calon Santri Ditemukan"
            description="Tidak ada pendaftar yang cocok dengan filter atau kata kunci pencarian saat ini."
          />
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>No. Registrasi</TableHead>
                  <TableHead>Nama Calon Santri</TableHead>
                  <TableHead>NISN & NIK</TableHead>
                  <TableHead>Asal Sekolah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal Pendaftaran</TableHead>
                  <TableHead align="center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="font-mono font-bold text-emerald-800 text-xs bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        {c.registration_number}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div>
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{c.full_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.gender === 'L' ? 'Putra' : c.gender === 'P' ? 'Putri' : '-'} • {c.birth_place || '-'}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-mono text-xs text-slate-700">
                        <div>NISN: {c.nisn || '-'}</div>
                        <div className="text-slate-400 text-[11px]">NIK: {c.nik || '-'}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-800 font-medium">
                        {c.school_name || <span className="text-slate-400 italic">Belum diisi</span>}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge status={c.status} size="sm" />
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-slate-600">
                        {formatDateIndonesian(c.created_at)}
                      </span>
                    </TableCell>

                    <TableCell align="center">
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => handleOpenDetail(c)}
                      >
                        Periksa & Verifikasi
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              currentPage={currentPage}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </div>

      {/* 4. MODAL DETAIL & VERIFIKASI PESERTA */}
      {selectedCandidate && (
        <Modal
          isOpen={Boolean(selectedCandidate)}
          onClose={() => setSelectedCandidate(null)}
          title={`Detail Calon Santri: ${selectedCandidate.full_name}`}
          subtitle={`Nomor Registrasi: ${selectedCandidate.registration_number}`}
          maxWidth="4xl"
          footer={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <span className="text-xs text-slate-500">
                Terdaftar sejak: {formatDateTimeIndonesian(selectedCandidate.created_at)}
              </span>
              <div className="flex items-center gap-2">
                {onNavigate && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-800"
                    leftIcon={<FileCheck2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setSelectedCandidate(null);
                      onNavigate('/admin/verifikasi-dokumen');
                    }}
                  >
                    Buka Verifikasi Berkas (KK, Akta, dll)
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setSelectedCandidate(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {feedbackAlert && (
              <Alert
                type={feedbackAlert.type}
                message={feedbackAlert.message}
                onClose={() => setFeedbackAlert(null)}
              />
            )}

            {/* Verification Action Panel for Panitia / Admin */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Ubah Status & Verifikasi Berkas Santri
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="sm:col-span-1">
                  <Select
                    label="Pilih Status Baru"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as CandidateStatus)}
                    options={[
                      { value: 'DRAFT', label: 'DRAFT' },
                      { value: 'TERDAFTAR', label: 'TERDAFTAR' },
                      { value: 'PERLU_PERBAIKAN', label: 'PERLU PERBAIKAN' },
                      { value: 'TERVERIFIKASI', label: 'TERVERIFIKASI (Berkas Valid)' },
                      { value: 'DIIZINKAN_MENGIKUTI_SELEKSI', label: 'DIIZINKAN TES SELEKSI' },
                      ...(isSuperAdmin
                        ? [
                            { value: 'LULUS', label: 'LULUS (Khusus Super Admin)' },
                            { value: 'CADANGAN', label: 'CADANGAN (Khusus Super Admin)' },
                            { value: 'TIDAK_LULUS', label: 'TIDAK LULUS (Khusus Super Admin)' },
                          ]
                        : []),
                      { value: 'BATAL', label: 'BATAL' },
                    ]}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="Catatan Verifikasi / Alasan Perbaikan"
                    placeholder="Contoh: NIK dan NISN telah terverifikasi valid / Mohon upload ulang foto KK yang lebih jelas"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    helperText={newStatus === 'PERLU_PERBAIKAN' ? 'Wajib diisi jika status Perlu Perbaikan' : 'Opsional, akan tercatat di riwayat santri'}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleUpdateStatus}
                  isLoading={isUpdatingStatus}
                  rightIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Simpan Perubahan Status
                </Button>
              </div>
            </div>

            {/* Candidate Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Data Pribadi */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h5 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-emerald-800">
                  <UserCheck className="w-3.5 h-3.5" /> 1. Data Pribadi
                </h5>
                <div className="space-y-1.5">
                  <div><strong>Nama:</strong> {selectedCandidate.full_name}</div>
                  <div><strong>NIK:</strong> <span className="font-mono">{selectedCandidate.nik || '-'}</span></div>
                  <div><strong>NISN:</strong> <span className="font-mono">{selectedCandidate.nisn || '-'}</span></div>
                  <div><strong>TTL:</strong> {selectedCandidate.birth_place || '-'}, {formatDateIndonesian(selectedCandidate.birth_date)}</div>
                  <div><strong>Jenis Kelamin:</strong> {selectedCandidate.gender === 'L' ? 'Laki-laki (Putra)' : selectedCandidate.gender === 'P' ? 'Perempuan (Putri)' : '-'}</div>
                  <div><strong>Agama:</strong> {selectedCandidate.religion || 'Islam'}</div>
                </div>
              </div>

              {/* Data Sekolah */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h5 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-emerald-800">
                  <School className="w-3.5 h-3.5" /> 2. Data Sekolah Asal
                </h5>
                <div className="space-y-1.5">
                  <div><strong>Nama SD/MI:</strong> {selectedCandidate.school_name || '-'}</div>
                  <div><strong>NPSN:</strong> {selectedCandidate.school_npsn || '-'}</div>
                  <div><strong>NIS Sekolah:</strong> {selectedCandidate.school_nis || '-'}</div>
                </div>
              </div>

              {/* Alamat */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h5 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-emerald-800">
                  <MapPin className="w-3.5 h-3.5" /> 3. Alamat Domisili
                </h5>
                <div className="space-y-1.5">
                  <div><strong>Alamat:</strong> {selectedCandidate.address || '-'}</div>
                  <div><strong>Desa/Kecamatan:</strong> {selectedCandidate.village || '-'} / {selectedCandidate.district || '-'}</div>
                  <div><strong>Kab/Kota & Prov:</strong> {selectedCandidate.regency || '-'}, {selectedCandidate.province || '-'}</div>
                  <div><strong>Kode Pos:</strong> {selectedCandidate.postal_code || '-'}</div>
                </div>
              </div>

              {/* Data Orang Tua / Wali */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h5 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-emerald-800">
                  <Users className="w-3.5 h-3.5" /> 4. Data Orang Tua / Wali
                </h5>
                <div className="space-y-1.5">
                  <div><strong>Ayah:</strong> {selectedCandidate.father_name || '-'} ({selectedCandidate.father_occupation || '-'})</div>
                  <div><strong>NIK Ayah:</strong> <span className="font-mono">{selectedCandidate.father_nik || '-'}</span></div>
                  <div><strong>Ibu:</strong> {selectedCandidate.mother_name || '-'} ({selectedCandidate.mother_occupation || '-'})</div>
                  <div><strong>NIK Ibu:</strong> <span className="font-mono">{selectedCandidate.mother_nik || '-'}</span></div>
                  <div><strong>No. WA Wali:</strong> <span className="font-mono">{selectedCandidate.guardian_phone || '-'}</span></div>
                  <div><strong>Anak ke / Dari:</strong> {selectedCandidate.child_order || '-'} dari {selectedCandidate.sibling_count || '-'} bersaudara</div>
                  <div><strong>Status Tinggal:</strong> {selectedCandidate.living_status || '-'}</div>
                </div>
              </div>
            </div>

            {/* Riwayat Status */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h5 className="font-bold text-slate-900 mb-3 flex items-center gap-1.5 text-xs">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                Riwayat Perubahan Status (Candidate Status History)
              </h5>
              {candidateHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada riwayat tercatat.</p>
              ) : (
                <div className="space-y-2">
                  {candidateHistory.map((h, idx) => (
                    <div
                      key={h.id || idx}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge status={h.new_status} size="sm" />
                          <span className="text-[11px] text-slate-400">
                            {formatDateTimeIndonesian(h.created_at)}
                          </span>
                        </div>
                        {h.note && <p className="text-slate-700 font-medium">{h.note}</p>}
                        {h.changed_by_name && (
                          <p className="text-[10px] text-slate-400 mt-0.5">Oleh: {h.changed_by_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
