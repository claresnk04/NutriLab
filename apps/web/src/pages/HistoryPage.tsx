import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Shell from '../components/layout/Shell';
import { useAuth } from '../auth/useAuth';
import { listEntries, softDeleteEntry } from '../firestore/entryRepository';
import type { FoodEntry } from '../firestore/types';
import { toActivity } from '../lib/foodEntryPresentation';

type Filter = 'Semua' | 'Dimakan' | 'Cek Saja';

export default function HistoryPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('Semua');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    void listEntries(user.uid)
      .then(setEntries)
      .catch(() => setError('Riwayat belum dapat dimuat.'));
  }, [user]);

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        if (filter === 'Semua') return true;
        return filter === 'Dimakan' ? entry.status === 'dimakan' : entry.status === 'dicek';
      }),
    [entries, filter],
  );

  async function removeEntry(entry: FoodEntry) {
    if (!user || !entry.id) return;
    await softDeleteEntry(user.uid, entry.id);
    setEntries((current) => current.filter((item) => item.id !== entry.id));
  }

  return (
    <Shell tabs tab="riwayat">
      <main className="page">
        <section className="card history-page">
          <div className="row page-title-row">
            <div>
              <span className="eyebrow">CATATAN HARIAN</span>
              <h2>Riwayat Catatan</h2>
            </div>
          </div>
          {error && (
            <p className="small error-text" role="alert">
              {error}
            </p>
          )}
          <div className="filter-pills">
            {(['Semua', 'Dimakan', 'Cek Saja'] as const).map((item) => (
              <button
                key={item}
                className={filter === item ? 'active' : ''}
                onClick={() => setFilter(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <div className="history-list">
            {filtered.map((entry) => {
              const activity = toActivity(entry);
              return (
                <article key={entry.id} className="tile row history-item">
                  <span className={`score-badge score-${activity.score.toLowerCase()}`}>
                    {activity.score}
                  </span>
                  <div className="history-copy">
                    <div className="history-name">{activity.name}</div>
                    <div className="small">{activity.detail}</div>
                  </div>
                  <span className={`badge ${activity.status === 'Dimakan' ? 'ok' : 'neutral'}`}>
                    {activity.status}
                  </span>
                  <button
                    className="danger-link"
                    title="Hapus catatan"
                    onClick={() => void removeEntry(entry)}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              );
            })}
          </div>
          {!filtered.length && (
            <div className="empty-state">Belum ada catatan untuk filter ini.</div>
          )}
        </section>
      </main>
    </Shell>
  );
}
