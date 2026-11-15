import { auth } from '../lib/firebase';
import { extractionResponseSchema, type ExtractionResponse } from '../schemas/extraction';
import type { OcrProgress } from '../ocr/types';
import { imageDataToBase64 } from './geminiOcr';

type Provider = 'gemini' | 'groq';

const REQUEST_TIMEOUT_MS = 45_000;

function apiBaseUrl() {
  return (import.meta.env.VITE_PASSWORD_RESET_API_URL ?? '').trim().replace(/\/$/, '');
}

function report(
  onProgress: ((value: OcrProgress) => void) | undefined,
  phase: OcrProgress['phase'],
  percent: number,
) {
  onProgress?.({ phase, percent });
}

async function runProxyOcr(
  provider: Provider,
  image: ImageData,
  onProgress?: (value: OcrProgress) => void,
): Promise<ExtractionResponse & { modelUsed?: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');

  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error('Layanan OCR belum dikonfigurasi.');

  report(onProgress, 'preparing', 10);
  const imageBase64 = await imageDataToBase64(image);
  report(onProgress, 'uploading', 30);

  const token = await currentUser.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    report(onProgress, 'analyzing', 55);
    const response = await fetch(`${baseUrl}/api/ocr-extract`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider, imageBase64, mimeType: 'image/jpeg' }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      modelUsed?: string;
      extraction?: unknown;
    };
    if (!response.ok) throw new Error(payload.message ?? 'Layanan OCR belum dapat digunakan.');

    report(onProgress, 'validating', 85);
    const extraction = extractionResponseSchema.parse(payload.extraction ?? payload);
    report(onProgress, 'completed', 100);
    return { ...extraction, modelUsed: payload.modelUsed };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Layanan OCR timeout.', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function runGeminiOcr(image: ImageData, onProgress?: (value: OcrProgress) => void) {
  return runProxyOcr('gemini', image, onProgress);
}

export function runGroqOcr(image: ImageData, onProgress?: (value: OcrProgress) => void) {
  return runProxyOcr('groq', image, onProgress);
}
