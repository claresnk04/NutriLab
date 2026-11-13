import type { ReactNode } from 'react';
import { ArrowLeft, Camera, ChartColumn, History, Home, User } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { AppTab } from '../../types/navigation';

const TABS: { id: AppTab; label: string; icon: ReactNode; path: string }[] = [
  { id: 'home', label: 'Home', icon: <Home size={22} />, path: '/' },
  { id: 'riwayat', label: 'Riwayat', icon: <History size={22} />, path: '/riwayat' },
  { id: 'analitik', label: 'Analitik', icon: <ChartColumn size={22} />, path: '/analitik' },
  { id: 'profil', label: 'Profil', icon: <User size={22} />, path: '/profil' },
];

interface Props {
  children: ReactNode;
  tabs?: boolean;
  tab?: AppTab;
  onTab?: (t: AppTab) => void;
  onScan?: () => void;
  backLabel?: string;
  onBack?: () => void;
  title?: string;
}

export default function Shell({ children, tabs = false, tab = 'home', onTab, onScan, backLabel, onBack, title }: Props) {
  const navigate = useNavigate();
  const goTab = (next: (typeof TABS)[number]) => {
    onTab?.(next.id);
    navigate(next.path);
  };

  return (
    <div className="shell">
      <div className="app-frame">
          <header className="appbar">
          {onBack ? <button className="back-button" onClick={onBack}><ArrowLeft size={20} /> {backLabel ?? 'Kembali'}</button> : <div className="brand"><img className="logo-mark" src="/logo.png" alt="" aria-hidden="true" /> NutriLab</div>}
          {title && <strong className="subflow-title">{title}</strong>}
          {tabs && <nav className="top-nav" aria-label="Menu utama">
            {TABS.map((t) => <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => goTab(t)}>{t.icon}{t.label}</button>)}
          </nav>}
          <span className="spacer" />
        </header>
        {children}
        {tabs && (
          <nav className="bottom-nav" aria-label="Menu bawah">
            {TABS.slice(0, 2).map((t) => <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => goTab(t)}>{t.icon}{t.label}</button>)}
            <button className="fab" aria-label="Scan makanan" onClick={onScan ?? (() => navigate('/scan'))}><Camera size={24} /></button>
            {TABS.slice(2).map((t) => <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => goTab(t)}>{t.icon}{t.label}</button>)}
          </nav>
        )}
      </div>
    </div>
  );
}
