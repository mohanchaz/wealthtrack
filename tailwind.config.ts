import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Sora', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
        display: ['Sora', 'sans-serif'],
      },
      colors: {
        bg:       '#0b0f1a',
        bg2:      '#0f1422',
        surface:  '#111827',
        surface2: '#1a2235',
        surface3: '#1e293b',
        border:   '#1e2a3a',
        border2:  '#243044',
        accent:   '#3b82f6',
        accent2:  '#2563eb',
        teal:     '#14b8a6',
        green:    '#22c55e',
        amber:    '#f59e0b',
        lavender: '#818cf8',
        danger:   '#ef4444',
        warn:     '#f97316',
        textprim: '#e2e8f0',
        textsec:  '#94a3b8',
        textmut:  '#475569',
      },
      boxShadow: {
        glow:    '0 0 24px rgba(59,130,246,0.18)',
        card:    '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.25)',
        cardHov: '0 2px 8px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.35)',
      },
      animation: {
        'fade-up':   'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':   'fadeIn 0.4s ease both',
        'shimmer':   'shimmer 1.8s infinite',
        'float':     'float 3s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-6px)' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
