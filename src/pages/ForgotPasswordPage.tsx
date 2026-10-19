import React, { useState } from 'react';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { authService } from '../services/authService';
import { BookOpen, Mail, ArrowLeft, Send } from 'lucide-react';

export const ForgotPasswordPage: React.FC<{ onNavigate: (route: string) => void }> = ({
  onNavigate,
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Silakan masukkan alamat email akun Anda.');
      return;
    }

    setIsLoading(true);
    setError(null);
    const res = await authService.resetPassword(email);
    setIsLoading(false);

    if (res.success) {
      setMessage(res.message);
    } else {
      setError(res.message || 'Gagal mengirim instruksi reset kata sandi.');
    }
  };

  return (
    <div className="min-h-[75vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div
            onClick={() => onNavigate('/')}
            className="inline-flex w-14 h-14 rounded-2xl bg-emerald-700 items-center justify-center text-white shadow-md cursor-pointer hover:scale-105 transition"
          >
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-900 tracking-tight">
            Pemulihan Kata Sandi
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Masukkan email terdaftar untuk menerima tautan pembaruan kata sandi
          </p>
        </div>

        <div className="bg-white py-8 px-6 sm:px-8 rounded-2xl border border-slate-200 shadow-sm">
          {message && (
            <Alert
              type="success"
              title="Permintaan Terkirim"
              message={message}
              className="mb-5"
            />
          )}

          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Alamat Email Terdaftar"
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
              rightIcon={<Send className="w-4 h-4" />}
            >
              Kirim Tautan Pemulihan
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <button
              onClick={() => onNavigate('/login')}
              className="text-xs font-semibold text-slate-600 hover:text-emerald-700 inline-flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Halaman Masuk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
