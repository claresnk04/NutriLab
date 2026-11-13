import { useMemo, useState } from 'react';
import { CircleCheck, UserRound, UserRoundCheck } from 'lucide-react';
import Shell from './Shell';
import type { Nav } from './types';

type Sex = 'P' | 'L';
const KCAL_PER_KG: Record<Sex, number> = { P: 25, L: 30 };

export default function Profile({ go }: Nav) {
  const [sex, setSex] = useState<Sex>('P');
  const [kg, setKg] = useState<number>(60);

  const r = useMemo(() => {
    const kcal = Math.round(kg * KCAL_PER_KG[sex]);
    return { kcal, sugar: (kcal * 0.05) / 4, satFat: (kcal * 0.07) / 9 };
  }, [sex, kg]);
  const f = (n: number) => n.toFixed(1).replace('.', ',');

  return (
    <Shell>
      <main className="page narrow">
          <div className="row profile-header" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
          <span>Langkah 2 dari 2: Profil Khusus</span>
          <button className="link-button" onClick={() => go('home')}>Lewati Dulu</button>
        </div>
        <section className="card profile-card">
          <h2>Sesuaikan Batas Gizi</h2>
          <p style={{ margin: 0 }}>Dihitung menggunakan algoritma Pedoman Pengelolaan DM2 <b>PERKENI</b> agar jatah gula dan lemak sesuai fisik Anda.</p>

          <div className="field">
            <span>Jenis Kelamin Biologis</span>
            <div className="profile-sex-grid">
              {([['P', 'Perempuan 25 kkal/kg', UserRound], ['L', 'Laki-laki 30 kkal/kg', UserRoundCheck]] as const).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={sex === k}
                  onClick={() => setSex(k)}
                  className={`profile-sex-card ${sex === k ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Berat Badan Saat Ini</span>
            <span className="input profile-weight-input">
              <input type="number" min={30} max={250} value={kg} onChange={(e) => setKg(Math.max(0, Number(e.target.value)))} />
              <b>kg</b>
            </span>
          </label>

          <span className="small">Kebutuhan kalori basal dihitung otomatis berdasarkan berat badan aktual.</span>

          <div className="tile profile-result-wrap" style={{ background: 'var(--color-surface-mint)' }}>
            <div className="small profile-result-title">HASIL REKOMENDASI PERKENI</div>
            <div className="profile-result-grid">
              {[
                ['Energi Harian', `${r.kcal}`, 'kkal'],
                ['Batas Gula', f(r.sugar), 'gram/hari'],
                ['Lemak Jenuh', f(r.satFat), 'gram/hari'],
              ].map(([label, value, unit]) => (
                <div key={label} className="tile profile-result-card">
                  <div className="small">{label}</div>
                  <b>{value}</b>
                  <div className="small">{unit}</div>
                </div>
              ))}
            </div>
          </div>

          <button className="btn" onClick={() => go('home')}>Simpan &amp; Masuk ke Home <CircleCheck size={18} /></button>
        </section>
      </main>
    </Shell>
  );
}
