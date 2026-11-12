import type { Config } from 'tailwindcss';

const preset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Nunito"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        canvas: 'var(--color-canvas)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
          muted: 'var(--color-surface-muted)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          secondary: 'var(--color-ink-secondary)',
          tertiary: 'var(--color-ink-tertiary)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          soft: 'var(--color-accent-soft)',
          contrast: 'var(--color-accent-contrast)',
        },
        hairline: 'var(--color-border)',
        danger: 'var(--color-danger)',
        warm: 'var(--color-warm)',
      },
      borderRadius: {
        '2xl': '1.25rem', // 20px
        '3xl': '1.5rem',  // 24px (Apple Organic card radius)
        '4xl': '2rem',    // 32px (Large hero / modal sheets)
      },
      boxShadow: {
        'organic-sm': 'var(--shadow-organic-sm)',
        'organic-md': 'var(--shadow-organic-md)',
        'organic-lg': 'var(--shadow-organic-lg)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.14)',
      },
      backgroundImage: {
        'organic-canvas': 'var(--bg-organic-gradient)',
        'hero-scrim': 'linear-gradient(180deg, rgba(17, 18, 17, 0.05) 0%, rgba(17, 18, 17, 0.35) 55%, rgba(17, 18, 17, 0.88) 100%)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'sheet-up': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in': 'fade-in 0.2s ease-out forwards',
      },
    },
  },
};

export default preset;
