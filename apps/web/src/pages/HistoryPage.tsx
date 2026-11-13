import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { listEntries } from '../firestore/entryRepository';
import type { FoodEntry } from '../firestore/types';

export default function HistoryPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void listEntries(user.uid)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">F-11</p>
      <h1 className="mt-1 text-3xl font-bold">Riwayat</h1>
      {loading && <p className="mt-6 text-slate-600">Memuat riwayat…</p>}
      {!loading && entries.length === 0 && (
        <p className="mt-6 rounded-2xl bg-slate-100 p-5 text-slate-600">
          Belum ada entri. Mulai dari Scan.
        </p>
      )}
      <div className="mt-6 space-y-3">
        {entries.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{entry.namaProduk ?? entry.jenisProduk}</h2>
                <p className="text-sm text-slate-600">
                  {entry.nSajian} sajian · {entry.status}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                {entry.hasilSnapshot.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{entry.hasilSnapshot.reasons[0]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
