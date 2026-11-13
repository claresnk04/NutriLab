import { useState } from 'react';
import { AlertTriangle, ArrowRight, ChartPie, CircleCheck, ShieldCheck, UserRoundCheck } from 'lucide-react';
import Shell from './Shell';
import type { Nav } from './types';

const FEATURES = [
  { tag: 'Bebas Ketegangan Mata', title: 'Scan Label Gizi Instan', body: 'Cukup foto tabel Nilai Informasi Gizi di belakang kemasan. AI otomatis mendeteksi kadar gula dan lemak tanpa perlu menghitung manual.' },
  { tag: 'Eksplorasi Santai', title: 'Cek Dulu Tanpa Cemas', body: 'Ingin membandingkan makanan di supermarket? Gunakan Mode Cek Saja untuk simulasi aman tanpa mengganggu catatan grafik harian Anda.' },
  { tag: 'Hitungan Porsi Riil', title: 'Bebas Jebakan Takaran Saji', body: 'Kemasan sering mengecoh dengan mencantumkan angka per sajian kecil. NutriLab menghitung porsi riil Anda, bahkan jika hanya makan 3-4 keping.' },
];
const CONSENT = [
  'Saya berusia 18 tahun atau lebih (dewasa mandiri).',
  'Saya menyetujui pemrosesan data kesehatan dasar secara aman untuk keperluan target gizi harian.',
  'Saya memahami bahwa hasil analisis NutriLab bersifat edukasi gizi harian, bukan pengganti resep atau rekomendasi medis dokter.',
];

export default function Welcome({ go }: Nav) {
  const [checked, setChecked] = useState<boolean[]>(CONSENT.map(() => false));
  const all = checked.every(Boolean);
  const [showWarning, setShowWarning] = useState(false);
  const toggle = (i: number) => setChecked((c) => c.map((v, k) => (k === i ? !v : v)));

  return (
    <Shell>
      <main className="page">
         <div className="cols stretch welcome-layout">
           <section className="card welcome-card" style={{ alignItems: 'center', textAlign: 'center' }}>
             <span className="pill"><ShieldCheck size={16} /> Desain Khusus Ramah Lansia &amp; DM2</span>
              <img className="welcome-image" src="/grandfather.png" alt="Bapak lansia membaca label gizi dengan kaca pembesar" />
             <h1>Selamat Datang di NutriLab</h1>
             <p style={{ margin: 0 }}>Laboratorium digital gizi pribadi Anda. Pahami nilai gizi makanan kemasan tanpa rasa cemas dan kendalikan batas gula darah harian Anda secara terukur.</p>
           </section>

           <div className="grid welcome-side">
             <div className="row" style={{ gap: 14, justifyContent: 'center' }}>
               {[CircleCheck, ChartPie, UserRoundCheck].map((I, k) => (
                 <span key={k} className="feature-icon"><I size={24} /></span>
               ))}
             </div>
              <section className="card welcome-features" style={{ textAlign: 'center', alignItems: 'center' }}>
               {FEATURES.map((f) => (
                 <article key={f.title} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                   <span className="pill">{f.tag}</span><h2>{f.title}</h2><p style={{ margin: 0 }}>{f.body}</p>
                 </article>
               ))}
             </section>
              <section className="card welcome-consent" style={{ background: 'var(--color-surface-mint)' }}>
              <h3 style={{ fontSize: 16 }}>Persetujuan Wajib Privasi &amp; Medis</h3>
               {showWarning && !all && <div className="alert-banner" role="alert"><AlertTriangle size={18} /> Lengkapi ketiga persetujuan sebelum melanjutkan.</div>}
               {CONSENT.map((t, i) => (
                 <label key={t} className={`check ${checked[i] ? 'checked' : ''}`}><input type="checkbox" checked={checked[i]} onChange={() => { toggle(i); setShowWarning(false); }} />{t}</label>
               ))}
               <button className="btn" onClick={() => all ? go('auth') : setShowWarning(true)}>Mulai Sekarang <ArrowRight size={18} /></button>
            </section>
          </div>
        </div>
      </main>
    </Shell>
  );
}
