import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { candidateService } from '../services/candidateService';
import { documentService } from '../services/documentService';
import { Candidate, CandidateDocument, DocumentType } from '../types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import {
  FileCheck2,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  RefreshCw,
  User,
  School,
  Download,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';

interface CandidateDocStats {
  candidate: Candidate;
  totalDocs: number;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  isAllRequiredAccepted: boolean;
  hasRejection: boolean;
  isCompleteUploaded: boolean;
}

export const AdminDocumentsPage: React.FC = () => {
  const { user, role } = useAuth();
  const [candidateStatsList, setCandidateStatsList] = useState<CandidateDocStats[]>([]);
  const [filteredList, setFilteredList] = useState<CandidateDocStats[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // ALL, PENDING, REJECTED, ACCEPTED, INCOMPLETE

  // Selected candidate detail verification modal
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<CandidateDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Rejection input modal state
  const [rejectingDoc, setRejectingDoc] = useState<CandidateDocument | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<CandidateDocument | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [types, allCandidatesRes] = await Promise.all([
        documentService.getDocumentTypes(),
        candidateService.getAllCandidates({ limit: 1000 }),
      ]);
      setDocumentTypes(types);

      const requiredTypes = types.filter((t) => t.is_required);

      // Compute stats for each candidate
      const statsList: CandidateDocStats[] = await Promise.all(
        allCandidatesRes.candidates.map(async (cand) => {
          const docs = await documentService.getCandidateDocuments(cand.id);
          let accepted = 0;
          let rejected = 0;
          let pending = 0;

          docs.forEach((d) => {
            if (d.status === 'DITERIMA') accepted++;
            else if (d.status === 'DITOLAK') rejected++;
            else if (d.status === 'MENUNGGU_VERIFIKASI') pending++;
          });

          // Check if every required type has at least one accepted doc
          const isAllRequiredAccepted =
            requiredTypes.length > 0 &&
            requiredTypes.every((type) => {
              const typeDocs = docs.filter((d) => d.document_type_id === type.id);
              return typeDocs.length > 0 && typeDocs.every((d) => d.status === 'DITERIMA');
            });

          // Check if all required types uploaded
          const isCompleteUploaded =
            requiredTypes.length > 0 &&
            requiredTypes.every((type) =>
              docs.some((d) => d.document_type_id === type.id && d.status !== 'DITOLAK')
            );

          return {
            candidate: cand,
            totalDocs: docs.length,
            acceptedCount: accepted,
            rejectedCount: rejected,
            pendingCount: pending,
            isAllRequiredAccepted,
            hasRejection: rejected > 0,
            isCompleteUploaded,
          };
        })
      );

      setCandidateStatsList(statsList);
      applyFilter(statsList, search, filterMode);
    } catch (err: any) {
      console.error('Error loading documents stats', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilter = (list: CandidateDocStats[], q: string, filter: string) => {
    let result = [...list];

    if (q.trim()) {
      const query = q.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.candidate.full_name.toLowerCase().includes(query) ||
          item.candidate.registration_number.toLowerCase().includes(query) ||
          (item.candidate.nisn || '').toLowerCase().includes(query) ||
          (item.candidate.school_name || '').toLowerCase().includes(query)
      );
    }

    if (filter === 'PENDING') {
      result = result.filter((item) => item.pendingCount > 0);
    } else if (filter === 'REJECTED') {
      result = result.filter((item) => item.rejectedCount > 0);
    } else if (filter === 'ACCEPTED') {
      result = result.filter((item) => item.isAllRequiredAccepted);
    } else if (filter === 'INCOMPLETE') {
      result = result.filter((item) => !item.isCompleteUploaded);
    }

    setFilteredList(result);
  };

  useEffect(() => {
    applyFilter(candidateStatsList, search, filterMode);
  }, [search, filterMode, candidateStatsList]);

  // Open candidate documents detail
  const handleOpenCandidateDocs = async (cand: Candidate) => {
    setSelectedCandidate(cand);
    setStatusMessage(null);
    setIsLoadingDocs(true);
    const docs = await documentService.getCandidateDocuments(cand.id);
    setSelectedDocs(docs);
    setIsLoadingDocs(false);
  };

  // Accept a document
  const handleAcceptDoc = async (docId: string) => {
    if (!user) return;
    setIsProcessingAction(true);
    setStatusMessage(null);

    const res = await documentService.verifyCandidateDocument({
      documentId: docId,
      status: 'DITERIMA',
      verifiedBy: user.id,
      verifiedByName: user.profile?.full_name || 'Panitia PSB',
      verifiedByEmail: user.email,
    });

    setIsProcessingAction(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Dokumen berhasil diverifikasi (DITERIMA).' });
      if (selectedCandidate) {
        const docs = await documentService.getCandidateDocuments(selectedCandidate.id);
        setSelectedDocs(docs);
      }
      loadAllData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Gagal memverifikasi dokumen.' });
    }
  };

  // Submit rejection with reason
  const handleConfirmReject = async () => {
    if (!rejectingDoc || !user) return;
    if (!rejectionReasonInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Alasan penolakan dokumen wajib diisi.' });
      return;
    }

    setIsProcessingAction(true);
    const res = await documentService.verifyCandidateDocument({
      documentId: rejectingDoc.id,
      status: 'DITOLAK',
      rejectionReason: rejectionReasonInput.trim(),
      verifiedBy: user.id,
      verifiedByName: user.profile?.full_name || 'Panitia PSB',
      verifiedByEmail: user.email,
    });
    setIsProcessingAction(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Dokumen berhasil ditolak dengan catatan alasan.' });
      setRejectingDoc(null);
      setRejectionReasonInput('');
      if (selectedCandidate) {
        const docs = await documentService.getCandidateDocuments(selectedCandidate.id);
        setSelectedDocs(docs);
      }
      loadAllData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Gagal menolak dokumen.' });
    }
  };

  // Update candidate status based on document verification outcome
  const handleUpdateCandidateStatus = async (targetStatus: 'TERVERIFIKASI' | 'PERLU_PERBAIKAN') => {
    if (!selectedCandidate || !user) return;
    setIsProcessingAction(true);

    const note =
      targetStatus === 'TERVERIFIKASI'
        ? 'Seluruh berkas persyaratan dan biodata telah diperiksa dan dinyatakan LENGKAP & VALID.'
        : 'Terdapat berkas yang tidak sesuai/ditolak. Calon santri diminta melakukan perbaikan.';

    const res = await candidateService.updateCandidateStatus({
      candidateId: selectedCandidate.id,
      newStatus: targetStatus,
      note,
      changedBy: user.id,
      changedByName: user.profile?.full_name || 'Panitia PSB',
      changedByEmail: user.email,
      userRole: role || undefined,
    });

    setIsProcessingAction(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Status calon santri berhasil diubah menjadi ${targetStatus}!`,
      });
      const updated = await candidateService.getCandidateById(selectedCandidate.id);
      if (updated) setSelectedCandidate(updated);
      loadAllData();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-emerald-700" />
            Verifikasi Dokumen Persyaratan Pendaftar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Peninjauan scan berkas KK, Akta, KTP Orang Tua, Rapor Sekolah, dan Pasfoto santri baru
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={loadAllData}
        >
          Muat Ulang
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <Input
            placeholder="Cari no reg, nama, NISN, sekolah..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="w-full md:w-64">
          <Select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            options={[
              { value: 'ALL', label: 'Semua Status Dokumen' },
              { value: 'PENDING', label: 'Menunggu Verifikasi (Ada berkas baru)' },
              { value: 'REJECTED', label: 'Ada Penolakan Berkas' },
              { value: 'ACCEPTED', label: 'Semua Berkas Wajib Diterima' },
              { value: 'INCOMPLETE', label: 'Belum Lengkap Diunggah' },
            ]}
          />
        </div>
      </div>

      {/* Candidates Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner text="Memuat daftar verifikasi berkas pendaftar..." />
        ) : filteredList.length === 0 ? (
          <EmptyState
            title="Tidak Ada Pendaftar Ditemukan"
            description="Tidak ada pendaftar yang cocok dengan filter atau kata kunci pencarian saat ini."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>No. Registrasi</TableHead>
                <TableHead>Nama Calon Santri</TableHead>
                <TableHead>Asal Sekolah</TableHead>
                <TableHead align="center">Total Berkas</TableHead>
                <TableHead align="center">Diterima</TableHead>
                <TableHead align="center">Ditolak</TableHead>
                <TableHead align="center">Menunggu</TableHead>
                <TableHead>Status Pendaftaran</TableHead>
                <TableHead align="center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.map((item) => (
                <TableRow key={item.candidate.id}>
                  <TableCell>
                    <span className="font-mono font-bold text-xs bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200">
                      {item.candidate.registration_number}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs">
                      <div className="font-bold text-slate-800">{item.candidate.full_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">NISN: {item.candidate.nisn || '-'}</div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-slate-700">{item.candidate.school_name || '-'}</span>
                  </TableCell>

                  <TableCell align="center">
                    <span className="text-xs font-semibold text-slate-700">{item.totalDocs}</span>
                  </TableCell>

                  <TableCell align="center">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {item.acceptedCount}
                    </span>
                  </TableCell>

                  <TableCell align="center">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        item.rejectedCount > 0 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'text-slate-400'
                      }`}
                    >
                      {item.rejectedCount}
                    </span>
                  </TableCell>

                  <TableCell align="center">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        item.pendingCount > 0 ? 'bg-blue-100 text-blue-700' : 'text-slate-400'
                      }`}
                    >
                      {item.pendingCount}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge status={item.candidate.status} size="sm" />
                  </TableCell>

                  <TableCell align="center">
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => handleOpenCandidateDocs(item.candidate)}
                    >
                      Verifikasi Berkas
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* MODAL VERIFIKASI DOKUMEN DETAIL */}
      {selectedCandidate && (
        <Modal
          isOpen={Boolean(selectedCandidate)}
          onClose={() => {
            setSelectedCandidate(null);
            setRejectingDoc(null);
          }}
          title={`Verifikasi Berkas: ${selectedCandidate.full_name}`}
          subtitle={`No. Registrasi: ${selectedCandidate.registration_number} • Asal: ${selectedCandidate.school_name || '-'}`}
          maxWidth="4xl"
          footer={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Status Pendaftaran:</span>
                <Badge status={selectedCandidate.status} size="sm" />
              </div>

              <div className="flex items-center gap-2">
                {/* Button to request revision */}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isProcessingAction}
                  onClick={() => handleUpdateCandidateStatus('PERLU_PERBAIKAN')}
                >
                  Minta Perbaikan (PERLU_PERBAIKAN)
                </Button>

                {/* Button to approve all */}
                <Button
                  size="sm"
                  variant="primary"
                  disabled={isProcessingAction}
                  className="bg-emerald-700 hover:bg-emerald-800"
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                  onClick={() => handleUpdateCandidateStatus('TERVERIFIKASI')}
                >
                  Setujui & Nyatakan TERVERIFIKASI
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedCandidate(null)}
                >
                  Tutup
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {statusMessage && (
              <Alert
                type={statusMessage.type}
                message={statusMessage.text}
                onClose={() => setStatusMessage(null)}
              />
            )}

            {/* Candidate Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Nama Lengkap:</span>
                <span className="font-bold text-slate-800">{selectedCandidate.full_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">NIK / NISN:</span>
                <span className="font-mono text-slate-800">{selectedCandidate.nik || '-'} / {selectedCandidate.nisn || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">No. WhatsApp:</span>
                <span className="font-mono text-slate-800">{selectedCandidate.guardian_phone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Orang Tua:</span>
                <span className="text-slate-800">{selectedCandidate.father_name || selectedCandidate.mother_name || '-'}</span>
              </div>
            </div>

            {/* Documents List */}
            {isLoadingDocs ? (
              <LoadingSpinner text="Memuat berkas dokumen..." />
            ) : selectedDocs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Belum ada dokumen yang diunggah oleh pendaftar ini.
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-700" />
                  Daftar Berkas Terunggah ({selectedDocs.length})
                </h4>

                {selectedDocs.map((doc) => {
                  const isAccepted = doc.status === 'DITERIMA';
                  const isRejected = doc.status === 'DITOLAK';

                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-xl border transition ${
                        isRejected
                          ? 'bg-rose-50/50 border-rose-300'
                          : isAccepted
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">
                              {doc.document_type?.name || 'Dokumen'}
                            </span>
                            {doc.document_type?.is_required && (
                              <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded border border-rose-200">
                                Wajib
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-slate-600 mt-0.5">
                            {doc.file_name} • {(doc.file_size / 1024).toFixed(0)} KB • {doc.mime_type}
                          </p>

                          {doc.rejection_reason && (
                            <p className="text-xs text-rose-700 mt-1 font-medium bg-rose-100/70 px-2 py-1 rounded inline-block">
                              Alasan Ditolak: "{doc.rejection_reason}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {/* Preview Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => setPreviewDoc(doc)}
                          >
                            Preview
                          </Button>

                          {/* Action Buttons: Terima / Tolak */}
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={isAccepted || isProcessingAction}
                            className={isAccepted ? 'bg-emerald-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700'}
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                            onClick={() => handleAcceptDoc(doc.id)}
                          >
                            {isAccepted ? 'Diterima' : 'Terima'}
                          </Button>

                          <Button
                            size="sm"
                            variant="danger"
                            disabled={isRejected || isProcessingAction}
                            leftIcon={<X className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setRejectingDoc(doc);
                              setRejectionReasonInput(doc.rejection_reason || '');
                            }}
                          >
                            {isRejected ? 'Ditolak' : 'Tolak'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* REJECTION REASON INPUT DIALOG */}
      {rejectingDoc && (
        <Modal
          isOpen={Boolean(rejectingDoc)}
          onClose={() => setRejectingDoc(null)}
          title={`Tolak Dokumen: ${rejectingDoc.document_type?.name}`}
          subtitle="Berikan alasan yang jelas agar calon santri dapat memperbaikinya"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setRejectingDoc(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                variant="danger"
                isLoading={isProcessingAction}
                onClick={handleConfirmReject}
              >
                Konfirmasi Penolakan
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Pilih alasan cepat atau ketik instruksi perbaikan untuk pendaftar:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {[
                'Foto/scan kurang jelas atau terpotong',
                'Nama pada dokumen tidak sesuai dengan biodata',
                'Dokumen telah kadaluarsa / tidak berlaku',
                'Halaman belakang dokumen belum dilampirkan',
                'Bukan foto resmi (harus latar belakang merah/biru)',
              ].map((quickReason, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRejectionReasonInput(quickReason)}
                  className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition text-left"
                >
                  + {quickReason}
                </button>
              ))}
            </div>

            <Input
              label="Alasan Penolakan (Wajib Diisi)"
              placeholder="Contoh: Foto KK terpotong pada bagian NIK santri, silakan foto ulang seluruh lembar."
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              required
            />
          </div>
        </Modal>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />
    </div>
  );
};
