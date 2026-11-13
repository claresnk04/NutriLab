/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nutri: {
          teal: 'var(--color-nutri-teal)',
          dark: 'var(--color-nutri-dark)',
          green: 'var(--color-nutri-green)',
        },
        surface: {
          canvas: 'var(--color-surface-canvas)',
          mint: 'var(--color-surface-mint)',
          card: 'var(--color-surface-card)',
        },
        border: {
          mint: 'var(--color-border-mint)',
        },
        ink: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        status: {
          'safe-bg': 'var(--color-safe-bg)',
          'safe-text': 'var(--color-safe-text)',
          'warn-bg': 'var(--color-warn-bg)',
          'warn-border': 'var(--color-warn-border)',
          'warn-text': 'var(--color-warn-text)',
          'danger-bg': 'var(--color-danger-bg)',
          'danger-border': 'var(--color-danger-border)',
          'danger-text': 'var(--color-danger-text)',
        },
        scanner: {
          bg: 'var(--color-scanner-bg)',
          accent: 'var(--color-scanner-accent)',
        },
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
};
