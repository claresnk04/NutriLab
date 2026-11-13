import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, UserRound, UserRoundCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import Shell from '../components/layout/Shell';
import { useAuth } from '../auth/useAuth';
import { getProfile, saveProfile } from '../firestore/profileRepository';

type Sex = 'P' | 'L';
const KCAL_PER_KG: Record<Sex, number> = { P: 25, L: 30 };

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sex, setSex] = useState<Sex>('P');
  const [kg, setKg] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    void getProfile(user.uid).then((profile) => {
      if (profile.jenisKelamin) setSex(profile.jenisKelamin === 'F' ? 'P' : 'L');
      if (profile.beratKg) setKg(profile.beratKg);
    });
  }, [user]);

  const recommendation = useMemo(() => {
    const kcal = Math.round(kg * KCAL_PER_KG[sex]);
    return { kcal, sugar: (kcal * 0.05) / 4, satFat: (kcal * 0.07) / 9 };
  }, [kg, sex]);

  async function save() {
    if (!user || kg < 30 || kg > 250) return;
    setSaving(true);
    setError('');
    try {
      await saveProfile(user.uid, {
        jenisKelamin: sex === 'P' ? 'F' : 'M',
        beratKg: kg,
        targetKaloriManual: kg * KCAL_PER_KG[sex],
      });
      navigate('/');
    } catch {
      setError('Profil belum dapat disimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  const format = (value: number) => value.toFixed(1).replace('.', ',');

  return (
    <Shell>
      <main className="page narrow">
        <div className="row profile-header" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
          <span>Langkah 2 dari 2: Profil Khusus</span>
          <button className="link-button" onClick={() => navigate('/')} type="button">Lewati Dulu</button>
        </div>
        <section className="card profile-card">
          <h2>Sesuaikan Batas Gizi</h2>
          <p style={{ margin: 0 }}>Dihitung menggunakan algoritma Pedoman Pengelolaan DM2 <b>PERKENI</b> agar jatah gula dan lemak sesuai fisik Anda.</p>
          <div className="field">
            <span>Jenis Kelamin Biologis</span>
            <div className="profile-sex-grid">
              {([['P', 'Perempuan 25 kkal/kg', UserRound], ['L', 'Laki-laki 30 kkal/kg', UserRoundCheck]] as const).map(([key, label, Icon]) => (
                <button key={key} type="button" aria-pressed={sex === key} onClick={() => setSex(key)} className={`profile-sex-card ${sex === key ? 'active' : ''}`}>
                  <Icon size={18} /><span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Berat Badan Saat Ini</span>
            <span className="input profile-weight-input">
              <input type="number" min={30} max={250} value={kg} onChange={(event) => setKg(Number(event.target.value))} />
              <b>kg</b>
            </span>
          </label>
          <span className="small">Kebutuhan kalori basal dihitung otomatis berdasarkan berat badan aktual.</span>
          <div className="tile profile-result-wrap" style={{ background: 'var(--color-surface-mint)' }}>
            <div className="small profile-result-title">HASIL REKOMENDASI PERKENI</div>
            <div className="profile-result-grid">
              {[
                ['Energi Harian', `${recommendation.kcal}`, 'kkal'],
                ['Batas Gula', format(recommendation.sugar), 'gram/hari'],
                ['Lemak Jenuh', format(recommendation.satFat), 'gram/hari'],
              ].map(([label, value, unit]) => (
                <div key={label} className="tile profile-result-card"><div className="small">{label}</div><b>{value}</b><div className="small">{unit}</div></div>
              ))}
            </div>
          </div>
          {error && <span className="small error-text" role="alert">{error}</span>}
          <button className="btn" onClick={() => void save()} disabled={saving} type="button">
            {saving ? 'Menyimpan…' : 'Simpan & Masuk ke Home'} <CircleCheck size={18} />
          </button>
        </section>
      </main>
    </Shell>
  );
}
