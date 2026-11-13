import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from './App';
import { AuthContext } from './auth/authContext';
import type { User } from 'firebase/auth';

const testUser = { uid: 'test-user', email: 'test@example.com' } as User;

function renderAt(path: string) {
  return render(
    <AuthContext.Provider
      value={{ user: path === '/onboarding' ? null : testUser, loading: false }}
    >
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
});
