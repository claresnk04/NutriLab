import { NavLink } from 'react-router';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  primary?: boolean;
}

/** Navigasi bawah 5 menu; Scan di tengah dan ditonjolkan (PRD v1.1 bagian 7). */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/riwayat', label: 'Riwayat', icon: '📋' },
  { to: '/scan', label: 'Scan', icon: '📷', primary: true },
  { to: '/analitik', label: 'Analitik', icon: '📊' },
  { to: '/profil', label: 'Profil', icon: '👤' },
];

export default function BottomNav() {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex justify-center">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                item.primary
                  ? '-mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-brand text-sm font-semibold text-white shadow-lg'
                  : `flex min-h-12 min-w-12 flex-col items-center justify-center py-2 text-sm ${
                      isActive ? 'font-semibold text-brand' : 'text-slate-600'
                    }`
              }
            >
              <span aria-hidden="true" className="text-xl">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
