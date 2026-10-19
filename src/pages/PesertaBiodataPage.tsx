import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { candidateService } from '../services/candidateService';
import { Candidate } from '../types/database';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { Badge } from '../components/Badge';
import { LoadingSpinner } from '../components/Loading';
import { calculateBiodataProgress } from '../utils/progress';
import { validateNIK, validateNISN } from '../utils/validation';
import {
  Save,
  Send,
  User,
  School,
  MapPin,
  Users,
  Info,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  AlertTriangle,
  Lock
} from 'lucide-react';

export interface PesertaBiodataPageProps {
  onNavigate: (route: string) => void;
}

export const PesertaBiodataPage: React.FC<PesertaBiodataPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Candidate>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string; missing?: string[] } | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadCandidate(user.id);
    }
  }, [user?.id]);

  const loadCandidate = async (userId: string) => {
    setIsLoading(true);
    const cand = await candidateService.getCandidateByUserId(userId);
    if (cand) {
      setCandidate(cand);
      setFormData(cand);
    }
    setIsLoading(false);
  };

  const handleFieldChange = (field: keyof Candidate, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const isEditable = candidate?.status === 'DRAFT' || candidate?.status === 'PERLU_PERBAIKAN';

  const handleSaveDraft = async () => {
    if (!candidate || !user) return;
    setStatusMessage(null);
    setIsSavingDraft(true);

    const res = await candidateService.updateCandidateDraft(
      candidate.id,
      formData,
      user.id,
      user.email
    );

    setIsSavingDraft(false);

    if (res.success && res.candidate) {
      setCandidate(res.candidate);
      setStatusMessage({
        type: 'success',
        text: 'Draft biodata berhasil disimpan. Anda dapat melanjutkannya kapan saja.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Gagal menyimpan draft biodata.',
      });
    }
  };

  const handleSaveAndContinue = async () => {
    if (!candidate || !user) return;
    setStatusMessage(null);
    setIsSavingDraft(true);

    const res = await candidateService.updateCandidateDraft(
      candidate.id,
      formData,
      user.id,
      user.email
    );

    setIsSavingDraft(false);

    if (res.success && res.candidate) {
      setCandidate(res.candidate);
      onNavigate('/peserta/dokumen');
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Gagal menyimpan data biodata sebelum melanjutkan.',
      });
    }
  };

  const handleSubmitFinal = async () => {
    if (!candidate || !user) return;
    setStatusMessage(null);

    // Client-side quick checks
    if (formData.nik && !validateNIK(formData.nik)) {
      setStatusMessage({
        type: 'warning',
        text: 'Nomor NIK harus 16 digit angka sesuai Kartu Keluarga.',
      });
      return;
    }

    if (formData.nisn && !validateNISN(formData.nisn)) {
      setStatusMessage({
        type: 'warning',
        text: 'NISN harus 10 digit angka valid.',
      });
      return;
    }

    if (!confirmAction('Apakah Anda yakin data biodata sudah lengkap dan benar? Setelah dikirim, data akan diverifikasi oleh panitia.')) {
      return;
    }

    setIsSubmittingFinal(true);
    const res = await candidateService.submitCandidateFinal(
      candidate.id,
      formData,
      user.id,
      user.email
    );
    setIsSubmittingFinal(false);

    if (res.success && res.candidate) {
      setCandidate(res.candidate);
      setStatusMessage({
        type: 'success',
        text: 'Biodata berhasil dikirimkan ke Panitia PSB! Status Anda kini TERDAFTAR.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        onNavigate('/peserta/dashboard');
      }, 1500);
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Pengiriman gagal. Mohon periksa kembali kolom wajib.',
        missing: res.missingFields,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Memuat formulir biodata santri..." className="min-h-[60vh]" />;
  }

  if (!candidate) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Alert type="error" message="Data pendaftar tidak ditemukan." />
      </div>
    );
  }

  const progress = calculateBiodataProgress(formData);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar with Navigation and Status */}
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
              Formulir Biodata Santri Baru
            </h1>
            <p className="text-xs text-slate-500">
              No. Registrasi: <span className="font-mono font-bold text-emerald-800">{candidate.registration_number}</span> • TP 2027/2028
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <Badge status={candidate.status} size="md" />
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span>Kelengkapan:</span>
            <span>{progress.percentage}%</span>
          </div>
        </div>
      </div>

      {/* Locked status banner if read-only */}
      {!isEditable && (
        <Alert
          type="info"
          title="Formulir Terkunci"
          message={
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0 text-blue-600" />
              <span>
                Data saat ini berada dalam status <strong>{candidate.status}</strong>. Perubahan data hanya dapat dilakukan jika panitia memberikan izin perbaikan.
              </span>
            </div>
          }
        />
      )}

      {/* Alerts */}
      {statusMessage && (
        <Alert
          type={statusMessage.type}
          title={statusMessage.type === 'success' ? 'Sukses' : 'Perhatian'}
          message={
            <div>
              <p>{statusMessage.text}</p>
              {statusMessage.missing && statusMessage.missing.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="font-semibold text-rose-800">Kolom wajib yang belum terisi:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-rose-700">
                    {statusMessage.missing.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          }
          onClose={() => setStatusMessage(null)}
        />
      )}

      <div className="space-y-8">
        {/* SECTION 1: DATA PRIBADI */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 text-emerald-800 font-bold text-sm uppercase tracking-wider">
            <User className="w-4 h-4" />
            <span>1. Data Pribadi Calon Santri</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Nama Lengkap Calon Santri"
                value={formData.full_name || ''}
                onChange={(e) => handleFieldChange('full_name', e.target.value)}
                disabled={!isEditable}
                required
                helperText="Sesuai akta kelahiran"
              />
            </div>

            <Input
              label="Nomor Induk Kependudukan (NIK)"
              value={formData.nik || ''}
              onChange={(e) => handleFieldChange('nik', e.target.value.replace(/[^0-9]/g, '').slice(0, 16))}
              disabled={!isEditable}
              required
              placeholder="16 Digit NIK"
              helperText="Tercantum pada KK (16 digit angka)"
            />

            <Input
              label="Nomor Induk Siswa Nasional (NISN)"
              value={formData.nisn || ''}
              onChange={(e) => handleFieldChange('nisn', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              disabled={!isEditable}
              required
              placeholder="10 Digit NISN"
              helperText="10 digit nomor aktif dari SD/MI"
            />

            <Input
              label="Tempat Lahir"
              value={formData.birth_place || ''}
              onChange={(e) => handleFieldChange('birth_place', e.target.value)}
              disabled={!isEditable}
              required
              placeholder="Kota / Kabupaten lahir"
            />

            <Input
              label="Tanggal Lahir"
              type="date"
              value={formData.birth_date ? formData.birth_date.split('T')[0] : ''}
              onChange={(e) => handleFieldChange('birth_date', e.target.value)}
              disabled={!isEditable}
              required
            />

            <Select
              label="Jenis Kelamin"
              value={formData.gender || ''}
              onChange={(e) => handleFieldChange('gender', e.target.value as 'L' | 'P')}
              disabled={!isEditable}
              required
              options={[
                { value: '', label: '-- Pilih Jenis Kelamin --' },
                { value: 'L', label: 'Laki-Laki (Santri Putra)' },
                { value: 'P', label: 'Perempuan (Santri Putri)' },
              ]}
            />

            <Select
              label="Agama"
              value={formData.religion || 'Islam'}
              onChange={(e) => handleFieldChange('religion', e.target.value)}
              disabled={!isEditable}
              options={[{ value: 'Islam', label: 'Islam' }]}
            />
          </div>
        </div>

        {/* SECTION 2: DATA SEKOLAH ASAL */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 text-emerald-800 font-bold text-sm uppercase tracking-wider">
            <School className="w-4 h-4" />
            <span>2. Data Sekolah Asal (SD / MI)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Nama SD / MI Asal"
                value={formData.school_name || ''}
                onChange={(e) => handleFieldChange('school_name', e.target.value)}
                disabled={!isEditable}
                required
                placeholder="Contoh: SDIT Darul Qur'an / SDN 01 Muarasari"
              />
            </div>

            <Input
              label="NPSN Sekolah (8 Digit)"
              value={formData.school_npsn || ''}
              onChange={(e) => handleFieldChange('school_npsn', e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              disabled={!isEditable}
              placeholder="Contoh: 20234567"
            />

            <Input
              label="Nomor Induk Siswa Sekolah (NIS)"
              value={formData.school_nis || ''}
              onChange={(e) => handleFieldChange('school_nis', e.target.value)}
              disabled={!isEditable}
              placeholder="Nomor induk di buku rapor"
            />
          </div>
        </div>

        {/* SECTION 3: ALAMAT LENGKAP */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 text-emerald-800 font-bold text-sm uppercase tracking-wider">
            <MapPin className="w-4 h-4" />
            <span>3. Alamat Tempat Tinggal Sesuai KK</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <Input
                label="Alamat Lengkap (Jalan, RT / RW, No. Rumah)"
                value={formData.address || ''}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                disabled={!isEditable}
                required
                placeholder="Contoh: Jl. Pesantren No. 12, RT 03 / RW 05"
              />
            </div>

            <Input
              label="Desa / Kelurahan"
              value={formData.village || ''}
              onChange={(e) => handleFieldChange('village', e.target.value)}
              disabled={!isEditable}
              required
              placeholder="Nama Kelurahan / Desa"
            />

            <Input
              label="Kecamatan"
              value={formData.district || ''}
              onChange={(e) => handleFieldChange('district', e.target.value)}
              disabled={!isEditable}
              required
              placeholder="Nama Kecamatan"
            />

            <Input
              label="Kabupaten / Kota"
              value={formData.regency || ''}
              onChange={(e) => handleFieldChange('regency', e.target.value)}
              disabled={!isEditable}
              required
              placeholder="Contoh: Kota Bogor / Kab. Bogor"
            />

            <Input
              label="Provinsi"
              value={formData.province || ''}
              onChange={(e) => handleFieldChange('province', e.target.value)}
              disabled={!isEditable}
              required
              placeholder="Contoh: Jawa Barat"
            />

            <Input
              label="Kode Pos"
              value={formData.postal_code || ''}
              onChange={(e) => handleFieldChange('postal_code', e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
              disabled={!isEditable}
              placeholder="Contoh: 16137"
            />
          </div>
        </div>

        {/* SECTION 4: DATA ORANG TUA (AYAH & IBU) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 text-emerald-800 font-bold text-sm uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>4. Data Orang Tua Kandung</span>
          </div>

          <div className="space-y-6">
            {/* Ayah */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Data Ayah Kandung
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Nama Lengkap Ayah"
                  value={formData.father_name || ''}
                  onChange={(e) => handleFieldChange('father_name', e.target.value)}
                  disabled={!isEditable}
                  required
                  placeholder="Nama lengkap beserta gelar jika ada"
                />

                <Input
                  label="NIK Ayah (16 Digit)"
                  value={formData.father_nik || ''}
                  onChange={(e) => handleFieldChange('father_nik', e.target.value.replace(/[^0-9]/g, '').slice(0, 16))}
                  disabled={!isEditable}
                  placeholder="16 Digit NIK"
                />

                <Input
                  label="Pekerjaan Ayah"
                  value={formData.father_occupation || ''}
                  onChange={(e) => handleFieldChange('father_occupation', e.target.value)}
                  disabled={!isEditable}
                  placeholder="PNS / Wiraswasta / Karyawan / dll"
                />
              </div>
            </div>

            {/* Ibu */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Data Ibu Kandung
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Nama Lengkap Ibu"
                  value={formData.mother_name || ''}
                  onChange={(e) => handleFieldChange('mother_name', e.target.value)}
                  disabled={!isEditable}
                  required
                  placeholder="Nama lengkap beserta gelar jika ada"
                />

                <Input
                  label="NIK Ibu (16 Digit)"
                  value={formData.mother_nik || ''}
                  onChange={(e) => handleFieldChange('mother_nik', e.target.value.replace(/[^0-9]/g, '').slice(0, 16))}
                  disabled={!isEditable}
                  placeholder="16 Digit NIK"
                />

                <Input
                  label="Pekerjaan Ibu"
                  value={formData.mother_occupation || ''}
                  onChange={(e) => handleFieldChange('mother_occupation', e.target.value)}
                  disabled={!isEditable}
                  placeholder="Ibu Rumah Tangga / Guru / PNS / dll"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: DATA WALI (OPSIONAL JIKA ADA) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 mb-2 border-b border-slate-100 text-emerald-800 font-bold text-sm uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>5. Data Wali Calon Santri (Diisi jika tidak bersama orang tua kandung)</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Isi bagian ini jika santri dinaungi oleh wali (paman, kakek, atau instansi). Jika tinggal bersama orang tua, bagian ini boleh dikosongkan.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Nama Lengkap Wali"
              value={formData.guardian_name || ''}
              onChange={(e) => handleFieldChange('guardian_name', e.target.value)}
              disabled={!isEditable}
              placeholder="Nama wali"
            />

            <Input
              label="Hubungan dengan Calon Santri"
              value={formData.guardian_relationship || ''}
              onChange={(e) => handleFieldChange('guardian_relationship', e.target.value)}
              disabled={!isEditable}
              placeholder="Contoh: Paman / Kakek"
            />

            <Input
              label="Nomor WhatsApp Wali"
              value={formData.guardian_phone || ''}
              onChange={(e) => handleFieldChange('guardian_phone', e.target.value)}
              disabled={!isEditable}
              placeholder="08xxxxxxxxxx"
            />

            <Input
              label="Alamat Lengkap Wali"
              value={formData.guardian_address || ''}
              onChange={(e) => handleFieldChange('guardian_address', e.target.value)}
              disabled={!isEditable}
              placeholder="Kota tinggal wali"
            />
          </div>
        </div>

        {/* SECTION 6: DATA TAMBAHAN */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 text-emerald-800 font-bold text-sm uppercase tracking-wider">
            <Info className="w-4 h-4" />
            <span>6. Data Tambahan & Kependudukan</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Anak Ke-"
              type="number"
              min={1}
              max={20}
              value={formData.child_order !== undefined && formData.child_order !== null ? String(formData.child_order) : ''}
              onChange={(e) => handleFieldChange('child_order', parseInt(e.target.value) || 0)}
              disabled={!isEditable}
              required
              placeholder="Contoh: 1"
            />

            <Input
              label="Dari Jumlah Saudara"
              type="number"
              min={0}
              max={20}
              value={formData.sibling_count !== undefined && formData.sibling_count !== null ? String(formData.sibling_count) : ''}
              onChange={(e) => handleFieldChange('sibling_count', parseInt(e.target.value) || 0)}
              disabled={!isEditable}
              required
              placeholder="Contoh: 3"
            />

            <Select
              label="Status Tinggal Saat Ini"
              value={formData.living_status || ''}
              onChange={(e) => handleFieldChange('living_status', e.target.value)}
              disabled={!isEditable}
              required
              options={[
                { value: '', label: '-- Pilih Status Tinggal --' },
                { value: 'Tinggal Bersama Orang Tua', label: 'Tinggal Bersama Orang Tua' },
                { value: 'Tinggal Bersama Wali', label: 'Tinggal Bersama Wali' },
                { value: 'Pondok Pesantren Sebelumnya', label: 'Pondok Pesantren Sebelumnya' },
                { value: 'Lainnya', label: 'Lainnya' },
              ]}
            />
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        {isEditable ? (
          <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-600 text-center sm:text-left">
              <span className="font-semibold text-slate-800">Alur Pendaftaran:</span> Simpan data biodata, lalu lanjutkan ke tahap <strong>Unggah Berkas Persyaratan</strong>.
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                isLoading={isSavingDraft}
                leftIcon={<Save className="w-4 h-4" />}
                className="flex-1 sm:flex-none text-xs"
              >
                Simpan Draft
              </Button>

              <Button
                variant="primary"
                onClick={handleSaveAndContinue}
                isLoading={isSavingDraft}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="flex-1 sm:flex-none bg-emerald-700 hover:bg-emerald-800 font-bold text-xs"
              >
                Simpan & Lanjut ke Unggah Berkas
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-100 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-600">
            <span>Data biodata telah disubmit dan saat ini dalam proses peninjauan panitia.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate('/peserta/dokumen')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Lihat Berkas Dokumen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
