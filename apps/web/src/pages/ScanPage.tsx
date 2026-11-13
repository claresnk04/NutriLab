import { useEffect, useMemo, useState } from 'react';
import {
  evaluate,
  type AssessmentResult,
  type ProductInput,
  type ProfileInput,
} from '@nutri-lab/scoring';
import { useAuth } from '../auth/useAuth';
import { saveEntry } from '../firestore/entryRepository';
import { getProfile } from '../firestore/profileRepository';
import { blobToImageData } from '../ocr/imageTransform';
import { runClientOcr } from '../ocr/workerClient';
import { hasGeminiApiKey, runGeminiOcr } from '../ai/geminiOcr';
import { hasGroqApiKey, runGroqOcr } from '../ai/groqOcr';
import type { OcrProgress } from '../ocr/types';
import type { ExtractionResponse } from '../schemas/extraction';
import CameraCapture from '../components/CameraCapture';

const NUTRIENT_FIELDS = [
  ['energi_kkal', 'Energi (kkal)'],
  ['lemak_total_g', 'Lemak total (g)'],
  ['lemak_jenuh_g', 'Lemak jenuh (g)'],
  ['protein_g', 'Protein (g)'],
  ['karbohidrat_g', 'Karbohidrat (g)'],
  ['gula_g', 'Gula (g)'],
  ['natrium_mg', 'Natrium (mg)'],
] as const;

export default function ScanPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [rotation, setRotation] = useState(0);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [servings, setServings] = useState(1);
  const [profile, setProfile] = useState<ProfileInput>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [ocrSource, setOcrSource] = useState('');

  useEffect(() => {
    if (!user) return;
    void getProfile(user.uid)
      .then(setProfile)
      .catch(() => undefined);
  }, [user]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const product = useMemo(() => (extraction ? toProductInput(extraction) : null), [extraction]);

  function chooseFile(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith('image/')) {
      setError('Pilih file gambar JPG, PNG, atau HEIC.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setExtraction(null);
    setAssessment(null);
    setSaved('');
    setError('');
    setRotation(0);
  }

  async function runOcr() {
    if (!file) return;
    setError('');
    setSaved('');
    setOcrSource('');
    try {
      const image = await blobToImageData(file, rotation);
      let fallbackReason = '';
      if (hasGeminiApiKey() && navigator.onLine) {
        try {
          const result = await runGeminiOcr(image, setProgress);
          setExtraction(result);
          setOcrSource(`Gemini AI (${result.modelUsed})`);
          setAssessment(null);
          return;
        } catch (caught) {
          console.warn('Gemini OCR gagal, mencoba fallback berikutnya.', caught);
          fallbackReason = 'Gemini tidak tersedia';
        }
      } else {
        fallbackReason = hasGeminiApiKey() ? 'perangkat offline' : 'API key Gemini belum diisi';
      }

      if (hasGroqApiKey() && navigator.onLine) {
        try {
          const result = await runGroqOcr(image, setProgress);
          setExtraction(result);
          setOcrSource(`Groq AI (${result.modelUsed} — fallback: ${fallbackReason})`);
          setAssessment(null);
          return;
        } catch (caught) {
          console.warn('Groq OCR gagal, beralih ke PaddleOCR lokal.', caught);
          fallbackReason = 'Gemini & Groq tidak tersedia';
        }
      }

      const output = await runClientOcr(image, { onProgress: setProgress });
      setExtraction(output.extraction);
      setOcrSource(`PaddleOCR lokal (fallback: ${fallbackReason})`);
      setAssessment(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'OCR gagal dijalankan.');
    }
  }

  function updateNutrient(field: (typeof NUTRIENT_FIELDS)[number][0], value: string) {
    if (!extraction) return;
    const number = value === '' ? null : Number(value);
    setExtraction({
      ...extraction,
      gizi: {
        ...extraction.gizi,
        [field]: { ...extraction.gizi[field], nilai: Number.isFinite(number) ? number : null },
      },
    });
  }

  function updateHeaderNumber(field: 'takaran_saji' | 'sajian_per_kemasan', value: string) {
    if (!extraction) return;
    const number = value === '' ? null : Number(value);
    setExtraction({
      ...extraction,
      [field]: {
        ...extraction[field],
        nilai: Number.isFinite(number) ? number : null,
      },
    });
  }

  function assess() {
    if (!product) return;
    setAssessment(evaluate({ profile, product, servings, confirmedWarnings: true }));
  }

  async function save(status: 'dicek' | 'dimakan') {
    if (!user || !extraction || !assessment || !product) return;
    try {
      await saveEntry({
        uid: user.uid,
        jenisProduk: product.jenisProduk,
        basisTabel: product.basisTabel,
        nilaiLabel: extraction,
        nSajian: servings,
        status,
        waktuMakan: new Date().toISOString(),
        zonaWaktu: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dikonfirmasiPengguna: true,
        hasilSnapshot: assessment,
        configVersion: assessment.configVersion,
      });
      setSaved(`Entri disimpan sebagai “${status}”.`);
    } catch {
      setError('Entri gagal disimpan. Coba lagi saat koneksi tersedia.');
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">F-04 sampai F-09</p>
        <h1 className="mt-1 text-3xl font-bold">Scan</h1>
        <h2 className="mt-1 text-lg font-semibold">Scan label gizi</h2>
        <p className="mt-2 text-slate-600">
          Foto dianalisis dengan Gemini AI bila tersedia, dan otomatis memakai OCR lokal (PaddleOCR
          ONNX) saat offline atau Gemini tidak tersedia. Putar gambar jika label belum tegak, lalu
          periksa semua angka sebelum menyimpan.
        </p>
      </div>

      <CameraCapture onCapture={chooseFile} onError={setError} />

      <label className="block rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center">
        <span className="font-semibold">Atau pilih foto dari perangkat</span>
        <input
          className="mt-3 block w-full text-sm"
          type="file"
          accept="image/*"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
      </label>

      {preview && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <img
            className="max-h-72 w-full object-contain"
            style={{ transform: `rotate(${rotation}deg)` }}
            src={preview}
            alt="Pratinjau label yang dipilih"
          />
          <div className="mt-3 flex gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="button"
              onClick={() => setRotation((value) => value - 90)}
            >
              Putar kiri
            </button>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="button"
              onClick={() => setRotation((value) => value + 90)}
            >
              Putar kanan
            </button>
            <button
              className="ml-auto rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={runOcr}
            >
              Jalankan OCR
            </button>
          </div>
        </div>
      )}

      {progress && (
        <div className="rounded-xl bg-slate-100 p-4" role="status">
          {progress.phase} — {progress.percent}%
        </div>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          {saved}
        </p>
      )}

      {extraction && (
        <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <div>
            <h2 className="text-xl font-bold">Periksa hasil ekstraksi</h2>
            <p className="text-sm text-slate-600">
              Status OCR: {extraction.status}. Koreksi angka jika tidak sesuai label.
            </p>
            {ocrSource && (
              <p className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Sumber OCR: {ocrSource}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span>Takaran saji (g/ml)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                type="number"
                step="any"
                value={extraction.takaran_saji.nilai ?? ''}
                onChange={(event) => updateHeaderNumber('takaran_saji', event.target.value)}
              />
            </label>
            <label className="text-sm">
              <span>Sajian per kemasan</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                type="number"
                step="any"
                value={extraction.sajian_per_kemasan.nilai ?? ''}
                onChange={(event) => updateHeaderNumber('sajian_per_kemasan', event.target.value)}
              />
            </label>
            {NUTRIENT_FIELDS.map(([field, label]) => (
              <label key={field} className="text-sm">
                <span>{label}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  step="any"
                  value={extraction.gizi[field].nilai ?? ''}
                  onChange={(event) => updateNutrient(field, event.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="block text-sm">
            Jumlah sajian dimakan
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              type="number"
              min="0.25"
              max="10"
              step="0.25"
              value={servings}
              onChange={(event) => setServings(Number(event.target.value))}
            />
          </label>
          <button
            className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white"
            type="button"
            onClick={assess}
          >
            Hitung penilaian
          </button>
        </div>
      )}

      {assessment && (
        <div className="space-y-4 rounded-2xl border border-brand/30 bg-teal-50 p-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">
              Hasil edukasi
            </p>
            <h2 className="mt-1 text-2xl font-bold">{assessment.status.replaceAll('_', ' ')}</h2>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {assessment.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="rounded-xl border border-brand px-3 py-3 font-semibold text-brand"
              type="button"
              onClick={() => save('dicek')}
            >
              Cek saja
            </button>
            <button
              className="rounded-xl bg-brand px-3 py-3 font-semibold text-white"
              type="button"
              onClick={() => save('dimakan')}
            >
              Saya makan ini
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function toProductInput(value: ExtractionResponse): ProductInput {
  const jenis = value.jenis_produk_tebakan;
  const jenisProduk: ProductInput['jenisProduk'] =
    jenis === 'minuman_siap_minum' ||
    jenis === 'minuman_bubuk_konsentrat' ||
    jenis === 'susu_cair_plain' ||
    jenis === 'susu_bubuk_plain'
      ? jenis
      : 'makanan';
  return {
    jenisProduk,
    basisTabel: value.basis_tabel,
    takaranSaji: value.takaran_saji.nilai,
    isiBersih: value.isi_bersih.nilai,
    sajianPerKemasan: value.sajian_per_kemasan.nilai,
    energiKkal: value.gizi.energi_kkal.nilai,
    lemakTotalG: value.gizi.lemak_total_g.nilai,
    lemakJenuhG: value.gizi.lemak_jenuh_g.nilai,
    proteinG: value.gizi.protein_g.nilai,
    karbohidratG: value.gizi.karbohidrat_g.nilai,
    gulaG: value.gizi.gula_g.nilai,
    laktosaG: value.gizi.laktosa_g.nilai,
    seratG: value.gizi.serat_g.nilai,
    natriumMg: value.gizi.natrium_mg.nilai,
    nutriLevel: value.nutri_level_tercetak.huruf,
  };
}
