import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { documentService } from '../services/documentService';
import { DocumentType } from '../types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import {
  FileText,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  FolderLock,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';

export const AdminDocumentTypesPage: React.FC = () => {
  const { user, role } = useAuth();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<DocumentType>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isSuperAdmin = role === 'SUPER_ADMIN';

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    setIsLoading(true);
    try {
      const data = await documentService.getAllDocumentTypesAdmin();
      setTypes(data);
    } catch (err: any) {
      console.error('Failed to load document types', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEdit = (type: DocumentType) => {
    setSelectedType(type);
    setFormData({
      name: type.name,
      description: type.description,
      is_required: type.is_required,
      is_active: type.is_active,
      max_file_size_mb: type.max_file_size_mb,
      sort_order: type.sort_order,
    });
    setIsEditing(true);
    setStatusMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !user || !isSuperAdmin) return;
    setIsSaving(true);
    setStatusMessage(null);

    const res = await documentService.updateDocumentType(
      selectedType.id,
      formData,
      user.id,
      user.email
    );

    setIsSaving(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Konfigurasi jenis dokumen berhasil diperbarui.' });
      setIsEditing(false);
      loadTypes();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Gagal memperbarui jenis dokumen.' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderLock className="w-6 h-6 text-emerald-700" />
            Konfigurasi Jenis Dokumen Persyaratan
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pengaturan kelengkapan berkas wajib/opsional, batas ukuran (MB), dan format file
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={loadTypes}
        >
          Muat Ulang
        </Button>
      </div>

      {!isSuperAdmin && (
        <Alert
          type="info"
          message="Anda masuk sebagai Panitia PSB. Mode ini hanya dapat melihat daftar konfigurasi berkas (Read-Only). Perubahan konfigurasi hanya dapat dilakukan oleh Super Admin."
        />
      )}

      {statusMessage && (
        <Alert
          type={statusMessage.type}
          message={statusMessage.text}
          onClose={() => setStatusMessage(null)}
        />
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner text="Memuat daftar jenis dokumen..." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Urutan</TableHead>
                <TableHead>Kode & Nama Dokumen</TableHead>
                <TableHead>Keterangan & Format</TableHead>
                <TableHead align="center">Wajib</TableHead>
                <TableHead align="center">Maks Size</TableHead>
                <TableHead align="center">Status</TableHead>
                {isSuperAdmin && <TableHead align="center">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <span className="font-bold text-xs text-slate-500">#{type.sort_order}</span>
                  </TableCell>

                  <TableCell>
                    <div>
                      <span className="font-mono text-[10px] text-slate-400 block">{type.code}</span>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm">{type.name}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="max-w-md">
                      <p className="text-xs text-slate-600 line-clamp-2">{type.description || '-'}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Format: {type.allowed_mime_types.map((m) => m.split('/')[1].toUpperCase()).join(', ')}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell align="center">
                    {type.is_required ? (
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        WAJIB
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Opsional
                      </span>
                    )}
                  </TableCell>

                  <TableCell align="center">
                    <span className="text-xs font-mono text-slate-700">{type.max_file_size_mb} MB</span>
                  </TableCell>

                  <TableCell align="center">
                    {type.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle className="w-3.5 h-3.5" /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3.5 h-3.5" /> Nonaktif
                      </span>
                    )}
                  </TableCell>

                  {isSuperAdmin && (
                    <TableCell align="center">
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => handleOpenEdit(type)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Modal */}
      {isEditing && selectedType && (
        <Modal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          title={`Edit Dokumen: ${selectedType.name}`}
          subtitle={`Kode unik: ${selectedType.code}`}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Batal
              </Button>
              <Button
                size="sm"
                variant="primary"
                isLoading={isSaving}
                onClick={handleSave}
              >
                Simpan Perubahan
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Nama Dokumen"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Keterangan / Panduan Pengunggahan"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Batas Maksimal Ukuran (MB)"
                type="number"
                min={1}
                max={20}
                value={formData.max_file_size_mb || 5}
                onChange={(e) => setFormData({ ...formData, max_file_size_mb: parseInt(e.target.value) || 5 })}
                required
              />

              <Input
                label="Urutan Tampilan"
                type="number"
                min={1}
                value={formData.sort_order || 1}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.is_required || false}
                  onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                  className="rounded text-emerald-700 focus:ring-emerald-600"
                />
                <span>Wajib Diunggah Peserta</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.is_active || false}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-emerald-700 focus:ring-emerald-600"
                />
                <span>Status Aktif</span>
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
