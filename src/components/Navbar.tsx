import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Badge } from './Badge';
import { isSupabaseConfigured } from '../lib/supabase';
import { getStorageData } from '../lib/storage';
import { cmsService, getLogoUrlWithCacheBust } from '../services/cmsService';
import { hasPermission } from '../lib/permissions';
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
  GraduationCap,
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

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate, onOpenDbModal }) => {
  const { user, role, logout, switchUserDemo } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickRoleOpen, setQuickRoleOpen] = useState(false);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('PPTQM DARUL HIKMAH');
  const [academicYear, setAcademicYear] = useState('2027/2028');
  const isConnected = isSupabaseConfigured();
  const storageSettings = getStorageData().settings || [];
  const isPublicDemoEnabled = (storageSettings.find(s => s.key === 'public_demo_controls')?.value ?? 'true') !== 'false';
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
    }).catch(err => {
      console.warn('Navbar could not load published CMS settings', err);
    });
  }, [currentRoute]);

  const handleNav = (route: string) => {
    onNavigate(route);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand */}
          <div
            onClick={() => handleNav('/')}
            className="flex items-center gap-3.5 cursor-pointer group select-none"
          >
            {brandLogo ? (
              <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-xs group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                <img
                  src={brandLogo}
                  alt={brandName}
                  className="w-full h-full object-contain"
                  onError={() => setBrandLogo(null)}
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-800 to-emerald-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform duration-200">
                <BookOpen className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-emerald-700 transition">
                  {brandName}
                </span>
                <span className="hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                  SMP TP {academicYear}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium tracking-normal">
                Penerimaan Santri Baru (PSB Online)
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {!user ? (
              <>
                <button
                  onClick={() => handleNav('/')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg transition ${
                    currentRoute === '/' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Beranda
                </button>
                <a
                  href="#persyaratan"
                  onClick={(e) => {
                    if (currentRoute !== '/') {
                      e.preventDefault();
                      handleNav('/');
                      setTimeout(() => {
                        document.getElementById('persyaratan')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition"
                >
                  Persyaratan
                </a>
                <a
                  href="#alur"
                  onClick={(e) => {
                    if (currentRoute !== '/') {
                      e.preventDefault();
                      handleNav('/');
                      setTimeout(() => {
                        document.getElementById('alur')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition"
                >
                  Alur Seleksi
                </a>
                <a
                  href="#jadwal"
                  onClick={(e) => {
                    if (currentRoute !== '/') {
                      e.preventDefault();
                      handleNav('/');
                      setTimeout(() => {
                        document.getElementById('jadwal')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition"
                >
                  Jadwal
                </a>
                <a
                  href="#faq"
                  onClick={(e) => {
                    if (currentRoute !== '/') {
                      e.preventDefault();
                      handleNav('/');
                      setTimeout(() => {
                        document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition"
                >
                  FAQ
                </a>
              </>
            ) : role === 'PENGUJI_QURAN' ? (
              <>
                <button
                  onClick={() => handleNav('/penguji')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/penguji'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Dashboard Penguji
                </button>
                <button
                  onClick={() => handleNav('/penguji/peserta')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/penguji/peserta'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Daftar Peserta
                </button>
                <button
                  onClick={() => handleNav('/penguji/history')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/penguji/history'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Riwayat Penilaian
                </button>
              </>
            ) : role === 'PIMPINAN' ? (
              <>
                <button
                  onClick={() => handleNav('/pimpinan')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/pimpinan'
                      ? 'text-emerald-700 bg-emerald-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Ringkasan Eksekutif
                </button>
                <button
                  onClick={() => handleNav('/pimpinan/laporan')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/pimpinan/laporan'
                      ? 'text-emerald-700 bg-emerald-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Laporan Pendaftar
                </button>
                <button
                  onClick={() => handleNav('/pimpinan/hasil-seleksi')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/pimpinan/hasil-seleksi'
                      ? 'text-emerald-700 bg-emerald-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Hasil Seleksi (CBT & Qur'an)
                </button>
                <button
                  onClick={() => handleNav('/pimpinan/statistik')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/pimpinan/statistik'
                      ? 'text-emerald-700 bg-emerald-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Statistik & Tren
                </button>
              </>
            ) : role === 'PESERTA' ? (
              <>
                <button
                  onClick={() => handleNav('/peserta/dashboard')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/peserta/dashboard'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Dashboard
                </button>
                <button
                  onClick={() => handleNav('/peserta/biodata')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/peserta/biodata'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Biodata
                </button>
                <button
                  onClick={() => handleNav('/peserta/dokumen')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/peserta/dokumen'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Berkas
                </button>
                <button
                  onClick={() => handleNav('/peserta/review')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/peserta/review'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Review
                </button>
                <button
                  onClick={() => handleNav('/peserta/kartu')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/peserta/kartu'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Kartu Ujian
                </button>
                <button
                  onClick={() => handleNav('/peserta/jadwal')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute === '/peserta/jadwal'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Jadwal Seleksi
                </button>
                <button
                  onClick={() => handleNav('/peserta/cbt')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute.startsWith('/peserta/cbt')
                      ? 'text-emerald-700 bg-emerald-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                  Ujian CBT
                </button>
                <button
                  onClick={() => handleNav('/peserta/psikotes')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    currentRoute.startsWith('/peserta/psikotes')
                      ? 'text-teal-700 bg-teal-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5 text-teal-600" />
                  Psikotes CBT
                </button>
              </>
            ) : role === 'PANITIA' ? (
              <>
                <button
                  onClick={() => handleNav('/admin/dashboard')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/dashboard'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Pendaftar
                </button>
                <button
                  onClick={() => handleNav('/admin/verifikasi-dokumen')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/verifikasi-dokumen'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Verifikasi Berkas
                </button>
                <button
                  onClick={() => handleNav('/admin/jadwal')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/jadwal'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Jadwal
                </button>
                <button
                  onClick={() => handleNav('/admin/scan')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/scan'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  Scan QR
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/monitoring')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/cbt/monitoring'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Monitoring CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/hasil')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/cbt/hasil'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Hasil CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/psikotes')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute.startsWith('/admin/psikotes')
                      ? 'text-teal-700 bg-teal-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5 text-teal-600" />
                  Psikotes
                </button>
                <button
                  onClick={() => handleNav('/admin/quran')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute.startsWith('/admin/quran')
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Tes Qur'an
                </button>
                <button
                  onClick={() => handleNav('/admin/selection-results')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute.startsWith('/admin/selection-results') || currentRoute.startsWith('/admin/seleksi/hasil')
                      ? 'text-indigo-700 bg-indigo-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-indigo-600" />
                  Hasil Seleksi
                </button>
                <button
                  onClick={() => handleNav('/admin/landing-page')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute.startsWith('/admin/landing-page')
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Layout className="w-3.5 h-3.5" />
                  Draf CMS
                </button>
              </>
            ) : role === 'SUPER_ADMIN' ? (
              <>
                <button
                  onClick={() => handleNav('/admin/dashboard')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/dashboard'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Pendaftar
                </button>
                <button
                  onClick={() => handleNav('/admin/verifikasi-dokumen')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/verifikasi-dokumen'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Berkas
                </button>
                <button
                  onClick={() => handleNav('/admin/soal')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/soal'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Bank Soal
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/ujian')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/cbt/ujian'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Paket Ujian
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/monitoring')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/cbt/monitoring'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Monitoring
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/hasil')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/cbt/hasil'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Hasil CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/psikotes')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute.startsWith('/admin/psikotes')
                      ? 'text-teal-700 bg-teal-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5 text-teal-600" />
                  Psikotes
                </button>
                <button
                  onClick={() => handleNav('/admin/jadwal')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/jadwal'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Jadwal
                </button>
                <button
                  onClick={() => handleNav('/admin/quran')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute.startsWith('/admin/quran')
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Tes Qur'an
                </button>
                <button
                  onClick={() => handleNav('/admin/seleksi')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute.startsWith('/admin/seleksi') || currentRoute.startsWith('/admin/selection-')
                      ? 'text-indigo-700 bg-indigo-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-indigo-600" />
                  Kelulusan
                </button>
                <button
                  onClick={() => handleNav('/admin/scan')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/scan'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  Scan QR
                </button>
                <button
                  onClick={() => handleNav('/admin/dokumen-types')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/dokumen-types'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FolderLock className="w-3.5 h-3.5" />
                  Jenis Berkas
                </button>
                <button
                  onClick={() => handleNav('/admin/audit-logs')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/audit-logs'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Audit
                </button>
                <button
                  onClick={() => handleNav('/admin/landing-page')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute.startsWith('/admin/landing-page')
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Layout className="w-3.5 h-3.5" />
                  CMS Landing
                </button>
                <button
                  onClick={() => handleNav('/admin/settings')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute === '/admin/settings'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Pengaturan
                </button>
                <button
                  onClick={() => handleNav('/pimpinan')}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    currentRoute.startsWith('/pimpinan')
                      ? 'text-emerald-700 bg-emerald-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Eksekutif
                </button>
              </>
            ) : null}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Database / Supabase indicator */}
            {canSeeAdminTools && (
            <button
              onClick={onOpenDbModal}
              title="Panduan Supabase & SQL Schema"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
            >
              <Database className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-600' : 'text-amber-500'}`} />
              <span className="hidden xl:inline">{isConnected ? 'Cloud Terhubung' : 'Publish Gratis & DB'}</span>
            </button>
            )}

            {/* Quick Role Tester Selector */}
            {canSeeAdminTools && (
            <div className="relative">
              <button
                onClick={() => setQuickRoleOpen(!quickRoleOpen)}
                title="Ganti Mode Demo Role"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 transition"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px]">Uji Role</span>
              </button>

              {quickRoleOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-slate-200 p-2 z-50">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase px-2 py-1">
                    Cepat Ganti Peran (Testing)
                  </div>
                  <button
                    onClick={() => {
                      switchUserDemo('PESERTA');
                      setQuickRoleOpen(false);
                      onNavigate('/peserta/dashboard');
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg flex items-center justify-between"
                  >
                    <span>Calon Peserta Santri</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Farhan</span>
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
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Panitia</span>
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
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Admin</span>
                  </button>
                  <button
                    onClick={() => {
                      switchUserDemo('PENGUJI_QURAN');
                      setQuickRoleOpen(false);
                      onNavigate('/penguji');
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg flex items-center justify-between"
                  >
                    <span>Penguji Al-Qur'an</span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">Ustadz Muhaimin</span>
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
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">KH. Abdullah</span>
                  </button>
                </div>
              )}
            </div>
            )}

            {!user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNav('/login')}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Masuk Akun
                </button>
                <button
                  onClick={() => handleNav('/register')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm hover:shadow transition"
                >
                  Daftar Santri Baru
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900 leading-none">
                      {user.profile?.full_name || user.email}
                    </p>
                    <div className="mt-1 flex justify-end">
                      <Badge role={role || 'PESERTA'} size="sm" />
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase border border-emerald-300">
                    {user.profile?.full_name?.charAt(0) || <User className="w-4 h-4" />}
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Keluar"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={onOpenDbModal}
              title="Database / Supabase"
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              <Database className={`w-5 h-5 ${isConnected ? 'text-emerald-600' : 'text-amber-500'}`} />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Buka menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl">
          {user && (
            <div className="p-3 bg-slate-50 rounded-xl mb-3 flex items-center justify-between border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-800">{user.profile?.full_name}</p>
                <p className="text-[11px] text-slate-500">{user.email}</p>
              </div>
              <Badge role={role || 'PESERTA'} />
            </div>
          )}

          <div className="flex flex-col gap-1">
            {!user ? (
              <>
                <button
                  onClick={() => handleNav('/')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Beranda
                </button>
                <button
                  onClick={() => handleNav('/login')}
                  className="text-left px-3 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 rounded-lg"
                >
                  Masuk Akun Santri / Panitia
                </button>
                <button
                  onClick={() => handleNav('/register')}
                  className="text-left px-3 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg text-center"
                >
                  Daftar Calon Santri Baru
                </button>
              </>
            ) : role === 'PENGUJI_QURAN' ? (
              <>
                <button
                  onClick={() => handleNav('/penguji')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Home className="w-4 h-4 text-emerald-700" />
                  Dashboard Penguji
                </button>
                <button
                  onClick={() => handleNav('/penguji/peserta')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Users className="w-4 h-4 text-emerald-700" />
                  Daftar Peserta Penguji
                </button>
                <button
                  onClick={() => handleNav('/penguji/history')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileCheck2 className="w-4 h-4 text-emerald-700" />
                  Riwayat Penilaian (Selesai)
                </button>
              </>
            ) : role === 'PIMPINAN' ? (
              <>
                <button
                  onClick={() => handleNav('/pimpinan')}
                  className="text-left px-3 py-2 text-sm font-medium text-emerald-800 bg-emerald-50 rounded-lg flex items-center gap-2 font-bold"
                >
                  <Home className="w-4 h-4 text-emerald-700" />
                  Ringkasan Eksekutif
                </button>
                <button
                  onClick={() => handleNav('/pimpinan/laporan')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-emerald-700" />
                  Laporan Pendaftar
                </button>
                <button
                  onClick={() => handleNav('/pimpinan/hasil-seleksi')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <BarChart2 className="w-4 h-4 text-emerald-700" />
                  Hasil Seleksi (CBT & Qur'an)
                </button>
                <button
                  onClick={() => handleNav('/pimpinan/statistik')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Activity className="w-4 h-4 text-emerald-700" />
                  Statistik & Tren
                </button>
              </>
            ) : role === 'PESERTA' ? (
              <>
                <button
                  onClick={() => handleNav('/peserta/dashboard')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Home className="w-4 h-4 text-emerald-700" />
                  Dashboard
                </button>
                <button
                  onClick={() => handleNav('/peserta/biodata')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-emerald-700" />
                  Biodata
                </button>
                <button
                  onClick={() => handleNav('/peserta/dokumen')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <FolderOpen className="w-4 h-4 text-emerald-700" />
                  Unggah Berkas
                </button>
                <button
                  onClick={() => handleNav('/peserta/review')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileCheck2 className="w-4 h-4 text-emerald-700" />
                  Review & Kirim
                </button>
                <button
                  onClick={() => handleNav('/peserta/kartu')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4 text-emerald-700" />
                  Kartu Peserta Ujian
                </button>
                <button
                  onClick={() => handleNav('/peserta/jadwal')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  Jadwal Seleksi
                </button>
                <button
                  onClick={() => handleNav('/peserta/cbt')}
                  className="text-left px-3 py-2 text-sm font-bold text-emerald-900 bg-emerald-50 rounded-lg hover:bg-emerald-100 flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-emerald-700" />
                  Ujian CBT Akademik
                </button>
                <button
                  onClick={() => handleNav('/peserta/psikotes')}
                  className="text-left px-3 py-2 text-sm font-bold text-teal-900 bg-teal-50 rounded-lg hover:bg-teal-100 flex items-center gap-2"
                >
                  <Brain className="w-4 h-4 text-teal-700" />
                  Psikotes CBT Santri
                </button>
              </>
            ) : role === 'PANITIA' ? (
              <>
                <button
                  onClick={() => handleNav('/admin/dashboard')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Data Pendaftar
                </button>
                <button
                  onClick={() => handleNav('/admin/verifikasi-dokumen')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileCheck2 className="w-4 h-4 text-emerald-700" />
                  Verifikasi Berkas
                </button>
                <button
                  onClick={() => handleNav('/admin/jadwal')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  Jadwal Seleksi
                </button>
                <button
                  onClick={() => handleNav('/admin/scan')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <ScanLine className="w-4 h-4 text-emerald-700" />
                  Scan QR Presensi
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/monitoring')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Activity className="w-4 h-4 text-emerald-700" />
                  Monitoring CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/hasil')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <BarChart2 className="w-4 h-4 text-emerald-700" />
                  Hasil Ujian CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/psikotes')}
                  className="text-left px-3 py-2 text-sm font-bold text-teal-900 bg-teal-50 rounded-lg hover:bg-teal-100 flex items-center gap-2"
                >
                  <Brain className="w-4 h-4 text-teal-700" />
                  Modul Psikotes CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/quran')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-emerald-700" />
                  Tes Al-Qur'an (Offline)
                </button>
                <button
                  onClick={() => handleNav('/admin/landing-page')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Layout className="w-4 h-4 text-emerald-700" />
                  Draf CMS Landing Page
                </button>
              </>
            ) : role === 'SUPER_ADMIN' ? (
              <>
                <button
                  onClick={() => handleNav('/admin/dashboard')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Data Pendaftar
                </button>
                <button
                  onClick={() => handleNav('/admin/verifikasi-dokumen')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileCheck2 className="w-4 h-4 text-emerald-700" />
                  Verifikasi Berkas
                </button>
                <button
                  onClick={() => handleNav('/admin/soal')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-emerald-700" />
                  Bank Soal CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/ujian')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Layers className="w-4 h-4 text-emerald-700" />
                  Paket Ujian CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/monitoring')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Activity className="w-4 h-4 text-emerald-700" />
                  Monitoring CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/cbt/hasil')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <BarChart2 className="w-4 h-4 text-emerald-700" />
                  Hasil Ujian CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/psikotes')}
                  className="text-left px-3 py-2 text-sm font-bold text-teal-900 bg-teal-50 rounded-lg hover:bg-teal-100 flex items-center gap-2"
                >
                  <Brain className="w-4 h-4 text-teal-700" />
                  Modul Psikotes CBT
                </button>
                <button
                  onClick={() => handleNav('/admin/jadwal')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  Jadwal Seleksi
                </button>
                <button
                  onClick={() => handleNav('/admin/quran')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-emerald-700" />
                  Tes Al-Qur'an (Offline)
                </button>
                <button
                  onClick={() => handleNav('/admin/scan')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <ScanLine className="w-4 h-4 text-emerald-700" />
                  Scan QR Presensi
                </button>
                <button
                  onClick={() => handleNav('/admin/dokumen-types')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <FolderLock className="w-4 h-4 text-emerald-700" />
                  Jenis Berkas
                </button>
                <button
                  onClick={() => handleNav('/admin/audit-logs')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-emerald-700" />
                  Audit Logs
                </button>
                <button
                  onClick={() => handleNav('/admin/landing-page')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Layout className="w-4 h-4 text-emerald-700" />
                  CMS Landing Page
                </button>
                <button
                  onClick={() => handleNav('/admin/settings')}
                  className="text-left px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4 text-emerald-700" />
                  Pengaturan PSB
                </button>
                <button
                  onClick={() => handleNav('/pimpinan')}
                  className="text-left px-3 py-2 text-sm font-medium text-emerald-800 bg-emerald-50 rounded-lg hover:bg-emerald-100 flex items-center gap-2 font-bold"
                >
                  <BarChart2 className="w-4 h-4 text-emerald-700" />
                  Portal Eksekutif (Pimpinan)
                </button>
              </>
            ) : null}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {canSeeAdminTools && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  switchUserDemo('PESERTA');
                  setMobileMenuOpen(false);
                  onNavigate('/peserta/dashboard');
                }}
                className="py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg font-medium"
              >
                Demo Peserta
              </button>
              <button
                onClick={() => {
                  switchUserDemo('PANITIA');
                  setMobileMenuOpen(false);
                  onNavigate('/admin/dashboard');
                }}
                className="py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg font-medium"
              >
                Demo Panitia
              </button>
              <button
                onClick={() => {
                  switchUserDemo('PENGUJI_QURAN');
                  setMobileMenuOpen(false);
                  onNavigate('/penguji');
                }}
                className="py-1.5 text-xs bg-teal-50 text-teal-800 rounded-lg font-medium"
              >
                Demo Penguji
              </button>
              <button
                onClick={() => {
                  switchUserDemo('PIMPINAN');
                  setMobileMenuOpen(false);
                  onNavigate('/pimpinan');
                }}
                className="py-1.5 text-xs bg-amber-50 text-amber-800 rounded-lg font-medium"
              >
                Demo Pimpinan
              </button>
            </div>
            )}

            {user && (
              <button
                onClick={handleLogout}
                className="w-full py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg flex items-center justify-center gap-2 mt-2"
              >
                <LogOut className="w-4 h-4" />
                Keluar dari Akun
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
