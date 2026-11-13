import { describe, expect, it } from 'vitest';
import { groupLinesByRow, parseNumber, parseNutritionLines } from './parser';

describe('groupLinesByRow', () => {
  it('menggabungkan kotak kolom kiri (nama gizi) dan kolom kanan (angka) pada baris Y yang sejajar', () => {
    const rows = groupLinesByRow([
      { text: '5 g', score: 0.92, box: [220, 42, 260, 58] },
      { text: 'Lemak Total', score: 0.96, box: [20, 40, 130, 60] },
      { text: '8%', score: 0.9, box: [310, 41, 340, 59] },
      { text: 'Gula Total', score: 0.95, box: [20, 90, 120, 110] },
      { text: '7 g', score: 0.94, box: [220, 92, 255, 108] },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].text).toBe('Lemak Total 5 g 8%');
    expect(rows[1].text).toBe('Gula Total 7 g');
  });
});

describe('parseNumber', () => {
  it('memprioritaskan angka dengan satuan gizi dibanding angka % AKG dan mengoreksi salah baca O/l/9/q', () => {
    expect(parseNumber('Lemak Total 5 g 8%')).toBe(5);
    expect(parseNumber('Energi Total 14O kkal', 'energi_kkal')).toBe(140);
    expect(parseNumber('Natrium 9O mg 6%')).toBe(90);
    expect(parseNumber('Karbohidrat Total l5 g 5%')).toBe(15);
    expect(parseNumber('LemaktotalOg0%', 'lemak_total_g')).toBe(0);
    expect(parseNumber('Gula49', 'gula_g')).toBe(4);
    expect(parseNumber('Gula4gn', 'gula_g')).toBe(4);
    expect(parseNumber('Takaransaji:12q(1n0')).toBe(12);
    expect(parseNumber('LemakTotalTotalFat) 486%', 'lemak_total_g')).toBe(4);
    expect(parseNumber('Protein 6810%', 'protein_g')).toBe(6);
    expect(parseNumber('Gula(Sugars) 198', 'gula_g')).toBe(19);
    expect(parseNumber('TakaranSaj20orn(1Kotakj')).toBe(200);
    expect(parseNumber('Lemakjenuhi5g8%', 'lemak_jenuh_g')).toBe(1.5);
    expect(parseNumber('Protein47%', 'protein_g')).toBe(4);
    expect(parseNumber('KarbohidratTotal144%', 'karbohidrat_g')).toBe(14);
    expect(parseNumber('LemakJenuh/SaturatedFat 2E9%', 'lemak_jenuh_g')).toBe(2);
    expect(parseNumber('Garam(Natrium)30mng1%', 'natrium_mg')).toBe(30);
  });
});

describe('parseNutritionLines', () => {
  it('membaca label miring dengan teks rapat tanpa spasi dan mengabaikan catatan kaki AKG 2150 kkal', () => {
    const result = parseNutritionLines([
      { text: 'INFORMASINILAIGIZ', score: 0.96, slope: 0.068, box: [59, 12, 214, 48] },
      { text: 'Takaransaji:12q(1n0', score: 0.82, slope: 0.068, box: [42, 39, 218, 59] },
      { text: '28SajianperKemasan', score: 0.98, slope: 0.068, box: [37, 56, 164, 79] },
      { text: 'JUMLAHPERSAJIAN', score: 0.98, slope: 0.068, box: [36, 79, 218, 100] },
      { text: 'Energitotal25kal', score: 0.98, slope: 0.068, box: [34, 97, 218, 120] },
      { text: 'LemaktotalOg0%', score: 0.89, slope: 0.068, box: [28, 137, 218, 160] },
      { text: 'Lemakjenuh0g0%', score: 0.91, slope: 0.068, box: [28, 157, 218, 180] },
      { text: 'Protein0g0%', score: 0.89, slope: 0.068, box: [25, 176, 218, 197] },
      { text: 'Karbohidrattotal5g2%', score: 0.96, slope: 0.068, box: [23, 194, 218, 216] },
      { text: 'Gula4gn', score: 0.8, slope: 0.068, box: [20, 215, 218, 235] },
      { text: 'Garamnatrium)270mg18%', score: 0.91, slope: 0.068, box: [17, 232, 218, 255] },
      {
        text: 'PersenAKGberdasarkankebutuhan',
        score: 0.85,
        slope: 0.068,
        box: [15, 256, 214, 286],
      },
      { text: 'energi2150kkal.', score: 0.99, slope: 0.068, box: [13, 279, 107, 301] },
    ]);

    expect(result.status).toBe('berhasil');
    expect(result.basis_tabel).toBe('per_sajian');
    expect(result.takaran_saji.nilai).toBe(12);
    expect(result.sajian_per_kemasan.nilai).toBe(28);
    expect(result.gizi.energi_kkal.nilai).toBe(25);
    expect(result.gizi.lemak_total_g.nilai).toBe(0);
    expect(result.gizi.lemak_jenuh_g.nilai).toBe(0);
    expect(result.gizi.protein_g.nilai).toBe(0);
    expect(result.gizi.karbohidrat_g.nilai).toBe(5);
    expect(result.gizi.gula_g.nilai).toBe(4);
    expect(result.gizi.natrium_mg.nilai).toBe(270);
  });
  it('membaca label gizi Indonesia ketika nama gizi dan nilai terpisah dalam beberapa kotak per baris', () => {
    const result = parseNutritionLines([
      { text: 'Takaran Saji', score: 0.95, box: [10, 10, 120, 28] },
      { text: '30 g', score: 0.95, box: [210, 11, 260, 27] },
      { text: 'Jumlah Per Sajian', score: 0.95, box: [10, 35, 180, 52] },
      { text: 'Energi Total', score: 0.95, box: [10, 60, 120, 78] },
      { text: '140 kkal', score: 0.95, box: [210, 61, 290, 77] },
      { text: 'Lemak Total', score: 0.95, box: [10, 85, 120, 103] },
      { text: '5 g', score: 0.95, box: [210, 86, 250, 102] },
      { text: '8%', score: 0.9, box: [310, 86, 340, 102] },
      { text: 'Lemak Jenuh', score: 0.95, box: [10, 110, 120, 128] },
      { text: '3 g', score: 0.95, box: [210, 111, 250, 127] },
      { text: '15%', score: 0.9, box: [310, 111, 345, 127] },
      { text: 'Protein', score: 0.95, box: [10, 135, 80, 153] },
      { text: '2 g', score: 0.95, box: [210, 136, 250, 152] },
      { text: 'Karbohidrat Totl', score: 0.9, box: [10, 160, 160, 178] },
      { text: '20 g', score: 0.9, box: [210, 161, 255, 177] },
      { text: 'Gula Total', score: 0.95, box: [10, 185, 110, 203] },
      { text: '7 g', score: 0.95, box: [210, 186, 250, 202] },
      { text: 'Garam (Natrium)', score: 0.95, box: [10, 210, 155, 228] },
      { text: '9O mg', score: 0.95, box: [210, 211, 270, 227] },
    ]);

    expect(result.status).toBe('berhasil');
    expect(result.basis_tabel).toBe('per_sajian');
    expect(result.takaran_saji.nilai).toBe(30);
    expect(result.gizi.energi_kkal.nilai).toBe(140);
    expect(result.gizi.lemak_total_g.nilai).toBe(5);
    expect(result.gizi.lemak_jenuh_g.nilai).toBe(3);
    expect(result.gizi.protein_g.nilai).toBe(2);
    expect(result.gizi.karbohidrat_g.nilai).toBe(20);
    expect(result.gizi.gula_g.nilai).toBe(7);
    expect(result.gizi.natrium_mg.nilai).toBe(90);
  });

  it('menandai field wajib yang tidak terbaca', () => {
    const result = parseNutritionLines([{ text: 'Gula 8 g', score: 0.8, box: [0, 0, 50, 20] }]);

    expect(result.status).toBe('sebagian');
    expect(result.peringatan_ekstraksi[0]).toContain('Field belum terbaca');
  });
});
