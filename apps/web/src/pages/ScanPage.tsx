import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowRight,
  Camera,
  ChevronDown,
  ChevronUp,
  Image,
  Keyboard,
  RefreshCw,
  RotateCcw,
  ScanLine,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import type { ExtractionResponse } from '../schemas/extraction';
import Shell from '../components/layout/Shell';
import { hasGeminiApiKey, runGeminiOcr } from '../ai/geminiOcr';
import { hasGroqApiKey, runGroqOcr } from '../ai/groqOcr';
import { blobToImageData } from '../ocr/imageTransform';
import { runClientOcr } from '../ocr/workerClient';
import { useScanStore } from '../store/scanStore';

const MAX_CAPTURE_DIMENSION = 1280;

interface FormValues {
  product: string;
  serving: string;
  servings: string;
  energy: string;
  fat: string;
  saturatedFat: string;
  protein: string;
  carbohydrates: string;
  sugar: string;
  sodium: string;
}

const emptyValues: FormValues = {
  product: '',
  serving: '',
  servings: '1',
  energy: '',
  fat: '',
  saturatedFat: '',
  protein: '',
  carbohydrates: '',
  sugar: '',
  sodium: '',
};

function numeric(value: string, fallback: number | null = 0) {
  if (!value.trim()) return fallback;
  const normalized = value.replace(',', '.');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : fallback;
}

function field(nilai: number | null) {
  return { nilai, teks_asli: nilai === null ? '' : String(nilai), keyakinan: 1 };
}

function toExtraction(values: FormValues): ExtractionResponse {
  const productTitle = values.product.trim() || 'Produk Kemasan';
  return {
    skema_versi: '1.0',
    status: 'berhasil',
    jenis_produk_tebakan: productTitle,
    basis_tabel: 'per_sajian',
    takaran_saji: { ...field(numeric(values.serving, 100)), satuan: 'g' },
    sajian_per_kemasan: field(numeric(values.servings, 1)),
    isi_bersih: { ...field(null), satuan: 'g' },
    gizi: {
      energi_kkal: field(numeric(values.energy, 0)),
      lemak_total_g: field(numeric(values.fat, 0)),
      lemak_jenuh_g: field(numeric(values.saturatedFat, 0)),
      protein_g: field(numeric(values.protein, 0)),
      karbohidrat_g: field(numeric(values.carbohydrates, 0)),
      gula_g: field(numeric(values.sugar, 0)),
      laktosa_g: field(null),
      serat_g: field(null),
      natrium_mg: field(numeric(values.sodium, 0)),
    },
    petunjuk_seduh_ml: field(null),
    persen_akg_tercetak: {},
    nutri_level_tercetak: { huruf: null },
    peringatan_ekstraksi: [],
  };
}

function fromExtraction(extraction: ExtractionResponse): FormValues {
  const value = (item: { nilai: number | null }) => (item.nilai === null ? '' : String(item.nilai));
  return {
    product: extraction.jenis_produk_tebakan ?? '',
    serving: value(extraction.takaran_saji),
    servings: value(extraction.sajian_per_kemasan) || '1',
    energy: value(extraction.gizi.energi_kkal),
    fat: value(extraction.gizi.lemak_total_g),
    saturatedFat: value(extraction.gizi.lemak_jenuh_g),
    protein: value(extraction.gizi.protein_g),
    carbohydrates: value(extraction.gizi.karbohidrat_g),
    sugar: value(extraction.gizi.gula_g),
    sodium: value(extraction.gizi.natrium_mg),
  };
}

async function extractNutritionFromImage(image: ImageData): Promise<ExtractionResponse> {
  if (hasGeminiApiKey()) {
    try {
      return await runGeminiOcr(image);
    } catch (err) {
      console.warn('Gemini OCR gagal, beralih ke fallback berikutnya.', err);
    }
  }
  if (hasGroqApiKey()) {
    try {
      return await runGroqOcr(image);
    } catch (err) {
      console.warn('Groq OCR gagal, beralih ke PaddleOCR lokal.', err);
    }
  }
  const local = await runClientOcr(image);
  return local.extraction;
}

export default function ScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const manualOnly = searchParams.get('manual') === '1';
  const extraction = useScanStore((state) => state.extraction);
  const setImage = useScanStore((state) => state.setImage);
  const setExtraction = useScanStore((state) => state.setExtraction);
  const reset = useScanStore((state) => state.reset);

  const [manual, setManual] = useState(manualOnly);
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [values, setValues] = useState<FormValues>(() =>
    extraction ? fromExtraction(extraction) : emptyValues,
  );
  const [error, setError] = useState('');

  // In-place camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  useEffect(() => () => stopCamera(), []);

  async function startCamera(mode = facingMode) {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Browser ini tidak mendukung kamera langsung. Silakan gunakan Upload Foto.');
      return;
    }

    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: mode },
          width: { ideal: MAX_CAPTURE_DIMENSION, max: MAX_CAPTURE_DIMENSION },
          height: { ideal: MAX_CAPTURE_DIMENSION, max: MAX_CAPTURE_DIMENSION },
        },
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      stopCamera();
      setError('Kamera tidak dapat diakses. Periksa izin kamera atau gunakan Upload Foto.');
    }
  }

  async function switchCamera() {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError('Kamera belum siap. Tunggu sebentar lalu coba lagi.');
      return;
    }

    const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Canvas kamera tidak tersedia di perangkat ini.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Foto gagal diambil. Silakan coba lagi.');
          return;
        }
        stopCamera();
        void processFile(new File([blob], 'label-camera.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  }

  async function processFile(file: File) {
    setError('');
    setIsScanning(true);
    setImage(file);
    try {
      const image = await blobToImageData(file);
      const result = await extractNutritionFromImage(image);
      setExtraction(result);
      setValues(fromExtraction(result));
      setHasScanned(true);
      setManual(false);
    } catch {
      setError('Label kurang jelas terbaca. Silakan lengkapi angka gizi di bawah ini.');
      setHasScanned(true);
      setManual(true);
    } finally {
      setIsScanning(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      stopCamera();
      void processFile(file);
    }
    event.target.value = '';
  }

  function update(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleRetake() {
    setError('');
    setHasScanned(false);
    setManual(false);
    setValues(emptyValues);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (values.sugar.trim() === '' && values.energy.trim() === '' && values.saturatedFat.trim() === '') {
      setError('Masukkan minimal kandungan Gula atau Energi dari label kemasan.');
      return;
    }
    const next = toExtraction(values);
    setExtraction(next);
    navigate('/evaluation');
  }

  const showForm = !isScanning && (manual || hasScanned);

  return (
    <Shell
      backLabel="Kembali"
      title={manual ? 'Input Nilai Gizi' : 'Pindai Label Gizi'}
      onBack={() => {
        stopCamera();
        reset();
        navigate('/');
      }}
    >
      <main className="page scan-page">
        <div className="scan-layout">
          {!showForm && !isScanning && (
            <section className="card scanner-card">
              <header className="scanner-header">
                <h1>Pindai Label Gizi</h1>
                <p>Arahkan kamera ke tabel informasi nilai gizi pada kemasan makanan atau minuman.</p>
              </header>

              <div className={`scanner-viewport ${cameraActive ? 'is-live' : ''}`} aria-label="Jendela bidik kamera">
                {cameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      className="scanner-video"
                      autoPlay
                      playsInline
                      muted
                      aria-label="Pratinjau kamera"
                    />
                    <div className="scanner-live-guide" aria-hidden="true" />
                    <div className="scanner-Floating-tools">
                      <button
                        type="button"
                        className="scanner-icon-btn"
                        onClick={() => void switchCamera()}
                        title="Ganti kamera"
                      >
                        <RefreshCw size={16} /> Ganti
                      </button>
                      <button
                        type="button"
                        className="scanner-icon-btn"
                        onClick={stopCamera}
                        title="Tutup kamera"
                      >
                        <X size={16} /> Tutup
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="scanner-placeholder">
                    <div className="scan-frame">
                      <ScanLine className="scanner-center-icon" size={28} />
                      <span className="scan-laser" />
                    </div>
                    <span className="scanner-hint">Arahkan ke tabel nilai gizi</span>
                  </div>
                )}
              </div>

              {error && (
                <p className="small error-text" role="alert">
                  {error}
                </p>
              )}

              <div className="scanner-cta-stack">
                {cameraActive ? (
                  <button className="btn btn-capture is-capturing" type="button" onClick={capturePhoto}>
                    <span className="capture-shutter-dot" aria-hidden="true" />
                    Ambil Foto Sekarang
                  </button>
                ) : (
                  <button className="btn btn-capture" type="button" onClick={() => void startCamera()}>
                    <Camera size={20} />
                    Ambil Foto Kamera
                  </button>
                )}

                <div className="row scanner-secondary-row">
                  <label className="btn secondary upload-photo-button">
                    <Image size={16} />
                    Upload Foto
                    <input
                      type="file"
                      accept="image/*"
                      aria-label="Upload foto label gizi"
                      onChange={onFileChange}
                    />
                  </label>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      stopCamera();
                      setManual(true);
                    }}
                    type="button"
                  >
                    <Keyboard size={16} />
                    Ketik Manual
                  </button>
                </div>
              </div>
            </section>
          )}

          {isScanning && (
            <section className="card scan-loading-card" role="status" aria-live="polite">
              <div className="scan-loader-visual" aria-hidden="true">
                <div className="scan-loader-ring" />
                <div className="scan-loader-core">
                  <ScanLine size={26} />
                </div>
              </div>
              <div className="scan-loader-copy">
                <h2>Memindai Label Gizi</h2>
                <p>Membaca angka nutrisi dari foto kemasan secara otomatis…</p>
              </div>
              <div className="scan-loader-bar">
                <span />
              </div>
            </section>
          )}

          {showForm && (
            <form className="card validation-card" onSubmit={submit}>
              <header className="row validation-head">
                <div>
                  <span className="eyebrow">{manual && !hasScanned ? 'INPUT MANUAL' : 'HASIL PINDAI'}</span>
                  <h2>{manual && !hasScanned ? 'Masukkan Nilai Gizi' : 'Konfirmasi Nilai Gizi'}</h2>
                </div>
                <button className="link-button retake-link" type="button" onClick={handleRetake}>
                  <RotateCcw size={14} /> {hasScanned ? 'Foto ulang' : 'Pindai foto'}
                </button>
              </header>

              {error && (
                <p className="small error-text" role="alert">
                  {error}
                </p>
              )}

              <label className="field">
                <span>
                  Nama Makanan / Minuman <small className="field-optional">(opsional)</small>
                </span>
                <span className="input">
                  <input
                    placeholder="Contoh: Susu Kotak / Biskuit"
                    value={values.product}
                    onChange={(event) => update('product', event.target.value)}
                  />
                </span>
              </label>

              <div className="form-grid two-col">
                {(
                  [
                    ['sugar', 'Gula', 'g'],
                    ['saturatedFat', 'Lemak Jenuh', 'g'],
                    ['energy', 'Energi', 'kkal'],
                    ['serving', 'Takaran Saji', 'g/ml'],
                  ] as const
                ).map(([key, label, unit]) => (
                  <label className="field" key={key}>
                    {label}
                    <span className="input">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0"
                        value={values[key]}
                        onChange={(event) => update(key, event.target.value)}
                      />
                      <small>{unit}</small>
                    </span>
                  </label>
                ))}
              </div>

              <button
                type="button"
                className="more-fields-toggle"
                onClick={() => setShowMoreFields((prev) => !prev)}
              >
                <span>{showMoreFields ? 'Sembunyikan nutrisi tambahan' : 'Tampilkan nutrisi tambahan (opsional)'}</span>
                {showMoreFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showMoreFields && (
                <div className="form-grid two-col extra-fields-grid">
                  {(
                    [
                      ['carbohydrates', 'Karbohidrat Total', 'g'],
                      ['protein', 'Protein', 'g'],
                      ['fat', 'Lemak Total', 'g'],
                      ['sodium', 'Natrium / Garam', 'mg'],
                      ['servings', 'Sajian per Kemasan', 'sajian'],
                    ] as const
                  ).map(([key, label, unit]) => (
                    <label className="field" key={key}>
                      {label}
                      <span className="input">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="0"
                          value={values[key]}
                          onChange={(event) => update(key, event.target.value)}
                        />
                        <small>{unit}</small>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <button className="btn" type="submit">
                Lihat Hasil Evaluasi <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </main>
    </Shell>
  );
}
