import { describe, expect, it } from 'vitest';
import { extractionResponseSchema } from './extraction';

// Contoh dari PRD v1.1 bagian 12.3.
const prdExample = {
  skema_versi: '1.0',
  status: 'berhasil',
  jenis_produk_tebakan: 'makanan',
  basis_tabel: 'per_sajian',
  takaran_saji: { nilai: 30, satuan: 'g', urt: '3 keping', keyakinan: 0.97 },
  sajian_per_kemasan: { nilai: 4, keyakinan: 0.95 },
  isi_bersih: { nilai: 120, satuan: 'g', keyakinan: 0.9 },
  gizi: {
    energi_kkal: { nilai: 140, teks_asli: '140 kkal', keyakinan: 0.99 },
    lemak_total_g: { nilai: 5, keyakinan: 0.98 },
    lemak_jenuh_g: { nilai: 3, keyakinan: 0.98 },
    protein_g: { nilai: 2, keyakinan: 0.98 },
    karbohidrat_g: { nilai: 20, keyakinan: 0.99 },
    gula_g: { nilai: 7, keyakinan: 0.97 },
    laktosa_g: { nilai: null },
    serat_g: { nilai: 1, keyakinan: 0.9 },
    natrium_mg: { nilai: 90, keyakinan: 0.96 },
  },
  petunjuk_seduh_ml: { nilai: null },
  persen_akg_tercetak: { energi: 7, lemak_jenuh: 15, natrium: 6 },
  nutri_level_tercetak: { huruf: null },
  peringatan_ekstraksi: [],
};

describe('extractionResponseSchema', () => {
  it('menerima contoh JSON dari PRD 12.3', () => {
    expect(extractionResponseSchema.safeParse(prdExample).success).toBe(true);
  });

  it('menolak keyakinan di luar 0-1', () => {
    const bad = structuredClone(prdExample);
    bad.gizi.gula_g.keyakinan = 1.5;
    expect(extractionResponseSchema.safeParse(bad).success).toBe(false);
  });
});
