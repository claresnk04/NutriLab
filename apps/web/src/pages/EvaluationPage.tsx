import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { evaluate, type ProductInput } from '@nutri-lab/scoring';
import Shell from '../components/layout/Shell';
import { useAuth } from '../auth/useAuth';
import { saveEntry } from '../firestore/entryRepository';
import { getProfile } from '../firestore/profileRepository';
import { useScanStore } from '../store/scanStore';

const PORTIONS = [0.5, 1, 1.5, 2];
const PORTION_LABELS = ['½ Porsi', '1 Porsi', '1½ Porsi', '2 Porsi'];

const formatNum = (val: number) => val.toFixed(1).replace(/\.0$/, '').replace('.', ',');

export default function EvaluationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const extraction = useScanStore((state) => state.extraction);
  const reset = useScanStore((state) => state.reset);
  const [portionIndex, setPortionIndex] = useState(1); // Default 1 Porsi
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfile>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) void getProfile(user.uid).then(setProfile);
  }, [user]);

  const product = useMemo<ProductInput | null>(() => {
    if (!extraction) return null;
    const gizi = extraction.gizi;
    return {
      jenisProduk: 'makanan',
      basisTabel: extraction.basis_tabel,
      takaranSaji: extraction.takaran_saji.nilai,
      isiBersih: extraction.isi_bersih.nilai,
      sajianPerKemasan: extraction.sajian_per_kemasan.nilai,
      energiKkal: gizi.energi_kkal.nilai,
      lemakTotalG: gizi.lemak_total_g.nilai,
      lemakJenuhG: gizi.lemak_jenuh_g.nilai,
      proteinG: gizi.protein_g.nilai,
      karbohidratG: gizi.karbohidrat_g.nilai,
      gulaG: gizi.gula_g.nilai,
      laktosaG: gizi.laktosa_g.nilai,
      seratG: gizi.serat_g.nilai,
      natriumMg: gizi.natrium_mg.nilai,
      nutriLevel: extraction.nutri_level_tercetak.huruf,
    };
  }, [extraction]);

  const servings = PORTIONS[portionIndex] ?? 1;
  const result = useMemo(
    () => (product ? evaluate({ profile, product, servings }) : null),
    [product, profile, servings],
  );

  const eatenSugar = result?.normalized?.eaten.gulaG ?? (product?.gulaG ?? 0) * servings;
  const eatenFat = result?.normalized?.eaten.lemakJenuhG ?? (product?.lemakJenuhG ?? 0) * servings;
  const statusTone = result?.status === 'hijau' ? 'safe' : result?.status === 'kuning' ? 'warn' : 'danger';
  const statusTitle =
    result?.status === 'hijau'
      ? 'Aman Dikonsumsi'
      : result?.status === 'kuning'
        ? 'Perlu Dibatasi'
        : 'Sebaiknya Dihindari';
  const gradeLetter = result?.status === 'hijau' ? 'A' : result?.status === 'kuning' ? 'C' : 'E';

  async function save(status: 'dimakan' | 'dicek') {
    if (!user || !extraction || !product || !result) return;
    setSaving(true);
    setError('');
    try {
      await saveEntry({
        uid: user.uid,
        namaProduk: extraction.jenis_produk_tebakan ?? 'Produk Kemasan',
        jenisProduk: product.jenisProduk,
        basisTabel: product.basisTabel,
         nilaiLabel: extraction,
         nSajian: servings,
         status,
         waktuMakan: new Date().toISOString(),
         zonaWaktu: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dikonfirmasiPengguna: true,
        hasilSnapshot: result,
        configVersion: result.configVersion,
      });
      reset();
      navigate('/');
    } catch {
      setError('Hasil belum dapat disimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  if (!extraction || !product || !result) {
    return (
      <Shell backLabel="Kembali" title="Hasil Evaluasi" onBack={() => navigate('/scan')}>
        <main className="page narrow">
          <section className="card empty-state">
            Belum ada data label untuk dinilai.
            <button className="btn" onClick={() => navigate('/scan')} type="button">
              Mulai Scan
            </button>
          </section>
        </main>
      </Shell>
    );
  }

  return (
    <Shell backLabel="Ubah Angka" title="Hasil Evaluasi" onBack={() => navigate('/scan')}>
      <main className="page evaluation-page">
        <div className="scan-layout">
          <section className="card eval-card">
            <header className="row eval-head">
              <div className="eval-title-wrap">
                <span className="eyebrow">HASIL ANALISIS</span>
                <h1 className="left-title">{extraction.jenis_produk_tebakan || 'Produk Kemasan'}</h1>
              </div>
              <span className={`score-badge score-badge-lg score-${gradeLetter.toLowerCase()}`}>
                {gradeLetter}
              </span>
            </header>

            <div className="eval-status-block">
              <span className={`status-inline ${statusTone}`}>
                <span className="status-dot" aria-hidden="true" />
                {statusTitle}
              </span>
              <p className="muted-copy eval-reason">
                {result.reasons[0] ?? 'Sesuaikan porsi di bawah ini sebelum menyimpan ke catatan harian.'}
              </p>
            </div>

            <div className="eval-impact-row">
              <div className="eval-impact-box">
                <span className="eval-impact-label">Tambahan Gula</span>
                <strong className="eval-impact-num">+{formatNum(eatenSugar)} g</strong>
              </div>
              <div className="eval-impact-box">
                <span className="eval-impact-label">Lemak Jenuh</span>
                <strong className="eval-impact-num">+{formatNum(eatenFat)} g</strong>
              </div>
            </div>

            <div className="portion-section">
              <div className="row portion-head">
                <h3>Porsi yang Dikonsumsi</h3>
                <span className="small">{servings} sajian</span>
              </div>
              <div className="portion-pills">
                {PORTIONS.map((value, index) => (
                  <button
                    key={value}
                    className={portionIndex === index ? 'portion-pill active' : 'portion-pill'}
                    onClick={() => setPortionIndex(index)}
                    type="button"
                  >
                    {PORTION_LABELS[index]}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="small error-text" role="alert">
                {error}
              </p>
            )}

            <div className="eval-actions">
              <button
                className="btn"
                onClick={() => void save('dimakan')}
                disabled={saving}
                type="button"
              >
                <Check size={17} />
                {saving ? 'Menyimpan…' : 'Catat Dikonsumsi'}
              </button>
              <div className="row eval-sub-actions">
                <button
                  className="btn secondary"
                  onClick={() => void save('dicek')}
                  disabled={saving}
                  type="button"
                >
                  Hanya Cek Saja
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    reset();
                    navigate('/scan');
                  }}
                  type="button"
                >
                  <RotateCcw size={15} /> Scan Baru
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </Shell>
  );
}
