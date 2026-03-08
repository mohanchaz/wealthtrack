import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        /* ── Backgrounds ─────────────────────────────── */
        bg:       '#f0fdf9',   /* teal-tinted near-white page bg */
        bg2:      '#f8fffe',   /* slightly lighter surface */
        surface:  '#ffffff',   /* cards */
        surface2: '#f0fdf9',   /* nested wells */
        surface3: '#e6faf6',   /* hover states */

        /* ── Borders ────────────────────────────────── */
        border:   '#b2f0e8',   /* soft teal border */
        border2:  '#5eead4',   /* active/hover border */

        /* ── Brand colours ───────────────────────────── */
        teal:     '#0d9488',   /* primary CTA, links */
        teal2:    '#0f766e',   /* darker hover */
        cyan:     '#0891b2',   /* teal-blue accent */
        cyan2:    '#0e7490',
        green:    '#059669',   /* positive / gain */
        green2:   '#047857',
        mint:     '#34d399',   /* light green highlight */

        /* ── Status ─────────────────────────────────── */
        amber:    '#d97706',
        amber2:   '#b45309',
        red:      '#dc2626',
        red2:     '#b91c1c',

        /* ── Text ───────────────────────────────────── */
        textprim: '#0f172a',   /* slate-900 */
        textsec:  '#334155',   /* slate-700 */
        textmut:  '#64748b',   /* slate-500 */
        textfade: '#94a3b8',   /* slate-400 */
      },
      boxShadow: {
        card:     '0 1px 3px rgba(13,148,136,0.07), 0 4px 16px rgba(13,148,136,0.06)',
        cardHov:  '0 2px 8px rgba(13,148,136,0.12), 0 8px 32px rgba(13,148,136,0.10)',
        glow:     '0 0 0 3px rgba(13,148,136,0.18)',
        inner:    'inset 0 1px 4px rgba(13,148,136,0.06)',
      },
      animation: {
        'fade-up':    'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':    'fadeIn 0.3s ease both',
        'slide-in':   'slideIn 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'shimmer':    'shimmer 1.8s infinite',
        'float':      'float 3s ease-in-out infinite',
        'pulse-dot':  'pulseDot 2s ease infinite',
        'spin-slow':  'spin 3s linear infinite',
      },
      keyframes: {
        fadeUp:   { from: { opacity:'0', transform:'translateY(14px)' }, to: { opacity:'1', transform:'translateY(0)' } },
        fadeIn:   { from: { opacity:'0' }, to: { opacity:'1' } },
        slideIn:  { from: { opacity:'0', transform:'translateX(-12px)' }, to: { opacity:'1', transform:'translateX(0)' } },
        shimmer:  { '0%':{ backgroundPosition:'-200% 0' }, '100%':{ backgroundPosition:'200% 0' } },
        float:    { '0%,100%':{ transform:'translateY(0)' }, '50%':{ transform:'translateY(-6px)' } },
        pulseDot: { '0%,100%':{ opacity:'1' }, '50%':{ opacity:'0.3' } },
      },
    },
  },
  plugins: [],
} satisfies Config
