import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { candidateService } from '../services/candidateService';
import { documentService } from '../services/documentService';
import { scheduleService } from '../services/scheduleService';
import { settingsService } from '../services/settingsService';
import { selectionScoringService } from '../services/selectionScoringService';
import { Candidate, CandidateStatusHistory, CandidateNotification } from '../types/database';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { calculateBiodataProgress } from '../utils/progress';
import { formatDateIndonesian, formatDateTimeIndonesian } from '../utils/formatters';
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Printer,
  Phone,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  User,
  GraduationCap,
  Home,
  Users,
  FolderOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Compass,
  Bell,
  Play,
  Sparkles,
  Brain
} from 'lucide-react';

export interface PesertaDashboardPageProps {
  onNavigate: (route: string) => void;
}

export const PesertaDashboardPage: React.FC<PesertaDashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [history, setHistory] = useState<CandidateStatusHistory[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<CandidateNotification[]>([]);
  const [docSummary, setDocSummary] = useState<{
    totalRequiredTypes: number;
    uploadedRequiredTypes: number;
    isAllRequiredUploaded: boolean;
    isAllRequiredAccepted: boolean;
    hasRejected: boolean;
    totalDocs: number;
    acceptedDocs: number;
    rejectedDocs: number;
    pendingDocs: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sysSettings, setSysSettings] = useState<Record<string, string>>({});
  const [selectionResult, setSelectionResult] = useState<any | null>(null);
  const [isConfirmingDaftarUlang, setIsConfirmingDaftarUlang] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadData(user.id);
    }
  }, [user?.id]);

  const loadData = async (userId: string) => {
    setIsLoading(true);
    const cand = await candidateService.getCandidateByUserId(userId);
    setCandidate(cand);
    if (cand?.id) {
      const [hist, docs, candSchedules, candNotifs, cfg, runs] = await Promise.all([
        candidateService.getStatusHistory(cand.id),
        documentService.getCandidateDocumentSummary(cand.id),
        scheduleService.getCandidateSchedules(cand.id),
        scheduleService.getCandidateNotifications(cand.id),
        settingsService.getSettings(),
        selectionScoringService.getSelectionRuns(),
      ]);
      setHistory(hist);
      setDocSummary(docs);
      setSchedules(candSchedules);
      setNotifications(candNotifs);
      setSysSettings(cfg);
      const activeRun = runs.find((r: any) => r.is_current && r.status === 'APPROVED') || runs.find((r: any) => r.status === 'APPROVED') || runs[0];
      if (activeRun) {
        try {
          const allRes = await selectionScoringService.getSelectionResults(activeRun.id);
          const myRes = allRes.find((r: any) => r.candidate_id === cand.id);
          setSelectionResult(myRes || null);
        } catch {
          setSelectionResult(null);
        }
      }
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return <LoadingSpinner text="Memuat data pendaftaran santri..." className="min-h-[60vh]" />;
  }

  if (!candidate) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <Alert
          type="error"
          title="Data Pendaftar Tidak Ditemukan"
          message="Akun Anda belum terhubung dengan data pendaftar santri. Silakan hubungi panitia PSB."
        />
      </div>
    );
  }

  const progress = calculateBiodataProgress(candidate);
  // Stage 1 baseline for document readiness: 75% if verified or registered, 50% if draft
  const docProgress = candidate.status === 'TERVERIFIKASI' ? 100 : candidate.status === 'TERDAFTAR' ? 70 : 40;

  const isEditable = candidate.status === 'DRAFT' || candidate.status === 'PERLU_PERBAIKAN';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header Card with Reg Number and Quick Info */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl text-white p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 transform skew-x-12 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-semibold backdrop-blur-xs">
              <span>PSB PPTQM Darul Hikmah TP 2027/2028</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ahlan Wa Sahlan, {candidate.full_name}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 flex items-center gap-2">
              <span>Jenjang: <strong>SMP (Kelas 7)</strong></span>
              <span>•</span>
              <span>Asal Sekolah: <strong>{candidate.school_name || 'Belum diisi'}</strong></span>
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-center sm:text-right shrink-0">
            <div className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wider mb-1">
              Nomor Pendaftaran Resmi
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-amber-300">
              {candidate.registration_number}
            </div>
            <div className="mt-2 flex sm:justify-end justify-center">
              <Badge status={candidate.status} size="md" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Status Alert Notification */}
      {/* Simulation Quick Status Bar (Only visible when public_demo_controls !== 'false') */}
      {sysSettings.public_demo_controls !== 'false' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-950 font-bold">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Simulasi Pengumuman Status Santri (Mode Evaluasi):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['TERVERIFIKASI', 'LULUS', 'CADANGAN', 'TIDAK_LULUS', 'DAFTAR_ULANG', 'DITERIMA_FINAL'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={async () => {
                  await candidateService.updateCandidateStatus({
                    candidateId: candidate.id,
                    newStatus: st as any,
                    changedBy: 'usr-super-admin',
                    changedByName: 'Simulasi Panitia PSB',
                    note: `Simulasi perubahan status ke ${st}`
                  });
                  if (user?.id) loadData(user.id);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer border ${
                  candidate.status === st
                    ? 'bg-emerald-800 text-white border-emerald-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Official Graduation / Selection Result Announcement Card */}
      {(candidate.status === 'LULUS' || candidate.status === 'DAFTAR_ULANG' || candidate.status === 'DITERIMA_FINAL') && (
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-emerald-400/50 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/15 pb-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider">
                <GraduationCap className="w-4 h-4" /> PENGUMUMAN RESMI KELULUSAN SELEKSI PSB
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Alhamdulillah, Selamat! Anda Dinyatakan LULUS Seleksi Masuk
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed max-w-2xl">
                Berdasarkan Keputusan Sidang Pleno Panitia Penerimaan Santri Baru {sysSettings.school_name || 'PPTQM Darul Hikmah'} Tahun Pelajaran {sysSettings.psb_year || '2027/2028'}, calon santri atas nama <strong>{candidate.full_name}</strong> ({candidate.registration_number}) dinyatakan <strong>DITERIMA / LULUS UTAMA</strong>.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">Nilai Akhir Seleksi</span>
              <span className="text-3xl font-black font-mono text-amber-300">
                {selectionResult?.display_final_score || '86.45'}
              </span>
              <span className="text-[11px] text-emerald-100 block mt-0.5">
                {selectionResult?.eligible_rank ? `Peringkat #${selectionResult.eligible_rank}` : 'Lulus Kuota Utama'}
              </span>
            </div>
          </div>

          {/* Daftar Ulang Instructions & Bank Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 space-y-2">
              <h4 className="font-bold text-amber-300 text-sm">Prosedur Daftar Ulang Santri Baru:</h4>
              <ol className="list-decimal list-inside space-y-1 text-emerald-50 leading-relaxed">
                <li>Melakukan pembayaran biaya Daftar Ulang sebesar <strong>Rp {Number(sysSettings.reregistration_fee || 4500000).toLocaleString('id-ID')}</strong>.</li>
                <li>Transfer ke rekening resmi <strong>{sysSettings.bank_name || 'Bank Syariah Indonesia (BSI)'}</strong> No. Rek: <strong className="font-mono text-amber-300">{sysSettings.bank_account_number || '7123456789'}</strong> a.n. <strong>{sysSettings.bank_account_holder || 'Yayasan PPTQM Darul Hikmah'}</strong>.</li>
                <li>Unggah bukti transfer pada menu <strong>Kelola Berkas &rarr; Bukti Pembayaran Daftar Ulang</strong>, lalu klik tombol <strong>Konfirmasi Daftar Ulang</strong>.</li>
              </ol>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 flex flex-col justify-between gap-3">
              <div>
                <span className="text-[11px] text-emerald-200 font-bold uppercase block">Status Daftar Ulang Saat Ini</span>
                <div className="text-base font-extrabold text-white mt-1">
                  {candidate.status === 'DITERIMA_FINAL'
                    ? '✓ DITERIMA FINAL (RESMI MENJADI SANTRI)'
                    : candidate.status === 'DAFTAR_ULANG'
                    ? '⏳ PENGAJUAN DAFTAR ULANG SEDANG DIVERIFIKASI PANITIA'
                    : '📌 MENUNGGU KONFIRMASI DAFTAR ULANG'}
                </div>
                <p className="text-[11px] text-emerald-100 mt-1">
                  Pastikan Anda mengunggah bukti transfer daftar ulang sebelum batas waktu yang ditetapkan.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate('/peserta/dokumen')}
                  className="bg-white text-emerald-950 hover:bg-emerald-50 font-bold text-xs"
                >
                  Unggah Bukti Daftar Ulang
                </Button>
                {candidate.status === 'LULUS' && (
                  <Button
                    size="sm"
                    variant="primary"
                    isLoading={isConfirmingDaftarUlang}
                    onClick={async () => {
                      setIsConfirmingDaftarUlang(true);
                      await candidateService.updateCandidateStatus({
                        candidateId: candidate.id,
                        newStatus: 'DAFTAR_ULANG',
                        changedBy: user?.id || candidate.user_id,
                        changedByName: candidate.full_name,
                        note: 'Calon santri mengajukan konfirmasi Daftar Ulang.'
                      });
                      setIsConfirmingDaftarUlang(false);
                      if (user?.id) loadData(user.id);
                    }}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs"
                  >
                    Konfirmasi Sudah Daftar Ulang
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  className="border-white/40 text-white hover:bg-white/10 text-xs"
                >
                  Cetak Bukti Kelulusan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {candidate.status === 'CADANGAN' && (
        <Alert
          type="warning"
          title="Pengumuman Hasil Seleksi: LULUS CADANGAN (Daftar Tunggu)"
          message={`Ananda ${candidate.full_name} (${candidate.registration_number}) saat ini berada pada daftar LULUS CADANGAN. Panitia PSB akan menghubungi nomor WhatsApp wali santri apabila terdapat kuota utama yang kosong setelah batas akhir daftar ulang.`}
        />
      )}

      {candidate.status === 'TIDAK_LULUS' && (
        <Alert
          type="error"
          title="Pemberitahuan Hasil Seleksi Akhir PSB"
          message={`Terima kasih atas partisipasi Ananda ${candidate.full_name} dalam rangkaian seleksi PSB ${sysSettings.school_name || 'PPTQM Darul Hikmah'}. Berdasarkan keterbatasan kuota tahun pelajaran ${sysSettings.psb_year || '2027/2028'}, Ananda belum dapat diterima pada periode ini. Semoga Allah SWT senantiasa memberikan keberkahan ilmu di tempat pendidikan terbaik.`}
        />
      )}

      {docSummary?.hasRejected && (
        <Alert
          type="error"
          title="Perhatian: Terdapat Dokumen yang Perlu Diperbaiki"
          message={
            <div>
              <p>Panitia telah menolak sebagian berkas persyaratan Anda. Silakan periksa catatan penolakan dan unggah ulang berkas yang diminta.</p>
              <div className="mt-3">
                <Button size="sm" variant="danger" onClick={() => onNavigate('/peserta/dokumen')}>
                  Perbaiki Dokumen Sekarang
                </Button>
              </div>
            </div>
          }
        />
      )}

      {candidate.status === 'PERLU_PERBAIKAN' && !docSummary?.hasRejected && (
        <Alert
          type="warning"
          title="Perhatian: Formulir Pendaftaran Perlu Perbaikan"
          message={
            <div>
              <p>Panitia telah memeriksa data Anda dan memerlukan perbaikan atau klarifikasi data.</p>
              {history[0]?.note && (
                <div className="mt-2 p-2.5 bg-amber-100/70 rounded-lg text-amber-900 font-medium text-xs">
                  Catatan Panitia: "{history[0].note}"
                </div>
              )}
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => onNavigate('/peserta/biodata')}>
                  Perbaiki Biodata Sekarang
                </Button>
              </div>
            </div>
          }
        />
      )}

      {candidate.status === 'TERVERIFIKASI' && (
        <Alert
          type="success"
          title="Selamat! Berkas dan Biodata Anda Telah Terverifikasi"
          message="Pendaftaran Anda telah diperiksa dan dinyatakan VALID oleh panitia PSB PPTQM Darul Hikmah. Simpan kartu pendaftaran Anda dan nantikan informasi tes seleksi."
        />
      )}

      {candidate.status === 'TERDAFTAR' && !docSummary?.hasRejected && (
        <Alert
          type="info"
          title="Pendaftaran Berhasil Dikirim (Menunggu Verifikasi Panitia)"
          message="Terima kasih telah melengkapi data dan berkas pendaftaran. Panitia sedang memverifikasi isian biodata dan dokumen Anda secara bertahap."
        />
      )}

      {/* Unread Notifications Banner */}
      {notifications.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-slate-900">{notifications[0].title}</h4>
            <p className="text-slate-600 mt-0.5 leading-relaxed">{notifications[0].message}</p>
          </div>
        </div>
      )}

      {/* CBT ONLINE EXAM BANNER (If verified & has academic schedule or eligible) */}
      {(candidate.status === 'TERVERIFIKASI' || candidate.status === 'DIIZINKAN_MENGIKUTI_SELEKSI') && (
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-emerald-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden">
          <div className="space-y-1.5 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Computer Based Test (CBT) Online
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Ujian Seleksi Potensi Akademik 2027/2028
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-xl leading-relaxed">
              Materi Matematika, Bahasa Indonesia, IPA, PAI, dan Pengetahuan Umum. Pastikan koneksi internet stabil sebelum menekan tombol mulai ujian.
            </p>
          </div>

          <Button
            size="lg"
            variant="primary"
            className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black shrink-0 shadow-lg text-sm px-6 py-3 z-10"
            onClick={() => onNavigate('/peserta/cbt')}
            leftIcon={<Play className="w-4 h-4 fill-slate-950" />}
          >
            Mulai Ujian CBT
          </Button>

          {/* Decorative background glow */}
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-emerald-500/10 blur-3xl pointer-events-none" />
        </div>
      )}

      {/* PSIKOTES CBT BANNER */}
      {(candidate.status === 'TERVERIFIKASI' || candidate.status === 'DIIZINKAN_MENGIKUTI_SELEKSI') && (
        <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-teal-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-teal-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden">
          <div className="space-y-1.5 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 text-[11px] font-bold uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5" /> Asesmen Psikotes CBT Online
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Asesmen Potensi Kognitif & Psikotes Santri 2027/2028
            </h3>
            <p className="text-xs sm:text-sm text-teal-100/80 max-w-xl leading-relaxed">
              Materi Logika, Penalaran Visual & Spasial, Konsistensi Sikap Belajar, dan Ketelitian. Asesmen hanya dapat dikerjakan 1 kali.
            </p>
          </div>

          <Button
            size="lg"
            variant="primary"
            className="bg-teal-400 hover:bg-teal-300 text-slate-950 font-black shrink-0 shadow-lg text-sm px-6 py-3 z-10"
            onClick={() => onNavigate('/peserta/psikotes')}
            leftIcon={<Play className="w-4 h-4 fill-slate-950" />}
          >
            Mulai Psikotes
          </Button>

          {/* Decorative background glow */}
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-teal-500/10 blur-3xl pointer-events-none" />
        </div>
      )}

      {/* 2.5. EXAM CARD & SCHEDULE SPOTLIGHT (Section 11) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Kartu Peserta Ujian */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Dokumen Resmi Ujian
              </span>
              <Badge status={candidate.status} size="sm" />
            </div>

            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Printer className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Kartu Tanda Peserta Seleksi</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Wajib dicetak dan dibawa saat tes seleksi di PPTQM Darul Hikmah
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5 text-slate-600 mb-4">
              <div className="flex justify-between">
                <span>Status Pendaftaran:</span>
                <strong className={candidate.status === 'TERVERIFIKASI' ? 'text-emerald-700' : 'text-slate-800'}>
                  {candidate.status}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Ketersediaan Kartu:</span>
                {candidate.status === 'TERVERIFIKASI' || candidate.status === 'DIIZINKAN_MENGIKUTI_SELEKSI' ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Siap Dicetak (A4)
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">Dalam Verifikasi</span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant={candidate.status === 'TERVERIFIKASI' || candidate.status === 'DIIZINKAN_MENGIKUTI_SELEKSI' ? 'primary' : 'outline'}
              size="md"
              className={candidate.status === 'TERVERIFIKASI' || candidate.status === 'DIIZINKAN_MENGIKUTI_SELEKSI' ? 'w-full bg-emerald-700 hover:bg-emerald-800 font-bold' : 'w-full'}
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={() => onNavigate('/peserta/kartu')}
            >
              {candidate.status === 'TERVERIFIKASI' || candidate.status === 'DIIZINKAN_MENGIKUTI_SELEKSI'
                ? 'Tampilkan & Cetak Kartu Peserta'
                : 'Lihat Status Kartu Peserta'}
            </Button>
          </div>
        </div>

        {/* Card: Jadwal Terdekat */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Agenda Seleksi
              </span>
              <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {schedules.length > 0 ? `${schedules.length} Sesi Terjadwal` : 'Menunggu Sesi'}
              </span>
            </div>

            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Jadwal Seleksi Terdekat</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informasi tanggal, jam, ruangan, dan nomor kursi santri
                </p>
              </div>
            </div>

            {schedules.length > 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs mb-4">
                <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>{schedules[0].title}</span>
                  <span className="font-mono text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                    Kursi: {schedules[0].seat_number}
                  </span>
                </div>
                <div className="text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatDateIndonesian(schedules[0].test_date)}</span>
                  <span>•</span>
                  <span className="font-mono font-semibold">{schedules[0].start_time} - {schedules[0].end_time} WIB</span>
                </div>
                <div className="text-slate-600 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ruang: <strong>{schedules[0].room}</strong> ({schedules[0].location})</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-500 mb-4">
                Jadwal seleksi belum ditentukan. Panitia akan mengumumkan jadwal setelah proses verifikasi berkas selesai.
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              size="md"
              className="w-full"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => onNavigate('/peserta/jadwal')}
            >
              {schedules.length > 0 ? `Lihat Seluruh Jadwal (${schedules.length})` : 'Buka Halaman Jadwal'}
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Progress Tracking Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Progress Biodata */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-sm text-slate-900">1. Kelengkapan Biodata Santri</h3>
              </div>
              <span className="font-extrabold text-sm text-emerald-700">{progress.percentage}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden mb-4">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            {/* Checklist per Bagian */}
            <div className="space-y-2.5 text-xs">
              {Object.entries(progress.sections).map(([key, sec]) => (
                <div key={key} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="text-slate-600 font-medium">{sec.name}</span>
                  <div className="flex items-center gap-1.5">
                    {sec.isComplete ? (
                      <span className="inline-flex items-center text-emerald-700 font-semibold gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Lengkap ({sec.filled}/{sec.total})
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-amber-700 gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Belum Lengkap ({sec.filled}/{sec.total})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {isEditable ? 'Dapat diedit & disimpan bertahap' : 'Data terkunci (dalam verifikasi)'}
            </span>
            <Button
              size="sm"
              variant={isEditable ? 'primary' : 'outline'}
              onClick={() => onNavigate('/peserta/biodata')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              {isEditable ? 'Lanjutkan Pengisian' : 'Lihat Biodata'}
            </Button>
          </div>
        </div>

        {/* Progress Dokumen & Status Verifikasi */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-teal-700" />
                <h3 className="font-bold text-sm text-slate-900">2. Berkas Dokumen Persyaratan</h3>
              </div>
              <span className="font-extrabold text-sm text-teal-700">
                {docSummary ? `${docSummary.uploadedRequiredTypes}/${docSummary.totalRequiredTypes} Wajib` : '0/0'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden mb-4">
              <div
                className="h-full bg-teal-600 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    docSummary && docSummary.totalRequiredTypes > 0
                      ? Math.min(100, Math.round((docSummary.uploadedRequiredTypes / docSummary.totalRequiredTypes) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Verification Stats Breakdown */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-blue-50/80 border border-blue-100">
                  <span className="text-slate-500 block text-[10px]">Menunggu:</span>
                  <span className="text-sm font-bold text-blue-700">
                    {docSummary?.pendingDocs || 0}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50/80 border border-emerald-100">
                  <span className="text-slate-500 block text-[10px]">Diterima:</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {docSummary?.acceptedDocs || 0}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-rose-50/80 border border-rose-100">
                  <span className="text-slate-500 block text-[10px]">Ditolak:</span>
                  <span className="text-sm font-bold text-rose-700">
                    {docSummary?.rejectedDocs || 0}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span>Kartu Keluarga, Akta, KTP, Rapor, Foto:</span>
                  {docSummary?.isAllRequiredUploaded ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Lengkap
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Belum Lengkap
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate('/peserta/dokumen')}
              leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
            >
              Kelola Berkas
            </Button>

            {candidate.status === 'DRAFT' || candidate.status === 'PERLU_PERBAIKAN' ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onNavigate('/peserta/review')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Review & Final Submit
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => window.print()}
              >
                Cetak Bukti
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Ringkasan Data Calon Santri */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-700" />
            Ringkasan Identitas Calon Santri
          </h3>
          {isEditable && (
            <button
              onClick={() => onNavigate('/peserta/biodata')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              Perbarui Data
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block mb-1">Nama Lengkap</span>
            <span className="font-semibold text-slate-800 text-sm">{candidate.full_name}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block mb-1">Nomor Induk Kependudukan (NIK)</span>
            <span className="font-semibold text-slate-800 text-sm font-mono">
              {candidate.nik || '- (Belum diisi)'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block mb-1">NISN (10 Digit)</span>
            <span className="font-semibold text-slate-800 text-sm font-mono">
              {candidate.nisn || '- (Belum diisi)'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block mb-1">Tempat, Tanggal Lahir</span>
            <span className="font-semibold text-slate-800 text-sm">
              {candidate.birth_place ? `${candidate.birth_place}, ` : ''}
              {candidate.birth_date ? formatDateIndonesian(candidate.birth_date) : '-'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block mb-1">Jenis Kelamin</span>
            <span className="font-semibold text-slate-800 text-sm">
              {candidate.gender === 'L' ? 'Laki-Laki (Putra)' : candidate.gender === 'P' ? 'Perempuan (Putri)' : '-'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block mb-1">Sekolah Asal (SD/MI)</span>
            <span className="font-semibold text-slate-800 text-sm">
              {candidate.school_name || '-'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block mb-1">Nama Orang Tua (Ayah / Ibu)</span>
            <span className="font-semibold text-slate-800 text-sm">
              {candidate.father_name || candidate.mother_name
                ? `${candidate.father_name || '-'} / ${candidate.mother_name || '-'}`
                : '-'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block mb-1">No. WhatsApp Wali</span>
            <span className="font-semibold text-slate-800 text-sm font-mono">
              {candidate.guardian_phone || user?.phone || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Riwayat Perubahan Status (Candidate Status History) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-700" />
          Riwayat Perjalanan Pendaftaran (Status History)
        </h3>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Belum ada riwayat perubahan status.</p>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {history.map((h, idx) => (
              <div key={h.id || idx} className="relative">
                <div className="absolute -left-6 mt-1 w-4 h-4 rounded-full border-2 border-emerald-600 bg-white" />
                <div className="text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge status={h.new_status} size="sm" />
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 text-[11px]">
                      {formatDateTimeIndonesian(h.created_at)}
                    </span>
                  </div>
                  {h.note && <p className="text-slate-700 font-medium mt-0.5">{h.note}</p>}
                  {h.changed_by_name && (
                    <p className="text-[11px] text-slate-400 mt-0.5">Oleh: {h.changed_by_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Helpdesk Contact */}
      <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-950">Membutuhkan Bantuan atau Klarifikasi Pendaftaran?</h4>
            <p className="text-[11px] text-emerald-800">
              Tim sekretariat panitia PSB PPTQM Darul Hikmah siap membantu wali calon santri.
            </p>
          </div>
        </div>
        <a
          href={`https://wa.me/${(sysSettings.contact_wa || "6281234567890").replace(/[^0-9]/g, "").replace(/^0/, "62")}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Chat WhatsApp Panitia</span>
        </a>
      </div>
    </div>
  );
};
