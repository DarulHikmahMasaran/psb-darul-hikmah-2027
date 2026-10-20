import React, { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { cmsService, getLogoUrlWithCacheBust } from '../services/cmsService';
import { useAuth } from '../hooks/useAuth';
import { getStorageData } from '../lib/storage';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { BookOpen, LogIn, Lock, Mail, ArrowRight, UserCheck, ShieldCheck, Sparkles, Eye, EyeOff } from 'lucide-react';

export interface LoginPageProps {
  onNavigate: (route: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, loginDemoSuperAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [siteShortName, setSiteShortName] = useState('PPTQM Darul Hikmah');
  const [academicYear, setAcademicYear] = useState('2027/2028');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [isDemoModeAllowed, setIsDemoModeAllowed] = useState<boolean>(() => {
    const storageSettings = getStorageData().settings || [];
    return (storageSettings.find(s => s.key === 'public_demo_controls')?.value ?? 'false') === 'true';
  });

  useEffect(() => {
    const syncDemoFlag = () => {
      const st = getStorageData().settings || [];
      setIsDemoModeAllowed((st.find(s => s.key === 'public_demo_controls')?.value ?? 'false') === 'true');
    };
    settingsService.getSettings().then(cfg => {
      if (cfg.public_demo_controls !== undefined) {
        setIsDemoModeAllowed(cfg.public_demo_controls === 'true');
      }
    }).catch(() => {});
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
    window.addEventListener('psb-settings-updated', syncDemoFlag);
    return () => window.removeEventListener('psb-settings-updated', syncDemoFlag);
  }, []);

  const handleDemoSuperAdminLogin = () => {
    setError(null);
    const res = loginDemoSuperAdmin();
    if (res.success && res.user) {
      onNavigate('/admin/dashboard');
    } else {
      setError(res.error || 'Gagal memulai mode demo.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Silakan lengkapi email dan kata sandi Anda.');
      return;
    }

    setIsLoading(true);
    const res = await login({ email: email.trim(), password });
    setIsLoading(false);

    if (res.success && res.user) {
      if (res.user.role === 'PESERTA') {
        onNavigate('/peserta/dashboard');
      } else if (res.user.role === 'PENGUJI_QURAN') {
        onNavigate('/penguji');
      } else if (res.user.role === 'PIMPINAN') {
        onNavigate('/pimpinan');
      } else {
        onNavigate('/admin/dashboard');
      }
    } else {
      setError(res.error || 'Email atau kata sandi tidak valid.');
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="min-h-[82vh] flex flex-col justify-center items-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-5">
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
            Masuk Portal PSB
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            {siteShortName} • Tahun Pelajaran {academicYear}
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white py-6 px-5 sm:py-8 sm:px-8 rounded-2xl border border-slate-200 shadow-xs">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Alamat Email Terdaftar"
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Kata Sandi</label>
                <button
                  type="button"
                  onClick={() => onNavigate('/forgot-password')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  Lupa Kata Sandi?
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  leftIcon={<Lock className="w-4 h-4" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Tampilkan atau sembunyikan kata sandi"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
              rightIcon={<LogIn className="w-4 h-4" />}
            >
              Masuk ke Akun
            </Button>
          </form>

          {/* Quick Demo Logins Helper (Only visible if public_demo_controls === 'true') */}
          {isDemoModeAllowed && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Akun Cepat Pengujian:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('panitia@darulhikmah.sch.id')}
                  className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 text-[11px] font-medium transition"
                >
                  Panitia PSB
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('penguji.quran@darulhikmah.sch.id')}
                  className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-slate-700 text-[11px] font-medium transition"
                >
                  Penguji Qur&apos;an
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('pimpinan@darulhikmah.sch.id')}
                  className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-700 text-[11px] font-medium transition"
                >
                  Pimpinan
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@darulhikmah.sch.id')}
                  className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-700 text-[11px] font-medium transition col-span-2"
                >
                  Super Admin
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-dashed border-amber-300">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-amber-900 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mode Evaluasi Rapat / Simulasi Lokal</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDemoSuperAdminLogin}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-amber-950 font-black rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-950" />
                    <span>Masuk sebagai SUPER ADMIN (DEMO)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Link */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-center">
          <p className="text-xs text-slate-700">
            Ayah/Bunda belum membuat akun pendaftaran Ananda?
          </p>
          <button
            onClick={() => onNavigate('/register')}
            className="mt-1.5 font-extrabold text-xs text-emerald-800 hover:text-emerald-900 inline-flex items-center gap-1"
          >
            Buat Akun Pendaftaran Santri Baru <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
