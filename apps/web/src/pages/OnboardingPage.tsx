import { useState } from 'react';
import { ArrowRight, ChartPie, CircleAlert, Camera, ShieldCheck, Scale } from 'lucide-react';
import { useNavigate } from 'react-router';
import Shell from '../components/layout/Shell';
import { saveConsent } from '../lib/consent';

const FEATURES = [
  { icon: Camera, tag: 'Bebas Ketegangan Mata', title: 'Scan Label Gizi Instan', body: 'Foto tabel Nilai Informasi Gizi di belakang kemasan. Kadar gula dan lemak terbaca otomatis tanpa hitung manual.' },
  { icon: ChartPie, tag: 'Eksplorasi Santai', title: 'Cek Dulu Tanpa Cemas', body: 'Bandingkan makanan di supermarket dengan Mode Cek Saja, tanpa mengganggu catatan harian Anda.' },
  { icon: Scale, tag: 'Hitungan Porsi Riil', title: 'Bebas Jebakan Takaran Saji', body: 'NutriLab menghitung porsi riil Anda, bahkan jika hanya makan 3-4 keping dari satu kemasan.' },
];

const CONSENT = [
  'Saya berusia 18 tahun atau lebih (dewasa mandiri).',
  'Saya menyetujui pemrosesan data kesehatan dasar secara aman untuk keperluan target gizi harian.',
  'Saya memahami hasil analisis NutriLab bersifat edukasi gizi harian, bukan pengganti resep atau rekomendasi medis dokter.',
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState<boolean[]>(CONSENT.map(() => false));
  const [showWarning, setShowWarning] = useState(false);
  const all = checked.every(Boolean);
  const count = checked.filter(Boolean).length;

  const toggle = (index: number) => {
    setChecked((current) => current.map((value, k) => (k === index ? !value : value)));
    setShowWarning(false);
  };

  function accept() {
    if (!all) {
      setShowWarning(true);
      return;
    }
    saveConsent();
    navigate('/auth', { replace: true });
  }

  return (
    <Shell>
      <main className="page onboarding-page">
        <div className="onboarding-layout">
          <section className="card onboarding-intro">
            <div className="onboarding-hero">
              <img src="/grandfather.png" alt="Bapak lansia membaca label gizi dengan kaca pembesar" />
            </div>
            <header className="onboarding-head">
              <h1>Selamat Datang di NutriLab</h1>
              <p>Laboratorium digital gizi pribadi Anda. Pahami nilai gizi makanan kemasan tanpa rasa cemas dan kendalikan batas gula harian Anda secara terukur.</p>
            </header>
          </section>

          <div className="onboarding-side">
            <div className="onboarding-feature-list">
              {FEATURES.map(({ icon: Icon, tag, title, body }) => (
                <article key={title} className="onboarding-feature-card">
                  <div className="onboarding-feature-head">
                    <span className="onboarding-feature-icon"><Icon size={20} /></span>
                    <div className="onboarding-feature-titles">
                      <span className="onboarding-feature-tag">{tag}</span>
                      <h2>{title}</h2>
                    </div>
                  </div>
                  <p>{body}</p>
                </article>
              ))}
            </div>

            <section className="card onboarding-consent">
              <header className="onboarding-consent-head">
                <span className="onboarding-shield"><ShieldCheck size={18} /></span>
                <h2>Persetujuan Privasi &amp; Medis</h2>
              </header>

              {showWarning && !all && (
                <div className="auth-feedback error" role="alert">
                  <CircleAlert size={16} className="auth-feedback-icon" />
                  <span>Centang ketiga persetujuan untuk melanjutkan.</span>
                </div>
              )}

              <div className="consent-list" role="group" aria-label="Persetujuan">
                {CONSENT.map((text, index) => (
                  <label key={text} className={`consent-item ${checked[index] ? 'checked' : ''}`}>
                    <input type="checkbox" checked={checked[index]} onChange={() => toggle(index)} />
                    <span className="consent-box" aria-hidden="true" />
                    <span>{text}</span>
                  </label>
                ))}
              </div>

              <button className="btn" type="button" onClick={accept}>
                Mulai Sekarang ({count}/{CONSENT.length}) <ArrowRight size={16} />
              </button>
            </section>
          </div>
        </div>
      </main>
    </Shell>
  );
}
