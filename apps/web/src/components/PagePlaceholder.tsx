interface PagePlaceholderProps {
  title: string;
  features: string;
}

/** Placeholder halaman selama tahap setup; diganti saat pengembangan fitur. */
export default function PagePlaceholder({ title, features }: PagePlaceholderProps) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-600">Belum diimplementasikan ({features}).</p>
    </section>
  );
}
