import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useRef, useState } from 'react';
import { CandidateDocument, DocumentType } from '../types/database';
import { Button } from './Button';
import { Badge } from './Badge';
import { Alert } from './Alert';
import { validateDocumentFile } from '../services/documentService';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Trash2,
  RefreshCw,
  Plus,
  Lock,
  FileCheck
} from 'lucide-react';

export interface DocumentUploadCardProps {
  documentType: DocumentType;
  documents: CandidateDocument[];
  isLocked: boolean; // if candidate status is locked (TERDAFTAR or TERVERIFIKASI without repair request)
  onUpload: (documentTypeId: string, file: File) => Promise<void>;
  onReplace: (documentId: string, file: File) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onPreview: (document: CandidateDocument) => void;
}

export const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  documentType,
  documents,
  isLocked,
  onUpload,
  onReplace,
  onDelete,
  onPreview,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Single file vs Multiple files logic:
  // KTP_ORANG_TUA, DOKUMEN_SEKOLAH, DOKUMEN_PENDUKUNG allow multiple files.
  // KK, AKTA_KELAHIRAN, PAS_FOTO typically have 1 file.
  const isMultiple = ['KTP_ORANG_TUA', 'DOKUMEN_SEKOLAH', 'DOKUMEN_PENDUKUNG'].includes(documentType.code);
  const canUploadMore = !isLocked && (isMultiple || documents.length === 0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplaceSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingDocId) return;
    await processReplace(replacingDocId, file);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
    setReplacingDocId(null);
  };

  const processUpload = async (file: File) => {
    setErrorMessage(null);
    const validation = validateDocumentFile(file, documentType);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'File tidak valid.');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(documentType.id, file);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengunggah dokumen.');
    } finally {
      setIsUploading(false);
    }
  };

  const processReplace = async (docId: string, file: File) => {
    setErrorMessage(null);
    const validation = validateDocumentFile(file, documentType);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'File tidak valid.');
      return;
    }

    setIsUploading(true);
    try {
      await onReplace(docId, file);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui dokumen.');
    } finally {
      setIsUploading(false);
    }
  };

  const triggerReplace = (docId: string) => {
    setReplacingDocId(docId);
    replaceInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DITERIMA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> DITERIMA
          </span>
        );
      case 'DITOLAK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> DITOLAK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> MENUNGGU VERIFIKASI
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all p-5 flex flex-col justify-between">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={documentType.allowed_mime_types.join(',')}
        className="hidden"
      />
      <input
        type="file"
        ref={replaceInputRef}
        onChange={handleReplaceSelect}
        accept={documentType.allowed_mime_types.join(',')}
        className="hidden"
      />

      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-slate-900">{documentType.name}</h4>
              {documentType.is_required ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  WAJIB
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  OPSIONAL
                </span>
              )}
            </div>
            {documentType.description && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {documentType.description}
              </p>
            )}
          </div>

          <div className="text-[10px] text-slate-400 text-right shrink-0">
            Maks: {documentType.max_file_size_mb} MB
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
            className="my-3 text-xs"
          />
        )}

        {/* Uploaded Documents List */}
        {documents.length > 0 && (
          <div className="space-y-3 my-4">
            {documents.map((doc) => {
              const isPdf = doc.mime_type === 'application/pdf' || doc.file_name.endsWith('.pdf');
              const isAccepted = doc.status === 'DITERIMA';
              const isRejected = doc.status === 'DITOLAK';

              return (
                <div
                  key={doc.id}
                  className={`p-3.5 rounded-xl border transition ${
                    isRejected
                      ? 'bg-rose-50/60 border-rose-300'
                      : isAccepted
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isPdf ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                      </div>

                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 truncate" title={doc.file_name}>
                          {doc.file_name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {formatFileSize(doc.file_size)} • {doc.document_number ? `No: ${doc.document_number}` : 'Berkas Terlampir'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">{getStatusBadge(doc.status)}</div>
                  </div>

                  {/* Rejection Note Warning */}
                  {isRejected && doc.rejection_reason && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-100 text-rose-900 text-xs">
                      <strong>Catatan Panitia:</strong> "{doc.rejection_reason}"
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onPreview(doc)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      <Eye className="w-3.5 h-3.5" /> Lihat Berkas
                    </button>

                    <div className="flex items-center gap-2">
                      {/* Replace / Upload Ulang (Only if not DITERIMA and not locked) */}
                      {!isAccepted && !isLocked && (
                        <button
                          type="button"
                          onClick={() => triggerReplace(doc.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> {isRejected ? 'Upload Ulang' : 'Ganti'}
                        </button>
                      )}

                      {/* Delete (Only if not DITERIMA and not locked) */}
                      {!isAccepted && !isLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirmAction(`Hapus berkas ${doc.file_name}?`)) {
                              onDelete(doc.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Hapus berkas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Dropzone / Button Area */}
      <div>
        {canUploadMore ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) await processUpload(file);
            }}
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
              isDragOver
                ? 'border-emerald-600 bg-emerald-50/50'
                : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50'
            }`}
          >
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-slate-700">
              {documents.length > 0 ? '+ Tambah Berkas Tambahan' : 'Pilih atau Tarik Berkas ke Sini'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Format: {documentType.allowed_mime_types.map((m) => m.split('/')[1].toUpperCase()).join(', ')} (Maks {documentType.max_file_size_mb} MB)
            </p>
            <Button
              size="sm"
              variant="outline"
              type="button"
              isLoading={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="mt-2.5"
            >
              {documents.length > 0 ? 'Pilih Berkas Lain' : 'Pilih Berkas'}
            </Button>
          </div>
        ) : isLocked ? (
          <div className="p-2.5 bg-slate-100 rounded-xl text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Dokumen terkunci selama proses seleksi/verifikasi</span>
          </div>
        ) : (
          <div className="text-right">
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center justify-end gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Berkas telah diunggah lengkap
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
