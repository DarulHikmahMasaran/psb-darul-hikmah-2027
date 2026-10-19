import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { BookOpen, UserPlus, Lock, Mail, Phone, User, CheckCircle2 } from 'lucide-react';
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

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-lg w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div
            onClick={() => onNavigate('/')}
            className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-800 to-emerald-600 items-center justify-center text-white shadow-md cursor-pointer hover:scale-105 transition"
          >
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-900 tracking-tight">
            Pendaftaran Santri Baru
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Jenjang SMP PPTQM Darul Hikmah • Tahun Pelajaran 2027/2028
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white py-8 px-6 sm:px-8 rounded-2xl border border-slate-200 shadow-sm">
          {serverError && (
            <Alert
              type="error"
              message={serverError}
              onClose={() => setServerError(null)}
              className="mb-5"
            />
          )}

          <div className="p-3 mb-5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Nomor pendaftaran resmi (misal: <strong>DH-2027-0002</strong>) akan diterbitkan secara otomatis oleh sistem setelah akun Anda dibuat.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nama Lengkap Calon Santri"
              placeholder="Sesuai akta kelahiran / ijazah SD"
              value={form.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              error={formErrors.fullName}
              required
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Alamat Email Aktif"
              type="email"
              placeholder="santri@email.com"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={formErrors.email}
              helperText="Digunakan untuk login dan notifikasi kelulusan seleksi"
              required
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Nomor WhatsApp Aktif (Orang Tua / Santri)"
              type="tel"
              placeholder="081234567890"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              error={formErrors.phone}
              helperText="Format: 08xxx (Wajib aktif untuk koordinasi panitia PSB)"
              required
              leftIcon={<Phone className="w-4 h-4" />}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Kata Sandi"
                type="password"
                placeholder="Minimal 8 karakter"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                error={formErrors.password}
                required
                leftIcon={<Lock className="w-4 h-4" />}
              />

              <Input
                label="Konfirmasi Kata Sandi"
                type="password"
                placeholder="Ulangi kata sandi"
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
              Daftar & Dapatkan Nomor Registrasi
            </Button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-600">
          Sudah pernah mendaftar?{' '}
          <button
            onClick={() => onNavigate('/login')}
            className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Masuk ke Akun Anda
          </button>
        </p>
      </div>
    </div>
  );
};
