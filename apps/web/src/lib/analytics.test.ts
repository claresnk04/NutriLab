import type { FoodEntry } from '../firestore/types';
import { averageDailySugar, buildAnalyticsData, entrySugar } from './analytics';

function entry(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'user-1',
    jenisProduk: 'makanan',
    basisTabel: 'per_sajian',
    nilaiLabel: { gizi: { gula_g: { nilai: 10 } } },
    nSajian: 1,
    status: 'dimakan',
    waktuMakan: '2026-11-15T10:00:00.000Z',
    zonaWaktu: 'Asia/Jakarta',
    dikonfirmasiPengguna: true,
    hasilSnapshot: { normalized: { eaten: { gulaG: 10 } } },
    configVersion: 'test',
    ...overrides,
  } as unknown as FoodEntry;
}

describe('analytics aggregation', () => {
  it('only aggregates entries marked as eaten', () => {
    const points = buildAnalyticsData(
      [entry(), entry({ status: 'dicek', nilaiLabel: { gizi: { gula_g: { nilai: 99 } } } })],
      '7 Hari',
      new Date('2026-11-15T12:00:00+07:00'),
    );

    expect(averageDailySugar(points)).toBe(10);
  });

  it('falls back to label sugar and servings when normalized data is absent', () => {
    expect(
      entrySugar(
        entry({
          nSajian: 2,
          nilaiLabel: { gizi: { gula_g: { nilai: 12 } } },
          hasilSnapshot: {},
        }),
      ),
    ).toBe(24);
  });

  it('uses only days with records for the daily average', () => {
    const points = buildAnalyticsData([entry()], '30 Hari', new Date('2026-11-15T12:00:00+07:00'));

    expect(points).toHaveLength(30);
    expect(points.filter((point) => point.hasEntries)).toHaveLength(1);
    expect(averageDailySugar(points)).toBe(10);
  });
});
