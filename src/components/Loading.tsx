import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; text?: string; className?: string }> = ({
  size = 'md',
  text,
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 gap-3 text-emerald-700 ${className}`}>
      <Loader2 className={`${sizeMap[size]} animate-spin`} />
      {text && <p className="text-sm font-medium text-slate-600">{text}</p>}
    </div>
  );
};

export const FullPageLoading: React.FC<{ text?: string }> = ({ text = 'Memuat sistem PSB...' }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="p-8 rounded-2xl bg-white shadow-xl border border-slate-100 flex flex-col items-center max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <h3 className="text-base font-bold text-slate-800">PPTQM DARUL HIKMAH</h3>
        <p className="text-xs text-slate-500 mt-1">{text}</p>
      </div>
    </div>
  );
};
