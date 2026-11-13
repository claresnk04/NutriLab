import type { ExtractionResponse } from '../schemas/extraction';
import type { OcrProgress } from '../ocr/types';
import {
  GeminiRequestError,
  imageDataToBase64,
  normalizeExtraction,
  parseGeminiJson,
  prompt,
} from './geminiOcr';

const REQUEST_TIMEOUT_MS = 30_000;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY ?? '').trim();
const PRIMARY_GROQ_MODEL = (import.meta.env.VITE_GROQ_MODEL ?? '').trim() || 'qwen/qwen3.8-27b';

/** Rantai model Vision Groq: Qwen 3.8 27B utama lalu fallback ke Muse Spark / Llama 4 Scout. */
export const GROQ_MODEL_CHAIN = [
  ...new Set([
    PRIMARY_GROQ_MODEL,
    'qwen/qwen3.8-27b',
    'meta-models/muse-spark-open',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ]),
];

export function hasGroqApiKey() {
  return GROQ_API_KEY.length > 0;
}

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

type GroqChoice = { message?: { content?: string | null } };

/** Ambil teks JSON dari respons Chat Completions Groq (`choices[0].message.content`). */
export function extractGroqOutputText(body: unknown): string {
  if (body && typeof body === 'object' && 'choices' in body) {
    const choices = (body as { choices?: unknown }).choices;
    if (Array.isArray(choices)) {
      for (const choice of choices as GroqChoice[]) {
        const content = choice?.message?.content;
        if (typeof content === 'string' && content.trim().length > 0) {
          return content;
        }
      }
    }
  }
  throw new Error('Respons Groq tidak berisi teks.');
}

async function callGroqModel(model: string, data: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: groqSchemaInstruction },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${data}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const retry =
        response.status === 400 ||
        response.status === 404 ||
        response.status === 429 ||
        response.status >= 500;
      throw new GeminiRequestError(
        `Groq (${model}) HTTP ${response.status}: ${detail.slice(0, 200)}`,
        response.status,
        retry,
      );
    }
    return await response.json();
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GeminiRequestError(`Groq (${model}) timeout`, 0, true);
    }
    throw new GeminiRequestError(`Koneksi ke Groq gagal: ${String(error)}`, 0, false);
  } finally {
    clearTimeout(timer);
  }
}

export async function runGroqOcr(
  image: ImageData,
  onProgress?: (value: OcrProgress) => void,
): Promise<ExtractionResponse & { modelUsed: string }> {
  if (!hasGroqApiKey()) throw new Error('VITE_GROQ_API_KEY belum diisi.');
  onProgress?.({ phase: 'preparing', percent: 15 });
  const data = await imageDataToBase64(image);
  onProgress?.({ phase: 'uploading', percent: 35 });

  let lastError: unknown = null;
  for (const model of GROQ_MODEL_CHAIN) {
    try {
      onProgress?.({ phase: 'analyzing', percent: 60 });
      const body = await callGroqModel(model, data);
      onProgress?.({ phase: 'validating', percent: 85 });
      const extraction = normalizeExtraction(parseGeminiJson(extractGroqOutputText(body)));
      onProgress?.({ phase: 'completed', percent: 100 });
      return { ...extraction, modelUsed: model };
    } catch (error) {
      lastError = error;
      if (error instanceof GeminiRequestError && !error.retryWithNextModel) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Analisis Groq gagal.');
}
