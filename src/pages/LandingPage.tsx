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
  HelpCircle,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Award,
  Users,
  Clock,
  ChevronDown,
  Sparkles,
  School,
  FileCheck,
  UserCheck,
  Eye,
  AlertCircle
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

  // Sync document title and meta with SEO fields
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

  // Contacts
  const waContact = contacts.find(c => c.contact_type === 'WHATSAPP' && c.is_active);
  const cleanWaNumber = waContact ? waContact.value.replace(/[^0-9]/g, '') : '6281234567890';
  const waLink = waContact?.link || `https://wa.me/${cleanWaNumber}`;

  return (
    <div className="flex flex-col min-h-screen">
      {/* 0. PREVIEW BANNER (Visible only in draft preview mode) */}
      {isPreviewMode && (
        <div className="sticky top-0 z-50 bg-slate-900 text-amber-300 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/40 shadow-md">
          <div className="flex items-center gap-2 font-bold">
            <Eye className="w-4 h-4 text-amber-400 shrink-0" />
            <span>PRATINJAU DRAFT CMS — Menampilkan versi draf yang belum dipublikasikan</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('/admin/landing-page')}
              className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs transition"
            >
              Kembali ke Editor CMS
            </button>
          </div>
        </div>
      )}

      {/* 0.1 ANNOUNCEMENT BANNER */}
      {activeAnnouncement && (
        <aside aria-label="Pengumuman Penting" className="bg-gradient-to-r from-amber-600 via-emerald-700 to-teal-800 text-white text-xs py-2.5 px-4 text-center font-medium flex items-center justify-center gap-2 shadow-xs z-20">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>
            <strong>{activeAnnouncement.title}</strong>: {activeAnnouncement.content}
          </span>
          {activeAnnouncement.button_link && (
            <button
              onClick={() => onNavigate(activeAnnouncement.button_link!)}
              className="ml-2 px-2.5 py-0.5 rounded bg-white text-slate-900 font-bold text-[11px] hover:bg-amber-100 transition shadow-xs"
            >
              {activeAnnouncement.button_text || 'Lihat Info'}
            </button>
          )}
        </aside>
      )}

      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 text-white pt-20 pb-28">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Logo Lembaga (CMS atau Fallback) */}
            <div className="mb-6 flex justify-center">
              {settings.logo_path || settings.logo_url ? (
                <div className="p-3 bg-white rounded-2xl shadow-xl shadow-emerald-950/40 border-2 border-emerald-400/40 inline-flex items-center justify-center">
                  <img
                    src={getLogoUrlWithCacheBust(settings.logo_path || settings.logo_url, settings.updated_at)}
                    alt={settings.site_name || 'Logo PPTQM Darul Hikmah'}
                    className="h-16 sm:h-20 w-auto object-contain max-w-[220px]"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-xl shadow-emerald-950/40 border border-emerald-300/30">
                  <BookOpen className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-6 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{settings.hero_badge || 'Penerimaan Santri Baru Jenjang SMP'}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white mb-6">
              {settings.hero_title || 'PENERIMAAN SANTRI BARU'} <br />
              <span className="text-emerald-400">{settings.hero_highlight || settings.site_short_name}</span> <br />
              <span className="text-amber-400 font-light text-2xl sm:text-3xl">
                TAHUN PELAJARAN {settings.academic_year || '2027/2028'}
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-8 max-w-2xl mx-auto">
              {settings.hero_description || 'Mendidik generasi Qur’ani yang berakhlak mulia, unggul dalam sains & bahasa internasional, serta berkarakter kepemimpinan islami berbasis asrama modern.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => onNavigate(settings.hero_primary_button_link || '/register')}
                rightIcon={<ArrowRight className="w-4 h-4 text-emerald-950 shrink-0" />}
                className="w-full sm:w-auto shadow-lg shadow-emerald-900/50 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-extrabold border-transparent"
              >
                {settings.hero_primary_button_text || 'Daftar Calon Santri Sekarang'}
              </Button>
              <Button
                size="lg"
                variant="outline-white"
                onClick={() => onNavigate(settings.hero_secondary_button_link || '/login')}
                className="w-full sm:w-auto"
              >
                {settings.hero_secondary_button_text || 'Masuk Akun Pendaftar'}
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar (Dynamic from CMS stats) */}
          {activeStats.length > 0 && (
            <div className={`mt-16 grid grid-cols-2 md:grid-cols-${Math.min(4, Math.max(2, activeStats.length))} gap-4 max-w-4xl mx-auto`}>
              {activeStats.map((st, idx) => (
                <div key={st.id || idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs text-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 mb-1">{st.value}</div>
                  <div className="text-xs text-slate-300 font-medium">{st.label}</div>
                  {st.description && <div className="text-[10px] text-slate-400 mt-0.5">{st.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. TENTANG PSB & PROFIL PESANTREN */}
      <section id="tentang" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">Tentang Lembaga</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {settings.site_name || 'Pondok Pesantren Tahfidzul Qur\'an Modern (PPTQM) Darul Hikmah'}
            </h3>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              Memadukan kurikulum nasional Kemenag/Kemendikbud dengan sistem kepesantrenan tahfidz 24 jam untuk melahirkan lulusan berintelektual tinggi dan berjiwa qur'ani.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-5">
                <BookOpen className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Tahfidz Al-Qur'an Intensif</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Metode talaqqi, tahsin bersanad, dan muraja’ah harian terprogram bersama asatidz penghafal Qur'an 30 juz berijazah sanad muttashil.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-5">
                <School className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Kurikulum Terintegrasi SMP</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Penyelenggaraan pendidikan formal SMP terakreditasi A dengan penguasaan sains, matematika, bahasa Arab, dan bahasa Inggris terapan.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center mb-5">
                <UserCheck className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Pendidikan Karakter & Adab</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pembiasaan ibadah sunnah, kemandirian hidup berasrama, kedisiplinan, kepemimpinan (Qiyadah), serta etika pergaulan islami.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PERSYARATAN PENDAFTARAN */}
      <section id="persyaratan" className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">Persyaratan Pendaftaran</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Syarat Calon Santri Baru Kelas 7 SMP TP {settings.academic_year || '2027/2028'}
            </h3>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              Pastikan calon santri dan wali telah memenuhi ketentuan administrasi sebelum mengirimkan formulir final.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Syarat Umum */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Persyaratan Umum & Kesiapan</h4>
                  <p className="text-xs text-slate-500">Kelayakan calon santri</p>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-slate-700">
                {generalRequirements.map(req => (
                  <li key={req.id} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{req.description || req.title}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Syarat Administrasi / Berkas */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Data & Dokumen Administrasi</h4>
                  <p className="text-xs text-slate-500">Kelengkapan identitas</p>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-slate-700">
                {docRequirements.map(req => (
                  <li key={req.id} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{req.description || req.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ALUR & TAHAPAN SELEKSI */}
      <section id="alur" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">Alur Pendaftaran</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tahapan Penerimaan Santri Baru Online
            </h3>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              Enam langkah mudah mendaftar dari pembuatan akun hingga penetapan status santri resmi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {activeSteps.map(item => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between hover:border-emerald-500 hover:shadow-md transition"
              >
                <div>
                  <div className="text-2xl font-black text-emerald-700 mb-2">{item.step_number}</div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1.5">{item.title}</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. JADWAL PENDAFTARAN & AGENDA (Dynamic from CMS schedules) */}
      <section id="jadwal" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Agenda Kegiatan</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Jadwal Penting PSB TP {settings.academic_year || '2027/2028'}
            </h3>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              Catat tanggal dan pastikan tidak terlewat setiap tahapan seleksi.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {activeSchedules.map(sch => {
              const badgeColors: Record<string, string> = {
                emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800',
                amber: 'bg-amber-950/60 text-amber-400 border-amber-800',
                blue: 'bg-blue-950/60 text-blue-400 border-blue-800',
                teal: 'bg-teal-950/60 text-teal-400 border-teal-800',
                purple: 'bg-purple-950/60 text-purple-400 border-purple-800',
              };
              const colorClass = badgeColors[sch.badge_color || 'emerald'] || badgeColors.emerald;

              return (
                <div
                  key={sch.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{sch.title}</h4>
                      <p className="text-xs text-slate-400">{sch.description}</p>
                    </div>
                  </div>
                  <div className={`text-xs font-semibold sm:text-right px-3 py-1.5 rounded-lg border ${colorClass} shrink-0`}>
                    {sch.event_date_text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. FAQ (Pertanyaan yang Sering Diajukan) */}
      <section id="faq" className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">Tanya Jawab</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Pertanyaan yang Sering Diajukan (FAQ)
            </h3>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              Temukan jawaban cepat atas pertanyaan seputar pendaftaran santri baru.
            </p>
          </div>

          <div className="space-y-3">
            {activeFaqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={faq.id || idx}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-slate-800 hover:text-emerald-700 transition"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-emerald-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. CTA BOTTOM BANNER */}
      <section className="bg-emerald-800 text-white py-16 sm:py-20 border-t border-emerald-700/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-4 tracking-tight leading-snug">
            {settings.cta_title || `Siap Menjadi Bagian dari Keluarga Besar ${settings.site_short_name || 'PPTQM Darul Hikmah'}?`}
          </h3>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed font-normal">
            {settings.cta_description || 'Daftarkan putra/putri Anda sekarang sebelum kuota 120 santri baru terpenuhi. Proses pendaftaran mudah, transparan, dan dapat dipantau langsung secara online.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto">
            {settings.cta_primary_button_active !== false && (
              <Button
                variant="white"
                size="lg"
                onClick={() => onNavigate(settings.cta_primary_button_link || settings.hero_primary_button_link || '/register')}
                rightIcon={<ArrowRight className="w-4 h-4 text-emerald-950 shrink-0" />}
                className="w-full sm:w-auto shadow-xl hover:shadow-2xl transition-all duration-200 font-extrabold text-sm sm:text-base px-7 py-3.5 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-emerald-800"
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
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border-2 border-emerald-400/80 hover:bg-emerald-700/90 text-xs sm:text-sm font-bold transition text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-emerald-800 select-none shadow-md"
              >
                <Phone className="w-4 h-4 text-white shrink-0" />
                <span>
                  {settings.cta_secondary_button_text
                    ? (waContact && !settings.cta_secondary_button_text.includes(waContact.value)
                        ? `${settings.cta_secondary_button_text} (${waContact.value})`
                        : settings.cta_secondary_button_text)
                    : `Hubungi Panitia (${waContact?.value || '+62 812-3456-7890'})`}
                </span>
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
