import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDollarSign } from 'lucide-react';
import { useNavigate } from 'react-router';
import { evaluate, type ProductInput } from '@nutri-lab/scoring';
import Shell from '../components/layout/Shell';
import { useAuth } from '../auth/useAuth';
import { saveEntry } from '../firestore/entryRepository';
import { getProfile } from '../firestore/profileRepository';
import { useScanStore } from '../store/scanStore';

const PORTIONS = [1, 2, 4, 8];
const PORTION_LABELS = ['1 Keping', '2 Keping', '4 Keping (1 Sajian)', '1 Bungkus'];

export default function EvaluationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const extraction = useScanStore((state) => state.extraction);
  const reset = useScanStore((state) => state.reset);
  const [portionIndex, setPortionIndex] = useState(2);
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
      jenisProduk: 'makanan', basisTabel: extraction.basis_tabel, takaranSaji: extraction.takaran_saji.nilai,
      isiBersih: extraction.isi_bersih.nilai, sajianPerKemasan: extraction.sajian_per_kemasan.nilai,
      energiKkal: gizi.energi_kkal.nilai, lemakTotalG: gizi.lemak_total_g.nilai, lemakJenuhG: gizi.lemak_jenuh_g.nilai,
      proteinG: gizi.protein_g.nilai, karbohidratG: gizi.karbohidrat_g.nilai, gulaG: gizi.gula_g.nilai,
      laktosaG: gizi.laktosa_g.nilai, seratG: gizi.serat_g.nilai, natriumMg: gizi.natrium_mg.nilai,
      nutriLevel: extraction.nutri_level_tercetak.huruf,
    };
  }, [extraction]);

  const result = useMemo(() => product ? evaluate({ profile, product, servings: PORTIONS[portionIndex] ?? 1 }) : null, [product, profile, portionIndex]);
  const sugar = product?.gulaG ?? 0;
  const statusClass = result?.status === 'hijau' ? 'safe' : result?.status === 'kuning' ? 'warning' : 'danger';

  async function save(status: 'dimakan' | 'dicek') {
    if (!user || !extraction || !product || !result) return;
    setSaving(true);
    setError('');
    try {
      await saveEntry({ uid: user.uid, namaProduk: extraction.jenis_produk_tebakan ?? 'Produk makanan', jenisProduk: product.jenisProduk, basisTabel: product.basisTabel, nilaiLabel: extraction, nSajian: PORTIONS[portionIndex] ?? 1, status, zonaWaktu: Intl.DateTimeFormat().resolvedOptions().timeZone, dikonfirmasiPengguna: true, hasilSnapshot: result, configVersion: result.configVersion });
      reset();
      navigate('/');
    } catch {
      setError('Hasil belum dapat disimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  if (!extraction || !product || !result) {
    return <Shell backLabel="Kembali" title="Hasil Evaluasi" onBack={() => navigate('/scan')}><main className="page narrow"><section className="card empty-state">Belum ada data label untuk dinilai.<button className="btn" onClick={() => navigate('/scan')} type="button">Mulai Scan</button></section></main></Shell>;
  }

  return (
    <Shell backLabel="Home" title="Hasil Evaluasi" onBack={() => navigate('/')}>
      <main className="page evaluation-page">
        <button className="back-link" onClick={() => navigate('/')} type="button"><ArrowLeft size={18} /> Kembali ke Home</button>
        <section className="card score-card">
          <div className="row"><span className={`score-badge score-${statusClass === 'safe' ? 'a' : statusClass === 'warning' ? 'c' : 'e'}`}>{result.status === 'hijau' ? 'A' : result.status === 'kuning' ? 'C' : 'E'}</span><span className={`status-chip ${statusClass}`}><CheckCircle2 size={14} /> {result.status.toUpperCase()}</span></div>
          <span className="eyebrow">PORSI IDEAL</span><h1 className="left-title">{extraction.jenis_produk_tebakan ?? 'Produk Makanan'}</h1><p className="muted-copy">{result.reasons[0] ?? 'Periksa jumlah porsi dan simpan hasilnya ke catatan harian.'}</p>
          <div className="portion-section"><h3>Berapa Banyak yang Akan Dimakan?</h3><div className="portion-grid">{PORTIONS.map((value, index) => <button key={value} className={portionIndex === index ? 'portion active' : 'portion'} onClick={() => setPortionIndex(index)} type="button">{PORTION_LABELS[index]}</button>)}</div></div>
        </section>
        <section className="card impact-card">
          <div className="row"><div><span className="eyebrow">SIMULASI PORSI</span><h2>Dampak Terhadap Koin Gula</h2></div><CircleDollarSign className="impact-icon" size={28} /></div>
          <div className="impact-value">+{sugar.toString().replace('.', ',')} <small>g gula per sajian</small></div>
          <div className="row small"><span>Status penilaian</span><b>{result.status}</b></div><div className="bar"><i style={{ width: `${result.status === 'hijau' ? 35 : result.status === 'kuning' ? 65 : 100}%` }} /></div>
          {error && <p className="small error-text" role="alert">{error}</p>}
          <button className="btn" onClick={() => void save('dimakan')} disabled={saving} type="button">{saving ? 'Menyimpan…' : 'Saya Makan Ini (Simpan)'} <ArrowRight size={18} /></button>
          <button className="btn ghost" onClick={() => void save('dicek')} disabled={saving} type="button">Cek Saja (Simpan Simulasi)</button>
        </section>
      </main>
    </Shell>
  );
}
