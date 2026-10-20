import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { DatabaseGuideModal } from './components/DatabaseGuideModal';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { PesertaDashboardPage } from './pages/PesertaDashboardPage';
import { PesertaBiodataPage } from './pages/PesertaBiodataPage';
import { PesertaDocumentsPage } from './pages/PesertaDocumentsPage';
import { PesertaReviewPage } from './pages/PesertaReviewPage';
import { PesertaKartuPage } from './pages/PesertaKartuPage';
import { PesertaJadwalPage } from './pages/PesertaJadwalPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminDocumentsPage } from './pages/AdminDocumentsPage';
import { AdminDocumentTypesPage } from './pages/AdminDocumentTypesPage';
import { AdminJadwalPage } from './pages/AdminJadwalPage';
import { AdminScanPage } from './pages/AdminScanPage';
import { AdminAuditLogsPage } from './pages/AdminAuditLogsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminBankSoalPage } from './pages/AdminBankSoalPage';
import { AdminExamsPage } from './pages/AdminExamsPage';
import { AdminCbtMonitoringPage } from './pages/AdminCbtMonitoringPage';
import { AdminCbtResultsPage } from './pages/AdminCbtResultsPage';
import { PesertaCbtPage } from './pages/PesertaCbtPage';
import { PesertaPsikotesPage } from './pages/PesertaPsikotesPage';
import { AdminPsikotesDashboardPage } from './pages/AdminPsikotesDashboardPage';
import { AdminPsikotesSoalPage } from './pages/AdminPsikotesSoalPage';
import { AdminPsikotesPaketPage } from './pages/AdminPsikotesPaketPage';
import { AdminPsikotesScoringPage } from './pages/AdminPsikotesScoringPage';
import { AdminPsikotesMonitoringPage } from './pages/AdminPsikotesMonitoringPage';
import { AdminPsikotesHasilPage } from './pages/AdminPsikotesHasilPage';
import { AdminLandingPageCms } from './pages/AdminLandingPageCms';
import { LandingPagePreview } from './pages/LandingPagePreview';
import { PengujiDashboardPage } from './pages/PengujiDashboardPage';
import { PengujiPesertaPage } from './pages/PengujiPesertaPage';
import { PengujiAssessmentPage } from './pages/PengujiAssessmentPage';
import { AdminQuranPage } from './pages/AdminQuranPage';
import { AdminQuranDetailPage } from './pages/AdminQuranDetailPage';
import { AdminQuranRubrikPage } from './pages/AdminQuranRubrikPage';
import { PimpinanDashboardPage } from './pages/PimpinanDashboardPage';
import { AdminSeleksiDashboardPage } from './pages/AdminSeleksiDashboardPage';
import { AdminSeleksiScoringPage } from './pages/AdminSeleksiScoringPage';
import { AdminSeleksiAturanPage } from './pages/AdminSeleksiAturanPage';
import { AdminSeleksiKuotaPage } from './pages/AdminSeleksiKuotaPage';
import { AdminSeleksiHasilPage } from './pages/AdminSeleksiHasilPage';
import { hasPermission, AppPermission } from './lib/permissions';
import { Alert } from './components/Alert';
import { FullPageLoading } from './components/Loading';
import { LogOut } from 'lucide-react';

function AppContent() {
  const { user, role, isDemoMode, logout, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ message: string; type: string } | null>(null);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        setToastMsg({ message: detail.message, type: detail.type || 'info' });
      }
    };
    window.addEventListener('psb-toast-event', handleToast);
    return () => window.removeEventListener('psb-toast-event', handleToast);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 4500);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const handleExitDemo = async () => {
    await logout();
    navigate('/login');
  };

  // Sync with browser URL popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    setCurrentRoute(to);
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({}, '', to);
      } catch {
        // iframe fallback
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return <FullPageLoading text="Memuat Portal PSB PPTQM Darul Hikmah..." />;
  }

  // --------------------------------------------------------------------------
  // ROLE PROTECTION & ROUTE MIDDLEWARE (DEFAULT DENY RBAC)
  // --------------------------------------------------------------------------
  const getHomeRouteForRole = (userRole?: string | null): string => {
    switch (userRole) {
      case 'SUPER_ADMIN':
      case 'PANITIA':
        return '/admin/dashboard';
      case 'PIMPINAN':
        return '/pimpinan';
      case 'PENGUJI_QURAN':
        return '/penguji';
      case 'PESERTA':
      default:
        return '/peserta/dashboard';
    }
  };

  const getRoleDisplayName = (userRole?: string | null): string => {
    switch (userRole) {
      case 'SUPER_ADMIN':
        return 'Super Administrator';
      case 'PANITIA':
        return 'Panitia PSB Operasional';
      case 'PIMPINAN':
        return 'Pimpinan Pesantren (Read-Only)';
      case 'PENGUJI_QURAN':
        return 'Penguji Al-Qur\'an';
      case 'PESERTA':
        return 'Calon Peserta Santri';
      default:
        return 'Pengguna';
    }
  };

  const renderForbidden = (title: string, message: string) => (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar currentRoute={currentRoute} onNavigate={navigate} onOpenDbModal={() => setIsDbModalOpen(true)} />
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <Alert
          type="error"
          title={title}
          message={message}
        />
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => navigate(getHomeRouteForRole(role))}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
          >
            Buka Panel {getRoleDisplayName(role)}
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
      <Footer />
      {toastMsg && (
        <div className="fixed bottom-20 sm:bottom-5 right-4 left-4 sm:left-auto z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/40 flex items-start gap-3">
          <div className="text-xs font-medium leading-relaxed flex-1 whitespace-pre-line">
            {toastMsg.message}
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded"
          >
            Tutup
          </button>
        </div>
      )}

      <DatabaseGuideModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} />
    </div>
  );

  const renderAuthRequired = (title: string, message: string, loginRedirect = '/login') => (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar currentRoute={currentRoute} onNavigate={navigate} onOpenDbModal={() => setIsDbModalOpen(true)} />
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <Alert
          type="warning"
          title={title}
          message={message}
        />
        <div className="mt-5 flex gap-2 justify-center">
          <button
            onClick={() => navigate(loginRedirect)}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
          >
            Masuk ke Akun
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            Daftar Santri Baru
          </button>
        </div>
      </div>
      <Footer />
      {toastMsg && (
        <div className="fixed bottom-20 sm:bottom-5 right-4 left-4 sm:left-auto z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/40 flex items-start gap-3">
          <div className="text-xs font-medium leading-relaxed flex-1 whitespace-pre-line">
            {toastMsg.message}
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded"
          >
            Tutup
          </button>
        </div>
      )}

      <DatabaseGuideModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} />
    </div>
  );

  // 1. Protect /pimpinan/* (EXECUTIVE READ-ONLY)
  if (currentRoute.startsWith('/pimpinan')) {
    if (!user) {
      return renderAuthRequired(
        'Portal Eksekutif Pimpinan',
        'Silakan masuk sebagai Pimpinan Pesantren untuk mengakses rekapitulasi eksekutif PSB.'
      );
    }
    if (!hasPermission(role, 'EXECUTIVE_VIEW')) {
      return renderForbidden(
        'Akses Ditolak (403)',
        `Role "${role}" tidak memiliki izin akses eksekutif pimpinan (EXECUTIVE_VIEW).`
      );
    }
  }

  // 2. Protect /penguji/* (PENGUJI AL-QUR'AN)
  if (currentRoute.startsWith('/penguji')) {
    if (!user) {
      return renderAuthRequired(
        'Akses Penguji Al-Qur\'an',
        'Silakan masuk sebagai Ustadz Penguji Al-Qur\'an untuk membuka lembar penilaian peserta.'
      );
    }
    if (!hasPermission(role, 'QURAN_ASSESS')) {
      return renderForbidden(
        'Akses Ditolak (403)',
        `Role "${role}" tidak memiliki izin penilaian Al-Qur'an (QURAN_ASSESS). Calon santri dan role non-penguji tidak diperkenankan membuka lembar ujian ini.`
      );
    }
  }

  // 3. Protect /peserta/* (CALON SANTRI SELF-SERVICE)
  if (currentRoute.startsWith('/peserta')) {
    if (!user) {
      return renderAuthRequired(
        'Portal Calon Santri',
        'Silakan masuk atau buat akun baru untuk mengakses formulir pendaftaran calon santri Anda.'
      );
    }
    if (role !== 'PESERTA') {
      return renderForbidden(
        'Khusus Calon Santri (403)',
        `Anda sedang masuk dengan akun staff "${getRoleDisplayName(role)}". Portal "/peserta" diperuntukkan bagi Calon Santri baru untuk pengisian berkas & ujian mandiri.`
      );
    }
  }

  // 4. Granular Protect /admin/* (DEFAULT DENY)
  if (currentRoute.startsWith('/admin')) {
    if (!user) {
      return renderAuthRequired(
        'Panel Administrasi & Panitia PSB',
        'Anda harus masuk dengan akun berwenang untuk mengakses panel operasional seleksi.'
      );
    }

    // Explicit Default Deny for non-operational roles on all /admin/* routes
    if (role === 'PIMPINAN') {
      return renderForbidden(
        'Akses Ditolak (403 Forbidden)',
        'Role "Pimpinan" tidak diperkenankan mengakses rute operasional /admin. Silakan gunakan Portal Eksekutif di menu "/pimpinan" untuk meninjau rekapitulasi dan statistik.'
      );
    }
    if (role === 'PENGUJI_QURAN') {
      return renderForbidden(
        'Akses Ditolak (403 Forbidden)',
        'Role "Penguji Al-Qur\'an" tidak memiliki izin akses ke panel administrasi operasional /admin.'
      );
    }
    if (role === 'PESERTA') {
      return renderForbidden(
        'Akses Ditolak (403 Forbidden)',
        'Calon Santri tidak memiliki izin ke panel administrasi operasional /admin.'
      );
    }

    let requiredPermission: AppPermission | null = null;
    let requiredDesc = '';

    if (currentRoute === '/admin/dashboard' || currentRoute === '/admin') {
      requiredPermission = 'CANDIDATE_VIEW';
      requiredDesc = 'Melihat daftar calon santri terdaftar';
    } else if (currentRoute === '/admin/verifikasi-dokumen') {
      requiredPermission = 'DOCUMENT_VERIFY';
      requiredDesc = 'Verifikasi dan validasi berkas santri';
    } else if (currentRoute === '/admin/dokumen-types') {
      requiredPermission = 'SYSTEM_SETTINGS';
      requiredDesc = 'Melihat & mengubah master jenis dokumen (Khusus Super Admin)';
    } else if (currentRoute === '/admin/jadwal') {
      requiredPermission = 'SCHEDULE_VIEW';
      requiredDesc = 'Pengaturan sesi jadwal seleksi';
    } else if (currentRoute === '/admin/scan') {
      requiredPermission = 'QR_SCAN';
      requiredDesc = 'Pemindaian QR presensi kehadiran seleksi';
    } else if (currentRoute === '/admin/soal') {
      requiredPermission = 'QUESTION_MANAGE';
      requiredDesc = 'Manajemen bank soal CBT (Khusus Super Admin)';
    } else if (currentRoute === '/admin/cbt' || currentRoute === '/admin/cbt/ujian') {
      requiredPermission = 'CBT_MANAGE';
      requiredDesc = 'Pengaturan paket ujian CBT (Khusus Super Admin)';
    } else if (currentRoute === '/admin/cbt/monitoring') {
      requiredPermission = 'CBT_MONITOR';
      requiredDesc = 'Monitoring ujian CBT berlangsung';
    } else if (currentRoute === '/admin/cbt/hasil') {
      requiredPermission = 'CBT_RESULT_VIEW';
      requiredDesc = 'Melihat rekapitulasi hasil ujian CBT';
    } else if (currentRoute === '/admin/psikotes') {
      requiredPermission = 'PSYCHOTEST_VIEW';
      requiredDesc = 'Dashboard psikotes calon santri';
    } else if (currentRoute === '/admin/psikotes/soal') {
      requiredPermission = 'PSYCHOTEST_QUESTION_MANAGE';
      requiredDesc = 'Manajemen bank soal psikotes (Khusus Super Admin)';
    } else if (currentRoute === '/admin/psikotes/paket') {
      requiredPermission = 'PSYCHOTEST_VIEW';
      requiredDesc = 'Melihat daftar paket asesmen psikotes (Panitia Read-Only, Super Admin CRUD)';
    } else if (currentRoute === '/admin/psikotes/scoring') {
      requiredPermission = 'PSYCHOTEST_SCORING_MANAGE';
      requiredDesc = 'Konfigurasi aturan scoring & rubrik psikotes (Khusus Super Admin)';
    } else if (currentRoute === '/admin/psikotes/monitoring') {
      requiredPermission = 'PSYCHOTEST_MONITOR';
      requiredDesc = 'Live monitoring psikotes santri';
    } else if (currentRoute === '/admin/psikotes/hasil') {
      requiredPermission = 'PSYCHOTEST_RESULT_VIEW';
      requiredDesc = 'Melihat rekapitulasi hasil psikotes santri';
    } else if (currentRoute === '/admin/quran') {
      requiredPermission = 'QURAN_VIEW';
      requiredDesc = 'Monitoring pelaksanaan tes Al-Qur\'an';
    } else if (currentRoute === '/admin/quran/rubrik') {
      requiredPermission = 'QURAN_RUBRIC_MANAGE';
      requiredDesc = 'Konfigurasi rubrik & bobot Al-Qur\'an (Khusus Super Admin)';
    } else if (currentRoute.startsWith('/admin/quran/')) {
      requiredPermission = 'QURAN_REVIEW';
      requiredDesc = 'Supervisi detail penilaian Al-Qur\'an';
    } else if (currentRoute.startsWith('/admin/landing-page')) {
      requiredPermission = 'CMS_VIEW';
      requiredDesc = 'Pengelolaan CMS Landing Page';
    } else if (currentRoute === '/admin/audit-logs') {
      requiredPermission = 'AUDIT_VIEW';
      requiredDesc = 'Melihat audit logs keamanan (Khusus Super Admin)';
    } else if (currentRoute === '/admin/selection-scoring' || currentRoute === '/admin/seleksi/scoring') {
      requiredPermission = 'SCORE_MANAGE';
      requiredDesc = 'Konfigurasi bobot penilaian seleksi (Khusus Super Admin)';
    } else if (currentRoute === '/admin/selection-results' || currentRoute === '/admin/seleksi/hasil') {
      requiredPermission = 'RESULT_REVIEW';
      requiredDesc = 'Melihat & review rekapitulasi hasil seleksi santri';
    } else if (currentRoute === '/admin/seleksi' || currentRoute === '/admin/seleksi/dashboard') {
      requiredPermission = 'SELECTION_RUN_MANAGE';
      requiredDesc = 'Dashboard kalkulasi & eksekusi seleksi santri (Khusus Super Admin)';
    } else if (currentRoute === '/admin/seleksi/aturan') {
      requiredPermission = 'PASSING_RULE_MANAGE';
      requiredDesc = 'Pengaturan passing grade kelulusan (Khusus Super Admin)';
    } else if (currentRoute === '/admin/seleksi/kuota') {
      requiredPermission = 'QUOTA_MANAGE';
      requiredDesc = 'Pengaturan kuota & tie-breaker (Khusus Super Admin)';
    } else if (currentRoute === '/admin/settings') {
      requiredPermission = 'SYSTEM_SETTINGS';
      requiredDesc = 'Konfigurasi sistem & kuota (Khusus Super Admin)';
    } else {
      // DEFAULT DENY: Any other /admin sub-route requires highest admin authority
      requiredPermission = 'SYSTEM_SETTINGS';
      requiredDesc = 'Fitur konfigurasi sistem PSB tingkat tinggi (Khusus Super Admin)';
    }

    if (requiredPermission && !hasPermission(role, requiredPermission)) {
      return renderForbidden(
        'Akses Ditolak (403 Forbidden)',
        `Role Anda "${getRoleDisplayName(role)}" tidak memiliki hak akses [${requiredPermission}] untuk: ${requiredDesc}.`
      );
    }
  }

  // Render appropriate view based on route
  const renderCurrentView = () => {
    if (currentRoute.startsWith('/peserta/cbt')) {
      const parts = currentRoute.split('/');
      const examIdParam = parts.length > 3 ? parts[3] : undefined;
      return <PesertaCbtPage examId={examIdParam} onNavigate={navigate} />;
    }

    if (currentRoute.startsWith('/peserta/psikotes')) {
      const parts = currentRoute.split('/');
      const examIdParam = parts.length > 3 ? parts[3] : undefined;
      return <PesertaPsikotesPage examId={examIdParam} onNavigate={navigate} />;
    }

    if (currentRoute.startsWith('/penguji/quran/')) {
      const assessmentId = currentRoute.replace('/penguji/quran/', '').split('?')[0];
      return <PengujiAssessmentPage assessmentId={assessmentId} onNavigate={navigate} />;
    }

    if (currentRoute === '/penguji/history') {
      return <PengujiPesertaPage onNavigate={navigate} initialFilter="LOCKED" />;
    }

    if (currentRoute.startsWith('/admin/quran/') && currentRoute !== '/admin/quran/rubrik') {
      const assessmentId = currentRoute.replace('/admin/quran/', '').split('?')[0];
      return <AdminQuranDetailPage assessmentId={assessmentId} onNavigate={navigate} />;
    }

    if (currentRoute.startsWith('/pimpinan')) {
      return <PimpinanDashboardPage onNavigate={navigate} currentRoute={currentRoute} />;
    }

    switch (currentRoute) {
      case '/':
        return <LandingPage onNavigate={navigate} />;
      case '/login':
        return <LoginPage onNavigate={navigate} />;
      case '/register':
        return <RegisterPage onNavigate={navigate} />;
      case '/forgot-password':
        return <ForgotPasswordPage onNavigate={navigate} />;
      case '/peserta/dashboard':
        return <PesertaDashboardPage onNavigate={navigate} />;
      case '/peserta/biodata':
        return <PesertaBiodataPage onNavigate={navigate} />;
      case '/peserta/dokumen':
        return <PesertaDocumentsPage onNavigate={navigate} />;
      case '/peserta/review':
        return <PesertaReviewPage onNavigate={navigate} />;
      case '/peserta/kartu':
        return <PesertaKartuPage onNavigate={navigate} />;
      case '/peserta/jadwal':
        return <PesertaJadwalPage onNavigate={navigate} />;
      case '/admin/dashboard':
        return <AdminDashboardPage onNavigate={navigate} />;
      case '/admin/verifikasi-dokumen':
        return <AdminDocumentsPage />;
      case '/admin/soal':
        return <AdminBankSoalPage />;
      case '/admin/cbt':
      case '/admin/cbt/ujian':
        return <AdminExamsPage onNavigate={navigate} />;
      case '/admin/cbt/monitoring':
        return <AdminCbtMonitoringPage />;
      case '/admin/cbt/hasil':
        return <AdminCbtResultsPage />;
      case '/admin/psikotes':
        return <AdminPsikotesDashboardPage onNavigate={navigate} />;
      case '/admin/psikotes/soal':
        return <AdminPsikotesSoalPage onNavigate={navigate} />;
      case '/admin/psikotes/paket':
        return <AdminPsikotesPaketPage onNavigate={navigate} />;
      case '/admin/psikotes/scoring':
        return <AdminPsikotesScoringPage onNavigate={navigate} />;
      case '/admin/psikotes/monitoring':
        return <AdminPsikotesMonitoringPage onNavigate={navigate} />;
      case '/admin/psikotes/hasil':
        return <AdminPsikotesHasilPage onNavigate={navigate} />;
      case '/admin/jadwal':
        return <AdminJadwalPage onNavigate={navigate} />;
      case '/admin/scan':
        return <AdminScanPage />;
      case '/admin/dokumen-types':
        return <AdminDocumentTypesPage />;
      case '/admin/audit-logs':
        return <AdminAuditLogsPage />;
      case '/admin/settings':
        return <AdminSettingsPage />;
      case '/admin/landing-page':
        return <AdminLandingPageCms onNavigate={navigate} />;
      case '/admin/landing-page/preview':
        return <LandingPagePreview onNavigate={navigate} />;
      case '/penguji':
        return <PengujiDashboardPage onNavigate={navigate} />;
      case '/penguji/peserta':
        return <PengujiPesertaPage onNavigate={navigate} />;
      case '/admin/quran':
        return <AdminQuranPage onNavigate={navigate} />;
      case '/admin/quran/rubrik':
        return <AdminQuranRubrikPage onNavigate={navigate} />;
      case '/admin/selection-scoring':
      case '/admin/seleksi/scoring':
        return <AdminSeleksiScoringPage onNavigate={navigate} />;
      case '/admin/selection-results':
      case '/admin/seleksi/hasil':
        return <AdminSeleksiHasilPage onNavigate={navigate} />;
      case '/admin/seleksi':
      case '/admin/seleksi/dashboard':
        return <AdminSeleksiDashboardPage onNavigate={navigate} />;
      case '/admin/seleksi/aturan':
        return <AdminSeleksiAturanPage onNavigate={navigate} />;
      case '/admin/seleksi/kuota':
        return <AdminSeleksiKuotaPage onNavigate={navigate} />;
      default:
        // Default to landing page
        return <LandingPage onNavigate={navigate} />;
    }
  };

  const isCbtActiveRoute = currentRoute.startsWith('/peserta/cbt') || currentRoute.startsWith('/peserta/psikotes');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      {/* Explicit Banner for Super Admin Demo Mode on all admin pages */}
      {isDemoMode && currentRoute.startsWith('/admin') && (
        <aside
          role="status"
          aria-label="Demo Mode Banner"
          className="bg-amber-500 text-amber-950 px-4 py-2 shadow-xs border-b border-amber-600 relative z-40 transition-all"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-900 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-950"></span>
              </span>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="font-black text-sm tracking-wide">
                  DEMO MODE — Bukan sesi Supabase Production
                </span>
                <span className="text-xs text-amber-950 font-medium">
                  (Simulasi lokal untuk keperluan rapat & evaluasi. Tidak terhubung ke database production)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExitDemo}
              className="px-3.5 py-1.5 bg-amber-950 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Demo</span>
            </button>
          </div>
        </aside>
      )}

      {!isCbtActiveRoute && (
        <Navbar
          currentRoute={currentRoute}
          onNavigate={navigate}
          onOpenDbModal={() => setIsDbModalOpen(true)}
        />
      )}

      <main className="flex-1">
        {renderCurrentView()}
      </main>

      {!isCbtActiveRoute && <Footer />}

      {toastMsg && (
        <div className="fixed bottom-20 sm:bottom-5 right-4 left-4 sm:left-auto z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/40 flex items-start gap-3">
          <div className="text-xs font-medium leading-relaxed flex-1 whitespace-pre-line">
            {toastMsg.message}
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded"
          >
            Tutup
          </button>
        </div>
      )}

      <DatabaseGuideModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
