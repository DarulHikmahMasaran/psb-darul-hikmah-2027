import React, { useState, useEffect } from 'react';
import { BookOpen, Phone, Mail, MapPin, CheckCircle, ShieldCheck } from 'lucide-react';
import { cmsService, getLogoUrlWithCacheBust } from '../services/cmsService';
import { settingsService } from '../services/settingsService';

export const Footer: React.FC = () => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [siteName, setSiteName] = useState('PPTQM DARUL HIKMAH');
  const [academicYear, setAcademicYear] = useState('2027/2028');
  const [contactWa, setContactWa] = useState('+62 812-3456-7890');
  const [contactEmail, setContactEmail] = useState('psb@darulhikmah.sch.id');

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
      if (snap?.settings?.academic_year) {
        setAcademicYear(snap.settings.academic_year);
      }
    }).catch(err => {
      console.warn('Footer could not load published CMS settings', err);
    });
  }, []);

  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand & Identity */}
          <div className="space-y-4">
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
                <h3 className="text-white font-extrabold text-sm tracking-tight">
                  {siteName}
                </h3>
                <p className="text-[11px] text-emerald-400 font-medium">Tahun Pelajaran {academicYear}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pondok Pesantren Tahfidzul Qur'an Modern (PPTQM) Darul Hikmah menyelenggarakan pendidikan jenjang SMP berasrama (Boarding School) yang memadukan kurikulum nasional, tahfidzul qur'an mutqin, bahasa Arab & Inggris aktif, serta adab islami.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Terakreditasi A • Berizin Resmi Kemenag</span>
            </div>
          </div>

          {/* Program Unggulan */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4 border-l-2 border-emerald-500 pl-2.5">
              Program Unggulan
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Tahfidz Al-Qur'an Bersanad (Target 30 Juz)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Dwi Bahasa Aktif (Arab & Inggris Sehari-hari)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Kurikulum Merdeka Berbasis Sains & Tauhid</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Pembinaan Karakter Adab & Akhlaqul Karimah</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Ekstrakurikuler Panahan, Silat, IT & Robotika</span>
              </li>
            </ul>
          </div>

          {/* Tahapan PSB */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4 border-l-2 border-emerald-500 pl-2.5">
              Tahapan PSB 2027/2028
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>1. Pendaftaran Akun & Registrasi Online</li>
              <li>2. Pengisian Biodata Lengkap Calon Santri</li>
              <li>3. Verifikasi Berkas & Konfirmasi Panitia</li>
              <li>4. Penerbitan Kartu Tes & Jadwal Seleksi</li>
              <li>5. Seleksi Masuk (Baca Al-Qur'an & Wawancara)</li>
              <li>6. Pengumuman Kelulusan & Daftar Ulang</li>
            </ul>
          </div>

          {/* Kontak Sekretariat PSB */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4 border-l-2 border-emerald-500 pl-2.5">
              Sekretariat Panitia PSB
            </h4>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Kampus PPTQM Darul Hikmah, Jl. Pesantren No. 07, Sukamaju, Jawa Barat</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>WhatsApp: {contactWa}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Email: {contactEmail}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 mt-2">
                <p className="text-[11px] font-medium text-slate-300">Jam Layanan Helpdesk:</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Senin - Sabtu: 08.00 - 16.00 WIB</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} PPTQM Darul Hikmah. Hak Cipta Dilindungi Undang-Undang.</p>
          <div className="flex items-center gap-4">
            <span>Sistem Penerimaan Santri Baru SMP</span>
            <span>•</span>
            <span className="text-emerald-500 font-medium">TP 2027/2028</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
