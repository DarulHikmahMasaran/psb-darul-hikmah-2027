import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface QrCodeViewerProps {
  value: string;
  size?: number;
  className?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
}

export const QrCodeViewer: React.FC<QrCodeViewerProps> = ({
  value,
  size = 140,
  className = '',
  level = 'M',
  includeMargin = true,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setDataUrl('');
      return;
    }

    let isMounted = true;
    QRCode.toDataURL(
      value,
      {
        width: size,
        margin: includeMargin ? 2 : 0,
        errorCorrectionLevel: level,
        color: {
          dark: '#064e3b', // Deep emerald color matching branding
          light: '#ffffff',
        },
      },
      (err, url) => {
        if (!isMounted) return;
        if (err) {
          console.error('Error generating QR code', err);
          setError('Gagal membuat QR Code.');
        } else {
          setDataUrl(url);
          setError(null);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [value, size, level, includeMargin]);

  if (error) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-100 text-slate-400 text-[10px] p-2 text-center rounded-lg border border-slate-200 ${className}`}
      >
        QR Error
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-50 animate-pulse rounded-lg border border-slate-200 ${className}`}
      >
        <span className="text-[10px] text-slate-400">Membuat QR...</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="QR Code Verifikasi Peserta"
      width={size}
      height={size}
      className={`rounded-lg shadow-xs border border-slate-200 bg-white ${className}`}
    />
  );
};
