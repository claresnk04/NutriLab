import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { Link, useLocation, useNavigate } from 'react-router';
import { login, register, resetPassword } from '../auth/authService';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(getAuthErrorMessage(caught, mode));
    }
  }

  async function forgotPassword() {
    if (!email) {
      setError('Masukkan email terlebih dahulu.');
      return;
    }
    try {
      await resetPassword(email);
      setMessage('Tautan reset kata sandi sudah dikirim.');
    } catch (caught) {
      setError(getAuthErrorMessage(caught, 'reset'));
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">Nutri-lab</p>
      <h1 className="mt-2 text-3xl font-bold">{mode === 'login' ? 'Masuk' : 'Buat akun'}</h1>
      <p className="mt-2 text-slate-600">Gunakan akun Anda untuk menyimpan riwayat penilaian.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block">
          <span className="font-medium">Email</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="font-medium">Kata sandi</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        )}
        <button
          className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white"
          type="submit"
        >
          {mode === 'login' ? 'Masuk' : 'Daftar'}
        </button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <button
          className="text-brand underline"
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Buat akun baru' : 'Sudah punya akun? Masuk'}
        </button>
        {mode === 'login' && (
          <button className="text-slate-600 underline" type="button" onClick={forgotPassword}>
            Lupa kata sandi?
          </button>
        )}
      </div>
      <Link className="mt-8 inline-block text-sm text-slate-600 underline" to="/onboarding">
        Baca pengantar aplikasi
      </Link>
    </div>
  );
}

function getAuthErrorMessage(error: unknown, mode: 'login' | 'register' | 'reset') {
  const code = error instanceof FirebaseError ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Email sudah terdaftar. Gunakan tombol Masuk.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/weak-password':
      return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email atau password salah. Jika belum punya akun, pilih Daftar.';
    case 'auth/operation-not-allowed':
      return 'Login email/password belum diaktifkan di Firebase Console.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi gagal. Periksa internet lalu coba lagi.';
    default:
      if (mode === 'reset') return 'Gagal mengirim tautan reset kata sandi.';
      if (mode === 'register')
        return 'Pendaftaran gagal. Periksa email dan password lalu coba lagi.';
      return 'Login gagal. Periksa email dan password lalu coba lagi.';
  }
}
