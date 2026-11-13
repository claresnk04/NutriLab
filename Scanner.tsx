import { useState } from 'react';
import { ArrowRight, Camera, Image, Keyboard, ScanLine, Sparkles } from 'lucide-react';
import Shell from './Shell';
import type { Nav } from './types';

export default function Scanner({ go, manualOnly = false }: Nav & { manualOnly?: boolean }) {
  const [product, setProduct] = useState('Biskuit Gandum');
  const [manual, setManual] = useState(manualOnly);

  return (
    <Shell backLabel="Kembali" title={manual ? 'Input Nilai Gizi' : 'Pindai Label Gizi'} onBack={() => go('home')}>
      <main className="page scan-page">
        {!manual && <section className="scanner-hero">
          <div className="scanner-copy"><span className="eyebrow">LANGKAH 1</span><h1>Pindai Label Gizi</h1><p>Posisikan tabel gizi di dalam bingkai agar mudah dibaca.</p></div>
          <div className="scanner-preview" aria-label="Jendela bidik kamera">
            <ScanLine className="scanner-center-icon" size={30} />
            <div className="scan-frame"><span className="scan-laser" /></div>
            <span className="scanner-hint">Arahkan ke tabel nilai gizi</span>
          </div>
          <div className="row scanner-actions">
            <button className="btn ghost" onClick={() => setManual(false)}><Image size={18} /> Pilih Galeri</button>
            <button className="btn ghost" onClick={() => setManual(true)}><Keyboard size={18} /> Ketik Manual</button>
          </div>
          {!manual && <label className="btn ghost upload-photo-button"><Image size={18} /> Upload Foto<input type="file" accept="image/*" aria-label="Upload foto label gizi" /></label>}
        </section>}

        <form className="card validation-card" onSubmit={(event) => { event.preventDefault(); go('evaluation'); }}>
          <div className="row"><div><span className="eyebrow">{manual ? 'INPUT MANUAL' : 'HASIL OCR'}</span><h2>{manual ? 'Masukkan Nilai Gizi' : 'Validasi Angka Kemasan'}</h2></div>{!manual && <span className="status-chip safe"><Sparkles size={14} /> AI Terbaca</span>}</div>
          <label className="field">Nama Produk Makanan<span className="input"><input required value={product} onChange={(event) => setProduct(event.target.value)} /></span></label>
          <div className="form-grid two-col">
            <label className="field">Takaran Saji<span className="input"><input type="number" defaultValue="30" min="0" /><small>g</small></span></label>
            <label className="field">Sajian per Kemasan<span className="input"><input type="number" defaultValue="4" min="1" /><small>sajian</small></span></label>
            <label className="field">Gula<span className="input"><input type="number" defaultValue="7" min="0" /><small>g</small></span></label>
            <label className="field">Karbohidrat Total<span className="input"><input type="number" defaultValue="20" min="0" /><small>g</small></span></label>
            <label className="field">Lemak Jenuh<span className="input"><input type="number" defaultValue="1.5" min="0" step="0.1" /><small>g</small></span></label>
            <label className="field">Natrium/Garam<span className="input"><input type="number" defaultValue="120" min="0" /><small>mg</small></span></label>
          </div>
          <button className="btn" type="submit">Hitung Kecocokan Gizi <ArrowRight size={18} /></button>
        </form>
      </main>
    </Shell>
  );
}
