import { Candidate } from '../types/database';

export interface SectionProgress {
  name: string;
  total: number;
  filled: number;
  isComplete: boolean;
}

export interface BiodataProgressResult {
  percentage: number;
  isAllMandatoryFilled: boolean;
  sections: Record<string, SectionProgress>;
}

export function calculateBiodataProgress(candidate?: Partial<Candidate> | null): BiodataProgressResult {
  if (!candidate) {
    return {
      percentage: 0,
      isAllMandatoryFilled: false,
      sections: {},
    };
  }

  // 1. Data Pribadi (Weight: 7 fields)
  const pribadiFields = [
    Boolean(candidate.full_name?.trim()),
    Boolean(candidate.nik && candidate.nik.length === 16),
    Boolean(candidate.nisn && candidate.nisn.length === 10),
    Boolean(candidate.birth_place?.trim()),
    Boolean(candidate.birth_date),
    Boolean(candidate.gender),
    Boolean(candidate.religion?.trim()),
  ];
  const pribadiFilled = pribadiFields.filter(Boolean).length;

  // 2. Data Sekolah (Weight: 3 fields)
  const sekolahFields = [
    Boolean(candidate.school_name?.trim()),
    Boolean(candidate.school_npsn?.trim()),
    Boolean(candidate.school_nis?.trim()),
  ];
  const sekolahFilled = sekolahFields.filter(Boolean).length;

  // 3. Alamat (Weight: 6 fields)
  const alamatFields = [
    Boolean(candidate.address?.trim()),
    Boolean(candidate.village?.trim()),
    Boolean(candidate.district?.trim()),
    Boolean(candidate.regency?.trim()),
    Boolean(candidate.province?.trim()),
    Boolean(candidate.postal_code?.trim()),
  ];
  const alamatFilled = alamatFields.filter(Boolean).length;

  // 4. Data Orang Tua / Ayah & Ibu (Weight: 6 fields)
  const ortuFields = [
    Boolean(candidate.father_name?.trim()),
    Boolean(candidate.father_nik?.trim()),
    Boolean(candidate.father_occupation?.trim()),
    Boolean(candidate.mother_name?.trim()),
    Boolean(candidate.mother_nik?.trim()),
    Boolean(candidate.mother_occupation?.trim()),
  ];
  const ortuFilled = ortuFields.filter(Boolean).length;

  // 5. Data Tambahan (Weight: 3 fields)
  const tambahanFields = [
    candidate.child_order !== undefined && candidate.child_order !== null && candidate.child_order > 0,
    candidate.sibling_count !== undefined && candidate.sibling_count !== null && candidate.sibling_count >= 0,
    Boolean(candidate.living_status?.trim()),
  ];
  const tambahanFilled = tambahanFields.filter(Boolean).length;

  const totalPossible = pribadiFields.length + sekolahFields.length + alamatFields.length + ortuFields.length + tambahanFields.length;
  const totalFilled = pribadiFilled + sekolahFilled + alamatFilled + ortuFilled + tambahanFilled;

  const percentage = Math.round((totalFilled / totalPossible) * 100);

  // Mandatory checks for finalization
  const isMandatoryPribadi = Boolean(candidate.full_name && candidate.nik && candidate.nisn && candidate.birth_place && candidate.birth_date && candidate.gender);
  const isMandatorySekolah = Boolean(candidate.school_name);
  const isMandatoryAlamat = Boolean(candidate.address && candidate.village && candidate.district && candidate.regency && candidate.province);
  const isMandatoryOrtu = Boolean(candidate.father_name && candidate.mother_name);
  const isMandatoryTambahan = candidate.child_order !== undefined && candidate.sibling_count !== undefined && Boolean(candidate.living_status);

  const isAllMandatoryFilled = isMandatoryPribadi && isMandatorySekolah && isMandatoryAlamat && isMandatoryOrtu && isMandatoryTambahan;

  return {
    percentage,
    isAllMandatoryFilled,
    sections: {
      pribadi: { name: 'Data Pribadi', total: pribadiFields.length, filled: pribadiFilled, isComplete: pribadiFilled >= 6 },
      sekolah: { name: 'Data Sekolah Asal', total: sekolahFields.length, filled: sekolahFilled, isComplete: sekolahFilled >= 1 },
      alamat: { name: 'Alamat Tempat Tinggal', total: alamatFields.length, filled: alamatFilled, isComplete: alamatFilled >= 5 },
      ortu: { name: 'Data Orang Tua', total: ortuFields.length, filled: ortuFilled, isComplete: ortuFilled >= 4 },
      tambahan: { name: 'Data Tambahan', total: tambahanFields.length, filled: tambahanFilled, isComplete: tambahanFilled >= 2 },
    },
  };
}
