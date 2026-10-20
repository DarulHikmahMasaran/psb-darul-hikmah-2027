import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { cmsService, getLogoUrlWithCacheBust } from '../services/cmsService';
import { LandingPageSnapshot, LandingPageAnnouncement } from '../types/cms';
import { DynamicIcon } from '../utils/iconHelper';
import { initialLandingSnapshot } from '../lib/cmsSeeds';
import {
  BookOpen,
  Calendar,
  CheckCircle,
  CheckSquare,
  Square,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  ChevronDown,
  Sparkles,
  FileCheck,
  UserCheck,
  Eye,
  Globe,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  QrCode,
  Laptop
} from 'lucide-react';

export interface LandingPageProps {
  onNavigate: (route: string) => void;
  previewSnapshot?: LandingPageSnapshot;
  isPreviewMode?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  previewSnapshot,
  isPreviewMode = false,
}) => {
  const [content, setContent] = useState<LandingPageSnapshot>(previewSnapshot || initialLandingSnapshot);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [reqTab, setReqTab] = useState<'UMUM' | 'BERKAS'>('BERKAS');
  const [checkedReqs, setCheckedReqs] = useState<Record<string, boolean>>({});
  const [activeAnnouncement, setActiveAnnouncement] = useState<LandingPageAnnouncement | null>(null);

  useEffect(() => {
    if (previewSnapshot) {
      setContent(previewSnapshot);
      updateAnnouncement(previewSnapshot);
    } else {
      cmsService.getPublishedContent().then(snap => {
        setContent(snap);
        updateAnnouncement(snap);
      });
    }
  }, [previewSnapshot]);

  // Sync document title and meta with SEO fields from CMS
  useEffect(() => {
    if (content.settings.meta_title) {
      document.title = content.settings.meta_title;
    }
    const metaDescTag = document.querySelector('meta[name="description"]');
    if (metaDescTag && content.settings.meta_description) {
      metaDescTag.setAttribute('content', content.settings.meta_description);
    }
  }, [content.settings.meta_title, content.settings.meta_description]);

  const updateAnnouncement = (snap: LandingPageSnapshot) => {
    const now = new Date().getTime();
    const valid = (snap.announcements || []).find(a => {
      if (!a.is_active) return false;
      if (a.start_at && new Date(a.start_at).getTime() > now) return false;
      if (a.end_at && new Date(a.end_at).getTime() < now) return false;
      return true;
    });
    setActiveAnnouncement(valid || null);
  };

  const toggleReqCheck = (id: string) => {
    setCheckedReqs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const { settings, stats, requirements, steps, schedules, faqs, contacts } = content;

  // Active items ordered by sort_order
  const activeStats = [...stats].filter(s => s.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const generalRequirements = [...requirements]
    .filter(r => r.is_active && r.category === 'UMUM')
    .sort((a, b) => a.sort_order - b.sort_order);
  const docRequirements = [...requirements]
    .filter(r => r.is_active && r.category === 'BERKAS')
    .sort((a, b) => a.sort_order - b.sort_order);
  const activeSteps = [...steps].filter(s => s.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const activeSchedules = [...schedules]
    .filter(s => s.is_active && s.is_public)
    .sort((a, b) => a.sort_order - b.sort_order);
  const activeFaqs = [...faqs].filter(f => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const activeContacts = [...contacts].filter(c => c.is_active).sort((a, b) => a.sort_order - b.sort_order);

  const totalReqsCount = generalRequirements.length + docRequirements.length;
  const checkedReqsCount = [...generalRequirements, ...docRequirements].filter(r => checkedReqs[r.id]).length;

  // Primary WhatsApp contact
  const waContact = activeContacts.find(c => c.contact_type === 'WHATSAPP');
  const cleanWaNumber = waContact ? waContact.value.replace(/[^0-9]/g, '') : '6281234567890';
  const waLink = waContact?.link || `https://wa.me/${cleanWaNumber}`;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20 sm:pb-0">
      {/* 0. PREVIEW BANNER (Visible only in CMS draft preview mode) */}
      {isPreviewMode && (
        <div className="sticky top-0 z-50 bg-slate-900 text-amber-300 px-3 sm:px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 shadow-md">
          <div className="flex items-center gap-2 font-bold">
            <Eye className="w-4 h-4 text-amber-400 shrink-0" />
            <span>PRATINJAU DRAFT CMS — Belum Dipublikasikan</span>
          </div>
          <button
            onClick={() => onNavigate('/admin/landing-page')}
            className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs transition"
          >
            Kembali ke Editor CMS
          </button>
        </div>
      )}

      {/* 0.1 ANNOUNCEMENT BANNER (Editable from CMS Tab: Banner) */}
      {activeAnnouncement && (
        <aside
          aria-label="Pengumuman Penting"
          className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-900 text-white text-xs py-2.5 px-3.5 sm:px-6 border-b border-emerald-700/60"
        >
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="inline-flex items-center gap-1.5 font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              {activeAnnouncement.title}:
            </span>
            <span className="text-emerald-50">{activeAnnouncement.content}</span>
            {activeAnnouncement.button_link && (
              <button
                onClick={() => onNavigate(activeAnnouncement.button_link!)}
                className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[11px] hover:bg-amber-300 transition shrink-0 shadow-2xs"
              >
                {activeAnnouncement.button_text || 'Lihat Info'}
              </button>
            )}
          </div>
        </aside>
      )}

      {/* 1. SPLIT-BENTO HERO SECTION (Modern Boarding School Portal UX — Editable from CMS Tab: Beranda & Statistik) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white pt-7 pb-10 sm:pt-12 sm:pb-16">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 items-center">
            {/* Left Column: Main Identity & CTA */}
            <div className="lg:col-span-7 text-center lg:text-left flex flex-col items-center lg:items-start">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 mb-4">
                {settings.logo_path || settings.logo_url ? (
                  <div className="p-2 bg-white rounded-xl shadow-md border border-emerald-400/30 inline-flex items-center justify-center">
                    <img
                      src={getLogoUrlWithCacheBust(settings.logo_path || settings.logo_url, settings.updated_at)}
                      alt={settings.site_name || 'Logo PPTQM Darul Hikmah'}
                      className="h-10 sm:h-12 w-auto object-contain max-w-[150px]"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-sm">
                    <BookOpen className="w-5 h-5" />
                  </div>
                )}

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-[11px] sm:text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{settings.hero_badge || 'Penerimaan Santri Baru Jenjang SMP'}</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight leading-snug sm:leading-tight text-white">
                {settings.hero_title || 'Penerimaan Santri Baru'}{' '}
                <span className="text-emerald-400 block sm:inline">
                  {settings.hero_highlight || settings.site_short_name || 'PPTQM Darul Hikmah'}
                </span>
              </h1>

              <p className="mt-1.5 text-xs sm:text-base font-bold text-amber-300 tracking-wide">
                Tahun Pelajaran {settings.academic_year || '2027/2028'}
                {settings.program_label ? ` • ${settings.program_label}` : ''}
                {settings.hero_subtitle ? ` — ${settings.hero_subtitle}` : ''}
              </p>

              <p className="mt-3 text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-xl">
                {settings.hero_description ||
                  'Selamat datang Ayah/Bunda di Portal Resmi PSB Online. Daftarkan Ananda secara mudah, pantau verifikasi berkas, jadwal seleksi CBT & Al-Qur’an, hingga pengumuman kelulusan langsung dari HP.'}
              </p>

              {/* Primary & Secondary Action Buttons */}
              <div className="mt-6 w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                <Button
                  size="lg"
                  onClick={() => onNavigate(settings.hero_primary_button_link || '/register')}
                  rightIcon={<ArrowRight className="w-4 h-4 text-emerald-950 shrink-0" />}
                  className="w-full sm:w-auto py-3 px-6 shadow-lg bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-extrabold border-transparent text-sm"
                >
                  {settings.hero_primary_button_text || 'Daftar Santri Baru'}
                </Button>
                <Button
                  size="lg"
                  variant="outline-white"
                  onClick={() => onNavigate(settings.hero_secondary_button_link || '/login')}
                  className="w-full sm:w-auto py-3 px-6 text-sm"
                >
                  {settings.hero_secondary_button_text || 'Masuk Akun Pendaftar'}
                </Button>
              </div>

              {/* Trust Feature Pills */}
              <div className="mt-6 pt-5 border-t border-white/10 w-full flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-[11px] text-emerald-200/90">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Verifikasi Berkas Online
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  Ujian CBT &amp; Tes Al-Qur&apos;an Terpadu
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Kartu Ujian Digital Ber-QR
                </span>
              </div>
            </div>

            {/* Right Column: Bento Quick Info & CMS Stats Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between gap-2 pb-3 mb-3.5 border-b border-white/10">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                      Informasi Kuota &amp; Program
                    </span>
                    <h2 className="text-xs sm:text-sm font-extrabold text-white">
                      {settings.site_short_name || 'PPTQM Darul Hikmah'} — TP {settings.academic_year || '2027/2028'}
                    </h2>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold shrink-0">
                    Buka Pendaftaran
                  </span>
                </div>

                {activeStats.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {activeStats.map((st, idx) => (
                      <div
                        key={st.id || idx}
                        className="p-3 rounded-xl bg-slate-950/40 border border-white/10 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-lg sm:text-xl font-extrabold text-amber-300 leading-none">
                            {st.value}
                          </span>
                          {st.icon_key && (
                            <DynamicIcon name={st.icon_key} className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] font-bold text-white leading-snug">{st.label}</div>
                        {st.description && (
                          <div className="text-[10px] text-emerald-200/75 mt-0.5 line-clamp-1">
                            {st.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] text-emerald-100">
                  <span>Diperuntukkan bagi siswa/i kelas 6 SD/MI</span>
                  <button
                    type="button"
                    onClick={() => scrollToSection('jadwal')}
                    className="font-bold text-amber-300 hover:text-amber-200 underline shrink-0"
                  >
                    Lihat Jadwal →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STICKY QUICK-JUMP NAVIGATION PILLS (Sangat Nyaman untuk Layar HP) */}
      <nav
        aria-label="Navigasi Cepat Halaman Utama"
        className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs"
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => scrollToSection('alur')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition whitespace-nowrap shrink-0"
            >
              1. Alur Pendaftaran
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('jadwal')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition whitespace-nowrap shrink-0"
            >
              2. Jadwal Seleksi
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('persyaratan')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition whitespace-nowrap shrink-0"
            >
              3. Cek Syarat &amp; Berkas
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition whitespace-nowrap shrink-0"
            >
              4. FAQ
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('kontak')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition whitespace-nowrap shrink-0"
            >
              5. Kontak Panitia
            </button>
          </div>

          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition shrink-0"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Helpdesk WA</span>
          </a>
        </div>
      </nav>

      {/* 3. ALUR PENDAFTARAN ONLINE (Editable from CMS Tab: Alur) */}
      <section id="alur" className="py-10 sm:py-14 bg-white border-b border-slate-200/80 scroll-mt-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Bagaimana Cara Mendaftar?
              </span>
              <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900">
                Tahapan Pendaftaran Santri Baru
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Seluruh proses dilakukan secara daring melalui akun calon santri
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
            {activeSteps.map((item, idx) => (
              <div
                key={item.id}
                className="group relative p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 hover:bg-emerald-50/50 border border-slate-200/90 hover:border-emerald-400 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-800 text-amber-300 text-xs font-black shadow-2xs">
                      {item.step_number || String(idx + 1).padStart(2, '0')}
                    </span>
                    {item.icon_key && (
                      <DynamicIcon name={item.icon_key} className="w-4 h-4 text-emerald-700 shrink-0" />
                    )}
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 leading-snug group-hover:text-emerald-900">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. JADWAL PENTING PSB (Editable from CMS Tab: Jadwal) */}
      <section id="jadwal" className="py-10 sm:py-14 px-4 sm:px-6 max-w-6xl mx-auto w-full scroll-mt-28">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Kalender Akademik PSB
            </span>
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900">
              Jadwal Penting Seleksi TP {settings.academic_year || '2027/2028'}
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Pastikan Ayah/Bunda mencatat agenda seleksi berikut
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeSchedules.map((sch, idx) => {
            const badgeColors: Record<string, string> = {
              emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              amber: 'bg-amber-50 text-amber-800 border-amber-200',
              blue: 'bg-blue-50 text-blue-800 border-blue-200',
              teal: 'bg-teal-50 text-teal-800 border-teal-200',
              purple: 'bg-purple-50 text-purple-800 border-purple-200',
            };
            const colorClass = badgeColors[sch.badge_color || 'emerald'] || badgeColors.emerald;

            return (
              <div
                key={sch.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-3 hover:border-emerald-300 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {sch.title}
                    </h3>
                    {sch.description && (
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {sch.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    Waktu
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${colorClass}`}>
                    {sch.event_date_text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. CEK KESIAPAN PERSYARATAN & BERKAS INTERAKTIF (Editable from CMS Tab: Persyaratan) */}
      <section id="persyaratan" className="py-10 sm:py-14 bg-white border-y border-slate-200/80 scroll-mt-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Checklist Persiapan Ayah/Bunda
              </span>
              <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900">
                Persyaratan &amp; Berkas Administrasi
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sentuh baris persyaratan di bawah ini untuk menandai berkas Ananda yang sudah siap:
              </p>
            </div>

            {/* Interactive Readiness Counter + Mobile Tab Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              {totalReqsCount > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                  Kesiapan Berkas: {checkedReqsCount}/{totalReqsCount} Siap
                </div>
              )}

              <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 sm:hidden">
                <button
                  type="button"
                  onClick={() => setReqTab('BERKAS')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    reqTab === 'BERKAS'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Berkas ({docRequirements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReqTab('UMUM')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    reqTab === 'UMUM'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Syarat Umum ({generalRequirements.length})
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Berkas Administrasi Card */}
            <div
              className={`p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 ${
                reqTab === 'BERKAS' ? 'block' : 'hidden sm:block'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-3.5 pb-3 border-b border-slate-200/80">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                    Dokumen Berkas (Diunggah Online)
                  </h3>
                  <p className="text-[11px] text-slate-500">Format foto JPG/PNG atau PDF (Maks. 5 MB)</p>
                </div>
              </div>

              <ul className="space-y-2 text-xs text-slate-700">
                {docRequirements.map(req => {
                  const isChecked = !!checkedReqs[req.id];
                  return (
                    <li key={req.id}>
                      <button
                        type="button"
                        onClick={() => toggleReqCheck(req.id)}
                        className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2.5 ${
                          isChecked
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                            : 'bg-white border-slate-200/80 hover:border-emerald-300 text-slate-700'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <span className={isChecked ? 'line-through text-emerald-800/80 font-medium' : 'font-medium'}>
                          {req.description || req.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Syarat Umum Card */}
            <div
              className={`p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 ${
                reqTab === 'UMUM' ? 'block' : 'hidden sm:block'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-3.5 pb-3 border-b border-slate-200/80">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                    Persyaratan Umum Calon Santri
                  </h3>
                  <p className="text-[11px] text-slate-500">Kualifikasi dasar &amp; kesiapan berasrama</p>
                </div>
              </div>

              <ul className="space-y-2 text-xs text-slate-700">
                {generalRequirements.map(req => {
                  const isChecked = !!checkedReqs[req.id];
                  return (
                    <li key={req.id}>
                      <button
                        type="button"
                        onClick={() => toggleReqCheck(req.id)}
                        className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2.5 ${
                          isChecked
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                            : 'bg-white border-slate-200/80 hover:border-emerald-300 text-slate-700'
                        }`}
                      >
                        {isChecked ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <span className={isChecked ? 'line-through text-emerald-800/80 font-medium' : 'font-medium'}>
                          {req.description || req.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ RINGKAS (Editable from CMS Tab: FAQ) */}
      {activeFaqs.length > 0 && (
        <section id="faq" className="py-10 sm:py-14 px-4 sm:px-6 max-w-4xl mx-auto w-full scroll-mt-28">
          <div className="mb-6 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Pusat Informasi Wali Santri
            </span>
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900">
              Pertanyaan yang Sering Diajukan (FAQ)
            </h2>
          </div>

          <div className="space-y-2.5">
            {activeFaqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={faq.id || idx}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 font-bold text-xs sm:text-sm text-slate-800 hover:text-emerald-700 transition"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-emerald-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-4 pt-2 text-xs text-slate-600 leading-relaxed bg-slate-50/50 border-t border-slate-100">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 7. CTA BAWAH & KONTAK RESMI PANITIA (Editable from CMS Tabs: Beranda, Kontak, & Sosmed) */}
      <section id="kontak" className="py-8 sm:py-12 px-4 sm:px-6 max-w-6xl mx-auto w-full scroll-mt-28">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white p-6 sm:p-10 shadow-xl border border-emerald-800/60">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight leading-snug">
              {settings.cta_title ||
                `Siap Mendaftarkan Putra/Putri Anda di ${settings.site_short_name || 'PPTQM Darul Hikmah'}?`}
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              {settings.cta_description ||
                'Proses pendaftaran cepat, transparan, dan seluruh tahapan seleksi dapat dipantau langsung melalui HP Anda.'}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              {settings.cta_primary_button_active !== false && (
                <Button
                  variant="white"
                  size="lg"
                  onClick={() =>
                    onNavigate(settings.cta_primary_button_link || settings.hero_primary_button_link || '/register')
                  }
                  rightIcon={<ArrowRight className="w-4 h-4 text-emerald-950 shrink-0" />}
                  className="w-full sm:w-auto font-extrabold text-xs sm:text-sm px-6 py-3"
                >
                  {settings.cta_primary_button_text || 'Daftar Sekarang'}
                </Button>
              )}

              {settings.cta_secondary_button_active !== false && (
                <a
                  href={settings.cta_secondary_button_link || waLink}
                  target={(settings.cta_secondary_button_link || waLink).startsWith('http') ? '_blank' : undefined}
                  rel={(settings.cta_secondary_button_link || waLink).startsWith('http') ? 'noreferrer' : undefined}
                  onClick={(e) => {
                    const target = settings.cta_secondary_button_link || waLink;
                    if (!target.startsWith('http')) {
                      e.preventDefault();
                      onNavigate(target);
                    }
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-emerald-400/60 bg-emerald-950/40 hover:bg-emerald-700/70 text-xs sm:text-sm font-bold text-white transition"
                >
                  <Phone className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>
                    {settings.cta_secondary_button_text ||
                      `Hubungi Panitia (${waContact?.value || '+62 812-3456-7890'})`}
                  </span>
                </a>
              )}
            </div>
          </div>

          {/* Daftar Kontak & Media Sosial Aktif dari CMS */}
          {activeContacts.length > 0 && (
            <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {activeContacts.map(cnt => {
                const href =
                  cnt.link ||
                  (cnt.contact_type === 'WHATSAPP'
                    ? `https://wa.me/${cnt.value.replace(/[^0-9]/g, '')}`
                    : cnt.contact_type === 'EMAIL'
                    ? `mailto:${cnt.value}`
                    : undefined);

                const IconComp =
                  cnt.contact_type === 'WHATSAPP'
                    ? MessageCircle
                    : cnt.contact_type === 'EMAIL'
                    ? Mail
                    : cnt.contact_type === 'ALAMAT'
                    ? MapPin
                    : Globe;

                const Inner = (
                  <div className="p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-between gap-3 transition h-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/80">
                          {cnt.label}
                        </div>
                        <div className="text-xs font-bold text-white truncate">{cnt.value}</div>
                      </div>
                    </div>
                    {href && <ExternalLink className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
                  </div>
                );

                return href ? (
                  <a key={cnt.id} href={href} target="_blank" rel="noreferrer" className="block">
                    {Inner}
                  </a>
                ) : (
                  <div key={cnt.id}>{Inner}</div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 8. STICKY BOTTOM ACTION BAR KHUSUS LAYAR HP (Thumb-Friendly Mobile UX) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 sm:hidden shadow-lg">
        <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="col-span-2 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-emerald-600 text-emerald-800 bg-emerald-50 font-bold text-xs active:scale-98 transition"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Tanya WA</span>
          </a>
          <button
            type="button"
            onClick={() => onNavigate(settings.hero_primary_button_link || '/register')}
            className="col-span-3 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-700 text-white font-extrabold text-xs shadow-sm active:scale-98 transition"
          >
            <span>{settings.hero_primary_button_text || 'Daftar Sekarang'}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
