import { useEffect, useMemo, useState } from 'react';
import { Camera, PencilLine } from 'lucide-react';
import { useNavigate } from 'react-router';
import { computeDailyLimits } from '@nutri-lab/scoring';
import Shell from '../components/layout/Shell';
import { useAuth } from '../auth/useAuth';
import { listEntries } from '../firestore/entryRepository';
import { getProfile } from '../firestore/profileRepository';
import type { FoodEntry } from '../firestore/types';
import { toActivity } from '../lib/foodEntryPresentation';

const format = (value: number) => value.toFixed(1).replace('.', ',');

function Meter({
  value,
  max,
  tone = 'primary',
}: {
  value: number;
  max: number;
  tone?: 'primary' | 'secondary' | 'tertiary' | 'warn' | 'danger';
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`bar bar-${tone}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
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
  const totals = useMemo(
    () =>
      entries.reduce(
        (total, entry) => {
          const eaten = entry.hasilSnapshot.normalized?.eaten;
          return {
            sugar: total.sugar + (eaten?.gulaG ?? 0),
            fat: total.fat + (eaten?.lemakJenuhG ?? 0),
          };
        },
        { sugar: 0, fat: 0 },
      ),
    [entries],
  );
  const left = Math.max(0, limits.sugarG - totals.sugar);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(new Date()),
    [],
  );

  const isOverLimit = totals.sugar > limits.sugarG || totals.fat > limits.saturatedFatG;
  const isNearLimit =
    !isOverLimit &&
    (totals.sugar >= limits.sugarG * 0.8 || totals.fat >= limits.saturatedFatG * 0.8);

  const statusTone = isOverLimit ? 'danger' : isNearLimit ? 'warn' : 'safe';
  const statusLabel = isOverLimit ? 'Melebihi batas' : isNearLimit ? 'Hampir penuh' : 'Dalam batas aman';
  const sugarTone =
    totals.sugar > limits.sugarG ? 'danger' : totals.sugar >= limits.sugarG * 0.8 ? 'warn' : 'primary';
  const fatTone =
    totals.fat > limits.saturatedFatG
      ? 'danger'
      : totals.fat >= limits.saturatedFatG * 0.8
        ? 'warn'
        : 'tertiary';

  return (
    <Shell tabs tab="home">
      <main className="page">
        <div className="dashboard-layout">
          <section className="card dashboard-card">
            <header className="row dashboard-head">
              <h2>Dompet Koin Gizi</h2>
              <span className="dashboard-date">Hari ini, {todayLabel}</span>
            </header>

            <div className="hero-figure">
              <div className="metric-value-row">
                <span className="metric-value">{format(left)}</span>
                <span className="metric-unit">g gula tersisa</span>
              </div>
              <span className={`status-inline ${statusTone}`}>
                <span className="status-dot" aria-hidden="true" />
                {statusLabel}
              </span>
            </div>

            <div className="meters-group">
              <div className="meter-item">
                <div className="row meter-head">
                  <span className="meter-label">Gula Harian</span>
                  <span className="meter-amount">
                    {format(totals.sugar)} <small>/ {format(limits.sugarG)} g</small>
                  </span>
                </div>
                <Meter value={totals.sugar} max={limits.sugarG} tone={sugarTone} />
              </div>

              <div className="meter-item">
                <div className="row meter-head">
                  <span className="meter-label">Lemak Jenuh</span>
                  <span className="meter-amount">
                    {format(totals.fat)} <small>/ {format(limits.saturatedFatG)} g</small>
                  </span>
                </div>
                <Meter value={totals.fat} max={limits.saturatedFatG} tone={fatTone} />
              </div>
            </div>
          </section>

          <div className="row action-row quick-actions">
            <button className="btn" onClick={() => navigate('/scan')}>
              <Camera size={16} /> Scan Makanan
            </button>
            <button className="btn secondary" onClick={() => navigate('/scan?manual=1')}>
              <PencilLine size={16} /> Input Manual
            </button>
          </div>

          <section className="card recent-card">
            <div className="row recent-head">
              <h2>Aktivitas Terakhir</h2>
              <button className="link-button recent-link" onClick={() => navigate('/riwayat')}>
                Lihat semua
              </button>
            </div>
            {error && (
              <p className="small error-text" role="alert">
                {error}
              </p>
            )}
            <div className="history-list">
              {activities.slice(0, 3).map((activity, index) => (
                <article key={`${activity.name}-${index}`} className="history-item">
                  <span className={`score-badge score-${activity.score.toLowerCase()}`}>{activity.score}</span>
                  <div className="history-copy">
                    <div className="history-name">{activity.name}</div>
                    <div className="small history-detail">{activity.detail}</div>
                  </div>
                  <span className={`badge ${activity.status === 'Dimakan' ? 'ok' : 'neutral'}`}>{activity.status}</span>
                </article>
              ))}
            </div>
            {!activities.length && <div className="empty-state">Belum ada catatan makanan hari ini.</div>}
          </section>
        </div>
      </main>
    </Shell>
  );
}
