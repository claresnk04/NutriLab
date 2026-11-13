import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import Shell from '../components/layout/Shell';
import { login, register, resetPassword } from '../auth/authService';

type Mode = 'daftar' | 'masuk';

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      {label}
      <span className="input">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="current-password"
          required
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          style={{ background: 'none', color: 'var(--color-text-primary)' }}
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </span>
    </label>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('daftar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'daftar';
  const destination = (location.state as { from?: string } | null)?.from ?? '/profil';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (isRegister && name.trim().length < 2) {
      setError('Nama minimal terdiri dari 2 karakter.');
      return;
    }
    if (isRegister && password !== confirmation) {
      setError('Kata sandi belum sama.');
      return;
    }
    setBusy(true);
    try {
      if (isRegister) await register(email, password);
      else await login(email, password);
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(getAuthErrorMessage(caught, isRegister ? 'register' : 'login'));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError('');
    setMessage('');
    if (!email) {
      setError('Masukkan email terlebih dahulu.');
      return;
    }
    try {
      await resetPassword(email);
      setMessage('Tautan reset kata sandi sudah dikirim ke email Anda.');
    } catch (caught) {
      setError(getAuthErrorMessage(caught, 'reset'));
    }
  }

  return (
    <Shell>
      <main className="page narrow">
        <div className="seg">
          <button className={isRegister ? 'on' : ''} type="button" onClick={() => setMode('daftar')}>
            Daftar Akun Baru
          </button>
          <button className={!isRegister ? 'on' : ''} type="button" onClick={() => setMode('masuk')}>
            Masuk Akun
          </button>
        </div>
        <form className="card auth-card" onSubmit={submit}>
          {isRegister && (
            <label className="field">
              Nama Lengkap
              <span className="input">
                <input
                  required
                  minLength={2}
                  placeholder="Contoh: Pak Hartono"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </span>
            </label>
          )}
          <label className="field">
            Alamat Email
            <span className="input">
              <input
                type="email"
                placeholder="bapak.hartono@email.id"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </span>
          </label>
          <PasswordField label="Kata Sandi" value={password} onChange={setPassword} />
          {isRegister && (
            <PasswordField label="Ulangi Kata Sandi" value={confirmation} onChange={setConfirmation} />
          )}
          {error && <span className="small error-text" role="alert">{error}</span>}
          {message && <span className="small success-text" role="status">{message}</span>}
          {!isRegister && (
            <button className="link-button" type="button" onClick={() => void forgotPassword()}>
              Lupa kata sandi?
            </button>
          )}
          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Memproses…' : isRegister ? 'Daftar & Lengkapi Profil' : 'Masuk & Lengkapi Profil'}
            <ArrowRight size={18} />
          </button>
        </form>
      </main>
    </Shell>
  );
}

function getAuthErrorMessage(error: unknown, mode: 'login' | 'register' | 'reset') {
  const code = error instanceof FirebaseError ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use': return 'Email sudah terdaftar. Gunakan tombol Masuk.';
    case 'auth/invalid-email': return 'Format email tidak valid.';
    case 'auth/weak-password': return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password': return 'Email atau password salah.';
    case 'auth/operation-not-allowed': return 'Login email/password belum diaktifkan di Firebase Console.';
    case 'auth/too-many-requests': return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/network-request-failed': return 'Koneksi gagal. Periksa internet lalu coba lagi.';
    default:
      if (mode === 'reset') return 'Gagal mengirim tautan reset kata sandi.';
      if (mode === 'register') return 'Pendaftaran gagal. Periksa email dan password lalu coba lagi.';
      return 'Login gagal. Periksa email dan password lalu coba lagi.';
  }
}
