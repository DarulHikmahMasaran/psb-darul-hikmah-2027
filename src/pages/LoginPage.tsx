import React, { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { useAuth } from '../hooks/useAuth';
import { getStorageData } from '../lib/storage';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { BookOpen, LogIn, Lock, Mail, ArrowRight, UserCheck, ShieldCheck, Sparkles } from 'lucide-react';

export interface LoginPageProps {
  onNavigate: (route: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, loginDemoSuperAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div
            onClick={() => onNavigate('/')}
            className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-800 to-emerald-600 items-center justify-center text-white shadow-md cursor-pointer hover:scale-105 transition"
          >
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-900 tracking-tight">
            Masuk Portal PSB
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Penerimaan Santri Baru PPTQM Darul Hikmah TP 2027/2028
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white py-8 px-6 sm:px-8 rounded-2xl border border-slate-200 shadow-sm">
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
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                >
                  Lupa Kata Sandi?
                </button>
              </div>
              <Input
                type="password"
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
              rightIcon={<LogIn className="w-4 h-4" />}
            >
              Masuk Sekarang
            </Button>
          </form>

          {/* Quick Demo Logins Helper */}
          {isDemoModeAllowed && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              Akun Cepat Pengujian:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('farhan@example.com')}
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 text-[11px] font-medium transition"
              >
                Santri Farhan
              </button>
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
                Penguji Qur'an
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
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-700 text-[11px] font-medium transition col-span-2 sm:col-span-1"
              >
                Super Admin
              </button>
            </div>

            {/* Explicit Demo Super Admin Button for Evaluation / Meetings */}
            {isDemoModeAllowed && (
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
                  <p className="text-[10px] text-amber-800">
                    Sesi demo lokal sementara untuk rapat internal tanpa koneksi ke Supabase Auth production.
                  </p>
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-600">
          Belum memiliki akun calon santri?{' '}
          <button
            onClick={() => onNavigate('/register')}
            className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
          >
            Daftar Santri Baru Sekarang <ArrowRight className="w-3 h-3" />
          </button>
        </p>
      </div>
    </div>
  );
};
