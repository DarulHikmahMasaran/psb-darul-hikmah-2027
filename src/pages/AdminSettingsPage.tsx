import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { settingsService } from '../services/settingsService';
import { resetStorageToDefault, loadDemoSampleData, getStorageData } from '../lib/storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { SystemSetting } from '../types/database';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { Settings, Save, Trash2, Users, RefreshCw } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [settingsList, setSettingsList] = useState<SystemSetting[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [localCandidateCount, setLocalCandidateCount] = useState<number>(() => getStorageData().candidates.length);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    const list = await settingsService.getAllSettingsList();
    setSettingsList(list);
    const map: Record<string, string> = {};
    list.forEach((s) => {
      map[s.key] = s.value;
    });
    setFormData(map);
    setLocalCandidateCount(getStorageData().candidates.length);
    setIsLoading(false);
  };

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setMessage(null);

    try {
      for (const key of Object.keys(formData)) {
        await settingsService.updateSetting(key, formData[key], user.id, user.email, user.role);
      }
      setMessage({ type: 'success', text: 'Konfigurasi sistem PSB berhasil disimpan dan disinkronkan ke semua perangkat!' });
    } catch {
      setMessage({ type: 'error', text: 'Gagal memperbarui konfigurasi sistem.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDemoData = async () => {
    const confirmed = window.confirm(
      'Apakah Anda yakin ingin membersihkan seluruh data santri demo (Farhan, Zaki, Fatimah, dll.) sehingga sistem mulai bersih dari 0 pendaftar? Pengaturan sistem, CMS Landing Page, dan bank soal tetap aman.'
    );
    if (!confirmed) return;

    setIsResetting(true);
    setMessage(null);
    try {
      // 1. Bersihkan data demo lokal
      resetStorageToDefault();

      // 2. Jika terhubung ke Supabase, bersihkan juga baris demo/contoh bila ada
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase
            .from('candidates')
            .delete()
            .in('registration_number', ['DH-2027-0001', 'DH-2027-0002', 'DH-2027-0003'])
            .in('full_name', ['Muhammad Farhan Al-Ghifari', 'Ahmad Zaki Mubarak', 'Siti Fatimah Az-Zahra']);
        } catch {}
      }

      setLocalCandidateCount(getStorageData().candidates.length);
      setMessage({
        type: 'success',
        text: 'Data demo berhasil dibersihkan! Sekarang data pendaftar mulai dari 0 (Siap Produksi Resmi). Pengaturan & CMS Landing Page tetap tersimpan.',
      });
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat mereset data demo.' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleLoadSampleDemo = () => {
    loadDemoSampleData();
    setLocalCandidateCount(getStorageData().candidates.length);
    setMessage({
      type: 'success',
      text: '3 data santri contoh (Farhan, Zaki, Fatimah) berhasil dimuat untuk simulasi panitia. Klik "Bersihkan Data Demo" kapan saja untuk mengosongkannya kembali.',
    });
  };

  if (isLoading) {
    return <LoadingSpinner text="Memuat pengaturan sistem..." className="min-h-[60vh]" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-700" />
          Pengaturan Sistem &amp; Reset Data PSB
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Konfigurasi tahun ajaran, kuota, mode produksi publik, serta pembersihan data demo
        </p>
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          onClose={() => setMessage(null)}
        />
      )}

      {/* Panel Reset Data Demo ke 0 Pendaftar */}
      <div className="bg-white rounded-2xl border border-rose-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              Bersihkan / Reset Data Pendaftar Demo (Siap Produksi Resmi)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Gunakan tombol ini untuk menghapus data contoh (Santri Farhan, Zaki, Fatimah, nilai simulasi, dan riwayat percobaan) agar sistem mulai dari <strong>0 pendaftar</strong>. Konten <strong>CMS Landing Page</strong>, pengaturan rekening, rubrik Al-Qur&apos;an, dan bank soal CBT <strong>tidak ikut terhapus</strong>.
            </p>
            <p className="text-[11px] font-semibold text-emerald-800 pt-1">
              Status Data Simulasi Lokal Saat Ini: {localCandidateCount} Santri
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isResetting}
              onClick={handleResetDemoData}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Bersihkan Data Demo (Reset ke 0)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadSampleDemo}
              leftIcon={<Users className="w-3.5 h-3.5" />}
            >
              Muat 3 Santri Contoh
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveAll} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Tahun Pelajaran PSB"
            value={formData.psb_year || '2027/2028'}
            onChange={(e) => handleChange('psb_year', e.target.value)}
            helperText="Key: psb_year"
            required
          />

          <Input
            label="Nama Lembaga / Pondok Pesantren"
            value={formData.school_name || 'PPTQM Darul Hikmah'}
            onChange={(e) => handleChange('school_name', e.target.value)}
            helperText="Key: school_name"
            required
          />

          <Input
            label="Jenjang Pendidikan"
            value={formData.school_level || 'SMP (Sekolah Menengah Pertama)'}
            onChange={(e) => handleChange('school_level', e.target.value)}
            helperText="Key: school_level"
            required
          />

          <Input
            label="Gelombang Pendaftaran Aktif"
            value={formData.registration_batch || 'Gelombang 1'}
            onChange={(e) => handleChange('registration_batch', e.target.value)}
            helperText="Key: registration_batch"
            required
          />

          <Input
            label="Target Kuota Santri Baru"
            type="number"
            value={formData.target_quota || '120'}
            onChange={(e) => handleChange('target_quota', e.target.value)}
            helperText="Key: target_quota (Santri Putra & Putri)"
            required
          />

          <Input
            label="Biaya Infaq Pendaftaran (Rp)"
            value={formData.registration_fee || '350000'}
            onChange={(e) => handleChange('registration_fee', e.target.value)}
            helperText="Key: registration_fee"
            required
          />

          <Input
            label="Tanggal Buka Pendaftaran"
            type="date"
            value={formData.registration_start_date || '2026-10-01'}
            onChange={(e) => handleChange('registration_start_date', e.target.value)}
            helperText="Key: registration_start_date"
          />

          <Input
            label="Batas Akhir Pendaftaran"
            type="date"
            value={formData.registration_end_date || '2026-12-31'}
            onChange={(e) => handleChange('registration_end_date', e.target.value)}
            helperText="Key: registration_end_date"
          />

          <Input
            label="Nomor WhatsApp Helpdesk Panitia"
            value={formData.contact_wa || '+62 812-3456-7890'}
            onChange={(e) => handleChange('contact_wa', e.target.value)}
            helperText="Key: contact_wa"
            required
          />

          <Input
            label="Alamat Email Sekretariat PSB"
            type="email"
            value={formData.contact_email || 'psb@darulhikmah.sch.id'}
            onChange={(e) => handleChange('contact_email', e.target.value)}
            helperText="Key: contact_email"
            required
          />

          <Input
            label="Kota Penetapan Tanda Tangan (Kartu Ujian & SKL)"
            value={formData.committee_city || 'Surakarta'}
            onChange={(e) => handleChange('committee_city', e.target.value)}
            helperText="Key: committee_city (Tampil di Kartu Ujian)"
            required
          />

          <Input
            label="Nama Ketua Panitia PSB"
            value={formData.committee_head_name || 'Ustadz Ridwan Robbani, S.Pd'}
            onChange={(e) => handleChange('committee_head_name', e.target.value)}
            helperText="Key: committee_head_name (Tanda tangan Kartu Ujian)"
            required
          />

          <Input
            label="NIP / NIY Ketua Panitia PSB"
            value={formData.committee_head_id || 'NIY. 19890412.201402.1.002'}
            onChange={(e) => handleChange('committee_head_id', e.target.value)}
            helperText="Key: committee_head_id"
            required
          />

          <Input
            label="Nama Bank Rekening Resmi PSB"
            value={formData.bank_name || 'Bank Syariah Indonesia (BSI)'}
            onChange={(e) => handleChange('bank_name', e.target.value)}
            helperText="Key: bank_name"
            required
          />

          <Input
            label="Nomor Rekening Resmi PSB"
            value={formData.bank_account_number || '7123456789'}
            onChange={(e) => handleChange('bank_account_number', e.target.value)}
            helperText="Key: bank_account_number"
            required
          />

          <Input
            label="Atas Nama Pemilik Rekening"
            value={formData.bank_account_holder || 'Yayasan PPTQM Darul Hikmah'}
            onChange={(e) => handleChange('bank_account_holder', e.target.value)}
            helperText="Key: bank_account_holder"
            required
          />

          <Input
            label="Biaya Daftar Ulang Santri Lulus (Rp)"
            value={formData.reregistration_fee || '4500000'}
            onChange={(e) => handleChange('reregistration_fee', e.target.value)}
            helperText="Key: reregistration_fee"
            required
          />

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-bold text-emerald-950 mb-1">
                Mode Tampilan Publik (Keamanan Tombol Uji Role)
              </label>
              <p className="text-[11px] text-emerald-800 mb-2">
                Pilih <strong>Mode Produksi Resmi</strong> saat link disebarkan ke wali santri agar tombol Uji Role &amp; Demo disembunyikan di semua HP &amp; laptop.
              </p>
            </div>
            <select
              value={formData.public_demo_controls || 'false'}
              onChange={(e) => handleChange('public_demo_controls', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-slate-800"
            >
              <option value="false">Mode Produksi Resmi (Sembunyikan Uji Role dari Publik)</option>
              <option value="true">Mode Evaluasi / Simulasi Rapat (Tombol Uji Role Tampil)</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            * Setiap perubahan langsung tersimpan ke database Supabase dan tersinkron ke semua perangkat.
          </span>
          <Button
            type="submit"
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Simpan Konfigurasi
          </Button>
        </div>
      </form>
    </div>
  );
};
