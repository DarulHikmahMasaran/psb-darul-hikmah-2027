import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { candidateService } from '../services/candidateService';
import { documentService } from '../services/documentService';
import { Candidate, CandidateDocument, DocumentType } from '../types/database';
import { calculateBiodataProgress } from '../utils/progress';
import { formatDateIndonesian } from '../utils/formatters';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import {
  FileCheck2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Send,
  User,
  School,
  MapPin,
  Users,
  Eye,
  Lock,
  ShieldCheck
} from 'lucide-react';

export interface PesertaReviewPageProps {
  onNavigate: (route: string) => void;
}

export const PesertaReviewPage: React.FC<PesertaReviewPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Checkbox confirmation
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<CandidateDocument | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadData(user.id);
    }
  }, [user?.id]);

  const loadData = async (userId: string) => {
    setIsLoading(true);
    try {
      const cand = await candidateService.getCandidateByUserId(userId);
      setCandidate(cand);
      if (cand) {
        const [types, docs] = await Promise.all([
          documentService.getDocumentTypes(),
          documentService.getCandidateDocuments(cand.id),
        ]);
        setDocumentTypes(types);
        setDocuments(docs);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat data pendaftaran.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Menyiapkan lembar review pendaftaran..." className="min-h-[60vh]" />;
  }

  if (!candidate) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Alert type="error" message="Data pendaftar tidak ditemukan." />
      </div>
    );
  }

  const biodataProgress = calculateBiodataProgress(candidate);
  const isBiodataComplete = biodataProgress.isAllMandatoryFilled;

  const requiredTypes = documentTypes.filter((t) => t.is_required);
  const missingRequiredTypes = requiredTypes.filter(
    (type) => !documents.some((d) => d.document_type_id === type.id && d.status !== 'DITOLAK')
  );

  const rejectedDocs = documents.filter((d) => d.status === 'DITOLAK');
  const hasRejectedDocs = rejectedDocs.length > 0;
  const isDocumentsComplete = missingRequiredTypes.length === 0 && !hasRejectedDocs;

  const canSubmit = isBiodataComplete && isDocumentsComplete && isConfirmed;
  const isAlreadySubmitted = candidate.status === 'TERDAFTAR' || candidate.status === 'TERVERIFIKASI';

  const handleSubmitFinal = async () => {
    if (!canSubmit || !user) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await candidateService.submitCandidateFinal(
        candidate.id,
        {},
        user.id,
        user.email
      );

      if (res.success) {
        onNavigate('/peserta/dashboard');
      } else {
        setErrorMessage(res.error || 'Pengiriman gagal.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/peserta/dokumen')}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            aria-label="Kembali ke Dokumen"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Review & Finalisasi Pendaftaran Santri Baru
            </h1>
            <p className="text-xs text-slate-500">
              No. Registrasi: <span className="font-mono font-bold text-emerald-800">{candidate.registration_number}</span> • TP 2027/2028
            </p>
          </div>
        </div>

        <Badge status={candidate.status} size="md" />
      </div>

      {isAlreadySubmitted && (
        <Alert
          type="info"
          title="Pendaftaran Sudah Dikirim Final"
          message={`Pendaftaran Anda saat ini berstatus ${candidate.status}. Seluruh data dan berkas sedang ditinjau panitia PSB.`}
        />
      )}

      {errorMessage && (
        <Alert type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}

      {/* 1. REVIEW DATA BIODATA */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
              1. Data Biodata Calon Santri
            </h3>
          </div>
          <div>
            {isBiodataComplete ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Biodata Lengkap (100%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600" /> Belum Lengkap ({biodataProgress.percentage}%)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-0.5">Nama Lengkap</span>
            <span className="font-bold text-slate-800">{candidate.full_name}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-0.5">NIK (16 Digit)</span>
            <span className="font-mono font-semibold text-slate-800">{candidate.nik || '-'}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-0.5">NISN (10 Digit)</span>
            <span className="font-mono font-semibold text-slate-800">{candidate.nisn || '-'}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-0.5">TTL</span>
            <span className="font-semibold text-slate-800">
              {candidate.birth_place ? `${candidate.birth_place}, ` : ''}
              {candidate.birth_date ? formatDateIndonesian(candidate.birth_date) : '-'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-0.5">Asal SD/MI</span>
            <span className="font-semibold text-slate-800">{candidate.school_name || '-'}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-0.5">Nama Orang Tua</span>
            <span className="font-semibold text-slate-800">
              {candidate.father_name || candidate.mother_name ? `${candidate.father_name || '-'} / ${candidate.mother_name || '-'}` : '-'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
            <span className="text-slate-400 block text-[11px] mb-0.5">Alamat Lengkap</span>
            <span className="font-semibold text-slate-800">
              {candidate.address ? `${candidate.address}, ${candidate.village || ''}, ${candidate.district || ''}, ${candidate.regency || ''}, ${candidate.province || ''}` : '-'}
            </span>
          </div>
        </div>

        {!isBiodataComplete && (
          <div className="text-right pt-2">
            <Button size="sm" variant="outline" onClick={() => onNavigate('/peserta/biodata')}>
              Lengkapi Biodata Santri
            </Button>
          </div>
        )}
      </div>

      {/* 2. REVIEW DOKUMEN PERSYARATAN */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
              2. Berkas Persyaratan Wajib
            </h3>
          </div>
          <div>
            {isDocumentsComplete ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Berkas Lengkap
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600" /> Belum Lengkap
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {requiredTypes.map((type) => {
            const typeDocs = documents.filter((d) => d.document_type_id === type.id);
            const isUploaded = typeDocs.length > 0 && typeDocs.some((d) => d.status !== 'DITOLAK');
            const hasRejection = typeDocs.some((d) => d.status === 'DITOLAK');

            return (
              <div
                key={type.id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                  hasRejection
                    ? 'bg-rose-50 border-rose-300'
                    : isUploaded
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isUploaded ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : hasRejection ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <span className="font-bold text-slate-800">{type.name}</span>
                    <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                      Wajib
                    </span>
                  </div>

                  {typeDocs.length > 0 ? (
                    <div className="text-[11px] text-slate-500 pl-6 space-y-0.5">
                      {typeDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2">
                          <span className="font-mono text-slate-700">{doc.file_name}</span>
                          <span className="text-slate-400">•</span>
                          <span className="font-semibold text-slate-800">{doc.status}</span>
                          {doc.rejection_reason && (
                            <span className="text-rose-600">("{doc.rejection_reason}")</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 pl-6 italic">Belum ada berkas diunggah.</div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {typeDocs[0] && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => setPreviewDoc(typeDocs[0])}
                    >
                      Lihat
                    </Button>
                  )}
                  {(!isUploaded || hasRejection) && !isAlreadySubmitted && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onNavigate('/peserta/dokumen')}
                    >
                      {hasRejection ? 'Upload Ulang' : 'Unggah Sekarang'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. PERNYATAAN & CONFIRMATION CHECKBOX */}
      {!isAlreadySubmitted && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            3. Pernyataan Kebenaran Data & Final Submission
          </h4>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer select-none text-xs text-slate-700 leading-relaxed">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
              />
              <span>
                Saya menyatakan dengan sesungguhnya bahwa seluruh data biodata dan dokumen berkas persyaratan yang saya berikan adalah benar, sah, dan dapat dipertanggungjawabkan. Apabila di kemudian hari ditemukan ketidaksesuaian atau pemalsuan data, saya bersedia menerima sanksi pembatalan status pendaftaran sesuai ketentuan panitia PSB PPTQM Darul Hikmah.
              </span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <Button
              variant="outline"
              onClick={() => onNavigate('/peserta/dokumen')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Kembali ke Unggah Berkas
            </Button>

            <Button
              variant="primary"
              size="lg"
              disabled={!canSubmit}
              isLoading={isSubmitting}
              rightIcon={<Send className="w-4 h-4" />}
              onClick={handleSubmitFinal}
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
            >
              Kirim Pendaftaran Final
            </Button>
          </div>

          {!canSubmit && !isAlreadySubmitted && (
            <p className="text-[11px] text-slate-500 text-center sm:text-right">
              {!isBiodataComplete
                ? '* Lengkapi seluruh kolom biodata wajib terlebih dahulu.'
                : !isDocumentsComplete
                ? '* Lengkapi seluruh berkas wajib dan pastikan tidak ada berkas yang ditolak.'
                : !isConfirmed
                ? '* Centang kotak pernyataan di atas untuk mengaktifkan tombol kirim final.'
                : ''}
            </p>
          )}
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />
    </div>
  );
};
