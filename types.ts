/** Satu layar mobile pada file ISCOMFEST.svg (koordinat dalam kanvas asli). */
export interface Screen {
  id: number;
  x: number;
  y: number;
  /** Tinggi layar asli pada lebar 390 px. */
  height: number;
}

export type ViewportKind = 'android' | 'desktop';

export type ScreenId = 'welcome' | 'auth' | 'profile' | 'home' | 'scan' | 'evaluation';

export type Tab = 'home' | 'riwayat' | 'analitik' | 'profil';

export interface Nav {
  go: (screen: ScreenId, options?: { scanManual?: boolean }) => void;
}
