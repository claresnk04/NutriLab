import { extractionResponseSchema, type ExtractionResponse } from '../schemas/extraction';
import type { OcrProgress } from '../ocr/types';

const MAX_IMAGE_DIMENSION = 1280;
const REQUEST_TIMEOUT_MS = 30_000;
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
const PRIMARY_MODEL = (import.meta.env.VITE_GEMINI_MODEL ?? '').trim() || 'gemini-3.5-flash-lite';

/** Rantai model: model utama lalu fallback model Flash 3.x bila kuota/server sibuk. */
export const GEMINI_MODEL_CHAIN = [
  ...new Set([
    PRIMARY_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ]),
];

export function hasGeminiApiKey() {
  return API_KEY.length > 0;
}

const nullableNumber = { type: ['number', 'null'] };
const nullableString = { type: ['string', 'null'] };
const numericFieldSchema = {
  type: 'object',
  properties: {
    nilai: nullableNumber,
    teks_asli: { type: 'string' },
    keyakinan: { type: 'number' },
    satuan: nullableString,
    urt: nullableString,
  },
  required: ['nilai', 'teks_asli', 'keyakinan'],
};
const nutrientKeys = [
  'energi_kkal',
  'lemak_total_g',
  'lemak_jenuh_g',
  'protein_g',
  'karbohidrat_g',
  'gula_g',
  'laktosa_g',
  'serat_g',
  'natrium_mg',
] as const;

export const responseJsonSchema = {
  type: 'object',
  properties: {
    skema_versi: { type: 'string', enum: ['1.0'] },
    jenis_produk_tebakan: nullableString,
    basis_tabel: {
      type: 'string',
      enum: ['per_sajian', 'per_kemasan', 'per_100', 'tidak_diketahui'],
    },
    takaran_saji: numericFieldSchema,
    sajian_per_kemasan: numericFieldSchema,
    isi_bersih: numericFieldSchema,
    gizi: {
      type: 'object',
      properties: Object.fromEntries(nutrientKeys.map((key) => [key, numericFieldSchema])),
      required: [...nutrientKeys],
    },
    petunjuk_seduh_ml: numericFieldSchema,
    persen_akg_tercetak: {
      type: 'object',
      properties: Object.fromEntries(nutrientKeys.map((key) => [key, nullableNumber])),
    },
    nutri_level_tercetak: {
      type: 'object',
      properties: { huruf: nullableString },
    },
    peringatan_ekstraksi: { type: 'array', items: { type: 'string' } },
  },
  required: ['skema_versi', 'basis_tabel', 'takaran_saji', 'sajian_per_kemasan', 'gizi'],
};

export const prompt = `
Anda adalah mesin ekstraksi label gizi Indonesia. Baca gambar label gizi dengan teliti dan kembalikan JSON sesuai schema yang diberikan.

Aturan wajib:
- Hanya gunakan angka dan teks yang benar-benar terlihat pada gambar.
- Jangan menebak atau mengisi angka yang tidak terbaca; gunakan nilai null.
- Pertahankan teks asli yang terbaca pada teks_asli.
- keyakinan harus bernilai 0 sampai 1.
- Bedakan nilai per sajian, per kemasan, dan per 100 g/ml berdasarkan judul tabel.
- Gunakan satuan yang terlihat. Normalisasi field gizi ke satuan pada nama field: kkal, g, atau mg.
- Untuk nilai gizi yang tidak tercetak atau tidak terbaca, kembalikan nilai null dan teks_asli kosong.
- Jangan menambahkan markdown, komentar, atau penjelasan di luar JSON.
`;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const normalized =
    match[0].includes(',') && !match[0].includes('.')
      ? match[0].replace(',', '.')
      : match[0].replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function asConfidence(value: unknown, fallback: number) {
  const number = asNumber(value);
  return number === null ? fallback : Math.max(0, Math.min(1, number));
}

function numericField(value: unknown) {
  const source = asRecord(value);
  return {
    nilai: asNumber(source.nilai),
    teks_asli: typeof source.teks_asli === 'string' ? source.teks_asli : '',
    keyakinan: asConfidence(source.keyakinan, source.nilai == null ? 0 : 0.7),
    satuan: typeof source.satuan === 'string' ? source.satuan : null,
    urt: typeof source.urt === 'string' ? source.urt : null,
  };
}

export function parseGeminiJson(text: string): unknown {
  const withoutThink = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = withoutThink.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : withoutThink);
}

export function normalizeExtraction(value: unknown): ExtractionResponse {
  const source = asRecord(value);
  const rawGizi = asRecord(source.gizi);
  const gizi = {
    energi_kkal: numericField(rawGizi.energi_kkal),
    lemak_total_g: numericField(rawGizi.lemak_total_g),
    lemak_jenuh_g: numericField(rawGizi.lemak_jenuh_g),
    protein_g: numericField(rawGizi.protein_g),
    karbohidrat_g: numericField(rawGizi.karbohidrat_g),
    gula_g: numericField(rawGizi.gula_g),
    laktosa_g: numericField(rawGizi.laktosa_g),
    serat_g: numericField(rawGizi.serat_g),
    natrium_mg: numericField(rawGizi.natrium_mg),
  };
  const required = [
    'energi_kkal',
    'lemak_total_g',
    'lemak_jenuh_g',
    'protein_g',
    'karbohidrat_g',
    'gula_g',
    'natrium_mg',
  ] as const;
  const missing = required.filter((field) => gizi[field].nilai === null);
  const warnings = Array.isArray(source.peringatan_ekstraksi)
    ? source.peringatan_ekstraksi.filter((item): item is string => typeof item === 'string')
    : [];
  if (missing.length) warnings.push(`Field belum terbaca: ${missing.join(', ')}`);

  const candidate = {
    skema_versi: '1.0' as const,
    status: missing.length === 0 ? ('berhasil' as const) : ('sebagian' as const),
    jenis_produk_tebakan:
      typeof source.jenis_produk_tebakan === 'string' ? source.jenis_produk_tebakan : null,
    basis_tabel:
      source.basis_tabel === 'per_sajian' ||
      source.basis_tabel === 'per_kemasan' ||
      source.basis_tabel === 'per_100'
        ? source.basis_tabel
        : ('tidak_diketahui' as const),
    takaran_saji: numericField(source.takaran_saji),
    sajian_per_kemasan: numericField(source.sajian_per_kemasan),
    isi_bersih: numericField(source.isi_bersih),
    gizi,
    petunjuk_seduh_ml: numericField(source.petunjuk_seduh_ml),
    persen_akg_tercetak: Object.fromEntries(
      Object.entries(asRecord(source.persen_akg_tercetak)).flatMap(([key, value]) => {
        const number = asNumber(value);
        return number === null ? [] : [[key, number]];
      }),
    ),
    nutri_level_tercetak: {
      huruf:
        typeof asRecord(source.nutri_level_tercetak).huruf === 'string'
          ? (asRecord(source.nutri_level_tercetak).huruf as string)
          : null,
    },
    peringatan_ekstraksi: [...new Set(warnings)],
  };
  return extractionResponseSchema.parse(candidate);
}

export async function imageDataToBase64(image: ImageData) {
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas gambar tidak tersedia.');
  const source = document.createElement('canvas');
  source.width = image.width;
  source.height = image.height;
  source.getContext('2d')?.putImageData(image, 0, 0);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Gambar gagal dikompres.'))),
      'image/jpeg',
      0.9,
    );
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function progress(
  onProgress: ((value: OcrProgress) => void) | undefined,
  phase: OcrProgress['phase'],
  percent: number,
) {
  onProgress?.({ phase, percent });
}

type InteractionStep = { type?: string; content?: Array<{ type?: string; text?: string }> };
type GenerateCandidate = { content?: { parts?: Array<{ text?: string }> } };

/** Ambil teks output dari respons Gemini (`candidates[].content.parts` atau `steps[].model_output`). */
export function extractOutputText(body: unknown): string {
  const record = asRecord(body);
  if (typeof record.output_text === 'string') return record.output_text;

  const candidates = Array.isArray(record.candidates)
    ? (record.candidates as GenerateCandidate[])
    : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const text = parts
      .filter((part) => typeof part?.text === 'string')
      .map((part) => part.text)
      .join('');
    if (text) return text;
  }

  const steps = Array.isArray(record.steps) ? (record.steps as InteractionStep[]) : [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
    const text = step.content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    if (text) return text;
  }
  throw new Error('Respons Gemini tidak berisi teks.');
}

export class GeminiRequestError extends Error {
  readonly status: number;
  readonly retryWithNextModel: boolean;

  constructor(message: string, status: number, retryWithNextModel: boolean) {
    super(message);
    this.name = 'GeminiRequestError';
    this.status = status;
    this.retryWithNextModel = retryWithNextModel;
  }
}

async function callInteraction(model: string, data: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${API_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(API_KEY)}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data } }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema,
        },
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // 404 = model tidak tersedia, 429 = kuota habis, 5xx = server sibuk → coba model berikutnya.
      const retry = response.status === 404 || response.status === 429 || response.status >= 500;
      throw new GeminiRequestError(
        `Gemini (${model}) HTTP ${response.status}: ${detail.slice(0, 200)}`,
        response.status,
        retry,
      );
    }
    return await response.json();
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GeminiRequestError(`Gemini (${model}) timeout`, 0, true);
    }
    throw new GeminiRequestError(`Koneksi ke Gemini gagal: ${String(error)}`, 0, false);
  } finally {
    clearTimeout(timer);
  }
}

export async function runGeminiOcr(
  image: ImageData,
  onProgress?: (value: OcrProgress) => void,
): Promise<ExtractionResponse & { modelUsed: string }> {
  if (!hasGeminiApiKey()) throw new Error('VITE_GEMINI_API_KEY belum diisi.');
  progress(onProgress, 'preparing', 10);
  const data = await imageDataToBase64(image);
  progress(onProgress, 'uploading', 30);

  let lastError: unknown = null;
  for (const model of GEMINI_MODEL_CHAIN) {
    try {
      progress(onProgress, 'analyzing', 55);
      const body = await callInteraction(model, data);
      progress(onProgress, 'validating', 85);
      const extraction = normalizeExtraction(parseGeminiJson(extractOutputText(body)));
      progress(onProgress, 'completed', 100);
      return { ...extraction, modelUsed: model };
    } catch (error) {
      lastError = error;
      if (error instanceof GeminiRequestError && !error.retryWithNextModel) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Analisis Gemini gagal.');
}
