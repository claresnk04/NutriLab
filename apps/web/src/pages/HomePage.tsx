import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Camera, CircleCheck, Dot, Droplet, PencilLine } from 'lucide-react';
import { useNavigate } from 'react-router';
import { computeDailyLimits } from '@nutri-lab/scoring';
import Shell from '../components/layout/Shell';
import { useAuth } from '../auth/useAuth';
import { listEntries } from '../firestore/entryRepository';
import { getProfile } from '../firestore/profileRepository';
import type { FoodEntry } from '../firestore/types';
import { toActivity } from '../lib/foodEntryPresentation';

const format = (value: number) => value.toFixed(1).replace('.', ',');

function Meter({ value, max }: { value: number; max: number }) {
  return <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemax={max}><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfile>>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    void Promise.all([listEntries(user.uid), getProfile(user.uid)])
      .then(([nextEntries, nextProfile]) => {
        setEntries(nextEntries);
        setProfile(nextProfile);
      })
      .catch(() => setError('Data aktivitas belum dapat dimuat.'));
  }, [user]);

  const limits = useMemo(() => computeDailyLimits(profile), [profile]);
  const activities = useMemo(() => entries.map(toActivity), [entries]);
  const totals = useMemo(() => entries.reduce((total, entry) => {
    const eaten = entry.hasilSnapshot.normalized?.eaten;
    return {
      sugar: total.sugar + (eaten?.gulaG ?? 0),
      fat: total.fat + (eaten?.lemakJenuhG ?? 0),
    };
  }, { sugar: 0, fat: 0 }), [entries]);
  const left = Math.max(0, limits.sugarG - totals.sugar);

  return (
    <Shell tabs tab="home">
      <main className="page">
        <div className="dashboard-layout">
          <section className="card dashboard-card">
            <div className="row dashboard-head"><div><div className="small dashboard-label">Sisa Jatah Hari Ini</div><h2>Dompet Koin Gizi</h2></div><span className="pill dashboard-pill"><CalendarDays size={16} /> Hari Ini</span></div>
            <div className="metric-stack">
              <article className="metric-card metric-card-primary"><div className="row metric-head"><div className="metric-title"><Droplet size={18} /> Koin Gula Harian</div><span className="status-chip safe">Aman</span></div><div className="metric-value-row"><span className="metric-value">{format(left)}</span><span className="metric-unit">g</span></div><div className="small metric-caption">Sisa kuota dari {format(limits.sugarG)} g</div><Meter value={totals.sugar} max={limits.sugarG} /><div className="row metric-meta"><span>Terpakai: {format(totals.sugar)} g</span><span>{Math.round((left / limits.sugarG) * 100)}%</span></div></article>
              <article className="metric-card"><div className="row metric-head"><div className="metric-title"><Dot /> Lemak Jenuh</div><span className="metric-number">{format(totals.fat)} / {format(limits.saturatedFatG)} g</span></div><Meter value={totals.fat} max={limits.saturatedFatG} /></article>
              <article className="metric-card status-card"><div className="metric-title"><CircleCheck size={18} /> Kondisi Terjaga</div><div className="status-text">Pola makanmu hari ini tetap dalam batas aman PERKENI.</div></article>
            </div>
          </section>
          <div className="row action-row quick-actions"><button className="btn" onClick={() => navigate('/scan')}><Camera size={18} /> Scan Makanan</button><button className="btn ghost" onClick={() => navigate('/scan?manual=1')}><PencilLine size={18} /> Input Manual</button></div>
          <section className="card recent-card"><div className="row recent-head"><h2>Aktivitas Terakhir</h2><button className="link-button" onClick={() => navigate('/riwayat')}>Lihat Semua</button></div>{error && <p className="small error-text" role="alert">{error}</p>}<div className="history-list">{activities.slice(0, 3).map((activity, index) => <article key={`${activity.name}-${index}`} className="tile row history-item"><span className={`score-badge score-${activity.score.toLowerCase()}`}>{activity.score}</span><div className="history-copy"><div className="history-name">{activity.name}</div><div className="small">{activity.detail}</div></div><span className={`badge ${activity.status === 'Dimakan' ? 'ok' : 'neutral'}`}>{activity.status}</span></article>)}</div>{!activities.length && <div className="empty-state">Belum ada catatan makanan.</div>}</section>
        </div>
      </main>
    </Shell>
  );
}
