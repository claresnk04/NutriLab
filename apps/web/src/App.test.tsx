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
    const nav = screen.getByRole('navigation', { name: 'Navigasi utama' });
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(links).toHaveLength(5);
    expect(links[2]).toContain('Scan');
  });

  it.each([
    ['/', 'Home'],
    ['/riwayat', 'Riwayat'],
    ['/scan', 'Scan'],
    ['/analitik', 'Analitik'],
    ['/profil', 'Profil'],
  ])('rute %s menampilkan halaman %s', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('rute onboarding tidak menampilkan navigasi bawah', () => {
    renderAt('/onboarding');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
