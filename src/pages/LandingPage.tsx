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
  ExternalLink
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
  const [reqTab, setReqTab] = useState<'UMUM' | 'BERKAS'>('UMUM');
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
          className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white text-xs py-2.5 px-3.5 sm:px-6 border-b border-emerald-700/60"
        >
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              {activeAnnouncement.title}:
            </span>
            <span className="text-emerald-50">{activeAnnouncement.content}</span>
            {activeAnnouncement.button_link && (
              <button
                onClick={() => onNavigate(activeAnnouncement.button_link!)}
                className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[11px] hover:bg-amber-300 transition shrink-0"
              >
                {activeAnnouncement.button_text || 'Lihat Info'}
              </button>
            )}
          </div>
        </aside>
      )}

      {/* 1. COMPACT & MOBILE-FRIENDLY HERO SECTION (Editable from CMS Tab: Beranda & Statistik) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white pt-8 pb-10 sm:pt-14 sm:pb-16">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:18px_18px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex flex-col items-center text-center">
            {/* Logo & Badge Row */}
            <div className="flex flex-col items-center gap-3 mb-4">
              {settings.logo_path || settings.logo_url ? (
                <div className="p-2.5 bg-white rounded-2xl shadow-lg border border-emerald-400/30 inline-flex items-center justify-center">
                  <img
                    src={getLogoUrlWithCacheBust(settings.logo_path || settings.logo_url, settings.updated_at)}
                    alt={settings.site_name || 'Logo PPTQM Darul Hikmah'}
                    className="h-12 sm:h-16 w-auto object-contain max-w-[180px]"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-md">
                  <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
              )}

              <div className="inline-flex flex-wrap items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-[11px] sm:text-xs font-semibold">
                <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                <span>{settings.hero_badge || 'Penerimaan Santri Baru Jenjang SMP'}</span>
                {settings.program_label && (
                  <span className="text-amber-300 font-bold">• {settings.program_label}</span>
                )}
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-snug sm:leading-tight text-white max-w-3xl">
              {settings.hero_title || 'Penerimaan Santri Baru'}{' '}
              <span className="text-emerald-400 block sm:inline">
                {settings.hero_highlight || settings.site_short_name || 'PPTQM Darul Hikmah'}
              </span>
            </h1>

            <p className="mt-1.5 text-sm sm:text-lg font-bold text-amber-300 tracking-wide">
              Tahun Pelajaran {settings.academic_year || '2027/2028'}
              {settings.hero_subtitle ? ` — ${settings.hero_subtitle}` : ''}
            </p>

            {/* Concise Description */}
            <p className="mt-3 text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-xl">
              {settings.hero_description ||
                'Mendidik generasi Qur’ani yang berakhlak mulia, unggul dalam akademik SMP & bahasa internasional dengan sistem asrama modern.'}
            </p>

            {/* Primary & Secondary Action Buttons */}
            <div className="mt-6 w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
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

            {/* Compact Stats Grid (Editable from CMS Tab: Statistik) */}
            {activeStats.length > 0 && (
              <div className="mt-8 w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 max-w-3xl">
                {activeStats.map((st, idx) => (
                  <div
                    key={st.id || idx}
                    className="p-3 sm:p-4 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs text-center flex flex-col items-center justify-center"
                  >
                    <div className="text-lg sm:text-2xl font-extrabold text-amber-300 leading-tight">
                      {st.value}
                    </div>
                    <div className="text-[11px] sm:text-xs text-white font-semibold mt-0.5">
                      {st.label}
                    </div>
                    {st.description && (
                      <div className="text-[10px] text-emerald-200/80 mt-0.5 line-clamp-1">
                        {st.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. STICKY QUICK-JUMP NAVIGATION PILLS (Sangat Nyaman untuk Layar HP) */}
      <nav
        aria-label="Navigasi Cepat Halaman Utama"
        className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs"
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => scrollToSection('jadwal')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition whitespace-nowrap shrink-0"
          >
            📅 Jadwal PSB
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('alur')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition whitespace-nowrap shrink-0"
          >
            🧭 Alur Pendaftaran
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('persyaratan')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition whitespace-nowrap shrink-0"
          >
            📋 Syarat & Berkas
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('faq')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition whitespace-nowrap shrink-0"
          >
            ❓ Tanya Jawab (FAQ)
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('kontak')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition whitespace-nowrap shrink-0"
          >
            📞 Kontak Panitia
          </button>
        </div>
      </nav>

      {/* 3. JADWAL PENTING PSB (Editable from CMS Tab: Jadwal) */}
      <section id="jadwal" className="py-10 sm:py-14 px-4 sm:px-6 max-w-5xl mx-auto w-full scroll-mt-28">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Agenda Seleksi
            </span>
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900">
              Jadwal Penerimaan Santri Baru
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Tahun Pelajaran {settings.academic_year || '2027/2028'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeSchedules.map(sch => {
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
                className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2.5 hover:border-emerald-300 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                        {sch.title}
                      </h3>
                      {sch.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {sch.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-1 border-t border-slate-100">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${colorClass}`}>
                    {sch.event_date_text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. ALUR PENDAFTARAN RINGKAS (Editable from CMS Tab: Alur) */}
      <section id="alur" className="py-10 sm:py-14 bg-white border-y border-slate-200/80 scroll-mt-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Langkah Mudah
            </span>
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900">
              Alur Pendaftaran Online
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
            {activeSteps.map(item => (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between hover:border-emerald-400 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-emerald-700 text-white text-xs font-extrabold">
                      {item.step_number}
                    </span>
                    {item.icon_key && (
                      <DynamicIcon name={item.icon_key} className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 leading-snug">
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

      {/* 5. PERSYARATAN & BERKAS (Tab Interaktif Hemat Ruang di HP — Editable from CMS Tab: Persyaratan) */}
      <section id="persyaratan" className="py-10 sm:py-14 px-4 sm:px-6 max-w-5xl mx-auto w-full scroll-mt-28">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Ketentuan Pendaftar
            </span>
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900">
              Persyaratan & Berkas Pendaftaran
            </h2>
          </div>

          {/* Mobile Tab Switcher so HP users don't get a long wall of text */}
          <div className="inline-flex p-1 rounded-xl bg-slate-200/80 sm:hidden self-start">
            <button
              type="button"
              onClick={() => setReqTab('UMUM')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                reqTab === 'UMUM'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Syarat Umum ({generalRequirements.length})
            </button>
            <button
              type="button"
              onClick={() => setReqTab('BERKAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                reqTab === 'BERKAS'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Berkas Dokumen ({docRequirements.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Syarat Umum Card */}
          <div
            className={`p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs ${
              reqTab === 'UMUM' ? 'block' : 'hidden sm:block'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Persyaratan Umum</h3>
                <p className="text-[11px] text-slate-500">Kualifikasi calon santri baru</p>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-700">
              {generalRequirements.map(req => (
                <li key={req.id} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{req.description || req.title}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Berkas Administrasi Card */}
          <div
            className={`p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs ${
              reqTab === 'BERKAS' ? 'block' : 'hidden sm:block'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Dokumen Administrasi</h3>
                <p className="text-[11px] text-slate-500">Diunggah melalui dashboard santri</p>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-700">
              {docRequirements.map(req => (
                <li key={req.id} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{req.description || req.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 6. FAQ RINGKAS (Editable from CMS Tab: FAQ) */}
      {activeFaqs.length > 0 && (
        <section id="faq" className="py-10 sm:py-14 bg-white border-t border-slate-200/80 scroll-mt-28">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="mb-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Pusat Bantuan
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
                    className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden transition"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 font-bold text-xs sm:text-sm text-slate-800 hover:text-emerald-700 transition"
                    >
                      <span>{faq.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                          isOpen ? 'rotate-180 text-emerald-600' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-2 text-xs text-slate-600 leading-relaxed bg-white border-t border-slate-100">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 7. CTA BAWAH & KONTAK RESMI PANITIA (Editable from CMS Tabs: Beranda, Kontak, & Sosmed) */}
      <section id="kontak" className="py-10 sm:py-14 px-4 sm:px-6 max-w-5xl mx-auto w-full scroll-mt-28">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white p-6 sm:p-10 shadow-lg">
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
