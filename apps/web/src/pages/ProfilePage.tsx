import { useState } from 'react';
import { logout } from '../auth/authService';
import { useAuth } from '../auth/useAuth';
import { saveProfile } from '../firestore/profileRepository';

export default function ProfilePage() {
  const { user } = useAuth();
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');

  async function save() {
    if (!user) return;
    await saveProfile(user.uid, { targetKaloriManual: target ? Number(target) : undefined });
    setMessage('Profil tersimpan.');
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">F-03, F-13</p>
        <h1 className="mt-1 text-3xl font-bold">Profil</h1>
        <p className="mt-2 text-slate-600">{user?.email}</p>
      </div>
      <label className="block">
        Target kalori manual (opsional)
        <input
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          type="number"
          min="1000"
          max="4000"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="Contoh: 1500"
        />
      </label>
      <button
        className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white"
        type="button"
        onClick={save}
      >
        Simpan profil
      </button>
      {message && (
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
      )}
      <button
        className="w-full rounded-xl border border-red-200 px-4 py-3 font-semibold text-red-700"
        type="button"
        onClick={() => void logout()}
      >
        Keluar
      </button>
    </section>
  );
}
