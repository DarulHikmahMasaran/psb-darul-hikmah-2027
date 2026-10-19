import React from 'react';
import { CandidateStatus, UserRole } from '../types/database';

export interface BadgeProps {
  status?: CandidateStatus | string;
  role?: UserRole;
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: 'DRAFT',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  TERDAFTAR: {
    label: 'TERDAFTAR',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  PERLU_PERBAIKAN: {
    label: 'PERLU PERBAIKAN',
    className: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
  },
  TERVERIFIKASI: {
    label: 'TERVERIFIKASI',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  DIIZINKAN_MENGIKUTI_SELEKSI: {
    label: 'DIIZINKAN TES',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  MENGIKUTI_SELEKSI: {
    label: 'SEDANG TES',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  SELESAI_SELEKSI: {
    label: 'SELESAI TES',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  LULUS: {
    label: 'LULUS SELEKSI',
    className: 'bg-teal-50 text-teal-800 border-teal-300 font-bold',
  },
  CADANGAN: {
    label: 'CADANGAN',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  TIDAK_LULUS: {
    label: 'TIDAK LULUS',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  DAFTAR_ULANG: {
    label: 'DAFTAR ULANG',
    className: 'bg-sky-50 text-sky-800 border-sky-300',
  },
  DITERIMA_FINAL: {
    label: 'SANTRI RESMI',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-400 font-bold',
  },
  BATAL: {
    label: 'BATAL',
    className: 'bg-gray-100 text-gray-500 border-gray-200 line-through',
  },
};

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  SUPER_ADMIN: {
    label: 'SUPER ADMIN',
    className: 'bg-purple-100 text-purple-800 border-purple-300 font-semibold',
  },
  PANITIA: {
    label: 'PANITIA PSB',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
  },
  PENGUJI_QURAN: {
    label: 'PENGUJI QURAN',
    className: 'bg-teal-100 text-teal-800 border-teal-300',
  },
  PIMPINAN: {
    label: 'PIMPINAN',
    className: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
  },
  PESERTA: {
    label: 'CALON SANTRI',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  status,
  role,
  children,
  variant,
  size = 'sm',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  if (status && statusConfig[status]) {
    const conf = statusConfig[status];
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${conf.className}`}
      >
        <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current opacity-70"></span>
        {conf.label}
      </span>
    );
  }

  if (role && roleConfig[role]) {
    const conf = roleConfig[role];
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${conf.className}`}
      >
        {conf.label}
      </span>
    );
  }

  let customVariantClass = 'bg-slate-100 text-slate-700 border-slate-200';
  if (variant === 'success') customVariantClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (variant === 'warning') customVariantClass = 'bg-amber-50 text-amber-700 border-amber-200';
  if (variant === 'danger') customVariantClass = 'bg-rose-50 text-rose-700 border-rose-200';
  if (variant === 'info') customVariantClass = 'bg-blue-50 text-blue-700 border-blue-200';
  if (variant === 'purple') customVariantClass = 'bg-purple-50 text-purple-700 border-purple-200';

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${customVariantClass}`}>
      {children}
    </span>
  );
};
