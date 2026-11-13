import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [adult, setAdult] = useState(false);
  const [healthData, setHealthData] = useState(false);
  const [disclaimer, setDisclaimer] = useState(false);
  const ready = adult && healthData && disclaimer;

  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">Nutri-lab</p>
      <h1 className="mt-2 text-3xl font-bold">Baca label dengan lebih mudah</h1>
      <p className="mt-3 leading-7 text-slate-600">
        Nutri-lab membantu memahami angka pada label gizi kemasan. Ini alat edukasi, bukan alat
        diagnosis atau pengganti konsultasi tenaga kesehatan.
      </p>
      <div className="mt-8 space-y-4">
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4">
          <input
            type="checkbox"
            checked={adult}
            onChange={(event) => setAdult(event.target.checked)}
          />
          <span>Saya berusia minimal 18 tahun.</span>
        </label>
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4">
          <input
            type="checkbox"
            checked={healthData}
            onChange={(event) => setHealthData(event.target.checked)}
          />
          <span>Saya menyetujui pemrosesan data kesehatan untuk fitur aplikasi.</span>
        </label>
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4">
          <input
            type="checkbox"
            checked={disclaimer}
            onChange={(event) => setDisclaimer(event.target.checked)}
          />
          <span>Saya memahami hasil bukan diagnosis dan perlu dikonfirmasi.</span>
        </label>
      </div>
      <button
        disabled={!ready}
        onClick={() => navigate('/auth')}
        className="mt-8 w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Lanjut ke masuk
      </button>
      <Link className="mt-5 block text-center text-sm text-slate-600 underline" to="/auth">
        Sudah punya akun?
      </Link>
    </div>
  );
}
