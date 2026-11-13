import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Shell from '../components/layout/Shell';
import { useAuth } from '../auth/useAuth';
import { listEntries } from '../firestore/entryRepository';
import type { FoodEntry } from '../firestore/types';
import { scoreFor } from '../lib/foodEntryPresentation';

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function entryDateKey(entry: FoodEntry) {
  if (entry.waktuMakan) {
    const mealDate = new Date(entry.waktuMakan);
    if (!Number.isNaN(mealDate.getTime())) return dateKey(mealDate);
  }
  return entry.dibuatPada ? dateKey(entry.dibuatPada) : undefined;
}

function entrySugar(entry: FoodEntry) {
  const eatenSugar = entry.hasilSnapshot.normalized?.eaten.gulaG;
  if (typeof eatenSugar === 'number' && Number.isFinite(eatenSugar)) return eatenSugar;
  return (entry.nilaiLabel.gizi.gula_g.nilai ?? 0) * (entry.nSajian || 1);
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [range, setRange] = useState<'7 Hari' | '30 Hari'>('7 Hari');

  useEffect(() => {
    if (!user) return;
    void listEntries(user.uid).then(setEntries);
  }, [user]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: range === '7 Hari' ? 7 : 30 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (range === '7 Hari' ? 6 - index : 29 - index));
      const day =
        range === '7 Hari'
          ? date.toLocaleDateString('id-ID', { weekday: 'short' })
          : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      return { key: dateKey(date), day, sugar: 0 };
    });
    for (const entry of entries) {
      const day = days.find((item) => item.key === entryDateKey(entry));
      if (day) day.sugar += entrySugar(entry);
    }
    return days;
  }, [entries, range]);

  const average = chartData.length ? chartData.reduce((sum, item) => sum + item.sugar, 0) / chartData.length : 0;
  const frequent = useMemo(() => {
    const counts = new Map<string, { count: number; score: ReturnType<typeof scoreFor> }>();
    entries.forEach((entry) => {
      const current = counts.get(entry.namaProduk ?? 'Produk tanpa nama');
      counts.set(entry.namaProduk ?? 'Produk tanpa nama', { count: (current?.count ?? 0) + 1, score: scoreFor(entry) });
    });
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 3);
  }, [entries]);

  return (
    <Shell tabs tab="analitik">
      <main className="page">
        <div className="grid analysis-page">
          <div className="row page-title-row"><div><span className="eyebrow">PEMANTAUAN</span><h2>Analisis Asupan</h2></div><div className="seg compact-seg">{(['7 Hari', '30 Hari'] as const).map((item) => <button key={item} className={range === item ? 'on' : ''} onClick={() => setRange(item)} type="button">{item}</button>)}</div></div>
          <section className="analysis-hero"><div className="eyebrow light">RATA-RATA HARIAN</div><div className="analysis-number">{average.toFixed(1).replace('.', ',')} <small>g gula</small></div><p>Data dihitung dari catatan makanan yang tersimpan di akun Anda.</p><div className="analysis-safe"><TrendingUp size={18} /> Catatan aktif • {range}</div></section>
          <section className="card"><div className="row"><h3>Tren Asupan Gula</h3><span className="small">gram</span></div><div className="chart"><ResponsiveContainer width="100%" height={190}><LineChart data={chartData} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}><XAxis dataKey="day" interval={range === '30 Hari' ? 4 : 0} minTickGap={12} tick={{ fontSize: range === '30 Hari' ? 10 : 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [`${Number(value).toFixed(1)} g`, 'Gula']} /><Line type="monotone" dataKey="sugar" stroke="var(--color-nutri-teal)" strokeWidth={3} dot={{ fill: 'var(--color-nutri-teal)', r: 4 }} /></LineChart></ResponsiveContainer></div></section>
          <section className="card top-foods"><h3>3 Makanan Paling Sering</h3>{frequent.map(([name, value], index) => <div className="ranking-row" key={name}><b>{index + 1}</b><span className={`score-badge score-${value.score.toLowerCase()}`}>{value.score}</span><strong>{name}</strong><span className="small">{value.count} kali</span></div>)}{!frequent.length && <div className="empty-state">Belum ada data makanan.</div>}</section>
        </div>
      </main>
    </Shell>
  );
}
