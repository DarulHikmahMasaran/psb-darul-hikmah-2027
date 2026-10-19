import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { cmsService } from '../services/cmsService';
import { LandingPageSnapshot } from '../types/cms';
import { LandingPage } from './LandingPage';
import { LoadingSpinner } from '../components/Loading';

export interface LandingPagePreviewProps {
  onNavigate: (route: string) => void;
}

export const LandingPagePreview: React.FC<LandingPagePreviewProps> = ({ onNavigate }) => {
  const { role } = useAuth();
  const [draftSnapshot, setDraftSnapshot] = useState<LandingPageSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isStaff = role === 'SUPER_ADMIN' || role === 'PANITIA' || role === 'PIMPINAN';

  useEffect(() => {
    if (!isStaff) {
      setIsLoading(false);
      return;
    }
    cmsService.getDraftContent()
      .then(draft => {
        setDraftSnapshot(draft);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isStaff]);

  if (!isStaff) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Akses Pratinjau Draf Ditolak</h3>
        <p className="text-xs text-slate-500">
          Halaman pratinjau draf hanya dapat diakses oleh Panitia, Super Admin, dan Pimpinan.
        </p>
        <button
          onClick={() => onNavigate('/')}
          className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-xs font-bold"
        >
          Kembali ke Beranda Publik
        </button>
      </div>
    );
  }

  if (isLoading || !draftSnapshot) {
    return <LoadingSpinner text="Menyiapkan pratinjau draf landing page..." className="min-h-[80vh]" />;
  }

  return (
    <LandingPage
      onNavigate={onNavigate}
      previewSnapshot={draftSnapshot}
      isPreviewMode={true}
    />
  );
};
