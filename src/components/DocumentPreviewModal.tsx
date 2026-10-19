import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { CandidateDocument } from '../types/database';
import { Download, ExternalLink, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';

export interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: CandidateDocument | null;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  if (!document) return null;

  const isPdf = document.mime_type === 'application/pdf' || document.file_name.toLowerCase().endsWith('.pdf');
  const isImage = document.mime_type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(document.file_name);
  const previewUrl = document.signed_url;

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = window.document.createElement('a');
    a.href = previewUrl;
    a.download = document.file_name;
    a.target = '_blank';
    a.rel = 'noreferrer';
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={document.document_type?.name || 'Preview Dokumen'}
      subtitle={`Nama file: ${document.file_name} (${(document.file_size / 1024).toFixed(0)} KB)`}
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            Status: <span className="font-semibold text-slate-800">{document.status}</span>
          </div>
          <div className="flex items-center gap-2">
            {previewUrl && (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownload}
              >
                Unduh Berkas
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>
      }
    >
      <div className="min-h-[350px] max-h-[70vh] flex flex-col items-center justify-center bg-slate-900/5 rounded-xl overflow-hidden p-2">
        {previewUrl ? (
          isPdf ? (
            <div className="w-full h-[65vh] flex flex-col">
              <iframe
                src={`${previewUrl}#toolbar=0`}
                title={document.file_name}
                className="w-full h-full rounded-lg border border-slate-200 bg-white"
              />
            </div>
          ) : isImage ? (
            <div className="max-h-[65vh] overflow-auto flex items-center justify-center p-2">
              <img
                src={previewUrl}
                alt={document.file_name}
                className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-md"
              />
            </div>
          ) : (
            <div className="p-8 text-center text-slate-600">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-semibold">{document.file_name}</p>
              <p className="text-xs text-slate-400 mt-1">Preview langsung tidak didukung untuk tipe file ini.</p>
              <Button size="sm" className="mt-4" onClick={handleDownload} leftIcon={<Download className="w-4 h-4" />}>
                Unduh untuk Melihat
              </Button>
            </div>
          )
        ) : (
          <div className="p-8 text-center text-slate-500">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">Berkas Tersimpan Aman di Storage Privat</p>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              File tersimpan pada path privat <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">{document.file_path}</code>.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
