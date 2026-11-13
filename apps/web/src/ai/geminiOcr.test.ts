import {
  extractOutputText,
  GEMINI_MODEL_CHAIN,
  hasGeminiApiKey,
  normalizeExtraction,
  parseGeminiJson,
} from './geminiOcr';
import { extractGroqOutputText, GROQ_MODEL_CHAIN, hasGroqApiKey } from './groqOcr';

function validResponse() {
  const numeric = (nilai: number | null, teks_asli = '') => ({
    nilai,
    teks_asli,
    keyakinan: nilai === null ? 0 : 0.95,
  });
  return {
    skema_versi: '1.0',
    jenis_produk_tebakan: 'susu',
    basis_tabel: 'per_sajian',
    takaran_saji: { ...numeric(30, '30 g'), satuan: 'g', urt: '3 sendok makan' },
    sajian_per_kemasan: numeric(10, '10 sajian'),
    isi_bersih: { ...numeric(300, '300 g'), satuan: 'g' },
    gizi: {
      energi_kkal: numeric(120, '120'),
      lemak_total_g: numeric(2, '2'),
      lemak_jenuh_g: numeric(1, '1'),
      protein_g: numeric(8, '8'),
      karbohidrat_g: numeric(15, '15'),
      gula_g: numeric(5, '5'),
      laktosa_g: numeric(null),
      serat_g: numeric(3, '3'),
      natrium_mg: numeric(80, '80'),
    },
    petunjuk_seduh_ml: numeric(null),
    persen_akg_tercetak: { energi_kkal: 6 },
    nutri_level_tercetak: { huruf: null },
    peringatan_ekstraksi: [],
  };
}

describe('Gemini OCR response handling', () => {
  it('membaca JSON biasa dan JSON dalam markdown fence', () => {
    const response = JSON.stringify(validResponse());

    expect(parseGeminiJson(response)).toEqual(JSON.parse(response));
    expect(parseGeminiJson(`\n\`\`\`json\n${response}\n\`\`\``)).toEqual(JSON.parse(response));
  });

  it('menormalisasi koma desimal dan mempertahankan null tanpa menebak', () => {
    const response = validResponse();
    Object.assign(response.gizi.gula_g, { nilai: '2,5', teks_asli: '2,5', keyakinan: 0.8 });
    Object.assign(response.gizi.serat_g, { nilai: null, teks_asli: '', keyakinan: 0 });

    const normalized = normalizeExtraction(response);

    expect(normalized.gizi.gula_g.nilai).toBe(2.5);
    expect(normalized.gizi.serat_g.nilai).toBeNull();
    expect(normalized.gizi.serat_g.keyakinan).toBe(0);
    expect(normalized.takaran_saji.satuan).toBe('g');
    expect(normalized.takaran_saji.urt).toBe('3 sendok makan');
    expect(normalized.status).toBe('berhasil');
  });

  it('menandai field wajib yang hilang sebagai sebagian', () => {
    const response = validResponse();
    Object.assign(response.gizi.natrium_mg, { nilai: null, teks_asli: '', keyakinan: 0 });

    const normalized = normalizeExtraction(response);

    expect(normalized.status).toBe('sebagian');
    expect(normalized.peringatan_ekstraksi).toContain('Field belum terbaca: natrium_mg');
  });

  it('menolak respons yang bukan JSON', () => {
    expect(() => parseGeminiJson('bukan JSON')).toThrow();
  });

  it('mengambil teks dari candidates generateContent maupun steps model_output', () => {
    const json = JSON.stringify(validResponse());
    const generateBody = {
      candidates: [{ content: { parts: [{ text: json }] } }],
    };
    const interactionBody = {
      status: 'completed',
      steps: [
        { type: 'user_input', content: [{ type: 'text', text: 'prompt' }] },
        { type: 'model_output', content: [{ type: 'text', text: json }] },
      ],
    };
    expect(
      normalizeExtraction(parseGeminiJson(extractOutputText(generateBody))).gizi.energi_kkal.nilai,
    ).toBe(120);
    expect(
      normalizeExtraction(parseGeminiJson(extractOutputText(interactionBody))).gizi.energi_kkal
        .nilai,
    ).toBe(120);
    expect(() => extractOutputText({ steps: [] })).toThrow();
  });

  it('memakai rantai model Gemini 3.x aktif dan memeriksa API key', () => {
    expect(GEMINI_MODEL_CHAIN[0]).toBe('gemini-3.5-flash-lite');
    expect(GEMINI_MODEL_CHAIN).toContain('gemini-3.5-flash');
    expect(GEMINI_MODEL_CHAIN).toContain('gemini-3.8-flash');
    expect(GEMINI_MODEL_CHAIN.some((model) => model.startsWith('gemini-2'))).toBe(false);
    expect(typeof hasGeminiApiKey()).toBe('boolean');
  });

  it('mengambil teks dari respons Groq Chat Completions dan membersihkan blok <think>', () => {
    const json = JSON.stringify(validResponse());
    const groqBody = {
      choices: [{ message: { content: `<think>analisis singkat</think>\n${json}` } }],
    };
    expect(
      normalizeExtraction(parseGeminiJson(extractGroqOutputText(groqBody))).gizi.energi_kkal.nilai,
    ).toBe(120);
    expect(() => extractGroqOutputText({ choices: [] })).toThrow();
    expect(GROQ_MODEL_CHAIN[0]).toBe('qwen/qwen3.8-27b');
    expect(typeof hasGroqApiKey()).toBe('boolean');
  });
});
