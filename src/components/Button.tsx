import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success' | 'white' | 'outline-white';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed select-none active:scale-[0.99] whitespace-normal';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5 font-semibold',
  };

  const variantClasses = {
    primary:
      'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm hover:shadow focus:ring-emerald-600',
    secondary:
      'bg-amber-600 hover:bg-amber-700 text-white shadow-sm hover:shadow focus:ring-amber-500',
    outline:
      'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 focus:ring-slate-400',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow focus:ring-rose-500',
    ghost:
      'text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:ring-slate-300',
    success:
      'bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow focus:ring-teal-500',
    white:
      'bg-white hover:bg-slate-100 text-emerald-950 shadow-md hover:shadow-lg focus:ring-emerald-300 border border-transparent font-bold',
    'outline-white':
      'border border-white/60 bg-transparent hover:bg-white/10 text-white shadow-sm focus:ring-white font-semibold',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0 text-current">{leftIcon}</span>
      )}
      <span className="text-current font-inherit leading-normal">{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0 text-current">{rightIcon}</span>}
    </button>
  );
};
