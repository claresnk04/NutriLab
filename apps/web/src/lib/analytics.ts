import type { FoodEntry } from '../firestore/types';

export type AnalyticsRange = '7 Hari' | '30 Hari';

export interface AnalyticsPoint {
  key: string;
  day: string;
  sugar: number;
  hasEntries: boolean;
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== 'string' || !value.trim()) return undefined;

  const raw = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function entryDateKey(entry: FoodEntry) {
  return dateKey(parseDate(entry.waktuMakan) ?? entry.dibuatPada ?? new Date(0));
}

export function entrySugar(entry: FoodEntry) {
  const normalizedSugar = finiteNumber(entry.hasilSnapshot.normalized?.eaten.gulaG);
  if (normalizedSugar !== null) return Math.max(0, normalizedSugar);

  const labelSugar = finiteNumber(entry.nilaiLabel.gizi.gula_g.nilai);
  if (labelSugar === null) return 0;
  return Math.max(0, labelSugar * (finiteNumber(entry.nSajian) ?? 1));
}

export function buildAnalyticsData(
  entries: FoodEntry[],
  range: AnalyticsRange,
  today = new Date(),
): AnalyticsPoint[] {
  const dayCount = range === '7 Hari' ? 7 : 30;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (dayCount - 1 - index));
    return {
      key: dateKey(date),
      day:
        range === '7 Hari'
          ? date.toLocaleDateString('id-ID', { weekday: 'short' })
          : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      sugar: 0,
      hasEntries: false,
    };
  });

  for (const entry of entries) {
    if (entry.status !== 'dimakan') continue;
    const day = days.find((item) => item.key === entryDateKey(entry));
    if (!day) continue;
    day.sugar += entrySugar(entry);
    day.hasEntries = true;
  }

  return days;
}

export function averageDailySugar(points: AnalyticsPoint[]) {
  const recordedDays = points.filter((point) => point.hasEntries);
  if (!recordedDays.length) return 0;
  return recordedDays.reduce((sum, point) => sum + point.sugar, 0) / recordedDays.length;
}
