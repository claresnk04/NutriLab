import { useAuth } from '../auth/useAuth';

export default function HomePage() {
  const { user } = useAuth();
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">F-10</p>
        <h1 className="mt-1 text-3xl font-bold">Home</h1>
        <p className="mt-2 font-medium">Halo, {user?.email?.split('@')[0] ?? 'teman'}</p>
        <p className="mt-2 text-slate-600">
          Pantau pilihan makanan berdasarkan label gizi, bukan sebagai diagnosis medis.
        </p>
      </div>
      <div className="rounded-2xl bg-teal-50 p-5">
        <h2 className="font-bold text-teal-950">Mulai dari label pertama</h2>
        <p className="mt-2 text-sm text-teal-900">
          Foto tabel Informasi Nilai Gizi, periksa hasil bacaan, lalu simpan sebagai cek atau
          konsumsi.
        </p>
      </div>
    </section>
  );
}
