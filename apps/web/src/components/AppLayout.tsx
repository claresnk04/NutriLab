import { Outlet } from 'react-router';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pt-6 pb-28">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
