import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowRight, Image, Keyboard, ScanLine, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import type { ExtractionResponse } from '../schemas/extraction';
import Shell from '../components/layout/Shell';
import CameraCapture from '../components/CameraCapture';
import { blobToImageData } from '../ocr/imageTransform';
import { runClientOcr } from '../ocr/workerClient';
import { useScanStore } from '../store/scanStore';

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
  product: '', serving: '', servings: '1', energy: '', fat: '', saturatedFat: '', protein: '', carbohydrates: '', sugar: '', sodium: '',
};

function numeric(value: string) {
  if (!value.trim()) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function field(nilai: number | null) {
  return { nilai, teks_asli: nilai === null ? '' : String(nilai), keyakinan: 1 };
}

function toExtraction(values: FormValues): ExtractionResponse {
  return {
    skema_versi: '1.0', status: 'sebagian', jenis_produk_tebakan: 'makanan', basis_tabel: 'per_sajian',
    takaran_saji: { ...field(numeric(values.serving)), satuan: 'g' },
    sajian_per_kemasan: field(numeric(values.servings)), isi_bersih: { ...field(null), satuan: 'g' },
    gizi: {
      energi_kkal: field(numeric(values.energy)), lemak_total_g: field(numeric(values.fat)), lemak_jenuh_g: field(numeric(values.saturatedFat)),
      protein_g: field(numeric(values.protein)), karbohidrat_g: field(numeric(values.carbohydrates)), gula_g: field(numeric(values.sugar)),
      laktosa_g: field(null), serat_g: field(null), natrium_mg: field(numeric(values.sodium)),
    },
    petunjuk_seduh_ml: field(null), persen_akg_tercetak: {}, nutri_level_tercetak: { huruf: null }, peringatan_ekstraksi: [],
  };
}

function fromExtraction(extraction: ExtractionResponse): FormValues {
  const value = (item: { nilai: number | null }) => item.nilai === null ? '' : String(item.nilai);
  return {
    product: extraction.jenis_produk_tebakan ?? '', serving: value(extraction.takaran_saji), servings: value(extraction.sajian_per_kemasan),
    energy: value(extraction.gizi.energi_kkal), fat: value(extraction.gizi.lemak_total_g), saturatedFat: value(extraction.gizi.lemak_jenuh_g),
    protein: value(extraction.gizi.protein_g), carbohydrates: value(extraction.gizi.karbohidrat_g), sugar: value(extraction.gizi.gula_g), sodium: value(extraction.gizi.natrium_mg),
  };
}

export default function ScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const manualOnly = searchParams.get('manual') === '1';
  const extraction = useScanStore((state) => state.extraction);
  const [manual, setManual] = useState(manualOnly);
  const [values, setValues] = useState<FormValues>(() => extraction ? fromExtraction(extraction) : emptyValues);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const setImage = useScanStore((state) => state.setImage);
  const setExtraction = useScanStore((state) => state.setExtraction);
  const reset = useScanStore((state) => state.reset);

  async function processFile(file: File) {
    setError('');
    setProgress('Menyiapkan OCR…');
    setImage(file);
    try {
      const image = await blobToImageData(file);
      const result = await runClientOcr(image, { onProgress: (next) => setProgress(`${next.phase} ${next.percent}%`) });
      setExtraction(result.extraction);
      setValues(fromExtraction(result.extraction));
      setProgress('OCR selesai. Periksa hasilnya.');
      setManual(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'OCR gagal. Masukkan nilai secara manual.');
      setProgress('');
      setManual(true);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  }

  function update(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = toExtraction(values);
    const required = [next.gizi.energi_kkal, next.gizi.lemak_total_g, next.gizi.lemak_jenuh_g, next.gizi.protein_g, next.gizi.karbohidrat_g, next.gizi.gula_g, next.gizi.natrium_mg];
    if (!values.product.trim() || required.some((item) => item.nilai === null)) {
      setError('Lengkapi nama produk dan semua nilai gizi wajib.');
      return;
    }
    setExtraction(next);
    navigate('/evaluation');
  }

  return (
    <Shell backLabel="Kembali" title={manual ? 'Input Nilai Gizi' : 'Pindai Label Gizi'} onBack={() => { reset(); navigate('/'); }}>
      <main className="page scan-page">
        {!manual && <section className="scanner-hero">
          <div className="scanner-copy"><span className="eyebrow">LANGKAH 1</span><h1>Pindai Label Gizi</h1><p>Posisikan tabel gizi di dalam bingkai agar mudah dibaca.</p></div>
          <div className="scanner-preview" aria-label="Jendela bidik kamera"><ScanLine className="scanner-center-icon" size={30} /><div className="scan-frame"><span className="scan-laser" /></div><span className="scanner-hint">Arahkan ke tabel nilai gizi</span></div>
          <div className="row scanner-actions"><button className="btn ghost" onClick={() => setManual(false)} type="button"><Image size={18} /> Pilih Galeri</button><button className="btn ghost" onClick={() => setManual(true)} type="button"><Keyboard size={18} /> Ketik Manual</button></div>
          <label className="btn ghost upload-photo-button"><Image size={18} /> Upload Foto<input type="file" accept="image/*" aria-label="Upload foto label gizi" onChange={onFileChange} /></label>
          <CameraCapture onCapture={(file) => void processFile(file)} onError={setError} />
        </section>}
        {progress && <p className="small" role="status">{progress}</p>}
        <form className="card validation-card" onSubmit={submit}>
          <div className="row"><div><span className="eyebrow">{manual ? 'INPUT MANUAL' : 'HASIL OCR'}</span><h2>{manual ? 'Masukkan Nilai Gizi' : 'Validasi Angka Kemasan'}</h2></div>{!manual && <span className="status-chip safe"><Sparkles size={14} /> AI Terbaca</span>}</div>
          {error && <p className="small error-text" role="alert">{error}</p>}
          <label className="field">Nama Produk Makanan<span className="input"><input required value={values.product} onChange={(event) => update('product', event.target.value)} /></span></label>
          <div className="form-grid two-col">
            {([['serving', 'Takaran Saji', 'g'], ['servings', 'Sajian per Kemasan', 'sajian'], ['energy', 'Energi', 'kkal'], ['fat', 'Lemak Total', 'g'], ['saturatedFat', 'Lemak Jenuh', 'g'], ['protein', 'Protein', 'g'], ['carbohydrates', 'Karbohidrat Total', 'g'], ['sugar', 'Gula', 'g'], ['sodium', 'Natrium/Garam', 'mg']] as const).map(([key, label, unit]) => <label className="field" key={key}>{label}<span className="input"><input type="number" min="0" step="0.1" required value={values[key]} onChange={(event) => update(key, event.target.value)} /><small>{unit}</small></span></label>)}
          </div>
          <button className="btn" type="submit">Hitung Kecocokan Gizi <ArrowRight size={18} /></button>
        </form>
      </main>
    </Shell>
  );
}
