import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDollarSign } from 'lucide-react';
import Shell from './Shell';
import type { Nav } from './types';

const PORTIONS = ['1 Keping', '2 Keping', '4 Keping (1 Sajian)', '1 Bungkus'];

export default function Evaluation({ go }: Nav) {
  const [portion, setPortion] = useState(2);
  const sugar = [1.75, 3.5, 7, 28][portion];
  const used = Math.round((sugar / 18.8) * 100);

  return (
    <Shell backLabel="Home" title="Hasil Evaluasi" onBack={() => go('home')}>
      <main className="page evaluation-page">
        <button className="back-link" onClick={() => go('home')}><ArrowLeft size={18} /> Kembali ke Home</button>
        <section className="card score-card">
          <div className="row"><span className="score-badge score-b">B</span><span className="status-chip safe"><CheckCircle2 size={14} /> TERKENDALI</span></div>
          <span className="eyebrow">PORSI IDEAL</span><h1 className="left-title">Biskuit Gandum</h1><p className="muted-copy">Pilihan yang baik untuk menemani waktu santai. Tetap perhatikan jumlah kepingnya.</p>
          <div className="portion-section"><h3>Berapa Banyak yang Akan Dimakan?</h3><div className="portion-grid">{PORTIONS.map((item, index) => <button key={item} className={portion === index ? 'portion active' : 'portion'} onClick={() => setPortion(index)}>{item}</button>)}</div></div>
        </section>

        <section className="card impact-card">
          <div className="row"><div><span className="eyebrow">SIMULASI PORSI</span><h2>Dampak Terhadap Koin Gula</h2></div><CircleDollarSign className="impact-icon" size={28} /></div>
          <div className="impact-value">+{String(sugar).replace('.', ',')} <small>g gula</small></div>
          <div className="row small"><span>Memakai kuota harian</span><b>{used}%</b></div><div className="bar"><i style={{ width: `${used}%` }} /></div>
          <button className="btn" onClick={() => go('home')}>Saya Makan Ini (Potong Koin) <ArrowRight size={18} /></button>
          <button className="btn ghost" onClick={() => go('home')}>Cek Saja (Simulasi Tanpa Potong)</button>
        </section>
      </main>
    </Shell>
  );
}
