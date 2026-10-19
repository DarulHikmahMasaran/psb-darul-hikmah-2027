import { UserRole } from '../types/database';

/**
 * ============================================================================
 * PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
 * ROLE-BASED ACCESS CONTROL (RBAC) PERMISSION MATRIX
 * ============================================================================
 * 
 * Prinsip: DEFAULT DENY.
 * Jika permission tidak terdaftar untuk role tertentu, maka akses DITOLAK (403).
 */

export type AppPermission =
  // Pendaftar / Calon Santri
  | 'CANDIDATE_VIEW'
  | 'CANDIDATE_CREATE'
  | 'CANDIDATE_UPDATE'
  | 'CANDIDATE_DELETE'

  // Berkas & Dokumen Persyaratan
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_VERIFY'
  | 'DOCUMENT_REJECT'

  // Jadwal Seleksi
  | 'SCHEDULE_VIEW'
  | 'SCHEDULE_MANAGE'
  | 'SCHEDULE_ASSIGN'

  // Presensi & Scan QR
  | 'QR_SCAN'
  | 'ATTENDANCE_MANAGE'

  // Bank Soal CBT
  | 'QUESTION_VIEW'
  | 'QUESTION_MANAGE'

  // Ujian CBT Akademik
  | 'CBT_VIEW'
  | 'CBT_MANAGE'
  | 'CBT_MONITOR'
  | 'CBT_RESULT_VIEW'
  | 'CBT_FORCE_SUBMIT'
  | 'CBT_RESET'

  // Modul Psikotes CBT
  | 'PSYCHOTEST_VIEW'
  | 'PSYCHOTEST_MANAGE'
  | 'PSYCHOTEST_MONITOR'
  | 'PSYCHOTEST_RESULT_VIEW'
  | 'PSYCHOTEST_QUESTION_MANAGE'
  | 'PSYCHOTEST_SCORING_MANAGE'

  // Tes Al-Qur'an (Tahfidz, Tajwid, Makharij)
  | 'QURAN_VIEW'
  | 'QURAN_ASSIGN'
  | 'QURAN_ASSESS'
  | 'QURAN_REVIEW'
  | 'QURAN_UNLOCK'
  | 'QURAN_RUBRIC_MANAGE'

  // Penilaian & Scoring Seleksi
  | 'SCORE_VIEW'
  | 'SCORE_MANAGE'
  | 'SCORE_RECALCULATE'
  | 'SELECTION_RUN_MANAGE'
  | 'SELECTION_TIE_RESOLVE'

  // Aturan Kelulusan & Kuota
  | 'PASSING_RULE_MANAGE'
  | 'QUOTA_MANAGE'

  // Hasil Seleksi & Pengumuman
  | 'RESULT_REVIEW'
  | 'RESULT_APPROVE'
  | 'RESULT_PUBLISH'

  // CMS Landing Page
  | 'CMS_VIEW'
  | 'CMS_EDIT'
  | 'CMS_PUBLISH'
  | 'CMS_ROLLBACK'
  | 'CMS_ASSET_MANAGE'

  // Manajemen Akun & Pengaturan Sistem
  | 'USER_MANAGE'
  | 'ROLE_MANAGE'
  | 'SYSTEM_SETTINGS'
  | 'AUDIT_VIEW'
  | 'AUDIT_DELETE'
  | 'BACKUP_MANAGE'

  // Daftar Ulang Santri
  | 'REENROLLMENT_VIEW'
  | 'REENROLLMENT_MANAGE'

  // Portal Eksekutif (Pimpinan)
  | 'EXECUTIVE_VIEW'

  // Self-Service Calon Santri (Peserta)
  | 'SELF_PROFILE_VIEW'
  | 'SELF_PROFILE_EDIT'
  | 'SELF_DOCUMENT_UPLOAD'
  | 'SELF_CBT_TAKE'
  | 'SELF_PSYCHOTEST_TAKE'
  | 'SELF_CARD_VIEW';

/**
 * Pemetaan Lengkap Hak Akses (Permission Matrix) Berdasarkan Role Resmi:
 * 1. SUPER_ADMIN: Seluruh izin (Full Administrator)
 * 2. PANITIA: Operasional PSB harian (Verifikasi, Jadwal, Presensi, Monitoring, Draft CMS)
 * 3. PENGUJI_QURAN: Penilai Al-Qur'an luring terbatas pada peserta tugasnya
 * 4. PIMPINAN: Eksekutif read-only rekap & hasil (TIDAK ADA WRITE PERMISSION)
 * 5. PESERTA: Self-service pendaftar santri
 */
export const ROLE_PERMISSIONS: Record<UserRole, Set<AppPermission>> = {
  SUPER_ADMIN: new Set<AppPermission>([
    'CANDIDATE_VIEW',
    'CANDIDATE_CREATE',
    'CANDIDATE_UPDATE',
    'CANDIDATE_DELETE',
    'DOCUMENT_VIEW',
    'DOCUMENT_VERIFY',
    'DOCUMENT_REJECT',
    'SCHEDULE_VIEW',
    'SCHEDULE_MANAGE',
    'SCHEDULE_ASSIGN',
    'QR_SCAN',
    'ATTENDANCE_MANAGE',
    'QUESTION_VIEW',
    'QUESTION_MANAGE',
    'CBT_VIEW',
    'CBT_MANAGE',
    'CBT_MONITOR',
    'CBT_RESULT_VIEW',
    'CBT_FORCE_SUBMIT',
    'CBT_RESET',
    'PSYCHOTEST_VIEW',
    'PSYCHOTEST_MANAGE',
    'PSYCHOTEST_MONITOR',
    'PSYCHOTEST_RESULT_VIEW',
    'PSYCHOTEST_QUESTION_MANAGE',
    'PSYCHOTEST_SCORING_MANAGE',
    'QURAN_VIEW',
    'QURAN_ASSIGN',
    'QURAN_ASSESS',
    'QURAN_REVIEW',
    'QURAN_UNLOCK',
    'QURAN_RUBRIC_MANAGE',
    'SCORE_VIEW',
    'SCORE_MANAGE',
    'SCORE_RECALCULATE',
    'SELECTION_RUN_MANAGE',
    'SELECTION_TIE_RESOLVE',
    'PASSING_RULE_MANAGE',
    'QUOTA_MANAGE',
    'RESULT_REVIEW',
    'RESULT_APPROVE',
    'RESULT_PUBLISH',
    'CMS_VIEW',
    'CMS_EDIT',
    'CMS_PUBLISH',
    'CMS_ROLLBACK',
    'CMS_ASSET_MANAGE',
    'USER_MANAGE',
    'ROLE_MANAGE',
    'SYSTEM_SETTINGS',
    'AUDIT_VIEW',
    'AUDIT_DELETE',
    'BACKUP_MANAGE',
    'REENROLLMENT_VIEW',
    'REENROLLMENT_MANAGE',
    'EXECUTIVE_VIEW',
  ]),

  PANITIA: new Set<AppPermission>([
    // Operasional Calon Santri
    'CANDIDATE_VIEW',
    'CANDIDATE_CREATE',
    'CANDIDATE_UPDATE',
    // Operasional Berkas
    'DOCUMENT_VIEW',
    'DOCUMENT_VERIFY',
    'DOCUMENT_REJECT',
    // Operasional Jadwal
    'SCHEDULE_VIEW',
    'SCHEDULE_MANAGE',
    'SCHEDULE_ASSIGN',
    // Operasional Presensi & QR
    'QR_SCAN',
    'ATTENDANCE_MANAGE',
    // Monitoring CBT & Hasil
    'CBT_VIEW',
    'CBT_MONITOR',
    'CBT_RESULT_VIEW',
    // Operasional Psikotes Monitoring & Hasil (TIDAK BISA EDIT SOAL / PAKET / SCORING)
    'PSYCHOTEST_VIEW',
    'PSYCHOTEST_MONITOR',
    'PSYCHOTEST_RESULT_VIEW',
    // Operasional Tes Qur'an
    'QURAN_VIEW',
    'QURAN_ASSIGN',
    'QURAN_REVIEW', // Bisa melihat dan minta koreksi
    // Penilaian & Review
    'SCORE_VIEW',
    'RESULT_REVIEW',
    // CMS (Hanya Edit Draft, TIDAK BISA PUBLISH / ROLLBACK)
    'CMS_VIEW',
    'CMS_EDIT',
    // Daftar Ulang Operasional
    'REENROLLMENT_VIEW',
    'REENROLLMENT_MANAGE',
    // Audit Read-Only is restricted to Super Admin
    // AUDIT_VIEW: OFF (Khusus Super Admin)

    // PERMISSION YANG DILARANG / OFF SECARA DEFAULT UNTUK PANITIA:
    // CANDIDATE_DELETE: OFF
    // QUESTION_MANAGE: OFF
    // CBT_MANAGE: OFF
    // CBT_FORCE_SUBMIT: OFF
    // CBT_RESET: OFF
    // PSYCHOTEST_MANAGE: OFF
    // PSYCHOTEST_QUESTION_MANAGE: OFF
    // PSYCHOTEST_SCORING_MANAGE: OFF
    // QURAN_UNLOCK: OFF
    // QURAN_RUBRIC_MANAGE: OFF
    // SCORE_MANAGE: OFF
    // SCORE_RECALCULATE: OFF
    // PASSING_RULE_MANAGE: OFF
    // QUOTA_MANAGE: OFF
    // RESULT_APPROVE: OFF
    // RESULT_PUBLISH: OFF
    // CMS_PUBLISH: OFF
    // CMS_ROLLBACK: OFF
    // CMS_ASSET_MANAGE: OFF
    // USER_MANAGE: OFF
    // ROLE_MANAGE: OFF
    // SYSTEM_SETTINGS: OFF
    // AUDIT_VIEW: OFF
    // AUDIT_DELETE: OFF
    // BACKUP_MANAGE: OFF
  ]),

  PENGUJI_QURAN: new Set<AppPermission>([
    // Sangat terbatas pada penilaian Al-Qur'an peserta yang ditugaskan (TIDAK MEMILIKI AKSES KE PSIKOTES)
    'QURAN_VIEW',
    'QURAN_ASSESS',
  ]),

  PIMPINAN: new Set<AppPermission>([
    // EXECUTIVE READ-ONLY (Tidak ada izin modifikasi/write)
    'EXECUTIVE_VIEW',
    'SCORE_VIEW',
    'CBT_RESULT_VIEW',
    'PSYCHOTEST_RESULT_VIEW',
    'RESULT_REVIEW',
    'QURAN_VIEW',
  ]),

  PESERTA: new Set<AppPermission>([
    // Self-Service Calon Santri
    'SELF_PROFILE_VIEW',
    'SELF_PROFILE_EDIT',
    'SELF_DOCUMENT_UPLOAD',
    'SELF_CBT_TAKE',
    'SELF_PSYCHOTEST_TAKE',
    'SELF_CARD_VIEW',
  ]),
};

/**
 * Pengecekan Izin (Permission Check) Terpusat:
 * Mengembalikan TRUE jika role memiliki permission yang diminta.
 * Mengembalikan FALSE jika role tidak valid atau permission tidak dimiliki (DEFAULT DENY).
 */
export const hasPermission = (
  role: UserRole | null | undefined,
  permission: AppPermission
): boolean => {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.has(permission);
};

export const hasAnyPermission = (
  role: UserRole | null | undefined,
  permissions: AppPermission[]
): boolean => {
  if (!role) return false;
  return permissions.some((p) => hasPermission(role, p));
};

export const hasAllPermissions = (
  role: UserRole | null | undefined,
  permissions: AppPermission[]
): boolean => {
  if (!role) return false;
  return permissions.every((p) => hasPermission(role, p));
};

/**
 * Assertion Izin untuk Service Layer:
 * Melempar Error jika role tidak memiliki izin.
 */
export const assertPermission = (
  role: UserRole | null | undefined,
  permission: AppPermission,
  actionDescription?: string
): void => {
  if (!hasPermission(role, permission)) {
    const roleName = role || 'ANONYMOUS';
    const desc = actionDescription ? ` untuk "${actionDescription}"` : '';
    throw new Error(
      `Akses Ditolak (403): Role "${roleName}" tidak memiliki hak akses [${permission}]${desc}.`
    );
  }
};

/**
 * Role Checkers & Action Authorizers
 */
export const isSuperAdmin = (role: UserRole | null | undefined): boolean => role === 'SUPER_ADMIN';
export const isPanitia = (role: UserRole | null | undefined): boolean => role === 'PANITIA';
export const isPengujiQuran = (role: UserRole | null | undefined): boolean => role === 'PENGUJI_QURAN';
export const isPimpinan = (role: UserRole | null | undefined): boolean => role === 'PIMPINAN';
export const isPeserta = (role: UserRole | null | undefined): boolean => role === 'PESERTA';

export const canPublishCms = (role: UserRole | null | undefined): boolean => hasPermission(role, 'CMS_PUBLISH');
export const canUnlockQuran = (role: UserRole | null | undefined): boolean => hasPermission(role, 'QURAN_UNLOCK');
export const canManageGraduation = (role: UserRole | null | undefined): boolean => hasPermission(role, 'RESULT_APPROVE');
export const canForceSubmitCbt = (role: UserRole | null | undefined): boolean => hasPermission(role, 'CBT_FORCE_SUBMIT');
export const canResetCbtAttempt = (role: UserRole | null | undefined): boolean => hasPermission(role, 'CBT_RESET');
export const canManageQuestions = (role: UserRole | null | undefined): boolean => hasPermission(role, 'QUESTION_MANAGE');
export const canManageExams = (role: UserRole | null | undefined): boolean => hasPermission(role, 'CBT_MANAGE');
export const canManageSettings = (role: UserRole | null | undefined): boolean => hasPermission(role, 'SYSTEM_SETTINGS');
export const canManagePsychotest = (role: UserRole | null | undefined): boolean => hasPermission(role, 'PSYCHOTEST_MANAGE');
export const canManagePsychotestScoring = (role: UserRole | null | undefined): boolean => hasPermission(role, 'PSYCHOTEST_SCORING_MANAGE');
export const canManagePsychotestQuestions = (role: UserRole | null | undefined): boolean => hasPermission(role, 'PSYCHOTEST_QUESTION_MANAGE');
export const canViewPsychotestMonitoring = (role: UserRole | null | undefined): boolean => hasPermission(role, 'PSYCHOTEST_MONITOR');
export const canTakePsychotest = (role: UserRole | null | undefined): boolean => hasPermission(role, 'SELF_PSYCHOTEST_TAKE');
