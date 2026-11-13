import { useEffect, useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import Shell from '../components/layout/Shell';
import { completePasswordReset, verifyResetCode } from '../auth/authService';
import { saveConsent } from '../lib/consent';

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

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode')?.trim() ?? '';

  const [verifying, setVerifying] = useState(Boolean(oobCode));
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [codeError, setCodeError] = useState(
    oobCode
      ? ''
      : 'Tautan konfirmasi tidak lengkap atau sudah tidak berlaku. Silakan kirim ulang permintaan lupa kata sandi.',
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!oobCode) return;

    let active = true;
    verifyResetCode(oobCode)
      .then((email) => {
        if (!active) return;
        setVerifiedEmail(email);
        setVerifying(false);
      })
      .catch((caught) => {
        if (!active) return;
        setCodeError(getResetErrorMessage(caught));
        setVerifying(false);
      });

    return () => {
      active = false;
    };
  }, [oobCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');

    if (newPassword.length < 6) {
      setSubmitError('Kata sandi baru minimal terdiri dari 6 karakter.');
      return;
    }
    if (newPassword !== confirmation) {
      setSubmitError('Konfirmasi kata sandi baru belum sama.');
      return;
    }

    setBusy(true);
    try {
      if (oobCode) {
        await completePasswordReset(oobCode, newPassword);
      }
      saveConsent();
      navigate('/', { replace: true });
    } catch (caught) {
      setSubmitError(getResetErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <main className="page auth-page">
        <div className="auth-layout">
          <section className="card auth-card">
            <header className="auth-header">
              <span className="eyebrow">PEMULIHAN AKUN</span>
              <h1>Buat Kata Sandi Baru</h1>
              <p>
                Masukkan kata sandi baru untuk akun Anda. Setelah disimpan, Anda akan langsung masuk
                ke halaman utama.
              </p>
            </header>

            {verifying ? (
              <div className="reset-status-box" role="status">
                <KeyRound size={20} className="reset-status-icon" />
                <span>Memverifikasi tautan konfirmasi email Anda…</span>
              </div>
            ) : codeError ? (
              <div className="auth-form">
                <div className="auth-feedback error" role="alert">
                  <CircleAlert size={16} className="auth-feedback-icon" />
                  <span>{codeError}</span>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => navigate('/auth?mode=lupa', { replace: true })}
                >
                  <ArrowLeft size={16} />
                  Kirim Ulang Email Konfirmasi
                </button>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit}>
                {verifiedEmail && (
                  <div className="reset-email-pill" aria-label="Email akun">
                    <Mail size={15} />
                    <span>{verifiedEmail}</span>
                  </div>
                )}

                <PasswordField
                  label="Kata Sandi Baru"
                  placeholder="Minimal 6 karakter"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                />

                <PasswordField
                  label="Konfirmasi Kata Sandi Baru"
                  placeholder="Ketik ulang kata sandi baru"
                  value={confirmation}
                  onChange={setConfirmation}
                  autoComplete="new-password"
                />

                {submitError && (
                  <div className="auth-feedback error" role="alert">
                    <CircleAlert size={16} className="auth-feedback-icon" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button className="btn auth-submit-btn" type="submit" disabled={busy}>
                  {busy ? 'Menyimpan & Masuk…' : 'Simpan Kata Sandi & Masuk'}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </Shell>
  );
}

function getResetErrorMessage(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : '';
  switch (code) {
    case 'auth/expired-action-code':
      return 'Tautan konfirmasi sudah kedaluwarsa. Silakan kirim ulang email reset kata sandi.';
    case 'auth/invalid-action-code':
      return 'Tautan konfirmasi tidak valid atau sudah pernah digunakan.';
    case 'auth/weak-password':
      return 'Kata sandi baru terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/user-disabled':
      return 'Akun ini sedang dinonaktifkan.';
    case 'auth/user-not-found':
      return 'Akun pengguna tidak ditemukan.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Gagal mengatur ulang kata sandi. Silakan coba lagi.';
  }
}
