import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        surfaceHover: 'var(--surface-hover)',
        border: 'var(--border)',
        borderStrong: 'var(--border-strong)',
        text: 'var(--text)',
        textMuted: 'var(--text-muted)',
        textSoft: 'var(--text-soft)',
        accent: 'var(--accent)',
        accentHover: 'var(--accent-hover)',
        accentSoft: 'var(--accent-soft)',
        accentSoftBorder: 'var(--accent-soft-border)',
        ok: 'var(--ok)',
        okBg: 'var(--ok-bg)',
        okBorder: 'var(--ok-border)',
        warn: 'var(--warn)',
        warnBg: 'var(--warn-bg)',
        warnBorder: 'var(--warn-border)',
        danger: 'var(--danger)',
        dangerBg: 'var(--danger-bg)',
        dangerBorder: 'var(--danger-border)',
        neutral: 'var(--neutral)',
        neutralBg: 'var(--neutral-bg)',
        neutralBorder: 'var(--neutral-border)',
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
      },
    },
  },
  plugins: [],
} satisfies Config
