import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { candidateService } from '../services/candidateService';
import { scheduleService } from '../services/scheduleService';
import { settingsService } from '../services/settingsService';
import { Candidate, CandidateStatus } from '../types/database';
import { QrCodeViewer } from '../components/QrCodeViewer';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { formatDateIndonesian, formatDateTimeIndonesian } from '../utils/formatters';
import {
  Printer,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  User,
  School,
  FileText,
  ShieldCheck,
  BookOpen,
  Award,
  Sparkles
} from 'lucide-react';

export interface PesertaKartuPageProps {
  onNavigate: (route: string) => void;
}

export const PesertaKartuPage: React.FC<PesertaKartuPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string>('');
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
      seat_number: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [printDate, setPrintDate] = useState<string>('');
  const [sysSettings, setSysSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user?.id) {
      loadCardData(user.id);
    }
  }, [user?.id]);

  const loadCardData = async (userId: string) => {
    setIsLoading(true);
    try {
      const [cand, cfg] = await Promise.all([candidateService.getCandidateByUserId(userId), settingsService.getSettings()]);
      setSysSettings(cfg);
      setCandidate(cand);

      if (cand) {
        setPrintDate(formatDateIndonesian(new Date().toISOString()));

        // Check if verified
        const isVerified = isStatusAllowedForCard(cand.status);
        if (isVerified) {
          const [photo, token, candSchedules] = await Promise.all([
            scheduleService.getCandidatePassportPhoto(cand.id),
            scheduleService.getVerificationToken(cand.id),
            scheduleService.getCandidateSchedules(cand.id),
          ]);
          setPhotoUrl(photo);
          setVerificationToken(token);
          setSchedules(candSchedules);
        }
      }
    } catch (err) {
      console.error('Failed to load exam card', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Rule: Only TERVERIFIKASI or subsequent allowed statuses can access exam card
  const isStatusAllowedForCard = (status: CandidateStatus): boolean => {
    const allowed: CandidateStatus[] = [
      'TERVERIFIKASI',
      'DIIZINKAN_MENGIKUTI_SELEKSI',
      'MENGIKUTI_SELEKSI',
      'SELESAI_SELEKSI',
      'LULUS',
      'CADANGAN',
      'DAFTAR_ULANG',
      'DITERIMA_FINAL',
    ];
    return allowed.includes(status);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <LoadingSpinner text="Menyiapkan Kartu Peserta Ujian PSB..." className="min-h-[60vh]" />;
  }

  if (!candidate) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Alert type="error" title="Data Tidak Ditemukan" message="Data pendaftar santri tidak ditemukan." />
      </div>
    );
  }

  // If candidate is NOT verified yet (DRAFT, TERDAFTAR, PERLU_PERBAIKAN)
  if (!isStatusAllowedForCard(candidate.status)) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/peserta/dashboard')}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Kartu Tanda Peserta Seleksi
            </h1>
            <p className="text-xs text-slate-500">
              No. Registrasi: <span className="font-mono font-bold text-emerald-800">{candidate.registration_number}</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg font-bold text-slate-900">Kartu Peserta Belum Tersedia</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Kartu peserta belum tersedia. Pendaftaran Anda saat ini berstatus{' '}
              <span className="font-bold text-slate-800">{candidate.status}</span> dan masih dalam proses verifikasi oleh panitia PSB PPTQM Darul Hikmah.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-lg mx-auto text-left text-xs space-y-2 text-slate-600">
            <div className="font-semibold text-slate-800">Ketentuan Penerbitan Kartu:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>Lengkapi seluruh isian biodata santri (100%).</li>
              <li>Unggah seluruh berkas persyaratan wajib (KK, Akta Kelahiran, KTP Orang Tua, Dokumen Sekolah, dan Pas Foto).</li>
              <li>Pastikan berkas telah diverifikasi dan disetujui (Status: <strong className="text-emerald-700">TERVERIFIKASI</strong>).</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => onNavigate('/peserta/dashboard')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Kembali ke Dashboard
            </Button>
            {candidate.status === 'DRAFT' || candidate.status === 'PERLU_PERBAIKAN' ? (
              <Button
                variant="primary"
                onClick={() => onNavigate('/peserta/dokumen')}
                className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              >
                Lengkapi Berkas Dokumen
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Safe QR payload: ONLY identifiers (registration_number & secure token), NO sensitive NIK / address / WA / parents
  const qrPayload = `DH-VERIFY:${candidate.registration_number}:${verificationToken || 'VALID'}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Action Bar (Hidden on print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
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
              Kartu Tanda Peserta Seleksi Masuk
            </h1>
            <p className="text-xs text-slate-500">
              Cetak atau unduh kartu ini untuk dibawa saat pelaksanaan seleksi di pesantren
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => onNavigate('/peserta/jadwal')}
            leftIcon={<Calendar className="w-4 h-4" />}
          >
            Lihat Jadwal
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
            className="bg-emerald-700 hover:bg-emerald-800 font-bold shadow-md"
          >
            Cetak Kartu Ujian (A4)
          </Button>
        </div>
      </div>

      {/* CARD CONTAINER (This element is formatted for screen preview & A4 printing) */}
      <div
        id="printable-card"
        className="bg-white rounded-2xl border-2 border-emerald-900 p-6 sm:p-8 shadow-lg text-slate-900 relative overflow-hidden"
      >
        {/* Subtle decorative background watermark */}
        <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none select-none font-serif text-8xl font-black text-emerald-900">
          DARUL HIKMAH
        </div>

        {/* 1. OFFICIAL INSTITUTION HEADER */}
        <div className="border-b-2 border-emerald-900 pb-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Institution Emblem */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-emerald-900 to-emerald-700 text-white flex items-center justify-center shrink-0 shadow-md border border-emerald-800">
              <BookOpen className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="text-[11px] sm:text-xs font-bold text-emerald-800 tracking-widest uppercase">
                Pondok Pesantren Tahfidzul Qur'an Modern (PPTQM)
              </div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900">
                DARUL HIKMAH
              </h2>
              <div className="text-xs sm:text-sm font-extrabold text-emerald-900 mt-0.5">
                KARTU TANDA PESERTA SELEKSI MASUK SANTRI BARU (PSB)
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                Tahun Pelajaran 2027/2028 • Jenjang Sekolah Menengah Pertama (SMP)
              </div>
            </div>

            {/* Verification Badge */}
            <div className="hidden sm:flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-50 border border-emerald-300 shrink-0">
              <ShieldCheck className="w-7 h-7 text-emerald-700 mb-0.5" />
              <span className="text-[10px] font-black text-emerald-900 tracking-wider">RESMI & VALID</span>
              <span className="text-[9px] font-mono text-emerald-700">{candidate.registration_number}</span>
            </div>
          </div>
        </div>

        {/* 2. CANDIDATE BIO & PAS FOTO SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* PAS FOTO (Left Column) */}
          <div className="flex flex-col items-center justify-start text-center">
            <div className="w-36 h-48 sm:w-40 sm:h-52 rounded-xl border-2 border-slate-300 bg-slate-50 overflow-hidden shadow-inner flex items-center justify-center relative">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={`Pasfoto ${candidate.full_name}`}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="p-3 text-center text-slate-400">
                  <User className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <span className="text-[11px] font-medium leading-tight block">
                    Foto peserta belum tersedia
                  </span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-slate-900/70 text-white text-[9px] py-0.5 text-center font-mono">
                Ukuran 3 x 4
              </div>
            </div>
            <div className="mt-2 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                {candidate.gender === 'L' ? 'Santri Putra' : 'Santri Putri'}
              </span>
            </div>
          </div>

          {/* BIO DETAILS (Middle 2 Columns) */}
          <div className="md:col-span-2 space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-0.5">
                Nomor Peserta Resmi
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-emerald-950 tracking-wider">
                {candidate.registration_number}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Nama Lengkap</span>
                <span className="font-bold text-slate-900 text-sm">{candidate.full_name}</span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Nomor Induk Siswa Nasional (NISN)</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {candidate.nisn || '-'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Tempat, Tanggal Lahir</span>
                <span className="font-semibold text-slate-800">
                  {candidate.birth_place ? `${candidate.birth_place}, ` : ''}
                  {candidate.birth_date ? formatDateIndonesian(candidate.birth_date) : '-'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Asal Sekolah (SD / MI)</span>
                <span className="font-semibold text-slate-800">
                  {candidate.school_name || '-'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 sm:col-span-2">
                <span className="text-[10px] text-slate-400 block">Status Kelengkapan Berkas</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> TERVERIFIKASI & MEMENUHI SYARAT
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* QR CODE (Right Column) */}
          <div className="flex flex-col items-center justify-between text-center border-l-0 md:border-l border-slate-200 pl-0 md:pl-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
                QR Presensi Ujian
              </span>
              <div className="p-2 bg-white rounded-xl border border-slate-200 inline-block shadow-xs">
                <QrCodeViewer value={qrPayload} size={130} />
              </div>
              <p className="text-[10px] text-slate-500 max-w-[140px] mx-auto leading-tight mt-1">
                Pindai di meja panitia saat memasuki ruang tes seleksi
              </p>
            </div>

            <div className="text-[10px] text-slate-400 font-mono mt-2">
              Dicetak: {printDate}
            </div>
          </div>
        </div>

        {/* 3. JADWAL SESI UJIAN SELEKSI */}
        <div className="border-t border-slate-200 pt-4 mb-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-700" />
            Jadwal & Lokasi Ujian Seleksi Calon Santri
          </h3>

          {schedules.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Sesi Ujian Sedang Disusun Panitia</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Jadwal spesifik (ruangan & nomor kursi) akan ditampilkan di sini setelah panitia menyelesaikan plotting sesi.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-emerald-900 text-white text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Materi Seleksi</th>
                    <th className="py-2 px-3">Hari / Tanggal</th>
                    <th className="py-2 px-3">Waktu</th>
                    <th className="py-2 px-3">Lokasi & Ruangan</th>
                    <th className="py-2 px-3 text-center">No. Kursi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {schedules.map((sch, i) => (
                    <tr key={sch.participantId || i} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {sch.testTypeName}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">
                        {formatDateIndonesian(sch.test_date)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                        {sch.start_time} - {sch.end_time} WIB
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        <span className="font-semibold text-slate-900">{sch.room}</span>
                        <span className="text-[11px] text-slate-500 block">{sch.location}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-800 bg-emerald-50/50">
                        {sch.seat_number}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. TATA TERTIB & TANDA TANGAN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-200 pt-4 text-xs">
          {/* Rules (2 cols) */}
          <div className="md:col-span-2 space-y-1.5 text-slate-600">
            <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
              Tata Tertib & Petunjuk Pelaksanaan Ujian:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 leading-relaxed">
              <li>Membawa <strong>Kartu Peserta Ujian Asli</strong> ini saat hadir di lokasi pesantren.</li>
              <li>Hadir di lokasi ujian paling lambat <strong>15 menit sebelum</strong> sesi pertama dimulai.</li>
              <li>Berbusana muslim rapi dan sopan (Putra: kemeja/koko, celana panjang, berpeci; Putri: gamis longgar, berjilbab syar'i).</li>
              <li>Membawa alat tulis (pensil 2B, penghapus, pulpen) dan mushaf Al-Qur'an untuk tes tilawah & hafalan.</li>
              <li>Orang tua/wali wajib hadir mendampingi calon santri untuk sesi wawancara kesiapan mondok.</li>
            </ol>
          </div>

          {/* Signature Block (1 col) */}
          <div className="text-center flex flex-col justify-between pt-2 md:pt-0">
            <div className="text-[11px] text-slate-600">
              {sysSettings.committee_city || 'Surakarta'}, {printDate}
              <div className="font-semibold text-slate-800">Ketua Panitia PSB 2027/2028</div>
            </div>

            <div className="my-3 flex items-center justify-center">
              <div className="w-20 h-10 border-b border-dashed border-slate-300 flex items-center justify-center text-[10px] text-emerald-800 font-serif italic">
                (Ttd & Stempel Panitia)
              </div>
            </div>

            <div className="text-xs font-bold text-slate-900 underline">
              Ustadz Ridwan Robbani, S.Pd
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              NIP. 19890412.201402.1.002
            </div>
          </div>
        </div>

        {/* Security watermark footer */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Sistem Resmi PSB Online PPTQM Darul Hikmah TP 2027/2028</span>
          <span>Dokumen ID: {candidate.id.slice(0, 8)}-{candidate.registration_number}</span>
        </div>
      </div>
    </div>
  );
};
