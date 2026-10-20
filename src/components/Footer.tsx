import React, { useState, useEffect } from 'react';
import { BookOpen, Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { cmsService, getLogoUrlWithCacheBust } from '../services/cmsService';
import { settingsService } from '../services/settingsService';
import { LandingPageStep } from '../types/cms';

export const Footer: React.FC = () => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [siteName, setSiteName] = useState('PPTQM DARUL HIKMAH');
  const [heroDesc, setHeroDesc] = useState(
    'Pondok Pesantren Tahfidzul Qur’an Modern (PPTQM) Darul Hikmah menyelenggarakan pendidikan jenjang SMP berasrama yang memadukan kurikulum nasional, tahfidzul Qur’an bersanad, serta pembinaan adab islami.'
  );
  const [academicYear, setAcademicYear] = useState('2027/2028');
  const [contactWa, setContactWa] = useState('+62 812-3456-7890');
  const [contactEmail, setContactEmail] = useState('psb@darulhikmah.sch.id');
  const [contactAddress, setContactAddress] = useState('Kampus PPTQM Darul Hikmah');
  const [steps, setSteps] = useState<LandingPageStep[]>([]);

  useEffect(() => {
    settingsService.getSettings().then(cfg => {
      if (cfg.contact_wa) setContactWa(cfg.contact_wa);
      if (cfg.contact_email) setContactEmail(cfg.contact_email);
    }).catch(() => {});
    cmsService.getPublishedContent().then(snap => {
      const logo = snap?.settings?.logo_path || snap?.settings?.logo_url;
      if (logo) {
        setLogoUrl(getLogoUrlWithCacheBust(logo, snap.settings.updated_at) || null);
      }
      if (snap?.settings?.site_name) {
        setSiteName(snap.settings.site_name);
      }
      if (snap?.settings?.hero_description) {
        setHeroDesc(snap.settings.hero_description);
      }
      if (snap?.settings?.academic_year) {
        setAcademicYear(snap.settings.academic_year);
      }
      if (snap?.steps?.length) {
        setSteps([...snap.steps].filter(s => s.is_active).sort((a, b) => a.sort_order - b.sort_order));
      }
      const wa = snap?.contacts?.find(c => c.contact_type === 'WHATSAPP' && c.is_active);
      if (wa?.value) setContactWa(wa.value);
      const em = snap?.contacts?.find(c => c.contact_type === 'EMAIL' && c.is_active);
      if (em?.value) setContactEmail(em.value);
      const addr = snap?.contacts?.find(c => c.contact_type === 'ALAMAT' && c.is_active);
      if (addr?.value) setContactAddress(addr.value);
    }).catch(() => {});
  }, []);

  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-24 sm:pb-10 border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* Brand & Identity */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1 overflow-hidden shrink-0">
                  <img
                    src={logoUrl}
                    alt={siteName}
                    className="w-full h-full object-contain"
                    onError={() => setLogoUrl(null)}
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-white font-extrabold text-sm tracking-tight">{siteName}</h3>
                <p className="text-[11px] text-emerald-400 font-medium">Tahun Pelajaran {academicYear}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{heroDesc}</p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Portal Resmi Penerimaan Santri Baru (PSB) Online</span>
            </div>
          </div>

          {/* Tahapan PSB (Dinamis dari CMS Alur) */}
          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3.5 border-l-2 border-emerald-500 pl-2.5">
              Alur Pendaftaran PSB {academicYear}
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              {steps.length > 0 ? (
                steps.slice(0, 6).map((st, idx) => (
                  <li key={st.id || idx}>
                    {idx + 1}. {st.title}
                  </li>
                ))
              ) : (
                <>
                  <li>1. Registrasi Akun Calon Santri</li>
                  <li>2. Pengisian Biodata &amp; Unggah Berkas</li>
                  <li>3. Verifikasi Panitia &amp; Cetak Kartu QR</li>
                  <li>4. Pelaksanaan Ujian CBT &amp; Tes Al-Qur&apos;an</li>
                  <li>5. Pengumuman Kelulusan &amp; Daftar Ulang</li>
                </>
              )}
            </ul>
          </div>

          {/* Kontak Sekretariat PSB (Dinamis dari CMS Kontak) */}
          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3.5 border-l-2 border-emerald-500 pl-2.5">
              Sekretariat Panitia PSB
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{contactAddress}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>WhatsApp: {contactWa}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Email: {contactEmail}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} {siteName}. Hak Cipta Dilindungi.</p>
          <span className="text-emerald-500 font-medium">Portal PSB Online • TP {academicYear}</span>
        </div>
      </div>
    </footer>
  );
};
