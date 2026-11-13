import { useEffect, useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
} from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import Shell from '../components/layout/Shell';
import {
  login,
  loginWithGoogle,
  register,
  resetPassword,
  updateAccountName,
} from '../auth/authService';
import { getProfile, saveProfile } from '../firestore/profileRepository';

type Mode = 'masuk' | 'daftar' | 'lupa' | 'terkirim';

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
      />
    </svg>
  );
}

function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <span className="input">
        <input
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="password-eye-btn"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialModeParam = searchParams.get('mode');
  const [mode, setMode] = useState<Mode>(initialModeParam === 'lupa' ? 'lupa' : 'masuk');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const isRegister = mode === 'daftar';
  const isForgot = mode === 'lupa';
  const isSent = mode === 'terkirim';
  const fromPath = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    const oobCode = searchParams.get('oobCode');
    const actionMode = searchParams.get('mode');
    if (oobCode && (!actionMode || actionMode === 'resetPassword')) {
      navigate(`/reset-password?oobCode=${encodeURIComponent(oobCode)}`, { replace: true });
    }
  }, [navigate, searchParams]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (isForgot) {
      await handleSendResetEmail();
      return;
    }

    const trimmedName = name.trim();

    if (isRegister && trimmedName.length < 2) {
      setError('Nama lengkap minimal terdiri dari 2 karakter.');
      return;
    }
    if (isRegister && password.length < 6) {
      setError('Kata sandi minimal terdiri dari 6 karakter.');
      return;
    }
    if (isRegister && password !== confirmation) {
      setError('Konfirmasi kata sandi belum sama.');
      return;
    }

    setBusy(true);
    try {
      if (isRegister) {
        const credential = await register(email.trim(), password);
        await Promise.all([
          updateAccountName(credential.user, trimmedName).catch(() => {}),
          saveProfile(credential.user.uid, { nama: trimmedName }).catch(() => {}),
        ]);
        navigate(fromPath ?? '/profil', { replace: true });
      } else {
        await login(email.trim(), password);
        navigate(fromPath ?? '/', { replace: true });
      }
    } catch (caught) {
      setError(getAuthErrorMessage(caught, isRegister ? 'register' : 'login'));
    } finally {
      setBusy(false);
    }
  }

  function getMailProviderTarget(rawEmail: string): { label: string; url: string } {
    const domain = rawEmail.trim().split('@')[1]?.toLowerCase() ?? '';
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      return {
        label: 'Buka Gmail',
        url: 'https://mail.google.com/mail/u/0/#search/in%3Aanywhere+NutriLab',
      };
    }
    if (domain.startsWith('yahoo.')) {
      return { label: 'Buka Yahoo Mail', url: 'https://mail.yahoo.com' };
    }
    if (
      domain.startsWith('outlook.') ||
      domain.startsWith('hotmail.') ||
      domain.startsWith('live.')
    ) {
      return { label: 'Buka Outlook Mail', url: 'https://outlook.live.com/mail/0/inbox' };
    }
    return {
      label: 'Buka Email Sekarang',
      url: 'https://mail.google.com/mail/u/0/#search/in%3Aanywhere+NutriLab',
    };
  }

  async function handleSendResetEmail() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Masukkan alamat email Anda terlebih dahulu untuk menerima tautan konfirmasi.');
      return;
    }

    setBusy(true);
    try {
      await resetPassword(trimmedEmail);
      setMessage(
        `Kami telah mengirimkan email konfirmasi ke ${trimmedEmail}. Silakan buka email tersebut dan klik tombol konfirmasi di dalamnya untuk mengatur kata sandi baru.`,
      );
      setMode('terkirim');
    } catch (caught) {
      setError(getAuthErrorMessage(caught, 'reset'));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    setMessage('');
    setGoogleBusy(true);
    try {
      const credential = await loginWithGoogle();
      const displayName = credential.user.displayName?.trim();
      if (displayName) {
        try {
          const existing = await getProfile(credential.user.uid);
          if (!existing.nama) {
            await saveProfile(credential.user.uid, { nama: displayName });
          }
        } catch {
          // Abaikan bila offline saat sinkronisasi awal nama Google
        }
      }
      navigate(fromPath ?? '/', { replace: true });
    } catch (caught) {
      setError(getAuthErrorMessage(caught, 'google'));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <Shell>
      <main className="page auth-page">
        <div className="auth-layout">
          <section className="card auth-card">
            <header className="auth-header">
              <span className="eyebrow">
                {isForgot || isSent ? 'PEMULIHAN AKUN' : 'AKUN NUTRILAB'}
              </span>
              <h1>
                {isSent
                  ? 'Cek Email Anda'
                  : isForgot
                    ? 'Lupa Kata Sandi?'
                    : isRegister
                      ? 'Buat Akun Baru'
                      : 'Selamat Datang Kembali'}
              </h1>
              <p>
                {isSent
                  ? 'Buka kotak masuk email Anda dan klik tombol konfirmasi di dalam pesan untuk melanjutkan ke halaman pembuatan kata sandi baru.'
                  : isForgot
                    ? 'Masukkan email yang terdaftar. Kami akan mengirimkan email berisi tombol konfirmasi untuk mengatur ulang kata sandi Anda.'
                    : isRegister
                      ? 'Daftar untuk mulai memantau batas gula dan gizi harian Anda.'
                      : 'Masuk untuk mengakses catatan dan dompet koin gizi Anda.'}
              </p>
            </header>

            {isSent ? (
              <div className="auth-form">
                {email.trim() && (
                  <div className="reset-email-pill" aria-label="Email tujuan">
                    <Mail size={15} />
                    <span>{email.trim()}</span>
                  </div>
                )}

                <div className="save-banner" role="status">
                  <CircleCheck size={17} className="save-banner-icon" />
                  <div className="save-banner-copy">
                    <strong>Email Konfirmasi Terkirim</strong>
                    <span>{message}</span>
                  </div>
                </div>

                <a
                  className="btn btn-open-mail"
                  href={getMailProviderTarget(email).url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Mail size={16} />
                  <span>{getMailProviderTarget(email).label}</span>
                  <ExternalLink size={15} />
                </a>

                <button type="button" className="btn secondary" onClick={() => switchMode('masuk')}>
                  <ArrowLeft size={16} />
                  Kembali ke Halaman Masuk
                </button>
              </div>
            ) : (
              <>
                {!isForgot && (
                  <div className="seg auth-seg" role="tablist" aria-label="Pilih mode autentikasi">
                    <button
                      className={!isRegister ? 'on' : ''}
                      type="button"
                      role="tab"
                      aria-selected={!isRegister}
                      onClick={() => switchMode('masuk')}
                    >
                      Masuk
                    </button>
                    <button
                      className={isRegister ? 'on' : ''}
                      type="button"
                      role="tab"
                      aria-selected={isRegister}
                      onClick={() => switchMode('daftar')}
                    >
                      Daftar
                    </button>
                  </div>
                )}

                <form className="auth-form" onSubmit={submit}>
                  {isRegister && (
                    <label className="field">
                      <span>Nama Lengkap</span>
                      <span className="input">
                        <input
                          required
                          minLength={2}
                          placeholder="Contoh: Budi Santoso"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          autoComplete="name"
                        />
                      </span>
                    </label>
                  )}

                  <label className="field">
                    <span>Alamat Email</span>
                    <span className="input">
                      <input
                        type="email"
                        placeholder="nama@email.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        required
                      />
                    </span>
                  </label>

                  {!isForgot && (
                    <PasswordField
                      label="Kata Sandi"
                      placeholder={isRegister ? 'Minimal 6 karakter' : 'Masukkan kata sandi'}
                      value={password}
                      onChange={setPassword}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                    />
                  )}

                  {!isRegister && !isForgot && (
                    <div className="auth-forgot-row">
                      <button
                        className="link-button auth-forgot-link"
                        type="button"
                        onClick={() => switchMode('lupa')}
                      >
                        Lupa kata sandi?
                      </button>
                    </div>
                  )}

                  {isRegister && (
                    <PasswordField
                      label="Konfirmasi Kata Sandi"
                      placeholder="Ketik ulang kata sandi"
                      value={confirmation}
                      onChange={setConfirmation}
                      autoComplete="new-password"
                    />
                  )}

                  {error && (
                    <div className="auth-feedback error" role="alert">
                      <CircleAlert size={16} className="auth-feedback-icon" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    className="btn auth-submit-btn"
                    disabled={busy || googleBusy}
                    type="submit"
                  >
                    {busy ? (
                      'Memproses…'
                    ) : isForgot ? (
                      <>
                        <Mail size={16} />
                        Kirim Email Konfirmasi
                      </>
                    ) : isRegister ? (
                      <>
                        Buat Akun
                        <ArrowRight size={16} />
                      </>
                    ) : (
                      <>
                        Masuk
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  {isForgot && (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busy}
                      onClick={() => switchMode('masuk')}
                    >
                      <ArrowLeft size={16} />
                      Kembali ke Halaman Masuk
                    </button>
                  )}
                </form>

                {!isForgot && (
                  <>
                    <div className="auth-divider" role="separator" aria-label="atau">
                      <span>atau</span>
                    </div>

                    <button
                      type="button"
                      className="btn secondary btn-google"
                      disabled={busy || googleBusy}
                      onClick={() => void handleGoogleLogin()}
                    >
                      <GoogleLogo />
                      <span>
                        {googleBusy ? 'Menghubungkan ke Google…' : 'Lanjutkan dengan Google'}
                      </span>
                    </button>

                    <footer className="auth-footer">
                      <span>{isRegister ? 'Sudah memiliki akun?' : 'Belum memiliki akun?'}</span>
                      <button
                        type="button"
                        className="link-button auth-switch-link"
                        onClick={() => switchMode(isRegister ? 'masuk' : 'daftar')}
                      >
                        {isRegister ? 'Masuk di sini' : 'Daftar sekarang'}
                      </button>
                    </footer>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </Shell>
  );
}

function getAuthErrorMessage(error: unknown, mode: 'login' | 'register' | 'reset' | 'google') {
  const code = error instanceof FirebaseError ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan pindah ke tab Masuk.';
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.';
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      if (mode === 'reset') {
        return 'Email tidak ditemukan atau belum terdaftar.';
      }
      return 'Email atau kata sandi yang Anda masukkan belum sesuai.';
    case 'auth/popup-closed-by-user':
      return 'Login Google dibatalkan sebelum selesai.';
    case 'auth/popup-blocked':
      return 'Popup login Google diblokir oleh browser. Izinkan popup untuk situs ini lalu coba lagi.';
    case 'auth/account-exists-with-different-credential':
      return 'Email ini sudah terdaftar dengan metode masuk lain. Silakan masuk dengan email dan kata sandi.';
    case 'auth/operation-not-allowed':
      return mode === 'google'
        ? 'Metode login Google OAuth belum diaktifkan di Firebase Console.'
        : 'Metode login email/password belum diaktifkan di server.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Silakan tunggu beberapa saat lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi terputus. Periksa jaringan internet Anda lalu coba lagi.';
    default:
      if (mode === 'google')
        return 'Gagal masuk dengan Google. Pastikan konfigurasi OAuth sudah aktif.';
      if (mode === 'reset') return 'Gagal mengirim email konfirmasi reset kata sandi.';
      if (mode === 'register') return 'Pendaftaran belum berhasil. Periksa kembali data Anda.';
      return 'Gagal masuk. Periksa email dan kata sandi Anda.';
  }
}
