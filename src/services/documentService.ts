import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { getStorageData, saveStorageData } from '../lib/storage';
import { CandidateDocument, DocumentType, DocumentVerificationStatus } from '../types/database';
import { auditService } from './auditService';

// Security: Dangerous extensions that must never be accepted
const FORBIDDEN_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'php', 'js', 'html', 'htm', 'phtml',
  'svg', 'xml', 'zip', 'rar', '7z', 'tar', 'gz', 'iso', 'jar', 'apk',
  'vbs', 'scr', 'msi', 'com', 'dll'
];

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateDocumentFile(file: File, documentType?: DocumentType): FileValidationResult {
  if (!file) {
    return { isValid: false, error: 'Silakan pilih berkas dokumen yang akan diunggah.' };
  }

  // 1. File extension validation
  const parts = file.name.split('.');
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
  if (!ext || FORBIDDEN_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      error: `Format file .${ext} dilarang demi keamanan sistem. Harap unggah PDF, JPG, atau PNG.`,
    };
  }

  // 2. MIME type validation
  const allowedMime = documentType?.allowed_mime_types || [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  if (!allowedMime.includes(file.type.toLowerCase())) {
    return {
      isValid: false,
      error: `Format file (${file.type || 'tidak dikenal'}) tidak didukung. Harap unggah file berformat PDF, JPG, JPEG, atau PNG.`,
    };
  }

  // 3. Size validation
  const maxMb = documentType?.max_file_size_mb || 5;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      isValid: false,
      error: `Ukuran file melebihi batas maksimal ${maxMb} MB. Ukuran file Anda: ${(file.size / (1024 * 1024)).toFixed(2)} MB.`,
    };
  }

  if (file.size < 100) {
    return {
      isValid: false,
      error: 'File tampak kosong atau rusak. Silakan periksa kembali file Anda.',
    };
  }

  return { isValid: true };
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
}

export const documentService = {
  // 1. Fetch active document types
  async getDocumentTypes(): Promise<DocumentType[]> {
    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('document_types')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as DocumentType[];
        }
      } catch (err) {
        console.error('Supabase getDocumentTypes error', err);
      }
    }

    const data = getStorageData();
    return data.documentTypes
      .filter((dt) => dt.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  // 2. Fetch all document types for Admin management
  async getAllDocumentTypesAdmin(): Promise<DocumentType[]> {
    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('document_types')
          .select('*')
          .order('sort_order', { ascending: true });

        if (!error && data) return data as DocumentType[];
      } catch (err) {
        console.error('Supabase getAllDocumentTypesAdmin error', err);
      }
    }

    const data = getStorageData();
    return data.documentTypes.sort((a, b) => a.sort_order - b.sort_order);
  },

  // 3. Update document type (Admin only)
  async updateDocumentType(
    id: string,
    updates: Partial<DocumentType>,
    userId?: string,
    userEmail?: string
  ): Promise<{ success: boolean; error?: string }> {
    const data = getStorageData();
    const idx = data.documentTypes.findIndex((dt) => dt.id === id);
    if (idx === -1) {
      return { success: false, error: 'Jenis dokumen tidak ditemukan.' };
    }

    data.documentTypes[idx] = {
      ...data.documentTypes[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveStorageData(data);

    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('document_types')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (err) {
        console.error('Supabase updateDocumentType error', err);
      }
    }

    await auditService.logAction({
      userId,
      userEmail,
      action: 'UPDATE_DOCUMENT_TYPE',
      entityType: 'DOCUMENT_TYPE',
      entityId: id,
      newValue: updates,
    });

    return { success: true };
  },

  // 4. Fetch candidate documents with signed URLs
  async getCandidateDocuments(candidateId: string): Promise<CandidateDocument[]> {
    let docs: CandidateDocument[] = [];

    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('candidate_documents')
          .select('*, document_type:document_types(*)')
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          docs = data as CandidateDocument[];
        }
      } catch (err) {
        console.error('Supabase getCandidateDocuments error', err);
      }
    }

    if (docs.length === 0) {
      const data = getStorageData();
      docs = data.candidateDocuments
        .filter((d) => d.candidate_id === candidateId)
        .map((d) => {
          const type = data.documentTypes.find((t) => t.id === d.document_type_id);
          return { ...d, document_type: type };
        });
    }

    // Generate secure signed URLs for preview / download
    const docsWithSignedUrls = await Promise.all(
      docs.map(async (doc) => {
        const signed = await this.getSignedDocumentUrl(doc.file_path);
        return {
          ...doc,
          signed_url: signed || undefined,
        };
      })
    );

    return docsWithSignedUrls;
  },

  // 5. Generate secure signed URL for private bucket
  async getSignedDocumentUrl(filePath: string): Promise<string | null> {
    if (!filePath) return null;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.storage
          .from('candidate-documents')
          .createSignedUrl(filePath, 3600); // 1 hour validity

        if (!error && data?.signedUrl) {
          return data.signedUrl;
        }
      } catch (err) {
        console.error('Supabase createSignedUrl error', err);
      }
    }

    // For local simulation, check if we stored simulated data or generate placeholder
    if (filePath.startsWith('data:') || filePath.startsWith('blob:') || filePath.startsWith('http')) {
      return filePath;
    }

    // Fallback sample preview placeholder for local demo
    return null;
  },

  // 6. Upload candidate document
  async uploadCandidateDocument(params: {
    candidateId: string;
    documentTypeId: string;
    file: File;
    documentNumber?: string;
    userId: string;
    userEmail: string;
  }): Promise<{ success: boolean; document?: CandidateDocument; error?: string }> {
    const data = getStorageData();
    const docType = data.documentTypes.find((dt) => dt.id === params.documentTypeId);

    // Validate file
    const validation = validateDocumentFile(params.file, docType);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Generate collision-proof storage path: {userId}/{docTypeCode}/{uuid}_{sanitizedName}
    const fileUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}`;
    const cleanName = sanitizeFileName(params.file.name);
    const typeFolder = docType ? docType.code.toLowerCase().replace(/_/g, '-') : 'doc';
    const storagePath = `${params.userId}/${typeFolder}/${fileUuid}_${cleanName}`;

    let signedUrlPreview: string | undefined = undefined;

    // Upload to Supabase Storage if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error: uploadError } = await supabase.storage
          .from('candidate-documents')
          .upload(storagePath, params.file, {
            contentType: params.file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('Supabase Storage upload error', uploadError);
          return { success: false, error: `Gagal mengunggah ke penyimpanan: ${uploadError.message}` };
        }

        const signed = await this.getSignedDocumentUrl(storagePath);
        if (signed) signedUrlPreview = signed;
      } catch (err: any) {
        console.error('Supabase Storage exception', err);
        return { success: false, error: err.message || 'Gagal mengunggah file ke penyimpanan cloud.' };
      }
    } else {
      // Local/demo simulation: create a local object URL or reader for preview
      try {
        signedUrlPreview = URL.createObjectURL(params.file);
      } catch {
        // ignore
      }
    }

    const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newDoc: CandidateDocument = {
      id: docId,
      candidate_id: params.candidateId,
      document_type_id: params.documentTypeId,
      document_type: docType,
      file_name: params.file.name,
      file_path: storagePath,
      file_size: params.file.size,
      mime_type: params.file.type,
      document_number: params.documentNumber?.trim() || undefined,
      status: 'MENUNGGU_VERIFIKASI',
      uploaded_by: params.userId,
      signed_url: signedUrlPreview,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Sync to Supabase DB
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: inserted, error: dbError } = await supabase
          .from('candidate_documents')
          .insert({
            candidate_id: params.candidateId,
            document_type_id: params.documentTypeId,
            file_name: params.file.name,
            file_path: storagePath,
            file_size: params.file.size,
            mime_type: params.file.type,
            document_number: newDoc.document_number,
            status: 'MENUNGGU_VERIFIKASI',
            uploaded_by: params.userId,
          })
          .select()
          .single();

        if (!dbError && inserted) {
          newDoc.id = inserted.id;
        }
      } catch (err) {
        console.error('Failed to insert candidate_document to Supabase DB', err);
      }
    }

    data.candidateDocuments.push(newDoc);
    saveStorageData(data);

    await auditService.logAction({
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'DOCUMENT_UPLOADED',
      entityType: 'DOCUMENT',
      entityId: newDoc.id,
      newValue: {
        document_type: docType?.code,
        file_name: params.file.name,
        file_size: params.file.size,
        mime_type: params.file.type,
      },
    });

    return { success: true, document: newDoc };
  },

  // 7. Replace candidate document (Upload ulang)
  async replaceCandidateDocument(params: {
    documentId: string;
    file: File;
    userId: string;
    userEmail: string;
  }): Promise<{ success: boolean; document?: CandidateDocument; error?: string }> {
    const data = getStorageData();
    const idx = data.candidateDocuments.findIndex((d) => d.id === params.documentId);
    if (idx === -1) {
      return { success: false, error: 'Dokumen tidak ditemukan.' };
    }

    const currentDoc = data.candidateDocuments[idx];
    if (currentDoc.status === 'DITERIMA') {
      return {
        success: false,
        error: 'Dokumen yang sudah DITERIMA dan diverifikasi oleh panitia tidak dapat diganti atau dihapus.',
      };
    }

    const docType = data.documentTypes.find((dt) => dt.id === currentDoc.document_type_id);
    const validation = validateDocumentFile(params.file, docType);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Delete old file from storage to prevent orphans
    const oldPath = currentDoc.file_path;
    if (isSupabaseConfigured() && supabase && oldPath) {
      try {
        await supabase.storage.from('candidate-documents').remove([oldPath]);
      } catch (err) {
        console.error('Failed to remove old file from Supabase storage', err);
      }
    }

    // Upload new file
    const fileUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}`;
    const cleanName = sanitizeFileName(params.file.name);
    const typeFolder = docType ? docType.code.toLowerCase().replace(/_/g, '-') : 'doc';
    const storagePath = `${params.userId}/${typeFolder}/${fileUuid}_${cleanName}`;

    let signedUrlPreview: string | undefined = undefined;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error: uploadError } = await supabase.storage
          .from('candidate-documents')
          .upload(storagePath, params.file, {
            contentType: params.file.type,
            upsert: false,
          });

        if (uploadError) {
          return { success: false, error: uploadError.message };
        }

        const signed = await this.getSignedDocumentUrl(storagePath);
        if (signed) signedUrlPreview = signed;
      } catch (err: any) {
        return { success: false, error: err.message || 'Gagal mengunggah file baru.' };
      }
    } else {
      try {
        signedUrlPreview = URL.createObjectURL(params.file);
      } catch {
        // ignore
      }
    }

    const updatedDoc: CandidateDocument = {
      ...currentDoc,
      file_name: params.file.name,
      file_path: storagePath,
      file_size: params.file.size,
      mime_type: params.file.type,
      status: 'MENUNGGU_VERIFIKASI',
      rejection_reason: undefined, // Reset rejection reason on re-upload
      signed_url: signedUrlPreview,
      updated_at: new Date().toISOString(),
    };

    data.candidateDocuments[idx] = updatedDoc;
    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('candidate_documents')
          .update({
            file_name: params.file.name,
            file_path: storagePath,
            file_size: params.file.size,
            mime_type: params.file.type,
            status: 'MENUNGGU_VERIFIKASI',
            rejection_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.documentId);
      } catch (err) {
        console.error('Supabase replaceCandidateDocument error', err);
      }
    }

    await auditService.logAction({
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'DOCUMENT_REPLACED',
      entityType: 'DOCUMENT',
      entityId: params.documentId,
      oldValue: { file_name: currentDoc.file_name, status: currentDoc.status },
      newValue: { file_name: params.file.name, status: 'MENUNGGU_VERIFIKASI' },
    });

    return { success: true, document: updatedDoc };
  },

  // 8. Delete candidate document (Only if not DITERIMA)
  async deleteCandidateDocument(params: {
    documentId: string;
    userId: string;
    userEmail: string;
  }): Promise<{ success: boolean; error?: string }> {
    const data = getStorageData();
    const idx = data.candidateDocuments.findIndex((d) => d.id === params.documentId);
    if (idx === -1) {
      return { success: false, error: 'Dokumen tidak ditemukan.' };
    }

    const currentDoc = data.candidateDocuments[idx];
    if (currentDoc.status === 'DITERIMA') {
      return {
        success: false,
        error: 'Dokumen yang telah diverifikasi DITERIMA tidak dapat dihapus.',
      };
    }

    // Delete from Supabase Storage
    if (isSupabaseConfigured() && supabase && currentDoc.file_path) {
      try {
        await supabase.storage.from('candidate-documents').remove([currentDoc.file_path]);
        await supabase.from('candidate_documents').delete().eq('id', params.documentId);
      } catch (err) {
        console.error('Supabase deleteCandidateDocument error', err);
      }
    }

    data.candidateDocuments.splice(idx, 1);
    saveStorageData(data);

    await auditService.logAction({
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'DOCUMENT_DELETED',
      entityType: 'DOCUMENT',
      entityId: params.documentId,
      oldValue: { file_name: currentDoc.file_name, type: currentDoc.document_type?.code },
    });

    return { success: true };
  },

  // 9. Verify document (Panitia / Admin)
  async verifyCandidateDocument(params: {
    documentId: string;
    status: 'DITERIMA' | 'DITOLAK';
    rejectionReason?: string;
    verifiedBy: string;
    verifiedByName: string;
    verifiedByEmail: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (params.status === 'DITOLAK' && !params.rejectionReason?.trim()) {
      return {
        success: false,
        error: 'Alasan penolakan dokumen wajib diisi agar pendaftar mengetahui perbaikan yang diperlukan.',
      };
    }

    const data = getStorageData();
    const idx = data.candidateDocuments.findIndex((d) => d.id === params.documentId);
    if (idx === -1) {
      return { success: false, error: 'Dokumen tidak ditemukan.' };
    }

    const currentDoc = data.candidateDocuments[idx];
    const oldStatus = currentDoc.status;
    const nowIso = new Date().toISOString();

    currentDoc.status = params.status;
    currentDoc.rejection_reason = params.status === 'DITOLAK' ? params.rejectionReason?.trim() : undefined;
    currentDoc.verified_by = params.verifiedBy;
    currentDoc.verified_by_name = params.verifiedByName;
    currentDoc.verified_at = nowIso;
    currentDoc.updated_at = nowIso;

    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('candidate_documents')
          .update({
            status: params.status,
            rejection_reason: currentDoc.rejection_reason,
            verified_by: params.verifiedBy,
            verified_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', params.documentId);
      } catch (err) {
        console.error('Supabase verifyCandidateDocument error', err);
      }
    }

    const action = params.status === 'DITERIMA' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED';
    await auditService.logAction({
      userId: params.verifiedBy,
      userEmail: params.verifiedByEmail,
      action,
      entityType: 'DOCUMENT',
      entityId: params.documentId,
      oldValue: { status: oldStatus },
      newValue: {
        status: params.status,
        rejection_reason: params.rejectionReason,
        verified_by: params.verifiedByName,
      },
    });

    return { success: true };
  },

  // 10. Document summary for progress calculation & final submission checks
  async getCandidateDocumentSummary(candidateId: string): Promise<{
    totalRequiredTypes: number;
    uploadedRequiredTypes: number;
    isAllRequiredUploaded: boolean;
    isAllRequiredAccepted: boolean;
    hasRejected: boolean;
    totalDocs: number;
    acceptedDocs: number;
    rejectedDocs: number;
    pendingDocs: number;
    docs: CandidateDocument[];
    missingRequiredTypes: DocumentType[];
  }> {
    const [types, docs] = await Promise.all([
      this.getDocumentTypes(),
      this.getCandidateDocuments(candidateId),
    ]);

    const requiredTypes = types.filter((t) => t.is_required);
    const totalRequiredTypes = requiredTypes.length;

    // A required type is considered uploaded if it has at least 1 document uploaded
    const uploadedRequiredTypesList: DocumentType[] = [];
    const missingRequiredTypes: DocumentType[] = [];

    let hasRejected = false;
    let acceptedDocs = 0;
    let rejectedDocs = 0;
    let pendingDocs = 0;

    docs.forEach((doc) => {
      if (doc.status === 'DITERIMA') acceptedDocs++;
      else if (doc.status === 'DITOLAK') {
        rejectedDocs++;
        hasRejected = true;
      } else if (doc.status === 'MENUNGGU_VERIFIKASI') {
        pendingDocs++;
      }
    });

    requiredTypes.forEach((type) => {
      const typeDocs = docs.filter((d) => d.document_type_id === type.id);
      // Valid uploaded means exists and at least one is not DITOLAK
      const hasValidUpload = typeDocs.length > 0 && typeDocs.some((d) => d.status !== 'DITOLAK');
      if (hasValidUpload) {
        uploadedRequiredTypesList.push(type);
      } else {
        missingRequiredTypes.push(type);
      }
    });

    const uploadedRequiredTypes = uploadedRequiredTypesList.length;
    const isAllRequiredUploaded = uploadedRequiredTypes >= totalRequiredTypes && !hasRejected;

    // All required types must have accepted docs
    const isAllRequiredAccepted =
      requiredTypes.length > 0 &&
      requiredTypes.every((type) => {
        const typeDocs = docs.filter((d) => d.document_type_id === type.id);
        return typeDocs.length > 0 && typeDocs.every((d) => d.status === 'DITERIMA');
      });

    return {
      totalRequiredTypes,
      uploadedRequiredTypes,
      isAllRequiredUploaded,
      isAllRequiredAccepted,
      hasRejected,
      totalDocs: docs.length,
      acceptedDocs,
      rejectedDocs,
      pendingDocs,
      docs,
      missingRequiredTypes,
    };
  },
};
