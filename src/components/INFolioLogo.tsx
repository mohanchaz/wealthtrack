interface Props {
  variant?: 'light' | 'dark' | 'hero'
  height?: number
}

/**
 * INFolio brand logo
 * variant='hero'  — white wordmark (for teal hero banners)
 * variant='light' — ink wordmark (for white/off-white surfaces)
 * variant='dark'  — white wordmark (for dark/ink surfaces)
 */
export function INFolioLogo({ variant = 'hero', height = 36 }: Props) {
  const nameColor  = variant === 'light' ? '#1A1A1A' : '#FFFFFF'
  const cloudFill  = variant === 'light' ? '#0F766E' : 'rgba(255,255,255,0.18)'
  const cColor     = variant === 'light' ? '#FFFFFF' : '#99F6E4'
  const tagColor   = variant === 'light' ? '#767676'
                   : variant === 'dark'  ? '#444444'
                   : 'rgba(153,246,228,0.6)'

  // viewBox is 280 × 58, scale via height
  const width = Math.round(height * (280 / 58))

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 280 58"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="INFolio"
    >
      {/* Cloud C mark */}
      <ellipse cx="16"  cy="28" rx="13" ry="13" fill={cloudFill} />
      <ellipse cx="26"  cy="17" rx="14" ry="14" fill={cloudFill} />
      <ellipse cx="39"  cy="24" rx="12" ry="12" fill={cloudFill} />
      <ellipse cx="49"  cy="30" rx="10" ry="10" fill={cloudFill} />
      <rect x="3" y="28" width="56" height="14" fill={cloudFill} />

      {/* C letterform */}
      <text
        x="19" y="42"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="18"
        fill={cColor}
      >
        C
      </text>

      {/* INFolio wordmark + green dot */}
      <text
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="30"
        letterSpacing="-0.8"
      >
        <tspan x="68" y="42" fill={nameColor}>INFolio</tspan>
        <tspan fill="#2ECC71" dx="1" fontSize="38" dy="5">.</tspan>
      </text>

      {/* Tagline */}
      <text
        x="68" y="54"
        fontFamily="DM Sans, system-ui, sans-serif"
        fontSize="8.5"
        fill={tagColor}
        letterSpacing="2"
      >
        PORTFOLIO INTELLIGENCE
      </text>
    </svg>
  )
}
