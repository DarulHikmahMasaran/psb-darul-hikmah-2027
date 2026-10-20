import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { cmsService, getLogoUrlWithCacheBust } from '../services/cmsService';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { BookOpen, UserPlus, Lock, Mail, Phone, User, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { validateRegistrationForm } from '../utils/validation';

export interface RegisterPageProps {
  onNavigate: (route: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [siteShortName, setSiteShortName] = useState('PPTQM Darul Hikmah');
  const [academicYear, setAcademicYear] = useState('2027/2028');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    cmsService.getPublishedContent().then(snap => {
      if (snap?.settings?.site_short_name || snap?.settings?.site_name) {
        setSiteShortName(snap.settings.site_short_name || snap.settings.site_name);
      }
      if (snap?.settings?.academic_year) {
        setAcademicYear(snap.settings.academic_year);
      }
      const logo = snap?.settings?.logo_path || snap?.settings?.logo_url;
      if (logo) {
        setLogoUrl(getLogoUrlWithCacheBust(logo, snap.settings.updated_at) || null);
      }
    }).catch(() => {});
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validation = validateRegistrationForm(form);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    const res = await register(form);
    setIsLoading(false);

    if (res.success && res.user) {
      onNavigate('/peserta/dashboard');
    } else {
      setServerError(res.error || 'Terjadi kesalahan saat pendaftaran. Silakan coba lagi.');
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-lg w-full space-y-5">
        {/* Brand Header */}
        <div className="text-center">
          <div
            onClick={() => onNavigate('/')}
            className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-800 to-emerald-600 items-center justify-center text-white shadow-md cursor-pointer hover:scale-105 transition overflow-hidden"
          >
            {logoUrl ? (
              <img src={logoUrl} alt={siteShortName} className="w-full h-full object-contain bg-white p-1.5" />
            ) : (
              <BookOpen className="w-7 h-7" />
            )}
          </div>
          <h1 className="mt-3.5 text-2xl font-extrabold text-slate-900 tracking-tight">
            Buat Akun Calon Santri
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            {siteShortName} • Tahun Pelajaran {academicYear}
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white py-6 px-5 sm:py-8 sm:px-8 rounded-2xl border border-slate-200 shadow-xs">
          {serverError && (
            <Alert
              type="error"
              message={serverError}
              onClose={() => setServerError(null)}
              className="mb-5"
            />
          )}

          <div className="p-3 mb-5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Nomor registrasi resmi (contoh: <strong>DH-2027-0001</strong>) otomatis diterbitkan begitu akun Ananda berhasil dibuat.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nama Lengkap Calon Santri (Ananda)"
              placeholder="Sesuai Akta Kelahiran / Rapor SD"
              value={form.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              error={formErrors.fullName}
              required
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Alamat Email Aktif (Ayah/Bunda/Wali)"
              type="email"
              placeholder="nama@email.com"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={formErrors.email}
              helperText="Digunakan untuk masuk ke portal dan menerima info hasil seleksi"
              required
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Nomor WhatsApp Aktif (Ayah/Bunda)"
              type="tel"
              placeholder="081234567890"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              error={formErrors.phone}
              helperText="Pastikan nomor terdaftar di WhatsApp untuk informasi jadwal ujian"
              required
              leftIcon={<Phone className="w-4 h-4" />}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Input
                  label="Kata Sandi"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 karakter"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  error={formErrors.password}
                  required
                  leftIcon={<Lock className="w-4 h-4" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Tampilkan kata sandi"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Input
                label="Ulangi Kata Sandi"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ketik ulang sandi"
                value={form.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                error={formErrors.confirmPassword}
                required
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-3"
              rightIcon={<UserPlus className="w-4 h-4" />}
            >
              Buat Akun &amp; Mulai Pendaftaran
            </Button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-600">
          Sudah memiliki akun pendaftaran?{' '}
          <button
            onClick={() => onNavigate('/login')}
            className="font-extrabold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Masuk ke Portal Santri
          </button>
        </p>
      </div>
    </div>
  );
};
