import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"Inter"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
        display: ['"Inter"', 'sans-serif'],
      },
      colors: {
        /* ── Backgrounds ─────────────────────────────── */
        bg:       '#F5F4F0',
        bg2:      '#EFEDE8',
        surface:  '#FFFFFF',
        surface2: '#F5F4F0',
        surface3: '#EFEDE8',

        /* ── Borders ────────────────────────────────── */
        border:   '#E0DDD6',
        border2:  '#C8C4BC',

        /* ── Brand / Ink ─────────────────────────────── */
        teal:     '#1A1A1A',   /* repurposed — primary CTA = ink */
        teal2:    '#333333',
        ink:      '#1A1A1A',
        ink2:     '#333333',
        chalk:    '#FFFFFF',
        cyan:     '#1A1A1A',
        cyan2:    '#333333',
        mint:     '#22C55E',

        /* ── Status ─────────────────────────────────── */
        green:    '#1A7A3C',
        green2:   '#155C2D',
        amber:    '#B45309',
        amber2:   '#92400E',
        red:      '#C0392B',
        red2:     '#9B2C2C',

        /* ── Text ───────────────────────────────────── */
        textprim: '#1A1A1A',
        textsec:  '#3D3D3D',
        textmut:  '#767676',
        textfade: '#ABABAB',
      },
      boxShadow: {
        card:    '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
        cardHov: '0 2px 8px rgba(0,0,0,0.10), 0 8px 28px rgba(0,0,0,0.08)',
        glow:    '0 0 0 3px rgba(0,0,0,0.12)',
        inner:   'inset 0 1px 3px rgba(0,0,0,0.06)',
        ink:     '0 4px 14px rgba(0,0,0,0.18)',
      },
      animation: {
        'fade-up':   'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':   'fadeIn 0.25s ease both',
        'slide-in':  'slideIn 0.3s cubic-bezier(0.22,1,0.36,1) both',
        'shimmer':   'shimmer 1.8s infinite',
        'float':     'float 3s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeUp:   { from: { opacity:'0', transform:'translateY(12px)' }, to: { opacity:'1', transform:'translateY(0)' } },
        fadeIn:   { from: { opacity:'0' }, to: { opacity:'1' } },
        slideIn:  { from: { opacity:'0', transform:'translateX(-10px)' }, to: { opacity:'1', transform:'translateX(0)' } },
        shimmer:  { '0%':{ backgroundPosition:'-200% 0' }, '100%':{ backgroundPosition:'200% 0' } },
        float:    { '0%,100%':{ transform:'translateY(0)' }, '50%':{ transform:'translateY(-5px)' } },
        pulseDot: { '0%,100%':{ opacity:'1' }, '50%':{ opacity:'0.3' } },
      },
    },
  },
  plugins: [],
} satisfies Config
