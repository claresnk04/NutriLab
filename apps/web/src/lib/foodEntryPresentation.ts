import type { FoodEntry } from '../firestore/types';

export type FoodScore = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Activity {
  name: string;
  detail: string;
  status: 'Dimakan' | 'Dicek Saja';
  score: FoodScore;
}

export function scoreFor(entry: FoodEntry): FoodScore {
  switch (entry.hasilSnapshot.status) {
    case 'hijau': return 'A';
    case 'kuning': return 'C';
    case 'merah': return 'E';
    default: return 'D';
  }
}

export function toActivity(entry: FoodEntry): Activity {
  const sugar = entry.hasilSnapshot.normalized?.eaten.gulaG ?? entry.nilaiLabel.gizi.gula_g.nilai ?? 0;
  return {
    name: entry.namaProduk || 'Produk tanpa nama',
    detail: `Porsi: ${entry.nSajian} • ${sugar.toFixed(1).replace('.', ',')} g Gula`,
    status: entry.status === 'dimakan' ? 'Dimakan' : 'Dicek Saja',
    score: scoreFor(entry),
  };
}
