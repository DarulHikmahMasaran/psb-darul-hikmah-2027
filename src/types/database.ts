export type UserRole = 
  | 'SUPER_ADMIN'
  | 'PANITIA'
  | 'PENGUJI_QURAN'
  | 'PIMPINAN'
  | 'PESERTA';

export type CandidateStatus =
  | 'DRAFT'
  | 'TERDAFTAR'
  | 'PERLU_PERBAIKAN'
  | 'TERVERIFIKASI'
  | 'DIIZINKAN_MENGIKUTI_SELEKSI'
  | 'MENGIKUTI_SELEKSI'
  | 'SELESAI_SELEKSI'
  | 'LULUS'
  | 'CADANGAN'
  | 'TIDAK_LULUS'
  | 'DAFTAR_ULANG'
  | 'DITERIMA_FINAL'
  | 'BATAL';

export type DocumentVerificationStatus =
  | 'BELUM_UPLOAD'
  | 'MENUNGGU_VERIFIKASI'
  | 'DITERIMA'
  | 'DITOLAK';

export interface DocumentType {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_required: boolean;
  is_active: boolean;
  max_file_size_mb: number;
  allowed_mime_types: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  document_type_id: string;
  document_type?: DocumentType;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  document_number?: string;
  status: DocumentVerificationStatus;
  rejection_reason?: string;
  uploaded_by?: string;
  verified_by?: string;
  verified_by_name?: string;
  verified_at?: string;
  signed_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  user_id: string;
  registration_number: string;
  full_name: string;
  nik?: string;
  nisn?: string;
  birth_place?: string;
  birth_date?: string;
  gender?: 'L' | 'P';
  religion?: string;
  
  // Data Sekolah Asal
  school_name?: string;
  school_npsn?: string;
  school_nis?: string;
  
  // Alamat Tempat Tinggal
  address?: string;
  village?: string;
  district?: string;
  regency?: string;
  province?: string;
  postal_code?: string;
  
  // Data Orang Tua / Ayah
  father_name?: string;
  father_nik?: string;
  father_occupation?: string;
  
  // Data Ibu
  mother_name?: string;
  mother_nik?: string;
  mother_occupation?: string;
  
  // Data Wali
  guardian_name?: string;
  guardian_relationship?: string;
  guardian_phone?: string;
  guardian_address?: string;
  
  // Data Tambahan
  child_order?: number;
  sibling_count?: number;
  living_status?: string;
  
  status: CandidateStatus;
  created_at: string;
  updated_at: string;
}

export interface CandidateStatusHistory {
  id: string;
  candidate_id: string;
  old_status?: CandidateStatus | null;
  new_status: CandidateStatus;
  changed_by?: string;
  changed_by_name?: string;
  note?: string;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export type AttendanceStatus = 'BELUM_HADIR' | 'HADIR' | 'TERLAMBAT' | 'TIDAK_HADIR';

export interface TestType {
  id: string;
  code: string; // 'AKADEMIK' | 'QURAN' | 'PSIKOTES'
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TestSchedule {
  id: string;
  test_type_id: string;
  test_type?: TestType;
  title: string;
  test_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  location: string;
  room: string;
  online_url?: string;
  capacity: number;
  notes?: string;
  is_active: boolean;
  participant_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TestScheduleParticipant {
  id: string;
  schedule_id: string;
  schedule?: TestSchedule;
  candidate_id: string;
  candidate?: Candidate;
  seat_number: string;
  attendance_status: AttendanceStatus;
  attendance_note?: string;
  assigned_by?: string;
  assigned_at: string;
  scanned_by?: string;
  scanned_by_name?: string;
  scanned_at?: string;
  scan_method?: 'QR_CAMERA' | 'MANUAL';
  qr_token?: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateVerificationToken {
  id: string;
  candidate_id: string;
  token_hash: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
}

export type QrScanMethod = 'QR_CAMERA' | 'MANUAL';
export type QrScanResult =
  | 'SUCCESS'
  | 'SUCCESS_ALREADY_PRESENT'
  | 'INVALID_TOKEN'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'NOT_ELIGIBLE'
  | 'ERROR';

export interface CandidateQrScanLog {
  id: string;
  candidate_id?: string;
  candidate_name?: string;
  registration_number?: string;
  token_id?: string;
  schedule_id?: string;
  schedule_title?: string;
  scanned_by?: string;
  scanned_by_name?: string;
  scan_method: QrScanMethod;
  scan_result: QrScanResult;
  scanned_at: string;
  metadata?: Record<string, any>;
}

export interface CandidateNotification {
  id: string;
  candidate_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}
