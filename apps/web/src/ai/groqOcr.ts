/** Rantai model Vision Groq: Qwen 3.8 27B utama lalu fallback ke Muse Spark / Llama 4 Scout. */
export const GROQ_MODEL_CHAIN = [
  ...new Set([
    'qwen/qwen3.8-27b',
    'meta-models/muse-spark-open',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ]),
];

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
