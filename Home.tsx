import { useState } from 'react';
import { CalendarDays, Camera, CircleCheck, Dot, Droplet, LogOut, PencilLine, ShieldCheck, Trash2, TrendingUp, UserRound } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Shell from './Shell';
import type { Nav, Tab } from './types';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog';

type FoodScore = 'A' | 'B' | 'C' | 'D' | 'E';
interface Activity { initial: string; name: string; detail: string; status: 'Dimakan' | 'Dicek Saja'; sugar: number; score: FoodScore }
const ACTIVITIES: Activity[] = [
  { initial: 'B', name: 'Biskuit Gandum', detail: 'Porsi: 3 keping (0,2 porsi) • 2,4 g Gula', status: 'Dimakan', sugar: 2.4, score: 'B' },
  { initial: 'C', name: 'Minuman Isotonik Botol', detail: 'Porsi: 1 botol • 16 g Gula', status: 'Dicek Saja', sugar: 16, score: 'C' },
];
const SUGAR_LIMIT = 18.8, SUGAR_USED = 6.3, FAT_LIMIT = 11.7, FAT_USED = 8.2;
const WEEKLY_INTAKE = [
  { day: 'Sen', sugar: 8.4 }, { day: 'Sel', sugar: 12.1 }, { day: 'Rab', sugar: 6.8 },
  { day: 'Kam', sugar: 10.2 }, { day: 'Jum', sugar: 7.4 }, { day: 'Sab', sugar: 14.3 }, { day: 'Min', sugar: SUGAR_USED },
];
const f = (n: number) => n.toFixed(1).replace('.', ',');
type AccountEdit = 'name' | 'email' | 'password' | null;
interface Account { name: string; email: string; password: string }
const DEFAULT_ACCOUNT: Account = { name: 'Pak Hartono', email: 'pak.hartono@email.id', password: '' };

function getStoredAccount(): Account {
  try {
    const stored = localStorage.getItem('nutrilab-account');
    return stored ? { ...DEFAULT_ACCOUNT, ...JSON.parse(stored) } : DEFAULT_ACCOUNT;
  } catch {
    return DEFAULT_ACCOUNT;
  }
}

function Meter({ value, max }: { value: number; max: number }) {
  return <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemax={max}><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>;
}

export default function Home({ go }: Nav) {
  const [tab, setTab] = useState<Tab>('home');
  const [activities, setActivities] = useState<Activity[]>(ACTIVITIES);
  const [sugarUsed, setSugarUsed] = useState(SUGAR_USED);
  const [historyFilter, setHistoryFilter] = useState<'Semua' | 'Dimakan' | 'Cek Saja'>('Semua');
  const [range, setRange] = useState<'7 Hari' | '30 Hari'>('7 Hari');
  const [logout, setLogout] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState(false);
  const [account, setAccount] = useState<Account>(getStoredAccount);
  const [accountEdit, setAccountEdit] = useState<AccountEdit>(null);
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountError, setAccountError] = useState('');
  const left = Math.max(0, SUGAR_LIMIT - sugarUsed);

  const openAccountEdit = (edit: Exclude<AccountEdit, null>) => {
    setAccountEdit(edit);
    setAccountName(account.name);
    setAccountEmail(account.email);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setAccountError('');
  };

  const closeAccountEdit = () => {
    setAccountEdit(null);
    setAccountError('');
  };

  const saveAccount = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let next = account;
    if (accountEdit === 'name') {
      if (accountName.trim().length < 2) { setAccountError('Nama minimal terdiri dari 2 karakter.'); return; }
      next = { ...account, name: accountName.trim() };
    }
    if (accountEdit === 'email') {
      if (!currentPassword || (account.password && currentPassword !== account.password)) { setAccountError('Kata sandi saat ini tidak sesuai.'); return; }
      if (!/^\S+@\S+\.\S+$/.test(accountEmail)) { setAccountError('Masukkan alamat email yang valid.'); return; }
      next = { ...account, email: accountEmail.trim() };
    }
    if (accountEdit === 'password') {
      if (!currentPassword || (account.password && currentPassword !== account.password)) { setAccountError('Kata sandi saat ini tidak sesuai.'); return; }
      if (newPassword.length < 8) { setAccountError('Kata sandi baru minimal 8 karakter.'); return; }
      if (newPassword !== confirmPassword) { setAccountError('Ulangi kata sandi baru dengan benar.'); return; }
      next = { ...account, password: newPassword };
    }
    setAccount(next);
    localStorage.setItem('nutrilab-account', JSON.stringify(next));
    closeAccountEdit();
  };

  const initials = account.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'PH';

  const deleteAllData = () => {
    setActivities([]);
    setSugarUsed(0);
    setDeleteWarning(false);
  };

  const activityList = (items: Activity[]) => items.map((activity, index) => (
    <article key={`${activity.name}-${index}`} className="tile row history-item">
      <span className={`score-badge score-${activity.score.toLowerCase()}`} aria-label={`Nutri-Score ${activity.score}`}>{activity.score}</span>
      <div className="history-copy"><div className="history-name">{activity.name}</div><div className="small">{activity.detail}</div></div>
      <span className={`badge ${activity.status === 'Dimakan' ? 'ok' : 'neutral'}`}>{activity.status}</span>
    </article>
  ));

  const renderDashboard = () => <div className="dashboard-layout">
    <section className="card dashboard-card">
      <div className="row dashboard-head"><div><div className="small dashboard-label">Sisa Jatah Hari Ini</div><h2>Dompet Koin Gizi</h2></div><span className="pill dashboard-pill"><CalendarDays size={16} /> Hari Ini</span></div>
      <div className="metric-stack">
        <article className="metric-card metric-card-primary"><div className="row metric-head"><div className="metric-title"><Droplet size={18} /> Koin Gula Harian</div><span className="status-chip safe">Aman</span></div><div className="metric-value-row"><span className="metric-value">{f(left)}</span><span className="metric-unit">g</span></div><div className="small metric-caption">Sisa kuota dari {f(SUGAR_LIMIT)} g</div><Meter value={sugarUsed} max={SUGAR_LIMIT} /><div className="row metric-meta"><span>Terpakai: {f(sugarUsed)} g</span><span>{Math.round((left / SUGAR_LIMIT) * 100)}%</span></div></article>
        <article className="metric-card"><div className="row metric-head"><div className="metric-title"><Dot /> Lemak Jenuh</div><span className="metric-number">{f(FAT_USED)} / {f(FAT_LIMIT)} g</span></div><Meter value={FAT_USED} max={FAT_LIMIT} /></article>
        <article className="metric-card status-card"><div className="metric-title"><CircleCheck size={18} /> Kondisi Terjaga</div><div className="status-text">Pola makanmu hari ini tetap dalam batas aman PERKENI.</div></article>
      </div>
    </section>
     <div className="row action-row quick-actions"><button className="btn" onClick={() => go('scan')}><Camera size={18} /> Scan Makanan</button><button className="btn ghost" onClick={() => go('scan', { scanManual: true })}><PencilLine size={18} /> Input Manual</button></div>
    <section className="card recent-card"><div className="row recent-head"><h2>Aktivitas Terakhir</h2><button className="link-button" onClick={() => setTab('riwayat')}>Lihat Semua</button></div><div className="history-list">{activityList(activities.slice(0, 3))}</div></section>
  </div>;

  const renderTab = () => {
    if (tab === 'riwayat') {
      const filtered = historyFilter === 'Semua' ? activities : activities.filter((item) => item.status === (historyFilter === 'Dimakan' ? 'Dimakan' : 'Dicek Saja'));
      return <section className="card history-page"><div className="row page-title-row"><div><span className="eyebrow">CATATAN HARIAN</span><h2>Riwayat Catatan</h2></div><button className="danger-link" onClick={() => setActivities([])}><Trash2 size={16} /> Hapus Semua</button></div><div className="filter-pills">{(['Semua', 'Dimakan', 'Cek Saja'] as const).map((filter) => <button key={filter} className={historyFilter === filter ? 'active' : ''} onClick={() => setHistoryFilter(filter)}>{filter}</button>)}</div>{filtered.length ? activityList(filtered) : <div className="empty-state">Belum ada catatan untuk filter ini.</div>}</section>;
    }
    if (tab === 'analitik') return <div className="grid analysis-page"><div className="row page-title-row"><div><span className="eyebrow">PEMANTAUAN</span><h2>Analisis Asupan</h2></div><div className="seg compact-seg">{(['7 Hari', '30 Hari'] as const).map((item) => <button key={item} className={range === item ? 'on' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div><section className="analysis-hero"><div className="eyebrow light">RATA-RATA HARIAN</div><div className="analysis-number">13,4 <small>g gula</small></div><p>Masih di bawah ambang batas PERKENI. Pertahankan pola makan terukur hari ini.</p><div className="analysis-safe"><TrendingUp size={18} /> Kepatuhan baik • {range}</div></section><section className="card"><div className="row"><h3>Tren Asupan Gula vs Batas Maksimal</h3><span className="small">gram</span></div><div className="chart"><ResponsiveContainer width="100%" height={190}><LineChart data={WEEKLY_INTAKE} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [`${value} g`, 'Gula']} /><Line type="monotone" dataKey="sugar" stroke="var(--color-nutri-teal)" strokeWidth={3} dot={{ fill: 'var(--color-nutri-teal)', r: 4 }} /></LineChart></ResponsiveContainer></div></section><section className="card top-foods"><h3>3 Makanan Paling Sering</h3>{[['Biskuit Gandum', '4 kali', 'B'], ['Nasi Putih', '3 kali', 'C'], ['Teh Manis', '2 kali', 'D']].map(([name, count, score], index) => <div className="ranking-row" key={name}><b>{index + 1}</b><span className={`score-badge score-${score.toLowerCase()}`}>{score}</span><strong>{name}</strong><span className="small">{count}</span></div>)}</section></div>;
     if (tab === 'profil') return <div className="profile-page grid">
       <section className="card account-card">
         <div className="profile-identity"><span className="profile-avatar">{initials}</span><div><h2>{account.name}</h2><p>{account.email}</p></div></div>
         <span className="status-chip safe"><ShieldCheck size={14} /> Terhubung dengan Kesehatan PERKENI</span>
         <div className="account-edit-list">
           <button className="account-edit-button" onClick={() => openAccountEdit('name')}><span><b>Nama / Username</b><small>{account.name}</small></span><PencilLine size={18} /></button>
           <button className="account-edit-button" onClick={() => openAccountEdit('email')}><span><b>Email</b><small>{account.email}</small></span><PencilLine size={18} /></button>
           <button className="account-edit-button" onClick={() => openAccountEdit('password')}><span><b>Kata Sandi</b><small>Ubah kata sandi akun</small></span><PencilLine size={18} /></button>
         </div>
       </section>
       <section className="card"><div className="row"><h3>Parameter Pribadi</h3><UserRound size={20} className="muted-icon" /></div><div className="parameter-grid"><div><span className="small">Jenis Kelamin</span><b>Perempuan</b></div><div><span className="small">Berat Badan</span><b>60 kg</b></div><div><span className="small">Batas Gula Harian</span><b>{f(SUGAR_LIMIT)} g</b></div><div><span className="small">Batas Lemak Jenuh</span><b>{f(FAT_LIMIT)} g</b></div></div></section>
       <section className="card privacy-card"><h3>Privasi &amp; Perlindungan Data</h3><div className="row consent-toggle"><span><b>Persetujuan Wajib Medis</b><small>Aktif</small></span><span className="toggle on"><i /></span></div><button className="danger-button" onClick={() => setDeleteWarning(true)}><Trash2 size={18} /> Hapus Seluruh Data Saya (PDPL)</button><button className="btn ghost logout-button" onClick={() => setLogout(true)}><LogOut size={18} /> Keluar dari Akun</button></section>
     </div>;
    return renderDashboard();
  };

  return <Shell tabs tab={tab} onTab={setTab} onScan={() => go('scan')}>
     <main className="page">{renderTab()}</main>
     <Dialog open={accountEdit !== null} onOpenChange={(open) => !open && closeAccountEdit()}>
       <DialogContent>
         <form className="dialog-form" onSubmit={saveAccount}>
           <DialogTitle className="dialog-title">{accountEdit === 'name' ? 'Ubah Nama / Username' : accountEdit === 'email' ? 'Ubah Email' : 'Ubah Kata Sandi'}</DialogTitle>
           {accountEdit === 'name' && <label className="field">Nama / Username<span className="input"><input autoFocus required minLength={2} value={accountName} onChange={(event) => setAccountName(event.target.value)} /></span></label>}
           {accountEdit === 'email' && <><label className="field">Email Baru<span className="input"><input autoFocus required type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} /></span></label><label className="field">Kata Sandi Saat Ini<span className="input"><input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></span></label></>}
           {accountEdit === 'password' && <><label className="field">Kata Sandi Saat Ini<span className="input"><input autoFocus required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></span></label><label className="field">Kata Sandi Baru<span className="input"><input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></span></label><label className="field">Ulangi Kata Sandi Baru<span className="input"><input required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></span></label></>}
           {accountError && <span className="small error-text" role="alert">{accountError}</span>}
           <button className="btn" type="submit">Simpan Perubahan <CircleCheck size={18} /></button>
         </form>
       </DialogContent>
     </Dialog>
     {deleteWarning && <div className="logout-backdrop"><section className="logout-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-data-title"><span className="logout-icon"><Trash2 size={28} /></span><h2 id="delete-data-title">Hapus seluruh data?</h2><p>Semua catatan makanan dan data akun akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</p><button className="danger-button" onClick={deleteAllData}><Trash2 size={18} /> Ya, Hapus Semua Data</button><button className="btn ghost" onClick={() => setDeleteWarning(false)}>Batal</button></section></div>}
     {logout && <div className="logout-backdrop"><section className="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title"><span className="logout-icon"><LogOut size={28} /></span><h2 id="logout-title">Ingin Beristirahat?</h2><p>Data dan catatan gizimu tetap tersimpan aman. Kamu bisa kembali kapan saja.</p><button className="danger-button" onClick={() => go('welcome')}><LogOut size={18} /> Ya, Keluar Akun</button><button className="btn ghost" onClick={() => setLogout(false)}>Tetap di Sini</button></section></div>}
  </Shell>;
}
