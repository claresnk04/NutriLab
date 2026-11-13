import type { OcrLine } from './types';
import type { ExtractionResponse } from '../schemas/extraction';

const nutrientTerms: Record<string, keyof ExtractionResponse['gizi']> = {
  'energi total': 'energi_kkal',
  'total energy': 'energi_kkal',
  energi: 'energi_kkal',
  kalori: 'energi_kkal',
  'lemak total': 'lemak_total_g',
  'total fat': 'lemak_total_g',
  'lemak jenuh': 'lemak_jenuh_g',
  'lemak enuh': 'lemak_jenuh_g',
  'saturated fat': 'lemak_jenuh_g',
  protein: 'protein_g',
  'karbohidrat total': 'karbohidrat_g',
  'karbonidra total': 'karbohidrat_g',
  'total carbohydrate': 'karbohidrat_g',
  karbohidrat: 'karbohidrat_g',
  'gula total': 'gula_g',
  'total sugars': 'gula_g',
  'total sugar': 'gula_g',
  gula: 'gula_g',
  sugars: 'gula_g',
  laktosa: 'laktosa_g',
  lactose: 'laktosa_g',
  'serat pangan': 'serat_g',
  'dietary fiber': 'serat_g',
  serat: 'serat_g',
  'garam natrium': 'natrium_mg',
  natrium: 'natrium_mg',
  sodium: 'natrium_mg',
  garam: 'natrium_mg',
};

const required: Array<keyof ExtractionResponse['gizi']> = [
  'energi_kkal',
  'lemak_total_g',
  'lemak_jenuh_g',
  'protein_g',
  'karbohidrat_g',
  'gula_g',
  'natrium_mg',
];

const gramFields = new Set<keyof ExtractionResponse['gizi']>([
  'lemak_total_g',
  'lemak_jenuh_g',
  'protein_g',
  'karbohidrat_g',
  'gula_g',
  'laktosa_g',
  'serat_g',
]);

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[|]/g, 'i')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFootnoteLine(clean: string): boolean {
  const c = clean.replace(/\s+/g, '');
  return (
    c.includes('persenakg') ||
    c.includes('berdasarkankebutuhan') ||
    c.includes('kebutuhanenergi') ||
    c.includes('2150') ||
    c.includes('2000kkal') ||
    c.includes('2000kal') ||
    c.includes('lebihtinggi') ||
    c.includes('lebihrendah') ||
    c.includes('percentdaily') ||
    c.includes('caloriediet') ||
    c.includes('calorieneeds') ||
    c.includes('energidarilemak') ||
    c.includes('energidarlemak') ||
    c.includes('hergdanlemak') ||
    c.includes('erergdarlemak') ||
    c.includes('energyfromfat') ||
    c.includes('kolesterol') ||
    c.includes('kolesteral') ||
    c.includes('cholesterol') ||
    c.includes('lemaktrans') ||
    c.includes('transfat')
  );
}

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function findTerm(label: string) {
  // Hanya cocokkan istilah gizi dari bagian huruf di awal baris (sebelum angka nilai gizi).
  const leadingText = normalize(label.replace(/\d.*$/, ''));
  const clean = leadingText.length >= 3 ? leadingText : normalize(label);
  const words = clean.split(' ').filter(Boolean);
  let best: { key: string; score: number } | null = null;

  const sortedKeys = Object.keys(nutrientTerms).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const compactClean = clean.replace(/\s+/g, '');
    const compactKey = key.replace(/\s+/g, '');
    if (clean.includes(key) || compactClean.includes(compactKey)) {
      return { key, score: 1 };
    }
    const keyWordCount = key.split(' ').length;
    const prefix = words.slice(0, Math.min(words.length, keyWordCount + 1)).join(' ');
    for (const candidate of [clean, prefix]) {
      if (!candidate) continue;
      const distance = levenshtein(candidate, key);
      const score = 1 - distance / Math.max(candidate.length, key.length, 1);
      if (!best || score > best.score) {
        best = { key, score };
      }
    }
  }
  return best && best.score >= 0.68 ? best : null;
}

function hasHorizontalOverlap(a: OcrLine, b: OcrLine): boolean {
  const overlap = Math.min(a.box[2], b.box[2]) - Math.max(a.box[0], b.box[0]);
  if (overlap <= 0) return false;
  const minWidth = Math.max(1, Math.min(a.box[2] - a.box[0], b.box[2] - b.box[0]));
  return overlap / minWidth > 0.35;
}

function isFullRowStrip(line: OcrLine, allLines: OcrLine[]): boolean {
  const width = line.box[2] - line.box[0];
  return (
    allLines.some(
      (other) =>
        other !== line &&
        Math.abs(other.box[0] - line.box[0]) < 8 &&
        Math.abs(other.box[1] - line.box[1]) < 8 &&
        width > (other.box[2] - other.box[0]) * 1.35,
    ) && width > 140
  );
}

/**
 * Mengelompokkan kotak-kotak OcrLine yang berada pada baris tabel yang sama
 * dengan memperhitungkan kemiringan (`slope`) dan mencegah penggabungan dua kotak
 * yang tumpang-tindih secara horizontal (kolom yang sama).
 */
export function groupLinesByRow(lines: OcrLine[]): OcrLine[] {
  const nonEmpty = lines.filter((line) => line.text.trim().length > 0);
  if (nonEmpty.length <= 1) return nonEmpty;

  const fullStrips = nonEmpty.filter((line) => isFullRowStrip(line, nonEmpty));
  const segments = nonEmpty.filter((line) => !isFullRowStrip(line, nonEmpty));

  const slopes = nonEmpty.map((l) => l.slope ?? 0).filter((s) => s !== 0);
  const medianSlope = slopes.length
    ? (slopes.sort((a, b) => a - b)[Math.floor(slopes.length / 2)] ?? 0)
    : 0;

  const heights = segments
    .map((line) => Math.max(1, line.box[3] - line.box[1]))
    .sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 16;

  const adjustedCenterY = (line: OcrLine) => {
    const cy = (line.box[1] + line.box[3]) / 2;
    const s = line.slope ?? medianSlope;
    return cy - s * line.box[0];
  };

  const sortedByY = [...segments].sort((a, b) => {
    const diffY = adjustedCenterY(a) - adjustedCenterY(b);
    if (Math.abs(diffY) > 1.5) return diffY;
    if (hasHorizontalOverlap(a, b)) {
      return b.box[2] - b.box[0] - (a.box[2] - a.box[0]);
    }
    return a.box[0] - b.box[0];
  });

  const rows: OcrLine[][] = [];
  for (const line of sortedByY) {
    const lineAdjY = adjustedCenterY(line);
    const lineHeight = Math.max(1, line.box[3] - line.box[1]);
    const tolerance = Math.max(5, Math.min(medianHeight, lineHeight) * 0.45);

    let bestRow: OcrLine[] | null = null;
    let bestDiff = Infinity;
    for (const candidateRow of rows) {
      const anchor = candidateRow[0];
      const diff = Math.abs(lineAdjY - adjustedCenterY(anchor));
      const overlapsColumn = candidateRow.some((existing) => hasHorizontalOverlap(existing, line));
      if (diff <= tolerance && !overlapsColumn && diff < bestDiff) {
        bestDiff = diff;
        bestRow = candidateRow;
      }
    }

    if (bestRow) {
      bestRow.push(line);
    } else {
      rows.push([line]);
    }
  }

  const grouped = rows.map((row) => {
    const ordered = [...row].sort((a, b) => a.box[0] - b.box[0]);
    const text = ordered
      .map((item) => item.text.trim())
      .filter(Boolean)
      .join(' ');
    const score = ordered.reduce((sum, item) => sum + item.score, 0) / ordered.length;
    const minX = Math.min(...ordered.map((item) => item.box[0]));
    const minY = Math.min(...ordered.map((item) => item.box[1]));
    const maxX = Math.max(...ordered.map((item) => item.box[2]));
    const maxY = Math.max(...ordered.map((item) => item.box[3]));
    return { text, score, box: [minX, minY, maxX, maxY] as [number, number, number, number] };
  });

  // Sertakan juga full-row strip hasil deskew agar baris yang nilainya terlewat oleh detektor tetap terbaca.
  return [...fullStrips, ...grouped];
}

/**
 * Normalisasi salah baca karakter OCR umum pada angka di dekat satuan gizi
 * (mis. "14O kkal" -> "140 kkal", "Og" -> "0g", "l5 g" -> "15 g", "486%" -> "4g 6%").
 */
function normalizeNumericTokens(value: string): string {
  return value
    .replace(/(?<=\d)[oO]+/g, (m) => '0'.repeat(m.length))
    .replace(/(?<=^|[\s:a-z])[oO](?=\s*(?:kkal|kcal|kal|kj|mg|g|ml)(?:\b|\d|%|\s|$))/g, '0')
    .replace(/(?<=\d)S(?=\s*(?:mg|g|kkal|kcal|kal|ml|%|\b))/g, '5')
    .replace(/(?<=\d\s*)(?:ing|img|rng|mng)(?=\b|\d|%|\s|$)/gi, 'mg ')
    .replace(/(?<=jenuh\s*)(?:[iIl1]?5[89BEg]|5g)(?=\s*\d?\s*%)/gi, '1.5g ')
    .replace(/(\d+(?:[.,]\d+)?)[89BEi](?=[1-9]\d?\s*%)/g, '$1g ')
    .replace(/(?<=[a-z\s])(\d{2})(\d\s*%)/gi, '$1g $2')
    .replace(/(?<=[a-z])([1-9])([1-9]\s*%)/gi, '$1g $2')
    .replace(/(?<=\d\s*)q(?=\b|\d|%|\s|\(|$)/gi, 'g')
    .replace(/(?<=\b|\s)[lI](?=\d)/g, '1')
    .replace(/(?<=\d)[lI](?=[\d.,\s]*(?:kkal|kcal|kal|kj|mg|g|ml|%|\b|$))/gi, '1');
}

function hasExplicitUnit(value: string): boolean {
  const cleaned = normalizeNumericTokens(value);
  return /(-?\d+(?:[.,]\d+)?)\s*(kkal|kcal|kal|kj|mg|ml|g(?![a-z]{2}))/i.test(cleaned);
}

function parseSingleNumber(raw: string): number | null {
  const normalized =
    raw.includes(',') && !raw.includes('.') ? raw.replace(',', '.') : raw.replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

/**
 * Ekstrak nilai numerik zat gizi dari satu baris tabel, dengan memprioritaskan
 * angka yang diikuti satuan gizi (kkal/kal/kj/mg/g/ml) dibanding angka % AKG di kanan.
 */
export function parseNumber(
  value: string,
  field?: keyof ExtractionResponse['gizi'],
): number | null {
  const cleaned = normalizeNumericTokens(value);

  // 1. Cari angka yang langsung diikuti satuan gizi (bukan %).
  const withUnitMatches = [
    ...cleaned.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(kkal|kcal|kal|kj|mg|ml|g(?![a-z]{2}))/gi),
  ];
  if (withUnitMatches.length > 0) {
    if (field === 'energi_kkal') {
      const kkalMatch = withUnitMatches.find((m) => /kkal|kcal|kal/i.test(m[2]));
      if (kkalMatch) return parseSingleNumber(kkalMatch[1]);
      const kjMatch = withUnitMatches.find((m) => /^kj$/i.test(m[2]));
      if (kjMatch) {
        const kj = parseSingleNumber(kjMatch[1]);
        return kj !== null ? Math.round(kj / 4.184) : null;
      }
    }
    return parseSingleNumber(withUnitMatches[0][1]);
  }

  // 2. Tangani salah baca huruf 'g' di akhir angka menjadi '9'/'8'/'B' (mis. "Gula 49" -> 4 g, "Gula 198" -> 19 g).
  const withoutPercent = cleaned.replace(/-?\d+(?:[.,]\d+)?\s*%/g, ' ');
  if (!field || gramFields.has(field)) {
    const spacedNineGram = withoutPercent.match(/\b(\d+(?:[.,]\d+)?)\s+[89B]\b/);
    if (spacedNineGram) {
      return parseSingleNumber(spacedNineGram[1]);
    }
    const attachedGram = withoutPercent.match(/(?:^|[\s:a-z()])(\d{1,2})[89B](?=\b|\s|\.|!|$)/i);
    if (attachedGram && (field ? gramFields.has(field) : attachedGram[0].endsWith('9'))) {
      return parseSingleNumber(attachedGram[1]);
    }
  }

  // 3. Jika tidak ada satuan eksplisit, ambil angka pertama yang BUKAN persentase (%).
  const plainMatch = withoutPercent.match(/-?\d+(?:[.,]\d+)?/);
  if (plainMatch) {
    return parseSingleNumber(plainMatch[0]);
  }

  return null;
}

function numeric(nilai: number | null, text: string, score: number) {
  return { nilai, teks_asli: text, keyakinan: score };
}

function isServingPerPackageLine(clean: string): boolean {
  const c = clean.replace(/rn/g, 'm').replace(/\s+/g, '');
  if (
    c.includes('sajianperkemasa') ||
    c.includes('sajanperkemasa') ||
    c.includes('servingsperpackage') ||
    c.includes('servingperpackage') ||
    c.includes('servingperpack') ||
    c.includes('seringerpack') ||
    c.includes('servingpercontainer') ||
    c.includes('servingspercontainer') ||
    c.includes('servingpercomtainer')
  ) {
    return true;
  }
  if (c.includes('kemasa') && /sa[jli1a]/.test(c)) return true;
  if ((c.includes('container') || c.includes('comtainer')) && c.includes('per')) return true;
  return false;
}

function isServingSizeLine(clean: string, compact: string): boolean {
  if (compact.includes('takaransaji') || compact.includes('servingsize')) return true;
  if (/ta[kl]{1,2}aran\s*sa[jli1]/i.test(clean)) return true;
  if (/se?rv[i1l]?ng\s*s[i1l]?ze/i.test(clean)) return true;
  return false;
}

export function parseNutritionLines(lines: OcrLine[]): ExtractionResponse {
  const mergedLines = groupLinesByRow(lines);
  const gizi = Object.fromEntries(
    required.map((field) => [field, numeric(null, '', 0)]),
  ) as ExtractionResponse['gizi'];
  const matchedSpecificity: Partial<Record<keyof ExtractionResponse['gizi'], number>> = {};
  const matchedHasUnit: Partial<Record<keyof ExtractionResponse['gizi'], boolean>> = {};
  const warnings: string[] = [];
  let basisTabel: ExtractionResponse['basis_tabel'] = 'tidak_diketahui';
  let serving = numeric(null, '', 0);
  let servingsPerPackage = numeric(null, '', 0);
  let netContent = numeric(null, '', 0);

  for (const line of mergedLines) {
    const text = line.text.trim();
    const clean = normalize(text);
    const compact = clean.replace(/\s+/g, '');
    if (!clean || isFootnoteLine(clean)) continue;

    if (
      (compact.includes('persajian') ||
        compact.includes('perserving') ||
        compact.includes('amountper') ||
        compact.includes('jumlahper') ||
        /um[l1i]?a[hm]\s*p[e]?r/i.test(clean)) &&
      !isServingPerPackageLine(clean)
    ) {
      basisTabel = 'per_sajian';
    }
    if (
      (compact.includes('perkemasan') || compact.includes('perpackage')) &&
      !isServingPerPackageLine(clean)
    ) {
      basisTabel = 'per_kemasan';
    }
    if (compact.includes('per100')) basisTabel = 'per_100';

    if (isServingSizeLine(clean, compact)) {
      const val = parseNumber(text);
      if (val !== null && (serving.nilai === null || line.score > (serving.keyakinan ?? 0))) {
        serving = numeric(val, text, line.score);
      }
    }

    if (isServingPerPackageLine(clean)) {
      const normalizedLeading = text.replace(/^[Il](?=\s*(?:sajian|sajan|serving))/i, '1');
      const m = normalizedLeading.match(/(\d+(?:[.,]\d+)?)/);
      const val = m ? parseSingleNumber(m[1]) : null;
      if (
        val !== null &&
        (servingsPerPackage.nilai === null || line.score > (servingsPerPackage.keyakinan ?? 0))
      ) {
        servingsPerPackage = numeric(val, text, line.score);
      }
    }

    if (
      compact.includes('beratbersih') ||
      compact.includes('netweight') ||
      compact.includes('isibersih')
    ) {
      const val = parseNumber(text);
      if (val !== null) netContent = numeric(val, text, line.score);
    }

    const term = findTerm(text);
    if (term) {
      const field = nutrientTerms[term.key];
      let candidateText = text;
      let candidateScore = line.score;
      let fieldNumber = parseNumber(candidateText, field);

      // Jika baris Energi belum memiliki angka (mis. kolom kanan miring/terlipat ke bawah),
      // cari kotak angka kkal/kcal yang berada di sebelah kanan dalam rentang vertikal dekat.
      if (fieldNumber === null && field === 'energi_kkal') {
        const lineCy = (line.box[1] + line.box[3]) / 2;
        const nearbyRight = lines
          .filter((other) => {
            const otherCy = (other.box[1] + other.box[3]) / 2;
            return (
              other.box[0] > line.box[2] - 20 &&
              otherCy >= lineCy - 15 &&
              otherCy <= lineCy + 42 &&
              /\d+\s*(?:kkal|kcal|kal|kj)/i.test(normalizeNumericTokens(other.text))
            );
          })
          .sort((a, b) => a.box[1] - b.box[1]);
        const matchRight = nearbyRight[0];
        if (matchRight) {
          fieldNumber = parseNumber(matchRight.text, field);
          if (fieldNumber !== null) {
            candidateText = `${text} ${matchRight.text.trim()}`;
            candidateScore = (line.score + matchRight.score) / 2;
          }
        }
      }

      if (fieldNumber !== null) {
        const specificity = term.key.length;
        const hasUnit = hasExplicitUnit(candidateText);
        const prevSpec = matchedSpecificity[field] ?? 0;
        const prevUnit = matchedHasUnit[field] ?? false;
        const prevConf = gizi[field]?.keyakinan ?? 0;
        const isBetter =
          gizi[field]?.nilai === null ||
          (hasUnit && !prevUnit) ||
          (hasUnit === prevUnit &&
            (specificity > prevSpec || (specificity === prevSpec && candidateScore > prevConf)));
        if (isBetter) {
          gizi[field] = numeric(fieldNumber, candidateText, candidateScore);
          matchedSpecificity[field] = specificity;
          matchedHasUnit[field] = hasUnit;
        }
      }
    }
  }

  const missing = required.filter((field) => gizi[field].nilai === null);
  if (missing.length) warnings.push(`Field belum terbaca: ${missing.join(', ')}`);
  const gula = gizi.gula_g.nilai;
  const karbo = gizi.karbohidrat_g.nilai;
  if (gula !== null && karbo !== null && gula > karbo)
    warnings.push('Gula lebih besar dari karbohidrat total.');

  return {
    skema_versi: '1.0',
    status:
      missing.length === 0 ? 'berhasil' : missing.length < required.length ? 'sebagian' : 'gagal',
    jenis_produk_tebakan: cleanProductType(mergedLines),
    basis_tabel: basisTabel,
    takaran_saji: { ...serving, satuan: null, urt: null },
    sajian_per_kemasan: servingsPerPackage,
    isi_bersih: { ...netContent, satuan: null },
    gizi: {
      ...gizi,
      laktosa_g: gizi.laktosa_g ?? numeric(null, '', 0),
      serat_g: gizi.serat_g ?? numeric(null, '', 0),
    },
    petunjuk_seduh_ml: numeric(null, '', 0),
    persen_akg_tercetak: {},
    nutri_level_tercetak: { huruf: null },
    peringatan_ekstraksi: warnings,
  };
}

function cleanProductType(lines: OcrLine[]) {
  const text = normalize(lines.map((line) => line.text).join(' '));
  if (text.includes('minuman')) return 'minuman_siap_minum';
  return 'makanan';
}
