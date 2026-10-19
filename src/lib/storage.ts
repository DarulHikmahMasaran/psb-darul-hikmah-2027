import { isSupabaseConfigured } from './supabase';
import { 
  Candidate, 
  CandidateStatus, 
  CandidateStatusHistory, 
  Profile, 
  SystemSetting, 
  AuditLog, 
  UserRole, 
  DocumentType, 
  CandidateDocument,
  TestType,
  TestSchedule,
  TestScheduleParticipant,
  CandidateVerificationToken,
  CandidateNotification,
  CandidateQrScanLog
} from '../types/database';
import {
  Subject,
  QuestionCategory,
  Question,
  QuestionOption,
  Exam,
  ExamQuestionConfig,
  ExamAttempt,
  ExamAttemptQuestion,
  ExamAnswer,
  ExamEvent,
  PsychotestScoringConfig
} from '../types/cbt';
import {
  SelectionScoringVersion,
  SelectionScoringComponent,
  SelectionPassingRuleVersion,
  SelectionTieBreaker,
  SelectionRun,
  SelectionRunComponentSnapshot,
  SelectionResult,
  SelectionResultComponent,
} from '../types/selection';
import {
  defaultSelectionScoringVersions,
  defaultSelectionScoringComponents,
  defaultSelectionPassingRuleVersions,
  defaultSelectionTieBreakers,
} from './selectionSeeds';
import {
  defaultSubjects,
  defaultCategories,
  defaultQuestions,
  defaultExams,
  defaultExamConfigs
} from './cbtSeeds';
import {
  psychotestSubject,
  psychotestCategories,
  psychotestQuestions,
  defaultPsychotestExam,
  defaultPsychotestExamConfigs,
  defaultPsychotestScoringConfigs
} from './psychotestSeeds';
import {
  LandingPageSettings,
  LandingPageStat,
  LandingPageRequirement,
  LandingPageStep,
  LandingPageSchedule,
  LandingPageFaq,
  LandingPageContact,
  LandingPageAnnouncement,
  LandingPageVersion
} from '../types/cms';
import {
  defaultLandingSettings,
  defaultLandingStats,
  defaultLandingRequirements,
  defaultLandingSteps,
  defaultLandingSchedules,
  defaultLandingFaqs,
  defaultLandingContacts,
  defaultLandingAnnouncements,
  defaultLandingVersions
} from './cmsSeeds';
import {
  QuranRubric,
  QuranExaminerAssignment,
  QuranAssessment,
  QuranAssessmentRubricSnapshot,
  QuranAssessmentScore
} from '../types/quran';
import {
  defaultQuranRubrics,
  defaultQuranExaminerAssignments,
  defaultQuranAssessments
} from './quranSeeds';

interface StorageData {
  profiles: Profile[];
  candidates: Candidate[];
  statusHistory: CandidateStatusHistory[];
  settings: SystemSetting[];
  auditLogs: AuditLog[];
  documentTypes: DocumentType[];
  candidateDocuments: CandidateDocument[];
  testTypes: TestType[];
  testSchedules: TestSchedule[];
  testScheduleParticipants: TestScheduleParticipant[];
  verificationTokens: CandidateVerificationToken[];
  notifications: CandidateNotification[];
  subjects: Subject[];
  questionCategories: QuestionCategory[];
  questions: Question[];
  questionOptions: QuestionOption[];
  exams: Exam[];
  examConfigs: ExamQuestionConfig[];
  examAttempts: ExamAttempt[];
  examAttemptQuestions: ExamAttemptQuestion[];
  examAnswers: ExamAnswer[];
  examEvents: ExamEvent[];
  // CMS Landing Page Data
  landingSettings: LandingPageSettings;
  landingStats: LandingPageStat[];
  landingRequirements: LandingPageRequirement[];
  landingSteps: LandingPageStep[];
  landingSchedules: LandingPageSchedule[];
  landingFaqs: LandingPageFaq[];
  landingContacts: LandingPageContact[];
  landingAnnouncements: LandingPageAnnouncement[];
  landingVersions: LandingPageVersion[];
  qrScanLogs: CandidateQrScanLog[];
  // Quran Assessment Module
  quranRubrics: QuranRubric[];
  quranAssignments: QuranExaminerAssignment[];
  quranAssessments: QuranAssessment[];
  quranRubricSnapshots: QuranAssessmentRubricSnapshot[];
  quranAssessmentScores: QuranAssessmentScore[];
  // Psychotest Module
  psychotestScoringConfigs: PsychotestScoringConfig[];
  // Final Selection Scoring & Kelulusan Module
  selectionScoringVersions: SelectionScoringVersion[];
  selectionScoringComponents: SelectionScoringComponent[];
  selectionPassingRuleVersions: SelectionPassingRuleVersion[];
  selectionTieBreakers: SelectionTieBreaker[];
  selectionRuns: SelectionRun[];
  selectionRunComponentSnapshots: SelectionRunComponentSnapshot[];
  selectionResults: SelectionResult[];
  selectionResultComponents: SelectionResultComponent[];
  credentials: Record<string, string>; // email -> password hash/plain for testing mode
  seqCounter: number;
}

const STORAGE_KEY = 'psb_pptqm_darul_hikmah_db_v1';

const defaultSettings: SystemSetting[] = [
  { id: '1', key: 'psb_year', value: '2027/2028', description: 'Tahun Pelajaran Penerimaan Santri Baru', updated_at: new Date().toISOString() },
  { id: '2', key: 'school_name', value: 'PPTQM Darul Hikmah', description: 'Nama Pondok Pesantren Tahfidzul Qur\'an Modern', updated_at: new Date().toISOString() },
  { id: '3', key: 'school_level', value: 'SMP (Sekolah Menengah Pertama)', description: 'Jenjang pendidikan yang dibuka', updated_at: new Date().toISOString() },
  { id: '4', key: 'registration_batch', value: 'Gelombang 1', description: 'Gelombang pendaftaran yang sedang aktif', updated_at: new Date().toISOString() },
  { id: '5', key: 'registration_start_date', value: '2026-10-01', description: 'Mulai pendaftaran santri baru', updated_at: new Date().toISOString() },
  { id: '6', key: 'registration_end_date', value: '2026-12-31', description: 'Batas akhir pendaftaran santri baru', updated_at: new Date().toISOString() },
  { id: '7', key: 'contact_wa', value: '0812-3456-7890', description: 'Hotline WhatsApp Panitia PSB', updated_at: new Date().toISOString() },
  { id: '8', key: 'contact_email', value: 'psb@darulhikmah.sch.id', description: 'Email resmi panitia penerimaan santri', updated_at: new Date().toISOString() },
  { id: '9', key: 'target_quota', value: '120', description: 'Target kuota santri baru', updated_at: new Date().toISOString() },
  { id: '10', key: 'registration_fee', value: '350000', description: 'Biaya infaq pendaftaran & administrasi (Rp)', updated_at: new Date().toISOString() },
  { id: '11', key: 'committee_city', value: 'Surakarta', description: 'Kota penetapan tanda tangan Kartu Ujian & SKL', updated_at: new Date().toISOString() },
  { id: '12', key: 'committee_head_name', value: 'Ustadz Ridwan Robbani, S.Pd', description: 'Nama Ketua Panitia PSB', updated_at: new Date().toISOString() },
  { id: '13', key: 'committee_head_id', value: 'NIY. 19890412.201402.1.002', description: 'NIP / NIY Ketua Panitia PSB', updated_at: new Date().toISOString() },
  { id: '14', key: 'bank_name', value: 'Bank Syariah Indonesia (BSI)', description: 'Nama Bank Rekening Resmi PSB', updated_at: new Date().toISOString() },
  { id: '15', key: 'bank_account_number', value: '7123456789', description: 'Nomor Rekening Resmi PSB', updated_at: new Date().toISOString() },
  { id: '16', key: 'bank_account_holder', value: 'Yayasan PPTQM Darul Hikmah', description: 'Atas Nama Rekening Resmi PSB', updated_at: new Date().toISOString() },
  { id: '17', key: 'reregistration_fee', value: '4500000', description: 'Biaya Daftar Ulang Santri Lulus (Rp)', updated_at: new Date().toISOString() },
  { id: '18', key: 'public_demo_controls', value: 'true', description: 'Tampilkan tombol Uji Role / Simulasi ke publik (true = Mode Evaluasi, false = Mode Produksi Resmi)', updated_at: new Date().toISOString() }
];

export const defaultDocumentTypes: DocumentType[] = [
  {
    id: 'dt-kk',
    code: 'KK',
    name: 'Kartu Keluarga (KK)',
    description: 'Scan atau foto berwarna Kartu Keluarga asli/legalisir yang mencantumkan nama calon santri.',
    is_required: true,
    is_active: true,
    max_file_size_mb: 5,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dt-akta',
    code: 'AKTA_KELAHIRAN',
    name: 'Akta Kelahiran',
    description: 'Scan atau foto akta kelahiran resmi calon santri dari Disdukcapil.',
    is_required: true,
    is_active: true,
    max_file_size_mb: 5,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dt-ktp-ortu',
    code: 'KTP_ORANG_TUA',
    name: 'KTP Orang Tua',
    description: 'Scan atau foto e-KTP Ayah dan Ibu kandung. Boleh mengunggah lebih dari 1 file (KTP Ayah & KTP Ibu).',
    is_required: true,
    is_active: true,
    max_file_size_mb: 5,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dt-ktp-wali',
    code: 'KTP_WALI',
    name: 'KTP Wali',
    description: 'Scan atau foto e-KTP Wali resmi (hanya diperlukan apabila santri tidak tinggal bersama orang tua kandung).',
    is_required: false,
    is_active: true,
    max_file_size_mb: 5,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    sort_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dt-sekolah',
    code: 'DOKUMEN_SEKOLAH',
    name: 'Berkas Pendukung Sekolah',
    description: 'Scan halaman biodata rapor SD/MI kelas 6 semester 1, Surat Keterangan Lulus/Aktif, atau kartu NISN.',
    is_required: true,
    is_active: true,
    max_file_size_mb: 5,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    sort_order: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dt-foto',
    code: 'PAS_FOTO',
    name: 'Pas Foto Santri',
    description: 'Pasfoto resmi terbaru calon santri ukuran 3x4 berwarna (background merah/biru, berpakaian rapi/berpeci/berjilbab).',
    is_required: true,
    is_active: true,
    max_file_size_mb: 5,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    sort_order: 6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dt-bukti-bayar',
    code: 'BUKTI_PEMBAYARAN',
    name: 'Bukti Pembayaran Biaya Pendaftaran',
    description: 'Scan atau foto bukti transfer biaya infaq pendaftaran PSB ke rekening resmi pesantren.',
    is_required: true,
    is_active: true,
    max_file_size_mb: 5,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    sort_order: 7,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dt-daftar-ulang',
    code: 'BUKTI_DAFTAR_ULANG',
    name: 'Bukti Pembayaran Daftar Ulang (Khusus Santri Lulus)',
    description: 'Scan atau foto bukti transfer daftar ulang bagi calon santri yang telah dinyatakan LULUS seleksi.',
    is_required: false,
    is_active: true,
    max_file_size_mb: 5,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    sort_order: 8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dt-pendukung',
    code: 'DOKUMEN_PENDUKUNG',
    name: 'Berkas Pendukung Lainnya',
    description: 'Sertifikat kejuaraan tahfidz/akademik/prestasi, piagam penghargaan, atau surat keterangan lainnya (opsional).',
    is_required: false,
    is_active: true,
    max_file_size_mb: 5,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    sort_order: 9,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const defaultTestTypes: TestType[] = [
  {
    id: 'tt-akademik',
    code: 'AKADEMIK',
    name: 'Tes Potensi Akademik',
    description: 'Ujian tertulis materi Matematika Dasar, IPA Terpadu, Bahasa Indonesia, dan Pendidikan Agama Islam.',
    is_active: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tt-quran',
    code: 'QURAN',
    name: 'Tes Al-Qur\'an (Tahfidz & Tajwid)',
    description: 'Uji kelancaran membaca Al-Qur\'an (fashahah & tartil), makharijul huruf, kaidah tajwid, dan setoran hafalan juz 30.',
    is_active: true,
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tt-psikotes',
    code: 'PSIKOTES',
    name: 'Psikotes & Wawancara Santri/Wali',
    description: 'Asesmen kemandirian santri, psikotes minat bakat, wawancara kesiapan mondok santri dan komitmen orang tua/wali.',
    is_active: true,
    sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const defaultTestSchedules: TestSchedule[] = [
  {
    id: 'sch-akademik-1',
    test_type_id: 'tt-akademik',
    title: 'Tes Potensi Akademik - Sesi Pagi Gelombang 1',
    test_date: '2026-11-15',
    start_time: '08:00',
    end_time: '10:00',
    location: 'Kampus PPTQM Darul Hikmah Pusat',
    room: 'Gedung Abu Bakar Lt. 2 (Ruang 201)',
    capacity: 30,
    notes: 'Harap membawa kartu ujian peserta PSB yang sudah dicetak, pensil 2B, dan penghapus. Peserta hadir 15 menit sebelum tes dimulai.',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sch-quran-1',
    test_type_id: 'tt-quran',
    title: 'Tes Al-Qur\'an (Tahfidz & Tajwid) - Sesi Siang',
    test_date: '2026-11-15',
    start_time: '10:30',
    end_time: '12:30',
    location: 'Masjid Jami\' Darul Hikmah',
    room: 'Halaqah Al-Fatihah (Sayap Kanan)',
    capacity: 30,
    notes: 'Peserta membawa mushaf Al-Qur\'an standar Madinah / Kemenag dan berpakaian busana muslim rapi/berpeci.',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sch-psikotes-1',
    test_type_id: 'tt-psikotes',
    title: 'Psikotes & Wawancara Santri & Orang Tua',
    test_date: '2026-11-15',
    start_time: '13:30',
    end_time: '15:30',
    location: 'Gedung Rektorat PPTQM Darul Hikmah',
    room: 'Ruang Wawancara Utama (Lt. 1)',
    capacity: 30,
    notes: 'Wajib didampingi minimal satu orang tua/wali kandung untuk sesi wawancara komitmen pendidikan pesantren.',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const defaultTestScheduleParticipants: TestScheduleParticipant[] = [
  {
    id: 'tsp-sample-1',
    schedule_id: 'sch-akademik-1',
    candidate_id: 'cand-sample-1',
    seat_number: 'A-01',
    attendance_status: 'BELUM_HADIR',
    assigned_by: 'usr-panitia-1',
    assigned_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'tsp-sample-2',
    schedule_id: 'sch-quran-1',
    candidate_id: 'cand-sample-1',
    seat_number: 'Q-01',
    attendance_status: 'BELUM_HADIR',
    assigned_by: 'usr-panitia-1',
    assigned_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'tsp-sample-q2',
    schedule_id: 'sch-quran-1',
    candidate_id: 'cand-sample-2',
    seat_number: 'Q-02',
    attendance_status: 'HADIR',
    scanned_at: new Date(Date.now() - 7200000).toISOString(),
    scanned_by_name: 'Panitia Presensi',
    scan_method: 'QR_CAMERA',
    assigned_by: 'usr-panitia-1',
    assigned_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'tsp-sample-q3',
    schedule_id: 'sch-quran-1',
    candidate_id: 'cand-sample-3',
    seat_number: 'Q-03',
    attendance_status: 'HADIR',
    scanned_at: new Date(Date.now() - 10800000).toISOString(),
    scanned_by_name: 'Panitia Presensi',
    scan_method: 'QR_CAMERA',
    assigned_by: 'usr-panitia-1',
    assigned_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: 'tsp-sample-3',
    schedule_id: 'sch-psikotes-1',
    candidate_id: 'cand-sample-1',
    seat_number: 'P-01',
    attendance_status: 'BELUM_HADIR',
    assigned_by: 'usr-panitia-1',
    assigned_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

export const defaultVerificationTokens: CandidateVerificationToken[] = [
  {
    id: 'tok-sample-1',
    candidate_id: 'cand-sample-1',
    token_hash: 'tok_dh2027_0001_8f9a2b7c4d1e',
    is_active: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 90).toISOString(),
  }
];

export const defaultNotifications: CandidateNotification[] = [
  {
    id: 'notif-sample-1',
    candidate_id: 'cand-sample-1',
    title: 'Jadwal Seleksi Ditetapkan',
    message: 'Anda telah dijadwalkan mengikuti Tes Akademik, Tes Al-Qur\'an, dan Psikotes pada tanggal 15 November 2026. Silakan cetak Kartu Peserta Anda.',
    type: 'SCHEDULE_CREATED',
    is_read: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

const initialData: StorageData = {
  profiles: [
    {
      id: 'prof-super-admin',
      user_id: 'usr-super-admin',
      full_name: 'Ustadz H. Ahmad Fauzan, Lc., M.Pd',
      email: 'admin@darulhikmah.sch.id',
      phone: '081234567890',
      role: 'SUPER_ADMIN',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'prof-panitia-1',
      user_id: 'usr-panitia-1',
      full_name: 'Ustadz Ridwan Robbani, S.Pd',
      email: 'panitia@darulhikmah.sch.id',
      phone: '081298765432',
      role: 'PANITIA',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'prof-penguji-quran-1',
      user_id: 'usr-penguji-quran-1',
      full_name: 'Ustadz KH. Muhaimin Al-Hafidz',
      email: 'penguji.quran@darulhikmah.sch.id',
      phone: '081255667788',
      role: 'PENGUJI_QURAN',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'prof-pimpinan-1',
      user_id: 'usr-pimpinan-1',
      full_name: 'KH. Abdullah Syukri, M.Pd (Pimpinan)',
      email: 'pimpinan@darulhikmah.sch.id',
      phone: '081299887766',
      role: 'PIMPINAN',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'prof-sample-candidate',
      user_id: 'usr-sample-candidate',
      full_name: 'Muhammad Farhan Al-Ghifari',
      email: 'farhan@example.com',
      phone: '081311223344',
      role: 'PESERTA',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ],
  candidates: [
    {
      id: 'cand-sample-1',
      user_id: 'usr-sample-candidate',
      registration_number: 'DH-2027-0001',
      full_name: 'Muhammad Farhan Al-Ghifari',
      nik: '3201012304140001',
      nisn: '0123456789',
      birth_place: 'Bogor',
      birth_date: '2014-04-12',
      gender: 'L',
      religion: 'Islam',
      school_name: 'SDIT Darul Qur\'an',
      school_npsn: '20234567',
      school_nis: '141501',
      address: 'Jl. Raya Tajur No. 45, RT 02 / RW 04',
      village: 'Muarasari',
      district: 'Bogor Selatan',
      regency: 'Kota Bogor',
      province: 'Jawa Barat',
      postal_code: '16137',
      father_name: 'H. Bambang Irawan, S.T',
      father_nik: '3201011508750002',
      father_occupation: 'Karyawan Swasta',
      mother_name: 'Hj. Siti Aisyah, S.Pd',
      mother_nik: '3201015609780003',
      mother_occupation: 'Guru SD',
      guardian_name: '',
      guardian_relationship: '',
      guardian_phone: '',
      guardian_address: '',
      child_order: 1,
      sibling_count: 2,
      living_status: 'Tinggal Bersama Orang Tua',
      status: 'TERVERIFIKASI',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cand-sample-2',
      user_id: 'usr-sample-candidate-2',
      registration_number: 'DH-2027-0002',
      full_name: 'Ahmad Zaki Mubarak',
      nik: '3201012304140002',
      nisn: '0123456790',
      birth_place: 'Depok',
      birth_date: '2014-06-18',
      gender: 'L',
      religion: 'Islam',
      school_name: 'MI Pembangunan Jakarta',
      school_npsn: '20234568',
      address: 'Jl. Margonda Raya No. 12',
      status: 'MENGIKUTI_SELEKSI',
      guardian_phone: '081233445566',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cand-sample-3',
      user_id: 'usr-sample-candidate-3',
      registration_number: 'DH-2027-0003',
      full_name: 'Fathimah Azzahra',
      nik: '3201012304140003',
      nisn: '0123456791',
      birth_place: 'Sukabumi',
      birth_date: '2014-08-25',
      gender: 'P',
      religion: 'Islam',
      school_name: 'SDIT Al-Ittihad',
      school_npsn: '20234569',
      address: 'Jl. Surya Kencana No. 88',
      status: 'SELESAI_SELEKSI',
      guardian_phone: '081277889900',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ],
  statusHistory: [
    {
      id: 'hist-1',
      candidate_id: 'cand-sample-1',
      old_status: null,
      new_status: 'DRAFT',
      changed_by: 'usr-sample-candidate',
      changed_by_name: 'Muhammad Farhan Al-Ghifari',
      note: 'Akun pendaftar berhasil dibuat.',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'hist-2',
      candidate_id: 'cand-sample-1',
      old_status: 'DRAFT',
      new_status: 'TERDAFTAR',
      changed_by: 'usr-sample-candidate',
      changed_by_name: 'Muhammad Farhan Al-Ghifari',
      note: 'Biodata calon santri telah lengkap dan dikirim untuk verifikasi.',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'hist-3',
      candidate_id: 'cand-sample-1',
      old_status: 'TERDAFTAR',
      new_status: 'TERVERIFIKASI',
      changed_by: 'usr-panitia-1',
      changed_by_name: 'Ustadz Ridwan Robbani (Panitia)',
      note: 'Berkas dan biodata telah diperiksa panitia dan dinyatakan valid.',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    }
  ],
  settings: defaultSettings,
  auditLogs: [
    {
      id: 'log-1',
      user_id: 'usr-super-admin',
      user_email: 'admin@darulhikmah.sch.id',
      action: 'SYSTEM_INITIALIZATION',
      entity_type: 'SYSTEM',
      entity_id: 'psb-2027',
      old_value: null,
      new_value: { year: '2027/2028', status: 'OPEN' },
      ip_address: '127.0.0.1',
      user_agent: 'PSB Engine Server',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'log-2',
      user_id: 'usr-panitia-1',
      user_email: 'panitia@darulhikmah.sch.id',
      action: 'VERIFY_CANDIDATE',
      entity_type: 'CANDIDATE',
      entity_id: 'cand-sample-1',
      old_value: { status: 'TERDAFTAR' },
      new_value: { status: 'TERVERIFIKASI' },
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 Panitia Dashboard',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    }
  ],
  documentTypes: defaultDocumentTypes,
  candidateDocuments: [
    {
      id: 'doc-sample-kk-1',
      candidate_id: 'cand-sample-1',
      document_type_id: 'dt-kk',
      file_name: 'Kartu_Keluarga_Farhan_2027.pdf',
      file_path: 'usr-sample-candidate/kk/kk_farhan_sample.pdf',
      file_size: 1420500,
      mime_type: 'application/pdf',
      status: 'DITERIMA',
      uploaded_by: 'usr-sample-candidate',
      verified_by: 'usr-panitia-1',
      verified_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'doc-sample-akta-1',
      candidate_id: 'cand-sample-1',
      document_type_id: 'dt-akta',
      file_name: 'Akta_Kelahiran_Farhan.jpg',
      file_path: 'usr-sample-candidate/akta-kelahiran/akta_farhan_sample.jpg',
      file_size: 984000,
      mime_type: 'image/jpeg',
      status: 'DITERIMA',
      uploaded_by: 'usr-sample-candidate',
      verified_by: 'usr-panitia-1',
      verified_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'doc-sample-ktp-ayah',
      candidate_id: 'cand-sample-1',
      document_type_id: 'dt-ktp-ortu',
      file_name: 'KTP_Ayah_Bambang.jpg',
      file_path: 'usr-sample-candidate/ktp-orang-tua/ktp_ayah_sample.jpg',
      file_size: 852000,
      mime_type: 'image/jpeg',
      status: 'DITERIMA',
      uploaded_by: 'usr-sample-candidate',
      verified_by: 'usr-panitia-1',
      verified_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'doc-sample-sekolah',
      candidate_id: 'cand-sample-1',
      document_type_id: 'dt-sekolah',
      file_name: 'Rapor_Semester_1_SDIT.pdf',
      file_path: 'usr-sample-candidate/dokumen-sekolah/rapor_sdit_sample.pdf',
      file_size: 2150000,
      mime_type: 'application/pdf',
      status: 'DITERIMA',
      uploaded_by: 'usr-sample-candidate',
      verified_by: 'usr-panitia-1',
      verified_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'doc-sample-foto',
      candidate_id: 'cand-sample-1',
      document_type_id: 'dt-foto',
      file_name: 'Pasfoto_Farhan_3x4.jpg',
      file_path: 'usr-sample-candidate/pas-foto/pasfoto_farhan.jpg',
      file_size: 450000,
      mime_type: 'image/jpeg',
      status: 'DITERIMA',
      uploaded_by: 'usr-sample-candidate',
      verified_by: 'usr-panitia-1',
      verified_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'doc-sample-bayar',
      candidate_id: 'cand-sample-1',
      document_type_id: 'dt-bukti-bayar',
      file_name: 'Bukti_Transfer_BSI_Farhan.jpg',
      file_path: 'usr-sample-candidate/bukti-pembayaran/bukti_bsi_farhan.jpg',
      file_size: 380000,
      mime_type: 'image/jpeg',
      status: 'DITERIMA',
      uploaded_by: 'usr-sample-candidate',
      verified_by: 'usr-panitia-1',
      verified_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    }
  ],
  testTypes: defaultTestTypes,
  testSchedules: defaultTestSchedules,
  testScheduleParticipants: defaultTestScheduleParticipants,
  verificationTokens: defaultVerificationTokens,
  notifications: defaultNotifications,
  subjects: [...defaultSubjects, psychotestSubject],
  questionCategories: [...defaultCategories, ...psychotestCategories],
  questions: [...defaultQuestions, ...psychotestQuestions],
  questionOptions: [
    ...defaultQuestions.flatMap(q => q.options || []),
    ...psychotestQuestions.flatMap(q => q.options || [])
  ],
  exams: [...defaultExams, defaultPsychotestExam],
  examConfigs: [...defaultExamConfigs, ...defaultPsychotestExamConfigs],
  examAttempts: [],
  examAttemptQuestions: [],
  examAnswers: [],
  examEvents: [],
  // CMS Landing Page Defaults
  landingSettings: defaultLandingSettings,
  landingStats: defaultLandingStats,
  landingRequirements: defaultLandingRequirements,
  landingSteps: defaultLandingSteps,
  landingSchedules: defaultLandingSchedules,
  landingFaqs: defaultLandingFaqs,
  landingContacts: defaultLandingContacts,
  landingAnnouncements: defaultLandingAnnouncements,
  landingVersions: defaultLandingVersions,
  qrScanLogs: [],
  // Quran Assessment Defaults
  quranRubrics: defaultQuranRubrics,
  quranAssignments: defaultQuranExaminerAssignments,
  quranAssessments: defaultQuranAssessments,
  quranRubricSnapshots: [],
  quranAssessmentScores: defaultQuranAssessments.flatMap(a => a.scores || []),
  // Psychotest Scoring Defaults
  psychotestScoringConfigs: defaultPsychotestScoringConfigs,
  // Final Selection Scoring Defaults
  selectionScoringVersions: defaultSelectionScoringVersions,
  selectionScoringComponents: defaultSelectionScoringComponents,
  selectionPassingRuleVersions: defaultSelectionPassingRuleVersions,
  selectionTieBreakers: defaultSelectionTieBreakers,
  selectionRuns: [],
  selectionRunComponentSnapshots: [],
  selectionResults: [],
  selectionResultComponents: [],
  credentials: {
    'admin@darulhikmah.sch.id': 'Password123!',
    'panitia@darulhikmah.sch.id': 'Password123!',
    'penguji.quran@darulhikmah.sch.id': 'Password123!',
    'pimpinan@darulhikmah.sch.id': 'Password123!',
    'farhan@example.com': 'Password123!',
  },
  seqCounter: 1,
};

let __memoryFallbackStorage: StorageData | null = null;

export const getStorageData = (): StorageData => {
  if (typeof window === 'undefined') return initialData;
  // Hentikan fallback localStorage untuk business data jika Supabase aktif sebagai production backend
  if (isSupabaseConfigured()) {
    return initialData;
  }
  try {
    let raw: string | null = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch { raw = null; }
    if (!raw) {
      if (__memoryFallbackStorage) return __memoryFallbackStorage;
      __memoryFallbackStorage = JSON.parse(JSON.stringify(initialData));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(__memoryFallbackStorage)); } catch {}
      return __memoryFallbackStorage as StorageData;
    }
    const parsed = JSON.parse(raw);
    let mutated = false;
    if (!parsed.documentTypes || parsed.documentTypes.length === 0) {
      parsed.documentTypes = defaultDocumentTypes;
      mutated = true;
    } else {
      for (const dt of defaultDocumentTypes) {
        if (!parsed.documentTypes.some((x: any) => x.code === dt.code)) {
          parsed.documentTypes.push(dt);
          mutated = true;
        }
      }
    }
    if (parsed.settings && Array.isArray(parsed.settings)) {
      for (const st of defaultSettings) {
        if (!parsed.settings.some((x: any) => x.key === st.key)) {
          parsed.settings.push(st);
          mutated = true;
        }
      }
    }
    if (parsed.credentials && !parsed.credentials['pimpinan@darulhikmah.sch.id']) {
      parsed.credentials['pimpinan@darulhikmah.sch.id'] = 'Password123!';
      mutated = true;
    }
    if (parsed.candidateDocuments && !parsed.candidateDocuments.some((d: any) => d.id === 'doc-sample-bayar')) {
      parsed.candidateDocuments.push(initialData.candidateDocuments[initialData.candidateDocuments.length - 1]);
      mutated = true;
    }
    if (!parsed.candidateDocuments) {
      parsed.candidateDocuments = initialData.candidateDocuments;
      mutated = true;
    }
    if (!parsed.testTypes || parsed.testTypes.length === 0) {
      parsed.testTypes = defaultTestTypes;
      mutated = true;
    }
    if (!parsed.testSchedules || parsed.testSchedules.length === 0) {
      parsed.testSchedules = defaultTestSchedules;
      mutated = true;
    }
    if (!parsed.testScheduleParticipants) {
      parsed.testScheduleParticipants = defaultTestScheduleParticipants;
      mutated = true;
    }
    if (!parsed.verificationTokens || parsed.verificationTokens.length === 0) {
      parsed.verificationTokens = defaultVerificationTokens;
      mutated = true;
    }
    if (!parsed.notifications) {
      parsed.notifications = defaultNotifications;
      mutated = true;
    }
    if (!parsed.subjects || parsed.subjects.length === 0) {
      parsed.subjects = defaultSubjects;
      mutated = true;
    }
    if (!parsed.questionCategories || parsed.questionCategories.length === 0) {
      parsed.questionCategories = defaultCategories;
      mutated = true;
    }
    if (!parsed.questions || parsed.questions.length === 0) {
      parsed.questions = defaultQuestions;
      parsed.questionOptions = defaultQuestions.flatMap(q => q.options || []);
      mutated = true;
    }
    if (!parsed.exams || parsed.exams.length === 0) {
      parsed.exams = defaultExams;
      mutated = true;
    }
    if (!parsed.examConfigs || parsed.examConfigs.length === 0) {
      parsed.examConfigs = defaultExamConfigs;
      mutated = true;
    }
    if (!parsed.examAttempts) {
      parsed.examAttempts = [];
      mutated = true;
    }
    if (!parsed.examAttemptQuestions) {
      parsed.examAttemptQuestions = [];
      mutated = true;
    }
    if (!parsed.examAnswers) {
      parsed.examAnswers = [];
      mutated = true;
    }
    if (!parsed.examEvents) {
      parsed.examEvents = [];
      mutated = true;
    }
    // CMS auto-seeding & schema migration
    if (!parsed.landingSettings) {
      parsed.landingSettings = defaultLandingSettings;
      mutated = true;
    } else {
      if (!parsed.landingSettings.cta_title) {
        parsed.landingSettings.cta_title = defaultLandingSettings.cta_title;
        mutated = true;
      }
      if (!parsed.landingSettings.cta_description) {
        parsed.landingSettings.cta_description = defaultLandingSettings.cta_description;
        mutated = true;
      }
      if (!parsed.landingSettings.cta_primary_button_text) {
        parsed.landingSettings.cta_primary_button_text = defaultLandingSettings.cta_primary_button_text || 'Daftar Sekarang';
        mutated = true;
      }
      if (!parsed.landingSettings.cta_primary_button_link) {
        parsed.landingSettings.cta_primary_button_link = defaultLandingSettings.cta_primary_button_link || '/register';
        mutated = true;
      }
      if (parsed.landingSettings.cta_primary_button_active === undefined) {
        parsed.landingSettings.cta_primary_button_active = true;
        mutated = true;
      }
      if (!parsed.landingSettings.cta_secondary_button_text) {
        parsed.landingSettings.cta_secondary_button_text = defaultLandingSettings.cta_secondary_button_text || 'Hubungi Panitia';
        mutated = true;
      }
      if (parsed.landingSettings.cta_secondary_button_active === undefined) {
        parsed.landingSettings.cta_secondary_button_active = true;
        mutated = true;
      }
    }
    if (!parsed.landingStats || parsed.landingStats.length === 0) {
      parsed.landingStats = defaultLandingStats;
      mutated = true;
    }
    if (!parsed.landingRequirements || parsed.landingRequirements.length === 0) {
      parsed.landingRequirements = defaultLandingRequirements;
      mutated = true;
    }
    if (!parsed.landingSteps || parsed.landingSteps.length === 0) {
      parsed.landingSteps = defaultLandingSteps;
      mutated = true;
    }
    if (!parsed.landingSchedules || parsed.landingSchedules.length === 0) {
      parsed.landingSchedules = defaultLandingSchedules;
      mutated = true;
    }
    if (!parsed.landingFaqs || parsed.landingFaqs.length === 0) {
      parsed.landingFaqs = defaultLandingFaqs;
      mutated = true;
    }
    if (!parsed.landingContacts || parsed.landingContacts.length === 0) {
      parsed.landingContacts = defaultLandingContacts;
      mutated = true;
    }
    if (!parsed.landingAnnouncements) {
      parsed.landingAnnouncements = defaultLandingAnnouncements;
      mutated = true;
    }
    if (!parsed.landingVersions || parsed.landingVersions.length === 0) {
      parsed.landingVersions = defaultLandingVersions;
      mutated = true;
    }
    if (!parsed.qrScanLogs) {
      parsed.qrScanLogs = [];
      mutated = true;
    }
    // Quran Assessment auto-seeding
    if (!parsed.quranRubrics || parsed.quranRubrics.length === 0) {
      parsed.quranRubrics = defaultQuranRubrics;
      mutated = true;
    }
    if (!parsed.quranAssignments || parsed.quranAssignments.length === 0) {
      parsed.quranAssignments = defaultQuranExaminerAssignments;
      mutated = true;
    }
    if (!parsed.quranAssessments) {
      parsed.quranAssessments = defaultQuranAssessments;
      mutated = true;
    }
    if (!parsed.quranRubricSnapshots) {
      parsed.quranRubricSnapshots = [];
      mutated = true;
    }
    if (!parsed.quranAssessmentScores) {
      parsed.quranAssessmentScores = defaultQuranAssessments.flatMap((a: any) => a.scores || []);
      mutated = true;
    }
    if (parsed.profiles && !parsed.profiles.some((p: any) => p.user_id === 'usr-penguji-quran-1')) {
      parsed.profiles.push({
        id: 'prof-penguji-quran-1',
        user_id: 'usr-penguji-quran-1',
        full_name: 'Ustadz KH. Muhaimin Al-Hafidz',
        email: 'penguji.quran@darulhikmah.sch.id',
        phone: '081255667788',
        role: 'PENGUJI_QURAN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mutated = true;
    }
    if (parsed.profiles && !parsed.profiles.some((p: any) => p.user_id === 'usr-pimpinan-1')) {
      parsed.profiles.push({
        id: 'prof-pimpinan-1',
        user_id: 'usr-pimpinan-1',
        full_name: 'KH. Abdullah Syukri, M.Pd (Pimpinan)',
        email: 'pimpinan@darulhikmah.sch.id',
        phone: '081299887766',
        role: 'PIMPINAN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mutated = true;
    }
    // Psychotest Module auto-seeding
    if (parsed.subjects && !parsed.subjects.some((s: any) => s.id === 'sub-psikotes')) {
      parsed.subjects.push(psychotestSubject);
      mutated = true;
    }
    if (parsed.questionCategories && !parsed.questionCategories.some((c: any) => c.id === 'cat-psi-logika')) {
      parsed.questionCategories.push(...psychotestCategories);
      mutated = true;
    }
    if (parsed.questions && !parsed.questions.some((q: any) => q.id === 'q-psi-logika-1')) {
      parsed.questions.push(...psychotestQuestions);
      parsed.questionOptions.push(...psychotestQuestions.flatMap((q: any) => q.options || []));
      mutated = true;
    }
    if (parsed.exams && !parsed.exams.some((e: any) => e.id === 'exam-cbt-psikotes-1')) {
      parsed.exams.push(defaultPsychotestExam);
      mutated = true;
    }
    if (parsed.examConfigs && !parsed.examConfigs.some((c: any) => c.id === 'cfg-psi-1')) {
      parsed.examConfigs.push(...defaultPsychotestExamConfigs);
      mutated = true;
    }
    if (!parsed.psychotestScoringConfigs || parsed.psychotestScoringConfigs.length === 0) {
      parsed.psychotestScoringConfigs = defaultPsychotestScoringConfigs;
      mutated = true;
    }
    if (parsed.testScheduleParticipants && !parsed.testScheduleParticipants.some((p: any) => p.id === 'tsp-sample-3')) {
      parsed.testScheduleParticipants.push({
        id: 'tsp-sample-3',
        schedule_id: 'sch-psikotes-1',
        candidate_id: 'cand-sample-1',
        seat_number: 'P-01',
        attendance_status: 'BELUM_HADIR',
        assigned_by: 'usr-panitia-1',
        assigned_at: new Date(Date.now() - 86400000).toISOString(),
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      });
      mutated = true;
    }
    // Final Selection Module auto-seeding
    if (!parsed.selectionScoringVersions || parsed.selectionScoringVersions.length === 0) {
      parsed.selectionScoringVersions = defaultSelectionScoringVersions;
      mutated = true;
    }
    if (!parsed.selectionScoringComponents || parsed.selectionScoringComponents.length === 0) {
      parsed.selectionScoringComponents = defaultSelectionScoringComponents;
      mutated = true;
    }
    if (!parsed.selectionPassingRuleVersions || parsed.selectionPassingRuleVersions.length === 0) {
      parsed.selectionPassingRuleVersions = defaultSelectionPassingRuleVersions;
      mutated = true;
    }
    if (!parsed.selectionTieBreakers || parsed.selectionTieBreakers.length === 0) {
      parsed.selectionTieBreakers = defaultSelectionTieBreakers;
      mutated = true;
    }
    if (!parsed.selectionRuns) {
      parsed.selectionRuns = [];
      mutated = true;
    }
    if (!parsed.selectionRunComponentSnapshots) {
      parsed.selectionRunComponentSnapshots = [];
      mutated = true;
    }
    if (!parsed.selectionResults) {
      parsed.selectionResults = [];
      mutated = true;
    }
    if (!parsed.selectionResultComponents) {
      parsed.selectionResultComponents = [];
      mutated = true;
    }
    if (mutated) {
      saveStorageData(parsed);
    }
    return parsed;
  } catch (e) {
    console.error('Error loading storage data', e);
    return initialData;
  }
};

export const saveStorageData = (data: StorageData): void => {
  __memoryFallbackStorage = data;
  if (typeof window === 'undefined') return;
  if (isSupabaseConfigured()) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Fallback ke in-memory storage', e);
  }
};

export const exportStorageDataJson = (): string => {
  const data = getStorageData();
  return JSON.stringify(data, null, 2);
};

export const importStorageDataJson = (jsonString: string): { success: boolean; message: string } => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.candidates) || !Array.isArray(parsed.profiles)) {
      return { success: false, message: 'Format file JSON tidak valid. Pastikan file merupakan hasil backup PSB PPTQM Darul Hikmah.' };
    }
    __memoryFallbackStorage = parsed;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {}
    return { success: true, message: `Berhasil memulihkan ${parsed.candidates.length} data calon santri dan ${parsed.profiles.length} profil pengguna.` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal membaca file JSON.' };
  }
};

export const resetStorageToDefault = (): void => {
  __memoryFallbackStorage = JSON.parse(JSON.stringify(initialData));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(__memoryFallbackStorage));
  } catch {}
};

export const generateNextRegistrationNumber = (): string => {
  const data = getStorageData();
  data.seqCounter += 1;
  saveStorageData(data);
  const formatted = String(data.seqCounter).padStart(4, '0');
  return `DH-2027-${formatted}`;
};
