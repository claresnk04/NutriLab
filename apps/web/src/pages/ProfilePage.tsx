import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { Check, CircleCheck, Eye, EyeOff, KeyRound, LogOut } from 'lucide-react';
import { computeDailyLimits } from '@nutri-lab/scoring';
import Shell from '../components/layout/Shell';
import { changeAccountPassword, isPasswordProviderUser, logout, updateAccountName } from '../auth/authService';
import { useAuth } from '../auth/useAuth';
import { getProfile, saveProfile } from '../firestore/profileRepository';
import type { UserProfile } from '../firestore/types';

type Sex = 'F' | 'M';
type ActivityLevel = NonNullable<UserProfile['aktivitas']>;

const ACTIVITY_OPTIONS: Array<{ key: ActivityLevel; label: string; desc: string }> = [
  { key: 'istirahat', label: 'Istirahat', desc: 'Mayoritas duduk / rebahan' },
  { key: 'ringan', label: 'Ringan', desc: 'Jalan santai / kerja kantor' },
  { key: 'sedang', label: 'Sedang', desc: 'Aktif bergerak / olahraga ringan' },
  { key: 'berat', label: 'Berat', desc: 'Pekerjaan fisik / olahraga rutin' },
  { key: 'sangat_berat', label: 'Sangat Berat', desc: 'Latihan intensitas tinggi' },
];

const format = (value: number) => value.toFixed(1).replace(/\.0$/, '').replace('.', ',');

function PasswordInput({
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
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [nama, setNama] = useState(() => user?.displayName ?? '');
  const [sex, setSex] = useState<Sex>('F');
  const [beratKg, setBeratKg] = useState('60');
  const [tinggiCm, setTinggiCm] = useState('160');
  const [usia, setUsia] = useState('45');
  const [aktivitas, setAktivitas] = useState<ActivityLevel>('ringan');
  const [targetKaloriManual, setTargetKaloriManual] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [error, setError] = useState('');

  // State ubah password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    if (!user) return;
    void getProfile(user.uid).then((profile) => {
      if (profile.nama) setNama(profile.nama);
      if (profile.jenisKelamin) setSex(profile.jenisKelamin);
      if (profile.beratKg) setBeratKg(String(profile.beratKg));
      if (profile.tinggiCm) setTinggiCm(String(profile.tinggiCm));
      if (profile.usia) setUsia(String(profile.usia));
      if (profile.aktivitas) setAktivitas(profile.aktivitas);
      if (profile.targetKaloriManual) setTargetKaloriManual(String(profile.targetKaloriManual));
    });
  }, [user]);

  const draftProfile = useMemo<UserProfile>(() => {
    const weight = Number(beratKg);
    const height = Number(tinggiCm);
    const age = Number(usia);
    const manualCal = targetKaloriManual.trim() ? Number(targetKaloriManual) : undefined;
    return {
      nama: nama.trim() || undefined,
      jenisKelamin: sex,
      beratKg: Number.isFinite(weight) && weight > 0 ? weight : undefined,
      tinggiCm: Number.isFinite(height) && height > 0 ? height : undefined,
      usia: Number.isFinite(age) && age > 0 ? age : undefined,
      aktivitas,
      targetKaloriManual:
        manualCal && Number.isFinite(manualCal) && manualCal >= 1000 && manualCal <= 4000
          ? manualCal
          : undefined,
    };
  }, [nama, sex, beratKg, tinggiCm, usia, aktivitas, targetKaloriManual]);

  const limits = useMemo(() => computeDailyLimits(draftProfile), [draftProfile]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const weight = Number(beratKg);
    const height = Number(tinggiCm);
    const age = Number(usia);

    if (!Number.isFinite(weight) || weight < 30 || weight > 250) {
      setError('Masukkan berat badan yang valid (30–250 kg).');
      return;
    }
    if (!Number.isFinite(height) || height < 100 || height > 230) {
      setError('Masukkan tinggi badan yang valid (100–230 cm).');
      return;
    }
    if (!Number.isFinite(age) || age < 15 || age > 110) {
      setError('Masukkan usia yang valid (15–110 tahun).');
      return;
    }

    setSaving(true);
    setError('');
    setSavedSuccess(false);
    try {
      const trimmedName = nama.trim();
      const payload: UserProfile = {
        ...(trimmedName ? { nama: trimmedName } : {}),
        jenisKelamin: sex,
        beratKg: weight,
        tinggiCm: height,
        usia: age,
        aktivitas,
      };
      const manualCal = targetKaloriManual.trim() ? Number(targetKaloriManual) : undefined;
      if (manualCal && Number.isFinite(manualCal) && manualCal >= 1000 && manualCal <= 4000) {
        payload.targetKaloriManual = manualCal;
      }
      await Promise.all([
        saveProfile(user.uid, payload),
        trimmedName && trimmedName !== user.displayName
          ? updateAccountName(user, trimmedName).catch(() => {})
          : Promise.resolve(),
      ]);
      setSavedSuccess(true);
      setToastMessage('Perubahan profil & batas gizi berhasil disimpan.');
      setTimeout(() => {
        setSavedSuccess(false);
        setToastMessage('');
      }, 3800);
    } catch {
      setError('Profil belum dapat disimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setPasswordError('');
    setPasswordSuccess('');

    if (!oldPassword) {
      setPasswordError('Masukkan password lama terlebih dahulu untuk konfirmasi.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password baru minimal harus terdiri dari 6 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Konfirmasi password baru belum sama.');
      return;
    }
    if (oldPassword === newPassword) {
      setPasswordError('Password baru harus berbeda dari password lama.');
      return;
    }

    setPasswordSaving(true);
    try {
      await changeAccountPassword(user, oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordSuccess('Password akun berhasil diperbarui.');
      setToastMessage('Password akun berhasil diperbarui.');
      setShowPasswordForm(false);
      setTimeout(() => {
        setPasswordSuccess('');
        setToastMessage('');
      }, 3800);
    } catch (caught) {
      const code = caught instanceof FirebaseError ? caught.code : '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-login-credentials'
      ) {
        setPasswordError('Password lama tidak sesuai. Silakan periksa kembali.');
      } else if (code === 'auth/too-many-requests') {
        setPasswordError('Terlalu banyak percobaan gagal. Tunggu beberapa saat lalu coba lagi.');
      } else if (code === 'auth/weak-password') {
        setPasswordError('Password baru terlalu lemah. Gunakan minimal 6 karakter.');
      } else {
        setPasswordError('Gagal mengubah password. Periksa password lama atau koneksi Anda.');
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  const displayTitle = nama.trim() || user?.displayName || 'Pengguna NutriLab';
  const userInitial = (displayTitle || user?.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <Shell tabs tab="profil">
      <main className="page">
        {toastMessage && (
          <div className="toast-notification" role="status" aria-live="polite">
            <span className="toast-icon" aria-hidden="true">
              <CircleCheck size={18} />
            </span>
            <div className="toast-copy">
              <strong>Berhasil Tersimpan</strong>
              <span>{toastMessage}</span>
            </div>
          </div>
        )}
        <div className="profile-layout">
          <form className="card profile-form-card" onSubmit={handleSave}>
            <header className="profile-form-head">
              <span className="eyebrow">DATA DIRI &amp; BATAS GIZI</span>
              <h2>Sesuaikan Batas Gizi</h2>
              <p>
                Batas harian dihitung otomatis berdasarkan rumus Pedoman Pengelolaan DM2{' '}
                <strong>PERKENI</strong> sesuai profil fisik Anda.
              </p>
            </header>

            <label className="field">
              <span>Nama Lengkap</span>
              <span className="input">
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap Anda"
                  value={nama}
                  onChange={(event) => setNama(event.target.value)}
                  autoComplete="name"
                />
              </span>
            </label>

            <div className="field">
              <span>Jenis Kelamin</span>
              <div className="seg">
                {(
                  [
                    ['F', 'Perempuan'],
                    ['M', 'Laki-laki'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sex === key}
                    className={sex === key ? 'on' : ''}
                    onClick={() => setSex(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-grid two-col">
              <label className="field">
                <span>Berat Badan</span>
                <span className="input">
                  <input
                    type="number"
                    min={30}
                    max={250}
                    step="0.5"
                    required
                    value={beratKg}
                    onChange={(event) => setBeratKg(event.target.value)}
                  />
                  <small>kg</small>
                </span>
              </label>

              <label className="field">
                <span>Tinggi Badan</span>
                <span className="input">
                  <input
                    type="number"
                    min={100}
                    max={230}
                    required
                    value={tinggiCm}
                    onChange={(event) => setTinggiCm(event.target.value)}
                  />
                  <small>cm</small>
                </span>
              </label>

              <label className="field">
                <span>Usia</span>
                <span className="input">
                  <input
                    type="number"
                    min={15}
                    max={110}
                    required
                    value={usia}
                    onChange={(event) => setUsia(event.target.value)}
                  />
                  <small>tahun</small>
                </span>
              </label>

              <label className="field">
                <span>
                  Target Kalori <small className="field-optional">(opsional)</small>
                </span>
                <span className="input">
                  <input
                    type="number"
                    min={1000}
                    max={4000}
                    placeholder="Otomatis"
                    value={targetKaloriManual}
                    onChange={(event) => setTargetKaloriManual(event.target.value)}
                  />
                  <small>kkal</small>
                </span>
              </label>
            </div>

            <div className="field">
              <span>Tingkat Aktivitas Harian</span>
              <div className="activity-chips">
                {ACTIVITY_OPTIONS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`activity-chip ${aktivitas === item.key ? 'active' : ''}`}
                    onClick={() => setAktivitas(item.key)}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.desc}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="profile-limits-summary">
              <div className="row profile-limits-head">
                <span className="eyebrow">ESTIMASI BATAS HARIAN</span>
                <span className="small">
                  {limits.source === 'manual' ? 'Target manual' : 'Rumus PERKENI'}
                </span>
              </div>
              <div className="profile-limits-grid">
                <div className="profile-limit-item">
                  <span>Energi</span>
                  <strong>{Math.round(limits.energyKkal)}</strong>
                  <small>kkal / hari</small>
                </div>
                <div className="profile-limit-item">
                  <span>Batas Gula</span>
                  <strong>{format(limits.sugarG)}</strong>
                  <small>g / hari</small>
                </div>
                <div className="profile-limit-item">
                  <span>Lemak Jenuh</span>
                  <strong>{format(limits.saturatedFatG)}</strong>
                  <small>g / hari</small>
                </div>
              </div>
            </div>

            {error && (
              <p className="small error-text" role="alert">
                {error}
              </p>
            )}

            {savedSuccess && (
              <div className="save-banner" role="status" aria-live="polite">
                <CircleCheck size={18} className="save-banner-icon" />
                <div className="save-banner-copy">
                  <strong>Perubahan Profil Tersimpan</strong>
                  <span>Data diri dan estimasi batas gizi harian Anda sudah diperbarui.</span>
                </div>
              </div>
            )}

            <button className={`btn ${savedSuccess ? 'btn-saved' : ''}`} type="submit" disabled={saving}>
              {savedSuccess ? <CircleCheck size={17} /> : <Check size={16} />}
              {saving ? 'Menyimpan…' : savedSuccess ? 'Tersimpan!' : 'Simpan Perubahan'}
            </button>
          </form>

          <div className="profile-side-column">
            <section className="card profile-account-card">
              <div className="row profile-account-row">
                <div className="profile-identity">
                  <div className="profile-avatar" aria-hidden="true">
                    {userInitial}
                  </div>
                  <div className="profile-identity-copy">
                    <strong>{displayTitle}</strong>
                    <span>{user?.email || 'Akun aktif'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn ghost profile-logout-btn"
                  onClick={() => void logout()}
                >
                  <LogOut size={15} /> Keluar
                </button>
              </div>
            </section>

            <section className="card profile-security-card">
            <div className="row profile-security-head">
              <div>
                <span className="eyebrow">KEAMANAN AKUN</span>
                <h3>Password Akun</h3>
              </div>
              {isPasswordProviderUser(user) && !showPasswordForm && (
                <button
                  type="button"
                  className="btn ghost profile-security-toggle"
                  onClick={() => {
                    setShowPasswordForm(true);
                    setPasswordError('');
                    setPasswordSuccess('');
                  }}
                >
                  <KeyRound size={15} />
                  Ubah Password
                </button>
              )}
            </div>

            {!isPasswordProviderUser(user) && (
              <p className="small muted-copy">
                Akun ini terhubung melalui Google OAuth. Pengelolaan kata sandi dilakukan langsung melalui Akun Google Anda.
              </p>
            )}

            {passwordSuccess && (
              <div className="save-banner" role="status" aria-live="polite">
                <CircleCheck size={18} className="save-banner-icon" />
                <div className="save-banner-copy">
                  <strong>Password Berhasil Diperbarui</strong>
                  <span>{passwordSuccess}</span>
                </div>
              </div>
            )}

            {showPasswordForm && (
              <form className="profile-password-form" onSubmit={handlePasswordSubmit}>
                <PasswordInput
                  label="Konfirmasi Password Lama"
                  placeholder="Masukkan password saat ini"
                  value={oldPassword}
                  onChange={setOldPassword}
                  autoComplete="current-password"
                />
                <div className="form-grid two-col">
                  <PasswordInput
                    label="Password Baru"
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                  />
                  <PasswordInput
                    label="Ulangi Password Baru"
                    placeholder="Ketik ulang password baru"
                    value={confirmNewPassword}
                    onChange={setConfirmNewPassword}
                    autoComplete="new-password"
                  />
                </div>

                {passwordError && (
                  <p className="small error-text" role="alert">
                    {passwordError}
                  </p>
                )}

                <div className="profile-password-actions">
                  <button className="btn" type="submit" disabled={passwordSaving}>
                    <Check size={16} />
                    {passwordSaving ? 'Memverifikasi & Menyimpan…' : 'Perbarui Password'}
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={passwordSaving}
                    onClick={() => {
                      setShowPasswordForm(false);
                      setOldPassword('');
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setPasswordError('');
                    }}
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}
            </section>
          </div>
        </div>
      </main>
    </Shell>
  );
}
