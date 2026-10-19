import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { candidateService } from '../services/candidateService';
import { documentService } from '../services/documentService';
import { settingsService } from '../services/settingsService';
import { Candidate, CandidateDocument, DocumentType } from '../types/database';
import { DocumentUploadCard } from '../components/DocumentUploadCard';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { Badge } from '../components/Badge';
import { LoadingSpinner } from '../components/Loading';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  HelpCircle,
  FolderOpen
} from 'lucide-react';

export interface PesertaDocumentsPageProps {
  onNavigate: (route: string) => void;
}

export const PesertaDocumentsPage: React.FC<PesertaDocumentsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sysSettings, setSysSettings] = useState<Record<string, string>>({});
  const [copiedRek, setCopiedRek] = useState(false);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<CandidateDocument | null>(null);

  // Global notification
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadInitialData(user.id);
    }
  }, [user?.id]);

  const loadInitialData = async (userId: string) => {
    setIsLoading(true);
    try {
      const cand = await candidateService.getCandidateByUserId(userId);
      setCandidate(cand);

      if (cand) {
        const [types, docs, cfg] = await Promise.all([
          documentService.getDocumentTypes(),
          documentService.getCandidateDocuments(cand.id),
          settingsService.getSettings(),
        ]);
        setDocumentTypes(types);
        setDocuments(docs);
        setSysSettings(cfg);
      }
    } catch (err: any) {
      setAlertInfo({ type: 'error', text: err.message || 'Gagal memuat dokumen.' });
    } finally {
      setIsLoading(false);
    }
  };

  const reloadDocuments = async () => {
    if (!candidate) return;
    const docs = await documentService.getCandidateDocuments(candidate.id);
    setDocuments(docs);
  };

  const handleUpload = async (documentTypeId: string, file: File) => {
    if (!candidate || !user) return;
    const res = await documentService.uploadCandidateDocument({
      candidateId: candidate.id,
      documentTypeId,
      file,
      userId: user.id,
      userEmail: user.email,
    });

    if (res.success) {
      setAlertInfo({ type: 'success', text: `Berkas "${file.name}" berhasil diunggah.` });
      await reloadDocuments();
    } else {
      throw new Error(res.error || 'Gagal mengunggah berkas.');
    }
  };

  const handleReplace = async (documentId: string, file: File) => {
    if (!user) return;
    const res = await documentService.replaceCandidateDocument({
      documentId,
      file,
      userId: user.id,
      userEmail: user.email,
    });

    if (res.success) {
      setAlertInfo({ type: 'success', text: `Berkas berhasil diperbarui dengan "${file.name}".` });
      await reloadDocuments();
    } else {
      throw new Error(res.error || 'Gagal memperbarui berkas.');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!user) return;
    const res = await documentService.deleteCandidateDocument({
      documentId,
      userId: user.id,
      userEmail: user.email,
    });

    if (res.success) {
      setAlertInfo({ type: 'success', text: 'Berkas berhasil dihapus.' });
      await reloadDocuments();
    } else {
      setAlertInfo({ type: 'error', text: res.error || 'Gagal menghapus berkas.' });
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Memuat berkas persyaratan..." className="min-h-[60vh]" />;
  }

  if (!candidate) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Alert type="error" message="Data pendaftar tidak ditemukan." />
      </div>
    );
  }

  // Calculate statistics
  const requiredTypes = documentTypes.filter((dt) => dt.is_required);
  const totalRequired = requiredTypes.length;

  const uploadedRequiredCount = requiredTypes.filter((type) =>
    documents.some((d) => d.document_type_id === type.id && d.status !== 'DITOLAK')
  ).length;

  const hasRejectedDocs = documents.some((d) => d.status === 'DITOLAK');
  const allRequiredUploaded = uploadedRequiredCount >= totalRequired && !hasRejectedDocs;

  // Candidate is locked if TERDAFTAR or TERVERIFIKASI, UNLESS panitia set status to PERLU_PERBAIKAN
  const isLocked = candidate.status === 'TERDAFTAR' || candidate.status === 'TERVERIFIKASI';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/peserta/dashboard')}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            aria-label="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Unggah Berkas Persyaratan PSB
            </h1>
            <p className="text-xs text-slate-500">
              No. Registrasi: <span className="font-mono font-bold text-emerald-800">{candidate.registration_number}</span> • {candidate.full_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge status={candidate.status} size="md" />
        </div>
      </div>

      {/* Alert Notifications */}
      {alertInfo && (
        <Alert
          type={alertInfo.type}
          message={alertInfo.text}
          onClose={() => setAlertInfo(null)}
        />
      )}

      {hasRejectedDocs && (
        <Alert
          type="error"
          title="Perhatian: Terdapat Berkas yang Ditolak Panitia"
          message="Panitia telah menolak beberapa berkas Anda. Silakan baca catatan penolakan pada kartu dokumen terkait, lalu klik 'Upload Ulang' untuk memperbaikinya."
        />
      )}

      {isLocked && (
        <Alert
          type="info"
          title="Berkas Sedang Diverifikasi Panitia"
          message={`Pendaftaran Anda telah disubmit dengan status ${candidate.status}. Selama proses verifikasi, berkas tidak dapat diubah kecuali panitia meminta perbaikan.`}
        />
      )}

      {/* Official Bank Account & Payment Info Card */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-5 rounded-2xl shadow-sm border border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">
            <ShieldCheck className="w-3.5 h-3.5" /> Informasi Pembayaran Resmi PSB
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-white">
            Infaq Pendaftaran: Rp {Number(sysSettings.registration_fee || 350000).toLocaleString('id-ID')}
          </h3>
          <p className="text-xs text-emerald-100">
            Transfer ke Rekening Resmi <strong>{sysSettings.bank_name || 'Bank Syariah Indonesia (BSI)'}</strong> a.n. <strong>{sysSettings.bank_account_holder || 'Yayasan PPTQM Darul Hikmah'}</strong>, lalu unggah bukti transfer pada kartu <strong>Bukti Pembayaran Biaya Pendaftaran</strong> di bawah.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-xs px-4 py-3 rounded-xl border border-white/20 flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div>
            <span className="text-[10px] text-emerald-200 uppercase font-bold block">Nomor Rekening Resmi</span>
            <span className="font-mono text-lg font-black text-amber-300 tracking-wider">
              {sysSettings.bank_account_number || '7123456789'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const num = sysSettings.bank_account_number || '7123456789';
              try {
                navigator.clipboard?.writeText(num);
              } catch {}
              setCopiedRek(true);
              setTimeout(() => setCopiedRek(false), 2000);
            }}
            className="px-3 py-1.5 rounded-lg bg-white text-emerald-950 hover:bg-emerald-50 font-bold text-xs transition cursor-pointer"
          >
            {copiedRek ? 'Tersalin!' : 'Salin No. Rek'}
          </button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-sm text-slate-900">Progres Berkas Persyaratan Wajib</h3>
          </div>
          <span className="text-xs font-bold text-emerald-800">
            {uploadedRequiredCount} dari {totalRequired} dokumen wajib telah diunggah
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden mb-3">
          <div
            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${totalRequired > 0 ? (uploadedRequiredCount / totalRequired) * 100 : 0}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-between">
            <span>Total Berkas:</span>
            <span className="font-bold">{documents.length}</span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-between">
            <span>Diterima:</span>
            <span className="font-bold">{documents.filter((d) => d.status === 'DITERIMA').length}</span>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-between">
            <span>Menunggu:</span>
            <span className="font-bold">{documents.filter((d) => d.status === 'MENUNGGU_VERIFIKASI').length}</span>
          </div>
          <div className="p-2 rounded-lg bg-rose-50 text-rose-800 flex items-center justify-between">
            <span>Ditolak:</span>
            <span className="font-bold">{documents.filter((d) => d.status === 'DITOLAK').length}</span>
          </div>
        </div>
      </div>

      {/* Document Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {documentTypes.map((type) => {
          const typeDocs = documents.filter((d) => d.document_type_id === type.id);
          return (
            <DocumentUploadCard
              key={type.id}
              documentType={type}
              documents={typeDocs}
              isLocked={isLocked}
              onUpload={handleUpload}
              onReplace={handleReplace}
              onDelete={handleDelete}
              onPreview={(doc) => setPreviewDoc(doc)}
            />
          );
        })}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-600 text-center sm:text-left">
          {allRequiredUploaded ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Seluruh berkas wajib telah siap untuk direview.
            </span>
          ) : (
            <span>
              Lengkapi berkas wajib (KK, Akta, KTP Ortu, Dokumen Sekolah, Pas Foto) sebelum lanjut ke review final.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="md"
            onClick={() => onNavigate('/peserta/biodata')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            className="flex-1 sm:flex-none"
          >
            Kembali ke Biodata
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigate('/peserta/review')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="flex-1 sm:flex-none bg-emerald-700 hover:bg-emerald-800 font-bold"
          >
            Lanjut Review & Kirim Final
          </Button>
        </div>
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />
    </div>
  );
};
