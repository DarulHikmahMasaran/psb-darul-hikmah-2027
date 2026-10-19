import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { candidateService } from '../services/candidateService';
import { scheduleService } from '../services/scheduleService';
import { Candidate, AttendanceStatus } from '../types/database';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { formatDateIndonesian } from '../utils/formatters';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Printer,
  FileCheck2,
  BookOpen,
  Award,
  Users,
  Compass,
  Info,
  Play
} from 'lucide-react';

export interface PesertaJadwalPageProps {
  onNavigate: (route: string) => void;
}

export const PesertaJadwalPage: React.FC<PesertaJadwalPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [schedules, setSchedules] = useState<
    Array<{
      participantId: string;
      scheduleId: string;
      testTypeName: string;
      testTypeCode: string;
      title: string;
      test_date: string;
      start_time: string;
      end_time: string;
      location: string;
      room: string;
      online_url?: string;
      seat_number: string;
      attendance_status: AttendanceStatus;
      notes?: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadData(user.id);
    }
  }, [user?.id]);

  const loadData = async (userId: string) => {
    setIsLoading(true);
    try {
      const cand = await candidateService.getCandidateByUserId(userId);
      setCandidate(cand);
      if (cand) {
        const candSchedules = await scheduleService.getCandidateSchedules(cand.id);
        setSchedules(candSchedules);
      }
    } catch (err) {
      console.error('Failed to load candidate schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getAttendanceBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'HADIR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> HADIR
          </span>
        );
      case 'TERLAMBAT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> TERLAMBAT
          </span>
        );
      case 'TIDAK_HADIR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> TIDAK HADIR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" /> BELUM HADIR
          </span>
        );
    }
  };

  const getTypeIcon = (code: string) => {
    switch (code) {
      case 'AKADEMIK':
        return <BookOpen className="w-5 h-5 text-blue-600" />;
      case 'QURAN':
        return <Award className="w-5 h-5 text-emerald-600" />;
      case 'PSIKOTES':
        return <Users className="w-5 h-5 text-purple-600" />;
      default:
        return <Calendar className="w-5 h-5 text-teal-600" />;
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Memuat jadwal seleksi calon santri..." className="min-h-[60vh]" />;
  }

  if (!candidate) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Alert type="error" title="Data Tidak Ditemukan" message="Data pendaftar santri tidak ditemukan." />
      </div>
    );
  }

  const isVerified =
    candidate.status === 'TERVERIFIKASI' ||
    candidate.status === 'DIIZINKAN_MENGIKUTI_SELEKSI' ||
    candidate.status === 'MENGIKUTI_SELEKSI' ||
    candidate.status === 'SELESAI_SELEKSI';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/peserta/dashboard')}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            aria-label="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Jadwal Ujian Seleksi Masuk
            </h1>
            <p className="text-xs text-slate-500">
              No. Registrasi: <span className="font-mono font-bold text-emerald-800">{candidate.registration_number}</span> • {candidate.full_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isVerified && (
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate('/peserta/kartu')}
              leftIcon={<Printer className="w-4 h-4" />}
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
            >
              Buka & Cetak Kartu Peserta
            </Button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      {!isVerified && (
        <Alert
          type="info"
          title="Verifikasi Berkas Sedang Berjalan"
          message={`Status pendaftaran Anda saat ini adalah ${candidate.status}. Penjadwalan seleksi akan diberikan setelah seluruh berkas persyaratan Anda disetujui oleh panitia.`}
        />
      )}

      {/* Schedule List */}
      {schedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Calendar className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-bold text-base text-slate-900">Jadwal Belum Tersedia</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Jadwal sesi ujian seleksi Anda belum ditentukan. Panitia PSB PPTQM Darul Hikmah sedang menyusun pembagian sesi ujian. Harap periksa halaman ini secara berkala.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/peserta/dashboard')}
          >
            Kembali ke Dashboard
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Ditemukan <strong>{schedules.length}</strong> sesi ujian seleksi terdaftar</span>
            <span className="text-emerald-700 font-medium">Bawa Kartu Ujian dan alat tulis lengkap</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {schedules.map((sch) => (
              <div
                key={sch.participantId}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                        {getTypeIcon(sch.testTypeCode)}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {sch.testTypeCode}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 leading-tight">
                          {sch.testTypeName}
                        </h4>
                      </div>
                    </div>

                    <div className="text-right">
                      {getAttendanceBadge(sch.attendance_status)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs mb-3">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-semibold">{formatDateIndonesian(sch.test_date)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-mono font-semibold">{sch.start_time} - {sch.end_time} WIB</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <Compass className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900 block">{sch.room}</span>
                        <span className="text-[11px] text-slate-500">{sch.location}</span>
                      </div>
                    </div>
                  </div>

                  {sch.notes && (
                    <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 mb-3 leading-relaxed">
                      <strong>Catatan:</strong> {sch.notes}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-slate-400 block text-[10px]">Nomor Kursi:</span>
                    <span className="font-mono font-black text-sm text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {sch.seat_number}
                    </span>
                  </div>

                  {sch.testTypeCode === 'AKADEMIK' ? (
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-emerald-700 hover:bg-emerald-800 font-bold shadow-xs"
                      onClick={() => onNavigate('/peserta/cbt')}
                      leftIcon={<Play className="w-3.5 h-3.5" />}
                    >
                      Mulai Ujian CBT
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigate('/peserta/kartu')}
                      leftIcon={<Printer className="w-3.5 h-3.5" />}
                    >
                      Lihat di Kartu
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Helpful Instructions */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-2 text-xs text-slate-600">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-700" />
          Petunjuk Kehadiran Ujian Seleksi
        </h4>
        <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed text-xs">
          <li>Harap hadir di lokasi pesantren minimal 15 menit sebelum waktu tes dimulai.</li>
          <li>Setiap sesi ujian memerlukan verifikasi scan QR Code pada Kartu Peserta saat memasuki ruangan.</li>
          <li>Untuk tes Al-Qur'an, santri disarankan telah bertaharah (berwudhu) sebelum memasuki halaqah ujian.</li>
          <li>Orang tua atau wali santri wajib mendampingi pada sesi psikotes dan wawancara komitmen santri.</li>
        </ul>
      </div>
    </div>
  );
};
