/**
 * @nutri-lab/scoring
 *
 * Mesin penilaian berbasis aturan (PRD v1.1 bagian 10, algoritma v0.3).
 *
 * Prinsip: deterministik, berversi (`ALGORITHM_VERSION` + `configVersion`), tanpa I/O.
 */

export const ALGORITHM_VERSION = '0.3';

/** Status akhir penilaian (PRD 10.12). */
export type AssessmentStatus = 'hijau' | 'kuning' | 'merah' | 'tidak_dapat_dinilai';

/** Jenis produk (PRD F06-2). */
export type ProductType =
  | 'makanan'
  | 'minuman_siap_minum'
  | 'minuman_bubuk_konsentrat'
  | 'susu_cair_plain'
  | 'susu_bubuk_plain';

export interface AssessmentResult {
  status: AssessmentStatus;
  reasons: string[];
  algorithmVersion: string;
  configVersion: string;
  layers?: Record<string, AssessmentStatus>;
  limits?: DailyLimits;
  badges?: BadgeResult;
  normalized?: NormalizedProduct;
}

export interface ProfileInput {
  jenisKelamin?: 'M' | 'F';
  beratKg?: number;
  tinggiCm?: number;
  usia?: number;
  aktivitas?: keyof typeof ACTIVITY_FACTORS;
  targetKaloriManual?: number;
}

export interface ProductInput {
  jenisProduk: ProductType;
  basisTabel: 'per_sajian' | 'per_kemasan' | 'per_100' | 'tidak_diketahui';
  takaranSaji?: number | null;
  isiBersih?: number | null;
  sajianPerKemasan?: number | null;
  energiKkal: number | null;
  lemakTotalG: number | null;
  lemakJenuhG: number | null;
  proteinG: number | null;
  karbohidratG: number | null;
  gulaG: number | null;
  laktosaG?: number | null;
  seratG?: number | null;
  natriumMg: number | null;
  nutriLevel?: string | null;
}

export interface TodayTotals {
  gulaG: number;
  karbohidratG: number;
  lemakJenuhG: number;
  natriumMg: number;
  energiKkal: number;
}

export interface ScoringInput {
  profile: ProfileInput;
  product: ProductInput;
  servings: number;
  today?: TodayTotals;
  confirmedWarnings?: boolean;
  config?: Partial<ScoringConfig>;
}

export interface DailyLimits {
  energyKkal: number;
  sugarG: number;
  carbohydrateG: number;
  saturatedFatG: number;
  sodiumMg: number;
  source: 'manual' | 'formula' | 'default';
}

export interface NormalizedProduct {
  per100: Record<string, number>;
  serving: Record<string, number>;
  eaten: Record<string, number>;
  sugarNlPer100: number;
}

export interface BadgeResult {
  saturatedFatRatio: number;
  sodiumRatio: number;
  energyRatio: number;
}

export interface ScoringConfig {
  version: string;
  defaultEnergy: number;
  carbohydrateFloor: number;
  sodiumMg: number;
  energyTolerance: number;
  bodyWeightCorrection: number;
  activityFactors: Record<string, number>;
  sugarGreen: number;
  sugarYellow: number;
  sugarTotalGreen: number;
  sugarTotalYellow: number;
  carbohydrateTotalGreen: number;
  carbohydrateTotalYellow: number;
  carbohydrateScoreGreen: number;
  carbohydrateScoreYellow: number;
}

export const ACTIVITY_FACTORS = {
  istirahat: 0.1,
  ringan: 0.2,
  sedang: 0.3,
  berat: 0.4,
  sangat_berat: 0.5,
} as const;

const DEFAULT_CONFIG: ScoringConfig = {
  version: '0.3-default',
  defaultEnergy: 1800,
  carbohydrateFloor: 130,
  sodiumMg: 1500,
  energyTolerance: 0.25,
  bodyWeightCorrection: 0.2,
  activityFactors: ACTIVITY_FACTORS,
  sugarGreen: 0.25,
  sugarYellow: 0.5,
  sugarTotalGreen: 0.7,
  sugarTotalYellow: 1,
  carbohydrateTotalGreen: 0.7,
  carbohydrateTotalYellow: 1,
  carbohydrateScoreGreen: 0.15,
  carbohydrateScoreYellow: 0.3,
};

export function computeDailyLimits(
  profile: ProfileInput,
  partial?: Partial<ScoringConfig>,
): DailyLimits {
  const config = { ...DEFAULT_CONFIG, ...partial };
  let energy = config.defaultEnergy;
  let source: DailyLimits['source'] = 'default';

  if (
    profile.targetKaloriManual &&
    profile.targetKaloriManual >= 1000 &&
    profile.targetKaloriManual <= 4000
  ) {
    energy = profile.targetKaloriManual;
    source = 'manual';
  } else if (profile.jenisKelamin && profile.tinggiCm && profile.beratKg) {
    const smallHeight =
      profile.jenisKelamin === 'M' ? profile.tinggiCm < 160 : profile.tinggiCm < 150;
    const bbi = smallHeight ? profile.tinggiCm - 100 : 0.9 * (profile.tinggiCm - 100);
    const kkb = bbi * (profile.jenisKelamin === 'F' ? 25 : 30);
    const activity = config.activityFactors[profile.aktivitas ?? 'ringan'] ?? 0.2;
    const age = profile.usia
      ? profile.usia >= 70
        ? -0.2
        : profile.usia >= 60
          ? -0.1
          : profile.usia >= 40
            ? -0.05
            : 0
      : 0;
    const body =
      profile.beratKg > 1.1 * bbi
        ? -config.bodyWeightCorrection
        : profile.beratKg < 0.9 * bbi
          ? config.bodyWeightCorrection
          : 0;
    const floor = profile.jenisKelamin === 'F' ? 1000 : 1200;
    energy = Math.max(kkb * (1 + activity + age + body), floor);
    source = 'formula';
  }

  return {
    energyKkal: round(energy, 2),
    sugarG: round((0.05 * energy) / 4, 2),
    carbohydrateG: round(Math.max((0.55 * energy) / 4, config.carbohydrateFloor), 2),
    saturatedFatG: round((0.07 * energy) / 9, 2),
    sodiumMg: config.sodiumMg,
    source,
  };
}

export function evaluate(input: unknown, configVersion = 'unset'): AssessmentResult {
  if (!isScoringInput(input)) {
    return invalidResult(['Data profil atau label belum lengkap.'], configVersion);
  }
  const config = { ...DEFAULT_CONFIG, ...input.config };
  const limits = computeDailyLimits(input.profile, config);
  const product = input.product;
  const today = input.today ?? {
    gulaG: 0,
    karbohidratG: 0,
    lemakJenuhG: 0,
    natriumMg: 0,
    energiKkal: 0,
  };
  const missing = REQUIRED_FIELDS.filter(
    (field) => product[field] === null || product[field] === undefined,
  );
  const negative = REQUIRED_FIELDS.some((field) => Number(product[field]) < 0);
  if (missing.length || negative || (product.gulaG ?? 0) > (product.karbohidratG ?? 0)) {
    return invalidResult(
      [
        ...(missing.length ? [`Data wajib kosong: ${missing.join(', ')}`] : []),
        ...(negative ? ['Nilai gizi tidak boleh negatif.'] : []),
        ...((product.gulaG ?? 0) > (product.karbohidratG ?? 0)
          ? ['Gula lebih besar dari karbohidrat total.']
          : []),
      ],
      config.version,
      limits,
    );
  }

  const warnings: string[] = [];
  const atwater = 4 * product.karbohidratG! + 4 * product.proteinG! + 9 * product.lemakTotalG!;
  if (
    product.energiKkal! > 0 &&
    Math.abs(product.energiKkal! - atwater) / product.energiKkal! > config.energyTolerance
  )
    warnings.push('Energi berbeda dari hitungan Atwater.');
  if (product.gulaG! > 50) warnings.push('Gula lebih dari 50 g per sajian.');
  if (warnings.length && !input.confirmedWarnings)
    return invalidResult(warnings, config.version, limits);

  const normalized = normalizeProduct(product, input.servings);
  const quality = qualityAssessment(product, normalized);
  const carbohydrateRatio = normalized.eaten.karbohidratG / limits.carbohydrateG;
  const qualityAdjustment =
    product.karbohidratG === 0
      ? 1
      : 1 +
        0.5 * (product.gulaG! / product.karbohidratG!) -
        0.2 * Math.min((product.seratG ?? 0) / product.karbohidratG! / 0.1, 1);
  const carbohydrateScore = carbohydrateRatio * qualityAdjustment;
  const sugarRatio = normalized.eaten.gulaG / limits.sugarG;
  const sugarTotalRatio = (today.gulaG + normalized.eaten.gulaG) / limits.sugarG;
  const carbohydrateTotalRatio =
    (today.karbohidratG + normalized.eaten.karbohidratG) / limits.carbohydrateG;
  const layers: Record<string, AssessmentStatus> = {
    S_karbo: band(carbohydrateScore, config.carbohydrateScoreGreen, config.carbohydrateScoreYellow),
    G: band(sugarRatio, config.sugarGreen, config.sugarYellow),
    G_total: band(sugarTotalRatio, config.sugarTotalGreen, config.sugarTotalYellow, false),
    K_total: band(
      carbohydrateTotalRatio,
      config.carbohydrateTotalGreen,
      config.carbohydrateTotalYellow,
      false,
    ),
  };
  if (quality.band) layers.quality = quality.band;
  const status = worst(Object.values(layers));
  const finalStatus =
    product.jenisProduk === 'makanan' && ['D', 'E'].includes(quality.className ?? '')
      ? maxStatus(status, 'kuning')
      : status;
  const reasons = buildReasons(
    layers,
    normalized,
    sugarRatio,
    sugarTotalRatio,
    carbohydrateTotalRatio,
    quality.className,
  );
  return {
    status: finalStatus,
    reasons: warnings.concat(reasons),
    algorithmVersion: ALGORITHM_VERSION,
    configVersion: config.version || configVersion,
    layers,
    limits,
    badges: {
      saturatedFatRatio: normalized.eaten.lemakJenuhG / limits.saturatedFatG,
      sodiumRatio: normalized.eaten.natriumMg / limits.sodiumMg,
      energyRatio: normalized.eaten.energiKkal / limits.energyKkal,
    },
    normalized,
  };
}

const REQUIRED_FIELDS: Array<keyof ProductInput> = [
  'energiKkal',
  'lemakTotalG',
  'lemakJenuhG',
  'proteinG',
  'karbohidratG',
  'gulaG',
  'natriumMg',
];

function isScoringInput(value: unknown): value is ScoringInput {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScoringInput>;
  return Boolean(
    candidate.profile &&
    candidate.product &&
    typeof candidate.servings === 'number' &&
    candidate.servings > 0,
  );
}

function invalidResult(
  reasons: string[],
  configVersion: string,
  limits?: DailyLimits,
): AssessmentResult {
  return {
    status: 'tidak_dapat_dinilai',
    reasons,
    algorithmVersion: ALGORITHM_VERSION,
    configVersion,
    limits,
  };
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function band(
  value: number,
  green: number,
  yellow: number,
  inclusiveGreen = true,
): AssessmentStatus {
  const rounded = round(value, 3);
  if (inclusiveGreen ? rounded <= green : rounded < green) return 'hijau';
  return rounded <= yellow ? 'kuning' : 'merah';
}

function worst(values: AssessmentStatus[]) {
  return values.reduce<AssessmentStatus>((current, value) => maxStatus(current, value), 'hijau');
}

function maxStatus(a: AssessmentStatus, b: AssessmentStatus): AssessmentStatus {
  const rank: Record<AssessmentStatus, number> = {
    hijau: 0,
    kuning: 1,
    merah: 2,
    tidak_dapat_dinilai: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}

function normalizeProduct(product: ProductInput, servings: number): NormalizedProduct {
  const basisSize =
    product.basisTabel === 'per_100'
      ? 100
      : product.basisTabel === 'per_kemasan'
        ? (product.isiBersih ?? 1)
        : (product.takaranSaji ?? 1);
  const factor = basisSize > 0 ? 100 / basisSize : 1;
  const value = (key: keyof ProductInput) => Number(product[key] ?? 0);
  const per100 = {
    energiKkal: round(value('energiKkal') * factor, 1),
    lemakTotalG: round(value('lemakTotalG') * factor, 1),
    lemakJenuhG: round(value('lemakJenuhG') * factor, 1),
    proteinG: round(value('proteinG') * factor, 1),
    karbohidratG: round(value('karbohidratG') * factor, 1),
    gulaG: round(value('gulaG') * factor, 1),
    seratG: round(value('seratG') * factor, 1),
    natriumMg: round(value('natriumMg') * factor, 1),
  };
  const servingFactor =
    product.basisTabel === 'per_sajian'
      ? 1
      : product.basisTabel === 'per_100'
        ? (product.takaranSaji ?? 100) / 100
        : (product.takaranSaji ?? basisSize) / basisSize;
  const serving = Object.fromEntries(
    Object.entries(per100).map(([key, item]) => [key, item * servingFactor]),
  ) as Record<string, number>;
  const eaten = Object.fromEntries(
    Object.entries(serving).map(([key, item]) => [key, item * servings]),
  ) as Record<string, number>;
  return {
    per100,
    serving,
    eaten,
    sugarNlPer100: Math.max(0, per100.gulaG - Number(product.laktosaG ?? 0) * factor),
  };
}

function qualityAssessment(product: ProductInput, normalized: NormalizedProduct) {
  if (product.jenisProduk !== 'makanan') {
    const sugar = normalized.sugarNlPer100;
    const sodium = normalized.per100.natriumMg;
    const fatExcluded = product.jenisProduk.startsWith('susu_');
    const levels = [
      sugar <= 0.5 ? 'A' : sugar <= 6 ? 'B' : sugar <= 12.5 ? 'C' : 'D',
      sodium <= 5 ? 'A' : sodium <= 120 ? 'B' : sodium <= 500 ? 'C' : 'D',
    ];
    if (!fatExcluded)
      levels.push(
        normalized.per100.lemakTotalG <= 0.5
          ? 'A'
          : normalized.per100.lemakTotalG <= 3
            ? 'B'
            : normalized.per100.lemakTotalG <= 17
              ? 'C'
              : 'D',
      );
    const className = levels.sort().at(-1) ?? 'D';
    return {
      className,
      band:
        className === 'A' || className === 'B'
          ? ('hijau' as const)
          : className === 'C'
            ? ('kuning' as const)
            : ('merah' as const),
    };
  }
  const negative =
    countThresholds(
      normalized.per100.energiKkal * 4.184,
      Array.from({ length: 10 }, (_, index) => 335 * (index + 1)),
    ) +
    countThresholds(
      normalized.per100.gulaG,
      [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
    ) +
    countThresholds(
      normalized.per100.lemakJenuhG,
      Array.from({ length: 10 }, (_, index) => index + 1),
    ) +
    countThresholds(
      (normalized.per100.natriumMg * 2.5) / 1000,
      Array.from({ length: 20 }, (_, index) => 0.2 * (index + 1)),
    );
  const positive =
    countThresholds(normalized.per100.proteinG, [2.4, 4.8, 7.2, 9.6, 12, 14, 17]) +
    countThresholds(normalized.per100.seratG, [3, 4.1, 5.2, 6.3, 7.4]);
  const score =
    negative < 11
      ? negative - positive
      : negative - countThresholds(normalized.per100.seratG, [3, 4.1, 5.2, 6.3, 7.4]);
  const className =
    score <= 0 ? 'A' : score <= 2 ? 'B' : score <= 10 ? 'C' : score <= 18 ? 'D' : 'E';
  return {
    className,
    band:
      className === 'A' || className === 'B'
        ? ('hijau' as const)
        : className === 'C'
          ? ('kuning' as const)
          : ('merah' as const),
  };
}

function countThresholds(value: number, thresholds: number[]) {
  return thresholds.filter((threshold) => value > threshold).length;
}

function buildReasons(
  layers: Record<string, AssessmentStatus>,
  product: NormalizedProduct,
  sugar: number,
  sugarTotal: number,
  carbohydrateTotal: number,
  quality?: string,
) {
  const reasons: string[] = [];
  if (layers.G_total === 'merah')
    reasons.push(
      `Gula ${round(product.eaten.gulaG, 1)} g melebihi batas harian setelah porsi ini.`,
    );
  else if (layers.G_total === 'kuning')
    reasons.push(`Setelah porsi ini, ${round(sugarTotal * 100, 0)}% batas gula harian terpakai.`);
  if (layers.K_total !== 'hijau')
    reasons.push(
      `Setelah porsi ini, ${round(carbohydrateTotal * 100, 0)}% anggaran karbohidrat terpakai.`,
    );
  if (layers.G === 'kuning' || layers.G === 'merah')
    reasons.push(`Satu porsi memakai ${round(sugar * 100, 0)}% batas gula harian.`);
  if (quality) reasons.push(`Kualitas produk per 100 g/ml berada pada kelas ${quality}.`);
  return reasons.length
    ? reasons
    : ['Porsi dan akumulasi harian masih berada dalam batas yang dihitung.'];
}
