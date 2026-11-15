import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, Trash2, Utensils } from 'lucide-react';
import Shell from '../components/layout/Shell';
import { useAuth } from '../auth/useAuth';
import { listEntries, softDeleteEntry } from '../firestore/entryRepository';
import type { FoodEntry } from '../firestore/types';
import { toActivity } from '../lib/foodEntryPresentation';
import type { ExtractionResponse } from '../schemas/extraction';

type Filter = 'Semua' | 'Dimakan' | 'Cek Saja';

const nutritionRows = [
  { label: 'Energi', key: 'energiKkal', labelKey: 'energi_kkal', unit: 'kkal' },
  { label: 'Lemak total', key: 'lemakTotalG', labelKey: 'lemak_total_g', unit: 'g' },
  { label: 'Lemak jenuh', key: 'lemakJenuhG', labelKey: 'lemak_jenuh_g', unit: 'g' },
  { label: 'Protein', key: 'proteinG', labelKey: 'protein_g', unit: 'g' },
  { label: 'Karbohidrat', key: 'karbohidratG', labelKey: 'karbohidrat_g', unit: 'g' },
  { label: 'Gula', key: 'gulaG', labelKey: 'gula_g', unit: 'g' },
  { label: 'Serat', key: 'seratG', labelKey: 'serat_g', unit: 'g' },
  { label: 'Laktosa', key: 'laktosaG', labelKey: 'laktosa_g', unit: 'g' },
  { label: 'Natrium', key: 'natriumMg', labelKey: 'natrium_mg', unit: 'mg' },
] as const;

const basisLabels: Record<string, string> = {
  per_sajian: 'per sajian',
  per_kemasan: 'per kemasan',
  per_100: 'per 100 g/ml',
  tidak_diketahui: 'basis tidak diketahui',
};

function nutrientValue(entry: FoodEntry, key: string, labelKey: keyof ExtractionResponse['gizi']) {
  const normalized = entry.hasilSnapshot.normalized?.eaten[key];
  if (typeof normalized === 'number' && Number.isFinite(normalized)) return normalized;

  const labelValue = entry.nilaiLabel.gizi[labelKey].nilai;
  if (typeof labelValue !== 'number' || !Number.isFinite(labelValue)) return null;
  return labelValue * (entry.nSajian || 1);
}

function formatNutrient(value: number | null, unit: string) {
  if (value === null) return '—';
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} ${unit}`;
}

function formatMealDate(entry: FoodEntry) {
  const source = entry.waktuMakan ? new Date(entry.waktuMakan) : entry.dibuatPada;
  if (!source || Number.isNaN(source.getTime())) return 'Waktu konsumsi tidak tersedia';

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  };
  if (entry.zonaWaktu) options.timeZone = entry.zonaWaktu;

  try {
    return new Intl.DateTimeFormat('id-ID', options).format(source);
  } catch {
    delete options.timeZone;
    return new Intl.DateTimeFormat('id-ID', options).format(source);
  }
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('Semua');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
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
    setExpandedEntries((current) => {
      const next = new Set(current);
      next.delete(entry.id as string);
      return next;
    });
  }

  function toggleDetails(entryId: string) {
    setExpandedEntries((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
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
            {filtered.map((entry, index) => {
              const activity = toActivity(entry);
              const entryKey = entry.id ?? `${entry.uid}-${index}`;
              const expanded = expandedEntries.has(entryKey);
              const detailId = `history-detail-${index}`;
              return (
                <article
                  key={entryKey}
                  className={`tile history-item ${expanded ? 'is-expanded' : ''}`}
                >
                  <div className="row history-summary">
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
                      className="history-expand-btn"
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={detailId}
                      aria-label={expanded ? 'Sembunyikan detail' : 'Tampilkan detail'}
                      title={expanded ? 'Sembunyikan detail' : 'Tampilkan detail'}
                      onClick={() => toggleDetails(entryKey)}
                    >
                      {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <button
                      className="danger-link"
                      title="Hapus catatan"
                      onClick={() => void removeEntry(entry)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {expanded && (
                    <div className="history-detail-panel" id={detailId}>
                      <div className="history-meta">
                        <span>
                          <Clock3 size={15} />
                          {formatMealDate(entry)}
                        </span>
                        <span>
                          <Utensils size={15} />
                          {entry.nSajian} porsi •{' '}
                          {basisLabels[entry.basisTabel] ?? entry.basisTabel}
                        </span>
                      </div>
                      <div className="history-nutrition-grid">
                        {nutritionRows.map((row) => (
                          <div className="history-nutrition-item" key={row.key}>
                            <span>{row.label}</span>
                            <strong>
                              {formatNutrient(
                                nutrientValue(entry, row.key, row.labelKey),
                                row.unit,
                              )}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
