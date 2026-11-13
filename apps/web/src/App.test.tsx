import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from './App';
import { AuthContext } from './auth/authContext';
import { saveConsent } from './lib/consent';
import type { User } from 'firebase/auth';

const testUser = { uid: 'test-user', email: 'test@example.com' } as User;

function renderAt(
  path: string,
  authenticated = path !== '/onboarding' && path !== '/auth' && !path.startsWith('/reset-password'),
) {
  return render(
    <AuthContext.Provider value={{ user: authenticated ? testUser : null, loading: false }}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('App skeleton', () => {
  it('menampilkan 5 menu navigasi bawah dengan Scan di tengah', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Menu bawah' });
    const buttons = Array.from(nav.querySelectorAll('button')).map((button) => button.textContent);
    expect(buttons).toHaveLength(5);
    expect(nav.querySelector('button[aria-label="Scan makanan"]')).toBeInTheDocument();
  });

  it.each([
    ['/', 'Dompet Koin Gizi'],
    ['/riwayat', 'Riwayat Catatan'],
    ['/scan', 'Pindai Label Gizi'],
    ['/analitik', 'Analisis Asupan'],
    ['/profil', 'Sesuaikan Batas Gizi'],
  ])('rute %s menampilkan halaman %s', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('rute onboarding tidak menampilkan navigasi bawah', () => {
    renderAt('/onboarding');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('halaman auth menampilkan tombol Google OAuth dan alur Lupa Kata Sandi', () => {
    saveConsent();
    renderAt('/auth', false);
    expect(screen.getByRole('button', { name: /Lanjutkan dengan Google/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Lupa kata sandi\?/i }));
    expect(screen.getByRole('heading', { name: 'Lupa Kata Sandi?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kirim Email Konfirmasi/i })).toBeInTheDocument();
  });

  it('rute /reset-password menampilkan halaman Buat Kata Sandi Baru', () => {
    renderAt('/reset-password', false);
    expect(screen.getByRole('heading', { name: 'Buat Kata Sandi Baru' })).toBeInTheDocument();
  });
});
