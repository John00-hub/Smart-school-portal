/** @type {import('tailwindcss').Config} */
/**
 * Design tokens are wired to the CSS variables in src/index.css.
 *
 * Components use these semantic classes — bg-brand, text-brand, bg-brand-accent
 * and friends — instead of raw hex, so re-skinning the portal for a new school
 * means editing the variables, not the components.
 *
 * The legacy `primary` / `accent` names are kept as aliases so any existing
 * markup keeps working while it is migrated.
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary semantic tokens (CSS-variable backed) ──────────────────
        brand: {
          DEFAULT: 'var(--brand-primary)',
          dark: 'var(--brand-primary-dark)',
          light: 'var(--brand-primary-light)',
          accent: 'var(--brand-accent)',
          surface: 'var(--brand-surface)',
          background: 'var(--brand-background)',
          text: 'var(--brand-text)',
          muted: 'var(--brand-text-muted)',
          border: 'var(--brand-border)',
          'on': 'var(--on-brand)',
        },
        // rgba() tints need the raw channel list, hence the rgb() wrapper.
        'brand-tint': 'rgba(var(--brand-primary-rgb), 0.08)',
        'brand-tint-strong': 'rgba(var(--brand-primary-rgb), 0.14)',
        'accent-tint': 'rgba(var(--brand-accent-rgb), 0.12)',

        // ── Legacy aliases (kept for backwards compatibility) ─────────────
        primary: 'var(--brand-primary)',
        'primary-dark': 'var(--brand-primary-dark)',
        'primary-light': 'var(--brand-primary-light)',
        secondary: 'var(--brand-surface)',
        accent: 'var(--brand-accent)',
        background: 'var(--brand-background)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 12px rgba(15, 23, 42, 0.08)',
        brand: '0 8px 24px rgba(var(--brand-primary-rgb), 0.22)',
      },
      borderRadius: {
        card: '1rem',
      },
    },
  },
  plugins: [],
}
