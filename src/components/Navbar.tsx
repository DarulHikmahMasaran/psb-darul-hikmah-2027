import { settingsService } from '../services/settingsService';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Badge } from './Badge';
import { isSupabaseConfigured } from '../lib/supabase';
import { getStorageData } from '../lib/storage';
import { cmsService, getLogoUrlWithCacheBust } from '../services/cmsService';
import {
  BookOpen,
  Menu,
  X,
  LogOut,
  User,
  Database,
  ShieldCheck,
  FileText,
  Home,
  Settings,
  Sliders,
  FolderOpen,
  FileCheck2,
  FolderLock,
  Printer,
  Calendar,
  ScanLine,
  Layers,
  Activity,
  BarChart2,
  Layout,
  Users,
  Brain,
  Award
} from 'lucide-react';

export interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenDbModal: () => void;
}

interface NavItem {
  label: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix?: string;
  accent?: 'emerald' | 'teal' | 'indigo';
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate, onOpenDbModal }) => {
  const { user, role, logout, switchUserDemo } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickRoleOpen, setQuickRoleOpen] = useState(false);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('PPTQM DARUL HIKMAH');
  const [academicYear, setAcademicYear] = useState('2027/2028');
  const isConnected = isSupabaseConfigured();
  const [isPublicDemoEnabled, setIsPublicDemoEnabled] = useState<boolean>(() => {
    const storageSettings = getStorageData().settings || [];
    return (storageSettings.find(s => s.key === 'public_demo_controls')?.value ?? 'false') === 'true';
  });

  useEffect(() => {
    const syncDemoFlag = () => {
      const st = getStorageData().settings || [];
      setIsPublicDemoEnabled((st.find(s => s.key === 'public_demo_controls')?.value ?? 'false') === 'true');
    };
    settingsService.getSettings().then(cfg => {
      if (cfg.public_demo_controls !== undefined) {
        setIsPublicDemoEnabled(cfg.public_demo_controls === 'true');
      }
    }).catch(() => {});
    window.addEventListener('psb-settings-updated', syncDemoFlag);
    return () => window.removeEventListener('psb-settings-updated', syncDemoFlag);
  }, [currentRoute]);

  const canSeeAdminTools = isPublicDemoEnabled || role === 'SUPER_ADMIN' || role === 'PANITIA';

  useEffect(() => {
    cmsService.getPublishedContent().then(snap => {
      const logo = snap?.settings?.logo_path || snap?.settings?.logo_url;
      if (logo) {
        setBrandLogo(getLogoUrlWithCacheBust(logo, snap.settings.updated_at) || null);
      } else {
        setBrandLogo(null);
      }
      if (snap?.settings?.site_short_name || snap?.settings?.site_name) {
        setBrandName(snap.settings.site_short_name || snap.settings.site_name);
      }
      if (snap?.settings?.academic_year) {
        setAcademicYear(snap.settings.academic_year);
      }
    }).catch(() => {});
  }, [currentRoute]);

  const handleNav = (route: string) => {
    onNavigate(route);
    setMobileMenuOpen(false);
    setQuickRoleOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    onNavigate('/');
  };

  // Role-based sub-navigation items (rendered in a dedicated clean 2nd tier so they NEVER collide with Logo or Profile)
  const getRoleNavItems = (): NavItem[] => {
    if (!user) return [];
    if (role === 'PESERTA') {
      return [
        { label: 'Dashboard', route: '/peserta/dashboard', icon: Home },
        { label: '1. Biodata', route: '/peserta/biodata', icon: FileText },
        { label: '2. Unggah Berkas', route: '/peserta/dokumen', icon: FolderOpen },
        { label: '3. Review & Kirim', route: '/peserta/review', icon: FileCheck2 },
        { label: 'Kartu Ujian QR', route: '/peserta/kartu', icon: Printer },
        { label: 'Jadwal Seleksi', route: '/peserta/jadwal', icon: Calendar },
        { label: 'Ujian CBT Akademik', route: '/peserta/cbt', matchPrefix: '/peserta/cbt', icon: BookOpen },
        { label: 'Psikotes CBT', route: '/peserta/psikotes', matchPrefix: '/peserta/psikotes', icon: Brain, accent: 'teal' },
      ];
    }
    if (role === 'PENGUJI_QURAN') {
      return [
        { label: 'Dashboard Penguji', route: '/penguji', icon: Home },
        { label: 'Daftar Peserta Uji', route: '/penguji/peserta', icon: Users },
        { label: 'Riwayat Penilaian', route: '/penguji/history', icon: FileCheck2 },
      ];
    }
    if (role === 'PIMPINAN') {
      return [
        { label: 'Ringkasan Eksekutif', route: '/pimpinan', icon: Home },
        { label: 'Laporan Pendaftar', route: '/pimpinan/laporan', icon: FileText },
        { label: 'Hasil CBT & Qur’an', route: '/pimpinan/hasil-seleksi', icon: BarChart2 },
        { label: 'Statistik & Asal Sekolah', route: '/pimpinan/statistik', icon: Activity },
      ];
    }
    if (role === 'PANITIA') {
      return [
        { label: 'Data Pendaftar', route: '/admin/dashboard', icon: ShieldCheck },
        { label: 'Verifikasi Berkas', route: '/admin/verifikasi-dokumen', icon: FileCheck2 },
        { label: 'Jadwal Seleksi', route: '/admin/jadwal', icon: Calendar },
        { label: 'Scan QR Presensi', route: '/admin/scan', icon: ScanLine },
        { label: 'Monitoring CBT', route: '/admin/cbt/monitoring', icon: Activity },
        { label: 'Hasil CBT', route: '/admin/cbt/hasil', icon: BarChart2 },
        { label: 'Psikotes CBT', route: '/admin/psikotes', matchPrefix: '/admin/psikotes', icon: Brain, accent: 'teal' },
        { label: 'Tes Al-Qur’an', route: '/admin/quran', matchPrefix: '/admin/quran', icon: BookOpen },
        { label: 'Hasil Seleksi', route: '/admin/selection-results', matchPrefix: '/admin/sele', icon: Award, accent: 'indigo' },
        { label: 'Draf CMS Landing', route: '/admin/landing-page', matchPrefix: '/admin/landing-page', icon: Layout },
      ];
    }
    if (role === 'SUPER_ADMIN') {
      return [
        { label: 'Pendaftar', route: '/admin/dashboard', icon: ShieldCheck },
        { label: 'Verifikasi Berkas', route: '/admin/verifikasi-dokumen', icon: FileCheck2 },
        { label: 'Jadwal', route: '/admin/jadwal', icon: Calendar },
        { label: 'Scan QR', route: '/admin/scan', icon: ScanLine },
        { label: 'Bank Soal', route: '/admin/soal', icon: BookOpen },
        { label: 'Paket Ujian', route: '/admin/cbt/ujian', icon: Layers },
        { label: 'Monitoring CBT', route: '/admin/cbt/monitoring', icon: Activity },
        { label: 'Hasil CBT', route: '/admin/cbt/hasil', icon: BarChart2 },
        { label: 'Psikotes', route: '/admin/psikotes', matchPrefix: '/admin/psikotes', icon: Brain, accent: 'teal' },
        { label: 'Tes Qur’an', route: '/admin/quran', matchPrefix: '/admin/quran', icon: BookOpen },
        { label: 'Sidang Kelulusan', route: '/admin/seleksi', matchPrefix: '/admin/sele', icon: Award, accent: 'indigo' },
        { label: 'Jenis Berkas', route: '/admin/dokumen-types', icon: FolderLock },
        { label: 'CMS Landing', route: '/admin/landing-page', matchPrefix: '/admin/landing-page', icon: Layout },
        { label: 'Pengaturan & Reset', route: '/admin/settings', icon: Settings },
        { label: 'Audit Log', route: '/admin/audit-logs', icon: FileText },
        { label: 'Portal Eksekutif', route: '/pimpinan', matchPrefix: '/pimpinan', icon: BarChart2 },
      ];
    }
    return [];
  };

  const roleNavItems = getRoleNavItems();

  const isNavItemActive = (item: NavItem) => {
    if (item.matchPrefix) {
      return currentRoute.startsWith(item.matchPrefix);
    }
    return currentRoute === item.route;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs transition-all">
      {/* TIER 1: Top Identity, Public Links (if guest), & User Profile Controls (h-16 = 64px) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Left: Logo & Brand */}
          <div
            onClick={() => handleNav('/')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none min-w-0"
          >
            {brandLogo ? (
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform duration-200 overflow-hidden shrink-0">
                <img
                  src={brandLogo}
                  alt={brandName}
                  className="w-full h-full object-contain"
                  onError={() => setBrandLogo(null)}
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-800 to-emerald-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform duration-200 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 group-hover:text-emerald-700 transition truncate">
                  {brandName}
                </span>
                <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  TP {academicYear}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                Portal Resmi Penerimaan Santri Baru (PSB)
              </p>
            </div>
          </div>

          {/* Center: Public Guest Links Only (Clean, never crowded) */}
          {!user && (
            <nav className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => handleNav('/')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  currentRoute === '/' ? 'text-emerald-800 bg-emerald-50 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Beranda
              </button>
              {[
                { label: 'Alur Seleksi', id: 'alur' },
                { label: 'Jadwal', id: 'jadwal' },
                { label: 'Syarat & Berkas', id: 'persyaratan' },
                { label: 'FAQ', id: 'faq' },
                { label: 'Kontak', id: 'kontak' },
              ].map(link => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentRoute !== '/') {
                      handleNav('/');
                      setTimeout(() => {
                        document.getElementById(link.id)?.scrollIntoView({ behavior: 'smooth' });
                      }, 120);
                    } else {
                      document.getElementById(link.id)?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-800 hover:bg-slate-50 rounded-lg transition whitespace-nowrap"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          {/* Right: Action Buttons & User Profile */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            {canSeeAdminTools && (
              <button
                onClick={onOpenDbModal}
                title="Panduan Supabase & Pengaturan Mode Produksi"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                <Database className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-600' : 'text-amber-500'}`} />
                <span>{isConnected ? 'Cloud Aktif' : 'Database'}</span>
              </button>
            )}

            {canSeeAdminTools && (
              <div className="relative">
                <button
                  onClick={() => setQuickRoleOpen(!quickRoleOpen)}
                  title="Ganti Mode Demo Role"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px]">Uji Role</span>
                </button>

                {quickRoleOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-slate-200 p-2 z-50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">
                      Simulasi Peran (Testing)
                    </div>
                    <button
                      onClick={() => {
                        switchUserDemo('PESERTA');
                        setQuickRoleOpen(false);
                        onNavigate('/peserta/dashboard');
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg flex items-center justify-between"
                    >
                      <span>Calon Santri</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">Peserta</span>
                    </button>
                    <button
                      onClick={() => {
                        switchUserDemo('PANITIA');
                        setQuickRoleOpen(false);
                        onNavigate('/admin/dashboard');
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg flex items-center justify-between"
                    >
                      <span>Panitia Verifikasi</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Panitia</span>
                    </button>
                    <button
                      onClick={() => {
                        switchUserDemo('SUPER_ADMIN');
                        setQuickRoleOpen(false);
                        onNavigate('/admin/dashboard');
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg flex items-center justify-between"
                    >
                      <span>Super Administrator</span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Admin</span>
                    </button>
                    <button
                      onClick={() => {
                        switchUserDemo('PENGUJI_QURAN');
                        setQuickRoleOpen(false);
                        onNavigate('/penguji');
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg flex items-center justify-between"
                    >
                      <span>Penguji Al-Qur&apos;an</span>
                      <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-semibold">Penguji</span>
                    </button>
                    <button
                      onClick={() => {
                        switchUserDemo('PIMPINAN');
                        setQuickRoleOpen(false);
                        onNavigate('/pimpinan');
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg flex items-center justify-between"
                    >
                      <span>Pimpinan Pesantren</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">Eksekutif</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {!user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNav('/login')}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                >
                  Masuk Akun
                </button>
                <button
                  onClick={() => handleNav('/register')}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-2xs transition"
                >
                  Daftar Santri Baru
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
                <div className="text-right max-w-[160px]">
                  <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                    {user.profile?.full_name || user.email}
                  </p>
                  <div className="mt-0.5 flex justify-end">
                    <Badge role={role || 'PESERTA'} size="sm" />
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-xs uppercase border border-emerald-300 shrink-0">
                  {user.profile?.full_name?.charAt(0) || <User className="w-4 h-4" />}
                </div>
                <button
                  onClick={handleLogout}
                  title="Keluar dari Akun"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile Right Controls */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            {canSeeAdminTools && (
              <button
                onClick={onOpenDbModal}
                title="Database / Supabase"
                className="p-2 text-slate-600 hover:text-slate-900 rounded-lg"
              >
                <Database className={`w-5 h-5 ${isConnected ? 'text-emerald-600' : 'text-amber-500'}`} />
              </button>
            )}
            {!user && (
              <button
                onClick={() => handleNav('/login')}
                className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
              >
                Masuk
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-slate-900 rounded-lg"
              aria-label="Buka menu navigasi"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* TIER 2: Dedicated Sub-Navigation Strip for Logged-In Users (Zero Overlap on All Screen Sizes!) */}
      {user && roleNavItems.length > 0 && (
        <div className="bg-slate-50/95 border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <nav
              aria-label="Menu Fitur Utama"
              className="flex items-center gap-1.5 py-2 overflow-x-auto no-scrollbar"
            >
              {roleNavItems.map(item => {
                const Icon = item.icon;
                const active = isNavItemActive(item);
                const activeClasses =
                  item.accent === 'teal'
                    ? 'bg-teal-700 text-white shadow-2xs'
                    : item.accent === 'indigo'
                    ? 'bg-indigo-700 text-white shadow-2xs'
                    : 'bg-emerald-700 text-white shadow-2xs';

                return (
                  <button
                    key={item.route}
                    type="button"
                    onClick={() => handleNav(item.route)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                      active
                        ? activeClasses
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200/80'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl max-h-[80vh] overflow-y-auto">
          {user && (
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between gap-2 border border-slate-200">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user.profile?.full_name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              </div>
              <Badge role={role || 'PESERTA'} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-1">
            {!user ? (
              <>
                <button
                  onClick={() => handleNav('/')}
                  className="text-left px-3 py-2.5 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  Beranda Utama
                </button>
                <button
                  onClick={() => handleNav('/login')}
                  className="text-left px-3 py-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl"
                >
                  Masuk Akun Santri / Panitia
                </button>
                <button
                  onClick={() => handleNav('/register')}
                  className="mt-1 px-3 py-2.5 text-xs font-extrabold text-white bg-emerald-700 rounded-xl text-center"
                >
                  Daftar Calon Santri Baru
                </button>
              </>
            ) : (
              roleNavItems.map(item => {
                const Icon = item.icon;
                const active = isNavItemActive(item);
                return (
                  <button
                    key={item.route}
                    onClick={() => handleNav(item.route)}
                    className={`text-left px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition ${
                      active
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })
            )}
          </div>

          {(canSeeAdminTools || user) && (
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              {canSeeAdminTools && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      switchUserDemo('PESERTA');
                      setMobileMenuOpen(false);
                      onNavigate('/peserta/dashboard');
                    }}
                    className="py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg font-semibold"
                  >
                    Demo Peserta
                  </button>
                  <button
                    onClick={() => {
                      switchUserDemo('PANITIA');
                      setMobileMenuOpen(false);
                      onNavigate('/admin/dashboard');
                    }}
                    className="py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg font-semibold"
                  >
                    Demo Panitia
                  </button>
                  <button
                    onClick={() => {
                      switchUserDemo('PENGUJI_QURAN');
                      setMobileMenuOpen(false);
                      onNavigate('/penguji');
                    }}
                    className="py-1.5 text-xs bg-teal-50 text-teal-800 rounded-lg font-semibold"
                  >
                    Demo Penguji
                  </button>
                  <button
                    onClick={() => {
                      switchUserDemo('PIMPINAN');
                      setMobileMenuOpen(false);
                      onNavigate('/pimpinan');
                    }}
                    className="py-1.5 text-xs bg-amber-50 text-amber-800 rounded-lg font-semibold"
                  >
                    Demo Pimpinan
                  </button>
                </div>
              )}

              {user && (
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl flex items-center justify-center gap-2 mt-1"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar dari Akun
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
