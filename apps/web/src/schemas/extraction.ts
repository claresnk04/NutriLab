import { z } from 'zod';

/**
 * Skema respons ekstraksi (PRD v1.1 bagian 12.3, skema_versi 1.0).
 * Kontrak data hasil OCR client-side yang disimpan bersama snapshot entry.
 */

const confidence = z.number().min(0).max(1);

const numericField = z.object({
  nilai: z.number().nullable(),
  teks_asli: z.string().optional(),
  keyakinan: confidence.optional(),
});

export const extractionResponseSchema = z.object({
  skema_versi: z.literal('1.0'),
  status: z.enum(['berhasil', 'sebagian', 'gagal']),
  jenis_produk_tebakan: z.string().nullable(),
  basis_tabel: z.enum(['per_sajian', 'per_kemasan', 'per_100', 'tidak_diketahui']),
  takaran_saji: numericField.extend({
    satuan: z.string().nullable().optional(),
    urt: z.string().nullable().optional(),
  }),
  sajian_per_kemasan: numericField,
  isi_bersih: numericField.extend({ satuan: z.string().nullable().optional() }),
  gizi: z.object({
    energi_kkal: numericField,
    lemak_total_g: numericField,
    lemak_jenuh_g: numericField,
    protein_g: numericField,
    karbohidrat_g: numericField,
    gula_g: numericField,
    laktosa_g: numericField,
    serat_g: numericField,
    natrium_mg: numericField,
  }),
  petunjuk_seduh_ml: numericField,
  persen_akg_tercetak: z.record(z.string(), z.number()),
  nutri_level_tercetak: z.object({ huruf: z.string().nullable() }),
  peringatan_ekstraksi: z.array(z.string()),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
