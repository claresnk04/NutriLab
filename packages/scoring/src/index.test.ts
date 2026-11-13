import { describe, expect, it } from 'vitest';
import { ALGORITHM_VERSION, computeDailyLimits, evaluate } from './index';

describe('scoring skeleton', () => {
  it('melaporkan versi algoritma v0.3', () => {
    expect(ALGORITHM_VERSION).toBe('0.3');
  });

  it('menolak data label yang belum lengkap', () => {
    const result = evaluate({});
    expect(result.status).toBe('tidak_dapat_dinilai');
  });

  it('menggunakan target kalori manual untuk batas harian', () => {
    const limits = computeDailyLimits({ targetKaloriManual: 1600 });
    expect(limits.source).toBe('manual');
    expect(limits.energyKkal).toBe(1600);
    expect(limits.sugarG).toBe(20);
  });

  it('menghasilkan alasan yang dapat dijelaskan untuk produk tinggi gula', () => {
    const result = evaluate({
      profile: { targetKaloriManual: 1800 },
      servings: 1,
      product: {
        jenisProduk: 'makanan',
        basisTabel: 'per_sajian',
        energiKkal: 240,
        lemakTotalG: 4,
        lemakJenuhG: 2,
        proteinG: 3,
        karbohidratG: 30,
        gulaG: 18,
        natriumMg: 120,
      },
      confirmedWarnings: true,
    });

    expect(result.status).toMatch(/hijau|kuning|merah/);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.limits?.energyKkal).toBe(1800);
  });
});
