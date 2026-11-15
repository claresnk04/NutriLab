import { z } from 'zod';

const REQUEST_TIMEOUT_MS = 30_000;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const confidence = z.number().min(0).max(1);
const numericFieldSchema = z.object({
  nilai: z.number().nullable(),
  teks_asli: z.string().optional(),
  keyakinan: confidence.optional(),
  satuan: z.string().nullable().optional(),
  urt: z.string().nullable().optional(),
});

export const extractionResponseSchema = z.object({
  skema_versi: z.literal('1.0'),
  status: z.enum(['berhasil', 'sebagian', 'gagal']),
  jenis_produk_tebakan: z.string().nullable(),
  basis_tabel: z.enum(['per_sajian', 'per_kemasan', 'per_100', 'tidak_diketahui']),
  takaran_saji: numericFieldSchema,
  sajian_per_kemasan: numericFieldSchema,
  isi_bersih: numericFieldSchema,
  gizi: z.object({
    energi_kkal: numericFieldSchema,
    lemak_total_g: numericFieldSchema,
    lemak_jenuh_g: numericFieldSchema,
    protein_g: numericFieldSchema,
    karbohidrat_g: numericFieldSchema,
    gula_g: numericFieldSchema,
    laktosa_g: numericFieldSchema,
    serat_g: numericFieldSchema,
    natrium_mg: numericFieldSchema,
  }),
  petunjuk_seduh_ml: numericFieldSchema,
  persen_akg_tercetak: z.record(z.string(), z.number()),
  nutri_level_tercetak: z.object({ huruf: z.string().nullable() }),
  peringatan_ekstraksi: z.array(z.string()),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

export const GEMINI_MODEL_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
];

export const GROQ_MODEL_CHAIN = [
  'qwen/qwen3.8-27b',
  'meta-models/muse-spark-open',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
];

const nullableNumber = { type: ['number', 'null'] };
const nullableString = { type: ['string', 'null'] };
const numericField = {
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
    takaran_saji: numericField,
    sajian_per_kemasan: numericField,
    isi_bersih: numericField,
    gizi: {
      type: 'object',
      properties: Object.fromEntries(nutrientKeys.map((key) => [key, numericField])),
      required: [...nutrientKeys],
    },
    petunjuk_seduh_ml: numericField,
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

const groqSchemaInstruction = `${prompt}
Kembalikan tepat satu objek JSON dengan struktur kunci berikut:
{
  "skema_versi": "1.0",
  "jenis_produk_tebakan": "makanan",
  "basis_tabel": "per_sajian",
  "takaran_saji": { "nilai": 0, "teks_asli": "", "keyakinan": 0.9, "satuan": "g", "urt": null },
  "sajian_per_kemasan": { "nilai": 0, "teks_asli": "", "keyakinan": 0.9 },
  "isi_bersih": { "nilai": null, "teks_asli": "", "keyakinan": 0, "satuan": null },
  "gizi": {
    "energi_kkal": { "nilai": 0, "teks_asli": "", "keyakinan": 0.9 },
    "lemak_total_g": { "nilai": 0, "teks_asli": "", "keyakinan": 0.9 },
    "lemak_jenuh_g": { "nilai": 0, "teks_asli": "", "keyakinan": 0.9 },
    "protein_g": { "nilai": 0, "teks_asli": "", "keyakinan": 0.9 },
    "karbohidrat_g": { "nilai": 0, "teks_asli": "", "keyakinan": 0.9 },
    "gula_g": { "nilai": 0, "teks_asli": "", "keyakinan": 0.9 },
    "laktosa_g": { "nilai": null, "teks_asli": "", "keyakinan": 0 },
    "serat_g": { "nilai": null, "teks_asli": "", "keyakinan": 0 },
    "natrium_mg": { "nilai": 0, "teks_asli": "", "keyakinan": 0.9 }
  },
  "petunjuk_seduh_ml": { "nilai": null, "teks_asli": "", "keyakinan": 0 },
  "persen_akg_tercetak": {},
  "nutri_level_tercetak": { "huruf": null },
  "peringatan_ekstraksi": []
}`;

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

function numericFieldValue(value: unknown) {
  const source = asRecord(value);
  return {
    nilai: asNumber(source.nilai),
    teks_asli: typeof source.teks_asli === 'string' ? source.teks_asli : '',
    keyakinan: Math.max(
      0,
      Math.min(1, asNumber(source.keyakinan) ?? (source.nilai == null ? 0 : 0.7)),
    ),
    satuan: typeof source.satuan === 'string' ? source.satuan : null,
    urt: typeof source.urt === 'string' ? source.urt : null,
  };
}

export function parseJson(text: string): unknown {
  const withoutThink = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = withoutThink.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : withoutThink);
}

export function normalizeExtraction(value: unknown): ExtractionResponse {
  const source = asRecord(value);
  const rawGizi = asRecord(source.gizi);
  const gizi = {
    energi_kkal: numericFieldValue(rawGizi.energi_kkal),
    lemak_total_g: numericFieldValue(rawGizi.lemak_total_g),
    lemak_jenuh_g: numericFieldValue(rawGizi.lemak_jenuh_g),
    protein_g: numericFieldValue(rawGizi.protein_g),
    karbohidrat_g: numericFieldValue(rawGizi.karbohidrat_g),
    gula_g: numericFieldValue(rawGizi.gula_g),
    laktosa_g: numericFieldValue(rawGizi.laktosa_g),
    serat_g: numericFieldValue(rawGizi.serat_g),
    natrium_mg: numericFieldValue(rawGizi.natrium_mg),
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

  return extractionResponseSchema.parse({
    skema_versi: '1.0',
    status: missing.length === 0 ? 'berhasil' : 'sebagian',
    jenis_produk_tebakan:
      typeof source.jenis_produk_tebakan === 'string' ? source.jenis_produk_tebakan : null,
    basis_tabel:
      source.basis_tabel === 'per_sajian' ||
      source.basis_tabel === 'per_kemasan' ||
      source.basis_tabel === 'per_100'
        ? source.basis_tabel
        : 'tidak_diketahui',
    takaran_saji: numericFieldValue(source.takaran_saji),
    sajian_per_kemasan: numericFieldValue(source.sajian_per_kemasan),
    isi_bersih: numericFieldValue(source.isi_bersih),
    gizi,
    petunjuk_seduh_ml: numericFieldValue(source.petunjuk_seduh_ml),
    persen_akg_tercetak: Object.fromEntries(
      Object.entries(asRecord(source.persen_akg_tercetak)).flatMap(([key, value]) => {
        const number = asNumber(value);
        return number === null ? [] : [[key, number]];
      }),
    ),
    nutri_level_tercetak: {
      huruf:
        typeof asRecord(source.nutri_level_tercetak).huruf === 'string'
          ? asRecord(source.nutri_level_tercetak).huruf
          : null,
    },
    peringatan_ekstraksi: [...new Set(warnings)],
  });
}

type InteractionStep = { type?: string; content?: Array<{ type?: string; text?: string }> };
type GenerateCandidate = { content?: { parts?: Array<{ text?: string }> } };

export function extractGeminiText(body: unknown): string {
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

export function extractGroqText(body: unknown): string {
  const choices = asRecord(body).choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const content = asRecord(asRecord(choice).message).content;
      if (typeof content === 'string' && content.trim()) return content;
    }
  }
  throw new Error('Respons Groq tidak berisi teks.');
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly retryWithNextModel: boolean,
  ) {
    super(message);
    this.name = 'ProviderRequestError';
  }
}

async function callProvider(url: string, init: RequestInit, provider: string, model: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const retry =
        response.status === 400 ||
        response.status === 404 ||
        response.status === 429 ||
        response.status >= 500;
      throw new ProviderRequestError(
        `${provider} (${model}) HTTP ${response.status}: ${detail.slice(0, 200)}`,
        retry,
      );
    }
    return response.json();
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderRequestError(`${provider} (${model}) timeout`, true);
    }
    throw new ProviderRequestError(`Koneksi ke ${provider} gagal`, false);
  } finally {
    clearTimeout(timer);
  }
}

export async function runGeminiOcrServer(
  data: string,
  apiKey: string,
  modelChain: readonly string[] = GEMINI_MODEL_CHAIN,
) {
  let lastError: unknown = null;
  for (const model of modelChain) {
    try {
      const body = await callProvider(
        `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data } }],
              },
            ],
            generationConfig: { responseMimeType: 'application/json', responseJsonSchema },
          }),
        },
        'Gemini',
        model,
      );
      return { ...normalizeExtraction(parseJson(extractGeminiText(body))), modelUsed: model };
    } catch (error) {
      lastError = error;
      if (error instanceof ProviderRequestError && !error.retryWithNextModel) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Analisis Gemini gagal.');
}

export async function runGroqOcrServer(
  data: string,
  apiKey: string,
  modelChain: readonly string[] = GROQ_MODEL_CHAIN,
) {
  let lastError: unknown = null;
  for (const model of modelChain) {
    try {
      const body = await callProvider(
        GROQ_API_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: groqSchemaInstruction },
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}` } },
                ],
              },
            ],
            temperature: 0.1,
            max_completion_tokens: 2048,
            response_format: { type: 'json_object' },
          }),
        },
        'Groq',
        model,
      );
      return { ...normalizeExtraction(parseJson(extractGroqText(body))), modelUsed: model };
    } catch (error) {
      lastError = error;
      if (error instanceof ProviderRequestError && !error.retryWithNextModel) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Analisis Groq gagal.');
}
