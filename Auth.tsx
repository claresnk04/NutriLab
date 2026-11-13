import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import Shell from './Shell';
import type { Nav } from './types';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';

type Mode = 'daftar' | 'masuk';

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.22Z" />
      <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.5Z" />
      <path fill="#FBBC05" d="M6.53 13.58A5.86 5.86 0 0 1 6.22 12c0-.55.11-1.09.31-1.58V7.89H3.29A9.5 9.5 0 0 0 2.25 12c0 1.48.35 2.88 1.04 4.11l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.48 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.71 5.39l3.24 2.53C7.3 8.11 9.46 6.39 12 6.39Z" />
    </svg>
  );
}

function Password({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">{label}
      <span className="input">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan' : 'Tampilkan'} style={{ background: 'none', color: 'var(--color-text-primary)' }}>
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </span>
    </label>
  );
}

export default function Auth({ go }: Nav) {
  const [mode, setMode] = useState<Mode>('daftar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const daftar = mode === 'daftar';
  const valid = /\S+@\S+\.\S+/.test(email) && pw.length >= 8 && (!daftar || (name.trim().length >= 2 && pw === pw2));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) return;
    localStorage.setItem('nutrilab-account', JSON.stringify({ name: name.trim() || 'Pak Hartono', email, password: pw }));
    go('profile');
  };

  return (
    <Shell>
      <main className="page narrow">
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList className="seg">
            <TabsTrigger value="daftar" className={daftar ? 'on' : ''}>Daftar Akun Baru</TabsTrigger>
            <TabsTrigger value="masuk" className={!daftar ? 'on' : ''}>Masuk Akun</TabsTrigger>
          </TabsList>
             <form className="card auth-card" onSubmit={submit}>
             {daftar && <label className="field">Nama Lengkap
               <span className="input"><input required minLength={2} placeholder="Contoh: Pak Hartono" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></span>
             </label>}
             <label className="field">Alamat Email
              <span className="input"><input type="email" placeholder="bapak.hartono@email.id" value={email} onChange={(e) => setEmail(e.target.value)} /></span>
            </label>
            <Password label="Kata Sandi" value={pw} onChange={setPw} />
             {daftar && <Password label="Ulangi Kata Sandi" value={pw2} onChange={setPw2} />}
             {daftar && pw2 && pw !== pw2 && <span role="alert" className="small error-text">Kata sandi belum sama.</span>}
            <div className="row small auth-divider"><span>atau gunakan email</span></div>
             <button type="button" className="btn ghost auth-google"><GoogleIcon />Lanjutkan dengan Google</button>
            <button className="btn" disabled={!valid}>{daftar ? 'Daftar & Lengkapi Profil' : 'Masuk & Lengkapi Profil'} <ArrowRight size={18} /></button>
          </form>
        </Tabs>
      </main>
    </Shell>
  );
}
