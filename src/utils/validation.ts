import { Candidate } from '../types/database';

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function validatePhone(phone: string): boolean {
  // Supports formats like 081234567890, +628123456789, 628123456789
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(\+62|62|08)[0-9]{8,13}$/.test(cleaned);
}

export function validateNIK(nik?: string): boolean {
  if (!nik) return false;
  return /^[0-9]{16}$/.test(nik.trim());
}

export function validateNISN(nisn?: string): boolean {
  if (!nisn) return false;
  return /^[0-9]{10}$/.test(nisn.trim());
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateRegistrationForm(values: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!values.fullName.trim()) {
    errors.fullName = 'Nama lengkap wajib diisi.';
  } else if (values.fullName.trim().length < 3) {
    errors.fullName = 'Nama lengkap minimal 3 karakter.';
  }

  if (!values.email.trim()) {
    errors.email = 'Email wajib diisi.';
  } else if (!validateEmail(values.email)) {
    errors.email = 'Format email tidak valid (contoh: santri@gmail.com).';
  }

  if (!values.phone.trim()) {
    errors.phone = 'Nomor WhatsApp wajib diisi.';
  } else if (!validatePhone(values.phone)) {
    errors.phone = 'Nomor WhatsApp tidak valid (contoh: 081234567890).';
  }

  if (!values.password) {
    errors.password = 'Kata sandi wajib diisi.';
  } else if (values.password.length < 8) {
    errors.password = 'Kata sandi minimal 8 karakter.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Konfirmasi kata sandi wajib diisi.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Konfirmasi kata sandi tidak cocok.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateBiodataForFinalSubmission(candidate: Partial<Candidate>): {
  isValid: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];

  // Data Pribadi
  if (!candidate.full_name?.trim()) missing.push('Nama Lengkap');
  if (!candidate.nik?.trim() || !validateNIK(candidate.nik)) missing.push('NIK (16 Digit)');
  if (!candidate.nisn?.trim() || !validateNISN(candidate.nisn)) missing.push('NISN (10 Digit)');
  if (!candidate.birth_place?.trim()) missing.push('Tempat Lahir');
  if (!candidate.birth_date) missing.push('Tanggal Lahir');
  if (!candidate.gender) missing.push('Jenis Kelamin');
  if (!candidate.religion) missing.push('Agama');

  // Data Sekolah
  if (!candidate.school_name?.trim()) missing.push('Nama SD/MI Asal');

  // Alamat
  if (!candidate.address?.trim()) missing.push('Alamat Lengkap');
  if (!candidate.village?.trim()) missing.push('Desa/Kelurahan');
  if (!candidate.district?.trim()) missing.push('Kecamatan');
  if (!candidate.regency?.trim()) missing.push('Kabupaten/Kota');
  if (!candidate.province?.trim()) missing.push('Provinsi');

  // Data Orang Tua
  if (!candidate.father_name?.trim()) missing.push('Nama Ayah');
  if (!candidate.mother_name?.trim()) missing.push('Nama Ibu');

  // Data Tambahan
  if (candidate.child_order === undefined || candidate.child_order === null) missing.push('Anak ke-');
  if (candidate.sibling_count === undefined || candidate.sibling_count === null) missing.push('Jumlah Saudara');
  if (!candidate.living_status?.trim()) missing.push('Status Tinggal');

  return {
    isValid: missing.length === 0,
    missingFields: missing,
  };
}
