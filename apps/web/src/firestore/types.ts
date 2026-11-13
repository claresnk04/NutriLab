import type { AssessmentResult } from '@nutri-lab/scoring';
import type { ExtractionResponse } from '../schemas/extraction';

export type EntryStatus = 'dicek' | 'dimakan';

export interface UserProfile {
  jenisKelamin?: 'M' | 'F';
  beratKg?: number;
  tinggiCm?: number;
  usia?: number;
  aktivitas?: 'istirahat' | 'ringan' | 'sedang' | 'berat' | 'sangat_berat';
  targetKaloriManual?: number;
}

export interface FoodEntry {
  id?: string;
  uid: string;
  namaProduk?: string;
  jenisProduk: string;
  basisTabel: string;
  nilaiLabel: ExtractionResponse;
  nSajian: number;
  status: EntryStatus;
  waktuMakan?: string;
  zonaWaktu: string;
  dikonfirmasiPengguna: boolean;
  hasilSnapshot: AssessmentResult;
  configVersion: string;
  dibuatPada?: Date;
  diubahPada?: Date;
  dihapusPada?: Date | null;
}

export interface DailyAggregate {
  tanggal: string;
  totalGula: number;
  totalKarbo: number;
  totalLemakJenuh: number;
  totalNatrium: number;
  totalEnergi: number;
  jumlahEntri: number;
}
